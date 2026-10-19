/** Canonical ledger codes from ACCOUNTING_AND_TAX_RULES.md */
export const LEDGER_CORPUS_FUND = "1001";

export const INCOME_LEDGER_CODES = ["3001", "3002", "3003", "3004", "3005"] as const;
export const EXPENSE_LEDGER_CODES = ["4001", "4002", "4003", "4004", "4005", "4006", "4007", "4008"] as const;

/** Cash, bank, clearing, petty cash — used for Receipts & Payments */
export const CASH_BANK_LEDGER_CODES = [
  "2001",
  "2002",
  "2003",
  "2004",
  "2005",
  "2006",
] as const;

export const SEC_11_5_INVESTMENT_LEDGER_CODES = ["2001", "2002", "2003"] as const;
