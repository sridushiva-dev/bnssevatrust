"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  title: string;
  subtitle: string;
  defaultFinancialYear: string;
};

function buildQuery(fy: string, from: string, to: string): string {
  const params = new URLSearchParams();
  if (fy) params.set("fy", fy);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function ExportPortal({ title, subtitle, defaultFinancialYear }: Props) {
  const [fy, setFy] = useState(defaultFinancialYear);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useMemo(() => buildQuery(fy, from, to), [fy, from, to]);

  const downloads = [
    {
      label: "Tally_Masters.xml",
      href: `/api/exports/tally-masters${query}`,
      hint: "Chart of accounts / ledgers",
    },
    {
      label: "Tally_Transactions_FY.xml",
      href: `/api/exports/tally-transactions${query}`,
      hint: "Receipt, Payment, Contra, Journal vouchers",
    },
    {
      label: "CA Audit CSV pack (5 schedules)",
      href: `/api/exports/audit-csv-pack${query}`,
      hint: "Form 10B/10BB & ITR-7 CSV schedules",
    },
    {
      label: "Evidence bundle (PDFs & bills)",
      href: `/api/exports/evidence-bundle${query}`,
      hint: "Monthly folders of receipts & expense attachments",
    },
    {
      label: "Complete audit pack (ZIP)",
      href: `/api/exports/full-audit-pack${query}`,
      hint: "Tally XML + CSVs + evidence in one archive",
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Authorized roles: <strong>ADMIN_TRUSTEE</strong> and{" "}
          <strong>AUDITOR_CA</strong> (export-only).
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Filter exports</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Financial year</Label>
            <Input value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2026-27" />
          </div>
          <div className="space-y-2">
            <Label>From (optional)</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To (optional)</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          If only FY is set, exports use 1 Apr – 31 Mar. Date range further narrows
          transactions and registers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Downloads</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {downloads.map((d) => (
            <li key={d.href} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.hint}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={d.href} download>Download</a>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
