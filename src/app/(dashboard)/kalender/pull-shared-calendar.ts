"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/access";
import { expansionWindow, MAX_ICS_BYTES, parseIcsCalendar } from "@/lib/calendar-ics";
import { civilDateInJakarta } from "@/lib/jakarta";
import {
  describeSharedCalendarSchemaGap,
  diffSharedCalendarEvents,
  formatSharedCalendarPullMessage,
  isMissingSharedCalendarSchema,
  mapSharedCalendarOwner,
  sharedCalendarIcsUrl,
  SHARED_CALENDAR_SOURCE,
  toSharedCalendarIncoming,
  unmappedSamples,
  type SharedCalendarExisting,
  type SharedCalendarPullResult,
  type SharedCalendarRosterPerson,
} from "@/lib/shared-calendar";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const ID_CHUNK = 80;

export async function pullSharedCalendar(
  previous: SharedCalendarPullResult | null,
  formData: FormData,
): Promise<SharedCalendarPullResult> {
  void previous;
  void formData;
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  if (!isSuperAdmin(viewer)) return { ok: false, message: "Tarik jadwal kalender hanya untuk Super Admin." };

  const url = sharedCalendarIcsUrl(process.env.SHARED_CALENDAR_ICS_URL);
  if (!url) return { ok: false, message: "SHARED_CALENDAR_ICS_URL harus berupa alamat https." };

  let ics: string;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
    });
    if (!response.ok) return { ok: false, message: `Kalender bersama tidak dapat diunduh (HTTP ${response.status}).` };
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_ICS_BYTES) return { ok: false, message: "Umpan kalender melebihi 8 MB." };
    ics = await response.text();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, message: "Umpan kalender tidak menjawab dalam 15 detik." };
    }
    return { ok: false, message: "Umpan kalender tidak dapat diunduh." };
  }

  if (!ics.trim()) return { ok: false, message: "Umpan kalender kosong." };
  if (ics.length > MAX_ICS_BYTES) return { ok: false, message: "Umpan kalender melebihi 8 MB." };
  if (/<!doctype html|<html/i.test(ics.slice(0, 300))) {
    return { ok: false, message: "Umpan kalender tidak berupa berkas .ics. Pastikan kalender bersama bersifat publik." };
  }

  const bounds = expansionWindow(civilDateInJakarta(new Date()));
  let parsed;
  try {
    parsed = parseIcsCalendar(ics, bounds);
  } catch {
    return { ok: false, message: "Umpan kalender tidak dapat dibaca." };
  }

  const supabase = await createClient();
  const [rosterResult, existingResult] = await Promise.all([
    loadRoster(supabase),
    loadExistingShared(supabase, bounds, parsed.events.map((event) => event.googleEventId)),
  ]);
  if (!rosterResult) return { ok: false, message: "Data sales tidak dapat dimuat." };
  if (existingResult.error) {
    return { ok: false, message: describeSharedCalendarSchemaGap(existingResult.error) ?? "Jadwal kalender bersama tidak dapat dibaca." };
  }

  const incoming = parsed.events.map((event) =>
    toSharedCalendarIncoming(event, mapSharedCalendarOwner(event, rosterResult)),
  );
  const removeMissing = !parsed.truncated && parsed.unreadable === 0;
  const diff = diffSharedCalendarEvents(incoming, existingResult.rows, bounds, { removeMissing });
  const writeError = await applyDiff(supabase, diff.inserts.concat(diff.updates), diff.deleteIds);
  if (writeError) return { ok: false, message: writeError };

  revalidatePath("/planning");
  revalidatePath("/unggah-jadwal");

  return {
    ok: true,
    ...diff.summary,
    message: formatSharedCalendarPullMessage(diff.summary, {
      truncated: parsed.truncated,
      unreadable: parsed.unreadable,
      keptMissing: !removeMissing,
    }),
    unmappedEvents: unmappedSamples(diff.events),
  };
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function loadRoster(supabase: DbClient): Promise<SharedCalendarRosterPerson[] | null> {
  const { data, error } = await supabase.from("sales_profiles").select("id, name, email").order("roster_order");
  if (error || !data) return null;
  return data.map((person) => ({
    id: String(person.id),
    name: String(person.name),
    email: person.email ? String(person.email) : null,
  }));
}

async function loadExistingShared(
  supabase: DbClient,
  bounds: { start: Date; end: Date },
  ids: string[],
): Promise<{ rows: SharedCalendarExisting[]; error: string | null }> {
  const inWindow = await loadWindow(supabase, bounds);
  if (inWindow.error) return { rows: [], error: inWindow.error };

  const known = new Set(inWindow.rows.map((row) => row.googleEventId));
  const missing = [...new Set(ids.filter((id) => id && !known.has(id)))];
  const extras: SharedCalendarExisting[] = [];
  for (let index = 0; index < missing.length; index += ID_CHUNK) {
    const chunk = missing.slice(index, index + ID_CHUNK);
    const { data, error } = await supabase
      .from("calendar_events")
      .select(SHARED_COLUMNS)
      .eq("source", SHARED_CALENDAR_SOURCE)
      .in("google_event_id", chunk);
    if (error) return { rows: [], error: error.message };
    extras.push(...((data ?? []) as DbRow[]).map(mapRow));
  }

  const byId = new Map<string, SharedCalendarExisting>();
  for (const row of [...inWindow.rows, ...extras]) byId.set(row.id, row);
  return { rows: [...byId.values()], error: null };
}

const SHARED_COLUMNS =
  "id, sales_email, sales_profile_id, google_event_id, title, starts_at, ends_at, all_day, location, html_link, status";

type DbRow = {
  id: string;
  sales_email: string | null;
  sales_profile_id: string | null;
  google_event_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  html_link: string | null;
  status: string;
};

async function loadWindow(
  supabase: DbClient,
  bounds: { start: Date; end: Date },
): Promise<{ rows: SharedCalendarExisting[]; error: string | null }> {
  const rows: SharedCalendarExisting[] = [];
  for (let page = 0; page < 5; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("calendar_events")
      .select(SHARED_COLUMNS)
      .eq("source", SHARED_CALENDAR_SOURCE)
      .lt("starts_at", bounds.end.toISOString())
      .gt("ends_at", bounds.start.toISOString())
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], error: error.message };
    const chunk = ((data ?? []) as DbRow[]).map(mapRow);
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

function mapRow(row: DbRow): SharedCalendarExisting {
  const status = row.status === "tentative" || row.status === "cancelled" ? row.status : "confirmed";
  return {
    id: String(row.id),
    googleEventId: String(row.google_event_id),
    title: row.title ?? "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: Boolean(row.all_day),
    location: row.location,
    htmlLink: row.html_link,
    status,
    salesProfileId: row.sales_profile_id,
    salesEmail: row.sales_email ? row.sales_email.toLowerCase() : null,
  };
}

async function applyDiff(
  supabase: DbClient,
  upserts: readonly { googleEventId: string; title: string; startsAt: string; endsAt: string; allDay: boolean; location: string | null; htmlLink: string | null; status: SharedCalendarExisting["status"]; salesProfileId: string | null }[],
  deleteIds: string[],
): Promise<string | null> {
  if (upserts.length === 0 && deleteIds.length === 0) return null;
  const { error } = await supabase.rpc("apply_shared_calendar_sync", {
    p_upserts: upserts.map((event) => ({
      google_event_id: event.googleEventId,
      title: event.title,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      all_day: event.allDay,
      location: event.location,
      html_link: event.htmlLink,
      status: event.status,
      sales_profile_id: event.salesProfileId,
    })),
    p_delete_ids: deleteIds,
  });
  if (!error) return null;
  return describeWriteError(error.message);
}

function describeWriteError(message: string): string {
  if (isMissingSharedCalendarSchema(message)) return describeSharedCalendarSchemaGap(message) ?? message;
  if (/hanya untuk Super Admin|Terlalu banyak|tidak valid|tidak ada di Data Sales|Waktu acara/i.test(message)) return message;
  return "Jadwal kalender bersama tidak dapat disimpan.";
}
