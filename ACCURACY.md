# ACCURACY — measured results only

Figures below are produced by this repo’s eval harness. Do not invent numbers.

## How to regenerate

```bash
npm run data:generate
npm run eval:synthetic
npm run parity
```

## Warped synthetic gate (centering-core fixtures)

Measured on 2026-11-23 via `node packages/centering-core/scripts/measure-png.mjs --table` (algorithm 1.2.0):

| case | expected LR | measured LR | expected TB | measured TB | status | dLR | dTB |
|------|-------------|-------------|-------------|-------------|--------|-----|-----|
| c50 | 50/50 | 50.0/50.0 | 50/50 | 50.0/50.0 | OK | 0.0 | 0.0 |
| c55 | 55/45 | 55.1/44.9 | 45/55 | 44.9/55.1 | OK | 0.1 | -0.1 |
| c60 | 60/40 | 60.2/39.8 | 40/60 | 39.8/60.2 | OK | 0.2 | -0.2 |
| c65 | 65/35 | 65.3/34.7 | 35/65 | 34.7/65.3 | OK | 0.3 | -0.3 |
| c70 | 70/30 | 70.4/29.6 | 30/70 | 29.7/70.3 | OK | 0.4 | -0.3 |
| c40_55 | 40/60 | 39.8/60.2 | 55/45 | 55.1/44.9 | OK | -0.2 | 0.1 |
| c45_65 | 45/55 | 44.9/55.1 | 65/35 | 65.2/34.8 | OK | -0.1 | 0.2 |
| prev-60-40 | 60/40 | 60.2/39.8 | 50/50 | 50.0/50.0 | OK | 0.2 | 0.0 |

All within ±1 pp locally. Live ±1.5 pp table pending production deploy after CI green.

## Synthetic (exact ground truth) — prior harness

Measured on 2026-11-22 via `eval.run --split test --set synthetic` (clean unwarped siblings when present):

| Metric | Value | Notes |
|--------|------:|-------|
| n | 10 | test split |
| evaluated | 9 | |
| reject rate | 0.10 | |
| MAE (pp) | **1.40** | Pre-1.2.0 detector; superseded by warped gate above for release criteria |
| p95 (pp) | **2.66** | Pre-1.2.0 |

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
