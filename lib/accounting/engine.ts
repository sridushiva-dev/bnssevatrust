import { JournalEntry, Prisma, VoucherType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

import { assertBalanced, toDecimal } from "./decimal";
import { ActionResult } from "./types";
import { generateNextVoucherNumber } from "./voucherSequence";

export type JournalLineInput = {
  ledgerId: string;
  debit: string;
  credit: string;
};

export type PostJournalEntryInput = {
  voucherType: VoucherType;
  financialYear?: string;
  entryDate: Date;
  narration: string;
  createdById: string;
  lines: JournalLineInput[];
  /** When already reserved (e.g. donation receipt number), skip sequence increment. */
  voucherNumber?: string;
  tx?: PrismaTx;
  skipAuditLog?: boolean;
};

type PrismaTx = Prisma.TransactionClient;

export type ReverseJournalEntryInput = {
  originalEntryId: string;
  createdById: string;
  reversalDate: Date;
  reason: string;
};

function normalizeLines(lines: JournalLineInput[]) {
  if (lines.length < 2) {
    throw new Error("A journal entry requires at least two lines");
  }

  const normalized = lines.map((line) => {
    const debit = toDecimal(line.debit);
    const credit = toDecimal(line.credit);
    if (debit.isNegative() || credit.isNegative()) {
      throw new Error("Debit and credit amounts must be non-negative");
    }
    if (debit.gt(0) && credit.gt(0)) {
      throw new Error("A journal line cannot have both debit and credit");
    }
    if (debit.isZero() && credit.isZero()) {
      throw new Error("Each journal line must have a debit or credit amount");
    }
    return { ledgerId: line.ledgerId, debit, credit };
  });

  assertBalanced(normalized);
  return normalized;
}

async function createJournalEntryInTx(
  tx: PrismaTx,
  input: PostJournalEntryInput,
  normalized: ReturnType<typeof normalizeLines>,
  financialYear: string,
) {
  const voucherNumber =
    input.voucherNumber ??
    (await generateNextVoucherNumber(financialYear, input.voucherType, tx));

  if (input.voucherNumber) {
    const clash = await tx.journalEntry.findUnique({
      where: { voucherNumber: input.voucherNumber },
    });
    if (clash) {
      throw new Error(`Voucher number already used: ${input.voucherNumber}`);
    }
  }

  return tx.journalEntry.create({
    data: {
      voucherNumber,
      voucherType: input.voucherType,
      financialYear,
      entryDate: input.entryDate,
      narration: input.narration,
      createdById: input.createdById,
      lines: {
        create: normalized.map((line) => ({
          ledgerId: line.ledgerId,
          debit: line.debit.toFixed(2),
          credit: line.credit.toFixed(2),
        })),
      },
    },
    include: { lines: true },
  });
}

export async function postJournalEntry(
  input: PostJournalEntryInput,
): Promise<ActionResult<JournalEntry>> {
  try {
    const financialYear =
      input.financialYear ?? getFinancialYearLabel(input.entryDate);
    const lines = normalizeLines(input.lines);

    const ledgerIds = [...new Set(lines.map((l) => l.ledgerId))];
    const db = input.tx ?? prisma;
    const ledgers = await db.ledgerAccount.findMany({
      where: { id: { in: ledgerIds } },
      select: { id: true },
    });
    if (ledgers.length !== ledgerIds.length) {
      return { success: false, error: "One or more ledger accounts were not found" };
    }

    const runInTx = async (tx: PrismaTx) =>
      createJournalEntryInTx(tx, input, lines, financialYear);

    const entry = input.tx
      ? await runInTx(input.tx)
      : await prisma.$transaction(runInTx, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

    if (!input.skipAuditLog) {
      await prisma.auditLog.create({
        data: {
          userId: input.createdById,
          action: "POST_JOURNAL_ENTRY",
          entityType: "JournalEntry",
          entityId: entry.id,
          metadata: {
            voucherNumber: entry.voucherNumber,
            voucherType: entry.voucherType,
          },
        },
      });
    }

    return { success: true, data: entry };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post journal entry";
    return { success: false, error: message };
  }
}

export async function reverseJournalEntry(
  input: ReverseJournalEntryInput,
): Promise<ActionResult<JournalEntry>> {
  try {
    const original = await prisma.journalEntry.findUnique({
      where: { id: input.originalEntryId },
      include: { lines: true },
    });

    if (!original) {
      return { success: false, error: "Original journal entry not found" };
    }

    const existingReversal = await prisma.journalEntry.findFirst({
      where: { reversedFromId: original.id, isReversal: true },
    });
    if (existingReversal) {
      return {
        success: false,
        error: `Entry already reversed by ${existingReversal.voucherNumber}`,
      };
    }

    const financialYear = getFinancialYearLabel(input.reversalDate);
    const reversalLines: JournalLineInput[] = original.lines.map((line) => ({
      ledgerId: line.ledgerId,
      debit: line.credit.toString(),
      credit: line.debit.toString(),
    }));

    const entry = await prisma.$transaction(
      async (tx) => {
        const voucherNumber = await generateNextVoucherNumber(
          financialYear,
          VoucherType.JOURNAL,
          tx,
        );

        const normalized = normalizeLines(reversalLines);

        return tx.journalEntry.create({
          data: {
            voucherNumber,
            voucherType: VoucherType.JOURNAL,
            financialYear,
            entryDate: input.reversalDate,
            narration: `Reversal of ${original.voucherNumber}: ${input.reason}`,
            isReversal: true,
            reversedFromId: original.id,
            createdById: input.createdById,
            lines: {
              create: normalized.map((line) => ({
                ledgerId: line.ledgerId,
                debit: line.debit.toFixed(2),
                credit: line.credit.toFixed(2),
              })),
            },
          },
          include: { lines: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await prisma.auditLog.create({
      data: {
        userId: input.createdById,
        action: "REVERSE_JOURNAL_ENTRY",
        entityType: "JournalEntry",
        entityId: entry.id,
        metadata: {
          reversedFromId: original.id,
          originalVoucher: original.voucherNumber,
        },
      },
    });

    return { success: true, data: entry };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reverse journal entry";
    return { success: false, error: message };
  }
}
