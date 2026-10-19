import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { formatInr } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  let dbReady = true;
  let categories: Array<{ id: string; name: string; ledgerName: string }> = [];
  let recent: Array<{
    voucherNumber: string;
    vendorName: string;
    amount: string;
    scale: string;
    isDisallowedSec11: boolean;
  }> = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    const cats = await prisma.budgetCategory.findMany({
      include: { ledger: true },
      orderBy: { name: "asc" },
    });
    categories = cats.map((c) => ({
      id: c.id,
      name: c.name,
      ledgerName: c.ledger.name,
    }));

    const rows = await prisma.expense.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
    });
    recent = rows.map((e) => ({
      voucherNumber: e.voucherNumber,
      vendorName: e.vendorName,
      amount: e.amount.toString(),
      scale: e.scale,
      isDisallowedSec11: e.isDisallowedSec11,
    }));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Major & petty payments with TDS split, bill capture, and Sec 11 cash guardrails.
        </p>
      </div>

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <>
          <ExpenseForm categories={categories} />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent payment vouchers</h2>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {recent.map((e) => (
                <li key={e.voucherNumber} className="flex justify-between gap-2 p-3">
                  <div>
                    <p className="font-mono text-xs">{e.voucherNumber}</p>
                    <p>{e.vendorName}</p>
                    {e.isDisallowedSec11 && (
                      <span className="text-[10px] font-medium text-amber-800">
                        Sec 11 disallowed
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{formatInr(e.amount)}</p>
                    <p className="text-xs text-muted-foreground">{e.scale}</p>
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
