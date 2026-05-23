import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./_components/general-settings";
import { AllocationSettings } from "./_components/allocation-settings";
import { ClaimRulesSettings } from "./_components/claim-rules-settings";
import { HolidaySettings } from "./_components/holiday-settings";
import type { HolidayRow } from "./_components/holiday-settings";
import { BlacklistSettings } from "./_components/blacklist-settings";
import { NotifSettings } from "./_components/notif-settings";

export default async function TetapanPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const [settings, keywords, holidays] = await Promise.all([
    prisma.settings.findMany(),
    prisma.blacklistKeyword.findMany({ orderBy: { keyword: "asc" } }),
    prisma.publicHoliday.findMany({
      where: { year: { gte: currentYear - 1 } },
      orderBy: { date: "asc" },
    }),
  ]);

  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tetapan Sistem</h1>
        <p className="text-gray-500 text-sm mt-1">Konfigurasi sistem MediKlaim</p>
      </div>

      <Tabs defaultValue="am">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="am">Am</TabsTrigger>
          <TabsTrigger value="peruntukan">Peruntukan</TabsTrigger>
          <TabsTrigger value="peraturan">Peraturan</TabsTrigger>
          <TabsTrigger value="kalendar">Kalendar</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
          <TabsTrigger value="notifikasi">Notifikasi</TabsTrigger>
        </TabsList>

        <TabsContent value="am" className="mt-4">
          <GeneralSettings
            orgName={String(s["org_name"] ?? "Majlis Daerah Setiu")}
          />
        </TabsContent>

        <TabsContent value="peruntukan" className="mt-4">
          <AllocationSettings
            defaultLimit={Number(s["default_annual_limit"] ?? 1200)}
          />
        </TabsContent>

        <TabsContent value="peraturan" className="mt-4">
          <ClaimRulesSettings
            cutoffDays={Number(s["claim_cutoff_days"] ?? 45)}
            receiptMaxAgeMonths={Number(s["receipt_max_age_months"] ?? 3)}
            proRataEnabled={Boolean(s["pro_rata_enabled"] ?? true)}
            slaHeadDays={Number(s["sla_head_days"] ?? 3)}
            slaFinanceDays={Number(s["sla_finance_days"] ?? 5)}
            slaApproverDays={Number(s["sla_approver_days"] ?? 3)}
          />
        </TabsContent>

        <TabsContent value="kalendar" className="mt-4">
          <HolidaySettings
            holidays={holidays.map((h): HolidayRow => ({
              id: h.id,
              date: h.date.toISOString().split("T")[0],
              name: h.name,
            }))}
          />
        </TabsContent>

        <TabsContent value="blacklist" className="mt-4">
          <BlacklistSettings
            keywords={keywords.map((k) => ({ id: k.id, keyword: k.keyword, reason: k.reason }))}
          />
        </TabsContent>

        <TabsContent value="notifikasi" className="mt-4">
          <NotifSettings
            waEnabled={Boolean(s["wa_enabled"] ?? false)}
            waRatePerMin={Number(s["wa_rate_limit_per_min"] ?? 20)}
            waRatePerDay={Number(s["wa_rate_limit_per_day"] ?? 500)}
            waQuietStart={Number(s["wa_quiet_hours_start"] ?? 22)}
            waQuietEnd={Number(s["wa_quiet_hours_end"] ?? 7)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
