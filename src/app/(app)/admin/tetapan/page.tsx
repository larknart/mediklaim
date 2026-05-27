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
import { AiSettings } from "./_components/ai-settings";
import { SecuritySettings } from "./_components/security-settings";
import { SistemSettings } from "./_components/sistem-settings";
import { RefNoSettings } from "./_components/refno-settings";
import { getSystemStats } from "@/server/actions/admin";
import { getRefNoPreview } from "@/lib/refno";

export default async function TetapanPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const [settings, keywords, holidays, stats, refNoPreview] = await Promise.all([
    prisma.settings.findMany(),
    prisma.blacklistKeyword.findMany({ orderBy: { keyword: "asc" } }),
    prisma.publicHoliday.findMany({
      where: { year: { gte: currentYear - 1 } },
      orderBy: { date: "asc" },
    }),
    getSystemStats(),
    getRefNoPreview(),
  ]);

  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tetapan Sistem</h1>
        <p className="text-gray-500 text-sm mt-1">Konfigurasi sistem MediKlaim</p>
      </div>

      <Tabs defaultValue="am">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="am">Am</TabsTrigger>
          <TabsTrigger value="peruntukan">Peruntukan</TabsTrigger>
          <TabsTrigger value="peraturan">Peraturan</TabsTrigger>
          <TabsTrigger value="kalendar">Kalendar</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
          <TabsTrigger value="notifikasi">Notifikasi</TabsTrigger>
          <TabsTrigger value="ai">AI / OCR</TabsTrigger>
          <TabsTrigger value="keselamatan">Keselamatan</TabsTrigger>
          <TabsTrigger value="sistem">Sistem</TabsTrigger>
          <TabsTrigger value="refno">Ref No</TabsTrigger>
        </TabsList>

        <TabsContent value="am" className="mt-4">
          <GeneralSettings orgName={String(s["org_name"] ?? "Majlis Daerah Setiu")} />
        </TabsContent>

        <TabsContent value="peruntukan" className="mt-4">
          <AllocationSettings defaultLimit={Number(s["default_annual_limit"] ?? 1200)} />
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

        <TabsContent value="ai" className="mt-4">
          <AiSettings
            provider={String(s["ai_provider"] ?? "manual")}
            ollamaBaseUrl={String(s["ai_ollama_base_url"] ?? "")}
            ollamaModel={String(s["ai_ollama_model"] ?? "qwen2.5vl:7b")}
            confidenceThreshold={Number(s["ai_confidence_threshold"] ?? 0.7)}
            timeoutSeconds={Number(s["ai_timeout_seconds"] ?? 60)}
            retryCount={Number(s["ai_retry_count"] ?? 1)}
          />
        </TabsContent>

        <TabsContent value="keselamatan" className="mt-4">
          <SecuritySettings
            loginMaxAttempts={Number(s["login_max_attempts"] ?? 5)}
            loginLockDurationMin={Number(s["login_lock_duration_min"] ?? 15)}
            sessionTimeoutMin={Number(s["session_timeout_min"] ?? 30)}
            sessionWarningMin={Number(s["session_warning_min"] ?? 5)}
            passwordMinLength={Number(s["password_min_length"] ?? 10)}
            passwordRequireUppercase={s["password_require_uppercase"] !== false}
            passwordRequireNumber={s["password_require_number"] !== false}
            passwordRequireSymbol={Boolean(s["password_require_symbol"] ?? false)}
            maxUploadSizeMb={Number(s["max_upload_size_mb"] ?? 10)}
            require2faAdmin={s["require_2fa_admin"] === true}
          />
        </TabsContent>

        <TabsContent value="sistem" className="mt-4">
          <SistemSettings
            maintenanceMode={Boolean(s["maintenance_mode"] ?? false)}
            logRetentionYears={Number(s["log_retention_years"] ?? 7)}
            stats={stats}
          />
        </TabsContent>

        <TabsContent value="refno" className="mt-4">
          <RefNoSettings
            prefix={String(s["ref_no_prefix"] ?? "MDS/MK")}
            padding={Number(s["ref_no_padding"] ?? 5)}
            currentCounter={refNoPreview.currentCounter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
