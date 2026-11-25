"use server";

import { redirect } from "next/navigation";
import { expansionWindow, MAX_ICS_BYTES, parseIcsCalendar, type CalendarDraft } from "@/lib/calendar-ics";
import { calendarOwnerEmail } from "@/lib/calendar-owner";
import { civilDateInJakarta } from "@/lib/jakarta";
import { ICS_UPLOAD_SOURCE, isMissingSharedCalendarSchema } from "@/lib/shared-calendar";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type CalendarPreview = {
  ok: true;
  fileName: string;
  ownerName: string;
  ownerEmail: string;
  total: number;
  cancelled: number;
  truncated: boolean;
  unreadable: number;
  earliest: string | null;
  latest: string | null;
  sample: CalendarDraft[];
  inserted: number;
  updated: number;
  saved: boolean;
};

export type CalendarFailure = { ok: false; message: string };

const SAMPLE_LIMIT = 12;

export async function previewCalendarFile(formData: FormData): Promise<CalendarPreview | CalendarFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  return { ...prepared.preview, saved: false };
}

export async function importCalendarFile(formData: FormData): Promise<CalendarPreview | CalendarFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  if (prepared.events.length === 0) return { ...prepared.preview, saved: false };

  const supabase = await createClient();
  const chunkSize = 100;
  for (let index = 0; index < prepared.events.length; index += chunkSize) {
    const chunk = prepared.events.slice(index, index + chunkSize).map((event) => ({
      sales_email: prepared.preview.ownerEmail,
      sales_profile_id: prepared.ownerId,
      google_event_id: event.googleEventId,
      title: event.title,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      all_day: event.allDay,
      location: event.location,
      html_link: event.htmlLink,
      status: event.status,
      source: ICS_UPLOAD_SOURCE,
    }));
    let { error } = await supabase.from("calendar_events").upsert(chunk, { onConflict: "source,sales_email,google_event_id" });
    if (error && isMissingSharedCalendarSchema(error.message)) {
      const legacy = chunk.map((row) => ({
        sales_email: row.sales_email,
        google_event_id: row.google_event_id,
        title: row.title,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        all_day: row.all_day,
        location: row.location,
        html_link: row.html_link,
        status: row.status,
      }));
      const retry = await supabase.from("calendar_events").upsert(legacy, { onConflict: "sales_email,google_event_id" });
      error = retry.error;
    }
    if (error) {
      return { ok: false, message: "Jadwal tidak dapat disimpan. Jalankan migrasi tulis kalender." };
    }
  }
  return { ...prepared.preview, saved: true };
}

async function prepare(formData: FormData): Promise<{ ok: true; preview: CalendarPreview; events: CalendarDraft[]; ownerId: string } | CalendarFailure> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Pilih berkas .ics terlebih dahulu." };
  const readError = validateIcsFile(file);
  if (readError) return { ok: false, message: readError };

  const roster = await loadActiveEmails();
  if (!roster) return { ok: false, message: "Data sales tidak dapat dimuat." };
  const requested = String(formData.get("salesEmail") ?? "");
  const ownerEmail = calendarOwnerEmail(viewer, requested || null);
  if (!ownerEmail) return { ok: false, message: "Pilih sales pemilik jadwal ini." };
  const owner = roster.find((person) => person.email === ownerEmail);
  if (!owner) return { ok: false, message: "Sales yang dipilih tidak ada di Data Sales atau belum punya email." };

  let parsed;
  try {
    parsed = parseIcsCalendar(await file.text(), expansionWindow(civilDateInJakarta(new Date())));
  } catch {
    return { ok: false, message: "Berkas .ics tidak dapat dibaca." };
  }
  const existing = await loadExistingIds(owner.email, parsed.events.map((event) => event.googleEventId));
  const existingSet = new Set(existing);
  let inserted = 0;
  let updated = 0;
  for (const event of parsed.events) {
    if (existingSet.has(event.googleEventId)) updated += 1;
    else inserted += 1;
  }
  const starts = parsed.events.map((event) => event.startsAt).sort();
  return {
    ok: true,
    events: parsed.events,
    ownerId: owner.id,
    preview: {
      ok: true,
      fileName: file.name,
      ownerName: owner.name,
      ownerEmail: owner.email,
      total: parsed.events.length,
      cancelled: parsed.events.filter((event) => event.status === "cancelled").length,
      truncated: parsed.truncated,
      unreadable: parsed.unreadable,
      earliest: starts[0] ?? null,
      latest: starts[starts.length - 1] ?? null,
      sample: parsed.events.filter((event) => event.status !== "cancelled").slice(0, SAMPLE_LIMIT),
      inserted,
      updated,
      saved: false,
    },
  };
}

function validateIcsFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (file.size === 0) return "Berkas kosong.";
  if (file.size > MAX_ICS_BYTES) return "Ukuran berkas melebihi 8 MB.";
  if (name.endsWith(".zip")) {
    return "Berkas .zip belum dibaca langsung. Ekstrak dulu, lalu unggah file .ics di dalamnya.";
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return "Google Calendar tidak mengekspor Excel. Unggah file .ics apa adanya.";
  }
  if (!name.endsWith(".ics")) return "Gunakan file .ics dari Google Calendar.";
  return null;
}

async function loadActiveEmails(): Promise<{ id: string; name: string; email: string }[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_profiles").select("id, name, email").eq("status", "Aktif").order("roster_order");
  if (error || !data) return null;
  return data
    .filter((person) => person.email)
    .map((person) => ({ id: String(person.id), name: String(person.name), email: String(person.email).toLowerCase() }));
}

async function loadExistingIds(salesEmail: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const found: string[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data } = await supabase
      .from("calendar_events")
      .select("google_event_id")
      .eq("sales_email", salesEmail)
      .in("google_event_id", chunk);
    for (const row of data ?? []) {
      if (row.google_event_id) found.push(String(row.google_event_id));
    }
  }
  return found;
}
