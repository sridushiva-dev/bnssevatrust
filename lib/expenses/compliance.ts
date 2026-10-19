import { PaymentMethod, TransactionStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

import { toDecimal } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

export const SEC_11_CASH_DAILY_VENDOR_LIMIT = new Decimal(10000);

export const SEC_11_DISALLOWANCE_REASON =
  "Cash payment to single party exceeds ₹10,000/day limit under Sec 11 r.w.s 40A(3)";

export async function getVendorCashTotalForDay(
  vendorName: string,
  vendorPan: string | null | undefined,
  expenseDate: Date,
): Promise<Decimal> {
  const dayStart = new Date(expenseDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(expenseDate);
  dayEnd.setHours(23, 59, 59, 999);

  const vendorFilter = vendorPan
    ? { OR: [{ vendorName }, { vendorPan }] }
    : { vendorName };

  const agg = await prisma.expense.aggregate({
    where: {
      ...vendorFilter,
      paymentMethod: PaymentMethod.CASH,
      status: TransactionStatus.REALIZED,
      expenseDate: { gte: dayStart, lte: dayEnd },
    },
    _sum: { amount: true },
  });

  return toDecimal(agg._sum.amount ?? 0);
}

export type CashGuardrailResult = {
  exceedsLimit: boolean;
  existingDayCash: Decimal;
  projectedTotal: Decimal;
  reason: string | null;
};

export async function evaluateCashExpenseGuardrail(input: {
  vendorName: string;
  vendorPan?: string | null;
  expenseDate: Date;
  grossAmount: string;
  paymentMethod: PaymentMethod;
}): Promise<CashGuardrailResult> {
  if (input.paymentMethod !== PaymentMethod.CASH) {
    return {
      exceedsLimit: false,
      existingDayCash: new Decimal(0),
      projectedTotal: new Decimal(0),
      reason: null,
    };
  }

  const gross = toDecimal(input.grossAmount);
  const existingDayCash = await getVendorCashTotalForDay(
    input.vendorName,
    input.vendorPan,
    input.expenseDate,
  );
  const projectedTotal = existingDayCash.plus(gross);
  const exceedsLimit = projectedTotal.gt(SEC_11_CASH_DAILY_VENDOR_LIMIT);

  return {
    exceedsLimit,
    existingDayCash,
    projectedTotal,
    reason: exceedsLimit ? SEC_11_DISALLOWANCE_REASON : null,
  };
}
