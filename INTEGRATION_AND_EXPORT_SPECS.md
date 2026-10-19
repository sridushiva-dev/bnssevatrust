# INTEGRATION_AND_EXPORT_SPECS.md — Razorpay, Tally Prime XML & CA Audit Specifications

## 1. Razorpay Payment Integration Specifications

### 1.1 Environment Variables Required
```env
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxx"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxx"
```

### 1.2 Dynamic UPI QR Code Flow (`Option B: UPI_QR`)
- **Endpoint:** `POST /api/donations/razorpay-qr`
- **Action:**
  1. Create a `Donation` record in PostgreSQL with `status = 'PENDING_PAYMENT'` and `paymentMethod = 'UPI_QR'`.
  2. Call Razorpay QR Codes API (`razorpay.qrCode.create`):
     ```json
     {
       "type": "upi_qr",
       "name": "Religious Trust Donation",
       "usage": "single_use",
       "fixed_amount": true,
       "payment_amount": 500100,
       "description": "Donation Receipt #RCPT-2026-27-0042",
       "notes": {
         "donation_id": "clx...",
         "donor_id": "clx...",
         "receipt_number": "RCPT-2026-27-0042",
         "fund_type": "GENERAL_VOLUNTARY"
       }
     }
     ```
     *(Note: `payment_amount` is in paise, so ₹5,001.00 = `500100`).*
  3. Return `image_url` / QR payload to render on the Admin Trustee's mobile screen, and poll/listen via Server-Sent Events or SWR until the webhook flips `status` to `REALIZED`.

### 1.3 Recurring Subscription Flow (`Option C: SUBSCRIPTION`)
- **Endpoint:** `POST /api/donations/razorpay-subscription`
- **Action:**
  1. Create or select a Razorpay Plan (`period: "monthly" | "quarterly" | "yearly"`).
  2. Call `razorpay.subscriptions.create` with `notes: { donor_id, fund_type }`.
  3. Store `razorpaySubscriptionId` and `shortUrl` in the `Subscription` table.
  4. Render a QR code for `shortUrl` and share via WhatsApp/Email/SMS so the donor authorizes UPI AutoPay / e-Mandate.

### 1.4 Webhook Handler (`POST /api/webhooks/razorpay`)
- **Security:** Verify `x-razorpay-signature` header against raw request body using `crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)`.
- **Idempotency:** Check if `razorpayPaymentId` already exists in `Donation`. If already `REALIZED`, return `200 OK` without duplicate posting.
- **Handled Events:**
  - `payment.captured` / `qr_code.credited`:
    - Locate `Donation` via `notes.donation_id` or `qr_code_id`.
    - Run `prisma.$transaction`: update `status = 'REALIZED'`, store `razorpayPaymentId` and `utrNumber` (`acquirer_data.rrn`), post Double-Entry `JournalEntry`, generate PDF receipt, and trigger donor email/SMS/WhatsApp notification.
  - `subscription.charged`:
    - Create a new `Donation` record for that billing cycle, post Double-Entry `JournalEntry`, generate PDF receipt, and notify donor.

---

## 2. Tally Prime XML Export Specification (`lib/exports/tallyXmlGenerator.ts`)

### 2.1 Important Tally XML Sign Rules (`ISDEEMEDPOSITIVE`)
Tally Prime XML requires strict adherence to `ISDEEMEDPOSITIVE` and positive/negative `AMOUNT` signs inside `<ALLLEDGERENTRIES.LIST>`:
- **For a DEBIT Line:**
  - `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`
  - `<AMOUNT>-1500.00</AMOUNT>` *(Negative number in Tally XML means Debit!)*
- **For a CREDIT Line:**
  - `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`
  - `<AMOUNT>1500.00</AMOUNT>` *(Positive number in Tally XML means Credit!)*

### 2.2 Canonical Tally Prime Voucher XML Template
Generate valid XML following this exact structure:
```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Sri Religious Trust</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>20261019</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>RCPT-2026-27-0001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Voluntary Contributions - General</PARTYLEDGERNAME>
            <NARRATION>Donation from Ramesh Kumar | PAN: ABCDE1234F | Mode: UPI_QR | UTR: 629211223344 | Fund: GENERAL_VOLUNTARY</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Razorpay Settlement Clearing Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-5001.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Voluntary Contributions - General</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>5001.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```
*(Format `<DATE>` strictly as `YYYYMMDD` with no hyphens).*

---

## 3. CA Tax Audit CSV Export Schemas (Form 10B / 10BB & ITR-7 Ready)

Provide a one-click **"Download FY Audit Pack (.zip)"** containing:
1. **`01_Donor_and_Receipt_Register_FY.csv`**
   - Columns: `Receipt_No, Receipt_Date, Donor_Code, Donor_Name, Phone, Email, PAN_Number, Full_Address, State, PIN_Code, Fund_Type_Sec11, Payment_Mode, Amount_INR, Cheque_Or_UTR_No, Bank_Name, Clearance_Date, Corpus_Direction_Attached, Sec_13_3_Category`
2. **`02_Sec_13_3_Substantial_Contributors_Schedule.csv`** (For Form 10B/10BB Clause 31/Schedule)
   - Columns: `Donor_Code, Donor_Name, PAN_Number, Address, Relation_Category, FY_Donation_Total_INR, Lifetime_Donation_Total_INR`
3. **`03_Expense_and_Application_Register_FY.csv`**
   - Columns: `Voucher_No, Expense_Date, Scale_Major_Petty, Vendor_Name, Vendor_PAN, Budget_Category, Accounting_Ledger, Nature_Of_Application, Gross_Amount_INR, TDS_Deducted_INR, Net_Paid_INR, Payment_Mode, UTR_Or_Cheque_No, Sec11_Disallowed_Flag, Disallowance_Reason, Attachment_Filename`
4. **`04_Budget_vs_Actuals_Variance_Report_FY.csv`**
   - Columns: `Budget_Category, Mapped_Ledger_Name, Annual_Budget_INR, Actual_Spent_INR, Variance_Remaining_INR, Utilization_Pct, Status`
5. **`05_Sec_11_85Pct_Application_Computation_Summary.csv`**
   - Columns: `Particulars, Section_Reference, Amount_INR, Notes`
