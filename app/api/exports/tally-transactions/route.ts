import { NextRequest } from "next/server";

import { assertExportAccess } from "@/lib/auth/export-access";
import { parseExportFilterFromQuery } from "@/lib/exports/filters";
import { fileDownloadResponse } from "@/lib/exports/http";
import { generateTallyTransactionsXml } from "@/lib/exports/tallyXmlGenerator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await assertExportAccess();
    const filter = parseExportFilterFromQuery({
      fy: request.nextUrl.searchParams.get("fy"),
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
    });
    const file = await generateTallyTransactionsXml(filter);
    return fileDownloadResponse(file.content, file.fileName, file.mimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
