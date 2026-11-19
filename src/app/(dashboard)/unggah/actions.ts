"use server";

import { redirect } from "next/navigation";
import { parseVisitSheets, planUpsert, rowsForViewer } from "@/lib/visit-import/map-file";
import { readVisitUpload } from "@/lib/visit-import/read-workbook";
import type { SkippedRow, VisitDraft } from "@/lib/visit-import/types";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type ImportPreview = {
  ok: true;
  fileName: string;
  ready: VisitDraft[];
  skipped: SkippedRow[];
  skippedCount: number;
  trainingRowsIgnored: number;
  inserted: number;
  updated: number;
  saved: boolean;
};

export type ImportFailure = { ok: false; message: string };

const PREVIEW_LIMIT = 40;

export async function previewVisitFile(formData: FormData): Promise<ImportPreview | ImportFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  return { ...prepared.preview, saved: false };
}

export async function importVisitFile(formData: FormData): Promise<ImportPreview | ImportFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  if (prepared.allowed.length === 0) return { ...prepared.preview, saved: false };

  const supabase = await createClient();
  const chunkSize = 100;
  for (let index = 0; index < prepared.allowed.length; index += chunkSize) {
    const chunk = prepared.allowed.slice(index, index + chunkSize).map(toRow);
    const { error } = await supabase.from("visit_reports").upsert(chunk, { onConflict: "external_id" });
    if (error) {
      return { ok: false, message: "Baris tidak dapat disimpan. Periksa hak akses atau jalankan migrasi tulis laporan." };
    }
  }
  return { ...prepared.preview, saved: true };
}

async function prepare(
  formData: FormData,
): Promise<{ ok: true; preview: ImportPreview; allowed: VisitDraft[] } | ImportFailure> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Pilih berkas laporan terlebih dahulu." };

  const read = await readVisitUpload(file);
  if ("error" in read) return { ok: false, message: read.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_profiles").select("name, email").eq("status", "Aktif");
  if (error) return { ok: false, message: "Data sales tidak dapat dimuat." };
  const roster = (data ?? []).map((person) => ({ name: String(person.name), email: person.email ? String(person.email) : null }));
  const parsed = parseVisitSheets(read.sheets, roster);
  const { allowed, skippedOther } = rowsForViewer(parsed.drafts, { email: viewer.email });
  const otherSkips: SkippedRow[] = skippedOther.map((row) => ({
    sheet: "LAPORAN KUNJUNGAN SALES",
    rowNumber: 0,
    externalId: row.externalId,
    reason: `Baris ${row.salesName} tidak diimpor. Akun Sales hanya menyimpan kunjungan sendiri.`,
  }));
  const skipped = [...parsed.skipped, ...otherSkips];
  const existingIds = await loadExistingIds(allowed.map((row) => row.externalId));
  const counts = planUpsert(existingIds, allowed);

  return {
    ok: true,
    allowed,
    preview: {
      ok: true,
      fileName: file.name,
      ready: allowed.slice(0, PREVIEW_LIMIT),
      skipped: skipped.slice(0, PREVIEW_LIMIT),
      skippedCount: skipped.length,
      trainingRowsIgnored: parsed.trainingRowsIgnored,
      inserted: counts.inserted,
      updated: counts.updated,
      saved: false,
    },
  };
}

async function loadExistingIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const found: string[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error } = await supabase.from("visit_reports").select("external_id").in("external_id", chunk);
    if (error || !data) continue;
    for (const row of data) {
      if (row.external_id) found.push(String(row.external_id));
    }
  }
  return found;
}

function toRow(draft: VisitDraft) {
  return {
    external_id: draft.externalId,
    visit_date: draft.visitDate,
    start_time: draft.startTime,
    sales_name: draft.salesName,
    sales_email: draft.salesEmail,
    customer_name: draft.customerName,
    visit_purpose: draft.visitPurpose,
    visit_status: draft.visitStatus,
    activity_result: draft.activityResult,
    pipeline_status: draft.pipelineStatus,
    notes: draft.notes,
    follow_up_date: draft.followUpDate,
    address: draft.address,
    city_area: draft.cityArea,
    documentation_url: draft.documentationUrl,
  };
}
