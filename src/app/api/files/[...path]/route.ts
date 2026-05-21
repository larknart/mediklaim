import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: pathParts } = await params;
  const relPath = pathParts.join("/");

  // Only allow receipts/** and exports/**
  if (!relPath.startsWith("receipts/") && !relPath.startsWith("exports/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // For receipts, check ownership or role
  if (relPath.startsWith("receipts/")) {
    const receipt = await prisma.receipt.findFirst({
      where: { fileUrl: relPath },
      include: { claim: true },
    });

    if (!receipt) return new NextResponse("Not Found", { status: 404 });

    const canAccess =
      receipt.ownerId === session.user.id ||
      isAdmin(session.user) ||
      isFinance(session.user) ||
      isApprover(session.user) ||
      isYdp(session.user);

    if (!canAccess) return new NextResponse("Forbidden", { status: 403 });
  }

  const absPath = path.join(process.cwd(), "storage", relPath);

  try {
    const buffer = await fs.readFile(absPath);
    const ext = path.extname(relPath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${path.basename(relPath)}"`,
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
