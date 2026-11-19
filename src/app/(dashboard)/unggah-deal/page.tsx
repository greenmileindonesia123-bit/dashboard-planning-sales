import { connection } from "next/server";
import { Suspense } from "react";
import { DealUploadForm } from "@/app/(dashboard)/unggah-deal/upload-form";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { isSuperAdmin } from "@/lib/access";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Unggah data deal (SO)" };

export default function DealUploadPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DealUploadScreen />
    </Suspense>
  );
}

async function DealUploadScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  if (!isSuperAdmin(viewer)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-heading text-3xl tracking-tight">Unggah data deal (SO)</h1>
        <Notice title="Halaman terbatas">Menu ini hanya untuk Super Admin.</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Unggah data deal (SO)</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Impor ekspor Sales Order dari ERP. Nilai deal memakai kolom Net Total, bukan Grand Total. Nomor SO yang sama
          dihitung sekali. Mengunggah berkas yang sama memperbarui data, bukan menggandakannya.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Gunakan sheet Sales Order, berkas .xlsx atau .csv.</li>
        <li>Docstatus 0, Docstatus 2, status Draft, dan status Cancelled tetap disimpan tetapi tidak masuk nilai deal.</li>
        <li>Nama sales dicocokkan ke Data Sales. Nama yang tidak cocok disimpan sebagai Belum dipetakan.</li>
        <li>Periksa pratinjau, lalu simpan. Zona waktu tanggal order mengikuti tanggal di berkas, Asia/Jakarta.</li>
      </ol>
      <DealUploadForm />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Unggah data deal (SO)</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
