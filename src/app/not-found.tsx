import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-3 px-4 py-16">
      <h1 className="font-heading text-3xl">Halaman tidak ada</h1>
      <p className="text-sm text-muted-foreground">Alamat ini tidak termasuk menu dashboard.</p>
      <Link href="/planning" className="text-sm font-medium text-primary underline underline-offset-4">
        Ke Planning Kegiatan
      </Link>
    </main>
  );
}
