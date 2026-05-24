import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createExtractor } from "@/lib/ai/extract-receipt";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "Tiada fail." }, { status: 400 });

  const rows = await prisma.settings.findMany({
    where: { key: { in: ["ai_provider", "ai_ollama_base_url", "ai_ollama_model", "ai_timeout_seconds"] } },
  });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const buffer = Buffer.from(await file.arrayBuffer());
  const extractor = createExtractor({
    provider: typeof s["ai_provider"] === "string" ? s["ai_provider"] : undefined,
    baseUrl: typeof s["ai_ollama_base_url"] === "string" ? s["ai_ollama_base_url"] : undefined,
    model: typeof s["ai_ollama_model"] === "string" ? s["ai_ollama_model"] : undefined,
    timeoutMs: (() => { const n = Number(s["ai_timeout_seconds"]); return !isNaN(n) && n > 0 ? n * 1000 : undefined; })(),
  });

  try {
    const result = await extractor.extract(buffer, file.type);
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
