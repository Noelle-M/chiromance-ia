"""Independent, experimental palm-crease extraction API.

This extracts image-supported candidate crease pixels; it does NOT reliably
identify traditional palmistry lines. No invented polylines are returned.
"""
from io import BytesIO
import json
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, HTMLResponse
from PIL import Image, ImageOps, UnidentifiedImageError

app = FastAPI(title="Chiromancie IA - Vision", version="0.1.0")
MAX_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600


def decode_image(raw: bytes):
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Photo trop volumineuse (12 Mo maximum)")
    try:
        pil = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(422, "Image illisible")
    pil.thumbnail((MAX_SIDE, MAX_SIDE))
    return cv2.cvtColor(np.asarray(pil), cv2.COLOR_RGB2BGR)


def automatic_palm_roi(image):
    """Heuristic palm region, returns None rather than claiming certainty.

    Uses skin colour relative to image borders and the dominant central
    foreground component. This is not a trained hand segmentation model.
    """
    h, w = image.shape[:2]
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    skin = cv2.inRange(ycrcb, (0, 130, 75), (255, 185, 140))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, kernel, iterations=2)
    n, labels, stats, centers = cv2.connectedComponentsWithStats(skin, 8)
    candidates = []
    for i in range(1, n):
        x, y, bw, bh, area = map(int, stats[i])
        cx, cy = centers[i]
        if area > 0.06 * h * w and bw > 0.22 * w and bh > 0.28 * h:
            score = area / (h * w) - 0.15 * abs(cx / w - 0.5)
            candidates.append((score, i))
    if not candidates:
        return None
    index = max(candidates)[1]
    component = np.uint8(labels == index) * 255
    ys, xs = np.where(component > 0)
    if len(xs) < 100:
        return None
    x0, x1 = np.percentile(xs, [10, 90])
    y0, y1 = np.percentile(ys, [10, 90])
    # Conservative central palm zone, deliberately avoiding fingers and wrist.
    bx0, bx1 = int(x0 + 0.10 * (x1 - x0)), int(x1 - 0.10 * (x1 - x0))
    by0, by1 = int(y0 + 0.34 * (y1 - y0)), int(y0 + 0.78 * (y1 - y0))
    region = np.zeros((h, w), np.uint8)
    region[max(0, by0):min(h, by1), max(0, bx0):min(w, bx1)] = 255
    region = cv2.bitwise_and(region, component)
    if cv2.countNonZero(region) < 0.02 * h * w:
        return None
    return cv2.erode(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))


def resolve_roi(image, roi_json):
    if roi_json:
        return palm_roi(image, roi_json), "manual"
    auto = automatic_palm_roi(image)
    if auto is None:
        raise HTTPException(422, "Paume non isolee automatiquement. Fournir une zone roi manuelle.")
    return auto, "automatic_heuristic"


def palm_roi(image, roi_json=None):
    """Optional manually reviewed polygon in normalized image coordinates.

    Automatic palm segmentation is not implemented yet. Without a polygon,
    the entire image remains eligible and results must be treated as diagnostic.
    """
    height, width = image.shape[:2]
    mask = np.full((height, width), 255, dtype=np.uint8)
    if not roi_json:
        return mask
    try:
        points = json.loads(roi_json)
        if not isinstance(points, list) or not 3 <= len(points) <= 40:
            raise ValueError("Polygon must have 3 to 40 points")
        if any(not isinstance(p, list) or len(p) != 2 or
               any(not isinstance(v, (int, float)) or not np.isfinite(v) or v < 0 or v > 1 for v in p)
               for p in points):
            raise ValueError("Coordinates must be normalized pairs")
        polygon = np.rint(np.array(points) * [width - 1, height - 1]).astype(np.int32)
    except (ValueError, TypeError, OverflowError) as exc:
        raise HTTPException(422, f"Zone de paume invalide: {exc}")
    mask[:] = 0
    cv2.fillPoly(mask, [polygon], 255)
    mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    return mask


def crease_candidates(image, roi=None):
    """Highlight dark, locally elongated creases using image evidence only.

    The output is a diagnostic mask, NOT a set of named palm lines.
    Background texture and shadows may also be detected.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8)).apply(gray)
    # Dark thin structures on lighter skin at several scales.
    masks = []
    for k in (9, 15, 23):
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        masks.append(cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel))
    response = np.maximum.reduce(masks)
    response = cv2.GaussianBlur(response, (3, 3), 0)
    if roi is None:
        roi = np.full(gray.shape, 255, dtype=np.uint8)
    selected = response[roi > 0]
    if selected.size == 0:
        raise HTTPException(422, 'Zone de paume vide')
    threshold = max(12, float(np.percentile(selected, 88 if np.count_nonzero(roi) < roi.size else 91)))
    mask = np.uint8((response >= threshold) & (roi > 0)) * 255
    # Remove isolated specks, retain longer connected evidence.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    filtered = np.zeros_like(mask)
    min_area = max(8, int(mask.size * 0.00002))
    for idx in range(1, count):
        if stats[idx, cv2.CC_STAT_AREA] >= min_area:
            filtered[labels == idx] = 255
    return filtered


@app.get("/health")
def health():
    return {"ok": True, "stage": "experimental"}


@app.post("/analyze")
async def analyze(photo: UploadFile = File(...), roi: str | None = Form(None)):
    raw = await photo.read(MAX_BYTES + 1)
    image = decode_image(raw)
    region, mode = resolve_roi(image, roi)
    mask = crease_candidates(image, region)
    height, width = mask.shape
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    components = []
    for idx in range(1, count):
        x, y, w, h, area = map(int, stats[idx])
        if area < 12:
            continue
        components.append({
            "bbox": {"x": x / width, "y": y / height,
                     "width": w / width, "height": h / height},
            "pixel_area": area,
        })
    components.sort(key=lambda c: c["pixel_area"], reverse=True)
    return {
        "status": "experimental",
        "roi_mode": mode,
        "image_width": width, "image_height": height,
        "candidate_regions": components[:80],
        "lines": [],
        "quality_notes": (
            "Zones de plis potentielles seulement. Les lignes de vie, de coeur "
            "et de tete ne sont pas identifiees automatiquement. "
            "Aucune interpretation ne doit etre generee a partir de ce resultat."
        ),
        "mask_endpoint": "/preview (envoyer la meme photo)",
    }


@app.post("/preview")
async def preview(photo: UploadFile = File(...), roi: str | None = Form(None)):
    image = decode_image(await photo.read(MAX_BYTES + 1))
    region, _ = resolve_roi(image, roi)
    mask = crease_candidates(image, region)
    overlay = image.copy()
    overlay[mask > 0] = (0, 215, 255)
    contours, _ = cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, (255, 160, 0), 2)
    result = cv2.addWeighted(image, 0.55, overlay, 0.45, 0)
    success, encoded = cv2.imencode(".png", result)
    if not success:
        raise HTTPException(500, "Impossible de generer l'apercu")
    return Response(encoded.tobytes(), media_type="image/png")
