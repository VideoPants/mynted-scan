# Progress

## Status
- Phase: Fix Prompt 3 on `fix/prompt-3` — Phases 1–6 implemented; shipping next.
- Done: ManualAdjust lines + ±, LocaleSwitcher, slab SLAB reason, residual floor 0.5 + coverage Vitest, offline SW locale fallback, AR sides/product, set-name map, upload label.

## Decisions
- Feature branch only until Vitest/Playwright/`accuracy` green.
- Manual ± from 0.1 mm nudge via shared `residualFromBorders` (floor 0.5 pp).
- Slab: largest slab-like outer → nested card or `UNSUPPORTED`/`SLAB`; failed nested measure remaps to SLAB.
- Slab fixtures scaled to fit canvas; no committed card art.

## Open issues
- Branch protection “do not allow bypassing” + Vercel deploy-wait-for-checks need admin UI.
- Phase 7: CI green → merge → live Playwright → ACCURACY.md.

## Next steps
1. Typecheck + web e2e locally / push PR.
2. Merge when CI green; confirm `/api/health` SHA.
3. Live Playwright (accuracy, manual, locale, offline, slab).
4. Admin: GitHub bypass off + Vercel check gate.
5. Update ACCURACY.md + PROGRESS.md post-deploy.

## Key files
- `apps/web/src/components/ManualAdjust.tsx`
- `apps/web/src/components/LocaleSwitcher.tsx`
- `packages/centering-core/src/image-pipeline.ts`
- `packages/centering-core/src/measure.ts`
- `services/measure-py/app/measure.py`
