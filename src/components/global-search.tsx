"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResponse, SearchResult } from "@/app/api/search/route";

// ─── Status badge colour map ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  APPROVED:         "bg-green-100 text-green-700",
  PAID:             "bg-green-100 text-green-700",
  ARCHIVED:         "bg-green-100 text-green-700",
  SUBMITTED:        "bg-yellow-100 text-yellow-700",
  HEAD_APPROVED:    "bg-yellow-100 text-yellow-700",
  FINANCE_REVIEWED: "bg-blue-100 text-blue-700",
  REJECTED:         "bg-red-100 text-red-700",
  WITHDRAWN:        "bg-gray-100 text-gray-500",
  DRAFT:            "bg-gray-100 text-gray-500",
  UNSORTED:         "bg-gray-100 text-gray-500",
  ATTACHED:         "bg-gray-100 text-gray-500",
};

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
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
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
          className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-0.5">
            {item.status && (
              <span
                className={cn(
                  "text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
                  STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-500"
                )}
              >
                {item.status}
              </span>
            )}
            <span className="text-xs font-semibold text-gray-800 truncate">
              {item.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">{item.sublabel}</p>
        </button>
      ))}
    </div>
  );
}

// ─── GlobalSearch ─────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResponse | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router      = useRouter();

  // Ctrl+K → focus + open; ESC → clear + close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        if (query.length >= 3 && results) setPanelOpen(true);
      }
      if (e.key === "Escape") {
        setPanelOpen(false);
        setQuery("");
        setResults(null);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, results]);

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
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error("fetch failed");
        const data: SearchResponse = await res.json();
        setResults(data);
        setPanelOpen(true);
      } catch {
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
            "flex items-center gap-2 bg-gray-50 border rounded-lg h-9 px-3 transition-colors",
            panelOpen ? "border-green-700" : "border-gray-200 focus-within:border-green-700"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Cari tuntutan, resit, pengguna..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
          />
          {query ? (
            <button onClick={clearSearch} className="flex-shrink-0 p-0.5">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-sans">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* ── Slide-in results panel ── */}
      {panelOpen && (
        <div className="fixed right-0 top-14 bottom-0 w-[320px] z-30 bg-white border-l border-gray-200 shadow-xl flex flex-col">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 truncate">
              Keputusan: &quot;{query}&quot;
            </span>
            <button
              onClick={clearSearch}
              className="text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0"
            >
              ESC ✕
            </button>
          </div>

          {/* Results area */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <p className="text-sm text-red-500 text-center py-8 px-4">{error}</p>
            )}
            {!error && results && !hasResults && (
              <p className="text-sm text-gray-400 text-center py-8 px-4">
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
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              Klik result untuk navigate · ESC untuk tutup
            </p>
          </div>
        </div>
      )}
    </>
  );
}
