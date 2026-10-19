import fsPromises from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";

import PDFDocument from "pdfkit";

import { formatInr } from "@/lib/accounting/decimal";
import { prisma } from "@/lib/prisma";
import { uploadAttachmentFile } from "@/lib/storage";

function isRemoteStorage(): boolean {
  return (process.env.STORAGE_DRIVER ?? "local") === "s3";
}

async function pdfToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  doc.pipe(stream);
  doc.end();
  await finished(stream);
  return Buffer.concat(chunks);
}

export async function generateDonationReceiptPdf(donationId: string): Promise<string> {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { donor: true },
  });
  if (!donation) {
    throw new Error("Donation not found for receipt PDF");
  }

  const safeName = donation.receiptNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  const isProvisional = donation.status === "CHEQUE_RECEIVED_UNCLEARED";

  const doc = new PDFDocument({ margin: 50 });
  doc.fontSize(16).text("BHAGAVAN NAAMA SATHSANGAM SEVA TRUST", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text("Official Donation Receipt", { align: "center" });
  if (isProvisional) {
    doc.fontSize(10).fillColor("red").text("SUBJECT TO REALIZATION", { align: "center" });
    doc.fillColor("black");
  }
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Receipt No: ${donation.receiptNumber}`);
  doc.text(`Date: ${donation.createdAt.toLocaleDateString("en-IN")}`);
  doc.text(`Financial Year: ${donation.financialYear}`);
  doc.text(`Status: ${donation.status}`);
  doc.moveDown();

  doc.text(`Donor: ${donation.donor.fullName}`);
  doc.text(`Phone: ${donation.donor.phone}`);
  if (donation.donor.panNumber) {
    doc.text(`PAN: ${donation.donor.panNumber}`);
  }
  doc.text(
    `Address: ${donation.donor.addressLine1}, ${donation.donor.city}, ${donation.donor.state} - ${donation.donor.pinCode}`,
  );
  doc.moveDown();

  doc.text(`Fund Type: ${donation.fundType}`);
  doc.text(`Payment Mode: ${donation.paymentMethod}`);
  doc.fontSize(12).text(`Amount: ${formatInr(donation.amount.toString())}`, { underline: true });
  if (donation.utrNumber) {
    doc.fontSize(10).text(`UTR / Ref: ${donation.utrNumber}`);
  }
  if (donation.chequeNumber) {
    doc.text(`Cheque: ${donation.chequeNumber} (${donation.chequeBankName ?? ""})`);
  }
  doc.moveDown();
  doc.fontSize(9).text("Deed Reg. No. R/Podumbu/Book-4/71/2026", { align: "center" });
  doc.text("This is a computer-generated receipt.", { align: "center" });

  const pdfBuffer = await pdfToBuffer(doc);

  let publicUrl: string;
  if (isRemoteStorage()) {
    const stored = await uploadAttachmentFile({
      folder: "receipts",
      fileName: `${safeName}.pdf`,
      buffer: pdfBuffer,
      mimeType: "application/pdf",
    });
    publicUrl = stored.fileUrl;
  } else {
    const dir = path.join(process.cwd(), "public", "receipts");
    await fsPromises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${safeName}.pdf`);
    await fsPromises.writeFile(filePath, pdfBuffer);
    publicUrl = `/receipts/${safeName}.pdf`;
  }

  await prisma.donation.update({
    where: { id: donationId },
    data: { receiptPdfUrl: publicUrl },
  });

  return publicUrl;
}
