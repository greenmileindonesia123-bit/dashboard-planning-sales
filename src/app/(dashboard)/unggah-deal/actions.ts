"use server";

import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/access";
import { dealNetTotal, parseSalesOrders, unmatchedDeals, type SalesOrderDraft } from "@/lib/sales-order/parse";
import { readSalesOrderUpload } from "@/lib/sales-order/read-file";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type DealPreview = {
  ok: true;
  fileName: string;
  rowCount: number;
  uniqueCount: number;
  skippedCount: number;
  excludedCount: number;
  conflictCount: number;
  dealCount: number;
  dealNetTotal: number;
  unmatched: { name: string; count: number; netTotal: number }[];
  sample: { soNumber: string; customer: string | null; orderDate: string; netTotal: number; salesPersonRaw: string; salesEmail: string | null }[];
  inserted: number;
  updated: number;
  saved: boolean;
};

export type DealFailure = { ok: false; message: string };

const SAMPLE_LIMIT = 8;

export async function previewDealFile(formData: FormData): Promise<DealPreview | DealFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  return { ...prepared.preview, saved: false };
}

export async function importDealFile(formData: FormData): Promise<DealPreview | DealFailure> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared;
  if (prepared.orders.length === 0) return { ...prepared.preview, saved: false };

  const supabase = await createClient();
  const uploadedAt = new Date().toISOString();
  const chunkSize = 100;
  for (let index = 0; index < prepared.orders.length; index += chunkSize) {
    const chunk = prepared.orders.slice(index, index + chunkSize).map((order) => ({
      so_number: order.soNumber,
      quotation: order.quotation,
      customer: order.customer,
      order_date: order.orderDate,
      net_total: order.netTotal,
      grand_total: order.grandTotal,
      status: order.status || null,
      docstatus: order.docstatus,
      source: order.source,
      sales_person_raw: order.salesPersonRaw || null,
      sales_email: order.salesEmail,
      uploaded_by: prepared.uploadedBy,
      uploaded_at: uploadedAt,
    }));
    const { error } = await supabase.from("sales_orders").upsert(chunk, { onConflict: "so_number" });
    if (error) return { ok: false, message: "Data deal tidak dapat disimpan. Jalankan migrasi sales_orders." };
  }
  return { ...prepared.preview, saved: true };
}

async function prepare(
  formData: FormData,
): Promise<{ ok: true; preview: DealPreview; orders: SalesOrderDraft[]; uploadedBy: string } | DealFailure> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  if (!isSuperAdmin(viewer)) return { ok: false, message: "Hanya Super Admin yang dapat mengunggah data deal." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Pilih berkas Sales Order terlebih dahulu." };
  const read = await readSalesOrderUpload(file);
  if ("error" in read) return { ok: false, message: read.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_profiles").select("name, email");
  if (error || !data) return { ok: false, message: "Data sales tidak dapat dimuat." };
  const roster = data.map((person) => ({ name: String(person.name), email: person.email ? String(person.email) : null }));
  const parsed = parseSalesOrders(read.rows, roster);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const deals = parsed.orders.filter((order) => order.countsAsDeal);
  const existing = await loadExistingNumbers(parsed.orders.map((order) => order.soNumber));
  let inserted = 0;
  let updated = 0;
  for (const order of parsed.orders) {
    if (existing.has(order.soNumber)) updated += 1;
    else inserted += 1;
  }

  return {
    ok: true,
    orders: parsed.orders,
    uploadedBy: viewer.email.trim().toLowerCase(),
    preview: {
      ok: true,
      fileName: file.name,
      rowCount: parsed.rowCount,
      uniqueCount: parsed.orders.length,
      skippedCount: parsed.skippedCount,
      excludedCount: parsed.orders.length - deals.length,
      conflictCount: parsed.conflictCount,
      dealCount: deals.length,
      dealNetTotal: dealNetTotal(parsed.orders),
      unmatched: unmatchedDeals(parsed.orders),
      sample: deals.slice(0, SAMPLE_LIMIT).map((order) => ({
        soNumber: order.soNumber,
        customer: order.customer,
        orderDate: order.orderDate,
        netTotal: order.netTotal,
        salesPersonRaw: order.salesPersonRaw,
        salesEmail: order.salesEmail,
      })),
      inserted,
      updated,
      saved: false,
    },
  };
}

async function loadExistingNumbers(numbers: string[]): Promise<Set<string>> {
  if (numbers.length === 0) return new Set();
  const supabase = await createClient();
  const found = new Set<string>();
  for (let index = 0; index < numbers.length; index += 100) {
    const chunk = numbers.slice(index, index + 100);
    const { data } = await supabase.from("sales_orders").select("so_number").in("so_number", chunk);
    for (const row of data ?? []) {
      if (row.so_number) found.add(String(row.so_number));
    }
  }
  return found;
}
