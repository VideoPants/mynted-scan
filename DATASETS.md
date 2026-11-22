# DATASETS

Images are **not** committed. Only scripts, manifests, licences, and label JSON are.

## Sources

Recorded at runtime in `data/sources.json` by `npm run data:fetch`.

| Source | Licence | Use |
|--------|---------|-----|
| TCGdex API + assets | DB MIT; artwork © TPC / often described CC BY-NC | Reference / local eval only; verify before commercial use; do not redistribute |
| Pokémon TCG API | API ToS; artwork © TPC | Same as above; deprecated keys through 2027-03-01 |
| Synthetic generator | Original procedural art (no Pokémon IP) | Train/dev/test with exact GT |
| Hugging Face / Kaggle / Roboflow real photos | Per-dataset; skip if missing/restrictive | Approximate GT via agent labels |

## Layout

- `data/raw/official/` — downloaded official scans (gitignored)
- `data/generated/synthetic/` — seeded synthetics + JSON GT
- `data/generated/augmented/` — re-crop/shift GT
- `data/real/` — real photos
- `data/labels/real.json` — agent labels

## Policy

Do not scrape mynted.me, grading company sites, competitor apps, or Google Images for training data.
