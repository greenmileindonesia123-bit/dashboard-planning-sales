import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { KpiGrid } from "@/components/kpi-grid";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { ROSTER_AS_OF } from "@/lib/constants";
import { describeDataError, formatArea, formatNumber } from "@/lib/format";
import { loadRoster } from "@/lib/session";

export const metadata = { title: "Tim Sales" };

export default function TimPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <TimScreen />
    </Suspense>
  );
}

async function TimScreen() {
  const loaded = await loadRoster();
  if (loaded.viewer.kind !== "ok") return <AccessState viewer={loaded.viewer} />;
  if (loaded.error) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl tracking-tight">Tim sales</h1>
        <Notice title="Roster gagal dimuat">{describeDataError(loaded.error)}</Notice>
      </div>
    );
  }

  const active = loaded.roster.filter((person) => person.status === "Aktif");
  const withEmail = active.filter((person) => person.email);
  const missingEmail = active.filter((person) => !person.email);
  const salesCount = active.filter((person) => person.team === "Sales").length;
  const ppicCount = active.filter((person) => person.team === "PPIC").length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Tim sales</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Snapshot Data Sales per {ROSTER_AS_OF}. Perubahan di Google Sheets tidak masuk otomatis sampai seed
          diperbarui.
        </p>
      </div>
      {loaded.roster.length === 0 ? (
        <Notice title="Roster belum dimuat">Jalankan supabase/seed.sql di project Supabase.</Notice>
      ) : (
        <KpiGrid
          items={[
            { label: "Aktif", value: formatNumber(active.length) },
            { label: "Email siap", value: formatNumber(withEmail.length) },
            { label: "Email belum diisi", value: formatNumber(missingEmail.length) },
            { label: "Sales / PPIC", value: `${formatNumber(salesCount)} / ${formatNumber(ppicCount)}` },
          ]}
        />
      )}
      {missingEmail.length > 0 ? (
        <Notice title="Email belum diisi" tone="warning">
          {missingEmail.map((person) => person.name).join(", ")} tidak bisa masuk dan tidak bisa dihubungkan ke
          kalender sampai email Google diisi.
        </Notice>
      ) : null}
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Daftar tim sales</caption>
          <thead className="bg-muted text-left">
            <tr>
              {["Nama", "Email Google", "Area", "Tim", "Status"].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loaded.roster.map((person) => (
              <tr
                key={person.id}
                className={`border-t border-border ${person.email ? "" : "bg-warning/10"}`}
              >
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {person.name}
                </th>
                <td className="px-3 py-2">
                  {person.email ? (
                    person.email
                  ) : (
                    <Badge variant="outline">Belum ada email</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{formatArea(person.area)}</td>
                <td className="px-3 py-2">{person.team}</td>
                <td className="px-3 py-2">{person.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Tim sales</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
