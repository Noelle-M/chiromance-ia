"""Independent, experimental palm-crease extraction API.

This extracts image-supported candidate crease pixels; it does NOT reliably
identify traditional palmistry lines. No invented polylines are returned.
"""
from io import BytesIO
import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
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


def crease_candidates(image):
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
    threshold = max(15, float(np.percentile(response, 91)))
    mask = np.uint8(response >= threshold) * 255
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
async def analyze(photo: UploadFile = File(...)):
    raw = await photo.read(MAX_BYTES + 1)
    image = decode_image(raw)
    mask = crease_candidates(image)
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
async def preview(photo: UploadFile = File(...)):
    image = decode_image(await photo.read(MAX_BYTES + 1))
    mask = crease_candidates(image)
    overlay = image.copy()
    overlay[mask > 0] = (0, 215, 255)
    result = cv2.addWeighted(image, 0.55, overlay, 0.45, 0)
    success, encoded = cv2.imencode(".png", result)
    if not success:
        raise HTTPException(500, "Impossible de generer l'apercu")
    return Response(encoded.tobytes(), media_type="image/png")
