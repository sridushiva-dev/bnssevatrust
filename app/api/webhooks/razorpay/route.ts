import crypto from "node:crypto";

import { PaymentMethod, Role, TransactionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { realizeDonation } from "@/lib/donations/realize";
import { createPendingUpiDonation } from "@/lib/donations/service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getWebhookActorId(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { role: Role.ADMIN_TRUSTEE },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error("No admin user for webhook posting");
  return user.id;
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: {
      payment?: {
        entity: {
          id: string;
          amount: number;
          notes?: Record<string, string>;
          acquirer_data?: { rrn?: string };
        };
      };
      qr_code?: { entity: { id: string; notes?: Record<string, string> } };
      subscription?: {
        entity: {
          id: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    const actorId = await getWebhookActorId();

    if (event.event === "payment.captured" || event.event === "qr_code.credited") {
      const payment = event.payload.payment?.entity;
      if (!payment) {
        return NextResponse.json({ ok: true });
      }

      const existing = await prisma.donation.findUnique({
        where: { razorpayPaymentId: payment.id },
      });
      if (existing?.status === TransactionStatus.REALIZED) {
        return NextResponse.json({ ok: true, idempotent: true });
      }

      const donationId = payment.notes?.donation_id;
      let donation = donationId
        ? await prisma.donation.findUnique({ where: { id: donationId } })
        : null;

      if (!donation && event.payload.qr_code?.entity.id) {
        donation = await prisma.donation.findFirst({
          where: { razorpayQrId: event.payload.qr_code.entity.id },
        });
      }

      if (!donation) {
        return NextResponse.json({ error: "Donation not found" }, { status: 404 });
      }

      await prisma.donation.update({
        where: { id: donation.id },
        data: { razorpayPaymentId: payment.id },
      });

      await realizeDonation(donation.id, actorId, {
        utrNumber: payment.acquirer_data?.rrn,
        razorpayPaymentId: payment.id,
      });
    }

    if (event.event === "subscription.charged") {
      const payment = event.payload.payment?.entity;
      const sub = event.payload.subscription?.entity;
      if (!payment || !sub) {
        return NextResponse.json({ ok: true });
      }

      const existing = await prisma.donation.findUnique({
        where: { razorpayPaymentId: payment.id },
      });
      if (existing) {
        return NextResponse.json({ ok: true, idempotent: true });
      }

      const subscription = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: sub.id },
      });
      if (!subscription) {
        return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
      }

      const amountInr = (payment.amount / 100).toFixed(2);
      const createdById = actorId;

      const pending = await createPendingUpiDonation({
        donorId: subscription.donorId,
        amount: amountInr,
        fundType: subscription.fundType,
        paymentMethod: PaymentMethod.SUBSCRIPTION,
        createdById,
      });

      await prisma.donation.update({
        where: { id: pending.id },
        data: {
          subscriptionId: subscription.id,
          razorpayPaymentId: payment.id,
          paymentMethod: PaymentMethod.SUBSCRIPTION,
        },
      });

      await realizeDonation(pending.id, createdById, {
        utrNumber: payment.acquirer_data?.rrn,
        razorpayPaymentId: payment.id,
        isSubscriptionCharge: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[razorpay-webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
