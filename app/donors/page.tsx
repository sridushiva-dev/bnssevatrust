import Link from "next/link";

import { DonorForm } from "@/components/donors/donor-form";
import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { formatInr } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  let donors: Array<{
    id: string;
    donorCode: string;
    fullName: string;
    phone: string;
    panNumber: string | null;
    specifiedPersonType: string;
    lifetimeDonated: string;
  }> = [];
  let dbReady = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    const rows = await prisma.donor.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    donors = rows.map((d) => ({
      id: d.id,
      donorCode: d.donorCode,
      fullName: d.fullName,
      phone: d.phone,
      panNumber: d.panNumber,
      specifiedPersonType: d.specifiedPersonType,
      lifetimeDonated: d.lifetimeDonated.toString(),
    }));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Donor CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phone/PAN lookup, KYC validation, and Sec 13(3) substantial contributor tagging.
        </p>
      </div>

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <>
          <DonorForm />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent donors</h2>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {donors.length === 0 ? (
                <li className="p-4 text-muted-foreground">No donors yet</li>
              ) : (
                donors.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{d.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.donorCode} · {d.phone}
                        {d.panNumber ? ` · PAN ${d.panNumber}` : ""}
                      </p>
                      {d.specifiedPersonType !== "NONE" && (
                        <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          Sec 13(3): {d.specifiedPersonType}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p className="tabular-nums font-medium">{formatInr(d.lifetimeDonated)}</p>
                      <Link href={`/donations?donorPhone=${encodeURIComponent(d.phone)}`} className="text-primary">
                        New donation
                      </Link>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
