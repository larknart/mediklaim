"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResponse, SearchResult } from "@/app/api/search/route";
import { STATUS_PILL_CLASSES } from "@/lib/claim-status";

// ─── Result section ───────────────────────────────────────────────────────────

function ResultSection({
  title,
  items,
  onSelect,
  adminOnly = false,
}: {
  title: string;
  items: SearchResult[];
  onSelect: (link: string) => void;
  adminOnly?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="px-4 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          {title} ({items.length})
        </span>
        {adminOnly && (
          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
            ADMIN
          </span>
        )}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.link)}
          className="w-full text-left px-4 py-2.5 hover:bg-accent border-b border-border/40 transition-colors"
        >
          <div className="flex items-center gap-2 mb-0.5">
            {item.status && (
              <span
                className={cn(
                  "text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
                  STATUS_PILL_CLASSES[item.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {item.status}
              </span>
            )}
            <span className="text-xs font-semibold text-foreground truncate">
              {item.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>
        </button>
      ))}
    </div>
  );
}

// ─── GlobalSearch ─────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<SearchResponse | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const router      = useRouter();

  // Keep refs in sync with state so the single keydown handler always sees fresh values
  const queryRef   = useRef(query);
  const resultsRef = useRef(results);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { resultsRef.current = results; }, [results]);

  // Register keydown handler ONCE — reads current values via refs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        if (queryRef.current.length >= 3 && resultsRef.current) setPanelOpen(true);
      }
      if (e.key === "Escape") {
        setPanelOpen(false);
        setQuery("");
        setResults(null);
        queryRef.current = "";
        resultsRef.current = null;
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // empty deps — registered once, reads via refs

  // Cleanup debounce timer and in-flight request on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Debounced search — fires 300 ms after last keystroke when query ≥ 3 chars
  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setPanelOpen(false);
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Abort previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fetch failed");
        const data: SearchResponse = await res.json();
        setResults(data);
        setPanelOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Ralat semasa mencari. Cuba lagi.");
        setPanelOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleResultClick = (link: string) => {
    router.push(link);
    setPanelOpen(false);
    setQuery("");
    setResults(null);
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setPanelOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  };

  const hasResults =
    results &&
    (results.claims.length > 0 ||
      results.receipts.length > 0 ||
      results.users.length > 0 ||
      results.audit.length > 0);

  return (
    <>
      {/* ── Search input bar (lives inside header) ── */}
      <div className="relative flex-1 max-w-[500px]">
        <div
          className={cn(
            "flex items-center gap-2 bg-muted/50 border rounded-lg h-9 px-3 transition-colors",
            panelOpen ? "border-primary" : "border-border focus-within:border-primary"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Cari tuntutan, resit, pengguna..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query ? (
            <button onClick={clearSearch} aria-label="Kosongkan carian" className="flex-shrink-0 p-0.5">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-muted-foreground" />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-xs text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-sans">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* ── Mobile backdrop (dismiss panel by tapping outside) ── */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-20 sm:hidden"
          onClick={clearSearch}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in results panel ── */}
      {panelOpen && (
        <div
          role="region"
          aria-label="Keputusan carian"
          className="fixed right-0 top-14 bottom-0 w-full sm:w-[320px] z-30 bg-white border-l border-border shadow-xl flex flex-col"
        >
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground truncate">
              Keputusan: &quot;{query}&quot;
            </span>
            <button
              onClick={clearSearch}
              aria-label="Tutup panel carian"
              className="text-xs text-muted-foreground hover:text-muted-foreground bg-muted rounded px-1.5 py-0.5 flex-shrink-0"
            >
              ESC ✕
            </button>
          </div>

          {/* Results area */}
          <div className="flex-1 overflow-y-auto" aria-live="polite" aria-atomic="false">
            {error && (
              <p className="text-sm text-destructive text-center py-8 px-4">{error}</p>
            )}
            {!error && results && !hasResults && (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                Tiada keputusan untuk &quot;{query}&quot;
              </p>
            )}
            {!error && results && hasResults && (
              <>
                <ResultSection
                  title="Tuntutan"
                  items={results.claims}
                  onSelect={handleResultClick}
                />
                <ResultSection
                  title="Resit"
                  items={results.receipts}
                  onSelect={handleResultClick}
                />
                <ResultSection
                  title="Pengguna"
                  items={results.users}
                  onSelect={handleResultClick}
                  adminOnly
                />
                <ResultSection
                  title="Audit"
                  items={results.audit}
                  onSelect={handleResultClick}
                  adminOnly
                />
              </>
            )}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2 border-t border-border bg-muted/50">
            <p className="text-xs text-muted-foreground text-center">
              Klik result untuk navigate · ESC untuk tutup
            </p>
          </div>
        </div>
      )}
    </>
  );
}
