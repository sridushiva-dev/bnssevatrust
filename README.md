# Bhagavan Naama Sathsangam Seva Trust — Cursor Kickoff Bundle

## 1. What is Inside This Bundle
Everything you need to build the **Bhagavan Naama Sathsangam Seva Trust** Admin, Donor CRM, and Double-Entry Accounting Portal in **Cursor**:

- **`README.md`** — This quick-start guide and copy-paste kickoff prompts for Cursor Agent.
- **`PRD.md`** — Complete Product Requirements Document tailored to your registered Trust Deed (Registration No. `R/Podumbu/Book-4/71/2026`, dated 30-09-2026), including the **Dynamic Custom Ledger Engine with Auto-Assigned Ledger Codes**, Razorpay integration, Budget vs. Actuals, and Tally Prime XML export.
- **`.cursorrules`** — Strict architectural, accounting, and Indian Income Tax (Sections 11, 12AB, 13(3), 269ST, 40A(3)) guardrails that Cursor loads automatically.
- **`prisma/schema.prisma`** — Ready-to-run PostgreSQL relational schema with dynamic Ledger Management, Auto-Code Sequence tracking, Donor CRM, Donations, Expenses, Budgets, and Audit Logs.
- **`prisma/seed.ts`** — Ready-to-run seed script pre-loaded with:
  - The 7 Board of Trustees & Authorised Signatories from your Trust Deed (`R. Meenakshi Sundaram`, `G. Ramakrishnan`, `S. Sivarama Krishnan`, `S. Ganesh`, `G. Shyam Sundar`, `Meera Shankar`, `K. Suriyanarayanan`).
  - Initial Founder Corpus Contribution of **₹1,000/-** (Clause 5.2 of Trust Deed).
  - Minimal core system ledgers + your Trust-Deed-aligned Seva & Mahotsavam categories (all editable/extensible via the UI with auto-assigned codes).
- **`public/assets/trust-logo.png`** — Official **Bhagavan Naama Sathsangam Seva Trust (Since 1990)** logo pre-placed for the PWA header, login screen, and PDF donation receipts.

---

## 2. How to Start in Cursor (30 Seconds)

1. **Extract this ZIP** into your new project folder (e.g., `bnst-trust-portal/`) and open that folder in **Cursor**.
2. Open **Cursor Composer / Agent Mode** (`Cmd + I` on Mac or `Ctrl + I` on Windows).
3. **Copy and paste Prompt 1 below** to build the foundation, database, and Dynamic Ledger Engine:

### Prompt 1 — Foundation, Dynamic Ledger Manager & Double-Entry Core
```text
Read @PRD.md, @.cursorrules, @prisma/schema.prisma, and @prisma/seed.ts.
Let's execute Phase 1 & Phase 2:
1. Initialize the Next.js (App Router, TypeScript, Tailwind CSS, shadcn/ui) mobile-first PWA using `/public/assets/trust-logo.png` and the brand palette from @PRD.md.
2. Connect `@prisma/schema.prisma` and `@prisma/seed.ts`.
3. Build the Dynamic Chart of Accounts & Ledger Master module (`/accounting/ledgers`) where the Admin Trustee can create, rename, or deactivate any custom ledger, pick a Tally Parent Group, and have the system automatically assign the next sequential 4-digit Ledger Code (`1xxx` Liabilities/Funds, `2xxx` Assets/Bank/Cash, `3xxx` Incomes, `4xxx` Expenses) inside an atomic Prisma transaction.
4. Build the Double-Entry Accounting Engine (`lib/accounting/engine.ts`) with Trial Balance, Receipts & Payments, Income & Expenditure, Balance Sheet, and the Section 11 (85% Application of Income) live compliance tracker.
```

---

### Prompt 2 — Donor CRM, 4-Mode Donations & Razorpay Integration
Once Phase 1 & 2 are verified, paste this into Cursor Agent:
```text
Read @PRD.md and @.cursorrules. Execute Phase 3:
1. Build the Donor CRM (`/donors`) with phone/PAN auto-lookup, PAN format validation, and automatic Section 13(3) Substantial Contributor tagging (> ₹1,00,000/FY or > ₹10,00,000 lifetime), plus pre-tagged Board Trustees from the seed data.
2. Build the Donations Collection flow (`/donations`) supporting Cash, Dynamic UPI QR (Razorpay), Recurring Subscriptions (Razorpay), and Cheque (with two-stage `CHEQUE_RECEIVED_UNCLEARED` -> `REALIZED` clearance queue). Let the Admin Trustee select any active Income or Corpus/Fund Ledger from the dynamic Chart of Accounts.
3. Build the Razorpay API routes and HMAC-SHA256 webhook handler (`/api/webhooks/razorpay`) that marks payments `REALIZED`, posts the balanced double-entry journal, generates an official branded PDF receipt (with `/public/assets/trust-logo.png`, Trust Deed Reg No. `R/Podumbu/Book-4/71/2026`, and joint signatory block for G. Ramakrishnan & S. Sivarama Krishnan), and notifies the donor.
```

---

### Prompt 3 — Expense Management, Budget vs. Actuals & Tally Prime XML Export
Once Phase 3 is verified, paste this into Cursor Agent:
```text
Read @PRD.md and @.cursorrules. Execute Phase 4 & Phase 5:
1. Build the Expenses Module (`/expenses`) for Major & Petty expenses across Cash, UPI/Bank, and Cheque, linked to any dynamic Expense Ledger and Budget Category, with mobile camera bill capture (`capture="environment"`), optional TDS deduction split, and the ₹10,000/day single-vendor Cash Expense disallowance guardrail (Sec 11 r.w.s. 40A(3)).
2. Build the Budget vs. Actuals Dashboard (`/budgets`) where the Admin Trustee can create custom budget categories linked to ledgers, set annual/festival budgets (e.g., Seetha-Radha Kalyana Mahotsavam, Annadanam), and drill down into actual vouchers.
3. Build the Tally Prime XML & CA Audit Export Center (`/exports`) generating valid Tally Prime `Masters.xml` (including all custom user-created ledgers) and `Transactions.xml` (`ISDEEMEDPOSITIVE` compliant), Form 10B/10BB & ITR-7 CSV schedules, and a monthly ZIP bundle of all uploaded bills and receipts.
```
