# Progress

## Status
- Phases 0–5 complete and merged to `master` (`3d12c82`).
- Production live at https://mynted-scan.vercel.app — `/api/health` SHA matches HEAD; live accuracy 9/9 ±1.5 pp.

## Decisions
- Algorithm 1.2.0 with first-edge + contour quad; CI jobs `build-test` + `accuracy` required on `master`.
- Vercel project Node set to `26.x` (fixes failed deploy on discontinued 20.x).
- Live Playwright uses `BASE_URL` and skips local webServer.

## Open issues
- None blocking release. Optional: add a Vercel Deployment Check webhook mirroring GitHub `accuracy` if you want alias promotion gated outside GitHub merges.

## Next steps
1. Monitor production for real-card feedback.
2. Expand real-photo eval sample when labels exist.
3. Consider caching TCGdex set names in Redis/KV if search volume grows.

## Key files
- `packages/centering-core/src/image-pipeline.ts`
- `ACCURACY.md`
- `.github/workflows/ci.yml`
- `apps/web/src/app/api/health/route.ts`
