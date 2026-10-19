import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function generateDonorCode(
  tx: Prisma.TransactionClient = prisma,
  year = new Date().getFullYear(),
): Promise<string> {
  const prefix = `DNR-${year}-`;
  const latest = await tx.donor.findFirst({
    where: { donorCode: { startsWith: prefix } },
    orderBy: { donorCode: "desc" },
  });
  if (!latest) {
    return `${prefix}0001`;
  }
  const seq = Number.parseInt(latest.donorCode.slice(-4), 10) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
