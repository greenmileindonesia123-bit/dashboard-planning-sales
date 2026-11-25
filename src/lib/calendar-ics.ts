import ICAL from "ical.js";
import { jakartaDayBounds } from "./calendar.ts";
import { addMonths, startOfMonth, type CivilDate } from "./jakarta.ts";


export const MAX_ICS_BYTES = 8 * 1024 * 1024;
export const MAX_OCCURRENCES = 2000;

export type CalendarDraft = {
  googleEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  description: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
};

export type IcsParseResult = {
  events: CalendarDraft[];
  truncated: boolean;
  unreadable: number;
};

export function expansionWindow(today: CivilDate): { start: Date; end: Date } {
  const startMonth = addMonths(startOfMonth(today), -2);
  const endExclusive = addMonths(startOfMonth(today), 7);
  return {
    start: jakartaDayBounds(startMonth).start,
    end: jakartaDayBounds({ year: endExclusive.year, month: endExclusive.month, day: 1 }).start,
  };
}

export function parseIcsCalendar(icsText: string, window: { start: Date; end: Date }): IcsParseResult {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    throw new Error("unreadable");
  }

  const byId = new Map<string, CalendarDraft>();
  let truncated = false;
  let unreadable = 0;
  let occurrences = 0;

  for (const component of root.getAllSubcomponents("vevent")) {
    try {
      const event = new ICAL.Event(component);
      if (!event.uid || event.isRecurrenceException()) continue;
      if (!event.isRecurring()) {
        const draft = singleDraft(event);
        if (draft && overlaps(draft, window)) byId.set(draft.googleEventId, draft);
        continue;
      }
      const iterator = event.iterator();
      let next = iterator.next();
      let scanned = 0;
      while (next) {
        if (scanned >= 20000) {
          truncated = true;
          break;
        }
        scanned += 1;
        const details = event.getOccurrenceDetails(next);
        if (details.startDate.toJSDate() >= window.end) break;
        if (occurrences >= MAX_OCCURRENCES) {
          truncated = true;
          break;
        }
        const draft = occurrenceDraft(event, details);
        if (draft && overlaps(draft, window)) {
          byId.set(draft.googleEventId, draft);
          occurrences += 1;
        }
        next = iterator.next();
      }
    } catch {
      unreadable += 1;
    }
  }

  return {
    events: [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    truncated,
    unreadable,
  };
}

function singleDraft(event: ICAL.Event): CalendarDraft | null {
  return buildDraft(event.uid, event.component, event.startDate, event.endDate, event.summary, false);
}

function occurrenceDraft(
  event: ICAL.Event,
  details: ReturnType<ICAL.Event["getOccurrenceDetails"]>,
): CalendarDraft | null {
  const recurrenceId = details.recurrenceId?.toJSDate().toISOString() ?? details.startDate.toJSDate().toISOString();
  const draft = buildDraft(
    `${event.uid}::${recurrenceId}`,
    details.item.component,
    details.startDate,
    details.endDate,
    details.item.summary || event.summary,
    true,
  );
  if (!draft) return null;
  return withMasterParticipants(draft, event.component);
}

function buildDraft(
  googleEventId: string,
  component: ICAL.Component,
  start: ICAL.Time,
  end: ICAL.Time,
  summary: string,
  recurring: boolean,
): CalendarDraft | null {
  const id = plainText(googleEventId);
  if (!id) return null;
  const range = start.isDate ? allDayRange(start, end) : timedRange(start, end);
  if (!range) return null;
  const status = mapStatus(component.getFirstPropertyValue("status"));
  return {
    googleEventId: recurring ? id : plainText(component.getFirstPropertyValue("uid") || id),
    title: plainText(summary).slice(0, 500),
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    allDay: start.isDate,
    location: emptyToNull(plainText(String(component.getFirstPropertyValue("location") ?? ""))),
    htmlLink: httpLink(component.getFirstPropertyValue("url")),
    status,
    ...readParticipants(component),
  };
}

function withMasterParticipants(draft: CalendarDraft, master: ICAL.Component): CalendarDraft {
  const extra = readParticipants(master);
  const organizerEmail = draft.organizerEmail ?? extra.organizerEmail;
  const attendeeEmails = [...draft.attendeeEmails];
  for (const email of extra.attendeeEmails) {
    if (email !== organizerEmail && !attendeeEmails.includes(email)) attendeeEmails.push(email);
  }
  if (extra.organizerEmail && extra.organizerEmail !== organizerEmail && !attendeeEmails.includes(extra.organizerEmail)) {
    attendeeEmails.push(extra.organizerEmail);
  }
  return {
    ...draft,
    description: draft.description ?? extra.description,
    organizerEmail,
    attendeeEmails: attendeeEmails.filter((email) => email !== organizerEmail),
  };
}

function readParticipants(component: ICAL.Component): Pick<CalendarDraft, "description" | "organizerEmail" | "attendeeEmails"> {
  const organizerEmail = emailAddress(component.getFirstPropertyValue("organizer"));
  const attendeeEmails: string[] = [];
  for (const property of component.getAllProperties("attendee")) {
    const email = emailAddress(property.getFirstValue());
    if (!email || email === organizerEmail || attendeeEmails.includes(email)) continue;
    attendeeEmails.push(email);
  }
  return {
    description: descriptionText(component.getFirstPropertyValue("description")),
    organizerEmail,
    attendeeEmails,
  };
}

function allDayRange(start: ICAL.Time, end: ICAL.Time): { startsAt: string; endsAt: string } | null {
  const startCivil = { year: start.year, month: start.month, day: start.day };
  const endCivil = end?.isDate ? { year: end.year, month: end.month, day: end.day } : { year: start.year, month: start.month, day: start.day + 1 };
  const startsAt = jakartaDayBounds(startCivil).start;
  let endsAt = jakartaDayBounds(normalizeCivil(endCivil)).start;
  if (endsAt <= startsAt) endsAt = jakartaDayBounds({ ...startCivil, day: startCivil.day + 1 }).start;
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function timedRange(start: ICAL.Time, end: ICAL.Time): { startsAt: string; endsAt: string } | null {
  const startsAt = start.toJSDate();
  let endsAt = end?.toJSDate() ?? startsAt;
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  if (endsAt < startsAt) endsAt = startsAt;
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function normalizeCivil(date: { year: number; month: number; day: number }) {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function mapStatus(value: unknown): CalendarDraft["status"] {
  const status = String(value ?? "").toUpperCase();
  if (status === "CANCELLED") return "cancelled";
  if (status === "TENTATIVE") return "tentative";
  return "confirmed";
}

function overlaps(event: CalendarDraft, window: { start: Date; end: Date }): boolean {
  return new Date(event.startsAt) < window.end && new Date(event.endsAt) > window.start;
}

function httpLink(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function emptyToNull(value: string): string | null {
  return value ? value : null;
}

function plainText(value: unknown): string {
  return String(value ?? "").replace(/<[^>]*>/g, "").replace(/\u0000/g, "").trim();
}

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const withoutScheme = value.trim().replace(/^mailto:/i, "").split("?")[0]?.trim().toLowerCase() ?? "";
  if (!EMAIL_ADDRESS.test(withoutScheme)) return null;
  return withoutScheme;
}

function descriptionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\u0000/g, "")
    .trim();
  return text || null;
}
