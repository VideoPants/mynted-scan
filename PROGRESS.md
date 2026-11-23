# Progress

## Status
- Phase: Fix Prompt 3 on `fix/prompt-3` — PR #3 open; accuracy green; build-test re-running after e2e server fix.
- Done: Phases 1–6 code + commits; Vitest/typecheck/Python green locally; locale e2e green.

## Decisions
- No master merge until `build-test` + `accuracy` green.
- Residual floor 0.5 pp; slab → nested or `SLAB`; ManualAdjust rebuilds lines.
- CI Playwright stays on `next dev`; full SW offline gated by `E2E_PROD=1`.
- Admin UI still needed for branch-protection bypass + Vercel check wait.

## Open issues
- Waiting on CI `build-test` after 75285ea.
- Live deploy + ACCURACY.md after merge.

## Next steps
1. Confirm CI green on PR #3.
2. Merge → deploy → `/api/health` SHA = HEAD.
3. Live Playwright (accuracy, manual, locale).
4. Record ACCURACY.md + finalize PROGRESS.md.
5. Admin: disable branch-protection bypass; Vercel waits for checks.

## Key files
- `apps/web/src/components/ManualAdjust.tsx`
- `apps/web/src/components/LocaleSwitcher.tsx`
- `packages/centering-core/src/image-pipeline.ts`
- `packages/centering-core/src/measure.ts`
- PR: https://github.com/VideoPants/mynted-scan/pull/3
