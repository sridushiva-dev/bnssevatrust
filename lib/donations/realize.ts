import {
  Donation,
  Prisma,
  TransactionStatus,
  VoucherType,
} from "@prisma/client";
import { postJournalEntry } from "@/lib/accounting/engine";
import { toDecimal } from "@/lib/accounting/decimal";
import { refreshSubstantialContributorTag } from "@/lib/donors/compliance";
import { getLedgerIdMap } from "@/lib/ledgers/resolver";
import { generateDonationReceiptPdf } from "@/lib/pdf/donation-receipt";
import { notifyDonorReceipt } from "@/lib/notifications/donor-notify";
import { prisma } from "@/lib/prisma";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

import { buildDonationJournalLines } from "./posting";

export async function realizeDonation(
  donationId: string,
  createdById: string,
  options?: {
    utrNumber?: string;
    razorpayPaymentId?: string;
    clearanceDate?: Date;
    isSubscriptionCharge?: boolean;
    tx?: Prisma.TransactionClient;
  },
): Promise<Donation> {
  const run = async (tx: Prisma.TransactionClient) => {
    const donation = await tx.donation.findUnique({
      where: { id: donationId },
      include: { donor: true },
    });
    if (!donation) {
      throw new Error("Donation not found");
    }
    if (donation.status === TransactionStatus.REALIZED) {
      return donation;
    }
    if (donation.status === TransactionStatus.BOUNCED) {
      throw new Error("Cannot realize a bounced donation");
    }

    const ledgerMap = await getLedgerIdMap(tx);
    const amount = donation.amount.toString();
    const lines = buildDonationJournalLines(ledgerMap, {
      fundType: donation.fundType,
      paymentMethod: donation.paymentMethod,
      amount,
      isSubscriptionCharge: options?.isSubscriptionCharge,
    });

    const narration = `Donation ${donation.receiptNumber} | ${donation.donor.fullName} | ${donation.paymentMethod} | Fund ${donation.fundType}`;

    const journalResult = await postJournalEntry({
      voucherType: VoucherType.RECEIPT,
      financialYear: donation.financialYear,
      entryDate: options?.clearanceDate ?? new Date(),
      narration,
      createdById,
      lines,
      voucherNumber: donation.receiptNumber,
      tx,
      skipAuditLog: true,
    });

    if (!journalResult.success || !journalResult.data) {
      throw new Error(journalResult.error ?? "Journal posting failed");
    }

    const updated = await tx.donation.update({
      where: { id: donationId },
      data: {
        status: TransactionStatus.REALIZED,
        journalEntryId: journalResult.data.id,
        utrNumber: options?.utrNumber ?? donation.utrNumber,
        razorpayPaymentId: options?.razorpayPaymentId ?? donation.razorpayPaymentId,
        chequeClearedDate: options?.clearanceDate ?? donation.chequeClearedDate,
      },
      include: { donor: true },
    });

    const newLifetime = toDecimal(updated.donor.lifetimeDonated).plus(
      toDecimal(updated.amount),
    );
    await tx.donor.update({
      where: { id: updated.donorId },
      data: { lifetimeDonated: newLifetime.toFixed(2) },
    });

    return updated;
  };

  const donation = options?.tx
    ? await run(options.tx)
    : await prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

  await refreshSubstantialContributorTag(
    donation.donorId,
    donation.financialYear,
  );

  await generateDonationReceiptPdf(donation.id);
  await notifyDonorReceipt(donation.id);

  await prisma.auditLog.create({
    data: {
      userId: createdById,
      action: "REALIZE_DONATION",
      entityType: "Donation",
      entityId: donation.id,
      metadata: { receiptNumber: donation.receiptNumber },
    },
  });

  return donation;
}

export async function reserveReceiptNumber(
  tx: Prisma.TransactionClient,
  entryDate: Date,
): Promise<{ receiptNumber: string; financialYear: string }> {
  const financialYear = getFinancialYearLabel(entryDate);
  const { generateNextVoucherNumber } = await import(
    "@/lib/accounting/voucherSequence"
  );
  const receiptNumber = await generateNextVoucherNumber(
    financialYear,
    VoucherType.RECEIPT,
    tx,
  );
  return { receiptNumber, financialYear };
}
