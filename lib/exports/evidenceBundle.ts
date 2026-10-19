import fsPromises from "node:fs/promises";
import path from "node:path";

import { PassThrough } from "node:stream";

import { prisma } from "@/lib/prisma";

import { donationWhere, expenseWhere } from "./filters";
import type { ExportFilter } from "./types";
import { createArchiver } from "./zip";

function monthFolder(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function resolvePublicFile(fileUrl: string): Promise<string | null> {
  if (!fileUrl.startsWith("/")) return null;
  const diskPath = path.join(process.cwd(), "public", fileUrl);
  try {
    await fsPromises.access(diskPath);
    return diskPath;
  } catch {
    return null;
  }
}

export async function buildEvidenceZipBuffer(filter: ExportFilter): Promise<Buffer> {
  const donations = await prisma.donation.findMany({
    where: donationWhere(filter),
    include: { attachments: true },
  });

  const expenses = await prisma.expense.findMany({
    where: expenseWhere(filter),
    include: { attachments: true },
  });

  const archive = createArchiver();
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(stream);

  for (const donation of donations) {
    const folder = `${monthFolder(donation.createdAt)}/Receipts`;
    if (donation.receiptPdfUrl) {
      const disk = await resolvePublicFile(donation.receiptPdfUrl);
      if (disk) {
        archive.file(disk, {
          name: `${folder}/${donation.receiptNumber}.pdf`,
        });
      }
    }
    for (const att of donation.attachments) {
      const disk = await resolvePublicFile(att.fileUrl);
      if (disk) {
        archive.file(disk, {
          name: `${folder}/${donation.receiptNumber}_${att.fileName}`,
        });
      }
    }
  }

  for (const expense of expenses) {
    const folder = `${monthFolder(expense.expenseDate)}/Expenses`;
    for (const att of expense.attachments) {
      const disk = await resolvePublicFile(att.fileUrl);
      if (disk) {
        archive.file(disk, {
          name: `${folder}/${expense.voucherNumber}_${att.fileName}`,
        });
      }
    }
  }

  await archive.finalize();
  return done;
}

export async function buildAuditPackZipBuffer(filter: ExportFilter): Promise<Buffer> {
  const { generateAllAuditCsvFiles } = await import("./auditCsvGenerator");
  const { generateTallyMastersXml, generateTallyTransactionsXml } = await import(
    "./tallyXmlGenerator"
  );

  const [csvs, masters, transactions] = await Promise.all([
    generateAllAuditCsvFiles(filter),
    generateTallyMastersXml(),
    generateTallyTransactionsXml(filter),
  ]);

  const archive = createArchiver();
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(stream);

  for (const file of csvs) {
    archive.append(file.content, { name: file.fileName });
  }
  archive.append(masters.content, { name: masters.fileName });
  archive.append(transactions.content, { name: transactions.fileName });

  const donations = await prisma.donation.findMany({
    where: donationWhere(filter),
    include: { attachments: true },
  });
  const expenses = await prisma.expense.findMany({
    where: expenseWhere(filter),
    include: { attachments: true },
  });

  for (const donation of donations) {
    const folder = `${monthFolder(donation.createdAt)}/Receipts`;
    if (donation.receiptPdfUrl) {
      const disk = await resolvePublicFile(donation.receiptPdfUrl);
      if (disk) {
        archive.file(disk, { name: `${folder}/${donation.receiptNumber}.pdf` });
      }
    }
    for (const att of donation.attachments) {
      const disk = await resolvePublicFile(att.fileUrl);
      if (disk) {
        archive.file(disk, {
          name: `${folder}/${donation.receiptNumber}_${att.fileName}`,
        });
      }
    }
  }

  for (const expense of expenses) {
    const folder = `${monthFolder(expense.expenseDate)}/Expenses`;
    for (const att of expense.attachments) {
      const disk = await resolvePublicFile(att.fileUrl);
      if (disk) {
        archive.file(disk, {
          name: `${folder}/${expense.voucherNumber}_${att.fileName}`,
        });
      }
    }
  }

  await archive.finalize();
  return done;
}
