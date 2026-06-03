import { z } from "zod";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, readdir, unlink, mkdtemp, rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ReceiptItemSchema = z.object({
  description: z.string(),
  qty: z.number().int().positive().default(1),
  unitMyr: z.number().nonnegative(),
  amountMyr: z.number().nonnegative(),
});

const ExtractedReceiptSchema = z.object({
  receiptDate: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  totalMyr: z.number().nonnegative().nullable().optional(),
  items: z.array(ReceiptItemSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;
export type ExtractedReceiptItem = z.infer<typeof ReceiptItemSchema>;

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ReceiptExtractor {
  extract(file: Buffer, mime: string): Promise<ExtractedReceipt>;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an OCR assistant analyzing a Malaysian medical receipt.
Extract structured data and return ONLY valid JSON with this exact structure:
{
  "receiptDate": "YYYY-MM-DD or null",
  "vendor": "clinic/pharmacy name or null",
  "totalMyr": numeric total in MYR or null,
  "items": [
    { "description": "item name", "qty": 1, "unitMyr": 0.00, "amountMyr": 0.00 }
  ],
  "confidence": 0.0 to 1.0
}
Rules:
- Line items are usually numbered (1, 2, 3...). Count them first, then extract EVERY numbered item — your items array must contain the same count
- Extract EVERY SINGLE item listed on the receipt — do not skip, truncate, or summarise any line item
- Read item names EXACTLY as printed — do not guess or substitute medicine names
- All monetary values in MYR as plain numbers (no RM symbol)
- If item qty/unit unclear, set qty=1 and unitMyr=amountMyr
- For non-itemized receipts (lump sum, only total visible): create ONE item with description = the receipt purpose/reason (e.g. "Rawatan", "Konsultasi", "Perubatan"), qty=1, unitMyr=totalMyr, amountMyr=totalMyr
- NEVER set amountMyr=0 if the receipt shows a total amount — use totalMyr as amountMyr for that item
- items array must NEVER be empty if totalMyr is known
- confidence: 0.9+ if clearly readable, 0.5-0.9 if partial, <0.5 if poor quality
- Do not add explanations, only JSON`;

// ─── Ollama extractor ─────────────────────────────────────────────────────────

export class OllamaExtractor implements ReceiptExtractor {
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model = process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b",
    timeoutMs = 60_000
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async extract(file: Buffer, mime: string): Promise<ExtractedReceipt> {
    let body: Record<string, unknown>;

    if (mime === "application/pdf") {
      const pages = await pdfToImageBuffers(file);
      body = {
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: pages.map((p) => p.toString("base64")),
        format: "json",
        stream: false,
        options: { temperature: 0.1, num_predict: 2048 },
      };
    } else {
      body = {
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: [file.toString("base64")],
        format: "json",
        stream: false,
        options: { temperature: 0.1, num_predict: 2048 },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const raw = JSON.parse(data.response ?? "{}");
      return ExtractedReceiptSchema.parse(raw);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Gemini extractor ─────────────────────────────────────────────────────────

export class GeminiExtractor implements ReceiptExtractor {
  private apiKey: string;

  constructor(apiKey = process.env.GEMINI_API_KEY ?? "") {
    this.apiKey = apiKey;
  }

  async extract(file: Buffer, mime: string): Promise<ExtractedReceipt> {
    const base64 = file.toString("base64");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          },
        ],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      }),
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return ExtractedReceiptSchema.parse(JSON.parse(text));
  }
}

// ─── Manual extractor (no-op) ─────────────────────────────────────────────────

export class ManualExtractor implements ReceiptExtractor {
  async extract(): Promise<ExtractedReceipt> {
    return { items: [], confidence: 0 };
  }
}

// ─── PDF → PNG pages via pdftocairo (Cairo renderer, matches browser quality) ──

async function pdfToImageBuffers(buffer: Buffer): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), "receipt-pdf-"));
  const inputPath = join(dir, "input.pdf");
  const outputPrefix = join(dir, "out");
  try {
    await writeFile(inputPath, buffer);
    // pdftocairo: single-page → out.png, multi-page → out-1.png, out-2.png, ...
    await execFileAsync("pdftocairo", [
      "-png", "-r", "300",
      inputPath, outputPrefix,
    ]);

    // Collect all generated .png files sorted by page number
    const allFiles = await readdir(dir);
    const pngFiles = allFiles
      .filter((f) => f.startsWith("out") && f.endsWith(".png"))
      .sort((a, b) => {
        // "out.png" = page 1, "out-N.png" = page N
        const numA = parseInt(a.replace(/^out-?(\d*)\.png$/, "$1") || "1");
        const numB = parseInt(b.replace(/^out-?(\d*)\.png$/, "$1") || "1");
        return numA - numB;
      });

    if (pngFiles.length === 0) throw new Error("pdftocairo: no pages rendered");

    // Post-process with sharp: grayscale + normalise + sharpen → crisper text for OCR
    const pages = await Promise.all(
      pngFiles.map(async (f) => {
        const raw = await readFile(join(dir, f));
        return sharp(raw).grayscale().normalise().sharpen().png().toBuffer();
      })
    );
    return pages;
  } finally {
    await unlink(inputPath).catch(() => {});
    // Clean up any leftover pngs
    const remaining = await readdir(dir).catch(() => [] as string[]);
    await Promise.all(remaining.map((f) => unlink(join(dir, f)).catch(() => {})));
    await rmdir(dir).catch(() => {});
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createExtractor(overrides?: {
  provider?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}): ReceiptExtractor {
  const provider = overrides?.provider ?? process.env.AI_PROVIDER ?? "manual";
  const baseUrl = overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL;
  const model = overrides?.model ?? process.env.OLLAMA_MODEL;
  const timeoutMs = overrides?.timeoutMs ?? 60_000;

  switch (provider) {
    case "ollama":
      return new OllamaExtractor(baseUrl, model, timeoutMs);
    case "gemini":
      return new GeminiExtractor();
    default:
      return new ManualExtractor();
  }
}
