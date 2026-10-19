import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { FySelector } from "@/components/accounting/fy-selector";
import { BudgetAllocationForm } from "@/components/budgets/budget-allocation-form";
import {
  BudgetDashboard,
  type BudgetRowView,
} from "@/components/budgets/budget-dashboard";
import { getDefaultFinancialYear } from "@/lib/accounting/reports";
import { getBudgetActualsForYear } from "@/lib/budgets/actuals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const params = await searchParams;
  const financialYear = params.fy ?? getDefaultFinancialYear();

  let dbReady = true;
  let rows: BudgetRowView[] = [];
  let allocationCategories: Array<{ id: string; name: string; allocatedAmount: string }> =
    [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    const actuals = await getBudgetActualsForYear(financialYear);
    rows = actuals.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      ledgerName: r.ledgerName,
      allocatedAmount: r.allocatedAmount.toFixed(2),
      actualSpend: r.actualSpend.toFixed(2),
      remaining: r.remaining.toFixed(2),
      utilizationPct: r.utilizationPct.toFixed(1),
      status: r.status,
    }));
    allocationCategories = actuals.map((r) => ({
      id: r.categoryId,
      name: r.categoryName,
      allocatedAmount: r.allocatedAmount.toFixed(2),
    }));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Budget vs actuals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time burn by category — tap a row to see underlying payment vouchers.
        </p>
      </div>

      <FySelector financialYear={financialYear} basePath="/budgets" />

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <>
          <BudgetDashboard financialYear={financialYear} rows={rows} />
          <BudgetAllocationForm
            financialYear={financialYear}
            categories={allocationCategories}
          />
        </>
      )}
    </div>
  );
}
