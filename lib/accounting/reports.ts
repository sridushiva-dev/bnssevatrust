import { AccountType, Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma";
import { parseFinancialYearLabel } from "@/lib/utils/financialYear";

import {
  CASH_BANK_LEDGER_CODES,
  EXPENSE_LEDGER_CODES,
  INCOME_LEDGER_CODES,
  LEDGER_CORPUS_FUND,
  SEC_11_5_INVESTMENT_LEDGER_CODES,
} from "./constants";
import { toDecimal } from "./decimal";

type LedgerMovement = {
  ledgerId: string;
  code: string;
  name: string;
  tallyParentGroup: string;
  accountType: AccountType;
  isSec11_5Mode: boolean;
  openingBalance: Decimal;
  periodDebit: Decimal;
  periodCredit: Decimal;
};

async function loadLedgerMovements(financialYear: string): Promise<LedgerMovement[]> {
  const ledgers = await prisma.ledgerAccount.findMany({
    orderBy: { code: "asc" },
  });

  const aggregates = await prisma.journalLine.groupBy({
    by: ["ledgerId"],
    where: { journalEntry: { financialYear } },
    _sum: { debit: true, credit: true },
  });

  const sumByLedger = new Map(
    aggregates.map((row) => [
      row.ledgerId,
      {
        debit: toDecimal(row._sum.debit ?? 0),
        credit: toDecimal(row._sum.credit ?? 0),
      },
    ]),
  );

  return ledgers.map((ledger) => {
    const sums = sumByLedger.get(ledger.id) ?? {
      debit: new Decimal(0),
      credit: new Decimal(0),
    };
    return {
      ledgerId: ledger.id,
      code: ledger.code,
      name: ledger.name,
      tallyParentGroup: ledger.tallyParentGroup,
      accountType: ledger.accountType,
      isSec11_5Mode: ledger.isSec11_5Mode,
      openingBalance: toDecimal(ledger.openingBalance),
      periodDebit: sums.debit,
      periodCredit: sums.credit,
    };
  });
}

/** Net balance in natural sign (positive = debit balance for assets/expenses). */
export function getNaturalBalance(movement: LedgerMovement): Decimal {
  if (
    movement.accountType === AccountType.ASSET ||
    movement.accountType === AccountType.EXPENSE
  ) {
    return movement.openingBalance
      .plus(movement.periodDebit)
      .minus(movement.periodCredit);
  }
  return movement.openingBalance
    .plus(movement.periodCredit)
    .minus(movement.periodDebit);
}

export type TrialBalanceRow = {
  ledgerId: string;
  code: string;
  name: string;
  tallyParentGroup: string;
  debit: Decimal;
  credit: Decimal;
};

export async function getTrialBalance(
  financialYear: string,
): Promise<{ rows: TrialBalanceRow[]; totalDebit: Decimal; totalCredit: Decimal }> {
  const movements = await loadLedgerMovements(financialYear);
  const rows: TrialBalanceRow[] = [];
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const m of movements) {
    const natural = getNaturalBalance(m);
    if (natural.isZero()) continue;

    if (natural.gt(0)) {
      rows.push({
        ledgerId: m.ledgerId,
        code: m.code,
        name: m.name,
        tallyParentGroup: m.tallyParentGroup,
        debit: natural,
        credit: new Decimal(0),
      });
      totalDebit = totalDebit.plus(natural);
    } else {
      const credit = natural.abs();
      rows.push({
        ledgerId: m.ledgerId,
        code: m.code,
        name: m.name,
        tallyParentGroup: m.tallyParentGroup,
        debit: new Decimal(0),
        credit,
      });
      totalCredit = totalCredit.plus(credit);
    }
  }

  return { rows, totalDebit, totalCredit };
}

export type ReceiptsPaymentsReport = {
  receipts: Array<{ code: string; name: string; amount: Decimal }>;
  payments: Array<{ code: string; name: string; amount: Decimal }>;
  totalReceipts: Decimal;
  totalPayments: Decimal;
  closingCashBank: Decimal;
};

export async function getReceiptsAndPaymentsAccount(
  financialYear: string,
): Promise<ReceiptsPaymentsReport> {
  const movements = await loadLedgerMovements(financialYear);
  const cashBank = movements.filter((m) =>
    (CASH_BANK_LEDGER_CODES as readonly string[]).includes(m.code),
  );

  const receipts: ReceiptsPaymentsReport["receipts"] = [];
  const payments: ReceiptsPaymentsReport["payments"] = [];
  let totalReceipts = new Decimal(0);
  let totalPayments = new Decimal(0);
  let closingCashBank = new Decimal(0);

  for (const m of cashBank) {
    if (m.periodDebit.gt(0)) {
      receipts.push({ code: m.code, name: m.name, amount: m.periodDebit });
      totalReceipts = totalReceipts.plus(m.periodDebit);
    }
    if (m.periodCredit.gt(0)) {
      payments.push({ code: m.code, name: m.name, amount: m.periodCredit });
      totalPayments = totalPayments.plus(m.periodCredit);
    }
    closingCashBank = closingCashBank.plus(getNaturalBalance(m));
  }

  return { receipts, payments, totalReceipts, totalPayments, closingCashBank };
}

export type IncomeExpenditureReport = {
  incomeLines: Array<{ code: string; name: string; amount: Decimal }>;
  expenseLines: Array<{ code: string; name: string; amount: Decimal }>;
  totalIncome: Decimal;
  totalExpenditure: Decimal;
  surplusOrDeficit: Decimal;
};

export async function getIncomeAndExpenditureAccount(
  financialYear: string,
): Promise<IncomeExpenditureReport> {
  const movements = await loadLedgerMovements(financialYear);

  const incomeLines: IncomeExpenditureReport["incomeLines"] = [];
  const expenseLines: IncomeExpenditureReport["expenseLines"] = [];
  let totalIncome = new Decimal(0);
  let totalExpenditure = new Decimal(0);

  for (const m of movements) {
    if (m.accountType === AccountType.INCOME) {
      const amount = m.periodCredit.minus(m.periodDebit);
      if (!amount.isZero()) {
        incomeLines.push({ code: m.code, name: m.name, amount });
        totalIncome = totalIncome.plus(amount);
      }
    }
    if (m.accountType === AccountType.EXPENSE) {
      const amount = m.periodDebit.minus(m.periodCredit);
      if (!amount.isZero()) {
        expenseLines.push({ code: m.code, name: m.name, amount });
        totalExpenditure = totalExpenditure.plus(amount);
      }
    }
  }

  return {
    incomeLines,
    expenseLines,
    totalIncome,
    totalExpenditure,
    surplusOrDeficit: totalIncome.minus(totalExpenditure),
  };
}

export type BalanceSheetSection = {
  title: string;
  lines: Array<{ code: string; name: string; amount: Decimal }>;
  total: Decimal;
};

export type BalanceSheetReport = {
  corpusFund: BalanceSheetSection;
  otherFundsAndLiabilities: BalanceSheetSection;
  sec11_5Investments: BalanceSheetSection;
  otherAssets: BalanceSheetSection;
  totalLiabilitiesAndFunds: Decimal;
  totalAssets: Decimal;
};

export async function getBalanceSheet(
  financialYear: string,
): Promise<BalanceSheetReport> {
  const movements = await loadLedgerMovements(financialYear);

  const corpusLines: BalanceSheetSection["lines"] = [];
  const otherFundLines: BalanceSheetSection["lines"] = [];
  const sec11Lines: BalanceSheetSection["lines"] = [];
  const otherAssetLines: BalanceSheetSection["lines"] = [];

  let corpusTotal = new Decimal(0);
  let otherFundsTotal = new Decimal(0);
  let sec11Total = new Decimal(0);
  let otherAssetsTotal = new Decimal(0);

  for (const m of movements) {
    const balance = getNaturalBalance(m);
    if (balance.isZero()) continue;

    if (m.accountType === AccountType.LIABILITY_FUND) {
      const amount = balance.abs();
      if (m.code === LEDGER_CORPUS_FUND) {
        corpusLines.push({ code: m.code, name: m.name, amount });
        corpusTotal = corpusTotal.plus(amount);
      } else {
        otherFundLines.push({ code: m.code, name: m.name, amount });
        otherFundsTotal = otherFundsTotal.plus(amount);
      }
      continue;
    }

    if (m.accountType === AccountType.ASSET) {
      const amount = balance;
      if ((SEC_11_5_INVESTMENT_LEDGER_CODES as readonly string[]).includes(m.code)) {
        sec11Lines.push({ code: m.code, name: m.name, amount });
        sec11Total = sec11Total.plus(amount);
      } else {
        otherAssetLines.push({ code: m.code, name: m.name, amount });
        otherAssetsTotal = otherAssetsTotal.plus(amount);
      }
    }
  }

  const totalLiabilitiesAndFunds = corpusTotal.plus(otherFundsTotal);
  const totalAssets = sec11Total.plus(otherAssetsTotal);

  return {
    corpusFund: { title: "Corpus Fund - Sec 11(1)(d)", lines: corpusLines, total: corpusTotal },
    otherFundsAndLiabilities: {
      title: "Other Funds & Liabilities",
      lines: otherFundLines,
      total: otherFundsTotal,
    },
    sec11_5Investments: {
      title: "Section 11(5) Approved Investments",
      lines: sec11Lines,
      total: sec11Total,
    },
    otherAssets: { title: "Other Assets", lines: otherAssetLines, total: otherAssetsTotal },
    totalLiabilitiesAndFunds,
    totalAssets,
  };
}

export type Section11ComplianceReport = {
  financialYear: string;
  totalEligibleIncome: Decimal;
  permissibleAccumulation: Decimal;
  mandatoryApplicationTarget: Decimal;
  eligibleApplication: Decimal;
  applicationShortfall: Decimal;
  applicationPercentage: Decimal;
  isCompliant: boolean;
  corpusOutflows: Decimal;
};

export async function getSection11ComplianceMeter(
  financialYear: string,
): Promise<Section11ComplianceReport> {
  const movements = await loadLedgerMovements(financialYear);

  let totalEligibleIncome = new Decimal(0);
  for (const m of movements) {
    if ((INCOME_LEDGER_CODES as readonly string[]).includes(m.code)) {
      totalEligibleIncome = totalEligibleIncome.plus(
        m.periodCredit.minus(m.periodDebit),
      );
    }
  }

  const entries = await prisma.journalEntry.findMany({
    where: { financialYear },
    include: {
      lines: { include: { ledger: true } },
      expense: true,
    },
  });

  let eligibleApplication = new Decimal(0);
  let corpusOutflows = new Decimal(0);

  for (const entry of entries) {
    for (const line of entry.lines) {
      const code = line.ledger.code;
      if ((EXPENSE_LEDGER_CODES as readonly string[]).includes(code)) {
        const applied = toDecimal(line.debit).minus(toDecimal(line.credit));
        if (applied.lte(0)) continue;

        const disallowed = entry.expense?.isDisallowedSec11 === true;
        if (!disallowed) {
          eligibleApplication = eligibleApplication.plus(applied);
        }
      }
      if (code === LEDGER_CORPUS_FUND) {
        const credit = toDecimal(line.credit).minus(toDecimal(line.debit));
        if (credit.gt(0)) {
          corpusOutflows = corpusOutflows.plus(credit);
        }
      }
    }
  }

  eligibleApplication = eligibleApplication.minus(corpusOutflows);
  if (eligibleApplication.isNegative()) {
    eligibleApplication = new Decimal(0);
  }

  const mandatoryApplicationTarget = totalEligibleIncome.times(0.85);
  const permissibleAccumulation = totalEligibleIncome.times(0.15);
  const applicationShortfall = Decimal.max(
    mandatoryApplicationTarget.minus(eligibleApplication),
    0,
  );

  const applicationPercentage = totalEligibleIncome.isZero()
    ? new Decimal(0)
    : eligibleApplication.div(totalEligibleIncome).times(100);

  return {
    financialYear,
    totalEligibleIncome,
    permissibleAccumulation,
    mandatoryApplicationTarget,
    eligibleApplication,
    applicationShortfall,
    applicationPercentage,
    isCompliant: applicationShortfall.isZero() || totalEligibleIncome.isZero(),
    corpusOutflows,
  };
}

export type LedgerGroupSummary = {
  tallyParentGroup: string;
  ledgerCount: number;
  totalDebit: Decimal;
  totalCredit: Decimal;
};

export async function getLedgerGroups(
  financialYear: string,
): Promise<LedgerGroupSummary[]> {
  const movements = await loadLedgerMovements(financialYear);
  const map = new Map<string, LedgerGroupSummary>();

  for (const m of movements) {
    const existing = map.get(m.tallyParentGroup) ?? {
      tallyParentGroup: m.tallyParentGroup,
      ledgerCount: 0,
      totalDebit: new Decimal(0),
      totalCredit: new Decimal(0),
    };
    existing.ledgerCount += 1;
    existing.totalDebit = existing.totalDebit.plus(m.periodDebit);
    existing.totalCredit = existing.totalCredit.plus(m.periodCredit);
    map.set(m.tallyParentGroup, existing);
  }

  return [...map.values()].sort((a, b) =>
    a.tallyParentGroup.localeCompare(b.tallyParentGroup),
  );
}

export type LedgerInGroupRow = {
  ledgerId: string;
  code: string;
  name: string;
  periodDebit: Decimal;
  periodCredit: Decimal;
  balance: Decimal;
};

export async function getLedgersInGroup(
  financialYear: string,
  tallyParentGroup: string,
): Promise<LedgerInGroupRow[]> {
  const movements = await loadLedgerMovements(financialYear);
  return movements
    .filter((m) => m.tallyParentGroup === tallyParentGroup)
    .map((m) => ({
      ledgerId: m.ledgerId,
      code: m.code,
      name: m.name,
      periodDebit: m.periodDebit,
      periodCredit: m.periodCredit,
      balance: getNaturalBalance(m),
    }));
}

export type LedgerVoucherRow = {
  journalEntryId: string;
  voucherNumber: string;
  voucherType: string;
  entryDate: Date;
  narration: string;
  debit: Decimal;
  credit: Decimal;
  isReversal: boolean;
};

export async function getLedgerVouchers(
  financialYear: string,
  ledgerId: string,
): Promise<LedgerVoucherRow[]> {
  const lines = await prisma.journalLine.findMany({
    where: {
      ledgerId,
      journalEntry: { financialYear },
    },
    include: { journalEntry: true },
    orderBy: { journalEntry: { entryDate: "asc" } },
  });

  return lines.map((line) => ({
    journalEntryId: line.journalEntryId,
    voucherNumber: line.journalEntry.voucherNumber,
    voucherType: line.journalEntry.voucherType,
    entryDate: line.journalEntry.entryDate,
    narration: line.journalEntry.narration,
    debit: toDecimal(line.debit),
    credit: toDecimal(line.credit),
    isReversal: line.journalEntry.isReversal,
  }));
}

export function serializeReport<T>(report: T): T {
  return JSON.parse(
    JSON.stringify(report, (_key, value) => {
      if (value instanceof Prisma.Decimal) {
        return value.toString();
      }
      if (value instanceof Decimal) {
        return value.toString();
      }
      return value;
    }),
  ) as T;
}

export function getDefaultFinancialYear(): string {
  return parseFinancialYearLabel("2026-27").label;
}
