import { ExportPortal } from "@/components/exports/export-portal";
import { getDefaultFinancialYear } from "@/lib/accounting/reports";

export const dynamic = "force-dynamic";

export default function ExportsPage() {
  return (
    <ExportPortal
      title="Tally & statutory exports"
      subtitle="Download Tally Prime XML, CA audit CSV schedules, and evidence bundles for the selected financial year or date range."
      defaultFinancialYear={getDefaultFinancialYear()}
    />
  );
}
