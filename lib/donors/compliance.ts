import { FundType, PaymentMethod, SpecifiedPersonType, TransactionStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

import { toDecimal } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

const SEC_269ST_LIMIT = new Decimal(200000);
const PAN_SINGLE_DONATION = new Decimal(10000);
const PAN_FY_AGGREGATE = new Decimal(50000);
const SUBSTANTIAL_FY = new Decimal(100000);
const SUBSTANTIAL_LIFETIME = new Decimal(1000000);

export async function getDonorFyRealizedTotal(
  donorId: string,
  financialYear: string,
): Promise<Decimal> {
  const agg = await prisma.donation.aggregate({
    where: {
      donorId,
      financialYear,
      status: TransactionStatus.REALIZED,
    },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getDonorCashTotalForDay(
  donorId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Decimal> {
  const agg = await prisma.donation.aggregate({
    where: {
      donorId,
      paymentMethod: PaymentMethod.CASH,
      status: { in: [TransactionStatus.REALIZED, TransactionStatus.PENDING_PAYMENT] },
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export type DonationComplianceResult =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; warnings?: string[] };

export async function validateDonationCompliance(input: {
  donorId: string;
  financialYear: string;
  amount: string;
  fundType: FundType;
  paymentMethod: PaymentMethod;
  panNumber?: string | null;
  corpusDirectionConfirmed?: boolean;
  hasCorpusAttachment?: boolean;
}): Promise<DonationComplianceResult> {
  const warnings: string[] = [];
  const amount = toDecimal(input.amount);

  if (input.paymentMethod === PaymentMethod.CASH && amount.gte(SEC_269ST_LIMIT)) {
    return {
      ok: false,
      error:
        "Cash donation cannot be ₹2,00,000 or more in a single transaction (Section 269ST). Use cheque, UPI, or bank transfer.",
    };
  }

  if (input.paymentMethod === PaymentMethod.CASH) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    const dayCash = await getDonorCashTotalForDay(input.donorId, dayStart, dayEnd);
    if (dayCash.plus(amount).gte(SEC_269ST_LIMIT)) {
      return {
        ok: false,
        error:
          "Aggregate cash receipts from this donor today would reach or exceed ₹2,00,000 (Section 269ST).",
      };
    }
  }

  const fyTotal = await getDonorFyRealizedTotal(input.donorId, input.financialYear);
  const needsPan =
    input.fundType === FundType.CORPUS_11_1_D ||
    amount.gte(PAN_SINGLE_DONATION) ||
    fyTotal.plus(amount).gte(PAN_FY_AGGREGATE);

  if (needsPan && !input.panNumber) {
    return {
      ok: false,
      error:
        "PAN is mandatory for corpus donations, single donations ≥ ₹10,000, or FY aggregate ≥ ₹50,000.",
    };
  }

  if (input.fundType === FundType.CORPUS_11_1_D) {
    if (!input.corpusDirectionConfirmed) {
      return {
        ok: false,
        error:
          "Corpus donation requires explicit written direction (Sec 11(1)(d)). Confirm direction or upload the letter.",
      };
    }
  }

  return { ok: true, warnings };
}

export async function refreshSubstantialContributorTag(
  donorId: string,
  financialYear: string,
): Promise<void> {
  const donor = await prisma.donor.findUnique({ where: { id: donorId } });
  if (!donor) return;
  if (
    donor.specifiedPersonType === SpecifiedPersonType.TRUSTEE ||
    donor.specifiedPersonType === SpecifiedPersonType.SETTLOR
  ) {
    return;
  }

  const fyTotal = await getDonorFyRealizedTotal(donorId, financialYear);
  const lifetime = toDecimal(donor.lifetimeDonated);

  if (fyTotal.gt(SUBSTANTIAL_FY) || lifetime.gt(SUBSTANTIAL_LIFETIME)) {
    await prisma.donor.update({
      where: { id: donorId },
      data: { specifiedPersonType: SpecifiedPersonType.SUBSTANTIAL_CONTRIBUTOR },
    });
  }
}
