import {
  dayKey,
  eventsOnDay,
  formatJakartaClock,
  jakartaHour,
  safeEventLink,
  type ScheduleEvent,
} from "@/lib/calendar";
import {
  formatDayMonth,
  formatLongDate,
  formatWeekdayShort,
  monthGrid,
  toISODate,
  weekDays,
  type CivilDate,
  type PlanView,
} from "@/lib/jakarta";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function CalendarBoard({
  view,
  today,
  personLabel,
  events,
  owners,
  showOwner,
}: {
  view: PlanView;
  today: CivilDate;
  personLabel: string;
  events: ScheduleEvent[];
  owners: Record<string, string>;
  showOwner: boolean;
}) {
  const todayIso = toISODate(today);
  const countLabel = events.length === 0 ? "tidak ada acara" : `${events.length} acara`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {personLabel} · {formatLongDate(todayIso)} · {countLabel}
      </p>
      {view === "hari" ? <DayBoard today={today} events={events} owners={owners} showOwner={showOwner} /> : null}
      {view === "minggu" ? (
        <WeekBoard today={today} todayIso={todayIso} events={events} owners={owners} showOwner={showOwner} />
      ) : null}
      {view === "bulan" ? (
        <MonthBoard today={today} todayIso={todayIso} events={events} owners={owners} showOwner={showOwner} />
      ) : null}
    </div>
  );
}

function DayBoard({
  today,
  events,
  owners,
  showOwner,
}: {
  today: CivilDate;
  events: ScheduleEvent[];
  owners: Record<string, string>;
  showOwner: boolean;
}) {
  const dayEvents = eventsOnDay(events, today);
  const allDay = dayEvents.filter((event) => event.allDay);
  const outside = dayEvents.filter((event) => !event.allDay && !inWorkHour(event));
  const empty = dayEvents.length === 0;
  return (
    <div className="space-y-3">
      {allDay.length > 0 ? (
        <EventGroup label="Seharian" events={allDay} owners={owners} showOwner={showOwner} />
      ) : null}
      {outside.length > 0 ? (
        <EventGroup label="Di luar 08.00–18.00" events={outside} owners={owners} showOwner={showOwner} />
      ) : null}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <caption className="sr-only">Jadwal hari ini, zona waktu Asia/Jakarta</caption>
          <tbody>
            {HOURS.map((hour) => {
              const hourEvents = dayEvents.filter((event) => !event.allDay && jakartaHour(event.startsAt) === hour);
              return (
                <tr key={hour} className="border-t border-border first:border-t-0">
                  <th scope="row" className="w-24 px-3 py-3 text-left align-top font-medium tabular-nums">
                    {String(hour).padStart(2, "0")}.00
                  </th>
                  <td className="px-3 py-3">
                    {hourEvents.length > 0 ? (
                      <div className="space-y-2">
                        {hourEvents.map((event) => (
                          <EventChip key={eventKey(event)} event={event} owners={owners} showOwner={showOwner} />
                        ))}
                      </div>
                    ) : empty ? (
                      <span className="text-muted-foreground">Kosong</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeekBoard({
  today,
  todayIso,
  events,
  owners,
  showOwner,
}: {
  today: CivilDate;
  todayIso: string;
  events: ScheduleEvent[];
  owners: Record<string, string>;
  showOwner: boolean;
}) {
  const days = weekDays(today);
  const empty = events.length === 0;
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">Minggu berjalan, zona waktu Asia/Jakarta</caption>
        <thead className="bg-muted">
          <tr>
            {days.map((day) => {
              const iso = toISODate(day);
              const isToday = iso === todayIso;
              return (
                <th key={iso} scope="col" className="px-2 py-2 text-left font-medium">
                  <span className="block text-xs text-muted-foreground">{formatWeekdayShort(day)}</span>
                  <span className={isToday ? "text-primary" : undefined}>{formatDayMonth(iso)}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {days.map((day) => {
              const dayEvents = eventsOnDay(events, day);
              return (
                <td key={dayKey(day)} className="h-40 border-t border-border px-2 py-3 align-top">
                  {dayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <EventChip key={eventKey(event)} event={event} owners={owners} showOwner={showOwner} />
                      ))}
                    </div>
                  ) : empty ? (
                    <span className="text-muted-foreground">Kosong</span>
                  ) : null}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MonthBoard({
  today,
  todayIso,
  events,
  owners,
  showOwner,
}: {
  today: CivilDate;
  todayIso: string;
  events: ScheduleEvent[];
  owners: Record<string, string>;
  showOwner: boolean;
}) {
  const cells = monthGrid(today);
  const empty = events.length === 0;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[36rem] grid-cols-7 gap-1">
        {weekDays(today).map((day) => (
          <div key={formatWeekdayShort(day)} className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {formatWeekdayShort(day)}
          </div>
        ))}
        {cells.map((day) => {
          const iso = toISODate(day);
          const inMonth = day.month === today.month;
          const isToday = iso === todayIso;
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, 2);
          const extra = dayEvents.length - visible.length;
          return (
            <div
              key={iso}
              className={`min-h-24 rounded-lg border px-2 py-1.5 ${
                inMonth ? "border-border bg-card" : "border-transparent bg-muted/50 text-muted-foreground"
              } ${isToday ? "ring-2 ring-primary" : ""}`}
            >
              <p className="text-xs tabular-nums">{day.day}</p>
              {visible.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {visible.map((event) => (
                    <li key={eventKey(event)}>
                      <EventChip event={event} owners={owners} showOwner={showOwner} compact />
                    </li>
                  ))}
                  {extra > 0 ? <li className="text-xs text-muted-foreground">+{extra} lagi</li> : null}
                </ul>
              ) : inMonth && empty ? (
                <p className="mt-3 text-xs text-muted-foreground">Kosong</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventGroup({
  label,
  events,
  owners,
  showOwner,
}: {
  label: string;
  events: ScheduleEvent[];
  owners: Record<string, string>;
  showOwner: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{label}</h2>
      <div className="space-y-2">
        {events.map((event) => (
          <EventChip key={eventKey(event)} event={event} owners={owners} showOwner={showOwner} />
        ))}
      </div>
    </section>
  );
}

function EventChip({
  event,
  owners,
  showOwner,
  compact = false,
}: {
  event: ScheduleEvent;
  owners: Record<string, string>;
  showOwner: boolean;
  compact?: boolean;
}) {
  const followUp = event.kind === "kunjungan-ulang";
  const title = event.title.trim() || "Tanpa judul";
  const when = event.allDay ? "Seharian" : `${formatJakartaClock(event.startsAt)}–${formatJakartaClock(event.endsAt)}`;
  const owner = showOwner ? owners[event.salesEmail] || event.salesEmail : null;
  const href = safeEventLink(event.htmlLink);
  const body = (
    <>
      {followUp ? <span className="block text-[10px] font-medium tracking-wide text-warning-foreground uppercase">Kunjungan ulang</span> : null}
      <span className={`block font-medium ${compact ? "truncate text-xs" : ""}`}>{title}</span>
      {compact ? null : (
        <span className="block text-xs text-muted-foreground">
          {[when, owner, event.location].filter(Boolean).join(" · ")}
        </span>
      )}
    </>
  );
  const className = followUp
    ? "block rounded-md bg-warning/15 px-2 py-1 ring-1 ring-warning/40"
    : "block rounded-md bg-accent px-2 py-1";
  if (!href) return <div className={className}>{body}</div>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} hover:underline`}>
      {body}
    </a>
  );
}

function inWorkHour(event: ScheduleEvent): boolean {
  const hour = jakartaHour(event.startsAt);
  return hour >= 8 && hour <= 17;
}

function eventKey(event: ScheduleEvent): string {
  return `${event.salesEmail}:${event.googleEventId}`;
}
