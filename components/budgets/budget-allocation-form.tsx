"use client";

import { useState, useTransition } from "react";

import { upsertBudgetAllocationAction } from "@/app/budgets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = { id: string; name: string; allocatedAmount: string };

type Props = {
  financialYear: string;
  categories: Category[];
};

export function BudgetAllocationForm({ financialYear, categories }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <h3 className="text-sm font-semibold">Set / update FY budgets</h3>
      <ul className="mt-3 space-y-3">
        {categories.map((c) => (
          <li key={c.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <div>
              <Label className="text-xs">{c.name}</Label>
              <Input
                id={`alloc-${c.id}`}
                defaultValue={c.allocatedAmount}
                inputMode="decimal"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const el = document.getElementById(`alloc-${c.id}`) as HTMLInputElement;
                startTransition(async () => {
                  const res = await upsertBudgetAllocationAction({
                    budgetCategoryId: c.id,
                    financialYear,
                    allocatedAmount: el.value,
                  });
                  setMessage(res.success ? `Saved ${c.name}` : res.error ?? "Failed");
                });
              }}
            >
              Save
            </Button>
          </li>
        ))}
      </ul>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
