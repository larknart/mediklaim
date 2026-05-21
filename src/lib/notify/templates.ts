// Email + WhatsApp message templates.
// All templates return BM text.

interface ClaimContext {
  claimantName: string;
  refNo: string;
  forMonth: number;
  forYear: number;
  totalMyr: number;
  link?: string;
}

const MONTHS_BM = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

function monthName(m: number) {
  return MONTHS_BM[m - 1] ?? m.toString();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Selamat pagi";
  if (h < 17) return "Selamat tengah hari";
  return "Selamat petang";
}

// ─── WA templates (plain text, personalised) ──────────────────────────────────

export function waCLAIM_APPROVED(ctx: ClaimContext): string {
  return `${greeting()} ${ctx.claimantName},\n\nTuntutan perubatan anda *${ctx.refNo}* bagi bulan *${monthName(ctx.forMonth)} ${ctx.forYear}* telah *DILULUSKAN*.\n\nAmaun diluluskan: *RM ${ctx.totalMyr.toFixed(2)}*\n\nBayaran akan diproses oleh bahagian Kewangan. Terima kasih.`;
}

export function waCLAIM_REJECTED(ctx: ClaimContext & { reason?: string }): string {
  return `${greeting()} ${ctx.claimantName},\n\nMaaf, tuntutan perubatan anda *${ctx.refNo}* bagi bulan *${monthName(ctx.forMonth)} ${ctx.forYear}* telah *DITOLAK*.\n\n${ctx.reason ? `Sebab: ${ctx.reason}\n\n` : ""}Sila hubungi bahagian Kewangan untuk maklumat lanjut.`;
}

export function waACTION_REQUIRED(
  recipientName: string,
  role: string,
  refNo: string,
  claimantName: string,
  daysPending: number
): string {
  return `${greeting()} ${recipientName},\n\nTerdapat tuntutan yang memerlukan tindakan anda:\n\n*Ref:* ${refNo}\n*Pemohon:* ${claimantName}\n*Peringkat:* ${role}\n*Tertangguh:* ${daysPending} hari\n\nSila log masuk ke sistem MediKlaim untuk menyemak.`;
}

// ─── Email templates (HTML) ───────────────────────────────────────────────────

function emailLayout(title: string, body: string, link?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:24px;max-width:600px;margin:0 auto}
  .header{background:#0f5132;color:#fff;border-radius:8px 8px 0 0;padding:16px 24px;margin:-24px -24px 24px}
  .btn{display:inline-block;background:#0f5132;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px}
  .footer{color:#999;font-size:12px;margin-top:24px;text-align:center}
  </style></head><body>
  <div class="card">
    <div class="header"><h2 style="margin:0">MediKlaim MDS</h2></div>
    <h3>${title}</h3>
    ${body}
    ${link ? `<a href="${link}" class="btn">Lihat Tuntutan</a>` : ""}
    <div class="footer">Majlis Daerah Setiu &bull; Sistem Tuntutan Perubatan Elektronik</div>
  </div></body></html>`;
}

export function emailCLAIM_SUBMITTED(ctx: ClaimContext) {
  return {
    subject: `[MediKlaim] Tuntutan ${ctx.refNo} Diterima`,
    html: emailLayout(
      "Tuntutan Diterima",
      `<p>Tuntutan perubatan anda untuk <strong>${monthName(ctx.forMonth)} ${ctx.forYear}</strong> telah diterima.</p>
       <table><tr><td>Ref No:</td><td><strong>${ctx.refNo}</strong></td></tr>
       <tr><td>Amaun:</td><td><strong>RM ${ctx.totalMyr.toFixed(2)}</strong></td></tr></table>
       <p>Tuntutan akan disemak oleh Ketua Jabatan anda.</p>`,
      ctx.link
    ),
  };
}

export function emailCLAIM_APPROVED(ctx: ClaimContext) {
  return {
    subject: `[MediKlaim] Tuntutan ${ctx.refNo} Diluluskan`,
    html: emailLayout(
      "Tuntutan Diluluskan ✓",
      `<p>Tuntutan perubatan anda <strong>${ctx.refNo}</strong> bagi <strong>${monthName(ctx.forMonth)} ${ctx.forYear}</strong> telah <span style="color:green;font-weight:bold">DILULUSKAN</span>.</p>
       <p>Amaun diluluskan: <strong>RM ${ctx.totalMyr.toFixed(2)}</strong></p>
       <p>Bayaran akan diproses oleh bahagian Kewangan.</p>`,
      ctx.link
    ),
  };
}

export function emailCLAIM_REJECTED(ctx: ClaimContext & { reason?: string }) {
  return {
    subject: `[MediKlaim] Tuntutan ${ctx.refNo} Ditolak`,
    html: emailLayout(
      "Tuntutan Ditolak",
      `<p>Tuntutan perubatan anda <strong>${ctx.refNo}</strong> bagi <strong>${monthName(ctx.forMonth)} ${ctx.forYear}</strong> telah <span style="color:red;font-weight:bold">DITOLAK</span>.</p>
       ${ctx.reason ? `<p>Sebab: ${ctx.reason}</p>` : ""}
       <p>Sila hubungi bahagian Kewangan untuk maklumat lanjut.</p>`,
      ctx.link
    ),
  };
}

export function emailACTION_REQUIRED(
  recipientName: string,
  role: string,
  ctx: ClaimContext
) {
  return {
    subject: `[MediKlaim] Tindakan Diperlukan: ${ctx.refNo}`,
    html: emailLayout(
      "Tindakan Diperlukan",
      `<p>Yang Berhormat / Tuan / Puan <strong>${recipientName}</strong>,</p>
       <p>Terdapat tuntutan yang memerlukan tindakan anda sebagai <strong>${role}</strong>:</p>
       <table>
         <tr><td>Ref No:</td><td><strong>${ctx.refNo}</strong></td></tr>
         <tr><td>Pemohon:</td><td><strong>${ctx.claimantName}</strong></td></tr>
         <tr><td>Bulan:</td><td>${monthName(ctx.forMonth)} ${ctx.forYear}</td></tr>
         <tr><td>Amaun:</td><td>RM ${ctx.totalMyr.toFixed(2)}</td></tr>
       </table>`,
      ctx.link
    ),
  };
}
