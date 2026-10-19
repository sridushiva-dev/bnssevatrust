# ACCOUNTING_AND_TAX_RULES.md — Indian Religious Trust FAS & Statutory Reference

## 1. Legal & Regulatory Framework
This portal governs a registered **Religious Trust in India** operating under:
1. **Income Tax Act, 1961 (as amended by Finance Act, 2026):** Sections 11, 12, 12A, 12AB, 13, 115BBC, 115TD, 269ST, and Rules 17A/17B (Form 10B, Form 10BB, Form 10BD, ITR-7).
2. **Charitable and Religious Trusts Act, 1920 & Indian Trusts Act, 1882 (Section 19):** Trustees are legally bound to maintain clear, accurate, and contemporaneous accounts of trust property, receipts, and vouchers, ready for inspection and statutory audit.

---

## 2. Pre-Seeded Chart of Accounts (Tally Prime Compatible)
Seed the `LedgerAccount` table with the following canonical ledgers and exact `tallyParentGroup` mappings:

| Code | Ledger Name (`name`) | Tally Parent Group (`tallyParentGroup`) | Account Type (`accountType`) | Sec 11(5) Flag |
| :--- | :--- | :--- | :--- | :--- |
| `1001` | `Corpus Fund - Sec 11(1)(d)` | `Capital Account` | `LIABILITY_FUND` | `false` |
| `1002` | `General Trust Fund / Surplus` | `Capital Account` | `LIABILITY_FUND` | `false` |
| `1003` | `Designated Fund - Annadhanam` | `Current Liabilities` | `LIABILITY_FUND` | `false` |
| `1004` | `Designated Fund - Temple Renovation` | `Current Liabilities` | `LIABILITY_FUND` | `false` |
| `1005` | `TDS Payable` | `Duties & Taxes` | `LIABILITY_FUND` | `false` |
| `1006` | `Uncleared Cheques in Hand (Contra)` | `Current Liabilities` | `LIABILITY_FUND` | `false` |
| `2001` | `Primary Trust Bank Account (Savings/Current)` | `Bank Accounts` | `ASSET` | `true` |
| `2002` | `Corpus Dedicated Bank Account` | `Bank Accounts` | `ASSET` | `true` |
| `2003` | `Scheduled Bank Fixed Deposits - Sec 11(5)` | `Deposits (Asset)` | `ASSET` | `true` |
| `2004` | `Razorpay Settlement Clearing Account` | `Current Assets` | `ASSET` | `false` |
| `2005` | `Cash-in-Hand (Main Chest)` | `Cash-in-Hand` | `ASSET` | `false` |
| `2006` | `Petty Cash Imprest` | `Cash-in-Hand` | `ASSET` | `false` |
| `2007` | `Temple Building & Fixed Assets` | `Fixed Assets` | `ASSET` | `false` |
| `3001` | `Voluntary Contributions - General` | `Direct Incomes` | `INCOME` | `false` |
| `3002` | `Specific Pooja & Seva Receipts` | `Direct Incomes` | `INCOME` | `false` |
| `3003` | `Annadhanam Contributions` | `Direct Incomes` | `INCOME` | `false` |
| `3004` | `Subscription / Nithya Kainkaryam Receipts` | `Direct Incomes` | `INCOME` | `false` |
| `3005` | `Bank & FD Interest Income` | `Indirect Incomes` | `INCOME` | `false` |
| `4001` | `Nithya Pooja & Religious Samagri Expenses` | `Direct Expenses` | `EXPENSE` | `false` |
| `4002` | `Annadhanam & Prasadam Distribution` | `Direct Expenses` | `EXPENSE` | `false` |
| `4003` | `Utsavam & Festival Expenses` | `Direct Expenses` | `EXPENSE` | `false` |
| `4004` | `Archakar & Temple Staff Sambhavana` | `Direct Expenses` | `EXPENSE` | `false` |
| `4005` | `Temple Repair, Maintenance & Utilities` | `Indirect Expenses` | `EXPENSE` | `false` |
| `4006` | `Audit, Legal & Accounting Fees` | `Indirect Expenses` | `EXPENSE` | `false` |
| `4007` | `Razorpay & Bank Transaction Charges` | `Indirect Expenses` | `EXPENSE` | `false` |
| `4008` | `Petty Office & Miscellaneous Expenses` | `Indirect Expenses` | `EXPENSE` | `false` |

---

## 3. Double-Entry Posting Matrix (Automated Journal Generation)

### 3.1 Donations (Receipts)
1. **Cash Donation (`General Voluntary`):**
   - **Voucher Type:** `RECEIPT`
   - **Debit:** `2005 - Cash-in-Hand (Main Chest)`
   - **Credit:** `3001 - Voluntary Contributions - General`
2. **Cash or Online Donation (`Corpus Fund - Sec 11(1)(d)`):**
   - **Voucher Type:** `RECEIPT`
   - **Debit:** `2002 - Corpus Dedicated Bank Account` (or `2005 - Cash-in-Hand` prior to deposit)
   - **Credit:** `1001 - Corpus Fund - Sec 11(1)(d)`
3. **Razorpay UPI QR / Subscription Charge (`payment.captured` / `subscription.charged`):**
   - **Voucher Type:** `RECEIPT`
   - **Debit:** `2004 - Razorpay Settlement Clearing Account` (for Gross Donation Amount)
   - **Credit:** `3001 - Voluntary Contributions - General` (or `3004 - Subscription Receipts`)
   - *(Note: When Razorpay settles to the bank account, auto-post a `CONTRA`/`JOURNAL` entry debiting `2001 - Primary Trust Bank Account` for Net Settlement, debiting `4007 - Razorpay Charges` for gateway fee, and crediting `2004 - Razorpay Settlement Clearing Account`).*
4. **Cheque Donation:**
   - **On Receipt (`CHEQUE_RECEIVED_UNCLEARED`):**
     - No income recognition in Income & Expenditure Account. Issue Provisional Receipt marked *"Subject to Realization"*.
   - **On Bank Clearance (`REALIZED`):**
     - **Voucher Type:** `RECEIPT`
     - **Debit:** `2001 - Primary Trust Bank Account` (or `2002` if Corpus)
     - **Credit:** `3001 - Voluntary Contributions - General` (or `1001` if Corpus)
   - **On Dishonor (`BOUNCED`):**
     - Mark cheque status `BOUNCED`, record `bounceReason`, notify donor, and if a provisional entry existed, reverse it.

### 3.2 Expenses (Payments)
1. **Major / Petty Expense (Without TDS):**
   - **Voucher Type:** `PAYMENT`
   - **Debit:** Mapped Expense Ledger (e.g., `4002 - Annadhanam & Prasadam Distribution`)
   - **Credit:** `2005 - Cash-in-Hand` / `2006 - Petty Cash Imprest` (if Cash) OR `2001 - Primary Trust Bank Account` (if UPI/Cheque)
2. **Major Expense (With TDS Deduction under Sec 194C/194J/194I):**
   - **Voucher Type:** `PAYMENT`
   - **Debit:** Mapped Expense Ledger (`Gross Bill Amount`)
   - **Credit:** `2001 - Primary Trust Bank Account` (`Net Paid Amount = Gross - TDS`)
   - **Credit:** `1005 - TDS Payable` (`TDS Amount`)

---

## 4. Section 11 (85% Application of Income) Calculation Formula
Display this calculation live on the Admin Trustee Dashboard and in the Audit Pack:
```
Total Eligible Income (A) =
    SUM(Realized Income in Ledgers 3001..3005 for FY)
  - (DO NOT include Ledger 1001 Corpus Donations)

Permissible 15% Accumulation (B) = 0.15 * A
Mandatory 85% Application Target (C) = 0.85 * A

Eligible Application of Income (D) =
    SUM(Realized Expenses in Ledgers 4001..4008 for FY where isDisallowedSec11 == false)
  + SUM(Eligible Capital Asset Additions funded from Revenue Income where isDisallowedSec11 == false)
  - SUM(Any expenditure funded out of Corpus Fund 1001 or Borrowed Funds)

Application Shortfall (E) = MAX(0, C - D)
Current Application Percentage = (D / A) * 100
```
- If `Current Application Percentage < 85%`, display an actionable alert banner explaining how much needs to be applied before **March 31** or accumulated via **Form 10** and invested in **Section 11(5)** modes (`2003 - Scheduled Bank Fixed Deposits`).
