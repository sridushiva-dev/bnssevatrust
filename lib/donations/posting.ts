import { FundType, PaymentMethod } from "@prisma/client";

import { LEDGER_CORPUS_FUND } from "@/lib/accounting/constants";
import { JournalLineInput } from "@/lib/accounting/engine";

export type DonationPostingContext = {
  fundType: FundType;
  paymentMethod: PaymentMethod;
  amount: string;
  isSubscriptionCharge?: boolean;
  chequeCleared?: boolean;
};

/** Returns ledger codes for debit (asset) and credit (income/fund). */
export function resolveDonationLedgerCodes(ctx: DonationPostingContext): {
  debitCode: string;
  creditCode: string;
} {
  const { fundType, paymentMethod, isSubscriptionCharge } = ctx;

  if (fundType === FundType.CORPUS_11_1_D) {
    const debitCode =
      paymentMethod === PaymentMethod.CHEQUE
        ? "2002"
        : paymentMethod === PaymentMethod.CASH
          ? "2005"
          : paymentMethod === PaymentMethod.UPI_QR || paymentMethod === PaymentMethod.SUBSCRIPTION
            ? "2004"
            : "2002";
    return { debitCode, creditCode: LEDGER_CORPUS_FUND };
  }

  let creditCode = "3001";
  if (fundType === FundType.DESIGNATED_PURPOSE) {
    creditCode = "3002";
  }
  if (isSubscriptionCharge || paymentMethod === PaymentMethod.SUBSCRIPTION) {
    creditCode = "3004";
  }

  let debitCode = "2005";
  if (paymentMethod === PaymentMethod.CASH) {
    debitCode = "2005";
  } else if (paymentMethod === PaymentMethod.CHEQUE) {
    debitCode = "2001";
  } else if (
    paymentMethod === PaymentMethod.UPI_QR ||
    paymentMethod === PaymentMethod.SUBSCRIPTION
  ) {
    debitCode = "2004";
  } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
    debitCode = "2001";
  }

  return { debitCode, creditCode };
}

export function buildDonationJournalLines(
  ledgerIds: Map<string, string>,
  ctx: DonationPostingContext,
): JournalLineInput[] {
  const { debitCode, creditCode } = resolveDonationLedgerCodes(ctx);
  const debitId = ledgerIds.get(debitCode);
  const creditId = ledgerIds.get(creditCode);
  if (!debitId || !creditId) {
    throw new Error("Missing ledger accounts for donation posting");
  }
  const amount = ctx.amount;
  return [
    { ledgerId: debitId, debit: amount, credit: "0" },
    { ledgerId: creditId, debit: "0", credit: amount },
  ];
}
