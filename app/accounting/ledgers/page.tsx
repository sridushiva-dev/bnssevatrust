import { LedgerDrilldown } from "@/components/accounting/ledger-drilldown";
import { DbSetupNotice } from "@/components/accounting/db-setup-notice";
import { FySelector } from "@/components/accounting/fy-selector";
import { ManualVoucherModal } from "@/components/accounting/manual-voucher-modal";
import {
  getDefaultFinancialYear,
  getLedgerGroups,
  getLedgerVouchers,
  getLedgersInGroup,
} from "@/lib/accounting/reports";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountingLedgersPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; group?: string; ledgerId?: string }>;
}) {
  const params = await searchParams;
  const financialYear = params.fy ?? getDefaultFinancialYear();
  const groupName = params.group ?? null;
  const ledgerId = params.ledgerId ?? null;

  let dbReady = true;
  let groups: Array<{
    tallyParentGroup: string;
    ledgerCount: number;
    totalDebit: string;
    totalCredit: string;
  }> | null = null;
  let ledgersInGroup: Array<{
    ledgerId: string;
    code: string;
    name: string;
    periodDebit: string;
    periodCredit: string;
    balance: string;
  }> | null = null;
  let selectedLedger: { id: string; code: string; name: string } | null = null;
  let vouchers: Array<{
    journalEntryId: string;
    voucherNumber: string;
    voucherType: string;
    entryDate: string;
    narration: string;
    debit: string;
    credit: string;
    isReversal: boolean;
  }> | null = null;
  let ledgers: Array<{ id: string; code: string; name: string }> = [];
  let ledgerByCode: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;

    if (!groupName) {
      const rawGroups = await getLedgerGroups(financialYear);
      groups = rawGroups.map((g) => ({
        tallyParentGroup: g.tallyParentGroup,
        ledgerCount: g.ledgerCount,
        totalDebit: g.totalDebit.toString(),
        totalCredit: g.totalCredit.toString(),
      }));
    } else if (!ledgerId) {
      const rawLedgers = await getLedgersInGroup(financialYear, groupName);
      ledgersInGroup = rawLedgers.map((l) => ({
        ledgerId: l.ledgerId,
        code: l.code,
        name: l.name,
        periodDebit: l.periodDebit.toString(),
        periodCredit: l.periodCredit.toString(),
        balance: l.balance.toString(),
      }));
    } else {
      const ledger = await prisma.ledgerAccount.findUnique({
        where: { id: ledgerId },
        select: { id: true, code: true, name: true },
      });
      selectedLedger = ledger;
      if (ledger) {
        const rawVouchers = await getLedgerVouchers(financialYear, ledgerId);
        vouchers = rawVouchers.map((v) => ({
          journalEntryId: v.journalEntryId,
          voucherNumber: v.voucherNumber,
          voucherType: v.voucherType,
          entryDate: v.entryDate.toISOString(),
          narration: v.narration,
          debit: v.debit.toString(),
          credit: v.credit.toString(),
          isReversal: v.isReversal,
        }));
      }
    }

    ledgers = await prisma.ledgerAccount.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
    ledgerByCode = Object.fromEntries(ledgers.map((l) => [l.code, l.id]));
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ledger drill-down</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tally-style: Group → Ledger → Voucher lines for FY {financialYear}.
          </p>
        </div>
        {dbReady && (
          <ManualVoucherModal ledgers={ledgers} ledgerByCode={ledgerByCode} />
        )}
      </div>

      <FySelector financialYear={financialYear} basePath="/accounting/ledgers" />

      {!dbReady ? (
        <DbSetupNotice />
      ) : (
        <LedgerDrilldown
          financialYear={financialYear}
          groups={groups}
          groupName={groupName}
          ledgersInGroup={ledgersInGroup}
          selectedLedger={selectedLedger}
          vouchers={vouchers}
        />
      )}
    </div>
  );
}
