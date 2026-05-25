import ExcelJS from "exceljs";

const MONTHS_BM = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

export interface ClaimRow {
  refNo: string;
  claimantName: string;
  staffNo: string | null;
  department: string | null;
  forMonth: number;
  forYear: number;
  claimFor: string;
  claimForChildNo: number | null;
  status: string;
  totalClaimedMyr: number;
  totalEligibleMyr: number | null;
  totalApprovedMyr: number | null;
  submittedAt: Date | null;
  paidAt: Date | null;
  voucherNo: string | null;
}

export async function generateLaporan(
  rows: ClaimRow[],
  filterLabel: string,
  orgName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Laporan Tuntutan");

  // Header rows
  ws.mergeCells("A1:O1");
  ws.getCell("A1").value = orgName;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:O2");
  ws.getCell("A2").value = `Laporan Tuntutan Perubatan — ${filterLabel}`;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.addRow([]);

  // Column headers
  const headerRow = ws.addRow([
    "No.", "Ref No.", "Nama Kakitangan", "No. Staf", "Jabatan",
    "Bulan", "Tahun", "Tuntutan Untuk", "Status", "Tuntut (RM)", "Layak (RM)", "Lulus (RM)", "Tarikh Hantar", "No. Baucer", "Tarikh Bayar",
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Set column widths
  ws.columns = [
    { key: "no", width: 5 },
    { key: "refNo", width: 20 },
    { key: "name", width: 25 },
    { key: "staffNo", width: 14 },
    { key: "dept", width: 20 },
    { key: "month", width: 12 },
    { key: "year", width: 8 },
    { key: "claimFor", width: 16 },
    { key: "status", width: 18 },
    { key: "claimed", width: 12 },
    { key: "eligible", width: 12 },
    { key: "approved", width: 12 },
    { key: "submitted", width: 14 },
    { key: "voucher", width: 18 },
    { key: "paid", width: 14 },
  ];

  function claimForText(claimFor: string, childNo: number | null): string {
    if (claimFor === "SPOUSE") return "Isteri / Suami";
    if (claimFor === "CHILD") return `Anak ke-${childNo ?? 1}`;
    return "Diri Sendiri";
  }

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draf", SUBMITTED: "Menunggu Sokongan", HEAD_APPROVED: "Menunggu Kewangan",
    FINANCE_REVIEWED: "Menunggu Kelulusan", APPROVED: "Diluluskan", REJECTED: "Ditolak", PAID: "Dibayar",
  };

  rows.forEach((row, i) => {
    const dataRow = ws.addRow([
      i + 1,
      row.refNo,
      row.claimantName,
      row.staffNo ?? "",
      row.department ?? "",
      MONTHS_BM[row.forMonth - 1] ?? row.forMonth,
      row.forYear,
      claimForText(row.claimFor, row.claimForChildNo),
      STATUS_LABELS[row.status] ?? row.status,
      row.totalClaimedMyr,
      row.totalEligibleMyr ?? "",
      row.totalApprovedMyr ?? "",
      row.submittedAt ? row.submittedAt.toLocaleDateString("ms-MY") : "",
      row.voucherNo ?? "",
      row.paidAt ? row.paidAt.toLocaleDateString("ms-MY") : "",
    ]);

    // Color rejected rows (status is now col 9)
    if (row.status === "REJECTED") {
      dataRow.getCell(9).font = { color: { argb: "FFDC2626" } };
    } else if (row.status === "APPROVED" || row.status === "PAID") {
      dataRow.getCell(9).font = { color: { argb: "FF166534" } };
    }

    // Format amounts
    [10, 11, 12].forEach((col) => {
      const cell = dataRow.getCell(col);
      if (typeof cell.value === "number") {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // Summary row
  ws.addRow([]);
  const totalClaimed = rows.reduce((s, r) => s + r.totalClaimedMyr, 0);
  const totalEligible = rows.reduce((s, r) => s + (r.totalEligibleMyr ?? 0), 0);
  const totalApproved = rows.reduce((s, r) => s + (r.totalApprovedMyr ?? 0), 0);
  const sumRow = ws.addRow(["", "", "", "", "", "", "", "JUMLAH", "", totalClaimed, totalEligible, totalApproved, "", "", ""]);
  sumRow.font = { bold: true };
  [10, 11, 12].forEach((col) => { sumRow.getCell(col).numFmt = '#,##0.00'; });

  ws.addRow([]);
  ws.addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", `Dijana: ${new Date().toLocaleDateString("ms-MY")}`]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
