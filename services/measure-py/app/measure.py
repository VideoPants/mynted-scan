from __future__ import annotations

import math
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

BORDER_MIN_MM = 1.0
BORDER_MAX_MM = 6.0
OK_MAX_RESIDUAL_PP = 1.5
ALGORITHM_VERSION = "1.2.0"


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

    detected = _detect_quad(gray)
    if detected is None:
        return _unsupported(face, "no_quad")
    if isinstance(detected, dict) and detected.get("reason") == "SLAB":
        return _unsupported(face, "SLAB")
    from_slab = False
    if isinstance(detected, dict):
        from_slab = bool(detected.get("from_slab"))
        quad = detected["quad"]
    else:
        quad = detected

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

    borders, status, confidence, lines, residual_lr, residual_tb, reason = _inner_borders(
        rectified, face, profile
    )
    if from_slab and status == "UNSUPPORTED":
        return _unsupported(face, "SLAB")
    lr = lr_ratio(borders)
    tb = tb_ratio(borders)
    quality: dict[str, Any] = {"width": w, "height": h}
    if reason:
        quality["reason"] = reason
    return {
        "face": face,
        "status": status,
        "bordersMm": borders,
        "lrRatio": lr,
        "tbRatio": tb,
        "uncertaintyPp": {
            "lr": residual_lr,
            "tb": residual_tb,
        },
        "confidence": confidence,
        "printSkewDeg": 0.0,
        "framesUsed": 1,
        "captureSource": "UPLOAD",
        "manualAdjusted": False,
        "lines": lines,
        "quality": quality,
        "algorithmVersion": ALGORITHM_VERSION,
    }


def _shrink_quad(pts: np.ndarray, px: float = 1.0) -> np.ndarray:
    cx = float(pts[:, 0].mean())
    cy = float(pts[:, 1].mean())
    out = pts.astype(np.float32).copy()
    for i in range(4):
        dx = cx - out[i, 0]
        dy = cy - out[i, 1]
        length = float(np.hypot(dx, dy)) or 1.0
        out[i, 0] += (dx / length) * px
        out[i, 1] += (dy / length) * px
    return out


SLAB_ASPECT = 80 / 133
CARD_ASPECT_FAR = 0.12


def _portrait_aspect(qw: float, qh: float) -> float:
    a = qw / max(qh, 1)
    return a if a <= 1 else 1 / a


def _aspect_score(qw: float, qh: float, target: float) -> float:
    if qw < 8 or qh < 8:
        return float("inf")
    return abs(math.log(_portrait_aspect(qw, qh) / target))


def _looks_like_slab(qw: float, qh: float, target: float) -> bool:
    card_score = _aspect_score(qw, qh, target)
    slab_score = _aspect_score(qw, qh, SLAB_ASPECT)
    return card_score > CARD_ASPECT_FAR and slab_score < card_score


def _has_label_band(gray: np.ndarray, pts: np.ndarray) -> bool:
    min_x = int(max(0, pts[:, 0].min()))
    max_x = int(min(gray.shape[1] - 1, pts[:, 0].max()))
    min_y = int(max(0, pts[:, 1].min()))
    max_y = int(min(gray.shape[0] - 1, pts[:, 1].max()))
    band_h = max(4, int((max_y - min_y) * 0.12))
    top = gray[min_y : min_y + band_h, min_x : max_x + 1]
    if top.size < 10:
        return False
    top_mean = float(top.mean())
    below_y0 = min_y + band_h + 4
    below_y1 = min(max_y, below_y0 + band_h)
    below = gray[below_y0:below_y1, min_x : max_x + 1]
    if below.size < 10:
        return False
    return top_mean > 140 and top_mean - float(below.mean()) > 25


def _find_nested_card(
    cands: list[tuple[float, np.ndarray, float, float, float]],
    outer: np.ndarray,
    target: float,
) -> np.ndarray | None:
    outer_area = float(
        np.hypot(outer[1, 0] - outer[0, 0], outer[1, 1] - outer[0, 1])
        * np.hypot(outer[3, 0] - outer[0, 0], outer[3, 1] - outer[0, 1])
    )
    min_x, max_x = float(outer[:, 0].min()), float(outer[:, 0].max())
    min_y, max_y = float(outer[:, 1].min()), float(outer[:, 1].max())
    best: np.ndarray | None = None
    best_score = float("inf")
    for _score, pts, area, qw, qh in cands:
        if area < outer_area * 0.2 or area > outer_area * 0.85:
            continue
        cx, cy = float(pts[:, 0].mean()), float(pts[:, 1].mean())
        if not (min_x <= cx <= max_x and min_y <= cy <= max_y):
            continue
        a_score = _aspect_score(qw, qh, target)
        if a_score > 0.25:
            continue
        if a_score < best_score:
            best_score = a_score
            best = pts
    return _shrink_quad(best) if best is not None else None


def _detect_quad(gray: np.ndarray) -> np.ndarray | dict[str, Any] | None:
    """Return card quad, {reason: SLAB}, {quad, from_slab}, or None."""
    h, w = gray.shape[:2]
    img_area = h * w
    target = 63 / 88
    fill = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)

    # Bright-region bbox — only used when fill is high (little perspective).
    bright_bbox: np.ndarray | None = None
    ys, xs = np.where(gray > 50)
    if xs.size > 100:
        min_x, max_x = int(xs.min()), int(xs.max())
        min_y, max_y = int(ys.min()), int(ys.max())
        bw, bh = max_x - min_x + 1, max_y - min_y + 1
        bright_frac = xs.size / img_area
        if bright_frac > 0.08:
            if bw * bh > img_area * 0.9 or (
                min_x <= 2 and min_y <= 2 and max_x >= w - 3 and max_y >= h - 3
            ):
                return fill
            fill_in_bbox = (xs.size) / max(bw * bh, 1)
            if fill_in_bbox > 0.85:
                bright_bbox = _shrink_quad(
                    np.array(
                        [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]],
                        dtype=np.float32,
                    )
                )

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 140)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return bright_bbox if bright_bbox is not None else fill

    cands: list[tuple[float, np.ndarray, float, float, float]] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * 0.04 or area > img_area * 0.98:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        pts = None
        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = _order_quad(approx.reshape(4, 2).astype(np.float32))
        else:
            hull = cv2.convexHull(cnt)
            approx2 = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
            if len(approx2) == 4:
                pts = _order_quad(approx2.reshape(4, 2).astype(np.float32))
        if pts is None:
            continue
        qw = float(np.hypot(pts[1, 0] - pts[0, 0], pts[1, 1] - pts[0, 1]))
        qh = float(np.hypot(pts[3, 0] - pts[0, 0], pts[3, 1] - pts[0, 1]))
        q_area = qw * qh
        score = _aspect_score(qw, qh, target) - q_area / img_area
        cands.append((score, pts, q_area, qw, qh))

    cands.sort(key=lambda c: c[0])
    if cands:
        by_area = sorted(cands, key=lambda c: c[2], reverse=True)
        _ls, largest, _la, lqw, lqh = by_area[0]
        largest_slabish = _looks_like_slab(lqw, lqh, target) or _has_label_band(gray, largest)
        if largest_slabish:
            nested = _find_nested_card(cands, largest, target)
            if nested is not None:
                return {"quad": nested, "from_slab": True}
            return {"reason": "SLAB"}
        _score, best, _area, qw, qh = cands[0]
        best_slabish = _looks_like_slab(qw, qh, target) or _has_label_band(gray, best)
        if best_slabish:
            nested = _find_nested_card(cands, best, target)
            if nested is not None:
                return {"quad": nested, "from_slab": True}
            return {"reason": "SLAB"}
        return _shrink_quad(best)

    if bright_bbox is not None:
        bqw = float(np.hypot(bright_bbox[1, 0] - bright_bbox[0, 0], bright_bbox[1, 1] - bright_bbox[0, 1]))
        bqh = float(np.hypot(bright_bbox[3, 0] - bright_bbox[0, 0], bright_bbox[3, 1] - bright_bbox[0, 1]))
        if _looks_like_slab(bqw, bqh, target) or _has_label_band(gray, bright_bbox):
            nested = _find_nested_card(cands, bright_bbox, target)
            if nested is not None:
                return {"quad": nested, "from_slab": True}
            return {"reason": "SLAB"}
        if _aspect_score(bqw, bqh, target) < 0.35:
            return bright_bbox

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    x, y, bw, bh = cv2.boundingRect(contours[0])
    if bw * bh > img_area * 0.9:
        return fill
    return _shrink_quad(
        np.array([[x, y], [x + bw - 1, y], [x + bw - 1, y + bh - 1], [x, y + bh - 1]], dtype=np.float32)
    )


def _order_quad(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    # tr has large x-y; bl has small x-y
    tr = pts[np.argmax(diff)]
    bl = pts[np.argmin(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def _abs_gradient(samples: np.ndarray) -> np.ndarray:
    g = np.zeros_like(samples, dtype=np.float32)
    if len(samples) < 2:
        return g
    g[0] = abs(float(samples[1] - samples[0]))
    g[-1] = abs(float(samples[-1] - samples[-2]))
    for i in range(1, len(samples) - 1):
        g[i] = abs(float(samples[i + 1] - samples[i - 1]) / 2)
    return g


def _first_strong_edge(segment: np.ndarray) -> float | None:
    grad = _abs_gradient(segment.astype(np.float32))
    max_g = float(grad.max()) if len(grad) else 0.0
    if max_g < 4:
        return None
    threshold = max(4.0, 0.4 * max_g)
    for i in range(1, len(grad) - 1):
        g = float(grad[i])
        if g < threshold:
            continue
        if g >= float(grad[i - 1]) and g >= float(grad[i + 1]):
            return float(subpixel_peak(grad, i))
    for i in range(len(grad)):
        if float(grad[i]) >= threshold:
            return float(subpixel_peak(grad, i))
    return None


def _percentile(sorted_vals: list[float], p: float) -> float:
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    idx = (len(sorted_vals) - 1) * p
    lo = int(np.floor(idx))
    hi = int(np.ceil(idx))
    if lo == hi:
        return sorted_vals[lo]
    t = idx - lo
    return sorted_vals[lo] * (1 - t) + sorted_vals[hi] * t


def _robust_median_iqr(values: list[float]) -> tuple[float, float, int] | None:
    if not values:
        return None
    sorted_vals = sorted(values)
    q1 = _percentile(sorted_vals, 0.25)
    q3 = _percentile(sorted_vals, 0.75)
    iqr0 = max(0.0, q3 - q1)
    med0 = _percentile(sorted_vals, 0.5)
    lo = med0 - 1.5 * iqr0
    hi = med0 + 1.5 * iqr0
    kept = [v for v in sorted_vals if lo <= v <= hi]
    use = kept if len(kept) >= max(4, len(sorted_vals) // 3) else sorted_vals
    return (
        _percentile(use, 0.5),
        max(0.0, _percentile(use, 0.75) - _percentile(use, 0.25)),
        len(use),
    )


def _border_width_px(
    gray: np.ndarray, side: str, skip: float, stations: int, px_per_mm: float
) -> tuple[float, float, int] | None:
    h, w = gray.shape[:2]
    offset_px = max(10, int(round(0.75 * px_per_mm)))
    search_px = int(round(8 * px_per_mm))
    widths: list[float] = []

    if side in ("L", "R"):
        y0 = int(h * skip)
        y1 = int(h * (1 - skip))
        for y in np.linspace(y0, y1, stations):
            yi = int(y)
            row = gray[yi, :].astype(np.float32)
            if side == "R":
                row = row[::-1]
            max_i = min(w // 2, offset_px + search_px)
            segment = row[offset_px:max_i]
            if len(segment) < 4:
                continue
            peak = _first_strong_edge(segment)
            if peak is None:
                continue
            widths.append(offset_px + peak)
    else:
        x0 = int(w * skip)
        x1 = int(w * (1 - skip))
        for x in np.linspace(x0, x1, stations):
            xi = int(x)
            col = gray[:, xi].astype(np.float32)
            if side == "B":
                col = col[::-1]
            max_i = min(h // 2, offset_px + search_px)
            segment = col[offset_px:max_i]
            if len(segment) < 4:
                continue
            peak = _first_strong_edge(segment)
            if peak is None:
                continue
            widths.append(offset_px + peak)

    if len(widths) < max(8, stations // 4):
        return None
    return _robust_median_iqr(widths)


def _residual_from_borders(a: float, b: float, ua: float, ub: float) -> float:
    s = a + b
    if s <= 1e-6:
        return 2.0
    pp = (100.0 / (s * s)) * float(np.hypot(b * ua, a * ub))
    return float(min(5.0, max(0.5, pp)))


def _confidence_from_spread(residual_lr: float, residual_tb: float) -> float:
    worst = max(residual_lr, residual_tb)
    if worst > OK_MAX_RESIDUAL_PP:
        return max(0.25, 0.7 - (worst - OK_MAX_RESIDUAL_PP) * 0.15)
    return max(0.55, min(0.95, 0.95 - worst * 0.2))


def _inner_borders(
    rectified: np.ndarray, face: Face, profile: dict
) -> tuple[dict, Status, float, dict, float, float, str | None]:
    gray = cv2.cvtColor(rectified, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    px = float(profile["px_per_mm"])
    stations = int(profile["stations"])
    skip = float(profile["corner_skip"])

    measured = {
        "L": _border_width_px(gray, "L", skip, stations, px),
        "R": _border_width_px(gray, "R", skip, stations, px),
        "T": _border_width_px(gray, "T", skip, stations, px),
        "B": _border_width_px(gray, "B", skip, stations, px),
    }

    reason: str | None = None
    if any(v is None for v in measured.values()):
        borders = {"L": 0.0, "R": 0.0, "T": 0.0, "B": 0.0}
        status: Status = "UNSUPPORTED"
        confidence = 0.15
        residual_lr = 2.0
        residual_tb = 2.0
        reason = "NO_INNER_EDGE"
    else:
        borders = {k: float(v[0]) / px for k, v in measured.items()}  # type: ignore[index]

        def side_unc_mm(v: tuple[float, float, int]) -> float:
            return float(v[1]) / 1.349 / math.sqrt(max(8, v[2])) / px

        u = {k: side_unc_mm(v) for k, v in measured.items()}  # type: ignore[arg-type]
        residual_lr = _residual_from_borders(borders["L"], borders["R"], u["L"], u["R"])
        residual_tb = _residual_from_borders(borders["T"], borders["B"], u["T"], u["B"])
        vals = list(borders.values())
        if any(v < BORDER_MIN_MM or v > BORDER_MAX_MM for v in vals):
            status = "UNSUPPORTED"
            reason = "BORDER_OUT_OF_RANGE"
            confidence = 0.2
        elif max(residual_lr, residual_tb) > OK_MAX_RESIDUAL_PP:
            status = "LOW_CONFIDENCE"
            confidence = _confidence_from_spread(residual_lr, residual_tb)
        else:
            status = "OK"
            confidence = _confidence_from_spread(residual_lr, residual_tb)

    lines = {
        "outer": {
            "L": {"x1": 0, "y1": 0, "x2": 0, "y2": h},
            "R": {"x1": w, "y1": 0, "x2": w, "y2": h},
            "T": {"x1": 0, "y1": 0, "x2": w, "y2": 0},
            "B": {"x1": 0, "y1": h, "x2": w, "y2": h},
        },
        "inner": {
            "L": {"x1": borders["L"] * px, "y1": 0, "x2": borders["L"] * px, "y2": h},
            "R": {"x1": w - borders["R"] * px, "y1": 0, "x2": w - borders["R"] * px, "y2": h},
            "T": {"x1": 0, "y1": borders["T"] * px, "x2": w, "y2": borders["T"] * px},
            "B": {"x1": 0, "y1": h - borders["B"] * px, "x2": w, "y2": h - borders["B"] * px},
        },
    }
    return borders, status, confidence, lines, residual_lr, residual_tb, reason


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
        "algorithmVersion": ALGORITHM_VERSION,
    }
