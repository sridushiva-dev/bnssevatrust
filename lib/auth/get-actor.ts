import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Phase 2 stub until session auth is wired — uses the seeded ADMIN_TRUSTEE. */
export async function getActorUserId(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { role: Role.ADMIN_TRUSTEE },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    throw new Error("No ADMIN_TRUSTEE user found. Run npm run db:seed.");
  }
  return user.id;
}
