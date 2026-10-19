import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr } from "@/lib/accounting/decimal";
import { cn } from "@/lib/utils/cn";

type Section11View = {
  financialYear: string;
  totalEligibleIncome: string;
  permissibleAccumulation: string;
  mandatoryApplicationTarget: string;
  eligibleApplication: string;
  applicationShortfall: string;
  applicationPercentage: string;
  isCompliant: boolean;
};

type Props = {
  report: Section11View;
};

function toNum(d: string): number {
  return Number.parseFloat(d);
}

export function Section11Meter({ report }: Props) {
  const pct = toNum(report.applicationPercentage);
  const compliant = report.isCompliant && toNum(report.totalEligibleIncome) > 0;

  return (
    <Card className={cn(!compliant && toNum(report.totalEligibleIncome) > 0 && "border-amber-500/50")}>
      <CardHeader>
        <CardTitle>Section 11 — 85% Application of Income</CardTitle>
        <p className="text-xs text-muted-foreground">FY {report.financialYear}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 85 ? "bg-emerald-600" : "bg-amber-500",
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-sm font-medium">
          Application to date: {pct.toFixed(1)}%{" "}
          <span className="text-muted-foreground">(target 85%)</span>
        </p>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Eligible income (A)</dt>
            <dd className="font-medium">{formatInr(report.totalEligibleIncome)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">85% target (C)</dt>
            <dd className="font-medium">{formatInr(report.mandatoryApplicationTarget)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Eligible application (D)</dt>
            <dd className="font-medium">{formatInr(report.eligibleApplication)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shortfall before 31 Mar (E)</dt>
            <dd className={cn("font-medium", toNum(report.applicationShortfall) > 0 && "text-amber-700")}>
              {formatInr(report.applicationShortfall)}
            </dd>
          </div>
        </dl>

        {!compliant && toNum(report.totalEligibleIncome) > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Apply an additional {formatInr(report.applicationShortfall)} toward trust objects
            before 31 March, or plan Form 10 accumulation in Sec 11(5) modes (e.g. bank FD
            ledger 2003).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
