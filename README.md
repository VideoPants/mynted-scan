# MyntedScan

**MyntedScan** measures Pokémon card **centering** on your device. It reports left/right and top/bottom ratios with an uncertainty band, plus the best grade **centering alone** allows at PSA, CGC, BGS, and TAG. It is not a full grade (corners, edges, and surface are out of scope).

This is a MYNTED product for [mynted.me](https://mynted.me/). It is not affiliated with PSA, CGC, Beckett, TAG, or The Pokémon Company.

## Accuracy

Measured numbers live in [ACCURACY.md](./ACCURACY.md). Do not cite accuracy figures that are not measured in this repo.

## One-command setup

```bash
cd mynted-scan
cp .env.example .env   # if needed; setup also creates .env
npm run setup
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/en`.

Demo user after seed: `demo@mynted.me` / `demo-password-change-me`

## What the app does

1. Guided rear-camera capture (camera-first) or upload
2. On-device measurement (Web Worker; OpenCV.js when present)
3. Manual line adjust when confidence is low or the card is full-art / borderless
4. Manual card search (TCGdex / Pokémon TCG API)
5. Save history (signed in), share link, embeddable report
6. English + Arabic with real RTL (card image not mirrored)

Card auto-identification is **v1.1**, behind `NEXT_PUBLIC_FEATURE_CARD_ID=false`.

## Privacy

Photos are processed on your device. They leave the device only if you save or share (thumbnails only).

## Environment

See `.env.example`. Required for local app: `DATABASE_URL`, `AUTH_SECRET`.

## Arabic

Use the `AR` / `EN` control in the header, or open `/ar`. Western digits are used for measurements in both locales.

## Evals

```bash
npm run data:generate
npm run eval:synthetic
npm run parity
npm run py:test
```

## Optional: add your own photos

1. Lay the card flat on a dark, plain, non-shiny surface (black t-shirt or mousepad). Out of sleeve/toploader.
2. Hold the phone parallel, directly above the card.
3. Bright even light; flash off; avoid glare.
4. Fill most of the frame with a little margin; wait for checks to turn green.
5. Front, then back.
6. Drop files in `data/real/mine/` or open `/en/dev/label` (dev only).

## Case study (centering-first)

MyntedScan localizes outer and inner borders to subpixel precision, fits edges with RANSAC, and reports ratios with uncertainty instead of pretending to issue a grade. Full RTL Arabic is a core feature. Identification is a flagged v1.1 add-on and must never degrade centering.

## Licence note for models / deps

Prefer MIT / Apache-2.0 / BSD. No AGPL or GPL dependencies. Pokémon card images are not committed; artwork belongs to The Pokémon Company.

## Deploy (paused)

Do not claim a production URL until these browser approvals succeed:

```bash
gh auth status || gh auth login --web
npx vercel whoami || npx vercel login
npx vercel link
# Neon: npx vercel integration add neon --help   or   npx neonctl auth
# Map pooled → DATABASE_URL, unpooled → DIRECT_URL
npx prisma migrate deploy
npx vercel env add NEXT_PUBLIC_FEATURE_CARD_ID production   # false
npx vercel --prod
```

Until then: `npm run setup && npm run dev`

## Docs in this repo

| File | Purpose |
|------|---------|
| [METHOD.md](./METHOD.md) | Centering algorithm |
| [ACCURACY.md](./ACCURACY.md) | Measured eval numbers only |
| [DATASETS.md](./DATASETS.md) | Image sources and licences |
| [DEMO.md](./DEMO.md) | Recording / checklist script |
| [INTEGRATION.md](./INTEGRATION.md) | Setline attach contract (no Setline edits) |
