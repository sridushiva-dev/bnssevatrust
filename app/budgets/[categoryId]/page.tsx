import Link from "next/link";

import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { FySelector } from "@/components/accounting/fy-selector";
import { formatInr } from "@/lib/accounting/decimal";
import { getExpensesForBudgetCategory } from "@/lib/budgets/actuals";
import { getDefaultFinancialYear } from "@/lib/accounting/reports";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BudgetCategoryDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ fy?: string }>;
}) {
  const { categoryId } = await params;
  const sp = await searchParams;
  const financialYear = sp.fy ?? getDefaultFinancialYear();

  let dbReady = true;
  let categoryName = "";
  let expenses: Array<{
    voucherNumber: string;
    expenseDate: string;
    vendorName: string;
    amount: string;
    paymentMethod: string;
    isDisallowedSec11: boolean;
    attachmentCount: number;
  }> = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
    });
    categoryName = category?.name ?? "Category";
    const rows = await getExpensesForBudgetCategory(financialYear, categoryId);
    expenses = rows.map((e) => ({
      voucherNumber: e.voucherNumber,
      expenseDate: e.expenseDate.toISOString(),
      vendorName: e.vendorName,
      amount: e.amount.toString(),
      paymentMethod: e.paymentMethod,
      isDisallowedSec11: e.isDisallowedSec11,
      attachmentCount: e.attachments.length,
    }));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/budgets?fy=${financialYear}`} className="text-xs text-primary">
          ← Back to budgets
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{categoryName}</h1>
        <p className="text-sm text-muted-foreground">Expense vouchers — FY {financialYear}</p>
      </div>

      <FySelector
        financialYear={financialYear}
        basePath={`/budgets/${categoryId}`}
      />

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {expenses.length === 0 ? (
            <li className="p-4 text-muted-foreground">No realized expenses in this category.</li>
          ) : (
            expenses.map((e) => (
              <li key={e.voucherNumber} className="flex justify-between gap-2 p-3">
                <div>
                  <p className="font-mono text-xs">{e.voucherNumber}</p>
                  <p>{e.vendorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.expenseDate).toLocaleDateString("en-IN")} · {e.paymentMethod}
                    {e.attachmentCount > 0 ? ` · ${e.attachmentCount} attachment(s)` : ""}
                  </p>
                  {e.isDisallowedSec11 && (
                    <span className="text-[10px] text-amber-800">Sec 11 disallowed</span>
                  )}
                </div>
                <p className="font-medium tabular-nums">{formatInr(e.amount)}</p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
