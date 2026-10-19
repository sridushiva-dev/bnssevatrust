import {
  ExpenseScale,
  PaymentMethod,
  Prisma,
  TransactionStatus,
  VoucherType,
} from "@prisma/client";

import { postJournalEntry } from "@/lib/accounting/engine";
import { generateNextVoucherNumber } from "@/lib/accounting/voucherSequence";
import { getLedgerIdMap, requireLedgerId } from "@/lib/ledgers/resolver";
import { prisma } from "@/lib/prisma";
import { uploadAttachmentFile } from "@/lib/storage";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

import {
  evaluateCashExpenseGuardrail,
  SEC_11_DISALLOWANCE_REASON,
} from "./compliance";
import { buildExpenseJournalLines, resolvePaidFromLedgerCode } from "./posting";

export type CreateExpenseInput = {
  expenseDate: Date;
  scale: ExpenseScale;
  vendorName: string;
  vendorPan?: string;
  description: string;
  grossAmount: string;
  tdsAmount: string;
  netPaidAmount: string;
  paymentMethod: PaymentMethod;
  budgetCategoryId: string;
  utrOrRefNumber?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  createdById: string;
  cashDisallowanceAcknowledged?: boolean;
  attachments: Array<{ fileName: string; mimeType: string; buffer: Buffer }>;
};

export async function createExpenseRecord(input: CreateExpenseInput) {
  if (input.scale === ExpenseScale.MAJOR && input.attachments.length === 0) {
    throw new Error("Major expenses require at least one bill or voucher attachment");
  }

  if (
    input.paymentMethod !== PaymentMethod.CASH &&
    input.paymentMethod !== PaymentMethod.UPI_QR &&
    input.paymentMethod !== PaymentMethod.CHEQUE
  ) {
    throw new Error("Unsupported expense payment method");
  }

  const guardrail = await evaluateCashExpenseGuardrail({
    vendorName: input.vendorName,
    vendorPan: input.vendorPan,
    expenseDate: input.expenseDate,
    grossAmount: input.grossAmount,
    paymentMethod: input.paymentMethod,
  });

  if (guardrail.exceedsLimit && !input.cashDisallowanceAcknowledged) {
    throw new Error(
      `SEC_11_CASH_WARNING:${guardrail.projectedTotal.toFixed(2)}:${guardrail.existingDayCash.toFixed(2)}`,
    );
  }

  const category = await prisma.budgetCategory.findUnique({
    where: { id: input.budgetCategoryId },
    include: { ledger: true },
  });
  if (!category) {
    throw new Error("Budget category not found");
  }

  const financialYear = getFinancialYearLabel(input.expenseDate);
  const ledgerMap = await getLedgerIdMap();
  const paidFromCode = resolvePaidFromLedgerCode(input.paymentMethod, input.scale);
  const paidFromLedgerId = requireLedgerId(ledgerMap, paidFromCode);
  const tdsLedgerId = requireLedgerId(ledgerMap, "1005");

  const expense = await prisma.$transaction(
    async (tx) => {
      const voucherNumber = await generateNextVoucherNumber(
        financialYear,
        VoucherType.PAYMENT,
        tx,
      );

      const created = await tx.expense.create({
        data: {
          voucherNumber,
          financialYear,
          expenseDate: input.expenseDate,
          scale: input.scale,
          vendorName: input.vendorName,
          vendorPan: input.vendorPan || null,
          description: input.description,
          amount: input.grossAmount,
          tdsAmount: input.tdsAmount,
          netPaidAmount: input.netPaidAmount,
          paymentMethod: input.paymentMethod,
          status: TransactionStatus.REALIZED,
          utrOrRefNumber: input.utrOrRefNumber,
          chequeNumber: input.chequeNumber,
          chequeDate: input.chequeDate,
          paidFromLedgerId,
          isDisallowedSec11: guardrail.exceedsLimit,
          disallowanceReason: guardrail.exceedsLimit ? SEC_11_DISALLOWANCE_REASON : null,
          budgetCategoryId: input.budgetCategoryId,
          createdById: input.createdById,
        },
      });

      const lines = buildExpenseJournalLines({
        expenseLedgerId: category.ledgerId,
        paidFromLedgerId,
        tdsPayableLedgerId: tdsLedgerId,
        grossAmount: input.grossAmount,
        tdsAmount: input.tdsAmount,
        netPaidAmount: input.netPaidAmount,
      });

      const journalResult = await postJournalEntry({
        voucherType: VoucherType.PAYMENT,
        financialYear,
        entryDate: input.expenseDate,
        narration: `Payment ${voucherNumber} | ${input.vendorName} | ${input.description}`,
        createdById: input.createdById,
        lines,
        voucherNumber,
        tx,
        skipAuditLog: true,
      });

      if (!journalResult.success || !journalResult.data) {
        throw new Error(journalResult.error ?? "Failed to post payment voucher");
      }

      await tx.expense.update({
        where: { id: created.id },
        data: { journalEntryId: journalResult.data.id },
      });

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  for (const file of input.attachments) {
    const stored = await uploadAttachmentFile({
      folder: "expenses",
      fileName: file.fileName,
      mimeType: file.mimeType,
      buffer: file.buffer,
    });
    await prisma.attachment.create({
      data: {
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: stored.fileSize,
        storageKey: stored.storageKey,
        fileUrl: stored.fileUrl,
        expenseId: expense.id,
        uploadedBy: input.createdById,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: input.createdById,
      action: "CREATE_EXPENSE",
      entityType: "Expense",
      entityId: expense.id,
      metadata: {
        voucherNumber: expense.voucherNumber,
        isDisallowedSec11: expense.isDisallowedSec11,
      },
    },
  });

  return expense;
}
