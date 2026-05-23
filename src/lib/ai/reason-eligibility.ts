const REASON_PROMPT = `Anda adalah pegawai semak tuntutan perubatan kerajaan Malaysia.
Tugas: kenal pasti item yang TIDAK layak dituntut di bawah manfaat perubatan kakitangan kerajaan.

TIDAK LAYAK:
- Vitamin / suplemen (kecuali ada nota doktor)
- Produk kosmetik / penjagaan diri
- Makanan & minuman
- Peralatan sukan / gimnasium
- Produk kecantikan
- Barangan am (bukan rawatan perubatan)
- Ubat tradisional / herba tanpa preskripsi

LAYAK:
- Bayaran konsultasi doktor / pakar
- Ubat-ubatan berpreskripsi
- Prosedur perubatan & pembedahan
- Ujian makmal / X-ray / scan
- Pergigian (rawatan, bukan kosmetik)
- Rawatan hospital / wad
- Alat bantu perubatan berpreskripsi (cermin mata, alat bantu dengar)

Vendor: {VENDOR}

Items (JSON):
{ITEMS}

Balas HANYA JSON array item yang TIDAK LAYAK:
[{ "idx": <nombor index>, "reason": "<sebab ringkas dalam BM>" }]

Jika semua layak, balas: []
JANGAN tambah sebarang teks lain.`;

interface EligibilityFlag {
  idx: number;
  reason: string;
}

export interface ItemEligibility {
  isEligible: boolean;
  llmReason: string | null;
}

export async function reasonEligibility(
  items: Array<{ description: string; qty: number; amountMyr: number }>,
  vendor: string | null
): Promise<ItemEligibility[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_REASONING_MODEL ?? process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b";

  const itemsJson = JSON.stringify(
    items.map((it, i) => ({ idx: i, description: it.description, qty: it.qty, amountMyr: it.amountMyr }))
  );
  const prompt = REASON_PROMPT
    .replace("{VENDOR}", vendor ?? "Tidak diketahui")
    .replace("{ITEMS}", itemsJson);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        format: "json",
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    const data = await res.json();
    const raw: unknown = JSON.parse(data.response ?? "[]");
    const flags = Array.isArray(raw) ? (raw as EligibilityFlag[]) : [];

    const flagMap = new Map<number, string>();
    for (const f of flags) {
      if (typeof f.idx === "number" && typeof f.reason === "string") {
        flagMap.set(f.idx, f.reason);
      }
    }

    return items.map((_, i) => {
      const reason = flagMap.get(i) ?? null;
      return { isEligible: reason === null, llmReason: reason };
    });
  } catch {
    // LLM reasoning failed — return all eligible (graceful degradation)
    return items.map(() => ({ isEligible: true, llmReason: null }));
  } finally {
    clearTimeout(timer);
  }
}
