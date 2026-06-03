import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdtemp, rmdir } from "fs/promises";
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
      const pngBuffer = await pdfToImageBuffer(file);
      body = {
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: [pngBuffer.toString("base64")],
        format: "json",
        stream: false,
        options: { temperature: 0.1 },
      };
    } else {
      body = {
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: [file.toString("base64")],
        format: "json",
        stream: false,
        options: { temperature: 0.1 },
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

// ─── PDF → PNG via Ghostscript (first page only) ─────────────────────────────

async function pdfToImageBuffer(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "receipt-pdf-"));
  const inputPath = join(dir, "input.pdf");
  const outputPath = join(dir, "out.png");
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("gs", [
      "-dQUIET", "-dNOPAUSE", "-dBATCH", "-dSAFER",
      "-sDEVICE=png16m", "-r150",
      "-dFirstPage=1", "-dLastPage=1",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
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
