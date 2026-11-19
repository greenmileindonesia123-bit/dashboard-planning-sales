import { connection } from "next/server";
import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { DashboardActionBar } from "@/components/dashboard-action-bar";
import { CalendarBoard } from "@/components/calendar-board";
import { Notice } from "@/components/notice";
import { ChoiceGroup, SalesSelect } from "@/components/query-controls";
import {
  EMPTY_SCHEDULE_BODY,
  EMPTY_SCHEDULE_TITLE,
  eventsForSchedule,
  visiblePlanBounds,
} from "@/lib/calendar";
import { describeDataError } from "@/lib/format";
import { civilDateInJakarta, formatRangeLabel, isPlanView, periodRange, toISODate } from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { personKey } from "@/lib/metrics";
import { firstParam } from "@/lib/query";
import { resolvePersonFilter } from "@/lib/scope";
import { followUpScheduleEvents } from "@/lib/follow-up-events";
import { loadCalendarEvents, loadFollowUpVisits, loadRoster } from "@/lib/session";

export const metadata = { title: "Planning Kegiatan" };

export default function PlanningPage(props: PageProps<"/planning">) {
  return (
    <Suspense fallback={<PageFallback title="Planning kegiatan" />}>
      <PlanningScreen searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PlanningScreen({
  searchParams,
}: {
  searchParams: PageProps<"/planning">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const loaded = await loadRoster();
  if (loaded.viewer.kind !== "ok") return <AccessState viewer={loaded.viewer} />;

  const requestedView = firstParam(params.tampilan);
  const view = isPlanView(requestedView) ? requestedView : "bulan";
  const requestedSales = firstParam(params.sales);
  const selected = resolvePersonFilter(loaded.viewer, requestedSales, loaded.roster);
  const today = civilDateInJakarta(new Date());
  const rangeLabel =
    view === "hari"
      ? formatRangeLabel("hari", periodRange("hari", today))
      : view === "minggu"
        ? formatRangeLabel("minggu", periodRange("minggu", today))
        : formatRangeLabel("bulan", periodRange("bulan", today));
  const personLabel = selected ? selected.name : "Semua sales";
  const canFilterPeople = isSuperAdmin(loaded.viewer);
  const missingEmail = Boolean(selected && !selected.email);
  const bounds = visiblePlanBounds(view, today);
  const emailFilter = canFilterPeople ? (selected?.email ?? null) : loaded.viewer.email;
  const schedule = missingEmail
    ? { events: [], error: null }
    : await loadCalendarEvents(bounds.start, bounds.end, emailFilter);
  const followStart = toISODate(civilDateInJakarta(bounds.start));
  const followEnd = toISODate(civilDateInJakarta(new Date(bounds.end.getTime() - 1)));
  const followUps = missingEmail
    ? { rows: [], error: null }
    : await loadFollowUpVisits(followStart, followEnd, emailFilter);
  const events = eventsForSchedule([...schedule.events, ...followUpScheduleEvents(followUps.rows)], {
    superAdmin: canFilterPeople,
    viewerEmail: loaded.viewer.email,
    selectedEmail: canFilterPeople ? (selected ? selected.email : "all") : loaded.viewer.email,
  });
  const owners: Record<string, string> = {};
  for (const person of loaded.roster) {
    if (person.email) owners[person.email] = person.name;
  }
  const showOwner = canFilterPeople && !selected;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Planning kegiatan</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {rangeLabel}. {events.length === 0 ? "Belum ada acara pada tampilan ini." : `${events.length} acara.`}
        </p>
        <DashboardActionBar />
      </div>
      {missingEmail ? (
        <Notice title={EMPTY_SCHEDULE_TITLE} tone="warning">
          {selected?.name} belum punya email Google, jadi kalender belum bisa dihubungkan.
        </Notice>
      ) : schedule.error || events.length > 0 ? null : (
        <Notice title={EMPTY_SCHEDULE_TITLE}>{EMPTY_SCHEDULE_BODY}</Notice>
      )}
      {loaded.error ? <Notice title="Roster gagal dimuat">{describeDataError(loaded.error)}</Notice> : null}
      {schedule.error ? <Notice title="Jadwal gagal dimuat">{describeDataError(schedule.error)}</Notice> : null}
      {followUps.error ? <Notice title="Kunjungan ulang gagal dimuat">{describeDataError(followUps.error)}</Notice> : null}
      <p className="text-sm text-muted-foreground">Acara berwarna kuning adalah kunjungan ulang dari tanggal follow-up laporan, bukan dari file .ics.</p>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <ChoiceGroup
          label="Tampilan"
          value={view}
          param="tampilan"
          pathname="/planning"
          preserved={{ sales: canFilterPeople && selected ? personKey(selected) : undefined }}
          options={[
            { value: "hari", label: "Hari" },
            { value: "minggu", label: "Minggu" },
            { value: "bulan", label: "Bulan" },
          ]}
        />
        {canFilterPeople ? (
          <SalesSelect
            value={selected ? personKey(selected) : ""}
            includeAll
            param="sales"
            pathname="/planning"
            preserved={{ tampilan: view }}
            options={loaded.roster.map((person) => ({
              value: personKey(person),
              label: person.email ? person.name : `${person.name} (belum ada email)`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Menampilkan kalender {loaded.viewer.name}.</p>
        )}
      </div>
      <CalendarBoard
        view={view}
        today={today}
        personLabel={personLabel}
        events={events}
        owners={owners}
        showOwner={showOwner}
      />
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
