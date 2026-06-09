"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">📵</div>
      <h1 className="text-xl font-bold text-gray-800">Tiada Sambungan Internet</h1>
      <p className="text-sm text-gray-500 max-w-xs">
        Anda sedang luar talian. Sila semak sambungan internet anda dan cuba semula.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90"
      >
        Cuba Semula
      </button>
    </div>
  );
}
