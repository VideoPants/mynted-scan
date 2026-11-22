# MyntedScan — Phase Plan

Product: **MyntedScan** (MYNTED card centering tool).
Repo folder: `mynted-scan/`.

## Milestone v1 — Centering (Phases 0–15 local; pause before 16)

| Phase | Summary |
|------|---------|
| 0 | Plan, git, gitignore |
| 1 | Scaffold, DB, i18n, brand chrome, setup |
| 2 | Measurement spec, graders, ratio math |
| 3 | Test-data acquisition and licences |
| 4 | Synthetic and augmented ground truth |
| 5 | Python reference pipeline + eval |
| 6 | TypeScript core + browser worker + parity |
| 7 | Upload flow and results UI |
| 8 | Manual line-adjust + `/dev/label` |
| 9 | Guided camera capture (PWA) |
| 10 | Auth, history, share links |
| 11 | English and Arabic, real RTL |
| 12 | CenteringReport + Setline INTEGRATION.md |
| 13 | Real-photo evaluation |
| 14 | Tests, CI, polish |
| 15 | README, METHOD, ACCURACY, DATASETS, DEMO |
| 16 | Deploy (paused until GitHub/Vercel/Neon approval) |

## Milestone v1.1 — Card identification (Phases 17–19)

Feature-flagged (`NEXT_PUBLIC_FEATURE_CARD_ID=false`). Start only after v1 local green.

## Locked product decisions

- Brand: MYNTED light UI (`#0071E3`, Roboto, logo + Scan subtitle)
- Camera-first; upload secondary
- Email/password auth in v1
- No analytics; minimal SEO indexing
- Stop before Phase 16 deploy without browser approvals
