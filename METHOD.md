# METHOD — MyntedScan centering pipeline

Algorithm version: `1.1.0` (bump when results would change).

## Definitions

- Canonical Pokémon card: **63 × 88 mm** (configurable per `CardProfile`).
- Border widths L, R, T, B (mm): median perpendicular distance from outer edge to inner frame, excluding corner zones (~12%).
- Axis ratio: `max(a,b) / (a+b) × 100`, shown as e.g. `53.2/46.8` with which side is wider.
- Worse axis on a face decides that face’s ceiling. Overall ceiling = lower of front and back.
- Compare thresholds **without rounding** (55.05 does not pass 55). Display one decimal.
- Borderline: if `ratio ± uncertainty` straddles a threshold, show both outcomes.

## Pipeline

1. **Coarse detection** — Canny / adaptive edges → largest convex quad → aspect check vs 63:88. Classical OpenCV by default (`CornerDetector` interface reserved for future ONNX).
2. **Refinement** — ≥60 intensity-gradient profiles per edge (skip ~12% near corners) → parabolic/Gaussian subpixel peak → RANSAC then LS inliers → intersect lines → homography to 1260×1760 (20 px/mm).
3. **Inner frame** — in rectified image, scan inward in Lab + gradient space; RANSAC fit; report median/min/max and print skew.
4. **Full-art / borderless** — if no consistent inner frame: `LOW_CONFIDENCE` or `UNSUPPORTED`, open manual mode, never guess.
5. **Capture quality** — live checks (found, fill, tilt, blur, glare, steady); burst 5–8 frames; median after outlier reject; uncertainty from bootstrap + frame spread + fit residuals.
6. **Where it runs** — browser classic Web Worker (+ optional OpenCV.js WASM). Python FastAPI service is the accuracy reference and eval harness. Optional `CENTERING_API_URL` fallback. TS and Python must agree within **0.2 pp** on synthetic ratios from shared math.

## Identification (v1.1 only)

Documented later when `NEXT_PUBLIC_FEATURE_CARD_ID=true`. Must not delay or alter centering.

## Figures

Generate illustrative overlays from `data/generated/synthetic/` samples after `npm run data:generate`.
