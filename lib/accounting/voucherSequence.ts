import { Prisma, VoucherType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type VoucherNumberPrefix = "RCPT" | "PAY" | "CNT" | "JRN";

const VOUCHER_PREFIX_BY_TYPE: Record<VoucherType, VoucherNumberPrefix> = {
  RECEIPT: "RCPT",
  PAYMENT: "PAY",
  CONTRA: "CNT",
  JOURNAL: "JRN",
};

export function getVoucherPrefix(voucherType: VoucherType): VoucherNumberPrefix {
  return VOUCHER_PREFIX_BY_TYPE[voucherType];
}

export function formatVoucherNumber(
  prefix: VoucherNumberPrefix,
  financialYear: string,
  sequence: number,
): string {
  const padded = String(sequence).padStart(4, "0");
  return `${prefix}-${financialYear}-${padded}`;
}

type PrismaTx = Prisma.TransactionClient;

/**
 * Atomically increments and returns the next voucher number for a FY + voucher type.
 * Uses Serializable isolation and a dedicated counter row to prevent race conditions.
 */
export async function generateNextVoucherNumber(
  financialYear: string,
  voucherType: VoucherType,
  tx?: PrismaTx,
): Promise<string> {
  const run = async (client: PrismaTx) => {
    const counter = await client.voucherSequence.upsert({
      where: {
        financialYear_voucherType: { financialYear, voucherType },
      },
      create: { financialYear, voucherType, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });

    return formatVoucherNumber(
      getVoucherPrefix(voucherType),
      financialYear,
      counter.lastSequence,
    );
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction((innerTx) => run(innerTx), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
