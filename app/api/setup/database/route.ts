import { NextResponse } from "next/server";

import { runDatabaseSeed } from "@/lib/db/run-seed";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SetupBody = {
  secret?: string;
};

export async function POST(request: Request) {
  const configuredSecret = process.env.SETUP_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SETUP_SECRET is not configured in Vercel. Add it under Project → Settings → Environment Variables, then redeploy.",
      },
      { status: 503 },
    );
  }

  let body: SetupBody = {};
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.secret !== configuredSecret) {
    return NextResponse.json({ success: false, error: "Invalid setup secret" }, { status: 401 });
  }

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      const ledgerCount = await prisma.ledgerAccount.count();
      return NextResponse.json({
        success: true,
        data: {
          alreadyInitialized: true,
          message: "Database was already seeded. You can open the app home page.",
          userCount: existingUsers,
          ledgerCount,
        },
      });
    }

    const result = await runDatabaseSeed();
    return NextResponse.json({
      success: true,
      data: {
        alreadyInitialized: false,
        message: "Database seeded successfully.",
        ...result,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
