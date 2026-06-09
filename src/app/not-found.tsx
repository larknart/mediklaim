import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <div>
          <p className="text-6xl font-bold text-gray-200">404</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">Halaman Tidak Dijumpai</h1>
          <p className="text-sm text-gray-500 mt-1">
            Halaman yang anda cari tidak wujud atau telah dipindahkan.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Kembali ke Papan Pemuka
        </Link>
      </div>
    </div>
  );
}
