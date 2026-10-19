import { TransactionStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

import { toDecimal } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

export type BudgetUtilizationStatus = "HEALTHY" | "WARNING" | "OVER_BUDGET";

export function getUtilizationStatus(
  utilizationPct: Decimal,
  alertThresholdPct: number,
): BudgetUtilizationStatus {
  if (utilizationPct.gt(100)) return "OVER_BUDGET";
  if (utilizationPct.gte(alertThresholdPct)) return "WARNING";
  return "HEALTHY";
}

export type BudgetCategoryActualRow = {
  categoryId: string;
  categoryName: string;
  ledgerName: string;
  financialYear: string;
  allocatedAmount: Decimal;
  actualSpend: Decimal;
  remaining: Decimal;
  utilizationPct: Decimal;
  status: BudgetUtilizationStatus;
  alertThresholdPct: number;
};

export async function getBudgetActualsForYear(
  financialYear: string,
): Promise<BudgetCategoryActualRow[]> {
  const categories = await prisma.budgetCategory.findMany({
    include: {
      ledger: true,
      allocations: { where: { financialYear } },
    },
    orderBy: { name: "asc" },
  });

  const rows: BudgetCategoryActualRow[] = [];

  for (const category of categories) {
    const allocation = category.allocations[0];
    const allocatedAmount = toDecimal(allocation?.allocatedAmount ?? 0);
    const alertThresholdPct = allocation?.alertThresholdPct ?? 80;

    const agg = await prisma.expense.aggregate({
      where: {
        budgetCategoryId: category.id,
        financialYear,
        status: TransactionStatus.REALIZED,
      },
      _sum: { amount: true },
    });
    const actualSpend = toDecimal(agg._sum.amount ?? 0);
    const remaining = allocatedAmount.minus(actualSpend);
    const utilizationPct = allocatedAmount.isZero()
      ? new Decimal(0)
      : actualSpend.div(allocatedAmount).times(100);

    rows.push({
      categoryId: category.id,
      categoryName: category.name,
      ledgerName: category.ledger.name,
      financialYear,
      allocatedAmount,
      actualSpend,
      remaining,
      utilizationPct,
      status: getUtilizationStatus(utilizationPct, alertThresholdPct),
      alertThresholdPct,
    });
  }

  return rows;
}

export async function getExpensesForBudgetCategory(
  financialYear: string,
  budgetCategoryId: string,
) {
  return prisma.expense.findMany({
    where: { financialYear, budgetCategoryId, status: TransactionStatus.REALIZED },
    orderBy: { expenseDate: "desc" },
    include: { attachments: true },
  });
}
