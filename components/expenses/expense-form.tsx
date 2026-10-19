"use client";

import { ExpenseScale, PaymentMethod } from "@prisma/client";
import { useRef, useState, useTransition } from "react";

import { createExpenseAction } from "@/app/expenses/actions";
import { Sec11CashWarningDialog } from "@/components/expenses/sec11-cash-warning-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BudgetCategoryOption = {
  id: string;
  name: string;
  ledgerName: string;
};

type Props = {
  categories: BudgetCategoryOption[];
};

export function ExpenseForm({ categories }: Props) {
  const [scale, setScale] = useState<ExpenseScale>(ExpenseScale.MAJOR);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [message, setMessage] = useState<string | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMeta, setWarningMeta] = useState({ projected: "0", existing: "0" });
  const [pending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement | null>(null);

  function submit(acknowledgeCash = false) {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    if (acknowledgeCash) {
      fd.set("cashDisallowanceAcknowledged", "true");
    }
    startTransition(async () => {
      const res = await createExpenseAction(fd);
      if (res.code === "SEC_11_CASH_WARNING") {
        setWarningMeta({
          projected: res.projectedTotal ?? "0",
          existing: res.existingDayCash ?? "0",
        });
        setWarningOpen(true);
        return;
      }
      setMessage(
        res.success
          ? `Payment voucher ${res.voucherNumber} posted`
          : res.error ?? "Failed",
      );
      if (res.success) form.reset();
    });
  }

  return (
    <>
      <form
        ref={formRef}
        className="space-y-4 rounded-xl border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Expense date</Label>
            <Input
              name="expenseDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="space-y-2">
            <Label>Scale</Label>
            <select
              name="scale"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={scale}
              onChange={(e) => setScale(e.target.value as ExpenseScale)}
            >
              <option value={ExpenseScale.MAJOR}>Major</option>
              <option value={ExpenseScale.PETTY}>Petty</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Budget category</Label>
            <select
              name="budgetCategoryId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} → {c.ledgerName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Vendor name</Label>
            <Input name="vendorName" required />
          </div>
          <div className="space-y-2">
            <Label>Vendor PAN (optional)</Label>
            <Input name="vendorPan" className="uppercase" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" required />
          </div>
          <div className="space-y-2">
            <Label>Gross amount (₹)</Label>
            <Input name="grossAmount" inputMode="decimal" required />
          </div>
          <div className="space-y-2">
            <Label>TDS deducted (₹)</Label>
            <Input name="tdsAmount" inputMode="decimal" defaultValue="0" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Net paid from bank/cash (₹)</Label>
            <Input name="netPaidAmount" inputMode="decimal" required />
            <p className="text-xs text-muted-foreground">
              Gross = Net paid + TDS (TDS credits ledger 1005 — TDS Payable)
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Payment method</Label>
            <select
              name="paymentMethod"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.UPI_QR}>UPI / Bank transfer</option>
              <option value={PaymentMethod.CHEQUE}>Cheque</option>
            </select>
          </div>
          {paymentMethod === PaymentMethod.UPI_QR && (
            <div className="space-y-2 sm:col-span-2">
              <Label>UTR / reference</Label>
              <Input name="utrOrRefNumber" required />
            </div>
          )}
          {paymentMethod === PaymentMethod.CHEQUE && (
            <>
              <div className="space-y-2">
                <Label>Cheque number</Label>
                <Input name="chequeNumber" required />
              </div>
              <div className="space-y-2">
                <Label>Cheque date</Label>
                <Input name="chequeDate" type="date" required />
              </div>
            </>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Bill / voucher {scale === ExpenseScale.MAJOR ? "(required)" : "(optional)"}
            </Label>
            <Input
              name="attachments"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              multiple={scale === ExpenseScale.MAJOR}
              required={scale === ExpenseScale.MAJOR}
            />
          </div>
        </div>

        {message && <p className="text-sm">{message}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Posting payment…" : "Post payment voucher"}
        </Button>
      </form>

      <Sec11CashWarningDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        projectedTotal={warningMeta.projected}
        existingDayCash={warningMeta.existing}
        onConfirm={() => {
          setWarningOpen(false);
          submit(true);
        }}
      />
    </>
  );
}
