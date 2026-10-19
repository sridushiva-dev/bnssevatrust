"use server";

import { VoucherType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { postJournalEntry } from "@/lib/accounting/engine";
import { getActorUserId } from "@/lib/auth/get-actor";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

const lineSchema = z.object({
  ledgerId: z.string().min(1),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

const manualVoucherSchema = z.object({
  voucherType: z.enum(["CONTRA", "JOURNAL"]),
  entryDate: z.string().min(1),
  narration: z.string().min(3).max(500),
  lines: z.array(lineSchema).min(2),
});

export type ManualVoucherState = {
  success: boolean;
  error?: string;
  voucherNumber?: string;
};

export async function postManualVoucherAction(
  input: z.infer<typeof manualVoucherSchema>,
): Promise<ManualVoucherState> {
  const parsed = manualVoucherSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const createdById = await getActorUserId();
    const entryDate = new Date(parsed.data.entryDate);
    const financialYear = getFinancialYearLabel(entryDate);

    const result = await postJournalEntry({
      voucherType: parsed.data.voucherType as VoucherType,
      financialYear,
      entryDate,
      narration: parsed.data.narration,
      createdById,
      lines: parsed.data.lines,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Posting failed" };
    }

    revalidatePath("/accounting");
    revalidatePath("/accounting/ledgers");
    return { success: true, voucherNumber: result.data.voucherNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Posting failed";
    return { success: false, error: message };
  }
}
