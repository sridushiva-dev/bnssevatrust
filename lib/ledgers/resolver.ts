import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function getLedgerIdMap(client: Tx | typeof prisma = prisma) {
  const rows = await client.ledgerAccount.findMany({
    select: { id: true, code: true },
  });
  return new Map(rows.map((r) => [r.code, r.id]));
}

export function requireLedgerId(map: Map<string, string>, code: string): string {
  const id = map.get(code);
  if (!id) {
    throw new Error(`Ledger code ${code} is not configured. Run db:seed.`);
  }
  return id;
}
