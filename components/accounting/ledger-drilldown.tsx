import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatInr } from "@/lib/accounting/decimal";
type LedgerGroupView = {
  tallyParentGroup: string;
  ledgerCount: number;
  totalDebit: string;
  totalCredit: string;
};

type LedgerInGroupView = {
  ledgerId: string;
  code: string;
  name: string;
  periodDebit: string;
  periodCredit: string;
  balance: string;
};

type LedgerVoucherView = {
  journalEntryId: string;
  voucherNumber: string;
  voucherType: string;
  entryDate: string;
  narration: string;
  debit: string;
  credit: string;
  isReversal: boolean;
};

type Props = {
  financialYear: string;
  groups: LedgerGroupView[] | null;
  groupName: string | null;
  ledgersInGroup: LedgerInGroupView[] | null;
  selectedLedger: { id: string; code: string; name: string } | null;
  vouchers: LedgerVoucherView[] | null;
};

export function LedgerDrilldown({
  financialYear,
  groups,
  groupName,
  ledgersInGroup,
  selectedLedger,
  vouchers,
}: Props) {
  const base = `/accounting/ledgers?fy=${encodeURIComponent(financialYear)}`;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href={base} className="hover:text-foreground">Groups</Link>
        {groupName && (
          <>
            <ChevronRight className="size-3" />
            <Link
              href={`${base}&group=${encodeURIComponent(groupName)}`}
              className="hover:text-foreground"
            >
              {groupName}
            </Link>
          </>
        )}
        {selectedLedger && (
          <>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{selectedLedger.code}</span>
          </>
        )}
      </nav>

      {!groupName && groups && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {groups.map((g) => (
            <li key={g.tallyParentGroup}>
              <Link
                href={`${base}&group=${encodeURIComponent(g.tallyParentGroup)}`}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{g.tallyParentGroup}</span>
                <span className="text-xs text-muted-foreground">
                  {g.ledgerCount} ledgers · Dr {formatInr(g.totalDebit)} / Cr{" "}
                  {formatInr(g.totalCredit)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {groupName && !selectedLedger && ledgersInGroup && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {ledgersInGroup.map((l) => (
            <li key={l.ledgerId}>
              <Link
                href={`${base}&group=${encodeURIComponent(groupName)}&ledgerId=${l.ledgerId}`}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span>
                  <span className="font-mono text-xs text-muted-foreground">{l.code}</span>{" "}
                  {l.name}
                </span>
                <span className="tabular-nums text-xs">{formatInr(l.balance)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {selectedLedger && vouchers && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <p className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
            {selectedLedger.code} — {selectedLedger.name}
          </p>
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Voucher</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No vouchers in this FY
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={`${v.journalEntryId}-${v.debit}-${v.credit}`} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {new Date(v.entryDate as string).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {v.voucherNumber}
                      {v.isReversal && (
                        <span className="ml-1 text-amber-700">(Rev)</span>
                      )}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-xs">{v.narration}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {v.debit !== "0" ? formatInr(v.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {v.credit !== "0" ? formatInr(v.credit) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
