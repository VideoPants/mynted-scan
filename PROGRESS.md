# Progress

## Status
- Phases 0–5 implemented on `fix/accuracy-inner-frame`. **No production deploy.**
- Local accuracy: 8/8 synthetic within ±1 pp / ±0.1 mm (see ACCURACY.md table).
- Build, typecheck, Vitest, Python parity pass. Web build includes `/api/health` + offline page.

## Decisions
- Algorithm 1.2.0: first strong edge (0.75–8 mm), contour quad over sparse AABB, fixed TR/BL order.
- `engines.node` = `26.x` (failed Vercel `dpl_67ieZvxyhRFFm6oVp4zdCgb7E6az` was Node 20 discontinued).
- Rectified preview: `quality.rectifiedDataUrl` in sessionStorage; Adjust lines / results overlay use it.

## Open issues
- Ask Syed: mark CI job `accuracy` required on `master`; set Vercel project Node to 26.x; gate prod on CI.
- Live accuracy.spec.ts vs https://mynted-scan.vercel.app not run (blocked until green prod).
- Vercel project Node version must be 26.x in dashboard (engines alone may not be enough).

## Next steps
1. Push PR for `fix/accuracy-inner-frame`.
2. Confirm both `build-test` and `accuracy` CI green.
3. Set Vercel Node 26.x; mark accuracy required; then prod deploy.
4. Verify `/api/health` SHA = HEAD; run live accuracy; update ACCURACY.md.

## Key files
- `packages/centering-core/src/image-pipeline.ts`
- `packages/centering-core/test/fixtures/gen-synthetic.mjs`
- `apps/web/src/components/ManualAdjust.tsx` / `ResultsView.tsx`
- `.github/workflows/ci.yml`
- `apps/web/src/app/api/health/route.ts`
