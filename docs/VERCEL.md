# Deploying to Vercel

The trust portal is a **Next.js 15** app and runs on Vercel with **managed PostgreSQL** and **object storage** (files are not persisted on the serverless filesystem).

## Architecture on Vercel

| Component | Recommendation |
|-----------|----------------|
| App hosting | [Vercel](https://vercel.com) (import GitHub repo `sridushiva-dev/bnssevatrust`, branch **`main`**) |
| Database | [Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/storage/postgres) (PostgreSQL) |
| Uploads & receipt PDFs | **S3** (AWS S3, Cloudflare R2, or similar) with `STORAGE_DRIVER=s3` |
| Payments | Razorpay (test keys first; webhook URL → production domain) |

## 1. Create the database

1. Create a Neon project (or Vercel Postgres).
2. Copy the **pooled** connection string for the app (`?sslmode=require`; Neon also offers a **pooled** URL for serverless).
3. For `prisma db push` / migrations from your laptop, use the **direct** (non-pooled) URL if Neon separates them.

## 2. Prepare schema & seed (from your Mac, once)

```bash
git clone https://github.com/sridushiva-dev/bnssevatrust.git
cd bnssevatrust
git checkout main
npm install

cp .env.example .env
# Set DATABASE_URL to your Neon *direct* URL for setup

npm run db:push
npm run db:seed
```

Seeding is **not** run automatically on Vercel deploy; run it manually when you create or reset a database.

## 3. S3 (required in production)

On Vercel, set:

```env
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://your-bucket.s3.ap-south-1.amazonaws.com
```

Ensure the bucket policy or public access matches how you serve `S3_PUBLIC_BASE_URL` (or use CloudFront). Expense bills, corpus letters, and **donation receipt PDFs** are stored here when `STORAGE_DRIVER=s3`.

## 4. Import project on Vercel

1. **Add New Project** → import `sridushiva-dev/bnssevatrust`.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `npm run build` (default; `postinstall` runs `prisma generate`).
4. Add **Environment variables** (Production + Preview as needed):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Pooled Postgres URL for runtime |
| `STORAGE_DRIVER` | Yes | `s3` on Vercel |
| `S3_*` | Yes | See above |
| `RAZORPAY_KEY_ID` | For UPI/subscriptions | |
| `RAZORPAY_KEY_SECRET` | For UPI/subscriptions | |
| `RAZORPAY_WEBHOOK_SECRET` | For webhooks | |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For client QR | |
| `TALLY_COMPANY_NAME` | Optional | Tally XML company name |

5. Deploy.

## 5. Razorpay webhook

In Razorpay Dashboard → Webhooks, set:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/webhooks/razorpay
```

Use the same `RAZORPAY_WEBHOOK_SECRET` in Vercel env.

## 6. After deploy

- Open `https://YOUR-VERCEL-DOMAIN.vercel.app`
- **Audit / exports:** `/audit` or `/exports`
- Large ZIP exports may need **Vercel Pro** (longer function timeout); `vercel.json` requests 60s for `/api/exports/*`.

## 7. Security note (before public launch)

The app still uses a **development-style actor** (first seeded `ADMIN_TRUSTEE`) rather than full login. Do not expose the production URL publicly until you add authentication (NextAuth, Clerk, etc.) and lock export APIs.

## Local vs Vercel

| | Local | Vercel |
|---|--------|--------|
| `STORAGE_DRIVER` | `local` | `s3` |
| Postgres | Homebrew / Postgres.app | Neon / Vercel Postgres |
| `npm run dev` | Yes | N/A (use Preview deployments) |
