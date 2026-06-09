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
      if (!res.ok) {
        setTestResult("Ralat: " + (json.error ?? JSON.stringify(json)));
      } else {
        setTestResult(JSON.stringify(json, null, 2));
      }
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
            <Label className="text-xs text-muted-foreground mb-1.5 block">Provider</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                <Label className="text-xs text-muted-foreground mb-1.5 block">Ollama Base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://172.17.37.213:11434"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="qwen2.5vl:7b"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Threshold keyakinan (0–1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Bawah nilai ini → amaran kuning di resit</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Timeout (saat)</Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={timeout}
                onChange={(e) => setTimeout_(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Bilangan cuba semula</Label>
              <Input
                type="number"
                min="0"
                max="3"
                value={retry}
                onChange={(e) => setRetry(e.target.value)}
              />
            </div>
          </div>

          {saved && <p className="text-xs text-success">Tetapan disimpan.</p>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Button onClick={save} disabled={isPending} className="">
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
          <p className="text-xs text-muted-foreground">Upload sampel resit untuk uji konfigurasi AI semasa.</p>
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
            <pre className="bg-muted/50 border rounded p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
              {testResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
