"use server";

import { FundType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  bounceChequeDonation,
  clearChequeDonation,
  createAndRealizeCashDonation,
  createChequeDonation,
  saveDonationAttachment,
} from "@/lib/donations/service";
import { getActorUserId } from "@/lib/auth/get-actor";

const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

const donationSchema = z.object({
  donorId: z.string().min(1),
  amount: amountSchema,
  fundType: z.nativeEnum(FundType),
  paymentMethod: z.nativeEnum(PaymentMethod),
  corpusDirectionConfirmed: z.boolean().optional(),
  corpusDirectionNote: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  chequeBankName: z.string().optional(),
  chequeBranchIfsc: z.string().optional(),
});

export type DonationActionResult = {
  success: boolean;
  error?: string;
  donationId?: string;
  receiptNumber?: string;
  receiptPdfUrl?: string;
};

export async function createDonationAction(
  input: z.infer<typeof donationSchema>,
): Promise<DonationActionResult> {
  const parsed = donationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const createdById = await getActorUserId();
    const base = {
      donorId: parsed.data.donorId,
      amount: parsed.data.amount,
      fundType: parsed.data.fundType,
      createdById,
      corpusDirectionConfirmed: parsed.data.corpusDirectionConfirmed,
      corpusDirectionNote: parsed.data.corpusDirectionNote,
      hasCorpusAttachment: false,
    };

    if (parsed.data.paymentMethod === PaymentMethod.CASH) {
      const donation = await createAndRealizeCashDonation({
        ...base,
        paymentMethod: PaymentMethod.CASH,
      });
      revalidatePath("/donations");
      revalidatePath("/accounting");
      return {
        success: true,
        donationId: donation.id,
        receiptNumber: donation.receiptNumber,
        receiptPdfUrl: donation.receiptPdfUrl ?? undefined,
      };
    }

    if (parsed.data.paymentMethod === PaymentMethod.CHEQUE) {
      if (
        !parsed.data.chequeNumber ||
        !parsed.data.chequeDate ||
        !parsed.data.chequeBankName
      ) {
        return { success: false, error: "Cheque details are required" };
      }
      const donation = await createChequeDonation({
        ...base,
        paymentMethod: PaymentMethod.CHEQUE,
        chequeNumber: parsed.data.chequeNumber,
        chequeDate: parsed.data.chequeDate,
        chequeBankName: parsed.data.chequeBankName,
        chequeBranchIfsc: parsed.data.chequeBranchIfsc,
      });
      revalidatePath("/donations");
      return {
        success: true,
        donationId: donation.id,
        receiptNumber: donation.receiptNumber,
        receiptPdfUrl: donation.receiptPdfUrl ?? undefined,
      };
    }

    if (
      parsed.data.paymentMethod === PaymentMethod.UPI_QR ||
      parsed.data.paymentMethod === PaymentMethod.SUBSCRIPTION
    ) {
      return {
        success: false,
        error: "Use the Razorpay API flow for UPI QR and subscriptions",
      };
    }

    return { success: false, error: "Unsupported payment method" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function uploadCorpusLetterAction(
  donationId: string,
  formData: FormData,
): Promise<DonationActionResult> {
  try {
    const createdById = await getActorUserId();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "No file uploaded" };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveDonationAttachment(
      donationId,
      {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
      },
      createdById,
    );
    return { success: true, donationId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function clearChequeAction(
  donationId: string,
  clearanceDate: string,
): Promise<DonationActionResult> {
  try {
    const createdById = await getActorUserId();
    const donation = await clearChequeDonation(
      donationId,
      createdById,
      new Date(clearanceDate),
    );
    revalidatePath("/donations");
    revalidatePath("/accounting");
    return {
      success: true,
      donationId: donation.id,
      receiptNumber: donation.receiptNumber,
      receiptPdfUrl: donation.receiptPdfUrl ?? undefined,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Clearance failed" };
  }
}

export async function bounceChequeAction(
  donationId: string,
  bounceReason: string,
): Promise<DonationActionResult> {
  try {
    const createdById = await getActorUserId();
    await bounceChequeDonation(donationId, createdById, bounceReason);
    revalidatePath("/donations");
    return { success: true, donationId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
