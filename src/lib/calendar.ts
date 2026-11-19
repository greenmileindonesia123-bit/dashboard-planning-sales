import { addDays, monthGrid, startOfWeekMonday, TIME_ZONE, toISODate, type CivilDate, type PlanView } from "./jakarta.ts";

export const EMPTY_SCHEDULE_TITLE = "Belum ada jadwal";

export const EMPTY_SCHEDULE_BODY =
  "Jadwal .ics muncul setelah diunggah lewat Unggah jadwal kalender. Tanggal follow-up dari laporan kunjungan juga tampil sebagai kunjungan ulang, tanpa disalin ke tabel kalender.";

export type ScheduleEvent = {
  salesEmail: string;
  googleEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  status: string;
  kind?: "kalender" | "kunjungan-ulang";
};

export type ScheduleScope = {
  superAdmin: boolean;
  viewerEmail: string;
  selectedEmail: string | null | "all";
};

export function jakartaDayBounds(date: CivilDate): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.year, date.month - 1, date.day, -7, 0, 0, 0));
  const end = new Date(Date.UTC(date.year, date.month - 1, date.day + 1, -7, 0, 0, 0));
  return { start, end };
}

export function visiblePlanBounds(view: PlanView, today: CivilDate): { start: Date; end: Date } {
  if (view === "hari") return jakartaDayBounds(today);
  if (view === "minggu") {
    const startDay = startOfWeekMonday(today);
    return { start: jakartaDayBounds(startDay).start, end: jakartaDayBounds(addDays(startDay, 7)).start };
  }
  const cells = monthGrid(today);
  const first = cells[0];
  const last = cells[cells.length - 1];
  return { start: jakartaDayBounds(first).start, end: jakartaDayBounds(addDays(last, 1)).start };
}

export function eventOverlapsInterval(event: Pick<ScheduleEvent, "startsAt" | "endsAt">, start: Date, end: Date): boolean {
  return new Date(event.startsAt) < end && new Date(event.endsAt) > start;
}

export function eventOverlapsCivilDay(event: Pick<ScheduleEvent, "startsAt" | "endsAt">, day: CivilDate): boolean {
  const bounds = jakartaDayBounds(day);
  return eventOverlapsInterval(event, bounds.start, bounds.end);
}

export function eventsForSchedule(events: ScheduleEvent[], scope: ScheduleScope): ScheduleEvent[] {
  const active = events.filter((event) => event.status !== "cancelled");
  if (!scope.superAdmin) {
    const email = scope.viewerEmail.trim().toLowerCase();
    return active.filter((event) => event.salesEmail === email);
  }
  const selectedEmail = scope.selectedEmail;
  if (selectedEmail === "all") return active;
  if (!selectedEmail) return [];
  return active.filter((event) => event.salesEmail === selectedEmail.trim().toLowerCase());
}

export function jakartaHour(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return hour === 24 ? 0 : hour;
}

export function formatJakartaClock(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function eventsOnDay(events: ScheduleEvent[], day: CivilDate): ScheduleEvent[] {
  return events
    .filter((event) => eventOverlapsCivilDay(event, day))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title, "id"));
}

export function dayKey(day: CivilDate): string {
  return toISODate(day);
}

export function safeEventLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}
