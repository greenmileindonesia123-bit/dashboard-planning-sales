import { connection } from "next/server";
import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { isSuperAdmin } from "@/lib/access";
import { SHEET_URL } from "@/lib/constants";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Template kunjungan sales" };

export default function TemplatePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <TemplateScreen />
    </Suspense>
  );
}

async function TemplateScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  if (!isSuperAdmin(viewer)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-heading text-3xl tracking-tight">Template kunjungan sales</h1>
        <Notice title="Halaman terbatas">Menu ini hanya untuk Super Admin.</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Template kunjungan sales</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Master template Laporan Kunjungan Sales di Google Sheets. Isi dan susunan kolom mengikuti berkas ini.
          Tautan tidak ditampilkan untuk akun lain.
        </p>
      </div>
      <a href={SHEET_URL} className={buttonVariants({ variant: "default" })} target="_blank" rel="noreferrer">
        Buka template kunjungan sales
      </a>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Template kunjungan sales</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
