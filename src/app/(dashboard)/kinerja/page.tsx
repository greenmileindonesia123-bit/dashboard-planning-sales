import { connection } from "next/server";
import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { KpiGrid } from "@/components/kpi-grid";
import { Notice } from "@/components/notice";
import { ChoiceGroup, SalesSelect } from "@/components/query-controls";
import { formatNumber, formatRp, describeDataError } from "@/lib/format";
import {
  civilDateInJakarta,
  formatRangeLabel,
  isPeriod,
  periodRange,
  previousMonthRange,
  type Period,
} from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { belongsTo, personKey, purposeCounts, summarize } from "@/lib/metrics";
import { firstParam } from "@/lib/query";
import { dealRoster, dealsForPerson, dealsInRange, summarizeDeals, visibleDeals } from "@/lib/sales-order/metrics";
import { figuresFor, resolvePersonFilter, viewerIdentity } from "@/lib/scope";
import { loadRoster, loadSalesOrders, loadVisits } from "@/lib/session";

export const metadata = { title: "Kinerja" };

const PERIODS: { value: Period; label: string }[] = [
  { value: "hari", label: "Hari" },
  { value: "minggu", label: "Minggu" },
  { value: "bulan", label: "Bulan" },
  { value: "tahun", label: "Tahun" },
];

export default function KinerjaPage(props: PageProps<"/kinerja">) {
  return (
    <Suspense fallback={<PageFallback title="Kinerja kunjungan" />}>
      <KinerjaScreen searchParams={props.searchParams} />
    </Suspense>
  );
}

async function KinerjaScreen({
  searchParams,
}: {
  searchParams: PageProps<"/kinerja">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const requestedPeriod = firstParam(params.periode);
  const period = isPeriod(requestedPeriod) ? requestedPeriod : "bulan";
  const today = civilDateInJakarta(new Date());
  const range = periodRange(period, today);
  const earlier = previousMonthRange(today);
  const orderStart = period === "bulan" ? earlier.start : range.start;
  const [rosterLoaded, visitLoaded, orderLoaded] = await Promise.all([
    loadRoster(),
    loadVisits(range.start, range.end),
    loadSalesOrders(orderStart, range.end),
  ]);
  const viewer = visitLoaded.viewer.kind === "ok" ? visitLoaded.viewer : rosterLoaded.viewer;
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;

  const roster = rosterLoaded.roster;
  const canFilterPeople = isSuperAdmin(viewer);
  const selected = resolvePersonFilter(viewer, firstParam(params.sales), roster);
  const own = viewerIdentity(viewer);
  const scoped = canFilterPeople
    ? visitLoaded.visits
    : visitLoaded.visits.filter((visit) => belongsTo(visit, own));
  const visible = selected ? scoped.filter((visit) => belongsTo(visit, selected)) : scoped;
  const snapshot = summarize(visible);
  const people = figuresFor(viewer, roster, selected);
  const purposes = purposeCounts(visible);
  const dealScope = visibleDeals(orderLoaded.orders, {
    superAdmin: canFilterPeople,
    viewerEmail: viewer.email,
    selectedEmail: selected ? selected.email : undefined,
  });
  const dealNow = summarizeDeals(dealsInRange(dealScope, range));
  const dealPrevious = period === "bulan" ? summarizeDeals(dealsInRange(dealScope, earlier)) : null;
  const dealPeople = dealRoster(roster, { superAdmin: canFilterPeople, viewer, selected });
  const error = visitLoaded.error ?? rosterLoaded.error ?? orderLoaded.error;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Kinerja kunjungan</h1>
        <p className="text-sm text-muted-foreground">{formatRangeLabel(period, range)} · Asia/Jakarta</p>
      </div>
      {error ? <Notice title="Sebagian data gagal dimuat">{describeDataError(error)}</Notice> : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <ChoiceGroup
          label="Periode"
          value={period}
          param="periode"
          pathname="/kinerja"
          preserved={{ sales: canFilterPeople && selected ? personKey(selected) : undefined }}
          options={PERIODS}
        />
        {canFilterPeople ? (
          <SalesSelect
            value={selected ? personKey(selected) : ""}
            includeAll
            param="sales"
            pathname="/kinerja"
            preserved={{ periode: period }}
            options={roster.map((person) => ({
              value: personKey(person),
              label: person.name,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Angka ini hanya untuk {viewer.name}.</p>
        )}
      </div>
      <KpiGrid
        items={[
          { label: "Total kunjungan", value: formatNumber(snapshot.visits) },
          { label: "Terlaksana", value: formatNumber(snapshot.completed) },
          { label: "Deal", value: formatNumber(snapshot.deals) },
          { label: "Nilai order", value: formatRp(snapshot.order) },
          { label: "Jumlah SO", value: formatNumber(dealNow.count) },
          { label: "Nilai deal (Net Total SO)", value: formatRp(dealNow.netTotal) },
        ]}
      />
      {dealPrevious ? (
        <p className="text-sm text-muted-foreground">
          Bulan lalu: {formatNumber(dealPrevious.count)} SO · Nilai deal (Net Total SO) {formatRp(dealPrevious.netTotal)}. Pembatalan dan draft tidak dihitung.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nilai deal (Net Total SO) mengikuti periode di atas. Pembatalan dan draft tidak dihitung.</p>
      )}
      {snapshot.visits === 0 ? (
        <Notice title="Belum ada laporan kunjungan">
          Angka kunjungan 0 karena belum ada laporan kunjungan. Tidak ada data contoh. Nilai deal tetap dihitung dari Sales Order jika sudah diunggah.
        </Notice>
      ) : null}
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Ringkasan kinerja per sales pada periode terpilih</caption>
          <thead className="bg-muted text-left">
            <tr>
              {["Nama", "Kunjungan", "Terlaksana", "Deal", "Nilai potensi", "Nilai order", "Jumlah SO", "Nilai deal (Net Total SO)"].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const rows = visible.filter((visit) => belongsTo(visit, person));
              const row = summarize(rows);
              const deals = summarizeDeals(dealsForPerson(dealsInRange(dealScope, range), { name: person.name, email: person.email }));
              return (
                <tr key={personKey(person)} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {person.name}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.visits)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.completed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.deals)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(row.potential)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(row.order)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(deals.count)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(deals.netTotal)}</td>
                </tr>
              );
            })}
            {dealPeople.filter((person) => person.unmapped).map((person) => {
              const deals = summarizeDeals(dealsForPerson(dealsInRange(dealScope, range), person));
              return (
                <tr key={person.name} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {person.name}
                  </th>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(deals.count)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(deals.netTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {purposes.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <caption className="px-3 py-2 text-left font-medium">Tujuan kunjungan</caption>
            <tbody>
              {purposes.map((item) => (
                <tr key={item.purpose} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {item.purpose}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="px-3 py-2 text-left font-medium">Baris laporan</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Tanggal", "Sales", "Customer", "Status", "Hasil", "Potensi", "Order", "Pipeline"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((visit, index) => (
                <tr key={`${visit.visitDate}-${visit.salesName}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{visit.visitDate}</td>
                  <td className="px-3 py-2">{visit.salesName}</td>
                  <td className="px-3 py-2">{visit.customerName || "—"}</td>
                  <td className="px-3 py-2">{visit.visitStatus || "—"}</td>
                  <td className="px-3 py-2">{visit.activityResult || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(visit.potentialValue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(visit.orderValue)}</td>
                  <td className="px-3 py-2">{visit.pipelineStatus || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function PageFallback({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
