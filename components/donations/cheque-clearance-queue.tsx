"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { bounceChequeAction, clearChequeAction } from "@/app/donations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/accounting/decimal";

export type UnclearedCheque = {
  id: string;
  receiptNumber: string;
  amount: string;
  donorName: string;
  chequeNumber: string | null;
  chequeBankName: string | null;
  chequeDate: string | null;
};

export function ChequeClearanceQueue({ items }: { items: UnclearedCheque[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No cheques awaiting bank clearance.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="space-y-3 p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <div>
              <p className="font-medium">{item.donorName}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.receiptNumber}</p>
            </div>
            <p className="font-semibold tabular-nums">{formatInr(item.amount)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Cheque {item.chequeNumber} · {item.chequeBankName} ·{" "}
            {item.chequeDate ? new Date(item.chequeDate).toLocaleDateString("en-IN") : "—"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="date"
              id={`clear-${item.id}`}
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="sm:max-w-[10rem]"
            />
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                const el = document.getElementById(`clear-${item.id}`) as HTMLInputElement;
                startTransition(async () => {
                  const res = await clearChequeAction(item.id, el.value);
                  setMessage(res.success ? `Cleared ${item.receiptNumber}` : res.error ?? "Failed");
                });
              }}
            >
              Mark cleared (REALIZED)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Bounce reason for donor notification?");
                if (!reason) return;
                startTransition(async () => {
                  const res = await bounceChequeAction(item.id, reason);
                  setMessage(res.success ? "Marked bounced" : res.error ?? "Failed");
                });
              }}
            >
              Bounced
            </Button>
          </div>
        </li>
      ))}
      {message && <li className="p-3 text-xs text-muted-foreground">{message}</li>}
    </ul>
  );
}
