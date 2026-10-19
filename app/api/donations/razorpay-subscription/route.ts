import { FundType, PaymentMethod } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateDonationCompliance } from "@/lib/donors/compliance";
import { getActorUserId } from "@/lib/auth/get-actor";
import { amountToPaise, getRazorpayClient } from "@/lib/razorpay/client";
import { prisma } from "@/lib/prisma";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

const bodySchema = z.object({
  donorId: z.string().min(1),
  planAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  fundType: z.nativeEnum(FundType).default(FundType.GENERAL_VOLUNTARY),
  totalCount: z.number().int().min(1).max(120).optional(),
});

function planPeriod(frequency: "MONTHLY" | "QUARTERLY" | "YEARLY") {
  if (frequency === "YEARLY") {
    return { period: "yearly" as const, interval: 1 };
  }
  if (frequency === "QUARTERLY") {
    return { period: "monthly" as const, interval: 3 };
  }
  return { period: "monthly" as const, interval: 1 };
}

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

    const donor = await prisma.donor.findUnique({ where: { id: parsed.data.donorId } });
    if (!donor) {
      return NextResponse.json({ success: false, error: "Donor not found" }, { status: 404 });
    }

    const fy = getFinancialYearLabel();
    const compliance = await validateDonationCompliance({
      donorId: parsed.data.donorId,
      financialYear: fy,
      amount: parsed.data.planAmount,
      fundType: parsed.data.fundType,
      paymentMethod: PaymentMethod.SUBSCRIPTION,
      panNumber: donor.panNumber,
    });
    if (!compliance.ok) {
      return NextResponse.json({ success: false, error: compliance.error }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        },
        { status: 503 },
      );
    }

    const { period, interval } = planPeriod(parsed.data.frequency);
    const plan = await razorpay.plans.create({
      period,
      interval,
      item: {
        name: `BNST ${parsed.data.frequency} Donation`,
        amount: amountToPaise(parsed.data.planAmount),
        currency: "INR",
      },
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.id,
      total_count: parsed.data.totalCount ?? 12,
      customer_notify: 1,
      notes: {
        donor_id: parsed.data.donorId,
        fund_type: parsed.data.fundType,
      },
    });

    const createdById = await getActorUserId();
    await prisma.subscription.create({
      data: {
        razorpaySubscriptionId: subscription.id,
        donorId: parsed.data.donorId,
        planAmount: parsed.data.planAmount,
        frequency: parsed.data.frequency,
        fundType: parsed.data.fundType,
        status: subscription.status ?? "created",
        shortUrl: subscription.short_url,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: createdById,
        action: "CREATE_RAZORPAY_SUBSCRIPTION",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: { donorId: parsed.data.donorId },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
        status: subscription.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
