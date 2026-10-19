# Deploying to Vercel (no local terminal)

You can create the database on **Neon**, deploy on **Vercel**, and **seed from the browser** at `/setup`.

## Step A — Neon (your current screen)

1. **Project name:** `BNSS Trust Admin Portal` (or any name) is fine.
2. **Region:** For India, prefer **AWS Asia Pacific (Mumbai)** if listed; **US East** is OK for testing.
3. Leave **Postgres** enabled; you can leave **Object storage** off (the app uses S3/R2 via env vars later).
4. Click **Create project**.

After creation:

1. Open **Dashboard → Connection details**.
2. Copy two URLs (Neon shows **Pooled** and **Direct**):
   - **Pooled** → will become `DATABASE_URL` on Vercel (runtime + build).
   - **Direct** → will become `DIRECT_URL` on Vercel (Prisma schema push).

Append `?sslmode=require` if not already in the string.

## Step B — Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.
2. Import GitHub repo **`sridushiva-dev/bnssevatrust`**, branch **`main`**.
3. Before deploying, open **Environment Variables** and add:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `SETUP_SECRET` | A long random password you invent (e.g. 32+ characters) — you will type this once on `/setup` |
| `STORAGE_DRIVER` | `local` for first UI test only; use `s3` before real uploads (see below) |

Optional later: Razorpay keys, `TALLY_COMPANY_NAME`, S3 variables.

4. Click **Deploy**.

Vercel runs **`vercel-build`** (`prisma db push` then `next build`), which creates tables in Neon. No seed runs at build time.

## Step C — Seed in the browser (no terminal)

1. Open: `https://YOUR-PROJECT.vercel.app/setup`
2. Paste the same **`SETUP_SECRET`** you set in Vercel.
3. Click **Initialize database (seed)**.
4. When it says success, open **Open trust portal** or go to `/`.

If you see “database not reachable”, wait one minute and refresh — first deploy may still be finishing.

## Step D — Connect Neon from Vercel (alternative)

Instead of pasting URLs manually:

1. Vercel project → **Storage** or **Integrations** → **Neon**.
2. Link the Neon project; Vercel injects `DATABASE_URL` / `DIRECT_URL`.
3. You still must add **`SETUP_SECRET`** yourself and redeploy if added after first deploy.

## File uploads on Vercel

Serverless disks are ephemeral. For receipts and bills:

```env
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_REGION=ap-south-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://...
```

**Cloudflare R2** works with the same variables (S3-compatible API).

Until S3 is configured, you can browse accounting/donors with `STORAGE_DRIVER=local`, but uploads may not persist across requests.

## Razorpay webhook (when ready)

`https://YOUR-PROJECT.vercel.app/api/webhooks/razorpay`

## Security

- Remove or rotate **`SETUP_SECRET`** after seeding if you prefer (seed is idempotent if users already exist).
- Add real login before sharing the site publicly.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on `prisma db push` | Set **`DIRECT_URL`** to Neon’s non-pooled URL |
| `/setup` says invalid secret | `SETUP_SECRET` in Vercel must match exactly; redeploy after changing env |
| Accounting page DB error | Complete `/setup` seed; check Neon project is running |
| Upload fails | Set `STORAGE_DRIVER=s3` and S3/R2 credentials |
