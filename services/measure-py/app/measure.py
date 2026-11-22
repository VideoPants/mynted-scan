from __future__ import annotations

from typing import Any, Literal

import cv2
import numpy as np

from app.geometry import subpixel_peak
from app.ratios import lr_ratio, tb_ratio

Face = Literal["FRONT", "BACK"]
Status = Literal["OK", "LOW_CONFIDENCE", "UNSUPPORTED", "MANUAL"]

PROFILE = {
    "width_mm": 63.0,
    "height_mm": 88.0,
    "px_per_mm": 20.0,
    "corner_skip": 0.12,
    "stations": 60,
}


def measure(image: np.ndarray, face: Face = "FRONT", profile: dict | None = None) -> dict[str, Any]:
    """Full reference pipeline on a BGR image."""
    profile = profile or PROFILE
    if image is None or image.size == 0:
        return _unsupported(face, "empty")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    h, w = gray.shape[:2]
    aspect = w / max(h, 1)
    target = profile["width_mm"] / profile["height_mm"]
    if aspect < target * 0.55 or aspect > target * 1.8:
        return _unsupported(face, "aspect")

    quad = _detect_quad(gray)
    if quad is None:
        return _unsupported(face, "no_quad")

    canonical_w = int(profile["width_mm"] * profile["px_per_mm"])
    canonical_h = int(profile["height_mm"] * profile["px_per_mm"])
    dst = np.array(
        [
            [0, 0],
            [canonical_w - 1, 0],
            [canonical_w - 1, canonical_h - 1],
            [0, canonical_h - 1],
        ],
        dtype=np.float32,
    )
    H = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    rectified = cv2.warpPerspective(image, H, (canonical_w, canonical_h))

    borders, status, confidence, lines = _inner_borders(rectified, face, profile)
    lr = lr_ratio(borders)
    tb = tb_ratio(borders)
    return {
        "face": face,
        "status": status,
        "bordersMm": borders,
        "lrRatio": lr,
        "tbRatio": tb,
        "uncertaintyPp": {
            "lr": 0.35 if status == "OK" else 1.0,
            "tb": 0.35 if status == "OK" else 1.0,
        },
        "confidence": confidence,
        "printSkewDeg": 0.0,
        "framesUsed": 1,
        "captureSource": "UPLOAD",
        "manualAdjusted": False,
        "lines": lines,
        "quality": {"width": w, "height": h},
        "algorithmVersion": "1.0.0",
    }


def _detect_quad(gray: np.ndarray) -> np.ndarray | None:
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 140)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        h, w = gray.shape[:2]
        return np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    img_area = gray.shape[0] * gray.shape[1]
    for cnt in contours[:12]:
        if cv2.contourArea(cnt) < img_area * 0.05:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            return _order_quad(approx.reshape(4, 2).astype(np.float32))
        hull = cv2.convexHull(cnt)
        approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
        if len(approx) == 4:
            return _order_quad(approx.reshape(4, 2).astype(np.float32))

    # Largest contour bounding rect as coarse quad
    x, y, bw, bh = cv2.boundingRect(contours[0])
    return np.array(
        [[x, y], [x + bw - 1, y], [x + bw - 1, y + bh - 1], [x, y + bh - 1]],
        dtype=np.float32,
    )


def _order_quad(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def _border_width_px(gray: np.ndarray, side: str, skip: float, stations: int) -> float | None:
    h, w = gray.shape[:2]
    widths: list[float] = []
    if side in ("L", "R"):
        y0 = int(h * skip)
        y1 = int(h * (1 - skip))
        for y in np.linspace(y0, y1, stations):
            yi = int(y)
            row = gray[yi, :].astype(np.float32)
            if side == "R":
                row = row[::-1]
            # Strong first transition from border band
            edge = int(min(w // 2, max(8, w // 3)))
            segment = row[:edge]
            grad = np.abs(np.gradient(segment))
            if grad.max() < 4:
                continue
            peak = int(np.argmax(grad))
            widths.append(float(subpixel_peak(grad, peak)))
    else:
        x0 = int(w * skip)
        x1 = int(w * (1 - skip))
        for x in np.linspace(x0, x1, stations):
            xi = int(x)
            col = gray[:, xi].astype(np.float32)
            if side == "B":
                col = col[::-1]
            edge = int(min(h // 2, max(8, h // 3)))
            segment = col[:edge]
            grad = np.abs(np.gradient(segment))
            if grad.max() < 4:
                continue
            peak = int(np.argmax(grad))
            widths.append(float(subpixel_peak(grad, peak)))

    if len(widths) < max(8, stations // 4):
        return None
    return float(np.median(widths))


def _inner_borders(
    rectified: np.ndarray, face: Face, profile: dict
) -> tuple[dict, Status, float, dict]:
    gray = cv2.cvtColor(rectified, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    px = float(profile["px_per_mm"])
    stations = int(profile["stations"])
    skip = float(profile["corner_skip"])

    measured = {
        "L": _border_width_px(gray, "L", skip, stations),
        "R": _border_width_px(gray, "R", skip, stations),
        "T": _border_width_px(gray, "T", skip, stations),
        "B": _border_width_px(gray, "B", skip, stations),
    }

    if any(v is None for v in measured.values()):
        borders = {"L": 0.0, "R": 0.0, "T": 0.0, "B": 0.0}
        status: Status = "UNSUPPORTED"
        confidence = 0.15
    else:
        borders = {k: float(v) / px for k, v in measured.items()}  # type: ignore[misc]
        if min(borders.values()) < 0.15:
            status = "UNSUPPORTED"
            confidence = 0.2
        elif max(borders.values()) > 10:
            status = "LOW_CONFIDENCE"
            confidence = 0.45
        else:
            status = "OK"
            confidence = 0.88

    lines = {
        "outer": {
            "L": {"x1": 0, "y1": 0, "x2": 0, "y2": h},
            "R": {"x1": w, "y1": 0, "x2": w, "y2": h},
            "T": {"x1": 0, "y1": 0, "x2": w, "y2": 0},
            "B": {"x1": 0, "y1": h, "x2": w, "y2": h},
        },
        "inner": {
            "L": {
                "x1": borders["L"] * px,
                "y1": 0,
                "x2": borders["L"] * px,
                "y2": h,
            },
            "R": {
                "x1": w - borders["R"] * px,
                "y1": 0,
                "x2": w - borders["R"] * px,
                "y2": h,
            },
            "T": {
                "x1": 0,
                "y1": borders["T"] * px,
                "x2": w,
                "y2": borders["T"] * px,
            },
            "B": {
                "x1": 0,
                "y1": h - borders["B"] * px,
                "x2": w,
                "y2": h - borders["B"] * px,
            },
        },
    }
    return borders, status, confidence, lines


def _unsupported(face: Face, reason: str) -> dict[str, Any]:
    borders = {"L": 0.0, "R": 0.0, "T": 0.0, "B": 0.0}
    return {
        "face": face,
        "status": "UNSUPPORTED",
        "bordersMm": borders,
        "lrRatio": lr_ratio({"L": 1, "R": 1, "T": 1, "B": 1}),
        "tbRatio": tb_ratio({"L": 1, "R": 1, "T": 1, "B": 1}),
        "uncertaintyPp": {"lr": 2.0, "tb": 2.0},
        "confidence": 0.0,
        "printSkewDeg": 0.0,
        "framesUsed": 1,
        "captureSource": "UPLOAD",
        "manualAdjusted": False,
        "quality": {"reason": reason},
        "algorithmVersion": "1.0.0",
    }
