"use server";

import { ExpenseScale, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { evaluateCashExpenseGuardrail } from "@/lib/expenses/compliance";
import { createExpenseRecord } from "@/lib/expenses/service";
import { getActorUserId } from "@/lib/auth/get-actor";
import { PAN_REGEX } from "@/lib/validators/indian";

const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

const expenseFieldsSchema = z.object({
  expenseDate: z.string().min(1),
  scale: z.nativeEnum(ExpenseScale),
  vendorName: z.string().min(2),
  vendorPan: z
    .string()
    .optional()
    .refine((v) => !v || PAN_REGEX.test(v), "Invalid vendor PAN"),
  description: z.string().min(3),
  grossAmount: amountSchema,
  tdsAmount: amountSchema.default("0"),
  netPaidAmount: amountSchema,
  paymentMethod: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.UPI_QR,
    PaymentMethod.CHEQUE,
  ]),
  budgetCategoryId: z.string().min(1),
  utrOrRefNumber: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  cashDisallowanceAcknowledged: z.boolean().optional(),
});

export type ExpenseActionResult = {
  success: boolean;
  error?: string;
  code?: "SEC_11_CASH_WARNING";
  projectedTotal?: string;
  existingDayCash?: string;
  voucherNumber?: string;
  expenseId?: string;
};

export async function previewCashGuardrailAction(
  input: Pick<
    z.infer<typeof expenseFieldsSchema>,
    "vendorName" | "vendorPan" | "expenseDate" | "grossAmount" | "paymentMethod"
  >,
) {
  const guardrail = await evaluateCashExpenseGuardrail({
    vendorName: input.vendorName,
    vendorPan: input.vendorPan,
    expenseDate: new Date(input.expenseDate),
    grossAmount: input.grossAmount,
    paymentMethod: input.paymentMethod,
  });
  return {
    exceedsLimit: guardrail.exceedsLimit,
    projectedTotal: guardrail.projectedTotal.toFixed(2),
    existingDayCash: guardrail.existingDayCash.toFixed(2),
    reason: guardrail.reason,
  };
}

export async function createExpenseAction(
  formData: FormData,
): Promise<ExpenseActionResult> {
  const raw = {
    expenseDate: String(formData.get("expenseDate") ?? ""),
    scale: String(formData.get("scale") ?? "MAJOR") as ExpenseScale,
    vendorName: String(formData.get("vendorName") ?? ""),
    vendorPan: String(formData.get("vendorPan") ?? "") || undefined,
    description: String(formData.get("description") ?? ""),
    grossAmount: String(formData.get("grossAmount") ?? ""),
    tdsAmount: String(formData.get("tdsAmount") ?? "0"),
    netPaidAmount: String(formData.get("netPaidAmount") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? "") as PaymentMethod,
    budgetCategoryId: String(formData.get("budgetCategoryId") ?? ""),
    utrOrRefNumber: String(formData.get("utrOrRefNumber") ?? "") || undefined,
    chequeNumber: String(formData.get("chequeNumber") ?? "") || undefined,
    chequeDate: String(formData.get("chequeDate") ?? "") || undefined,
    cashDisallowanceAcknowledged:
      formData.get("cashDisallowanceAcknowledged") === "true",
  };

  const parsed = expenseFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const files = formData.getAll("attachments").filter((f) => f instanceof File) as File[];
  const attachments: Array<{ fileName: string; mimeType: string; buffer: Buffer }> = [];
  for (const file of files) {
    if (file.size === 0) continue;
    attachments.push({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  }

  if (parsed.data.scale === ExpenseScale.MAJOR && attachments.length === 0) {
    return { success: false, error: "Attach at least one bill for major expenses" };
  }

  if (parsed.data.paymentMethod === PaymentMethod.UPI_QR && !parsed.data.utrOrRefNumber) {
    return { success: false, error: "UTR / reference number is required for UPI/Bank" };
  }
  if (parsed.data.paymentMethod === PaymentMethod.CHEQUE) {
    if (!parsed.data.chequeNumber || !parsed.data.chequeDate) {
      return { success: false, error: "Cheque number and date are required" };
    }
  }

  try {
    const createdById = await getActorUserId();
    const expense = await createExpenseRecord({
      expenseDate: new Date(parsed.data.expenseDate),
      scale: parsed.data.scale,
      vendorName: parsed.data.vendorName,
      vendorPan: parsed.data.vendorPan,
      description: parsed.data.description,
      grossAmount: parsed.data.grossAmount,
      tdsAmount: parsed.data.tdsAmount,
      netPaidAmount: parsed.data.netPaidAmount,
      paymentMethod: parsed.data.paymentMethod,
      budgetCategoryId: parsed.data.budgetCategoryId,
      utrOrRefNumber: parsed.data.utrOrRefNumber,
      chequeNumber: parsed.data.chequeNumber,
      chequeDate: parsed.data.chequeDate ? new Date(parsed.data.chequeDate) : undefined,
      createdById,
      cashDisallowanceAcknowledged: parsed.data.cashDisallowanceAcknowledged,
      attachments,
    });

    revalidatePath("/expenses");
    revalidatePath("/budgets");
    revalidatePath("/accounting");

    return {
      success: true,
      voucherNumber: expense.voucherNumber,
      expenseId: expense.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save expense";
    if (message.startsWith("SEC_11_CASH_WARNING:")) {
      const [, projected, existing] = message.split(":");
      return {
        success: false,
        code: "SEC_11_CASH_WARNING",
        projectedTotal: projected,
        existingDayCash: existing,
        error:
          "Cash to this vendor today exceeds ₹10,000 — expense will be flagged as disallowed Sec 11 application.",
      };
    }
    return { success: false, error: message };
  }
}
