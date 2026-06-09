"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifikasi");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifikasi");
}
