"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { postManualVoucherAction } from "@/app/accounting/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export type LedgerOption = {
  id: string;
  code: string;
  name: string;
};

type LineState = {
  ledgerId: string;
  debit: string;
  credit: string;
};

const PRESETS = {
  cashToBank: {
    label: "Cash deposit to bank",
    voucherType: "CONTRA" as const,
    narration: "Cash deposited to Primary Trust Bank Account",
  },
  bankToFd: {
    label: "Bank to Sec 11(5) FD",
    voucherType: "CONTRA" as const,
    narration: "Transfer to Scheduled Bank FD (Sec 11(5))",
  },
};

type Props = {
  ledgers: LedgerOption[];
  ledgerByCode: Record<string, string>;
};

export function ManualVoucherModal({ ledgers, ledgerByCode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<"CONTRA" | "JOURNAL">("CONTRA");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<LineState[]>([
    { ledgerId: "", debit: "", credit: "" },
    { ledgerId: "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyPreset(preset: keyof typeof PRESETS) {
    const p = PRESETS[preset];
    setVoucherType(p.voucherType);
    setNarration(p.narration);
    if (preset === "cashToBank") {
      setLines([
        {
          ledgerId: ledgerByCode["2001"] ?? "",
          debit: "",
          credit: "",
        },
        {
          ledgerId: ledgerByCode["2005"] ?? "",
          debit: "",
          credit: "",
        },
      ]);
    } else {
      setLines([
        {
          ledgerId: ledgerByCode["2003"] ?? "",
          debit: "",
          credit: "",
        },
        {
          ledgerId: ledgerByCode["2001"] ?? "",
          debit: "",
          credit: "",
        },
      ]);
    }
  }

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { ledgerId: "", debit: "", credit: "" }]);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await postManualVoucherAction({
        voucherType,
        entryDate,
        narration,
        lines: lines.map((l) => ({
          ledgerId: l.ledgerId,
          debit: l.debit || "0",
          credit: l.credit || "0",
        })),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to post voucher");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Contra / Journal</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual Contra or Journal Voucher</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Balanced double-entry only. Use for bank deposits and Sec 11(5) FD
            investments.
          </p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("cashToBank")}>
            {PRESETS.cashToBank.label}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("bankToFd")}>
            {PRESETS.bankToFd.label}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="voucherType">Voucher type</Label>
            <select
              id="voucherType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value as "CONTRA" | "JOURNAL")}
            >
              <option value="CONTRA">Contra</option>
              <option value="JOURNAL">Journal</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entryDate">Entry date</Label>
            <Input
              id="entryDate"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="narration">Narration</Label>
          <Input
            id="narration"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Narration for audit trail"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Journal lines</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              Add line
            </Button>
          </div>
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_5rem_5rem]"
            >
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={line.ledgerId}
                onChange={(e) => updateLine(index, { ledgerId: e.target.value })}
              >
                <option value="">Select ledger</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
              </select>
              <Input
                inputMode="decimal"
                placeholder="Debit"
                value={line.debit}
                onChange={(e) => updateLine(index, { debit: e.target.value, credit: "" })}
              />
              <Input
                inputMode="decimal"
                placeholder="Credit"
                value={line.credit}
                onChange={(e) => updateLine(index, { credit: e.target.value, debit: "" })}
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Posting…" : "Post balanced voucher"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
