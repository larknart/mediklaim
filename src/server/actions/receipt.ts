"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAction, AuditAction } from "@/lib/audit";
import { createExtractor } from "@/lib/ai/extract-receipt";
import { ExtractionStatus, ReceiptStatus } from "@/generated/prisma";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadReceipt(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("NO_FILE");
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("INVALID_MIME");
  if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Dedup check
  const dup = await prisma.receipt.findFirst({
    where: { ownerId: session.user.id, fileHash: hash },
  });
  if (dup) {
    await logAction({
      actorId: session.user.id,
      actorName: session.user.name ?? undefined,
      action: AuditAction.RECEIPT_DUPLICATE_BLOCKED,
      entity: "Receipt",
      entityId: dup.id,
      meta: { hash },
    });
    throw new Error("DUPLICATE_RECEIPT");
  }

  // Save file
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const now = new Date();
  const relDir = path.join("receipts", String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const absDir = path.join(process.cwd(), "storage", relDir);
  await fs.mkdir(absDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  const absPath = path.join(absDir, filename);
  await fs.writeFile(absPath, buffer);
  const fileUrl = path.join(relDir, filename).replace(/\\/g, "/");

  const receipt = await prisma.receipt.create({
    data: {
      ownerId: session.user.id,
      fileUrl,
      fileMime: file.type,
      fileHash: hash,
      status: ReceiptStatus.UNSORTED,
      extractionStatus: ExtractionStatus.PENDING,
    },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.RECEIPT_UPLOADED,
    entity: "Receipt",
    entityId: receipt.id,
  });

  // Trigger extraction in background (non-blocking)
  extractReceiptBackground(receipt.id, buffer, file.type, session.user.id, session.user.name ?? undefined);

  return { id: receipt.id };
}

// ─── Background extraction ────────────────────────────────────────────────────

async function extractReceiptBackground(
  receiptId: string,
  buffer: Buffer,
  mime: string,
  actorId: string,
  actorName?: string
) {
  const extractor = createExtractor();
  try {
    const result = await extractor.extract(buffer, mime);

    // Fallback: AI returned no items or zero-amount single item but total is known
    if (result.totalMyr && result.items.length === 0) {
      result.items = [{ description: "Rawatan perubatan", qty: 1, unitMyr: result.totalMyr, amountMyr: result.totalMyr }];
    } else if (result.totalMyr && result.items.length === 1 && result.items[0].amountMyr === 0) {
      result.items[0] = { ...result.items[0], unitMyr: result.totalMyr, amountMyr: result.totalMyr };
    }

    // Flag items against blacklist
    const keywords = await prisma.blacklistKeyword.findMany({ select: { keyword: true, reason: true } });
    const items = result.items.map((item) => {
      const match = keywords.find((k) =>
        item.description.toLowerCase().includes(k.keyword.toLowerCase())
      );
      return {
        description: item.description,
        qty: item.qty,
        unitMyr: item.unitMyr,
        amountMyr: item.amountMyr,
        isEligible: !match,
        flaggedReason: match?.reason ?? null,
      };
    });

    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        receiptDate: result.receiptDate ? new Date(result.receiptDate) : null,
        vendor: result.vendor,
        totalMyr: result.totalMyr,
        extractedJson: result as object,
        aiConfidence: result.confidence,
        extractionStatus: ExtractionStatus.DONE,
        items: {
          deleteMany: {},
          create: items,
        },
      },
    });

    await logAction({
      actorId,
      actorName,
      action: AuditAction.RECEIPT_EXTRACTED,
      entity: "Receipt",
      entityId: receiptId,
      meta: { confidence: result.confidence, itemCount: items.length },
    });
  } catch (e) {
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { extractionStatus: ExtractionStatus.FAILED },
    });
    await logAction({
      actorId,
      actorName,
      action: AuditAction.RECEIPT_EXTRACTION_FAILED,
      entity: "Receipt",
      entityId: receiptId,
      meta: { error: String(e).slice(0, 200) },
    });
  }
}

// ─── Retry extraction ─────────────────────────────────────────────────────────

export async function retryExtraction(receiptId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt || receipt.ownerId !== session.user.id) throw new Error("NOT_FOUND");

  await prisma.receipt.update({
    where: { id: receiptId },
    data: { extractionStatus: ExtractionStatus.PENDING },
  });

  const absPath = path.join(process.cwd(), "storage", receipt.fileUrl);
  const buffer = await fs.readFile(absPath);
  extractReceiptBackground(receiptId, buffer, receipt.fileMime, session.user.id, session.user.name ?? undefined);

  return { ok: true };
}

// ─── Update receipt (manual edit) ────────────────────────────────────────────

export async function updateReceipt(
  receiptId: string,
  data: {
    receiptDate?: string;
    vendor?: string;
    totalMyr?: number;
    items?: Array<{ id?: string; description: string; qty: number; unitMyr: number; amountMyr: number; isEligible: boolean }>;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt || receipt.ownerId !== session.user.id) throw new Error("NOT_FOUND");
  if (receipt.status === ReceiptStatus.ATTACHED) throw new Error("RECEIPT_ATTACHED");

  await prisma.receipt.update({
    where: { id: receiptId },
    data: {
      receiptDate: data.receiptDate ? new Date(data.receiptDate) : undefined,
      vendor: data.vendor,
      totalMyr: data.totalMyr,
      extractionStatus: ExtractionStatus.DONE,
      ...(data.items && {
        items: {
          deleteMany: {},
          create: data.items.map((i) => ({
            description: i.description,
            qty: i.qty,
            unitMyr: i.unitMyr,
            amountMyr: i.amountMyr,
            isEligible: i.isEligible,
          })),
        },
      }),
    },
  });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.RECEIPT_EDITED,
    entity: "Receipt",
    entityId: receiptId,
  });

  return { ok: true };
}

// ─── Delete receipt from inbox ────────────────────────────────────────────────

export async function deleteReceipt(receiptId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt || receipt.ownerId !== session.user.id) throw new Error("NOT_FOUND");
  if (receipt.status !== ReceiptStatus.UNSORTED) throw new Error("CANNOT_DELETE_ATTACHED");

  const absPath = path.join(process.cwd(), "storage", receipt.fileUrl);
  await fs.unlink(absPath).catch(() => {});

  await prisma.receipt.delete({ where: { id: receiptId } });

  await logAction({
    actorId: session.user.id,
    actorName: session.user.name ?? undefined,
    action: AuditAction.RECEIPT_DELETED,
    entity: "Receipt",
    entityId: receiptId,
  });

  return { ok: true };
}
