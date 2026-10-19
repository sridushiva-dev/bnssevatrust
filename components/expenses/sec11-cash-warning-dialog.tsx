"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInr } from "@/lib/accounting/decimal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectedTotal: string;
  existingDayCash: string;
  onConfirm: () => void;
};

export function Sec11CashWarningDialog({
  open,
  onOpenChange,
  projectedTotal,
  existingDayCash,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Section 11 cash expense alert</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cumulative cash paid to this vendor today would reach{" "}
          <strong className="text-foreground">{formatInr(projectedTotal)}</strong>{" "}
          (already {formatInr(existingDayCash)}). Amounts above ₹10,000/day to a
          single party are <strong>disallowed</strong> as application of income under
          Sec 11 read with Sec 40A(3).
        </p>
        <p className="text-sm">
          You may still record the payment; it will be flagged{" "}
          <code className="text-xs">isDisallowedSec11</code> on the voucher and excluded
          from the 85% compliance meter.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm}>Record with disallowance flag</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
