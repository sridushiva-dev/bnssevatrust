import { Decimal } from "decimal.js";
import { Prisma } from "@prisma/client";

export type MoneyInput = Decimal | Prisma.Decimal | string | number;

const ZERO = new Decimal(0);

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (value instanceof Prisma.Decimal) {
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

export function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

export function assertBalanced(
  lines: Array<{ debit: Decimal; credit: Decimal }>,
): void {
  const totalDebit = sumDecimals(lines.map((l) => l.debit));
  const totalCredit = sumDecimals(lines.map((l) => l.credit));
  if (!totalDebit.equals(totalCredit)) {
    throw new Error(
      `Journal entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
    );
  }
  if (totalDebit.isZero()) {
    throw new Error("Journal entry must have a non-zero amount");
  }
}

export function formatInr(amount: MoneyInput): string {
  const d = toDecimal(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(d.toNumber());
}

export { ZERO as DECIMAL_ZERO };
