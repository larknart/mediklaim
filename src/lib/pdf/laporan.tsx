import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ClaimRow } from "@/lib/excel/laporan";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const STATUS_BM: Record<string, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Tgg. Sokongan",
  HEAD_APPROVED: "Tgg. Kewangan",
  FINANCE_REVIEWED: "Tgg. Kelulusan",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  PAID: "Dibayar",
  WITHDRAWN: "Tarik Balik",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, padding: 32, color: "#1a1a1a" },
  orgName: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2 },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2, textTransform: "uppercase" },
  subtitle: { fontSize: 8, textAlign: "center", color: "#555", marginBottom: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#999", marginBottom: 8 },

  // Table
  tableHeader: { flexDirection: "row", backgroundColor: "#1c5e2f", padding: "4 4" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0", padding: "3 4" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0", padding: "3 4", backgroundColor: "#f7f7f7" },
  tableRowTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#999", padding: "4 4", backgroundColor: "#f0f7f0" },
  th: { fontFamily: "Helvetica-Bold", color: "#fff", fontSize: 7.5 },
  td: { fontSize: 7.5, color: "#1a1a1a" },
  tdMuted: { fontSize: 7.5, color: "#888", textDecoration: "line-through" },
  tdRed: { fontSize: 7.5, color: "#c62828" },
  tdGreen: { fontSize: 7.5, color: "#1c5e2f", fontFamily: "Helvetica-Bold" },

  // Columns (landscape A4 = ~769pt usable)
  cNo: { width: 20, textAlign: "right" },
  cRef: { width: 78, paddingLeft: 4 },
  cName: { flex: 1, paddingLeft: 4 },
  cStaff: { width: 50, textAlign: "center" },
  cDept: { width: 85, paddingLeft: 4 },
  cMonth: { width: 44, textAlign: "center" },
  cFor: { width: 65, textAlign: "center" },
  cStatus: { width: 70, textAlign: "center" },
  cAmt: { width: 58, textAlign: "right" },

  // Summary
  summarySection: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  summaryBox: { borderWidth: 0.5, borderColor: "#ccc", borderRadius: 3, padding: "4 8", alignItems: "center" },
  summaryLabel: { fontSize: 7, color: "#555", marginBottom: 1 },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  summaryValueGreen: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1c5e2f" },

  // Signature
  signatureSection: { marginTop: 24, flexDirection: "row", gap: 40 },
  signatureBox: { flex: 1 },
  signatureLine: { borderTopWidth: 0.75, borderTopColor: "#555", marginTop: 24, paddingTop: 4 },
  signatureLabel: { fontSize: 7.5, color: "#333" },
  signatureDate: { fontSize: 7, color: "#888", marginTop: 2 },

  // Footer
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 3 },
  footerText: { fontSize: 6.5, color: "#aaa" },
});

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ms-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function claimForText(claimFor: string, childNo: number | null): string {
  if (claimFor === "SPOUSE") return "Pasangan";
  if (claimFor === "CHILD") return `Anak ke-${childNo ?? 1}`;
  return "Diri";
}

interface LaporanPdfData {
  orgName: string;
  filterLabel: string;
  rows: ClaimRow[];
  generatedAt: string;
}

function LaporanDocument({ data }: { data: LaporanPdfData }) {
  const totalClaimed = data.rows.reduce((s, r) => s + r.totalClaimedMyr, 0);
  const totalEligible = data.rows.reduce((s, r) => s + (r.totalEligibleMyr ?? 0), 0);
  const totalApproved = data.rows.reduce((s, r) => s + (r.totalApprovedMyr ?? 0), 0);
  const countApproved = data.rows.filter((r) => r.status === "APPROVED" || r.status === "PAID").length;
  const countRejected = data.rows.filter((r) => r.status === "REJECTED").length;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <Text style={s.orgName}>{data.orgName}</Text>
        <Text style={s.title}>Laporan Tuntutan Perubatan</Text>
        <Text style={s.subtitle}>{data.filterLabel}</Text>
        <View style={s.divider} />

        {/* Table */}
        <View style={s.tableHeader}>
          <Text style={[s.th, s.cNo]}>No.</Text>
          <Text style={[s.th, s.cRef]}>No. Rujukan</Text>
          <Text style={[s.th, s.cName]}>Nama Kakitangan</Text>
          <Text style={[s.th, s.cStaff]}>No. Staf</Text>
          <Text style={[s.th, s.cDept]}>Jabatan</Text>
          <Text style={[s.th, s.cMonth]}>Bulan</Text>
          <Text style={[s.th, s.cFor]}>Untuk</Text>
          <Text style={[s.th, s.cStatus]}>Status</Text>
          <Text style={[s.th, s.cAmt]}>Tuntut (RM)</Text>
          <Text style={[s.th, s.cAmt]}>Layak (RM)</Text>
          <Text style={[s.th, s.cAmt]}>Lulus (RM)</Text>
        </View>

        {data.rows.map((row, i) => {
          const isWithdrawn = row.status === "WITHDRAWN";
          const isApproved = row.status === "APPROVED" || row.status === "PAID";
          const isRejected = row.status === "REJECTED";
          const rowStyle = i % 2 === 0 ? s.tableRow : s.tableRowAlt;
          const tdStyle = isWithdrawn ? s.tdMuted : isRejected ? s.tdRed : s.td;
          return (
            <View key={i} style={rowStyle}>
              <Text style={[tdStyle, s.cNo]}>{i + 1}</Text>
              <Text style={[tdStyle, s.cRef]}>{row.refNo}</Text>
              <Text style={[tdStyle, s.cName]}>{row.claimantName}</Text>
              <Text style={[tdStyle, s.cStaff]}>{row.staffNo ?? "—"}</Text>
              <Text style={[tdStyle, s.cDept]}>{row.department ?? "—"}</Text>
              <Text style={[tdStyle, s.cMonth]}>{MONTHS_BM[row.forMonth - 1]?.slice(0, 3)} {row.forYear}</Text>
              <Text style={[tdStyle, s.cFor]}>{claimForText(row.claimFor, row.claimForChildNo)}</Text>
              <Text style={[isApproved ? s.tdGreen : tdStyle, s.cStatus]}>{STATUS_BM[row.status] ?? row.status}</Text>
              <Text style={[tdStyle, s.cAmt]}>{fmt(row.totalClaimedMyr)}</Text>
              <Text style={[tdStyle, s.cAmt]}>{fmt(row.totalEligibleMyr)}</Text>
              <Text style={[isApproved ? s.tdGreen : tdStyle, s.cAmt]}>{fmt(row.totalApprovedMyr)}</Text>
            </View>
          );
        })}

        {/* Totals row */}
        <View style={s.tableRowTotal}>
          <Text style={[s.th, s.cNo]} />
          <Text style={[s.th, s.cRef]} />
          <Text style={[s.th, s.cName]} />
          <Text style={[s.th, s.cStaff]} />
          <Text style={[s.th, s.cDept]} />
          <Text style={[s.th, s.cMonth]} />
          <Text style={[s.th, s.cFor]} />
          <Text style={[s.th, s.cStatus, { color: "#1a1a1a" }]}>JUMLAH</Text>
          <Text style={[s.th, s.cAmt, { color: "#1a1a1a" }]}>{fmt(totalClaimed)}</Text>
          <Text style={[s.th, s.cAmt, { color: "#1a1a1a" }]}>{fmt(totalEligible)}</Text>
          <Text style={[s.th, s.cAmt, { color: "#1c5e2f" }]}>{fmt(totalApproved)}</Text>
        </View>

        {/* Summary boxes */}
        <View style={s.summarySection}>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Jumlah Tuntutan</Text>
            <Text style={s.summaryValue}>{data.rows.length}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Diluluskan</Text>
            <Text style={s.summaryValueGreen}>{countApproved}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Ditolak</Text>
            <Text style={[s.summaryValue, { color: "#c62828" }]}>{countRejected}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Jumlah Lulus (RM)</Text>
            <Text style={s.summaryValueGreen}>{fmt(totalApproved)}</Text>
          </View>
        </View>

        {/* Signature block */}
        <View style={s.signatureSection}>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Disediakan oleh</Text>
            <Text style={s.signatureDate}>Tarikh: _______________</Text>
          </View>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Disahkan oleh (Pegawai Kewangan)</Text>
            <Text style={s.signatureDate}>Tarikh: _______________</Text>
          </View>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Diluluskan oleh (Setiausaha / YDP)</Text>
            <Text style={s.signatureDate}>Tarikh: _______________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>MediKlaim MDS — SULIT</Text>
          <Text style={s.footerText}>Dijana: {data.generatedAt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Muka surat ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateLaporanPdf(
  rows: ClaimRow[],
  filterLabel: string,
  orgName: string
): Promise<Buffer> {
  const generatedAt = new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" });
  const buffer = await renderToBuffer(
    <LaporanDocument data={{ orgName, filterLabel, rows, generatedAt }} />
  );
  return Buffer.from(buffer);
}
