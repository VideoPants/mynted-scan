# Deploy (Phase 16) — paused

Local v1 is complete. Do **not** claim a production URL until the steps below succeed.

## Approvals needed (browser)

1. **GitHub**
   ```bash
   gh auth status || gh auth login --web
   ```
   Then create/push the public repo from `mynted-scan/`.

2. **Vercel**
   ```bash
   npx vercel whoami || npx vercel login
   npx vercel link
   ```

3. **Neon (via Vercel Marketplace or neonctl)**
   ```bash
   npx vercel integration add neon --help
   # or
   npx neonctl auth
   ```
   Map pooled → `DATABASE_URL`, unpooled → `DIRECT_URL`.

4. Deploy
   ```bash
   npx prisma migrate deploy
   npx vercel env add NEXT_PUBLIC_FEATURE_CARD_ID production   # false
   npx vercel --prod
   ```

## Until then

```bash
cd mynted-scan
npm run setup   # or: node scripts/db-up.mjs && npm run db:migrate && npm run db:seed
npm run dev
```
