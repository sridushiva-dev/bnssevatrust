"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { donorFormSchema } from "@/lib/validators/donor";
import { generateDonorCode } from "@/lib/donors/donor-code";
import { prisma } from "@/lib/prisma";

export type DonorActionResult = {
  success: boolean;
  error?: string;
  donorId?: string;
};

export async function upsertDonorAction(
  input: z.infer<typeof donorFormSchema>,
): Promise<DonorActionResult> {
  const parsed = donorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = parsed.data;
  const pan = data.panNumber?.trim() ? data.panNumber.trim().toUpperCase() : null;
  const email = data.email?.trim() ? data.email.trim() : null;

  try {
    const existing = await prisma.donor.findUnique({ where: { phone: data.phone } });
    const donor = existing
      ? await prisma.donor.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            email,
            panNumber: pan,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            state: data.state,
            pinCode: data.pinCode,
          },
        })
      : await prisma.donor.create({
          data: {
            donorCode: await generateDonorCode(),
            fullName: data.fullName,
            phone: data.phone,
            email,
            panNumber: pan,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            state: data.state,
            pinCode: data.pinCode,
          },
        });

    revalidatePath("/donors");
    return { success: true, donorId: donor.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save donor";
    return { success: false, error: message };
  }
}

export async function lookupDonorByPhoneAction(phone: string) {
  const normalized = phone.replace(/\s+/g, "").trim();
  if (normalized.length < 10) {
    return { success: false as const, error: "Enter at least 10 digits" };
  }
  const donor = await prisma.donor.findFirst({
    where: {
      OR: [{ phone: normalized }, { phone: { endsWith: normalized.slice(-10) } }],
    },
  });
  if (!donor) {
    return { success: true as const, data: null };
  }
  return {
    success: true as const,
    data: {
      id: donor.id,
      donorCode: donor.donorCode,
      fullName: donor.fullName,
      phone: donor.phone,
      email: donor.email,
      panNumber: donor.panNumber,
      addressLine1: donor.addressLine1,
      addressLine2: donor.addressLine2,
      city: donor.city,
      state: donor.state,
      pinCode: donor.pinCode,
      specifiedPersonType: donor.specifiedPersonType,
      lifetimeDonated: donor.lifetimeDonated.toString(),
    },
  };
}

export async function lookupDonorByPanAction(pan: string) {
  const normalized = pan.trim().toUpperCase();
  const donor = await prisma.donor.findFirst({ where: { panNumber: normalized } });
  if (!donor) {
    return { success: true as const, data: null };
  }
  return {
    success: true as const,
    data: {
      id: donor.id,
      donorCode: donor.donorCode,
      fullName: donor.fullName,
      phone: donor.phone,
      email: donor.email,
      panNumber: donor.panNumber,
      addressLine1: donor.addressLine1,
      addressLine2: donor.addressLine2,
      city: donor.city,
      state: donor.state,
      pinCode: donor.pinCode,
      specifiedPersonType: donor.specifiedPersonType,
      lifetimeDonated: donor.lifetimeDonated.toString(),
    },
  };
}
