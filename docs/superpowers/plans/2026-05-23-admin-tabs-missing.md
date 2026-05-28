# Admin Settings — Missing Tabs (AI/OCR, Keselamatan, Sistem, Ref No) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 missing admin settings tabs completing the 11-tab admin settings module at `/admin/tetapan`.

**Architecture:** Each tab is a `"use client"` component in `_components/`. Settings stored in existing `Settings` key-value table via `updateSetting()` from `admin.ts`. Functional libs (extract-receipt, auth, refno) updated to read DB settings with env-var fallback. Maintenance mode enforced in `(app)/layout.tsx`. No schema migration needed.

**Tech Stack:** Next.js App Router (server + client components), shadcn/ui, Prisma Settings k-v table, existing `updateSetting()` server action.

---

## File Map

**Create:**
- `src/app/(app)/admin/tetapan/_components/ai-settings.tsx`
- `src/app/(app)/admin/tetapan/_components/security-settings.tsx`
- `src/app/(app)/admin/tetapan/_components/sistem-settings.tsx`
- `src/app/(app)/admin/tetapan/_components/refno-settings.tsx`
- `src/app/api/admin/test-ai/route.ts`
- `src/app/maintenance/page.tsx`

**Modify:**
- `src/lib/ai/extract-receipt.ts` — `createExtractor()` accepts optional overrides
- `src/lib/ai/reason-eligibility.ts` — accept optional `baseUrl`/`model` params
- `src/server/actions/receipt.ts` — fetch AI settings from DB, pass to extractor + reasoner
- `src/lib/auth.ts` — read `login_max_attempts` + `login_lock_duration_min` from DB
- `src/lib/refno.ts` — read `ref_no_prefix` + `ref_no_padding` from DB
- `src/server/actions/admin.ts` — add `getSystemStats()`
- `src/app/(app)/layout.tsx` — check `maintenance_mode` setting
- `src/app/(app)/resit/[id]/page.tsx` — read `ai_confidence_threshold` from DB
- `src/app/(app)/admin/tetapan/page.tsx` — wire 4 new tabs, fix TabsList layout

---

## Task 1: Update AI libs to accept DB setting overrides

**Files:**
- Modify: `src/lib/ai/extract-receipt.ts`
- Modify: `src/lib/ai/reason-eligibility.ts`
- Modify: `src/server/actions/receipt.ts`

- [ ] **Step 1: Update `createExtractor()` signature**

In `src/lib/ai/extract-receipt.ts`, replace the `createExtractor` function at the bottom of the file:

```typescript
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
```

- [ ] **Step 2: Update `reasonEligibility()` to accept optional overrides**

In `src/lib/ai/reason-eligibility.ts`, find the function signature and add an optional third param. The function currently reads from `process.env` at the top. Change the first few lines of the function body:

Find the existing function signature (something like):
```typescript
export async function reasonEligibility(
  items: ...,
  vendor: string | null
```

Replace with:
```typescript
export async function reasonEligibility(
  items: Array<{ description: string; qty: number; amountMyr: number }>,
  vendor: string | null,
  opts?: { baseUrl?: string; model?: string }
```

Then replace the env-reading lines at the top of the function body:
```typescript
  const baseUrl = opts?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = opts?.model ?? process.env.OLLAMA_REASONING_MODEL ?? process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b";
```

- [ ] **Step 3: Update `receipt.ts` to pass DB settings to AI calls**

In `src/server/actions/receipt.ts`, in the `extractReceiptBackground` function, before the `createExtractor()` call, add a DB fetch for AI settings. Replace:

```typescript
  const extractor = createExtractor();
```

With:

```typescript
  const aiRows = await prisma.settings.findMany({
    where: { key: { in: ["ai_provider", "ai_ollama_base_url", "ai_ollama_model", "ai_timeout_seconds"] } },
  });
  const aiS = Object.fromEntries(aiRows.map((r) => [r.key, r.value]));
  const extractor = createExtractor({
    provider: typeof aiS["ai_provider"] === "string" ? aiS["ai_provider"] : undefined,
    baseUrl: typeof aiS["ai_ollama_base_url"] === "string" ? aiS["ai_ollama_base_url"] : undefined,
    model: typeof aiS["ai_ollama_model"] === "string" ? aiS["ai_ollama_model"] : undefined,
    timeoutMs: typeof aiS["ai_timeout_seconds"] === "number" ? aiS["ai_timeout_seconds"] * 1000 : undefined,
  });
```

Also update the `reasonEligibility` call in the same function, pass opts:

```typescript
      llmFlags = await reasonEligibility(
        result.items.map((i) => ({ description: i.description, qty: i.qty, amountMyr: i.amountMyr })),
        result.vendor ?? null,
        {
          baseUrl: typeof aiS["ai_ollama_base_url"] === "string" ? aiS["ai_ollama_base_url"] : undefined,
          model: typeof aiS["ai_ollama_model"] === "string" ? aiS["ai_ollama_model"] : undefined,
        }
      );
```

- [ ] **Step 4: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/extract-receipt.ts src/lib/ai/reason-eligibility.ts src/server/actions/receipt.ts
git commit -m "refactor: AI libs accept DB setting overrides, receipt.ts reads AI config from DB"
```

---

## Task 2: Tab AI / OCR — component + test-ai route + confidence threshold

**Files:**
- Create: `src/app/(app)/admin/tetapan/_components/ai-settings.tsx`
- Create: `src/app/api/admin/test-ai/route.ts`
- Modify: `src/app/(app)/resit/[id]/page.tsx`

- [ ] **Step 1: Create `ai-settings.tsx`**

```typescript
"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Cpu, FlaskConical } from "lucide-react";

interface AiSettingsProps {
  provider: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  confidenceThreshold: number;
  timeoutSeconds: number;
  retryCount: number;
}

export function AiSettings(props: AiSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [provider, setProvider] = useState(props.provider);
  const [baseUrl, setBaseUrl] = useState(props.ollamaBaseUrl);
  const [model, setModel] = useState(props.ollamaModel);
  const [threshold, setThreshold] = useState(String(props.confidenceThreshold));
  const [timeout, setTimeout_] = useState(String(props.timeoutSeconds));
  const [retry, setRetry] = useState(String(props.retryCount));

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("ai_provider", provider);
        await updateSetting("ai_ollama_base_url", baseUrl.trim());
        await updateSetting("ai_ollama_model", model.trim());
        await updateSetting("ai_confidence_threshold", parseFloat(threshold));
        await updateSetting("ai_timeout_seconds", parseInt(timeout));
        await updateSetting("ai_retry_count", parseInt(retry));
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  async function testExtract() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setTestResult("Pilih fail resit dahulu."); return; }
    setTesting(true);
    setTestResult("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/test-ai", { method: "POST", body: fd });
      const json = await res.json();
      setTestResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setTestResult("Gagal: " + String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Konfigurasi AI / OCR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Provider</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="manual">Manual (AI dimatikan)</option>
              <option value="ollama">Ollama (self-hosted)</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          {provider === "ollama" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Ollama Base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://172.17.37.213:11434"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Model</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="qwen2.5vl:7b"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Threshold keyakinan (0–1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Bawah nilai ini → amaran kuning di resit</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Timeout (saat)</Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={timeout}
                onChange={(e) => setTimeout_(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Bilangan cuba semula</Label>
              <Input
                type="number"
                min="0"
                max="3"
                value={retry}
                onChange={(e) => setRetry(e.target.value)}
              />
            </div>
          </div>

          {saved && <p className="text-xs text-green-600">Tetapan disimpan.</p>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Button onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Uji Pengekstrakan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Upload sampel resit untuk uji konfigurasi AI semasa.</p>
          <div className="flex gap-3 items-center">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="text-sm" />
            <Button
              variant="outline"
              onClick={testExtract}
              disabled={testing}
            >
              {testing ? "Mengekstrak..." : "Uji Ekstrak"}
            </Button>
          </div>
          {testResult && (
            <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
              {testResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/api/admin/test-ai/route.ts`**

```typescript
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
    timeoutMs: typeof s["ai_timeout_seconds"] === "number" ? s["ai_timeout_seconds"] * 1000 : undefined,
  });

  try {
    const result = await extractor.extract(buffer, file.type);
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Update `resit/[id]/page.tsx` to read confidence threshold from DB**

In the page's data fetch section (it's a server component), add a settings fetch. Find where the receipt is queried and add alongside it:

```typescript
  const [receipt, thresholdSetting] = await Promise.all([
    prisma.receipt.findUnique({ where: { id: params.id }, include: { items: true } }),
    prisma.settings.findUnique({ where: { key: "ai_confidence_threshold" } }),
  ]);
  const confidenceThreshold = typeof thresholdSetting?.value === "number" ? thresholdSetting.value : 0.7;
```

Then replace the hardcoded `0.7` in the JSX with the variable:

```typescript
      {receipt.aiConfidence != null && receipt.aiConfidence < confidenceThreshold && (
```

- [ ] **Step 4: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/admin/tetapan/_components/ai-settings.tsx src/app/api/admin/test-ai/route.ts src/app/\(app\)/resit/
git commit -m "feat: admin tab AI/OCR — settings UI, test-extract route, confidence threshold from DB"
```

---

## Task 3: Tab Keselamatan + update auth.ts lockout from DB

**Files:**
- Create: `src/app/(app)/admin/tetapan/_components/security-settings.tsx`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Create `security-settings.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Shield } from "lucide-react";

interface SecuritySettingsProps {
  loginMaxAttempts: number;
  loginLockDurationMin: number;
  sessionTimeoutMin: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  maxUploadSizeMb: number;
}

export function SecuritySettings(props: SecuritySettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [maxAttempts, setMaxAttempts] = useState(String(props.loginMaxAttempts));
  const [lockDuration, setLockDuration] = useState(String(props.loginLockDurationMin));
  const [sessionTimeout, setSessionTimeout] = useState(String(props.sessionTimeoutMin));
  const [pwMinLen, setPwMinLen] = useState(String(props.passwordMinLength));
  const [pwUpper, setPwUpper] = useState(props.passwordRequireUppercase);
  const [pwNumber, setPwNumber] = useState(props.passwordRequireNumber);
  const [pwSymbol, setPwSymbol] = useState(props.passwordRequireSymbol);
  const [maxUpload, setMaxUpload] = useState(String(props.maxUploadSizeMb));

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("login_max_attempts", parseInt(maxAttempts));
        await updateSetting("login_lock_duration_min", parseInt(lockDuration));
        await updateSetting("session_timeout_min", parseInt(sessionTimeout));
        await updateSetting("password_min_length", parseInt(pwMinLen));
        await updateSetting("password_require_uppercase", pwUpper);
        await updateSetting("password_require_number", pwNumber);
        await updateSetting("password_require_symbol", pwSymbol);
        await updateSetting("max_upload_size_mb", parseInt(maxUpload));
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Log Masuk &amp; Kunci Akaun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Maksimum cubaan gagal</Label>
              <Input type="number" min="3" max="10" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Tempoh kunci (minit)</Label>
              <Input type="number" min="5" max="60" value={lockDuration} onChange={(e) => setLockDuration(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Tamat tempoh sesi (minit)</Label>
            <Input type="number" min="15" max="480" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Memerlukan kemas kini env var <code className="bg-gray-100 px-1 rounded">SESSION_TIMEOUT_MIN</code> dan restart app di Coolify.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Polisi Kata Laluan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Panjang minimum</Label>
            <Input type="number" min="6" max="32" value={pwMinLen} onChange={(e) => setPwMinLen(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwUpper} onCheckedChange={(v) => setPwUpper(!!v)} />
              <span className="text-sm">Wajib huruf besar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwNumber} onCheckedChange={(v) => setPwNumber(!!v)} />
              <span className="text-sm">Wajib nombor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={pwSymbol} onCheckedChange={(v) => setPwSymbol(!!v)} />
              <span className="text-sm">Wajib simbol (!@#$...)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Had Muat Naik</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Saiz maksimum fail (MB)</Label>
            <Input type="number" min="1" max="50" value={maxUpload} onChange={(e) => setMaxUpload(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {saved && <p className="text-xs text-green-600">Tetapan disimpan.</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
        <Save className="w-4 h-4 mr-2" />
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `auth.ts` lockout to read from DB**

In `src/lib/auth.ts`, in the `authorize` function, find the failed-login block that currently hardcodes `5` attempts and `15` minutes. Replace:

```typescript
          // Increment fail count, lock after 5
          const fails = user.loginFailCount + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailCount: fails,
              lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
            },
          });
```

With:

```typescript
          const [maxRow, durRow] = await Promise.all([
            prisma.settings.findUnique({ where: { key: "login_max_attempts" } }),
            prisma.settings.findUnique({ where: { key: "login_lock_duration_min" } }),
          ]);
          const maxFails = typeof maxRow?.value === "number" ? maxRow.value : 5;
          const lockMins = typeof durRow?.value === "number" ? durRow.value : 15;
          const fails = user.loginFailCount + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailCount: fails,
              lockedUntil: fails >= maxFails ? new Date(Date.now() + lockMins * 60 * 1000) : null,
            },
          });
```

- [ ] **Step 3: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/admin/tetapan/_components/security-settings.tsx src/lib/auth.ts
git commit -m "feat: admin tab Keselamatan — lockout/session/password/upload settings, auth reads lockout from DB"
```

---

## Task 4: Tab Sistem — maintenance mode + system stats + PDPA export

**Files:**
- Create: `src/app/(app)/admin/tetapan/_components/sistem-settings.tsx`
- Create: `src/app/maintenance/page.tsx`
- Create: `src/app/api/admin/pdpa-export/route.ts`
- Modify: `src/server/actions/admin.ts` — add `getSystemStats()`
- Modify: `src/app/(app)/layout.tsx` — check `maintenance_mode`

- [ ] **Step 1: Add `getSystemStats()` to `admin.ts`**

Add this function at the end of `src/server/actions/admin.ts`:

```typescript
import fs from "fs";
import path from "path";

function storageSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      total += stat.isDirectory() ? storageSizeBytes(full) : stat.size;
    } catch { /* skip */ }
  }
  return total;
}

export async function getSystemStats() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  requireAdmin(session.user);

  const [dbResult, claimCount, userCount, receiptCount] = await Promise.all([
    prisma.$queryRaw<{ size: string }[]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `,
    prisma.claim.count(),
    prisma.user.count(),
    prisma.receipt.count(),
  ]);

  const storageDir = path.join(process.cwd(), "storage");
  const storageBytes = storageSizeBytes(storageDir);
  const storageMb = (storageBytes / 1024 / 1024).toFixed(1);

  return {
    dbSize: dbResult[0]?.size ?? "N/A",
    storageMb,
    claimCount,
    userCount,
    receiptCount,
    version: "0.1.0",
  };
}
```

Note: Add `import fs from "fs"; import path from "path";` at top of `admin.ts` alongside other imports.

- [ ] **Step 2: Create `sistem-settings.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Database, HardDrive, Download, AlertTriangle } from "lucide-react";

interface SistemSettingsProps {
  maintenanceMode: boolean;
  logRetentionYears: number;
  stats: {
    dbSize: string;
    storageMb: string;
    claimCount: number;
    userCount: number;
    receiptCount: number;
    version: string;
  };
}

export function SistemSettings(props: SistemSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [maintenance, setMaintenance] = useState(props.maintenanceMode);
  const [logRetention, setLogRetention] = useState(String(props.logRetentionYears));

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("maintenance_mode", maintenance);
        await updateSetting("log_retention_years", parseInt(logRetention));
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  function downloadPdpa() {
    window.open("/api/admin/pdpa-export", "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <Database className="w-4 h-4" />
              Pangkalan Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">{props.stats.dbSize}</p>
            <p className="text-xs text-gray-500">{props.stats.claimCount} tuntutan · {props.stats.receiptCount} resit · {props.stats.userCount} pengguna</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <HardDrive className="w-4 h-4" />
              Storan Fail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{props.stats.storageMb} MB</p>
            <p className="text-xs text-gray-500">Folder ./storage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Mod Penyelenggaraan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={maintenance} onCheckedChange={(v) => setMaintenance(!!v)} />
            <div>
              <span className="text-sm font-medium">Aktifkan mod penyelenggaraan</span>
              <p className="text-xs text-gray-500">Pengguna bukan admin akan diarahkan ke halaman penyelenggaraan.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pengekalan Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-gray-500 mb-1.5 block">Tempoh simpan audit log (tahun)</Label>
          <Input
            type="number"
            min="1"
            max="20"
            className="w-32"
            value={logRetention}
            onChange={(e) => setLogRetention(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Polisi kerajaan: minimum 7 tahun.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PDPA &amp; Eksport Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Eksport semua data sistem (pengguna, tuntutan, resit) dalam format JSON untuk tujuan pematuhan PDPA. Tidak termasuk kata laluan.
          </p>
          <Button variant="outline" onClick={downloadPdpa} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Eksport Data PDPA (JSON)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versi Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono text-gray-700">MediKlaim MDS v{props.stats.version}</p>
        </CardContent>
      </Card>

      {saved && <p className="text-xs text-green-600">Tetapan disimpan.</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
        <Save className="w-4 h-4 mr-2" />
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create maintenance page `src/app/maintenance/page.tsx`**

```typescript
export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md p-8">
        <div className="text-6xl">🔧</div>
        <h1 className="text-2xl font-bold text-gray-900">Sistem Dalam Penyelenggaraan</h1>
        <p className="text-gray-500">
          MediKlaim MDS sedang dalam proses penyelenggaraan. Sila cuba semula sebentar lagi.
        </p>
        <p className="text-xs text-gray-400">Hubungi pentadbir sistem untuk maklumat lanjut.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create PDPA export route `src/app/api/admin/pdpa-export/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [users, claims, receipts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, email: true, name: true, staffNo: true, phone: true,
        isAhliMajlis: true, isActive: true, joinDate: true, createdAt: true,
        roles: { select: { role: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.claim.findMany({
      select: {
        id: true, refNo: true, claimantId: true, forMonth: true, forYear: true,
        status: true, totalClaimedMyr: true, totalEligibleMyr: true,
        totalApprovedMyr: true, submittedAt: true, paidAt: true, createdAt: true,
      },
    }),
    prisma.receipt.findMany({
      select: {
        id: true, ownerId: true, receiptDate: true, vendor: true,
        totalMyr: true, status: true, claimFor: true, createdAt: true,
        items: {
          select: { description: true, qty: true, unitMyr: true, amountMyr: true, isEligible: true },
        },
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    users,
    claims,
    receipts,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mediklaim-pdpa-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
```

- [ ] **Step 5: Add maintenance mode check to `(app)/layout.tsx`**

In `src/app/(app)/layout.tsx`, after the `redirect("/login")` check, add:

```typescript
  const maintenanceSetting = await prisma.settings.findUnique({ where: { key: "maintenance_mode" } });
  const isMaintenance = maintenanceSetting?.value === true;
  if (isMaintenance && !session.user.roles.some((r: { role: string }) => r.role === "ADMIN")) {
    redirect("/maintenance");
  }
```

Note: `session.user.roles` is already available from the JWT token (check how roles are attached in `auth.ts` callbacks). If roles come from DB, use `isAdmin(session.user)` helper instead:

```typescript
  import { isAdmin } from "@/lib/permissions";
  // ...
  if (isMaintenance && !isAdmin(session.user)) {
    redirect("/maintenance");
  }
```

- [ ] **Step 6: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors. If `fs` import in server action causes an issue, note that Next.js server actions run in Node.js and `fs` is available.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/admin/tetapan/_components/sistem-settings.tsx src/app/maintenance/page.tsx src/app/api/admin/pdpa-export/route.ts src/server/actions/admin.ts src/app/\(app\)/layout.tsx
git commit -m "feat: admin tab Sistem — maintenance mode, system stats, PDPA export, maintenance page"
```

---

## Task 5: Tab Ref No + update refno.ts

**Files:**
- Create: `src/app/(app)/admin/tetapan/_components/refno-settings.tsx`
- Modify: `src/lib/refno.ts`

- [ ] **Step 1: Update `src/lib/refno.ts` to read prefix and padding from DB**

Replace the entire file:

```typescript
import { prisma } from "@/lib/db";

export async function generateRefNo(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `claim_counter_${year}`;

  const [prefixRow, paddingRow] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "ref_no_prefix" } }),
    prisma.settings.findUnique({ where: { key: "ref_no_padding" } }),
  ]);

  const prefix = typeof prefixRow?.value === "string" ? prefixRow.value : "MDS/MK";
  const padding = typeof paddingRow?.value === "number" ? paddingRow.value : 5;

  // Atomic increment via raw SQL to avoid race conditions
  await prisma.$executeRaw`
    INSERT INTO "Settings" (key, value, "updatedAt")
    VALUES (${key}, '0'::jsonb, NOW())
    ON CONFLICT (key) DO NOTHING
  `;

  const result = await prisma.$queryRaw<{ value: number }[]>`
    UPDATE "Settings"
    SET value = (value::int + 1)::text::jsonb, "updatedAt" = NOW()
    WHERE key = ${key}
    RETURNING value::int as value
  `;

  const counter = result[0]?.value ?? 1;
  const padded = String(counter).padStart(padding, "0");
  return `${prefix}/${year}/${padded}`;
}

export async function getRefNoPreview(): Promise<{ nextRefNo: string; currentCounter: number }> {
  const year = new Date().getFullYear();
  const key = `claim_counter_${year}`;

  const [prefixRow, paddingRow, counterRow] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "ref_no_prefix" } }),
    prisma.settings.findUnique({ where: { key: "ref_no_padding" } }),
    prisma.settings.findUnique({ where: { key } }),
  ]);

  const prefix = typeof prefixRow?.value === "string" ? prefixRow.value : "MDS/MK";
  const padding = typeof paddingRow?.value === "number" ? paddingRow.value : 5;
  const currentCounter = typeof counterRow?.value === "number" ? counterRow.value : 0;
  const nextCounter = currentCounter + 1;

  return {
    nextRefNo: `${prefix}/${year}/${String(nextCounter).padStart(padding, "0")}`,
    currentCounter,
  };
}
```

- [ ] **Step 2: Create `refno-settings.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Hash } from "lucide-react";

interface RefNoSettingsProps {
  prefix: string;
  padding: number;
  nextRefNo: string;
  currentCounter: number;
}

export function RefNoSettings(props: RefNoSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [prefix, setPrefix] = useState(props.prefix);
  const [padding, setPadding] = useState(String(props.padding));

  const previewNext = `${prefix}/${new Date().getFullYear()}/${String(props.currentCounter + 1).padStart(parseInt(padding) || 5, "0")}`;

  function save() {
    setError(""); setSaved(false);
    startTransition(async () => {
      try {
        await updateSetting("ref_no_prefix", prefix.trim());
        await updateSetting("ref_no_padding", parseInt(padding));
        setSaved(true);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Gagal simpan.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Format Nombor Rujukan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Awalan (prefix)</Label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="MDS/MK"
              />
              <p className="text-xs text-gray-400 mt-1">Contoh: MDS/MK atau PBT/TUNTUTAN</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Bilangan digit</Label>
              <Input
                type="number"
                min="3"
                max="8"
                value={padding}
                onChange={(e) => setPadding(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Nombor diisi sifar di hadapan</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-3 border">
            <p className="text-xs text-gray-500 mb-1">Nombor rujukan seterusnya:</p>
            <p className="text-lg font-mono font-bold text-gray-800">{previewNext}</p>
            <p className="text-xs text-gray-400 mt-1">Tuntutan semasa tahun ini: {props.currentCounter}</p>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-200">
            Perubahan format hanya mempengaruhi tuntutan baru. Tuntutan sedia ada tidak berubah.
          </p>

          {saved && <p className="text-xs text-green-600">Tetapan disimpan.</p>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Button onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/refno.ts src/app/\(app\)/admin/tetapan/_components/refno-settings.tsx
git commit -m "feat: admin tab Ref No — configurable prefix/padding, live preview, refno.ts reads from DB"
```

---

## Task 6: Wire all 4 new tabs into page.tsx

**Files:**
- Modify: `src/app/(app)/admin/tetapan/page.tsx`

- [ ] **Step 1: Replace `page.tsx` with updated version**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./_components/general-settings";
import { AllocationSettings } from "./_components/allocation-settings";
import { ClaimRulesSettings } from "./_components/claim-rules-settings";
import { HolidaySettings } from "./_components/holiday-settings";
import type { HolidayRow } from "./_components/holiday-settings";
import { BlacklistSettings } from "./_components/blacklist-settings";
import { NotifSettings } from "./_components/notif-settings";
import { AiSettings } from "./_components/ai-settings";
import { SecuritySettings } from "./_components/security-settings";
import { SistemSettings } from "./_components/sistem-settings";
import { RefNoSettings } from "./_components/refno-settings";
import { getSystemStats } from "@/server/actions/admin";
import { getRefNoPreview } from "@/lib/refno";

export default async function TetapanPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const [settings, keywords, holidays, stats, refNoPreview] = await Promise.all([
    prisma.settings.findMany(),
    prisma.blacklistKeyword.findMany({ orderBy: { keyword: "asc" } }),
    prisma.publicHoliday.findMany({
      where: { year: { gte: currentYear - 1 } },
      orderBy: { date: "asc" },
    }),
    getSystemStats(),
    getRefNoPreview(),
  ]);

  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tetapan Sistem</h1>
        <p className="text-gray-500 text-sm mt-1">Konfigurasi sistem MediKlaim</p>
      </div>

      <Tabs defaultValue="am">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="am">Am</TabsTrigger>
          <TabsTrigger value="peruntukan">Peruntukan</TabsTrigger>
          <TabsTrigger value="peraturan">Peraturan</TabsTrigger>
          <TabsTrigger value="kalendar">Kalendar</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
          <TabsTrigger value="notifikasi">Notifikasi</TabsTrigger>
          <TabsTrigger value="ai">AI / OCR</TabsTrigger>
          <TabsTrigger value="keselamatan">Keselamatan</TabsTrigger>
          <TabsTrigger value="sistem">Sistem</TabsTrigger>
          <TabsTrigger value="refno">Ref No</TabsTrigger>
        </TabsList>

        <TabsContent value="am" className="mt-4">
          <GeneralSettings orgName={String(s["org_name"] ?? "Majlis Daerah Setiu")} />
        </TabsContent>

        <TabsContent value="peruntukan" className="mt-4">
          <AllocationSettings defaultLimit={Number(s["default_annual_limit"] ?? 1200)} />
        </TabsContent>

        <TabsContent value="peraturan" className="mt-4">
          <ClaimRulesSettings
            cutoffDays={Number(s["claim_cutoff_days"] ?? 45)}
            receiptMaxAgeMonths={Number(s["receipt_max_age_months"] ?? 3)}
            proRataEnabled={Boolean(s["pro_rata_enabled"] ?? true)}
            slaHeadDays={Number(s["sla_head_days"] ?? 3)}
            slaFinanceDays={Number(s["sla_finance_days"] ?? 5)}
            slaApproverDays={Number(s["sla_approver_days"] ?? 3)}
          />
        </TabsContent>

        <TabsContent value="kalendar" className="mt-4">
          <HolidaySettings
            holidays={holidays.map((h): HolidayRow => ({
              id: h.id,
              date: h.date.toISOString().split("T")[0],
              name: h.name,
            }))}
          />
        </TabsContent>

        <TabsContent value="blacklist" className="mt-4">
          <BlacklistSettings
            keywords={keywords.map((k) => ({ id: k.id, keyword: k.keyword, reason: k.reason }))}
          />
        </TabsContent>

        <TabsContent value="notifikasi" className="mt-4">
          <NotifSettings
            waEnabled={Boolean(s["wa_enabled"] ?? false)}
            waRatePerMin={Number(s["wa_rate_limit_per_min"] ?? 20)}
            waRatePerDay={Number(s["wa_rate_limit_per_day"] ?? 500)}
            waQuietStart={Number(s["wa_quiet_hours_start"] ?? 22)}
            waQuietEnd={Number(s["wa_quiet_hours_end"] ?? 7)}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiSettings
            provider={String(s["ai_provider"] ?? "manual")}
            ollamaBaseUrl={String(s["ai_ollama_base_url"] ?? "")}
            ollamaModel={String(s["ai_ollama_model"] ?? "qwen2.5vl:7b")}
            confidenceThreshold={Number(s["ai_confidence_threshold"] ?? 0.7)}
            timeoutSeconds={Number(s["ai_timeout_seconds"] ?? 60)}
            retryCount={Number(s["ai_retry_count"] ?? 1)}
          />
        </TabsContent>

        <TabsContent value="keselamatan" className="mt-4">
          <SecuritySettings
            loginMaxAttempts={Number(s["login_max_attempts"] ?? 5)}
            loginLockDurationMin={Number(s["login_lock_duration_min"] ?? 15)}
            sessionTimeoutMin={Number(s["session_timeout_min"] ?? 30)}
            passwordMinLength={Number(s["password_min_length"] ?? 10)}
            passwordRequireUppercase={s["password_require_uppercase"] !== false}
            passwordRequireNumber={s["password_require_number"] !== false}
            passwordRequireSymbol={Boolean(s["password_require_symbol"] ?? false)}
            maxUploadSizeMb={Number(s["max_upload_size_mb"] ?? 10)}
          />
        </TabsContent>

        <TabsContent value="sistem" className="mt-4">
          <SistemSettings
            maintenanceMode={Boolean(s["maintenance_mode"] ?? false)}
            logRetentionYears={Number(s["log_retention_years"] ?? 7)}
            stats={stats}
          />
        </TabsContent>

        <TabsContent value="refno" className="mt-4">
          <RefNoSettings
            prefix={String(s["ref_no_prefix"] ?? "MDS/MK")}
            padding={Number(s["ref_no_padding"] ?? 5)}
            nextRefNo={refNoPreview.nextRefNo}
            currentCounter={refNoPreview.currentCounter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: TSC check**

```bash
cd C:/webdev/medclaim && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/tetapan/page.tsx
git commit -m "feat: wire 10-tab admin settings page — AI/OCR, Keselamatan, Sistem, Ref No tabs added"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tab 7 AI/OCR — provider, URL, model, threshold, timeout, retry, test extract
- ✅ Tab 8 Keselamatan — lockout (DB-driven), session timeout (documented caveat), password policy UI, upload size
- ✅ Tab 10 Sistem — maintenance mode, storage/DB stats, log retention, PDPA export, version
- ✅ Tab 11 Ref No — prefix, padding, live preview, counter display
- ✅ Functional: auth.ts reads lockout from DB, createExtractor uses DB AI config, refno.ts uses DB prefix/padding
- ✅ Maintenance page created, enforced in layout.tsx

**Gaps / deferred:**
- Session timeout requires Coolify env var change (documented in UI)
- Password policy rules saved to DB but enforcement at register/password-change not implemented (Phase 3)
- 2FA UI toggle not included — schema fields exist but no OTP logic yet (Phase 3)
- IP allowlist for admin panel not implemented (low priority)
