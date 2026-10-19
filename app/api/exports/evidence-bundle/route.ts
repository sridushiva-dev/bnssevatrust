import { NextRequest } from "next/server";

import { assertExportAccess } from "@/lib/auth/export-access";
import { buildEvidenceZipBuffer } from "@/lib/exports/evidenceBundle";
import { parseExportFilterFromQuery } from "@/lib/exports/filters";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await assertExportAccess();
    const filter = parseExportFilterFromQuery({
      fy: request.nextUrl.searchParams.get("fy"),
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
    });
    const buffer = await buildEvidenceZipBuffer(filter);
    const fy = filter.financialYear ?? "custom";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Audit_Evidence_Bundle_${fy}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
