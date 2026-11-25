import { eventOverlapsInterval } from "./calendar.ts";
import { matchSalesPerson } from "./sales-order/aliases.ts";

export const SHARED_CALENDAR_ID =
  "335c505e06e2d581fd5b94594158bca5005ccad45c9b13045b28ae058f742390@group.calendar.google.com";

export const SHARED_CALENDAR_SOURCE = "shared_calendar";
export const ICS_UPLOAD_SOURCE = "ics_upload";

const BRACKET_TITLE = /^\[([^\]\n]+)\]/;
const DASH_TITLE = /^(.+?)\s+[-–—]\s+\S/;
const SALES_LINE = /^\s*sales\s*:\s*(.+)$/i;

export type SharedCalendarRosterPerson = {
  id: string;
  name: string;
  email: string | null;
};

export type SharedCalendarIncoming = {
  googleEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  salesProfileId: string | null;
  salesEmail: string | null;
};

export type SharedCalendarExisting = SharedCalendarIncoming & {
  id: string;
};

export type SharedCalendarSyncSummary = {
  pulled: number;
  inserted: number;
  updated: number;
  deleted: number;
  unmapped: number;
};

export type SharedCalendarUnmappedSample = {
  googleEventId: string;
  title: string;
  startsAt: string;
  allDay: boolean;
  cancelled: boolean;
};

export type SharedCalendarDiff = {
  events: SharedCalendarIncoming[];
  inserts: SharedCalendarIncoming[];
  updates: SharedCalendarIncoming[];
  deleteIds: string[];
  summary: SharedCalendarSyncSummary;
};

export type SharedCalendarPullResult =
  | (SharedCalendarSyncSummary & {
      ok: true;
      message: string;
      unmappedEvents: SharedCalendarUnmappedSample[];
    })
  | { ok: false; message: string };

type MappableEvent = {
  title: string;
  description: string | null;
  organizerEmail: string | null;
  attendeeEmails: readonly string[];
};

type DraftFields = {
  googleEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  status: SharedCalendarIncoming["status"];
};

export function sharedCalendarIcsUrl(envUrl?: string | null): string | null {
  const override = envUrl?.trim() ?? "";
  if (!override) {
    return `https://calendar.google.com/calendar/ical/${encodeURIComponent(SHARED_CALENDAR_ID)}/public/basic.ics`;
  }
  try {
    const url = new URL(override);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isMissingSharedCalendarSchema(message: string): boolean {
  return /sales_profile_id|calendar_events\.source|['"]source['"]|apply_shared_calendar_sync|could not find the function/i.test(message);
}

export function describeSharedCalendarSchemaGap(message: string): string | null {
  if (!isMissingSharedCalendarSchema(message)) return null;
  return "Migrasi tarik kalender bersama belum dijalankan.";
}

export function mapSharedCalendarOwner(
  event: MappableEvent,
  roster: readonly SharedCalendarRosterPerson[],
): SharedCalendarRosterPerson | null {
  const organizer = matchRosterEmail(event.organizerEmail, roster);
  if (organizer) return organizer;

  const attendees = uniquePeople(
    event.attendeeEmails.map((email) => matchRosterEmail(email, roster)),
  );
  if (attendees.length === 1) return attendees[0];

  return ownerFromTitle(event.title, roster) ?? ownerFromDescription(event.description, roster);
}

export function toSharedCalendarIncoming(event: DraftFields, owner: SharedCalendarRosterPerson | null): SharedCalendarIncoming {
  const email = owner?.email?.trim().toLowerCase() ?? "";
  return {
    googleEventId: event.googleEventId,
    title: event.title.replace(/\u0000/g, "").slice(0, 500),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: clip(event.location, 500),
    htmlLink: event.htmlLink,
    status: event.status,
    salesProfileId: owner?.id ?? null,
    salesEmail: email || null,
  };
}

export function diffSharedCalendarEvents(
  incoming: readonly SharedCalendarIncoming[],
  existing: readonly SharedCalendarExisting[],
  window: { start: Date; end: Date },
  options?: { removeMissing?: boolean },
): SharedCalendarDiff {
  const removeMissing = options?.removeMissing !== false;
  const incomingById = new Map<string, SharedCalendarIncoming>();
  for (const event of incoming) {
    if (!event.googleEventId) continue;
    incomingById.set(event.googleEventId, event);
  }

  const existingById = new Map<string, SharedCalendarExisting[]>();
  for (const row of existing) {
    const group = existingById.get(row.googleEventId);
    if (group) group.push(row);
    else existingById.set(row.googleEventId, [row]);
  }

  const events = [...incomingById.values()];
  const inserts: SharedCalendarIncoming[] = [];
  const updates: SharedCalendarIncoming[] = [];
  const deleteIds: string[] = [];

  for (const event of events) {
    const group = existingById.get(event.googleEventId) ?? [];
    if (group.length === 0) {
      inserts.push(event);
      continue;
    }
    if (!sameEvent(event, group[0])) updates.push(event);
    for (const extra of group.slice(1)) deleteIds.push(extra.id);
  }

  if (removeMissing) {
    for (const [googleEventId, group] of existingById) {
      if (incomingById.has(googleEventId)) continue;
      for (const row of group) {
        if (eventOverlapsInterval(row, window.start, window.end)) deleteIds.push(row.id);
      }
    }
  }

  let unmapped = 0;
  for (const event of events) {
    if (!event.salesProfileId) unmapped += 1;
  }

  return {
    events,
    inserts,
    updates,
    deleteIds,
    summary: {
      pulled: events.length,
      inserted: inserts.length,
      updated: updates.length,
      deleted: deleteIds.length,
      unmapped,
    },
  };
}

export function unmappedSamples(events: readonly SharedCalendarIncoming[], limit = 8): SharedCalendarUnmappedSample[] {
  const samples: SharedCalendarUnmappedSample[] = [];
  for (const event of events) {
    if (event.salesProfileId) continue;
    samples.push({
      googleEventId: event.googleEventId,
      title: event.title.trim() || "Tanpa judul",
      startsAt: event.startsAt,
      allDay: event.allDay,
      cancelled: event.status === "cancelled",
    });
    if (samples.length >= limit) break;
  }
  return samples;
}

export function formatSharedCalendarPullMessage(
  summary: SharedCalendarSyncSummary,
  notes?: { truncated?: boolean; unreadable?: number; keptMissing?: boolean },
): string {
  const parts = [
    `${summary.pulled} acara ditarik, ${summary.inserted} baru, ${summary.updated} diperbarui, ${summary.deleted} dihapus, ${summary.unmapped} belum dipetakan.`,
  ];
  if (notes?.truncated) parts.push("Pengulangan dipotong karena melewati batas.");
  if ((notes?.unreadable ?? 0) > 0) parts.push(`${notes?.unreadable} acara tidak dapat dibaca.`);
  if (notes?.keptMissing) parts.push("Acara yang hilang dari umpan tidak dihapus karena pembacaan tidak lengkap.");
  return parts.join(" ");
}

function ownerFromTitle(title: string, roster: readonly SharedCalendarRosterPerson[]): SharedCalendarRosterPerson | null {
  const trimmed = title.trim();
  const bracket = trimmed.match(BRACKET_TITLE);
  if (bracket) return resolveSalesName(bracket[1] ?? "", roster);
  const dashed = trimmed.match(DASH_TITLE);
  if (!dashed) return null;
  return resolveSalesName(dashed[1] ?? "", roster);
}

function ownerFromDescription(
  description: string | null,
  roster: readonly SharedCalendarRosterPerson[],
): SharedCalendarRosterPerson | null {
  if (!description) return null;
  for (const line of description.split(/\r?\n/)) {
    const match = line.match(SALES_LINE);
    if (!match?.[1]) continue;
    const person = resolveSalesLabel(match[1], roster);
    if (person) return person;
  }
  return null;
}

function resolveSalesLabel(raw: string, roster: readonly SharedCalendarRosterPerson[]): SharedCalendarRosterPerson | null {
  const direct = resolveSalesName(raw, roster);
  if (direct) return direct;
  const dashed = raw.match(DASH_TITLE);
  if (!dashed?.[1]) return null;
  return resolveSalesName(dashed[1], roster);
}

function resolveSalesName(raw: string, roster: readonly SharedCalendarRosterPerson[]): SharedCalendarRosterPerson | null {
  const matched = matchSalesPerson(raw, [...roster]);
  if (!matched) return null;
  const name = matched.name.trim().toLowerCase();
  return roster.find((person) => person.name.trim().toLowerCase() === name) ?? null;
}

function matchRosterEmail(
  email: string | null,
  roster: readonly SharedCalendarRosterPerson[],
): SharedCalendarRosterPerson | null {
  const key = email?.trim().toLowerCase() ?? "";
  if (!key) return null;
  return roster.find((person) => person.email?.trim().toLowerCase() === key) ?? null;
}

function uniquePeople(people: Array<SharedCalendarRosterPerson | null>): SharedCalendarRosterPerson[] {
  const found: SharedCalendarRosterPerson[] = [];
  for (const person of people) {
    if (!person || found.some((item) => item.id === person.id)) continue;
    found.push(person);
  }
  return found;
}

function sameEvent(incoming: SharedCalendarIncoming, existing: SharedCalendarExisting): boolean {
  return (
    incoming.title === (existing.title ?? "") &&
    sameInstant(incoming.startsAt, existing.startsAt) &&
    sameInstant(incoming.endsAt, existing.endsAt) &&
    incoming.allDay === existing.allDay &&
    (incoming.location ?? null) === (existing.location ?? null) &&
    (incoming.htmlLink ?? null) === (existing.htmlLink ?? null) &&
    incoming.status === existing.status &&
    (incoming.salesProfileId ?? null) === (existing.salesProfileId ?? null) &&
    normalizeEmail(incoming.salesEmail) === normalizeEmail(existing.salesEmail)
  );
}

function sameInstant(left: string, right: string): boolean {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  return Number.isFinite(a) && a === b;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email || null;
}

function clip(value: string | null, max: number): string | null {
  const trimmed = value?.replace(/\u0000/g, "").trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
