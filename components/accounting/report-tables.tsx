import { formatInr } from "@/lib/accounting/decimal";
type MoneyLine = { code: string; name: string; amount: string };

type ReceiptsPaymentsView = {
  receipts: MoneyLine[];
  payments: MoneyLine[];
  totalReceipts: string;
  totalPayments: string;
  closingCashBank: string;
};

type IncomeExpenditureView = {
  incomeLines: MoneyLine[];
  expenseLines: MoneyLine[];
  totalIncome: string;
  totalExpenditure: string;
  surplusOrDeficit: string;
};

type BalanceSheetSectionView = {
  title: string;
  lines: MoneyLine[];
  total: string;
};

type BalanceSheetView = {
  corpusFund: BalanceSheetSectionView;
  otherFundsAndLiabilities: BalanceSheetSectionView;
  sec11_5Investments: BalanceSheetSectionView;
  otherAssets: BalanceSheetSectionView;
  totalLiabilitiesAndFunds: string;
  totalAssets: string;
};

type TrialBalanceRowView = {
  ledgerId: string;
  code: string;
  name: string;
  tallyParentGroup: string;
  debit: string;
  credit: string;
};

function Money({ value }: { value: string }) {
  return <span className="tabular-nums">{formatInr(value)}</span>;
}

export function TrialBalanceTable({
  rows,
  totalDebit,
  totalCredit,
}: {
  rows: TrialBalanceRowView[];
  totalDebit: string;
  totalCredit: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Ledger</th>
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ledgerId} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2 text-right">
                {row.debit !== "0" ? <Money value={row.debit} /> : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {row.credit !== "0" ? <Money value={row.credit} /> : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-muted/40 font-semibold">
            <td className="px-3 py-2" colSpan={2}>Total</td>
            <td className="px-3 py-2 text-right"><Money value={totalDebit} /></td>
            <td className="px-3 py-2 text-right"><Money value={totalCredit} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ReceiptsPaymentsTable({ report }: { report: ReceiptsPaymentsView }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReportColumn title="Receipts (Cash/Bank In)" lines={report.receipts} total={report.totalReceipts} />
      <ReportColumn title="Payments (Cash/Bank Out)" lines={report.payments} total={report.totalPayments} />
      <p className="md:col-span-2 text-sm text-muted-foreground">
        Net closing cash & bank balance (FY):{" "}
        <span className="font-medium text-foreground">
          <Money value={report.closingCashBank} />
        </span>
      </p>
    </div>
  );
}

function ReportColumn({
  title,
  lines,
  total,
}: {
  title: string;
  lines: Array<{ code: string; name: string; amount: string }>;
  total: string;
}) {
  return (
    <div className="rounded-lg border border-border">
      <h4 className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-semibold">{title}</h4>
      <ul className="divide-y divide-border text-sm">
        {lines.length === 0 ? (
          <li className="px-3 py-4 text-muted-foreground">No movements</li>
        ) : (
          lines.map((line) => (
            <li key={line.code} className="flex justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-muted-foreground">{line.code}</span>{" "}
                {line.name}
              </span>
              <Money value={line.amount} />
            </li>
          ))
        )}
      </ul>
      <div className="flex justify-between border-t border-border px-3 py-2 text-sm font-semibold">
        <span>Total</span>
        <Money value={total} />
      </div>
    </div>
  );
}

export function IncomeExpenditureTable({ report }: { report: IncomeExpenditureView }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ReportColumn
          title="Income"
          lines={report.incomeLines}
          total={report.totalIncome}
        />
        <ReportColumn
          title="Application (Expenses)"
          lines={report.expenseLines}
          total={report.totalExpenditure}
        />
      </div>
      <p className="text-sm">
        Surplus / (Deficit):{" "}
        <span className="font-semibold">
          <Money value={report.surplusOrDeficit} />
        </span>
      </p>
    </div>
  );
}

export function BalanceSheetTable({ report }: { report: BalanceSheetView }) {
  const sections = [
    report.corpusFund,
    report.otherFundsAndLiabilities,
    report.sec11_5Investments,
    report.otherAssets,
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="rounded-lg border border-border">
          <h4 className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-semibold">
            {section.title}
          </h4>
          <ul className="divide-y divide-border text-sm">
            {section.lines.length === 0 ? (
              <li className="px-3 py-4 text-muted-foreground">—</li>
            ) : (
              section.lines.map((line) => (
                <li key={line.code} className="flex justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-muted-foreground">{line.code}</span>{" "}
                    {line.name}
                  </span>
                  <Money value={line.amount} />
                </li>
              ))
            )}
          </ul>
          <div className="flex justify-between border-t border-border px-3 py-2 text-sm font-semibold">
            <span>Section total</span>
            <Money value={section.total} />
          </div>
        </div>
      ))}
      <div className="lg:col-span-2 flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 text-sm sm:flex-row sm:justify-between">
        <span>
          Total funds & liabilities:{" "}
          <strong><Money value={report.totalLiabilitiesAndFunds} /></strong>
        </span>
        <span>
          Total assets: <strong><Money value={report.totalAssets} /></strong>
        </span>
      </div>
    </div>
  );
}
