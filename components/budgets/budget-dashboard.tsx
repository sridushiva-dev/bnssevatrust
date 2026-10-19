import Link from "next/link";

import { formatInr } from "@/lib/accounting/decimal";
import type { BudgetUtilizationStatus } from "@/lib/budgets/actuals";
import { cn } from "@/lib/utils/cn";

export type BudgetRowView = {
  categoryId: string;
  categoryName: string;
  ledgerName: string;
  allocatedAmount: string;
  actualSpend: string;
  remaining: string;
  utilizationPct: string;
  status: BudgetUtilizationStatus;
};

const STATUS_STYLES: Record<BudgetUtilizationStatus, string> = {
  HEALTHY: "bg-emerald-500",
  WARNING: "bg-amber-500",
  OVER_BUDGET: "bg-red-600",
};

const STATUS_LABEL: Record<BudgetUtilizationStatus, string> = {
  HEALTHY: "Healthy",
  WARNING: "Warning",
  OVER_BUDGET: "Over budget",
};

type Props = {
  financialYear: string;
  rows: BudgetRowView[];
};

export function BudgetDashboard({ financialYear, rows }: Props) {
  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const pct = Math.min(Number.parseFloat(row.utilizationPct), 100);
        return (
          <li key={row.categoryId}>
            <Link
              href={`/budgets/${row.categoryId}?fy=${financialYear}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.categoryName}</p>
                  <p className="text-xs text-muted-foreground">{row.ledgerName}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
                    STATUS_STYLES[row.status],
                  )}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", STATUS_STYLES[row.status])}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Spent {formatInr(row.actualSpend)} / {formatInr(row.allocatedAmount)}
                </span>
                <span>{Number.parseFloat(row.utilizationPct).toFixed(1)}% utilized</span>
              </div>
              <p className="mt-1 text-xs">
                Balance:{" "}
                <span className="font-medium text-foreground">
                  {formatInr(row.remaining)}
                </span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
