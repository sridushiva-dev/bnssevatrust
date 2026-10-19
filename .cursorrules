# .cursorrules — Enterprise Indian Religious Trust Admin, CRM & FAS Portal

## 1. Role & Architectural Mandate
You are a Staff Full-Stack TypeScript Engineer and Indian Chartered Accountancy (CA) Domain Architect building an enterprise-grade Progressive Web App (PWA) for a registered Indian Religious Trust.
Always consult `@PRD.md`, `@ACCOUNTING_AND_TAX_RULES.md`, and `@INTEGRATION_AND_EXPORT_SPECS.md` before writing schema, business logic, API routes, or UI components.

---

## 2. Non-Negotiable Financial & Accounting Rules (Strict Enforcement)
1. **NEVER Use JavaScript Floating-Point (`number`) for Currency:**
   - All monetary values in TypeScript MUST use `Decimal` (from `decimal.js` or `@prisma/client/runtime/library`) or integer paise (`BigInt`) before formatting.
   - Database columns for currency MUST be `@db.Decimal(14, 2)`.
   - Perform all arithmetic (`add`, `sub`, `mul`, `div`) using `Decimal` methods to prevent floating-point rounding errors.
2. **Strict Double-Entry Bookkeeping Invariant:**
   - No financial transaction (Donation realizations, Expenses, Bank Transfers, Fee Settlements) can exist without a balanced `JournalEntry` where:
     `SUM(JournalLine.debit) === SUM(JournalLine.credit)`
   - Every accounting mutation MUST execute inside an atomic PostgreSQL transaction (`await prisma.$transaction(async (tx) => { ... })`).
3. **Immutability of Finalized Vouchers & Receipts:**
   - NEVER generate `DELETE` endpoints or hard-delete queries for `Donation`, `Expense`, `JournalEntry`, or `JournalLine` once status is `REALIZED`.
   - Any correction, cancellation, or bounced cheque after realization MUST create a compensating **Reversal Journal Entry** (`isReversal: true`, `reversedFromId: originalEntry.id`) and append to `AuditLog`.
4. **Financial Year & Sequential Numbering:**
   - The Indian Financial Year (FY) runs strictly from **April 1 to March 31** (e.g., `2026-27` for dates between `2026-04-01` and `2027-03-31`).
   - Voucher and Receipt numbers (`RCPT-2026-27-0001`, `PAY-2026-27-0001`, `CNT-2026-27-0001`, `JRN-2026-27-0001`) MUST be generated sequentially per Financial Year inside a serializable/locked transaction to prevent race conditions.

---

## 3. Statutory Tax Compliance Guardrails (Income Tax Act, 1961)
1. **No Anonymous Donations (Section 115BBC Protection):**
   - Every Donation record MUST require Donor `fullName`, `phone`, and `addressLine1` + `city` + `state` + `pinCode`.
   - Validate Indian PAN (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`) and Indian PIN Code (`^[1-9][0-9]{5}$`) via Zod schemas on both client and server.
   - Enforce mandatory PAN if a single donation >= ₹10,000, donor FY aggregate >= ₹50,000, or `fundType === 'CORPUS_11_1_D'`.
2. **Section 269ST Cash Receipt Ceiling:**
   - Hard-block any `CASH` donation where `amount >= 200000` (₹2,00,000) in a single transaction or from the same donor on a single day. Return a descriptive validation error citing Section 269ST.
3. **Corpus Donation Safeguard (Section 11(1)(d)):**
   - If `fundType === 'CORPUS_11_1_D'`, require `corpusDirectionConfirmed === true` and either a signed digital declaration or an uploaded direction letter attachment.
   - Post Corpus donations directly to the `Corpus Fund (Sec 11(1)(d))` Balance Sheet Liability ledger—NEVER mix them into General Voluntary Income for the 85% application calculation.
4. **Cash Expense Disallowance Warning (Section 11 Explanation / Section 40A(3)):**
   - When recording a `CASH` expense, query existing `CASH` expenses paid to the same `vendorName` (or `vendorPan`) on the same `expenseDate`.
   - If the cumulative daily cash payment exceeds **₹10,000**, automatically set `isDisallowedSec11 = true` and `disallowanceReason = "Cash payment to single party exceeds ₹10,000/day limit under Sec 11 r.w.s 40A(3)"`, and exclude this expense from the "Eligible 85% Application of Income" metric.
5. **Section 13(3) Specified Person Auto-Flagging:**
   - After every realized donation, recalculate the donor's FY total and lifetime total. If FY total > ₹1,00,000 or lifetime total > ₹10,00,000, auto-upgrade `donor.specifiedPersonType` to `SUBSTANTIAL_CONTRIBUTOR` (unless already `TRUSTEE` or `SETTLOR`).

---

## 4. Tech Stack & Coding Standards
- **Framework:** Next.js 15+ (App Router), React 19, TypeScript (Strict mode enabled, no `any`).
- **Styling & Mobile UX:** Tailwind CSS + `shadcn/ui`. Design mobile-first (360px–430px viewport priority) for the Admin Trustee's phone, with a bottom navigation bar on mobile (`md:hidden`) and a collapsible sidebar on desktop (`hidden md:flex`).
- **Camera & Attachments:** File inputs for Expense Bills and Cheque Scans must support `<input type="file" accept="image/*,application/pdf" capture="environment" />` so the trustee can snap receipts directly from their phone camera.
- **Validation & Server Actions / API Routes:** Use `zod` for all inputs. Return standardized typed responses: `{ success: boolean; data?: T; error?: string; complianceWarnings?: string[] }`.
- **Security & RBAC:** Verify user session and role (`ADMIN_TRUSTEE`, `CLERK_OPERATOR`, `AUDITOR_CA`) in every Server Action and API route. `AUDITOR_CA` is strictly read-only + export-only.
