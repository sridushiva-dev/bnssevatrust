import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [userCount, ledgerCount] = await Promise.all([
      prisma.user.count(),
      prisma.ledgerAccount.count(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        initialized: userCount > 0 && ledgerCount > 0,
        userCount,
        ledgerCount,
      },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: {
        initialized: false,
        userCount: 0,
        ledgerCount: 0,
        databaseReachable: false,
      },
    });
  }
}
