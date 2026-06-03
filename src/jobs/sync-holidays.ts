import { prisma } from "@/lib/db";

interface HolidayApiItem {
  name: string;
  date: string; // "YYYY-MM-DD"
}

interface HolidayApiResponse {
  data: HolidayApiItem[];
}

export async function syncPublicHolidays(year: number): Promise<{ imported: number; year: number }> {
  const base = process.env.HOLIDAY_API_URL ?? "https://malaysia-holiday.dydxsoft.my/api/v1";
  const res = await fetch(`${base}/holidays?year=${year}&state=TRG`);
  if (!res.ok) throw new Error(`Holiday API error: ${res.status}`);

  const json: HolidayApiResponse = await res.json();
  const items = json.data ?? [];

  await Promise.all(
    items.map((h) => {
      const date = new Date(h.date);
      return prisma.publicHoliday.upsert({
        where: { date },
        create: { date, name: h.name, year },
        update: { name: h.name },
      });
    })
  );

  return { imported: items.length, year };
}
