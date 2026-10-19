import { prisma } from "@/lib/prisma";

export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

/**
 * Triggers donor receipt notifications (integrate MSG91 / WhatsApp Business / SMTP in production).
 */
export async function notifyDonorReceipt(
  donationId: string,
  channels: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP"],
): Promise<void> {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { donor: true },
  });
  if (!donation) return;

  const payload = {
    donationId,
    receiptNumber: donation.receiptNumber,
    amount: donation.amount.toString(),
    donorPhone: donation.donor.phone,
    donorEmail: donation.donor.email,
    receiptPdfUrl: donation.receiptPdfUrl,
    channels,
  };

  // Production: enqueue to notification provider
  if (process.env.NODE_ENV === "development") {
    console.info("[donor-notify]", JSON.stringify(payload));
  }

  await prisma.donation.update({
    where: { id: donationId },
    data: { donorNotifiedAt: new Date() },
  });
}
