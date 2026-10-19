import { PrismaClient } from "@prisma/client";

import { runDatabaseSeed } from "../lib/db/run-seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding canonical chart of accounts and FY 2026-27 budgets...");
  const result = await runDatabaseSeed();
  console.log(
    `Seed complete: ${result.ledgerCount} ledgers, ${result.budgetCategoryCount} budget categories for ${result.financialYear}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
