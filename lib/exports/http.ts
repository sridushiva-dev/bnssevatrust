import { NextResponse } from "next/server";

export function fileDownloadResponse(
  body: string | Buffer,
  fileName: string,
  mimeType: string,
): NextResponse {
  const buffer = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
