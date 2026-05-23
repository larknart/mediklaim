import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { canViewClaim, canApproveAsHead, isFinance, isApprover, isYdp } from "@/lib/permissions";
import { ClaimStatus, ApprovalStep, Role } from "@/generated/prisma";
import { getActiveDelegation } from "@/lib/delegation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, FileText, Calendar, Building2, User, Clock, RotateCcw, Download } from "lucide-react";
import { HeadPanel } from "./_components/head-panel";
import { FinancePanel } from "./_components/finance-panel";
import { ApproverPanel } from "./_components/approver-panel";
import { WithdrawButton } from "./_components/withdraw-button";
import { ResubmitButton } from "./_components/resubmit-button";
import { CommentThread } from "./_components/comment-thread";
import type { CommentRow } from "./_components/comment-thread";
import { BackButton } from "@/components/back-button";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",               color: "bg-gray-100 text-gray-700" },
  SUBMITTED:        { label: "Menunggu Sokongan",  color: "bg-blue-100 text-blue-700" },
  HEAD_APPROVED:    { label: "Menunggu Kewangan",  color: "bg-yellow-100 text-yellow-700" },
  FINANCE_REVIEWED: { label: "Menunggu Kelulusan", color: "bg-purple-100 text-purple-700" },
  APPROVED:         { label: "Diluluskan",         color: "bg-green-100 text-green-700" },
  REJECTED:         { label: "Ditolak",            color: "bg-red-100 text-red-700" },
  PAID:             { label: "Dibayar",            color: "bg-emerald-100 text-emerald-700" },
  WITHDRAWN:        { label: "Tarik Balik",        color: "bg-gray-100 text-gray-500" },
};

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

  const statusCfg = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.DRAFT;
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

  const effectiveIsYdp = isYdp(user) || !!ydpDelegation;
  const showApproverPanel =
    (isApprover(user) || effectiveIsYdp || !!approverDelegation) &&
    (claim.status === ClaimStatus.FINANCE_REVIEWED ||
      (effectiveIsYdp && claim.status === ClaimStatus.APPROVED));

  return (
    <div className="space-y-4 pb-10">
      <BackButton />
      {sp.submitted === "1" && (
        <Alert className="border-green-300 bg-green-50 text-green-800">
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
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors"
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
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
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
              <p className={`font-semibold text-sm mt-0.5 ${claim.totalApprovedMyr ? "text-green-700" : ""}`}>
                {claim.totalApprovedMyr != null
                  ? `RM ${Number(claim.totalApprovedMyr).toFixed(2)}`
                  : "—"}
              </p>
            </div>
          </div>
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
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{r.vendor ?? "Vendor tidak diketahui"}</p>
                    {r.receiptDate && (
                      <p className="text-xs text-gray-500">
                        {new Date(r.receiptDate).toLocaleDateString("ms-MY")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-sm text-green-700">
                    RM {rTotal.toFixed(2)}
                  </span>
                </div>
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
                  ? "bg-green-500"
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
                      <span className={isRejected ? "text-red-600" : isApproved ? "text-green-700" : "text-gray-500"}>
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
