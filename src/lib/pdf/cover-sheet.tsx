import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const STATUS_BM: Record<string, string> = {
  SUBMITTED: "Menunggu Sokongan",
  HEAD_APPROVED: "Menunggu Kewangan",
  FINANCE_REVIEWED: "Menunggu Kelulusan",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  PAID: "Dibayar",
  WITHDRAWN: "Tarik Balik",
};

const STEP_BM: Record<string, string> = {
  HEAD: "Ketua Jabatan",
  FINANCE: "Pegawai Kewangan",
  APPROVER: "Pelulus (Setiausaha/YDP)",
};

const DECISION_BM: Record<string, string> = {
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  OVERRIDDEN: "Override",
  SKIPPED: "Auto-skip",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 36, color: "#1a1a1a" },
  orgName: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2 },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#999", marginBottom: 10 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#555", marginBottom: 4, letterSpacing: 0.5 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, color: "#555" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  table: { width: "100%" },
  tableHeader: { flexDirection: "row", backgroundColor: "#1c5e2f", color: "#fff", padding: "4 6" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", padding: "3 6" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", padding: "3 6", backgroundColor: "#f7f7f7" },
  th: { fontFamily: "Helvetica-Bold", color: "#fff", fontSize: 8 },
  td: { fontSize: 8 },
  tdStrike: { fontSize: 8, color: "#aaa", textDecoration: "line-through" },
  colDesc: { flex: 3 },
  colQty: { width: 30, textAlign: "center" },
  colUnit: { width: 55, textAlign: "right" },
  colAmt: { width: 55, textAlign: "right" },
  colStatus: { width: 45, textAlign: "center" },
  receiptHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#e8f5e9", padding: "4 6", marginTop: 6, borderTopWidth: 1, borderTopColor: "#c8e6c9" },
  receiptVendor: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  receiptDate: { fontSize: 8, color: "#555" },
  summaryRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  summaryLabel: { width: 130, textAlign: "right", color: "#555", marginRight: 8 },
  summaryValue: { width: 70, textAlign: "right", fontFamily: "Helvetica-Bold" },
  summaryValueGreen: { width: 70, textAlign: "right", fontFamily: "Helvetica-Bold", color: "#1c5e2f" },
  approvalRow: { flexDirection: "row", marginBottom: 5, borderLeftWidth: 2, borderLeftColor: "#ccc", paddingLeft: 8 },
  approvalStep: { width: 140, fontFamily: "Helvetica-Bold" },
  approvalActor: { flex: 1 },
  approvalDecision: { width: 70, textAlign: "center" },
  decisionApproved: { color: "#1c5e2f", fontFamily: "Helvetica-Bold" },
  decisionRejected: { color: "#c62828", fontFamily: "Helvetica-Bold" },
  decisionSkip: { color: "#888" },
  signatureBlock: { flexDirection: "row", marginTop: 20, gap: 20 },
  signatureBox: { flex: 1, borderTopWidth: 1, borderTopColor: "#555", paddingTop: 4 },
  signatureLabel: { fontSize: 8, color: "#555" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  footerText: { fontSize: 7, color: "#999" },
});

export interface CoverSheetData {
  orgName: string;
  refNo: string;
  claimantName: string;
  staffNo: string | null;
  departmentName: string | null;
  forMonth: number;
  forYear: number;
  claimFor: string;
  claimForChildNo: number | null;
  status: string;
  submittedAt: Date | null;
  totalClaimedMyr: number;
  totalEligibleMyr: number | null;
  totalApprovedMyr: number | null;
  receipts: Array<{
    vendor: string | null;
    receiptDate: Date | null;
    items: Array<{
      description: string;
      qty: number;
      unitMyr: number;
      amountMyr: number;
      isEligible: boolean;
      flaggedReason: string | null;
    }>;
  }>;
  approvals: Array<{
    step: string;
    actorName: string;
    decision: string;
    comment: string | null;
    decidedAt: Date;
  }>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function CoverSheet({ data }: { data: CoverSheetData }) {
  const generatedAt = new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.orgName}>{data.orgName}</Text>
        <Text style={s.title}>Borang Tuntutan Perubatan</Text>
        <View style={s.divider} />

        {/* Claim info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Maklumat Tuntutan</Text>
          <InfoRow label="No. Rujukan" value={data.refNo} />
          <InfoRow label="Nama Pemohon" value={data.claimantName} />
          {data.staffNo && <InfoRow label="No. Kakitangan" value={data.staffNo} />}
          <InfoRow label="Jabatan" value={data.departmentName ?? "—"} />
          <InfoRow
            label="Tuntutan Untuk"
            value={
              data.claimFor === "SPOUSE"
                ? "Isteri / Suami"
                : data.claimFor === "CHILD"
                ? `Anak ke-${data.claimForChildNo ?? 1}`
                : "Diri Sendiri"
            }
          />
          <InfoRow label="Tempoh Tuntutan" value={`${MONTHS_BM[data.forMonth - 1]} ${data.forYear}`} />
          <InfoRow label="Tarikh Hantar" value={data.submittedAt ? new Date(data.submittedAt).toLocaleDateString("ms-MY") : "—"} />
          <InfoRow label="Status" value={STATUS_BM[data.status] ?? data.status} />
        </View>

        {/* Receipts */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Senarai Resit</Text>
          {data.receipts.map((r, ri) => (
            <View key={ri}>
              <View style={s.receiptHeader}>
                <Text style={s.receiptVendor}>{r.vendor ?? "Vendor tidak diketahui"}</Text>
                <Text style={s.receiptDate}>
                  {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString("ms-MY") : ""}
                </Text>
              </View>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, s.colDesc]}>Perkara</Text>
                  <Text style={[s.th, s.colQty]}>Qty</Text>
                  <Text style={[s.th, s.colUnit]}>Unit (RM)</Text>
                  <Text style={[s.th, s.colAmt]}>Amaun (RM)</Text>
                  <Text style={[s.th, s.colStatus]}>Status</Text>
                </View>
                {r.items.map((item, ii) => (
                  <View key={ii} style={ii % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <View style={s.colDesc}>
                      <Text style={item.isEligible ? s.td : s.tdStrike}>{item.description}</Text>
                      {item.flaggedReason && (
                        <Text style={{ fontSize: 7, color: "#c62828" }}>{item.flaggedReason}</Text>
                      )}
                    </View>
                    <Text style={[item.isEligible ? s.td : s.tdStrike, s.colQty]}>{item.qty}</Text>
                    <Text style={[item.isEligible ? s.td : s.tdStrike, s.colUnit]}>{item.unitMyr.toFixed(2)}</Text>
                    <Text style={[item.isEligible ? s.td : s.tdStrike, s.colAmt]}>{item.amountMyr.toFixed(2)}</Text>
                    <Text style={[s.td, s.colStatus, { color: item.isEligible ? "#1c5e2f" : "#c62828" }]}>
                      {item.isEligible ? "Layak" : "Tidak Layak"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={s.section}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Jumlah Dituntut (RM)</Text>
            <Text style={s.summaryValue}>{data.totalClaimedMyr.toFixed(2)}</Text>
          </View>
          {data.totalEligibleMyr != null && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Jumlah Layak (RM)</Text>
              <Text style={s.summaryValue}>{data.totalEligibleMyr.toFixed(2)}</Text>
            </View>
          )}
          {data.totalApprovedMyr != null && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Jumlah Diluluskan (RM)</Text>
              <Text style={s.summaryValueGreen}>{data.totalApprovedMyr.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Approval trail */}
        {data.approvals.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Rekod Kelulusan</Text>
            {data.approvals.map((apv, i) => {
              const isApproved = apv.decision === "APPROVED" || apv.decision === "SKIPPED";
              const isRejected = apv.decision === "REJECTED";
              const decisionStyle = isApproved ? s.decisionApproved : isRejected ? s.decisionRejected : s.decisionSkip;
              return (
                <View key={i} style={s.approvalRow}>
                  <Text style={s.approvalStep}>{STEP_BM[apv.step] ?? apv.step}</Text>
                  <View style={s.approvalActor}>
                    <Text>{apv.actorName}</Text>
                    {apv.comment && <Text style={{ fontSize: 7, color: "#666", fontStyle: "italic" }}>"{apv.comment}"</Text>}
                  </View>
                  <View style={{ width: 100, alignItems: "flex-end" }}>
                    <Text style={decisionStyle}>{DECISION_BM[apv.decision] ?? apv.decision}</Text>
                    <Text style={{ fontSize: 7, color: "#888" }}>{new Date(apv.decidedAt).toLocaleDateString("ms-MY")}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Signature block */}
        <View style={s.signatureBlock}>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Tandatangan Pemohon</Text>
            <Text style={{ fontSize: 8, marginTop: 12 }}>{data.claimantName}</Text>
          </View>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Disahkan Oleh</Text>
          </View>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Cop Rasmi</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.orgName} — {data.refNo}</Text>
          <Text style={s.footerText}>Jana: {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateCoverSheet(data: CoverSheetData): Promise<Buffer> {
  const buffer = await renderToBuffer(<CoverSheet data={data} />);
  return Buffer.from(buffer);
}
