import Link from "next/link";

import { ManualVoucherModal } from "@/components/accounting/manual-voucher-modal";
import {
  BalanceSheetTable,
  IncomeExpenditureTable,
  ReceiptsPaymentsTable,
  TrialBalanceTable,
} from "@/components/accounting/report-tables";
import { Section11Meter } from "@/components/accounting/section-11-meter";
import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { FySelector } from "@/components/accounting/fy-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getBalanceSheet,
  getDefaultFinancialYear,
  getIncomeAndExpenditureAccount,
  getReceiptsAndPaymentsAccount,
  getSection11ComplianceMeter,
  getTrialBalance,
} from "@/lib/accounting/reports";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const REPORT_TABS = [
  { id: "tb", label: "Trial Balance" },
  { id: "rp", label: "Receipts & Payments" },
  { id: "ie", label: "Income & Expenditure" },
  { id: "bs", label: "Balance Sheet" },
] as const;

type ReportId = (typeof REPORT_TABS)[number]["id"];

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; report?: string }>;
}) {
  const params = await searchParams;
  const financialYear = params.fy ?? getDefaultFinancialYear();
  const report = (params.report as ReportId) ?? "tb";

  let dbReady = true;
  let section11: {
    financialYear: string;
    totalEligibleIncome: string;
    permissibleAccumulation: string;
    mandatoryApplicationTarget: string;
    eligibleApplication: string;
    applicationShortfall: string;
    applicationPercentage: string;
    isCompliant: boolean;
  } | null = null;
  let trialBalance: Awaited<ReturnType<typeof getTrialBalance>> | null = null;
  let rp: {
    receipts: Array<{ code: string; name: string; amount: string }>;
    payments: Array<{ code: string; name: string; amount: string }>;
    totalReceipts: string;
    totalPayments: string;
    closingCashBank: string;
  } | null = null;
  let ie: {
    incomeLines: Array<{ code: string; name: string; amount: string }>;
    expenseLines: Array<{ code: string; name: string; amount: string }>;
    totalIncome: string;
    totalExpenditure: string;
    surplusOrDeficit: string;
  } | null = null;
  let bs: {
    corpusFund: { title: string; lines: Array<{ code: string; name: string; amount: string }>; total: string };
    otherFundsAndLiabilities: { title: string; lines: Array<{ code: string; name: string; amount: string }>; total: string };
    sec11_5Investments: { title: string; lines: Array<{ code: string; name: string; amount: string }>; total: string };
    otherAssets: { title: string; lines: Array<{ code: string; name: string; amount: string }>; total: string };
    totalLiabilitiesAndFunds: string;
    totalAssets: string;
  } | null = null;
  let ledgers: Array<{ id: string; code: string; name: string }> = [];
  let ledgerByCode: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    const s11Raw = await getSection11ComplianceMeter(financialYear);
    section11 = {
      financialYear: s11Raw.financialYear,
      totalEligibleIncome: s11Raw.totalEligibleIncome.toString(),
      permissibleAccumulation: s11Raw.permissibleAccumulation.toString(),
      mandatoryApplicationTarget: s11Raw.mandatoryApplicationTarget.toString(),
      eligibleApplication: s11Raw.eligibleApplication.toString(),
      applicationShortfall: s11Raw.applicationShortfall.toString(),
      applicationPercentage: s11Raw.applicationPercentage.toString(),
      isCompliant: s11Raw.isCompliant,
    };
    trialBalance = await getTrialBalance(financialYear);
    const rpRaw = await getReceiptsAndPaymentsAccount(financialYear);
    rp = {
      receipts: rpRaw.receipts.map((r) => ({ ...r, amount: r.amount.toString() })),
      payments: rpRaw.payments.map((p) => ({ ...p, amount: p.amount.toString() })),
      totalReceipts: rpRaw.totalReceipts.toString(),
      totalPayments: rpRaw.totalPayments.toString(),
      closingCashBank: rpRaw.closingCashBank.toString(),
    };
    const ieRaw = await getIncomeAndExpenditureAccount(financialYear);
    ie = {
      incomeLines: ieRaw.incomeLines.map((l) => ({ ...l, amount: l.amount.toString() })),
      expenseLines: ieRaw.expenseLines.map((l) => ({ ...l, amount: l.amount.toString() })),
      totalIncome: ieRaw.totalIncome.toString(),
      totalExpenditure: ieRaw.totalExpenditure.toString(),
      surplusOrDeficit: ieRaw.surplusOrDeficit.toString(),
    };
    const bsRaw = await getBalanceSheet(financialYear);
    const mapSection = (section: typeof bsRaw.corpusFund) => ({
      title: section.title,
      total: section.total.toString(),
      lines: section.lines.map((l) => ({ ...l, amount: l.amount.toString() })),
    });
    bs = {
      corpusFund: mapSection(bsRaw.corpusFund),
      otherFundsAndLiabilities: mapSection(bsRaw.otherFundsAndLiabilities),
      sec11_5Investments: mapSection(bsRaw.sec11_5Investments),
      otherAssets: mapSection(bsRaw.otherAssets),
      totalLiabilitiesAndFunds: bsRaw.totalLiabilitiesAndFunds.toString(),
      totalAssets: bsRaw.totalAssets.toString(),
    };
    ledgers = await prisma.ledgerAccount.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
    ledgerByCode = Object.fromEntries(ledgers.map((l) => [l.code, l.id]));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financial Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Double-entry FAS, statutory reports, and Tally-style ledger drill-down.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/accounting/ledgers?fy=${financialYear}`}>Ledger drill-down</Link>
          </Button>
          {dbReady && (
            <ManualVoucherModal ledgers={ledgers} ledgerByCode={ledgerByCode} />
          )}
        </div>
      </div>

      <FySelector financialYear={financialYear} basePath="/accounting" extraQuery={{ report }} />

      {!dbReady || !section11 ? (
        <DbSetupNotice />
      ) : (
        <>
          <Section11Meter report={section11} />

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Financial statements</CardTitle>
              <div className="flex flex-wrap gap-1">
                {REPORT_TABS.map((tab) => (
                  <Link
                    key={tab.id}
                    href={`/accounting?fy=${financialYear}&report=${tab.id}`}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium",
                      report === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {report === "tb" && trialBalance && (
                <TrialBalanceTable
                  rows={trialBalance.rows.map((row) => ({
                    ledgerId: row.ledgerId,
                    code: row.code,
                    name: row.name,
                    tallyParentGroup: row.tallyParentGroup,
                    debit: String(row.debit),
                    credit: String(row.credit),
                  }))}
                  totalDebit={String(trialBalance.totalDebit)}
                  totalCredit={String(trialBalance.totalCredit)}
                />
              )}
              {report === "rp" && rp && <ReceiptsPaymentsTable report={rp} />}
              {report === "ie" && ie && <IncomeExpenditureTable report={ie} />}
              {report === "bs" && bs && <BalanceSheetTable report={bs} />}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
