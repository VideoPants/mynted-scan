# INTEGRATION — Setline attach point

Do **not** patch the Setline repo from this project. Apply these changes in Setline when ready.

## CenteringReport v1

- Zod schema + types: `@mynted/centering-core` (`CenteringReportSchema`)
- JSON: `GET /api/reports/:slug`
- Embed: `GET /embed/report/:slug` (iframe-safe)
- Attach: `POST /api/scans/:id/attach` body `{ "target": "setline", "externalListingId": "..." }` (auth + ownership)

## Suggested Setline changes

1. Add `centeringReportSlug` (nullable string) on `Listing`.
2. Prefill listing card picker from report `card.setId` / `card.number` / `card.name`.
3. Map catalogue ids: TCGdex ids look like `{set}-{localId}`; Pokémon TCG API ids may differ — maintain a small mapping table or resolve by set+number.
4. Render the embed iframe on the listing page when `centeringReportSlug` is set.

## Auth / CORS

Share and embed are public read-only. Attach requires the scan owner’s session.
