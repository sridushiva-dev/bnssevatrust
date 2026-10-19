import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  const pan = request.nextUrl.searchParams.get("pan");

  if (!phone && !pan) {
    return NextResponse.json(
      { success: false, error: "Provide phone or pan query parameter" },
      { status: 400 },
    );
  }

  const donor = phone
    ? await prisma.donor.findFirst({
        where: {
          OR: [
            { phone },
            { phone: { endsWith: phone.replace(/\s+/g, "").slice(-10) } },
          ],
        },
      })
    : await prisma.donor.findFirst({
        where: { panNumber: pan!.trim().toUpperCase() },
      });

  if (!donor) {
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: donor.id,
      donorCode: donor.donorCode,
      fullName: donor.fullName,
      phone: donor.phone,
      email: donor.email,
      panNumber: donor.panNumber,
      addressLine1: donor.addressLine1,
      addressLine2: donor.addressLine2,
      city: donor.city,
      state: donor.state,
      pinCode: donor.pinCode,
      specifiedPersonType: donor.specifiedPersonType,
      lifetimeDonated: donor.lifetimeDonated.toString(),
    },
  });
}
