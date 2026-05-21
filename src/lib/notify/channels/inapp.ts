import { prisma } from "@/lib/db";

export interface InAppPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function sendInApp(payload: InAppPayload): Promise<string> {
  const notif = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
      channels: { inApp: true },
    },
  });
  return notif.id;
}
