import { ExportPortal } from "@/components/exports/export-portal";
import { getDefaultFinancialYear } from "@/lib/accounting/reports";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  return (
    <ExportPortal
      title="CA tax audit center"
      subtitle="Form 10B/10BB and ITR-7 ready exports — same engine as Tally XML with auditor-friendly packaging."
      defaultFinancialYear={getDefaultFinancialYear()}
    />
  );
}
