import { NextRequest } from "next/server";

import { assertExportAccess } from "@/lib/auth/export-access";
import { generateAllAuditCsvFiles } from "@/lib/exports/auditCsvGenerator";
import { parseExportFilterFromQuery } from "@/lib/exports/filters";
import { zipBuffers } from "@/lib/exports/zip";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await assertExportAccess();
    const filter = parseExportFilterFromQuery({
      fy: request.nextUrl.searchParams.get("fy"),
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
    });

    const files = await generateAllAuditCsvFiles(filter);
    const buffer = await zipBuffers(
      files.map((f) => ({ name: f.fileName, content: f.content })),
    );

    const fy = filter.financialYear ?? "custom";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="CA_Audit_CSV_Pack_${fy}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
