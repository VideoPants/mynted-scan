# ACCURACY — measured results only

Figures below are produced by this repo’s eval harness. Do not invent numbers.

## How to regenerate

```bash
npm run data:generate
npm run eval:synthetic
npm run parity
```

## Synthetic (exact ground truth)

Measured on 2026-11-22 via `eval.run --split test --set synthetic` (clean unwarped siblings when present):

| Metric | Value | Notes |
|--------|------:|-------|
| n | 10 | test split |
| evaluated | 9 | |
| reject rate | 0.10 | |
| MAE (pp) | **1.40** | Above aspiration (≤0.3); classical inner-edge localization on procedural yellow borders |
| p95 (pp) | **2.66** | Above aspiration (≤0.8) |

Aspiration (not claimed): MAE ≤ 0.3 pp, p95 ≤ 0.8 pp. Current limiter: residual edge localization bias on synthetic art/border contrast; further RANSAC/station tuning belongs on the held-out **dev** split only.

## Augmented official scans (exact relative GT)

Measured on 2026-11-22 after TCGdex fetch + programmatic shift (`n=4` sample):

| Metric | Value | Notes |
|--------|------:|-------|
| evaluated | 2 | |
| reject rate | 0.50 | High — official webps often lack a classical yellow-frame signal |
| MAE (pp) | **4.39** | Approximate on tiny sample; aspiration ≤ 0.5 not met |
| p95 (pp) | **5.62** | |

Limiter: classical inner-frame detection on modern full-art-leaning scans; expand sample and tune on **dev** only before retesting.

## Agent-labelled real photos (approximate)

| Metric | Value | Notes |
|--------|------:|-------|
| MAE (pp) | n/a | No permissive public real-photo set auto-selected |
| Label noise floor | n/a | Re-label 10% when labels exist |

## Parity (TypeScript ↔ Python)

Shared ratio math mismatches: **0** on synthetic border vectors (`npm run parity` pass).

## Card identification (v1.1)

Flag off (`NEXT_PUBLIC_FEATURE_CARD_ID=false`). No identification accuracy claimed.
