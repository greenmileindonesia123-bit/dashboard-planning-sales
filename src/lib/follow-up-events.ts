import { jakartaDayBounds, type ScheduleEvent } from "./calendar.ts";
import { addDays, parseISODate } from "./jakarta.ts";

export type FollowUpVisit = {
  id: string;
  followUpDate: string;
  customerName: string | null;
  salesEmail: string | null;
};

export function followUpScheduleEvents(rows: FollowUpVisit[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (const row of rows) {
    const email = row.salesEmail?.trim().toLowerCase();
    if (!email || !row.followUpDate) continue;
    const day = parseISODate(row.followUpDate);
    const start = jakartaDayBounds(day).start;
    const end = jakartaDayBounds(addDays(day, 1)).start;
    const customer = row.customerName?.trim() || "Tanpa nama";
    events.push({
      salesEmail: email,
      googleEventId: `kunjungan-ulang:${row.id}`,
      title: `Kunjungan ulang: ${customer}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      allDay: true,
      location: null,
      htmlLink: null,
      status: "confirmed",
      kind: "kunjungan-ulang",
    });
  }
  return events;
}
