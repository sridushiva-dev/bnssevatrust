import { SpecifiedPersonType, TransactionStatus } from "@prisma/client";

import { getSection11ComplianceMeter } from "@/lib/accounting/reports";
import { getBudgetActualsForYear } from "@/lib/budgets/actuals";
import { prisma } from "@/lib/prisma";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

import { donationWhere, expenseWhere } from "./filters";
import { toCsvRow } from "./csv-utils";
import type { ExportFilter, GeneratedFile } from "./types";

function fyLabel(filter: ExportFilter): string {
  return filter.financialYear ?? getFinancialYearLabel(filter.dateFrom ?? new Date());
}

export async function generateDonorReceiptRegisterCsv(
  filter: ExportFilter,
): Promise<string> {
  const donations = await prisma.donation.findMany({
    where: donationWhere(filter),
    include: {
      donor: true,
      attachments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const header = toCsvRow([
    "Receipt_No",
    "Receipt_Date",
    "Donor_Code",
    "Donor_Name",
    "Phone",
    "Email",
    "PAN_Number",
    "Full_Address",
    "State",
    "PIN_Code",
    "Fund_Type_Sec11",
    "Payment_Mode",
    "Amount_INR",
    "Cheque_Or_UTR_No",
    "Bank_Name",
    "Clearance_Date",
    "Corpus_Direction_Attached",
    "Sec_13_3_Category",
  ]);

  const rows = donations.map((d) => {
    const fullAddress = [d.donor.addressLine1, d.donor.addressLine2, d.donor.city]
      .filter(Boolean)
      .join(", ");
    const chequeOrUtr = d.utrNumber ?? d.chequeNumber ?? "";
    const corpusAttached =
      d.attachments.length > 0 || d.corpusDirectionConfirmed ? "Yes" : "No";
    return toCsvRow([
      d.receiptNumber,
      d.createdAt.toISOString().slice(0, 10),
      d.donor.donorCode,
      d.donor.fullName,
      d.donor.phone,
      d.donor.email,
      d.donor.panNumber,
      fullAddress,
      d.donor.state,
      d.donor.pinCode,
      d.fundType,
      d.paymentMethod,
      d.amount.toString(),
      chequeOrUtr,
      d.chequeBankName,
      d.chequeClearedDate?.toISOString().slice(0, 10) ?? "",
      corpusAttached,
      d.donor.specifiedPersonType,
    ]);
  });

  return [header, ...rows].join("\n");
}

export async function generateSec133ScheduleCsv(filter: ExportFilter): Promise<string> {
  const fy = fyLabel(filter);
  const donors = await prisma.donor.findMany({
    where: {
      OR: [
        { specifiedPersonType: { not: SpecifiedPersonType.NONE } },
        { donations: { some: { financialYear: fy, status: TransactionStatus.REALIZED } } },
      ],
    },
    include: { donations: true },
  });

  const header = toCsvRow([
    "Donor_Code",
    "Donor_Name",
    "PAN_Number",
    "Address",
    "Relation_Category",
    "FY_Donation_Total_INR",
    "Lifetime_Donation_Total_INR",
  ]);

  const rows = donors
    .map((donor) => {
      const fyTotal = donor.donations
        .filter((d) => d.financialYear === fy && d.status === TransactionStatus.REALIZED)
        .reduce((sum, d) => sum + Number.parseFloat(d.amount.toString()), 0);
      const address = [donor.addressLine1, donor.city, donor.state, donor.pinCode].join(", ");
      const category =
        donor.specifiedPersonType !== SpecifiedPersonType.NONE
          ? donor.specifiedPersonType
          : fyTotal > 100000
            ? SpecifiedPersonType.SUBSTANTIAL_CONTRIBUTOR
            : SpecifiedPersonType.NONE;

      if (category === SpecifiedPersonType.NONE && fyTotal === 0) return null;

      return toCsvRow([
        donor.donorCode,
        donor.fullName,
        donor.panNumber,
        address,
        category,
        fyTotal.toFixed(2),
        donor.lifetimeDonated.toString(),
      ]);
    })
    .filter(Boolean) as string[];

  return [header, ...rows].join("\n");
}

export async function generateExpenseRegisterCsv(filter: ExportFilter): Promise<string> {
  const expenses = await prisma.expense.findMany({
    where: expenseWhere(filter),
    include: {
      budgetCategory: { include: { ledger: true } },
      attachments: true,
    },
    orderBy: { expenseDate: "asc" },
  });

  const header = toCsvRow([
    "Voucher_No",
    "Expense_Date",
    "Scale_Major_Petty",
    "Vendor_Name",
    "Vendor_PAN",
    "Budget_Category",
    "Accounting_Ledger",
    "Nature_Of_Application",
    "Gross_Amount_INR",
    "TDS_Deducted_INR",
    "Net_Paid_INR",
    "Payment_Mode",
    "UTR_Or_Cheque_No",
    "Sec11_Disallowed_Flag",
    "Disallowance_Reason",
    "Attachment_Filename",
  ]);

  const rows = expenses.map((e) =>
    toCsvRow([
      e.voucherNumber,
      e.expenseDate.toISOString().slice(0, 10),
      e.scale,
      e.vendorName,
      e.vendorPan,
      e.budgetCategory.name,
      e.budgetCategory.ledger.name,
      e.description,
      e.amount.toString(),
      e.tdsAmount.toString(),
      e.netPaidAmount.toString(),
      e.paymentMethod,
      e.utrOrRefNumber ?? e.chequeNumber,
      e.isDisallowedSec11 ? "Yes" : "No",
      e.disallowanceReason,
      e.attachments.map((a) => a.fileName).join("; "),
    ]),
  );

  return [header, ...rows].join("\n");
}

export async function generateBudgetVarianceCsv(filter: ExportFilter): Promise<string> {
  const fy = fyLabel(filter);
  const actuals = await getBudgetActualsForYear(fy);

  const header = toCsvRow([
    "Budget_Category",
    "Mapped_Ledger_Name",
    "Annual_Budget_INR",
    "Actual_Spent_INR",
    "Variance_Remaining_INR",
    "Utilization_Pct",
    "Status",
  ]);

  const rows = actuals.map((r) =>
    toCsvRow([
      r.categoryName,
      r.ledgerName,
      r.allocatedAmount.toFixed(2),
      r.actualSpend.toFixed(2),
      r.remaining.toFixed(2),
      r.utilizationPct.toFixed(1),
      r.status,
    ]),
  );

  return [header, ...rows].join("\n");
}

export async function generateSec11SummaryCsv(filter: ExportFilter): Promise<string> {
  const fy = fyLabel(filter);
  const meter = await getSection11ComplianceMeter(fy);

  const header = toCsvRow(["Particulars", "Section_Reference", "Amount_INR", "Notes"]);
  const rows = [
    toCsvRow([
      "Total Eligible Income (A)",
      "Sec 11",
      meter.totalEligibleIncome.toFixed(2),
      "Income ledgers 3001-3005",
    ]),
    toCsvRow([
      "Permissible 15% Accumulation",
      "Sec 11",
      meter.permissibleAccumulation.toFixed(2),
      "",
    ]),
    toCsvRow([
      "Mandatory 85% Application Target (C)",
      "Sec 11",
      meter.mandatoryApplicationTarget.toFixed(2),
      "",
    ]),
    toCsvRow([
      "Eligible Application (D)",
      "Sec 11",
      meter.eligibleApplication.toFixed(2),
      "Excludes disallowed cash expenses",
    ]),
    toCsvRow([
      "Application Shortfall (E)",
      "Sec 11",
      meter.applicationShortfall.toFixed(2),
      "",
    ]),
    toCsvRow([
      "Application Percentage",
      "Sec 11",
      meter.applicationPercentage.toFixed(2),
      "Target 85%",
    ]),
    toCsvRow([
      "Corpus Fund Outflows",
      "Sec 11(1)(d)",
      meter.corpusOutflows.toFixed(2),
      "Excluded from application",
    ]),
  ];

  return [header, ...rows].join("\n");
}

export async function generateAllAuditCsvFiles(
  filter: ExportFilter,
): Promise<GeneratedFile[]> {
  const fy = fyLabel(filter).replace("/", "-");
  const [
    donorRegister,
    sec133,
    expenses,
    budget,
    sec11,
  ] = await Promise.all([
    generateDonorReceiptRegisterCsv(filter),
    generateSec133ScheduleCsv(filter),
    generateExpenseRegisterCsv(filter),
    generateBudgetVarianceCsv(filter),
    generateSec11SummaryCsv(filter),
  ]);

  return [
    {
      fileName: `01_Donor_and_Receipt_Register_FY_${fy}.csv`,
      content: donorRegister,
      mimeType: "text/csv",
    },
    {
      fileName: `02_Sec_13_3_Substantial_Contributors_Schedule.csv`,
      content: sec133,
      mimeType: "text/csv",
    },
    {
      fileName: `03_Expense_and_Application_Register_FY.csv`,
      content: expenses,
      mimeType: "text/csv",
    },
    {
      fileName: `04_Budget_vs_Actuals_Variance_Report_FY.csv`,
      content: budget,
      mimeType: "text/csv",
    },
    {
      fileName: `05_Sec_11_85Pct_Application_Computation_Summary.csv`,
      content: sec11,
      mimeType: "text/csv",
    },
  ];
}
