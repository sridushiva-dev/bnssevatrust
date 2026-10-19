# Product Requirements Document (PRD): Enterprise Religious Trust Admin, CRM & Financial Accounting Portal

## 1. Executive Summary & System Vision
Build an enterprise-grade, mobile-first **Progressive Web App (PWA)** for the Admin Trustee(s) of a registered **Indian Religious Trust**. The platform unifies three core systems into a single source of truth:
1. **Donor CRM & Payment Collection Engine** (integrated with Razorpay for UPI QR, Subscriptions, Payment Links, plus offline Cash and Cheque workflows).
2. **In-House Financial Accounting System (FAS)** following **Tally-style Double-Entry Fund Accounting** and Indian Income Tax compliance rules for Religious Trusts.
3. **Budget vs. Actuals & Statutory Audit Export Engine** capable of exporting **Tally Prime XML**, **CSV Audit Packs (Form 10B/10BB & ITR-7 ready)**, and voucher attachment bundles.

---

## 2. Recommended Tech Stack & Architecture
- **Application Type:** Installable Progressive Web App (PWA) with `manifest.json`, service worker caching, mobile bottom navigation bar, and native device camera integration (`capture="environment"`) for scanning bills and cheques on a phone, alongside a responsive desktop layout for audit exports.
- **Frontend & Backend Framework:** Next.js (App Router) with TypeScript, Tailwind CSS, and `shadcn/ui` components.
- **Relational Database (RDBMS):** PostgreSQL managed via **Prisma ORM** (or Drizzle ORM) with strict ACID transactions (`db.$transaction`) for all double-entry accounting posts.
- **File & Attachment Storage:** S3-compatible Object Storage (AWS S3 / Cloudflare R2 / Supabase Storage) storing immutable PDFs/images of bills, cheque scans, and corpus direction letters, with metadata and signed URL references stored in PostgreSQL.
- **Payment Gateway:** Razorpay Node.js SDK + Webhook Verification (`HMAC-SHA256`).
- **Authentication & Security:** Role-Based Access Control (RBAC) supporting `ADMIN_TRUSTEE` (full read/write/approve), `CLERK_OPERATOR` (create receipts/vouchers), and `AUDITOR_CA` (read-only + export access), with immutable audit logs (`audit_logs` table).

---

## 3. Domain Rules: Indian Religious Trust Accounting & Legal Compliance
The system must enforce statutory rules derived from the **Income Tax Act, 1961 (Sections 11, 12, 12A, 12AB, 13, 115BBC)**, **Indian Trusts Act, 1882 (Section 19)**, and **Charitable and Religious Trusts Act, 1920 (Section 3)**:

### 3.1 Fund Segregation & Revenue Recognition Policy
1. **Voluntary Contributions — General / Revenue Fund (Section 11(1)(a)):**
   - Treated as regular trust income.
   - **85% Application Rule:** At least **85%** of total eligible income in a Financial Year (April 1 to March 31) must be applied toward religious/trust objects in India. Up to **15%** can be unconditionally accumulated.
   - If application falls below 85%, the dashboard must calculate the exact shortfall and prompt the Admin Trustee regarding **Form 9A** (deemed application) or **Form 10** (accumulation up to 5 years).
2. **Corpus Donations (Section 11(1)(d)):**
   - **100% Exempt** from the 85% spending requirement **ONLY IF**:
     - The donor provides an explicit **written direction** that the donation is toward the Trust Corpus (mandatory digital consent checkbox on online forms or mandatory uploaded Corpus Direction Letter for offline receipts).
     - The funds are parked strictly in **Section 11(5) Approved Investment Modes** (Scheduled Bank Fixed Deposits, Govt Securities, Post Office Savings, etc.).
   - **Accounting Treatment:** Credited directly to the **Balance Sheet (`Corpus Fund` Liability Ledger)** and tracked in a dedicated Corpus Bank/FD sub-ledger. If Corpus funds are utilized for expenses, the system must warn that it is disallowed as "Application of Income" until the Corpus is replenished.
3. **Revenue Recognition Timing by Payment Mode:**
   - **Cash:** Recognized immediately (`REALIZED`) upon voucher submission.
   - **Dynamic UPI QR / Razorpay Online:** Recognized **only** upon receiving a verified Razorpay `payment.captured` webhook (`REALIZED`).
   - **Subscription (Recurring Donations):** Recognized per billing cycle upon receiving a verified Razorpay `subscription.charged` webhook (`REALIZED`).
   - **Cheque:** **Two-Stage Recognition:**
     - *Stage 1 (`CHEQUE_RECEIVED_UNCLEARED`):* Issues a provisional acknowledgment receipt ("Subject to Realization") and posts to a temporary clearing tracking state. Does **not** inflate realized income.
     - *Stage 2 (`REALIZED` or `BOUNCED`):* When the Admin Trustee marks the cheque as cleared (with Bank Clearance Date), the system posts the final double-entry journal to the Bank Ledger and dispatches the final Official Donation Receipt.

### 3.2 Statutory Compliance Guardrails (Auto-Validation Rules)
1. **Anonymous Donations (Section 115BBC) & KYC Enforcement:**
   - Every donation must capture **Donor Name, Phone Number, and Full Address** so it is never classified as an "Anonymous Donation" (which risks 30% tax under Sec 115BBC in mixed trusts).
   - **PAN Validation:** Validate format `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`. Make PAN mandatory if a single donation or annual aggregate for a donor crosses ₹10,000, or for all Corpus donations.
   - **Section 269ST Cash Receipt Limit:** Block or trigger a critical compliance alert if a single cash donation from one donor on a single day (or single event) equals or exceeds **₹2,00,000**.
2. **Section 13(3) Specified Persons & Substantial Contributor Tagging:**
   - Automatically flag any donor whose contribution exceeds **₹1,00,000 in a single Financial Year** or **₹10,00,000 in lifetime aggregate** as a `SUBSTANTIAL_CONTRIBUTOR` under Section 13(3) for mandatory disclosure in **Form 10B/10BB** and **ITR-7**.
   - Allow manual tagging of `TRUSTEE`, `SETTLOR`, or `RELATIVE_OF_TRUSTEE`. Block or flag any expense paid *to* a Section 13(3) person without an explicit "Arm's Length / Fair Market Value Justification" note.
3. **Expense Disallowance Guardrails (Section 11 Explanation & Section 40A(3)):**
   - **Cash Expense Limit (> ₹10,000/day):** Trigger a high-visibility warning if cash payments to a single vendor/party exceed **₹10,000 in a single day**, noting that such expenditure is disallowed as "Application of Income" under Section 11.
   - **Capital Asset vs. Depreciation Rule (Section 11(6)):** When recording a Capital Expense (e.g., temple renovation, equipment purchase) that is claimed 100% as "Application of Income" in the year of purchase, block depreciation from being claimed as an expense on that asset in future years.
   - **Audit Readiness (Indian Trusts Act Sec 19 & Act of 1920 Sec 3):** Every transaction must maintain an immutable audit trail (`created_by`, `created_at`, `updated_by`, `modification_reason`). Deletions are strictly forbidden after voucher finalization—corrections must use reversal/contra/journal vouchers.

---

## 4. Functional Modules & Specifications

### Module 1: Donor CRM (Customer Database)
- **Donor Master Profile:**
  - Fields: `Donor ID` (Auto: `DNR-YYYY-XXXX`), `Full Name`, `Phone Number` (unique lookup key), `Email`, `PAN Number` (encrypted/masked in UI, validated via regex), `Full Postal Address` (Street, City, State, PIN Code), `Donor Type` (`Individual`, `HUF`, `Corporate`, `Trust`), `Section 13(3) Category` (`None`, `Trustee`, `Settlor`, `Substantial Contributor`).
- **Donor 360 View:**
  - Lifetime contribution total, current Financial Year contribution total, active Razorpay subscriptions, downloadable receipt history, and uncleared cheques.
- **Smart Lookup:**
  - Typing a phone number or PAN in the Donation tab auto-populates existing donor details.

### Module 2: Donation Collection & Razorpay Integration
All donations must originate through the portal's **New Donation Flow**:
1. **Donor Selection / Creation:** Select existing donor or create new donor with KYC fields.
2. **Donation Classification:**
   - `General Voluntary Contribution` (Revenue Income)
   - `Specific Purpose / Designated Fund` (e.g., Annadhanam, Utsavam, Renovation)
   - `Corpus Donation` (Requires mandatory Donor Written Direction text/upload)
3. **Payment Method Routing (4 Modes):**
   - **Option A: Cash**
     - Captures denomination breakdown (optional) and collector trustee name.
     - Immediately marks status as `REALIZED`, posts double-entry (`Debit: Cash-in-Hand Ledger`, `Credit: Selected Donation Income/Corpus Ledger`), generates PDF receipt, and sends Email/WhatsApp/SMS confirmation.
   - **Option B: Dynamic UPI QR (via Razorpay)**
     - Calls Razorpay QR Code / Payment Link API (`amount`, `donor_id`, `donation_id` in `notes`).
     - Displays a dynamic scannable UPI QR code directly on the Admin Trustee's mobile screen AND optionally sends a payment link to the donor's phone/email.
     - Listens for Razorpay `payment.captured` webhook -> auto-transitions status to `REALIZED`, stores `razorpay_payment_id` and `utr_number`, posts double-entry (`Debit: Razorpay Settlement / Bank Ledger`, `Credit: Donation Ledger`), and sends official receipt to donor.
   - **Option C: Recurring Subscription (via Razorpay Subscriptions API)**
     - Allows selecting a frequency (`Monthly`, `Quarterly`, `Yearly`), plan amount, and total count.
     - Generates a Razorpay Subscription authorization link (`short_url`) and QR code for the donor to set up UPI AutoPay / e-Mandate.
     - Every `subscription.charged` webhook automatically generates a new Donation Record, posts the accounting voucher, and emails/messages the receipt to the donor.
   - **Option D: Cheque**
     - Mandatory fields: `Cheque Number` (6 digits), `Cheque Date`, `Issuing Bank Name`, `Branch / IFSC`, and `Cheque Photo Attachment` (camera capture).
     - Initial status: `CHEQUE_RECEIVED_UNCLEARED`. Sends provisional acknowledgment to donor.
     - Includes a **"Cheque Clearance Queue"** widget where the Admin Trustee enters `Deposit Bank Account` and `Clearance Date` (status -> `REALIZED`, posts journal entry, sends final receipt) or marks `BOUNCED` (with reason).

### Module 3: Expense & Voucher Management
- **Expense Classification:**
  - `Expense Type`: `Major Expense` vs. `Petty Expense`
  - `Nature of Application`: `Religious Object / Pooja / Seva`, `Annadhanam / Charity`, `Capital Asset Acquisition`, `Administrative & Establishment`.
  - `Budget Category`: Linked directly to the active Financial Year's Budget Heads.
- **Payment Methods (3 Modes):**
  - `Cash` (Credits `Cash-in-Hand` / `Petty Cash Ledger`; warns if > ₹10,000/day to same vendor).
  - `UPI / Bank Transfer` (Captures `UTR / Reference Number`, credits `Bank Account Ledger`).
  - `Cheque` (Captures `Issued Cheque Number`, `Cheque Date`, credits `Bank Account Ledger`).
- **Mandatory Attachment Engine:**
  - Every Major Expense **requires** at least one attachment (vendor invoice, bill, or stamped voucher image captured via mobile camera). Petty expenses support attachments with an option to generate an internal self-certified Petty Cash Voucher PDF.
- **TDS & Vendor Tracking:**
  - Captures `Vendor Name`, `Vendor PAN/GSTIN` (optional for petty, recommended for major), and `TDS Deducted` (if applicable under Sec 194C/194J/194I, automatically splitting the credit between Vendor Payable/Bank and `TDS Payable Ledger`).

### Module 4: In-House Financial Accounting System (FAS — Tally-Like Double-Entry Core)
- **Accounting Structure:**
  - Financial Year locked from **April 1 to March 31** (e.g., `FY 2026-27`, `AY 2027-28`).
  - **Pre-Seeded Tally-Compatible Chart of Accounts (Groups & Ledgers):**
    - *Liabilities / Funds:* `Corpus Fund (Sec 11(1)(d))`, `General Reserve / Trust Fund`, `Designated / Earmarked Funds`, `Current Liabilities & TDS Payable`.
    - *Assets:* `Fixed Assets`, `Section 11(5) Approved Investments (FDs/Bonds)`, `Bank Accounts (Primary Savings/Current)`, `Razorpay Clearing Account`, `Cash-in-Hand`, `Petty Cash`.
    - *Direct Incomes (Receipts):* `Voluntary Contributions - General`, `Specific Seva / Pooja Receipts`, `Hundi / Box Collections`, `Bank FD Interest Income`.
    - *Direct Expenses (Application of Income):* `Pooja & Religious Materials`, `Annadhanam & Prasadam Expenses`, `Festival / Utsavam Expenses`, `Priest & Staff Honorarium`, `Temple Repair & Maintenance`.
    - *Indirect / Admin Expenses:* `Audit & Legal Fees`, `Bank & Razorpay Gateway Charges`, `Electricity & Utilities`, `Printing & Stationery`.
- **Voucher Types Supported:**
  1. `Receipt Voucher` (Auto-created from Donations or manual non-donation receipts like FD interest).
  2. `Payment Voucher` (Auto-created from Expenses).
  3. `Contra Voucher` (Cash deposited into Bank, Cash withdrawn from Bank for Petty Cash, or Bank-to-FD transfer under Sec 11(5)).
  4. `Journal Voucher` (Year-end adjustments, TDS adjustments, Razorpay fee settlement reconciliation).
- **Real-Time Financial Statements & Compliance Views:**
  1. **Receipts & Payments Account** (Cash/Bank summary for the period).
  2. **Income & Expenditure Account** (Surplus/Deficit calculation).
  3. **Balance Sheet** (Funds & Liabilities vs. Property, Section 11(5) Investments & Cash/Bank).
  4. **Trial Balance & Day Book / Ledger Drilldown** (Tally-style drilldown from Group -> Ledger -> Monthly Summary -> Voucher).
  5. **Section 11 (85% Application) Compliance Meter:** Live widget showing:
     - `Total Eligible Income (A)`
     - `Mandatory 85% Application Target (0.85 * A)`
     - `Actual Eligible Application to Date (B)` (excluding disallowed cash expenses > ₹10k and Corpus outflows)
     - `Remaining Amount to Spend Before March 31 (max(0, 0.85*A - B))`

### Module 5: Budget vs. Actuals (Variance & Burn-Rate Engine)
- **Budget Setup:**
  - Admin Trustee defines annual and monthly/quarterly budgets per **Budget Category** for a selected Financial Year (e.g., `Annadhanam: ₹5,00,000`, `Brahmotsavam Festival: ₹3,00,000`, `Temple Maintenance: ₹1,50,000`).
- **Automated Actuals Tracking:**
  - Every recorded Expense is tagged with a `Budget Category`. Once completed, the expense amount automatically increments the category's `Actual Spend`.
- **Visual Variance Dashboard:**
  - Displays for each category: `Allocated Budget`, `Actual Spend`, `Available Balance`, `Utilization %`, and `Status Badge` (`Healthy < 80%`, `Warning 80–100%`, `Over-Budget > 100%`).
  - Drill-down click on any budget bar opens the exact list of expense vouchers that contributed to that category.

### Module 6: Statutory Audit & Tally Export Engine
- **1. Tally Prime XML Export (`Masters.xml` & `Transactions.xml`):**
  - Generates standard Tally XML compliant with `<ENVELOPE>`, `<HEADER>`, `<BODY>`, `<IMPORTDATA>`, and `<TALLYMESSAGE>` tags.
  - Maps every Donation (`VCHTYPE="Receipt"`), Expense (`VCHTYPE="Payment"`), Bank/Cash transfer (`VCHTYPE="Contra"`), and adjustment (`VCHTYPE="Journal"`) with narration including Donor PAN, Receipt No., Cheque/UTR No., and Attachment URL.
- **2. Chartered Accountant (CA) Tax Audit Pack (CSV / Excel Export):**
  - **Form 10B / 10BB & ITR-7 Ready Schedules:**
    - `Donor_Register.csv` (Full KYC, PAN, Address, Mode, Corpus vs. Voluntary flag, Sec 13(3) Substantial Contributor flag).
    - `Section_13_3_Specified_Persons_Report.csv`
    - `Expense_Register_with_Compliance_Flags.csv` (Highlights any cash expense > ₹10,000 or non-compliant entries).
    - `Section_11_5_Investments_Register.csv`
    - `Budget_vs_Actuals_Summary.csv`
- **3. One-Click Audit Evidence Bundle (`.zip`):**
  - Downloads a structured ZIP archive organized by month (`YYYY-MM/Receipts/` and `YYYY-MM/Expenses/`) containing all generated PDF receipts and uploaded expense bills named systematically by Voucher Number (`PAY-2026-0042_Invoice.pdf`).

---

## 5. Relational Database Schema Blueprint (`schema.prisma`)

```prisma
enum Role {
  ADMIN_TRUSTEE
  CLERK_OPERATOR
  AUDITOR_CA
}

enum FundType {
  GENERAL_VOLUNTARY
  DESIGNATED_PURPOSE
  CORPUS_11_1_D
}

enum PaymentMethod {
  CASH
  UPI_QR
  SUBSCRIPTION
  CHEQUE
  BANK_TRANSFER
}

enum TransactionStatus {
  PENDING_PAYMENT
  CHEQUE_RECEIVED_UNCLEARED
  REALIZED
  BOUNCED
  FAILED
  REVERSED
}

enum AccountType {
  ASSET
  LIABILITY_FUND
  INCOME
  EXPENSE
}

enum VoucherType {
  RECEIPT
  PAYMENT
  CONTRA
  JOURNAL
}

enum ExpenseScale {
  MAJOR
  PETTY
}

enum SpecifiedPersonType {
  NONE
  TRUSTEE
  SETTLOR
  SUBSTANTIAL_CONTRIBUTOR
  RELATIVE_OF_TRUSTEE
}

model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  phone        String?
  role         Role       @default(ADMIN_TRUSTEE)
  createdAt    DateTime   @default(now())
  auditLogs    AuditLog[]
}

model Donor {
  id                  String              @id @default(cuid())
  donorCode           String              @unique // e.g., DNR-2026-0001
  fullName            String
  phone               String              @unique
  email               String?
  panNumber           String?             // Regex validated: ^[A-Z]{5}[0-9]{4}[A-Z]{1}$
  addressLine1        String
  addressLine2        String?
  city                String
  state               String
  pinCode             String
  specifiedPersonType SpecifiedPersonType @default(NONE)
  lifetimeDonated     Decimal             @default(0) @db.Decimal(14, 2)
  donations           Donation[]
  subscriptions       Subscription[]
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@index([panNumber])
  @@index([phone])
}

model Donation {
  id                      String            @id @default(cuid())
  receiptNumber           String            @unique // e.g., RCPT-2026-27-0001
  financialYear           String            // e.g., "2026-27"
  donorId                 String
  donor                   Donor             @relation(fields: [donorId], references: [id])
  amount                  Decimal           @db.Decimal(14, 2)
  fundType                FundType          @default(GENERAL_VOLUNTARY)
  paymentMethod           PaymentMethod
  status                  TransactionStatus @default(PENDING_PAYMENT)
  
  // Corpus Compliance
  corpusDirectionConfirmed Boolean          @default(false)
  corpusDirectionNote      String?
  
  // Razorpay Fields
  razorpayOrderId         String?           @unique
  razorpayPaymentId       String?           @unique
  razorpayQrId            String?
  razorpaySignature       String?
  subscriptionId          String?
  utrNumber               String?

  // Cheque Fields
  chequeNumber            String?
  chequeDate              DateTime?
  chequeBankName          String?
  chequeBranchIfsc        String?
  chequeClearedDate       DateTime?
  bounceReason            String?

  // Accounting & Notifications
  journalEntryId          String?           @unique
  journalEntry            JournalEntry?     @relation(fields: [journalEntryId], references: [id])
  receiptPdfUrl           String?
  donorNotifiedAt         DateTime?
  attachments             Attachment[]
  createdById             String
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt

  @@index([financialYear, status])
  @@index([donorId])
}

model Subscription {
  id                     String   @id @default(cuid())
  razorpaySubscriptionId String   @unique
  donorId                String
  donor                  Donor    @relation(fields: [donorId], references: [id])
  planAmount             Decimal  @db.Decimal(14, 2)
  frequency              String   // MONTHLY, QUARTERLY, YEARLY
  fundType               FundType @default(GENERAL_VOLUNTARY)
  status                 String   // CREATED, ACTIVE, HALTED, COMPLETED, CANCELLED
  shortUrl               String?
  createdAt              DateTime @default(now())
}

model BudgetCategory {
  id            String       @id @default(cuid())
  name          String       // e.g., "Annadhanam", "Nithya Pooja", "Festival", "Maintenance"
  description   String?
  ledgerId      String       // Mapped Expense Ledger in FAS
  ledger        LedgerAccount @relation(fields: [ledgerId], references: [id])
  allocations   BudgetAllocation[]
  expenses      Expense[]
}

model BudgetAllocation {
  id               String         @id @default(cuid())
  financialYear    String         // e.g., "2026-27"
  budgetCategoryId String
  budgetCategory   BudgetCategory @relation(fields: [budgetCategoryId], references: [id])
  allocatedAmount  Decimal        @db.Decimal(14, 2)
  alertThresholdPct Int           @default(80)

  @@unique([financialYear, budgetCategoryId])
}

model Expense {
  id                      String            @id @default(cuid())
  voucherNumber           String            @unique // e.g., PAY-2026-27-0001
  financialYear           String
  expenseDate             DateTime
  scale                   ExpenseScale      @default(MAJOR)
  vendorName              String
  vendorPan               String?
  description             String
  amount                  Decimal           @db.Decimal(14, 2)
  tdsAmount               Decimal           @default(0) @db.Decimal(14, 2)
  netPaidAmount           Decimal           @db.Decimal(14, 2)
  paymentMethod           PaymentMethod     // CASH, UPI_QR (UPI/Bank), CHEQUE
  status                  TransactionStatus @default(REALIZED)

  // Payment Instrument Details
  utrOrRefNumber          String?
  chequeNumber            String?
  chequeDate              DateTime?
  paidFromLedgerId        String            // Cash-in-Hand or Bank Account Ledger

  // Compliance Flags
  isDisallowedSec11       Boolean           @default(false) // True if Cash > 10,000/day to single vendor
  disallowanceReason      String?
  isCapitalAsset          Boolean           @default(false)
  isRelatedPartySec13     Boolean           @default(false)

  // Budget & Accounting Links
  budgetCategoryId        String
  budgetCategory          BudgetCategory    @relation(fields: [budgetCategoryId], references: [id])
  journalEntryId          String?           @unique
  journalEntry            JournalEntry?     @relation(fields: [journalEntryId], references: [id])
  attachments             Attachment[]
  createdById             String
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt

  @@index([financialYear, budgetCategoryId])
  @@index([expenseDate, vendorName])
}

model LedgerAccount {
  id               String           @id @default(cuid())
  code             String           @unique // e.g., "1001", "2001"
  name             String           @unique // Exact Tally Ledger Name for XML export
  tallyParentGroup String           // e.g., "Corpus Fund", "Direct Incomes", "Bank Accounts"
  accountType      AccountType
  isSec11_5Mode    Boolean          @default(false) // Approved investment mode flag
  openingBalance   Decimal          @default(0) @db.Decimal(14, 2)
  journalLines     JournalLine[]
  budgetCategories BudgetCategory[]
}

model JournalEntry {
  id            String        @id @default(cuid())
  voucherNumber String        @unique
  voucherType   VoucherType
  financialYear String
  entryDate     DateTime
  narration     String
  isReversal    Boolean       @default(false)
  reversedFromId String?
  lines         JournalLine[]
  donation      Donation?
  expense       Expense?
  createdById   String
  createdAt     DateTime      @default(now())

  @@index([financialYear, entryDate])
}

model JournalLine {
  id             String        @id @default(cuid())
  journalEntryId String
  journalEntry   JournalEntry  @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  ledgerId       String
  ledger         LedgerAccount @relation(fields: [ledgerId], references: [id])
  debit          Decimal       @default(0) @db.Decimal(14, 2)
  credit         Decimal       @default(0) @db.Decimal(14, 2)
}

model Attachment {
  id          String    @id @default(cuid())
  fileName    String
  mimeType    String
  fileSize    Int
  storageKey  String    // S3 Object Key
  fileUrl     String
  donationId  String?
  donation    Donation? @relation(fields: [donationId], references: [id])
  expenseId   String?
  expense     Expense?  @relation(fields: [expenseId], references: [id])
  uploadedBy  String
  uploadedAt  DateTime  @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // e.g., "CREATE_DONATION", "CLEAR_CHEQUE", "EXPORT_TALLY_XML"
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

---

## 6. Phased Implementation Roadmap for Cursor Agent
Execute the build in the following strict sequence:
- **Phase 1: Project Scaffolding & Database Setup**
  - Initialize Next.js (App Router, TypeScript, Tailwind, `shadcn/ui`), configure PWA manifest, set up Prisma with the schema above, and build a database seed script (`prisma/seed.ts`) that populates the default **Indian Religious Trust Chart of Accounts** and sample Budget Categories.
- **Phase 2: Core Double-Entry Accounting Engine (FAS Service Layer)**
  - Implement a transactional service (`lib/accounting/postJournalEntry.ts`) that enforces `SUM(debit) === SUM(credit)`, auto-generates sequential financial-year voucher numbers, and computes Trial Balance, Receipts & Payments, Income & Expenditure, Balance Sheet, and the **Section 11 (85% Application) Compliance Tracker**.
- **Phase 3: Donor CRM & Donation Engine (with Razorpay)**
  - Build the Donor CRUD & smart lookup, the 4-method Donation form (Cash, UPI QR, Subscription, Cheque), the Cheque Clearance Queue, Razorpay API route handlers (`/api/razorpay/qr`, `/api/razorpay/subscription`, `/api/webhooks/razorpay`), PDF receipt generator, and automated donor notification service.
- **Phase 4: Expense Management & Budget vs. Actuals**
  - Build the Major/Petty Expense form with mobile camera attachment upload, the ₹10,000/day cash disallowance validator, and the Budget vs. Actuals dashboard with progress bars and drill-down views.
- **Phase 5: Tally Prime XML & CA Audit Export Suite**
  - Build the Tally XML generator (`lib/exports/tallyXmlGenerator.ts`) producing valid `Masters.xml` and `Transactions.xml`, alongside CSV generators for Form 10B/10BB schedules and the ZIP attachment bundler.