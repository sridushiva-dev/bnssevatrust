import { Role } from "@prisma/client";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

const EXPORT_ROLES: Role[] = [Role.ADMIN_TRUSTEE, Role.AUDITOR_CA];

export class ExportAccessDeniedError extends Error {
  constructor(message = "Export access denied") {
    super(message);
    this.name = "ExportAccessDeniedError";
  }
}

/**
 * RBAC for export routes — AUDITOR_CA is read-only/export-only per PRD.
 * Until session auth ships, honors optional `x-export-role` header in development
 * or falls back to the first ADMIN_TRUSTEE / AUDITOR_CA user in the database.
 */
export async function assertExportAccess(): Promise<{ userId: string; role: Role }> {
  const headerList = await headers();
  const roleHeader = headerList.get("x-export-role");

  if (roleHeader === Role.AUDITOR_CA || roleHeader === Role.ADMIN_TRUSTEE) {
    const user = await prisma.user.findFirst({
      where: { role: roleHeader as Role },
      orderBy: { createdAt: "asc" },
    });
    if (user) {
      return { userId: user.id, role: user.role };
    }
  }

  const user = await prisma.user.findFirst({
    where: { role: { in: EXPORT_ROLES } },
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    throw new ExportAccessDeniedError(
      "No export-authorized user found. Seed ADMIN_TRUSTEE or AUDITOR_CA.",
    );
  }

  return { userId: user.id, role: user.role };
}

export function isExportRole(role: Role): boolean {
  return EXPORT_ROLES.includes(role);
}
