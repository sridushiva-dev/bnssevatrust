import { FundType, PaymentMethod, TransactionStatus } from "@prisma/client";

import { validateDonationCompliance } from "@/lib/donors/compliance";
import { prisma } from "@/lib/prisma";

import { realizeDonation, reserveReceiptNumber } from "./realize";

export type CreateDonationBase = {
  donorId: string;
  amount: string;
  fundType: FundType;
  paymentMethod: PaymentMethod;
  createdById: string;
  corpusDirectionConfirmed?: boolean;
  corpusDirectionNote?: string;
  hasCorpusAttachment?: boolean;
};

export async function createDonationRecord(
  input: CreateDonationBase & {
    status: TransactionStatus;
    entryDate?: Date;
    chequeFields?: {
      chequeNumber: string;
      chequeDate: Date;
      chequeBankName: string;
      chequeBranchIfsc?: string;
    };
  },
) {
  const entryDate = input.entryDate ?? new Date();
  const donor = await prisma.donor.findUnique({ where: { id: input.donorId } });
  if (!donor) {
    throw new Error("Donor not found");
  }

  const compliance = await validateDonationCompliance({
    donorId: input.donorId,
    financialYear: "", // filled after reserve
    amount: input.amount,
    fundType: input.fundType,
    paymentMethod: input.paymentMethod,
    panNumber: donor.panNumber,
    corpusDirectionConfirmed: input.corpusDirectionConfirmed,
    hasCorpusAttachment: input.hasCorpusAttachment,
  });

  if (!compliance.ok) {
    throw new Error(compliance.error);
  }

  const donation = await prisma.$transaction(async (tx) => {
    const { receiptNumber, financialYear } = await reserveReceiptNumber(tx, entryDate);

    const revalidate = await validateDonationCompliance({
      donorId: input.donorId,
      financialYear,
      amount: input.amount,
      fundType: input.fundType,
      paymentMethod: input.paymentMethod,
      panNumber: donor.panNumber,
      corpusDirectionConfirmed: input.corpusDirectionConfirmed,
      hasCorpusAttachment: input.hasCorpusAttachment,
    });
    if (!revalidate.ok) {
      throw new Error(revalidate.error);
    }

    return tx.donation.create({
      data: {
        receiptNumber,
        financialYear,
        donorId: input.donorId,
        amount: input.amount,
        fundType: input.fundType,
        paymentMethod: input.paymentMethod,
        status: input.status,
        corpusDirectionConfirmed: input.corpusDirectionConfirmed ?? false,
        corpusDirectionNote: input.corpusDirectionNote,
        chequeNumber: input.chequeFields?.chequeNumber,
        chequeDate: input.chequeFields?.chequeDate,
        chequeBankName: input.chequeFields?.chequeBankName,
        chequeBranchIfsc: input.chequeFields?.chequeBranchIfsc,
        createdById: input.createdById,
      },
      include: { donor: true },
    });
  });

  return donation;
}

export async function createAndRealizeCashDonation(
  input: CreateDonationBase,
) {
  const donation = await createDonationRecord({
    ...input,
    status: TransactionStatus.REALIZED,
    paymentMethod: PaymentMethod.CASH,
  });
  return realizeDonation(donation.id, input.createdById);
}

export async function createChequeDonation(
  input: CreateDonationBase & {
    chequeNumber: string;
    chequeDate: string;
    chequeBankName: string;
    chequeBranchIfsc?: string;
  },
) {
  const donation = await createDonationRecord({
    ...input,
    status: TransactionStatus.CHEQUE_RECEIVED_UNCLEARED,
    paymentMethod: PaymentMethod.CHEQUE,
    chequeFields: {
      chequeNumber: input.chequeNumber,
      chequeDate: new Date(input.chequeDate),
      chequeBankName: input.chequeBankName,
      chequeBranchIfsc: input.chequeBranchIfsc,
    },
  });

  const { generateDonationReceiptPdf } = await import("@/lib/pdf/donation-receipt");
  await generateDonationReceiptPdf(donation.id);

  return donation;
}

export async function createPendingUpiDonation(input: CreateDonationBase) {
  return createDonationRecord({
    ...input,
    status: TransactionStatus.PENDING_PAYMENT,
    paymentMethod: PaymentMethod.UPI_QR,
  });
}

export async function clearChequeDonation(
  donationId: string,
  createdById: string,
  clearanceDate: Date,
) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation || donation.paymentMethod !== PaymentMethod.CHEQUE) {
    throw new Error("Invalid cheque donation");
  }
  if (donation.status !== TransactionStatus.CHEQUE_RECEIVED_UNCLEARED) {
    throw new Error("Cheque is not awaiting clearance");
  }
  return realizeDonation(donationId, createdById, { clearanceDate });
}

export async function bounceChequeDonation(
  donationId: string,
  createdById: string,
  bounceReason: string,
) {
  const donation = await prisma.donation.update({
    where: { id: donationId },
    data: {
      status: TransactionStatus.BOUNCED,
      bounceReason,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: createdById,
      action: "BOUNCE_CHEQUE",
      entityType: "Donation",
      entityId: donationId,
      metadata: { bounceReason },
    },
  });

  const { notifyDonorReceipt } = await import("@/lib/notifications/donor-notify");
  await notifyDonorReceipt(donationId, ["SMS", "WHATSAPP"]);

  return donation;
}

export async function saveDonationAttachment(
  donationId: string,
  file: { fileName: string; mimeType: string; buffer: Buffer },
  uploadedBy: string,
) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "uploads", "donations");
  await fs.mkdir(dir, { recursive: true });
  const storageKey = `${donationId}-${Date.now()}-${file.fileName}`;
  const diskPath = path.join(dir, storageKey);
  await fs.writeFile(diskPath, file.buffer);

  return prisma.attachment.create({
    data: {
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.buffer.length,
      storageKey,
      fileUrl: `/uploads/donations/${storageKey}`,
      donationId,
      uploadedBy,
    },
  });
}
