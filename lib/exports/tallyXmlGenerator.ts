import { VoucherType } from "@prisma/client";

import { toDecimal } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";

import { journalEntryWhere } from "./filters";
import type { ExportFilter, GeneratedFile } from "./types";
import { escapeXml, formatTallyDate, getTallyCompanyName } from "./xml-utils";

function envelopeOpen(reportName: string, company: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${escapeXml(reportName)}</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;
}

const ENVELOPE_CLOSE = `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const VCHTYPE_MAP: Record<VoucherType, string> = {
  RECEIPT: "Receipt",
  PAYMENT: "Payment",
  CONTRA: "Contra",
  JOURNAL: "Journal",
};

function ledgerLineXml(ledgerName: string, isDebit: boolean, amount: string): string {
  const amt = toDecimal(amount);
  const abs = amt.abs().toFixed(2);
  if (isDebit) {
    return `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${abs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
  }
  return `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${abs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
}

export async function generateTallyMastersXml(): Promise<GeneratedFile> {
  const company = getTallyCompanyName();
  const ledgers = await prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } });

  let body = envelopeOpen("All Masters", company);
  for (const ledger of ledgers) {
    body += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(ledger.name)}" ACTION="Create">
            <PARENT>${escapeXml(ledger.tallyParentGroup)}</PARENT>
            <OPENINGBALANCE>${ledger.openingBalance.toString()}</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>`;
  }
  body += ENVELOPE_CLOSE;

  return {
    fileName: "Tally_Masters.xml",
    content: body,
    mimeType: "application/xml",
  };
}

export async function generateTallyTransactionsXml(
  filter: ExportFilter,
): Promise<GeneratedFile> {
  const company = getTallyCompanyName();
  const entries = await prisma.journalEntry.findMany({
    where: journalEntryWhere(filter),
    include: {
      lines: { include: { ledger: true } },
      donation: { include: { donor: true } },
      expense: true,
    },
    orderBy: { entryDate: "asc" },
  });

  let body = envelopeOpen("Vouchers", company);

  for (const entry of entries) {
    const vchType = VCHTYPE_MAP[entry.voucherType];
    const partyLedger =
      entry.lines.find((l) => toDecimal(l.credit).gt(0))?.ledger.name ??
      entry.lines[0]?.ledger.name ??
      "";

    let linesXml = "";
    for (const line of entry.lines) {
      const debit = toDecimal(line.debit);
      const credit = toDecimal(line.credit);
      if (debit.gt(0)) {
        linesXml += ledgerLineXml(line.ledger.name, true, debit.toFixed(2));
      }
      if (credit.gt(0)) {
        linesXml += ledgerLineXml(line.ledger.name, false, credit.toFixed(2));
      }
    }

    body += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${formatTallyDate(entry.entryDate)}</DATE>
            <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(entry.voucherNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXml(partyLedger)}</PARTYLEDGERNAME>
            <NARRATION>${escapeXml(entry.narration)}</NARRATION>${linesXml}
          </VOUCHER>
        </TALLYMESSAGE>`;
  }

  body += ENVELOPE_CLOSE;

  const fySuffix = filter.financialYear ? `_${filter.financialYear}` : "";
  return {
    fileName: `Tally_Transactions_FY${fySuffix}.xml`,
    content: body,
    mimeType: "application/xml",
  };
}
