from __future__ import annotations

import numpy as np


def subpixel_peak(samples: np.ndarray, peak_index: int) -> float:
    if peak_index <= 0 or peak_index >= len(samples) - 1:
        return float(peak_index)
    y0, y1, y2 = samples[peak_index - 1 : peak_index + 2]
    denom = 2 * (2 * y1 - y0 - y2)
    if abs(denom) < 1e-9:
        return float(peak_index)
    return float(peak_index + (y0 - y2) / denom)


def ransac_line(points: np.ndarray, iterations: int = 80, threshold: float = 1.5, seed: int = 42):
    """points: Nx2 array. Returns (a,b,c) for ax+by+c=0 and inlier mask."""
    if len(points) < 2:
        return np.array([0.0, 1.0, 0.0]), np.zeros(len(points), dtype=bool)

    rng = np.random.default_rng(seed)
    best_count = -1
    best_line = np.array([0.0, 1.0, 0.0])
    best_mask = np.zeros(len(points), dtype=bool)

    for _ in range(iterations):
        i1, i2 = rng.choice(len(points), size=2, replace=False)
        p1, p2 = points[i1], points[i2]
        a = p1[1] - p2[1]
        b = p2[0] - p1[0]
        c = p1[0] * p2[1] - p2[0] * p1[1]
        norm = np.hypot(a, b) or 1.0
        dist = np.abs(a * points[:, 0] + b * points[:, 1] + c) / norm
        mask = dist <= threshold
        count = int(mask.sum())
        if count > best_count:
            best_count = count
            best_line = np.array([a, b, c])
            best_mask = mask

    inliers = points[best_mask]
    if len(inliers) >= 2:
        best_line = _least_squares(inliers)
    return best_line, best_mask


def _least_squares(points: np.ndarray) -> np.ndarray:
    x = points[:, 0]
    y = points[:, 1]
    var_x = np.var(x)
    var_y = np.var(y)
    if var_x >= var_y:
        slope, intercept = np.polyfit(x, y, 1)
        return np.array([slope, -1.0, intercept])
    slope, intercept = np.polyfit(y, x, 1)
    return np.array([1.0, -slope, -intercept])