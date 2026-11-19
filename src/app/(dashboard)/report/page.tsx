import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { ComparisonChart, RankingChart } from "@/components/report-charts";
import { describeDataError, formatNumber, formatPercent, formatRp, formatSignedNumber, formatSignedRp } from "@/lib/format";
import { connection } from "next/server";
import { civilDateInJakarta, formatMonthLabel, monthRange, previousMonthRange } from "@/lib/jakarta";
import { dealRoster, dealsForPerson, dealsInRange, summarizeDeals, visibleDeals } from "@/lib/sales-order/metrics";
import {
  belongsTo,
  comparePeople,
  compareTotals,
  delta,
  personKey,
  unmatchedVisitCount,
  type PersonComparison,
} from "@/lib/metrics";
import { isSuperAdmin } from "@/lib/access";
import { viewerIdentity } from "@/lib/scope";
import { loadRoster, loadSalesOrders, loadVisits } from "@/lib/session";

export const metadata = { title: "Report" };

export default function ReportPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReportScreen />
    </Suspense>
  );
}

async function ReportScreen() {
  await connection();
  const today = civilDateInJakarta(new Date());
  const currentRange = monthRange(today);
  const previousRange = previousMonthRange(today);
  const [rosterLoaded, visitLoaded, orderLoaded] = await Promise.all([
    loadRoster(),
    loadVisits(previousRange.start, currentRange.end),
    loadSalesOrders(previousRange.start, currentRange.end),
  ]);
  const viewer = visitLoaded.viewer.kind === "ok" ? visitLoaded.viewer : rosterLoaded.viewer;
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;

  const currentLabel = formatMonthLabel(today);
  const previousLabel = formatMonthLabel({
    year: Number(previousRange.start.slice(0, 4)),
    month: Number(previousRange.start.slice(5, 7)),
    day: 1,
  });
  const seesAll = isSuperAdmin(viewer);
  const people = seesAll ? rosterLoaded.roster : [viewerIdentity(viewer)];
  const visits = seesAll
    ? visitLoaded.visits
    : visitLoaded.visits.filter((visit) => belongsTo(visit, viewerIdentity(viewer)));
  const totals = compareTotals(visits, currentRange, previousRange);
  const perPerson = comparePeople(people, visits, currentRange, previousRange);
  const unmatched = seesAll ? unmatchedVisitCount(visits, rosterLoaded.roster) : 0;
  const empty = totals.current.visits === 0 && totals.previous.visits === 0;
  const error = visitLoaded.error ?? rosterLoaded.error ?? orderLoaded.error;
  const dealScope = visibleDeals(orderLoaded.orders, {
    superAdmin: seesAll,
    viewerEmail: viewer.email,
    selectedEmail: undefined,
  });
  const dealCurrent = summarizeDeals(dealsInRange(dealScope, currentRange));
  const dealPrevious = summarizeDeals(dealsInRange(dealScope, previousRange));
  const dealPeople = dealRoster(rosterLoaded.roster, { superAdmin: seesAll, viewer, selected: null }).map((person) => ({
    name: person.name,
    current: summarizeDeals(dealsForPerson(dealsInRange(dealScope, currentRange), person)),
    previous: summarizeDeals(dealsForPerson(dealsInRange(dealScope, previousRange), person)),
  }));
  const countRows = [
    { label: "Kunjungan", bulanIni: totals.current.visits, bulanLalu: totals.previous.visits },
    { label: "Pipeline", bulanIni: totals.current.pipeline, bulanLalu: totals.previous.pipeline },
    { label: "Jumlah SO", bulanIni: dealCurrent.count, bulanLalu: dealPrevious.count },
  ];
  const moneyRows = [
    { label: "Nilai potensi", bulanIni: totals.current.potential, bulanLalu: totals.previous.potential },
    { label: "Nilai order", bulanIni: totals.current.order, bulanLalu: totals.previous.order },
    { label: "Nilai deal (Net Total SO)", bulanIni: dealCurrent.netTotal, bulanLalu: dealPrevious.netTotal },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Report</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {currentLabel} dibanding {previousLabel}. Bulan kalender penuh di Asia/Jakarta. Pipeline menghitung laporan
          berstatus Prospek atau Negosiasi. Nilai order berasal dari laporan kunjungan. Nilai deal (Net Total SO)
          berasal dari Sales Order dan tidak menghitung batal atau draft.
        </p>
      </div>
      {error ? <Notice title="Sebagian data gagal dimuat">{describeDataError(error)}</Notice> : null}
      {empty ? (
        <Notice title="Belum ada laporan kunjungan">
          Grafik tetap ditampilkan dengan angka 0. Tidak ada seri contoh.
        </Notice>
      ) : null}
      {unmatched > 0 ? (
        <Notice title="Ada laporan di luar roster" tone="warning">
          {formatNumber(unmatched)} baris tidak cocok dengan nama atau email di sales_profiles. Baris itu tetap masuk
          total tim, tetapi tidak masuk ranking per orang.
        </Notice>
      ) : null}
      {people.length === 0 ? (
        <Notice title="Roster belum dimuat">
          Grafik per orang butuh baris di sales_profiles. Jalankan seed SQL. Total tim tetap 0 sampai ada laporan.
        </Notice>
      ) : null}
      {!seesAll ? (
        <Notice title="Angka akun Anda">
          Report hanya menampilkan {viewer.name}. Ringkasan seluruh tim tersedia untuk Super Admin.
        </Notice>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-2">
        <ComparisonChart
          title="Jumlah kunjungan dan pipeline"
          description={`Satuan: jumlah laporan. ${currentLabel} vs ${previousLabel}.`}
          rows={countRows}
          formatValue="number"
        />
        <ComparisonChart
          title="Nilai potensi dan nilai order"
          description={`Satuan: Rupiah. ${currentLabel} vs ${previousLabel}.`}
          rows={moneyRows}
          formatValue="rupiah"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">{seesAll ? "Per sales" : "Perbandingan Anda"}</h2>
        <ComparisonChart
          title="Kunjungan per orang"
          description="Bulan ini dan bulan lalu, satu batang per orang."
          rows={perPerson.map((person) => ({
            label: person.name,
            bulanIni: person.current.visits,
            bulanLalu: person.previous.visits,
          }))}
          formatValue="number"
        />
        <ComparisonTable rows={perPerson} currentLabel={currentLabel} previousLabel={previousLabel} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Komposisi bulan ini</h2>
        <p className="text-sm text-muted-foreground">
          Urutan mengikuti nilai bulan ini. Jika semuanya 0, nama tetap tampil menurut abjad.
        </p>
        <div className="grid gap-8 xl:grid-cols-3">
          <RankingChart
            title="Nilai order"
            description={`Rupiah, ${currentLabel}.`}
            formatValue="rupiah"
            rows={ranked(perPerson, (row) => row.current.order)}
          />
          <RankingChart
            title="Kunjungan"
            description={`Jumlah laporan, ${currentLabel}.`}
            formatValue="number"
            rows={ranked(perPerson, (row) => row.current.visits)}
          />
          <RankingChart
            title="Pipeline aktif"
            description={`Prospek + Negosiasi, ${currentLabel}.`}
            formatValue="number"
            rows={ranked(perPerson, (row) => row.current.pipeline)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Nilai deal (Net Total SO)</h2>
        <p className="text-sm text-muted-foreground">
          Jumlah dan nilai Sales Order pada bulan kalender, dibanding bulan lalu. SO batal dan draft tidak masuk.
          {seesAll ? " Baris Belum dipetakan adalah SO yang nama sales-nya tidak cocok dengan Data Sales." : ""}
        </p>
        <ComparisonChart
          title="Nilai deal per orang"
          description={`Net Total, ${currentLabel} vs ${previousLabel}.`}
          rows={dealPeople.map((person) => ({
            label: person.name,
            bulanIni: person.current.netTotal,
            bulanLalu: person.previous.netTotal,
          }))}
          formatValue="rupiah"
        />
        <RankingChart
          title="Nilai deal (Net Total SO)"
          description={`Rupiah, ${currentLabel}.`}
          formatValue="rupiah"
          rows={[...dealPeople]
            .sort((a, b) => b.current.netTotal - a.current.netTotal || a.name.localeCompare(b.name, "id"))
            .map((person) => ({ name: person.name, value: person.current.netTotal }))}
        />
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Perbandingan nilai deal per sales</caption>
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Nama</th>
                <th scope="col" className="px-3 py-2 font-medium">Jumlah SO</th>
                <th scope="col" className="px-3 py-2 font-medium">Nilai deal (Net Total SO)</th>
              </tr>
            </thead>
            <tbody>
              {dealPeople.map((person) => (
                <tr key={person.name} className="border-t border-border align-top">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{person.name}</th>
                  <MetricCells current={person.current.count} previous={person.previous.count} />
                  <MetricCells current={person.current.netTotal} previous={person.previous.netTotal} money />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ranked(rows: PersonComparison[], pick: (row: PersonComparison) => number) {
  return [...rows]
    .sort((a, b) => pick(b) - pick(a) || a.name.localeCompare(b.name, "id"))
    .map((row) => ({ name: row.name, value: pick(row) }));
}

function ComparisonTable({
  rows,
  currentLabel,
  previousLabel,
}: {
  rows: PersonComparison[];
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">
          Perbandingan {currentLabel} dan {previousLabel} per sales
        </caption>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Nama
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Kunjungan
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nilai potensi
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nilai order
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Pipeline
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={personKey(row)} className="border-t border-border align-top">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {row.name}
              </th>
              <MetricCells current={row.current.visits} previous={row.previous.visits} />
              <MetricCells current={row.current.potential} previous={row.previous.potential} money />
              <MetricCells current={row.current.order} previous={row.previous.order} money />
              <MetricCells current={row.current.pipeline} previous={row.previous.pipeline} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCells({
  current,
  previous,
  money = false,
}: {
  current: number;
  previous: number;
  money?: boolean;
}) {
  const change = delta(current, previous);
  const format = money ? formatRp : formatNumber;
  const formatSigned = money ? formatSignedRp : formatSignedNumber;
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      <span className="block">{format(current)}</span>
      <span className="block text-xs text-muted-foreground">
        Bulan lalu {format(previous)} · {formatSigned(change.absolute)} · {formatPercent(change.percent)}
      </span>
    </td>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Report</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
