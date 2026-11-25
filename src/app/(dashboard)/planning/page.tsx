import { connection } from "next/server";
import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { DashboardActionBar } from "@/components/dashboard-action-bar";
import { CalendarBoard } from "@/components/calendar-board";
import { Notice } from "@/components/notice";
import { PullSharedCalendarButton } from "@/components/pull-shared-calendar-button";
import { ChoiceGroup, SalesSelect } from "@/components/query-controls";
import {
  EMPTY_SCHEDULE_BODY,
  EMPTY_SCHEDULE_TITLE,
  eventsForSchedule,
  isOwnedScheduleEvent,
  visiblePlanBounds,
} from "@/lib/calendar";
import { describeSharedCalendarSchemaGap } from "@/lib/shared-calendar";
import { describeDataError } from "@/lib/format";
import { civilDateInJakarta, formatRangeLabel, isPlanView, periodRange, toISODate } from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { personKey } from "@/lib/metrics";
import { firstParam } from "@/lib/query";
import { resolvePersonFilter } from "@/lib/scope";
import { followUpScheduleEvents } from "@/lib/follow-up-events";
import { loadCalendarEvents, loadFollowUpVisits, loadRoster, loadUnmappedSharedEvents } from "@/lib/session";

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
  const bounds = visiblePlanBounds(view, today);
  const ownerEmail = canFilterPeople ? (selected?.email ?? null) : loaded.viewer.email;
  const selectedProfile =
    canFilterPeople && selected ? loaded.roster.find((person) => personKey(person) === personKey(selected)) ?? null : null;
  const ownerProfileId = selectedProfile && !selectedProfile.email ? selectedProfile.id : null;
  const followStart = toISODate(civilDateInJakarta(bounds.start));
  const followEnd = toISODate(civilDateInJakarta(new Date(bounds.end.getTime() - 1)));
  const [schedule, followUps, unmapped] = await Promise.all([
    loadCalendarEvents(bounds.start, bounds.end, ownerEmail, ownerProfileId),
    ownerProfileId ? Promise.resolve({ rows: [], error: null }) : loadFollowUpVisits(followStart, followEnd, ownerEmail),
    canFilterPeople ? loadUnmappedSharedEvents(bounds.start, bounds.end) : Promise.resolve({ events: [], error: null }),
  ]);
  const namesById = new Map(loaded.roster.map((person) => [person.id, person.name]));
  const calendarEvents = schedule.events
    .filter((event) => isOwnedScheduleEvent(event))
    .map((event) => ({
      ...event,
      ownerName: event.salesProfileId ? namesById.get(event.salesProfileId) ?? null : null,
    }));
  const events = eventsForSchedule([...calendarEvents, ...followUpScheduleEvents(followUps.rows)], {
    superAdmin: canFilterPeople,
    viewerEmail: loaded.viewer.email,
    selectedEmail: canFilterPeople ? (selected?.email ? selected.email : "all") : loaded.viewer.email,
  });
  const owners: Record<string, string> = {};
  for (const person of loaded.roster) {
    if (person.email) owners[person.email] = person.name;
  }
  const showOwner = canFilterPeople && !selected;
  const scheduleMessage = schedule.error ? describeSharedCalendarSchemaGap(schedule.error) ?? describeDataError(schedule.error) : null;
  const unmappedMessage = unmapped.error ? describeSharedCalendarSchemaGap(unmapped.error) ?? describeDataError(unmapped.error) : null;
  const visibleUnmapped = unmapped.events.slice(0, 40);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">Planning kegiatan</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {rangeLabel}. {events.length === 0 ? "Belum ada acara pada tampilan ini." : `${events.length} acara.`}
          </p>
        </div>
        {canFilterPeople ? <PullSharedCalendarButton /> : null}
      </div>
      <DashboardActionBar />
      {selected && !selected.email ? (
        <Notice title="Tanpa email Google" tone="warning">
          {selected.name} belum punya email Google, jadi unggah berkas .ics tidak bisa memakai akun ini. Acara kalender bersama tetap tampil bila judul atau deskripsinya memuat nama sales.
        </Notice>
      ) : null}
      {schedule.error || events.length > 0 ? null : <Notice title={EMPTY_SCHEDULE_TITLE}>{EMPTY_SCHEDULE_BODY}</Notice>}
      {loaded.error ? <Notice title="Roster gagal dimuat">{describeDataError(loaded.error)}</Notice> : null}
      {scheduleMessage ? <Notice title="Jadwal gagal dimuat">{scheduleMessage}</Notice> : null}
      {followUps.error ? <Notice title="Kunjungan ulang gagal dimuat">{describeDataError(followUps.error)}</Notice> : null}
      {canFilterPeople && unmapped.events.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {unmapped.events.length} acara belum dipetakan pada tampilan ini. Daftarnya ada di bawah.
        </p>
      ) : null}
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
      {canFilterPeople ? (
        <section className="space-y-3" aria-labelledby="belum-dipetakan">
          <div className="space-y-1">
            <h2 id="belum-dipetakan" className="font-heading text-xl tracking-tight">
              Belum dipetakan
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Acara dari kalender bersama yang tidak cocok dengan Data Sales. Sales tidak melihat daftar ini.
            </p>
          </div>
          {unmappedMessage ? <Notice title="Belum dipetakan gagal dimuat">{unmappedMessage}</Notice> : null}
          {!unmappedMessage && visibleUnmapped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada acara belum dipetakan pada tampilan ini.</p>
          ) : null}
          {visibleUnmapped.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl ring-1 ring-foreground/10">
              {visibleUnmapped.map((event) => (
                <li key={event.googleEventId} className="px-3 py-2 text-sm">
                  <p className="font-medium">{event.title.trim() || "Tanpa judul"}</p>
                  <p className="text-muted-foreground">
                    {formatEventWhen(event.startsAt, event.allDay)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {unmapped.events.length > visibleUnmapped.length ? (
            <p className="text-sm text-muted-foreground">
              Menampilkan {visibleUnmapped.length} dari {unmapped.events.length} acara.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function formatEventWhen(iso: string, allDay: boolean): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    ...(allDay ? {} : { timeStyle: "short" as const }),
  }).format(new Date(iso));
}

function PageFallback({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
