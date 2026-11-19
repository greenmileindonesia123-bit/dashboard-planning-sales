"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="font-heading text-3xl">Halaman gagal dimuat</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Coba muat ulang. Jika berulang, periksa koneksi ke Supabase dan environment variable.
      </p>
      <Button type="button" onClick={() => reset()}>
        Muat ulang
      </Button>
    </main>
  );
}
