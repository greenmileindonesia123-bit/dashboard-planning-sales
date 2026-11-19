export const TIME_ZONE = "Asia/Jakarta";

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

export type DateRange = {
  start: string;
  end: string;
};

export type Period = "hari" | "minggu" | "bulan" | "tahun";
export type PlanView = "hari" | "minggu" | "bulan";

export function civilDateInJakarta(instant: Date): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function toISODate(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

export function parseISODate(iso: string): CivilDate {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(date: CivilDate, months: number): CivilDate {
  const index = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month)),
  };
}

export function weekdayIndexMonday(date: CivilDate): number {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const sundayBased = utc.getUTCDay();
  return sundayBased === 0 ? 6 : sundayBased - 1;
}

export function startOfWeekMonday(date: CivilDate): CivilDate {
  return addDays(date, -weekdayIndexMonday(date));
}

export function startOfMonth(date: CivilDate): CivilDate {
  return { year: date.year, month: date.month, day: 1 };
}

export function endOfMonth(date: CivilDate): CivilDate {
  return {
    year: date.year,
    month: date.month,
    day: daysInMonth(date.year, date.month),
  };
}

export function monthRange(date: CivilDate): DateRange {
  return {
    start: toISODate(startOfMonth(date)),
    end: toISODate(endOfMonth(date)),
  };
}

export function previousMonthRange(date: CivilDate): DateRange {
  return monthRange(addMonths(startOfMonth(date), -1));
}

export function periodRange(period: Period, today: CivilDate): DateRange {
  if (period === "hari") {
    const iso = toISODate(today);
    return { start: iso, end: iso };
  }
  if (period === "minggu") {
    const start = startOfWeekMonday(today);
    return { start: toISODate(start), end: toISODate(addDays(start, 6)) };
  }
  if (period === "bulan") return monthRange(today);
  return { start: `${today.year}-01-01`, end: `${today.year}-12-31` };
}

export function weekDays(today: CivilDate): CivilDate[] {
  const start = startOfWeekMonday(today);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGrid(month: CivilDate): CivilDate[] {
  const first = addDays(startOfMonth(month), -weekdayIndexMonday(startOfMonth(month)));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

function utcNoon(date: CivilDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
}

export function formatMonthLabel(date: CivilDate): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(utcNoon(startOfMonth(date)));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utcNoon(parseISODate(iso)));
}

export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(utcNoon(parseISODate(iso)));
}

export function formatWeekdayShort(date: CivilDate): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "short",
  }).format(utcNoon(date));
}

export function formatRangeLabel(period: Period, range: DateRange): string {
  if (period === "hari") return formatLongDate(range.start);
  if (period === "tahun") return range.start.slice(0, 4);
  if (period === "bulan") return formatMonthLabel(parseISODate(range.start));
  return `${formatDayMonth(range.start)} – ${formatDayMonth(range.end)} ${range.end.slice(0, 4)}`;
}

export function isPeriod(value: string | undefined): value is Period {
  return value === "hari" || value === "minggu" || value === "bulan" || value === "tahun";
}

export function isPlanView(value: string | undefined): value is PlanView {
  return value === "hari" || value === "minggu" || value === "bulan";
}
