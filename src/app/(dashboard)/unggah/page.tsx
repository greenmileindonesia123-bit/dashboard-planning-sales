import { connection } from "next/server";
import { Suspense } from "react";
import { UploadForm } from "@/app/(dashboard)/unggah/upload-form";
import { AccessState } from "@/components/access-state";
import { isSuperAdmin } from "@/lib/access";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Unggah laporan kunjungan" };

export default function UploadPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <UploadScreen />
    </Suspense>
  );
}

async function UploadScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Unggah laporan kunjungan</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {isSuperAdmin(viewer)
            ? "Super Admin dapat menyimpan semua baris yang cocok dengan Data Sales."
            : `Hanya baris ${viewer.name} yang disimpan. Baris sales lain dilewati.`}
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Ekspor Excel dari Smart Salary. Hanya sheet LAPORAN KUNJUNGAN SALES yang dibaca. Training Record diabaikan.</li>
        <li>Atau isi template CSV kosong, lalu simpan sebagai .csv.</li>
        <li>Periksa pratinjau. Reference Number yang sama akan diperbarui, bukan digandakan.</li>
        <li>Nomor ponsel 0 dianggap tidak ada. Email pengingat tidak dikirim dari halaman ini.</li>
      </ol>
      <a href="/template-laporan-kunjungan.csv" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
        Unduh template kosong
      </a>
      <UploadForm />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Unggah laporan kunjungan</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
