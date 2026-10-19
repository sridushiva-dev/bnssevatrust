import { ExpenseScale, PaymentMethod } from "@prisma/client";

import { JournalLineInput } from "@/lib/accounting/engine";
import { toDecimal } from "@/lib/accounting/decimal";

export function resolvePaidFromLedgerCode(
  paymentMethod: PaymentMethod,
  scale: ExpenseScale,
): string {
  if (paymentMethod === PaymentMethod.CASH) {
    return scale === ExpenseScale.PETTY ? "2006" : "2005";
  }
  return "2001";
}

export function buildExpenseJournalLines(input: {
  expenseLedgerId: string;
  paidFromLedgerId: string;
  tdsPayableLedgerId: string;
  grossAmount: string;
  tdsAmount: string;
  netPaidAmount: string;
}): JournalLineInput[] {
  const gross = toDecimal(input.grossAmount);
  const tds = toDecimal(input.tdsAmount);
  const net = toDecimal(input.netPaidAmount);

  if (!gross.equals(net.plus(tds))) {
    throw new Error("Gross amount must equal net paid plus TDS");
  }

  const lines: JournalLineInput[] = [
    { ledgerId: input.expenseLedgerId, debit: gross.toFixed(2), credit: "0" },
    { ledgerId: input.paidFromLedgerId, debit: "0", credit: net.toFixed(2) },
  ];

  if (tds.gt(0)) {
    lines.push({
      ledgerId: input.tdsPayableLedgerId,
      debit: "0",
      credit: tds.toFixed(2),
    });
  }

  return lines;
}
