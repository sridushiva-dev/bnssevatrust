import {
  AccountType,
  PrismaClient,
  Role,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/** Canonical 24 ledgers from ACCOUNTING_AND_TAX_RULES.md §2 */
const CANONICAL_LEDGERS: Array<{
  code: string;
  name: string;
  tallyParentGroup: string;
  accountType: AccountType;
  isSec11_5Mode: boolean;
}> = [
  {
    code: "1001",
    name: "Corpus Fund - Sec 11(1)(d)",
    tallyParentGroup: "Capital Account",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "1002",
    name: "General Trust Fund / Surplus",
    tallyParentGroup: "Capital Account",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "1003",
    name: "Designated Fund - Annadhanam",
    tallyParentGroup: "Current Liabilities",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "1004",
    name: "Designated Fund - Temple Renovation",
    tallyParentGroup: "Current Liabilities",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "1005",
    name: "TDS Payable",
    tallyParentGroup: "Duties & Taxes",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "1006",
    name: "Uncleared Cheques in Hand (Contra)",
    tallyParentGroup: "Current Liabilities",
    accountType: AccountType.LIABILITY_FUND,
    isSec11_5Mode: false,
  },
  {
    code: "2001",
    name: "Primary Trust Bank Account (Savings/Current)",
    tallyParentGroup: "Bank Accounts",
    accountType: AccountType.ASSET,
    isSec11_5Mode: true,
  },
  {
    code: "2002",
    name: "Corpus Dedicated Bank Account",
    tallyParentGroup: "Bank Accounts",
    accountType: AccountType.ASSET,
    isSec11_5Mode: true,
  },
  {
    code: "2003",
    name: "Scheduled Bank Fixed Deposits - Sec 11(5)",
    tallyParentGroup: "Deposits (Asset)",
    accountType: AccountType.ASSET,
    isSec11_5Mode: true,
  },
  {
    code: "2004",
    name: "Razorpay Settlement Clearing Account",
    tallyParentGroup: "Current Assets",
    accountType: AccountType.ASSET,
    isSec11_5Mode: false,
  },
  {
    code: "2005",
    name: "Cash-in-Hand (Main Chest)",
    tallyParentGroup: "Cash-in-Hand",
    accountType: AccountType.ASSET,
    isSec11_5Mode: false,
  },
  {
    code: "2006",
    name: "Petty Cash Imprest",
    tallyParentGroup: "Cash-in-Hand",
    accountType: AccountType.ASSET,
    isSec11_5Mode: false,
  },
  {
    code: "2007",
    name: "Temple Building & Fixed Assets",
    tallyParentGroup: "Fixed Assets",
    accountType: AccountType.ASSET,
    isSec11_5Mode: false,
  },
  {
    code: "3001",
    name: "Voluntary Contributions - General",
    tallyParentGroup: "Direct Incomes",
    accountType: AccountType.INCOME,
    isSec11_5Mode: false,
  },
  {
    code: "3002",
    name: "Specific Pooja & Seva Receipts",
    tallyParentGroup: "Direct Incomes",
    accountType: AccountType.INCOME,
    isSec11_5Mode: false,
  },
  {
    code: "3003",
    name: "Annadhanam Contributions",
    tallyParentGroup: "Direct Incomes",
    accountType: AccountType.INCOME,
    isSec11_5Mode: false,
  },
  {
    code: "3004",
    name: "Subscription / Nithya Kainkaryam Receipts",
    tallyParentGroup: "Direct Incomes",
    accountType: AccountType.INCOME,
    isSec11_5Mode: false,
  },
  {
    code: "3005",
    name: "Bank & FD Interest Income",
    tallyParentGroup: "Indirect Incomes",
    accountType: AccountType.INCOME,
    isSec11_5Mode: false,
  },
  {
    code: "4001",
    name: "Nithya Pooja & Religious Samagri Expenses",
    tallyParentGroup: "Direct Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4002",
    name: "Annadhanam & Prasadam Distribution",
    tallyParentGroup: "Direct Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4003",
    name: "Utsavam & Festival Expenses",
    tallyParentGroup: "Direct Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4004",
    name: "Archakar & Temple Staff Sambhavana",
    tallyParentGroup: "Direct Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4005",
    name: "Temple Repair, Maintenance & Utilities",
    tallyParentGroup: "Indirect Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4006",
    name: "Audit, Legal & Accounting Fees",
    tallyParentGroup: "Indirect Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4007",
    name: "Razorpay & Bank Transaction Charges",
    tallyParentGroup: "Indirect Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
  {
    code: "4008",
    name: "Petty Office & Miscellaneous Expenses",
    tallyParentGroup: "Indirect Expenses",
    accountType: AccountType.EXPENSE,
    isSec11_5Mode: false,
  },
];

const FY_2026_27 = "2026-27";

/** Default FY 2026-27 budget heads mapped to expense ledgers (PRD Module 5 examples) */
const DEFAULT_BUDGETS: Array<{
  name: string;
  description: string;
  ledgerCode: string;
  allocatedAmount: string;
}> = [
  {
    name: "Nithya Pooja & Samagri",
    description: "Daily pooja, samagri, and religious materials",
    ledgerCode: "4001",
    allocatedAmount: "200000.00",
  },
  {
    name: "Annadhanam",
    description: "Annadhanam and prasadam distribution",
    ledgerCode: "4002",
    allocatedAmount: "500000.00",
  },
  {
    name: "Brahmotsavam & Festival",
    description: "Utsavam and festival expenses",
    ledgerCode: "4003",
    allocatedAmount: "300000.00",
  },
  {
    name: "Archakar & Staff Sambhavana",
    description: "Priest and temple staff honorarium",
    ledgerCode: "4004",
    allocatedAmount: "150000.00",
  },
  {
    name: "Temple Maintenance",
    description: "Repair, maintenance, and utilities",
    ledgerCode: "4005",
    allocatedAmount: "150000.00",
  },
  {
    name: "Audit & Legal",
    description: "Statutory audit and legal compliance",
    ledgerCode: "4006",
    allocatedAmount: "50000.00",
  },
  {
    name: "Gateway & Bank Charges",
    description: "Razorpay and bank transaction fees",
    ledgerCode: "4007",
    allocatedAmount: "25000.00",
  },
  {
    name: "Petty Office Expenses",
    description: "Office and miscellaneous petty cash",
    ledgerCode: "4008",
    allocatedAmount: "25000.00",
  },
];

async function main() {
  console.log("Seeding canonical chart of accounts and FY 2026-27 budgets...");

  const ledgerByCode: Record<string, string> = {};

  for (const ledger of CANONICAL_LEDGERS) {
    const row = await prisma.ledgerAccount.upsert({
      where: { code: ledger.code },
      update: {
        name: ledger.name,
        tallyParentGroup: ledger.tallyParentGroup,
        accountType: ledger.accountType,
        isSec11_5Mode: ledger.isSec11_5Mode,
      },
      create: {
        code: ledger.code,
        name: ledger.name,
        tallyParentGroup: ledger.tallyParentGroup,
        accountType: ledger.accountType,
        isSec11_5Mode: ledger.isSec11_5Mode,
        openingBalance: new Decimal(0),
      },
    });
    ledgerByCode[ledger.code] = row.id;
  }

  await prisma.user.upsert({
    where: { email: "admin.trustee@bnst.local" },
    update: {},
    create: {
      name: "Admin Trustee",
      email: "admin.trustee@bnst.local",
      phone: "+919000000001",
      role: Role.ADMIN_TRUSTEE,
    },
  });

  for (const budget of DEFAULT_BUDGETS) {
    const ledgerId = ledgerByCode[budget.ledgerCode];
    if (!ledgerId) {
      throw new Error(`Missing ledger for budget: ${budget.name}`);
    }

    const existingCategory = await prisma.budgetCategory.findFirst({
      where: { name: budget.name },
    });
    const category =
      existingCategory ??
      (await prisma.budgetCategory.create({
        data: {
          name: budget.name,
          description: budget.description,
          ledgerId,
        },
      }));
    if (existingCategory) {
      await prisma.budgetCategory.update({
        where: { id: existingCategory.id },
        data: { description: budget.description, ledgerId },
      });
    }

    await prisma.budgetAllocation.upsert({
      where: {
        financialYear_budgetCategoryId: {
          financialYear: FY_2026_27,
          budgetCategoryId: category.id,
        },
      },
      update: {
        allocatedAmount: new Decimal(budget.allocatedAmount),
      },
      create: {
        financialYear: FY_2026_27,
        budgetCategoryId: category.id,
        allocatedAmount: new Decimal(budget.allocatedAmount),
        alertThresholdPct: 80,
      },
    });
  }

  console.log(
    `Seed complete: ${CANONICAL_LEDGERS.length} ledgers, ${DEFAULT_BUDGETS.length} budget categories for ${FY_2026_27}.`,
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
