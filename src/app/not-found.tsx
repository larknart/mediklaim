import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="text-center space-y-4 max-w-sm">
        <Image src="/mds-logo-mark.png" alt="MDS" width={64} height={64} className="mx-auto drop-shadow-sm" />
        <div>
          <p className="text-6xl font-bold text-border">404</p>
          <h1 className="text-xl font-semibold text-foreground mt-2">Halaman Tidak Dijumpai</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
