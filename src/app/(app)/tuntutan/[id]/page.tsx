import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { canViewClaim, canApproveAsHead, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { ClaimStatus, ApprovalStep, Role } from "@/generated/prisma";
import { getActiveDelegation } from "@/lib/delegation";
import { computeSla } from "@/lib/sla";
import { SlaBadge } from "@/components/sla-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, FileText, Calendar, Building2, User, Clock, RotateCcw, Download, ExternalLink } from "lucide-react";
import { CLAIM_STATUS_CONFIG } from "@/lib/claim-status";
import { HeadPanel } from "./_components/head-panel";
import { FinancePanel } from "./_components/finance-panel";
import { ApproverPanel } from "./_components/approver-panel";
import { MarkPaidButton } from "./_components/mark-paid-button";
import { WithdrawButton } from "./_components/withdraw-button";
import { ResubmitButton } from "./_components/resubmit-button";
import { CommentThread } from "./_components/comment-thread";
import type { CommentRow } from "./_components/comment-thread";
import { BackButton } from "@/components/back-button";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

function claimForLabel(claimFor: string, childNo: number | null): string {
  if (claimFor === "SPOUSE") return "Isteri / Suami";
  if (claimFor === "CHILD") return `Anak ke-${childNo ?? 1}`;
  return "Diri Sendiri";
}


export default async function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      claimant: true,
      receipts: {
        include: { items: true },
        orderBy: { receiptDate: "asc" },
      },
      approvals: {
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { decidedAt: "asc" },
      },
      resubmissions: {
        select: { id: true, refNo: true },
        take: 1,
      },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!claim) notFound();

  const user = session.user;
  if (!canViewClaim(user, { claimantId: claim.claimantId, departmentId: claim.departmentId })) {
    redirect("/dashboard");
  }

  const statusCfg = CLAIM_STATUS_CONFIG[claim.status as keyof typeof CLAIM_STATUS_CONFIG] ?? CLAIM_STATUS_CONFIG.DRAFT;
  const isOwner = claim.claimantId === user.id;
  const canWithdraw = isOwner && claim.status === ClaimStatus.SUBMITTED;
  const resubmission = claim.resubmissions[0] ?? null;
  const canResubmit = isOwner && claim.status === ClaimStatus.REJECTED && !resubmission;

  // Panel visibility — own role OR active delegation
  const [headDelegation, financeDelegation, approverDelegation, ydpDelegation] =
    await Promise.all([
      getActiveDelegation(user.id, Role.HEAD, claim.departmentId),
      getActiveDelegation(user.id, Role.FINANCE),
      getActiveDelegation(user.id, Role.APPROVER),
      getActiveDelegation(user.id, Role.YDP),
    ]);

  const showHeadPanel =
    (canApproveAsHead(user, { claimantId: claim.claimantId, departmentId: claim.departmentId }) ||
      (!!headDelegation && claim.claimantId !== user.id)) &&
    claim.status === ClaimStatus.SUBMITTED;

  const showFinancePanel =
    (isFinance(user) || !!financeDelegation) && claim.status === ClaimStatus.HEAD_APPROVED;

  const showMarkPaidPanel =
    (isFinance(user) || !!financeDelegation) && claim.status === ClaimStatus.APPROVED;

  const effectiveIsYdp = isYdp(user) || !!ydpDelegation;
  const showApproverPanel =
    (isApprover(user) || effectiveIsYdp || !!approverDelegation) &&
    (claim.status === ClaimStatus.FINANCE_REVIEWED ||
      (effectiveIsYdp && claim.status === ClaimStatus.APPROVED));

  // SLA — only for active pending steps
  const slaSettings = await prisma.settings.findMany({
    where: { key: { in: ["sla_head_days", "sla_finance_days", "sla_approver_days"] } },
  });
  const slaMap = Object.fromEntries(slaSettings.map((s) => [s.key, Number(s.value)]));
  const slaHeadDays = slaMap["sla_head_days"] ?? 3;
  const slaFinanceDays = slaMap["sla_finance_days"] ?? 5;
  const slaApproverDays = slaMap["sla_approver_days"] ?? 3;

  const holidays = await prisma.publicHoliday.findMany({
    where: { year: { in: [new Date().getFullYear(), new Date().getFullYear() - 1] } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));

  let slaInfo: ({ step: string } & ReturnType<typeof computeSla>) | null = null;
  if (claim.status === ClaimStatus.SUBMITTED && claim.submittedAt) {
    slaInfo = { step: "HEAD", ...computeSla(claim.submittedAt, slaHeadDays, holidaySet) };
  } else if (claim.status === ClaimStatus.HEAD_APPROVED) {
    const headApproval = claim.approvals.find((a) => a.step === "HEAD");
    if (headApproval) {
      slaInfo = { step: "FINANCE", ...computeSla(headApproval.decidedAt, slaFinanceDays, holidaySet) };
    }
  } else if (claim.status === ClaimStatus.FINANCE_REVIEWED) {
    const financeApproval = claim.approvals.find((a) => a.step === "FINANCE");
    if (financeApproval) {
      slaInfo = { step: "APPROVER", ...computeSla(financeApproval.decidedAt, slaApproverDays, holidaySet) };
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <BackButton />
      {sp.submitted === "1" && (
        <Alert className="border-primary/30 bg-success/5 text-primary">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Tuntutan berjaya dihantar. Ketua Jabatan akan menyemak tuntutan anda.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-gray-500">{claim.refNo}</p>
                <a
                  href={`/api/tuntutan/${claim.id}/pdf`}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
                  title="Muat turun PDF"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </a>
              </div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Tuntutan {MONTHS_BM[claim.forMonth - 1]} {claim.forYear}
              </h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {claim.claimant.name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {claim.submittedAt
                    ? new Date(claim.submittedAt).toLocaleDateString("ms-MY")
                    : "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={statusCfg.variant}>
                {statusCfg.label}
              </Badge>
              {slaInfo && <SlaBadge step={slaInfo.step} sla={slaInfo} />}
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="text-gray-500">Dituntut</p>
              <p className="font-semibold text-sm mt-0.5">
                RM {Number(claim.totalClaimedMyr).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Layak</p>
              <p className="font-semibold text-sm mt-0.5">
                {claim.totalEligibleMyr != null
                  ? `RM ${Number(claim.totalEligibleMyr).toFixed(2)}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Diluluskan</p>
              <p className={`font-semibold text-sm mt-0.5 ${claim.totalApprovedMyr ? "text-primary" : ""}`}>
                {claim.totalApprovedMyr != null
                  ? `RM ${Number(claim.totalApprovedMyr).toFixed(2)}`
                  : "—"}
              </p>
            </div>
          </div>

          {claim.voucherNo && (
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-1.5 border border-emerald-200">
              <span className="font-medium">No. Baucer:</span>
              <span className="font-mono">{claim.voucherNo}</span>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Role-specific action panels */}
      {showHeadPanel && (
        <HeadPanel claimId={claim.id} refNo={claim.refNo} />
      )}

      {showFinancePanel && (
        <FinancePanel
          claimId={claim.id}
          receipts={claim.receipts.map((r) => ({
            id: r.id,
            vendor: r.vendor,
            receiptDate: r.receiptDate,
            totalMyr: r.totalMyr ? Number(r.totalMyr) : null,
            fileUrl: r.fileUrl,
            fileMime: r.fileMime,
            items: r.items.map((i) => ({
              id: i.id,
              description: i.description,
              qty: i.qty,
              unitMyr: Number(i.unitMyr),
              amountMyr: Number(i.amountMyr),
              isEligible: i.isEligible,
              flaggedReason: i.flaggedReason,
            })),
          }))}
        />
      )}

      {showMarkPaidPanel && (
        <MarkPaidButton
          claimId={claim.id}
          refNo={claim.refNo}
          totalApprovedMyr={claim.totalApprovedMyr ? Number(claim.totalApprovedMyr) : null}
        />
      )}

      {showApproverPanel && (
        <ApproverPanel
          claimId={claim.id}
          refNo={claim.refNo}
          totalEligibleMyr={claim.totalEligibleMyr ? Number(claim.totalEligibleMyr) : null}
          currentStatus={claim.status}
          isYdp={effectiveIsYdp}
        />
      )}

      {/* Receipts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Resit ({claim.receipts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {claim.receipts.map((r) => {
            const rTotal = r.totalMyr
              ? Number(r.totalMyr)
              : r.items.reduce((s, i) => s + Number(i.amountMyr), 0);
            return (
              <div key={r.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-start justify-between p-3 bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{r.vendor ?? "Vendor tidak diketahui"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.receiptDate && (
                        <p className="text-xs text-gray-500">
                          {new Date(r.receiptDate).toLocaleDateString("ms-MY")}
                        </p>
                      )}
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {claimForLabel(r.claimFor, r.claimForChildNo)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <a
                      href={`/api/files/${r.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      title="Lihat resit asal"
                    >
                      {r.fileMime === "application/pdf" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Resit Asal
                    </a>
                    <span className="font-semibold text-sm text-primary">
                      RM {rTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                {r.fileMime.startsWith("image/") && (
                  <a href={`/api/files/${r.fileUrl}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${r.fileUrl}`}
                      alt={`Resit ${r.vendor ?? ""}`}
                      className="w-full max-h-48 object-contain bg-gray-100 border-b cursor-zoom-in"
                    />
                  </a>
                )}
                {r.items.length > 0 && (
                  <div className="divide-y">
                    {r.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                        {!item.isEligible && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${!item.isEligible ? "text-red-600 line-through" : "text-gray-700"}`}>
                            {item.description}
                            {item.qty > 1 && ` × ${item.qty}`}
                          </p>
                          {item.flaggedReason && (
                            <p className="text-xs text-red-500">{item.flaggedReason}</p>
                          )}
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${!item.isEligible ? "text-gray-400" : ""}`}>
                          RM {Number(item.amountMyr).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Approval timeline */}
      {claim.approvals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sejarah Tindakan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="relative space-y-4 pl-6">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-gray-200" />
              {claim.approvals.map((apv) => {
                const isApproved = apv.decision === "APPROVED" || apv.decision === "SKIPPED";
                const isRejected = apv.decision === "REJECTED";
                const dotColor = isApproved
                  ? "bg-success/50"
                  : isRejected
                  ? "bg-red-500"
                  : "bg-gray-400";
                const stepLabel: Record<string, string> = {
                  HEAD: "Ketua Jabatan",
                  FINANCE: "Pegawai Kewangan",
                  APPROVER: "Setiausaha / YDP",
                };
                const decisionLabel: Record<string, string> = {
                  APPROVED: "Diluluskan",
                  REJECTED: "Ditolak",
                  OVERRIDDEN: "Override",
                  SKIPPED: "Auto-skip",
                };
                return (
                  <div key={apv.id} className="relative">
                    <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${dotColor}`} />
                    <p className="text-sm font-medium">
                      {stepLabel[apv.step] ?? apv.step}{" "}
                      <span className={isRejected ? "text-red-600" : isApproved ? "text-primary" : "text-gray-500"}>
                        — {decisionLabel[apv.decision] ?? apv.decision}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {apv.actor.name} · {new Date(apv.decidedAt).toLocaleDateString("ms-MY")}{" "}
                      {new Date(apv.decidedAt).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {apv.comment && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{apv.comment}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comments */}
      <CommentThread
        claimId={claim.id}
        currentUserId={user.id}
        comments={claim.comments.map((c): CommentRow => ({
          id: c.id,
          body: c.body,
          authorId: c.authorId,
          authorName: c.author.name,
          createdAt: c.createdAt.toISOString(),
        }))}
      />

      {/* Withdraw */}
      {canWithdraw && (
        <WithdrawButton claimId={claim.id} />
      )}

      {/* Resubmit */}
      {canResubmit && (
        <ResubmitButton claimId={claim.id} />
      )}
      {resubmission && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Sudah dihantar semula →{" "}</span>
          <Link href={`/tuntutan/${resubmission.id}`} className="font-medium underline">
            {resubmission.refNo}
          </Link>
        </div>
      )}
    </div>
  );
}
