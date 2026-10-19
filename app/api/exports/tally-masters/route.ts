import { NextRequest } from "next/server";

import { assertExportAccess } from "@/lib/auth/export-access";
import { fileDownloadResponse } from "@/lib/exports/http";
import { generateTallyMastersXml } from "@/lib/exports/tallyXmlGenerator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await assertExportAccess();
    await parseExportFilterFromQuery({
      fy: request.nextUrl.searchParams.get("fy"),
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to"),
    });
    const file = await generateTallyMastersXml();
    return fileDownloadResponse(file.content, file.fileName, file.mimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
