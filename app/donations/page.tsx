import { TransactionStatus } from "@prisma/client";

import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { ChequeClearanceQueue } from "@/components/donations/cheque-clearance-queue";
import { DonationForm } from "@/components/donations/donation-form";
import { formatInr } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DonationsPage() {
  let dbReady = true;
  let uncleared: Array<{
    id: string;
    receiptNumber: string;
    amount: string;
    donorName: string;
    chequeNumber: string | null;
    chequeBankName: string | null;
    chequeDate: string | null;
  }> = [];
  let recent: Array<{
    receiptNumber: string;
    status: string;
    amount: string;
    donorName: string;
    paymentMethod: string;
  }> = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    const pending = await prisma.donation.findMany({
      where: { status: TransactionStatus.CHEQUE_RECEIVED_UNCLEARED },
      include: { donor: true },
      orderBy: { createdAt: "desc" },
    });
    uncleared = pending.map((d) => ({
      id: d.id,
      receiptNumber: d.receiptNumber,
      amount: d.amount.toString(),
      donorName: d.donor.fullName,
      chequeNumber: d.chequeNumber,
      chequeBankName: d.chequeBankName,
      chequeDate: d.chequeDate?.toISOString() ?? null,
    }));

    const latest = await prisma.donation.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { donor: true },
    });
    recent = latest.map((d) => ({
      receiptNumber: d.receiptNumber,
      status: d.status,
      amount: d.amount.toString(),
      donorName: d.donor.fullName,
      paymentMethod: d.paymentMethod,
    }));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Donations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cash, UPI QR, subscriptions, and cheque (two-stage realization).
        </p>
      </div>

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold">New donation</h2>
            <DonationForm />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Cheque clearance queue</h2>
            <ChequeClearanceQueue items={uncleared} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent receipts</h2>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {recent.map((r) => (
                <li key={r.receiptNumber} className="flex justify-between gap-2 p-3">
                  <div>
                    <p className="font-mono text-xs">{r.receiptNumber}</p>
                    <p className="text-muted-foreground">{r.donorName} · {r.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{formatInr(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">{r.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
