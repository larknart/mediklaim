import { syncPublicHolidays } from "@/jobs/sync-holidays";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const token = bearer ?? req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const currentYear = new Date().getFullYear();
    const results = await Promise.all([
      syncPublicHolidays(currentYear),
      syncPublicHolidays(currentYear + 1),
    ]);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
