import Image from "next/image";

import { Button } from "@/components/ui/button";
import { getFinancialYearLabel } from "@/lib/utils/financialYear";

export default function HomePage() {
  const fy = getFinancialYearLabel(new Date("2026-10-19"));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Image
            src="/assets/trust-logo.png"
            alt="Bhagavan Naama Sathsangam Seva Trust"
            width={72}
            height={72}
            className="rounded-full"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Trust Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mobile-first PWA for donations, double-entry FAS, and statutory
              compliance. Active financial year:{" "}
              <span className="font-medium text-foreground">{fy}</span>
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button className="w-full" asChild>
            <a href="/accounting">Open FAS & Section 11 meter</a>
          </Button>
          <Button variant="outline" className="w-full" disabled>
            Cheque clearance queue — Phase 3
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Phase 2 adds the double-entry engine, statutory reports, and{" "}
        <a href="/accounting/ledgers" className="text-primary underline">
          ledger drill-down
        </a>
        . Connect
        PostgreSQL via <code className="text-foreground">DATABASE_URL</code> and
        run <code className="text-foreground">npm run db:push</code> then{" "}
        <code className="text-foreground">npm run db:seed</code>.
      </section>
    </div>
  );
}
