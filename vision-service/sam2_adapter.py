"""Optional SAM 2 point-prompt segmentation; no claim of crease identification.

Install separately and provide a compatible local checkpoint/config. Model
weights are never downloaded implicitly and are not committed to GitHub.
"""
from functools import lru_cache
import os
import threading
import numpy as np
import cv2

_LOCK = threading.Lock()


@lru_cache(maxsize=1)
def load_predictor():
    checkpoint = os.getenv("SAM2_CHECKPOINT")
    config = os.getenv("SAM2_CONFIG")
    if not checkpoint or not config:
        raise RuntimeError("Configurer SAM2_CHECKPOINT et SAM2_CONFIG")
    if not os.path.isfile(checkpoint):
        raise RuntimeError("Checkpoint SAM 2 introuvable")
    try:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        import torch
    except ImportError as exc:
        raise RuntimeError("SAM 2 / PyTorch non installes") from exc
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_sam2(config, checkpoint, device=device)
    return SAM2ImagePredictor(model)


def segment_with_points(bgr, positive, negative):
    """Return raw SAM 2 mask, not a named palm line."""
    if not positive:
        raise ValueError("Au moins un point positif est necessaire")
    h, w = bgr.shape[:2]
    coords = np.array(positive + negative, dtype=np.float32)
    if np.any(~np.isfinite(coords)) or np.any(coords < 0) or np.any(coords > 1):
        raise ValueError("Points hors de l'image")
    coords *= np.array([w - 1, h - 1], dtype=np.float32)
    labels = np.array([1] * len(positive) + [0] * len(negative), dtype=np.int32)
    predictor = load_predictor()
    with _LOCK:
        predictor.set_image(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        masks, scores, _ = predictor.predict(
            point_coords=coords, point_labels=labels, multimask_output=True
        )
    best = int(np.argmax(scores))
    return np.asarray(masks[best], dtype=np.uint8) * 255, float(scores[best])
