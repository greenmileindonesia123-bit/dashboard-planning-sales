import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarUploadForm } from "@/app/(dashboard)/unggah-jadwal/upload-form";
import { AccessState } from "@/components/access-state";
import { isSuperAdmin } from "@/lib/access";
import { getViewer, loadRoster } from "@/lib/session";

export const metadata = { title: "Unggah jadwal kalender" };

export default function CalendarUploadPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <CalendarUploadScreen />
    </Suspense>
  );
}

async function CalendarUploadScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  const canChooseOwner = isSuperAdmin(viewer);
  const roster = canChooseOwner ? await loadRoster() : null;
  const people = (roster?.roster ?? [])
    .filter((person) => person.status === "Aktif" && person.email)
    .map((person) => ({ name: person.name, email: person.email as string }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Unggah jadwal kalender</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Google Calendar tidak mengekspor Excel. Unduh kalender sebagai file .ics, lalu unggah berkas itu apa adanya.
          Jika unduhannya berupa .zip, ekstrak dulu dan unggah file .ics di dalamnya.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Di Google Calendar, buka pengaturan kalender yang dipakai sales, lalu unduh atau ekspor sebagai .ics.</li>
        <li>
          {canChooseOwner
            ? "Pilih nama sales pemilik berkas. Nama file berupa email hanya terisi otomatis jika email itu ada di Data Sales."
            : `Jadwal disimpan untuk ${viewer.name}. Akun ini tidak dapat menyimpan kalender orang lain.`}
        </li>
        <li>Periksa pratinjau, lalu simpan. Mengunggah berkas yang sama memperbarui acara, bukan menggandakannya.</li>
        <li>Acara berulang ditampilkan sekitar dua bulan sebelum hingga enam bulan sesudah bulan ini. Zona waktu Asia/Jakarta.</li>
      </ol>
      <CalendarUploadForm canChooseOwner={canChooseOwner} people={people} />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Unggah jadwal kalender</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
