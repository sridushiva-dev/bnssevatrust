import { FundType, PaymentMethod } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPendingUpiDonation } from "@/lib/donations/service";
import { getActorUserId } from "@/lib/auth/get-actor";
import { amountToPaise, getRazorpayClient } from "@/lib/razorpay/client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  donorId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  fundType: z.nativeEnum(FundType),
  corpusDirectionConfirmed: z.boolean().optional(),
  corpusDirectionNote: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }

    const createdById = await getActorUserId();
    const donation = await createPendingUpiDonation({
      donorId: parsed.data.donorId,
      amount: parsed.data.amount,
      fundType: parsed.data.fundType,
      paymentMethod: PaymentMethod.UPI_QR,
      createdById,
      corpusDirectionConfirmed: parsed.data.corpusDirectionConfirmed,
      corpusDirectionNote: parsed.data.corpusDirectionNote,
    });

    const razorpay = getRazorpayClient();
    let qrImageUrl: string | null = null;
    let qrId: string | null = null;

    if (razorpay) {
      const qr = await razorpay.qrCode.create({
        type: "upi_qr",
        name: "BNST Trust Donation",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amountToPaise(parsed.data.amount),
        description: `Donation ${donation.receiptNumber}`,
        notes: {
          donation_id: donation.id,
          donor_id: parsed.data.donorId,
          receipt_number: donation.receiptNumber,
          fund_type: parsed.data.fundType,
        },
      });
      qrId = qr.id;
      qrImageUrl = qr.image_url;
      await prisma.donation.update({
        where: { id: donation.id },
        data: { razorpayQrId: qr.id },
      });
    } else {
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=upi://pay?am=${parsed.data.amount}&tn=${donation.receiptNumber}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        donationId: donation.id,
        receiptNumber: donation.receiptNumber,
        qrId,
        qrImageUrl,
        mockMode: !razorpay,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QR creation failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
