"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getActorUserId } from "@/lib/auth/get-actor";

const allocationSchema = z.object({
  budgetCategoryId: z.string().min(1),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/),
  allocatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  alertThresholdPct: z.number().int().min(50).max(100).optional(),
});

export type BudgetActionResult = { success: boolean; error?: string };

export async function upsertBudgetAllocationAction(
  input: z.infer<typeof allocationSchema>,
): Promise<BudgetActionResult> {
  const parsed = allocationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const userId = await getActorUserId();
    await prisma.budgetAllocation.upsert({
      where: {
        financialYear_budgetCategoryId: {
          financialYear: parsed.data.financialYear,
          budgetCategoryId: parsed.data.budgetCategoryId,
        },
      },
      create: {
        financialYear: parsed.data.financialYear,
        budgetCategoryId: parsed.data.budgetCategoryId,
        allocatedAmount: parsed.data.allocatedAmount,
        alertThresholdPct: parsed.data.alertThresholdPct ?? 80,
      },
      update: {
        allocatedAmount: parsed.data.allocatedAmount,
        alertThresholdPct: parsed.data.alertThresholdPct ?? 80,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPSERT_BUDGET_ALLOCATION",
        entityType: "BudgetAllocation",
        entityId: parsed.data.budgetCategoryId,
        metadata: {
          financialYear: parsed.data.financialYear,
          allocatedAmount: parsed.data.allocatedAmount,
        },
      },
    });

    revalidatePath("/budgets");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
