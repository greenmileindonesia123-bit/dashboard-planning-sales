"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isQuotationReviewer, isQuotationStatus } from "@/lib/quotation-access";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type QuotationResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

const MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTING_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function createQuotation(formData: FormData): Promise<QuotationResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const descriptions = formData.getAll("description").map((value) => String(value).trim());
  const specifications = formData.getAll("specification").map((value) => String(value).trim());
  const quantities = formData.getAll("quantity").map((value) => Number(String(value).replace(",", ".")));
  const units = formData.getAll("unit").map((value) => String(value).trim());
  if (!customerName || !projectName) return { ok: false, message: "Nama customer dan nama proyek wajib diisi." };
  const items = descriptions
    .map((description, index) => ({
      description,
      specification: specifications[index] || null,
      quantity: quantities[index],
      unit: units[index] || null,
    }))
    .filter((item) => item.description);
  if (items.length === 0 || items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return { ok: false, message: "Isi minimal satu item dengan jumlah lebih dari 0." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_requests")
    .insert({
      request_number: "",
      requested_at: toISODate(civilDateInJakarta(new Date())),
      sales_email: viewer.email.trim().toLowerCase(),
      sales_name: viewer.name,
      customer_name: customerName,
      pic: empty(formData.get("pic")),
      phone: empty(formData.get("phone")),
      project_address: empty(formData.get("projectAddress")),
      project_name: projectName,
      work_type: empty(formData.get("workType")),
      target_date: empty(formData.get("targetDate")),
      notes: empty(formData.get("notes")),
      status: "Baru",
    })
    .select("id, request_number")
    .single();
  if (error || !data) return { ok: false, message: "Permintaan tidak dapat disimpan. Jalankan migrasi quotation." };

  const { error: itemError } = await supabase.from("quotation_items").insert(
    items.map((item, index) => ({
      request_id: data.id,
      line_no: index + 1,
      description: item.description,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit,
    })),
  );
  if (itemError) return { ok: false, message: "Item permintaan tidak dapat disimpan." };

  const files = formData.getAll("lampiran").filter((value): value is File => value instanceof File && value.size > 0);
  for (const file of files) {
    const problem = supportingFileProblem(file);
    if (problem) return { ok: false, message: problem };
    const path = `${data.id}/lampiran/${safeName(file.name)}`;
    const uploaded = await supabase.storage.from("quotations").upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploaded.error) return { ok: false, message: "Lampiran tidak dapat diunggah." };
    await supabase.from("quotation_attachments").insert({
      request_id: data.id,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
    });
  }

  revalidatePath("/quotation");
  return { ok: true, message: `Permintaan ${data.request_number} tersimpan.`, id: data.id };
}

export async function updateQuotationStatus(formData: FormData): Promise<QuotationResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  if (!isQuotationReviewer(viewer)) return { ok: false, message: "Hanya reviewer yang dapat mengubah status." };
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isQuotationStatus(status)) return { ok: false, message: "Status tidak dikenal." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotation_requests").update({ status }).eq("id", id);
  if (error) return { ok: false, message: "Status tidak dapat disimpan." };
  revalidatePath("/quotation");
  return { ok: true, message: "Status diperbarui." };
}

export async function uploadQuotePdf(formData: FormData): Promise<QuotationResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  if (!isQuotationReviewer(viewer)) return { ok: false, message: "Hanya reviewer yang dapat mengunggah PDF penawaran." };
  const id = String(formData.get("id") ?? "");
  const file = formData.get("pdf");
  if (!(file instanceof File)) return { ok: false, message: "Pilih file PDF." };
  if (file.size === 0 || file.size > MAX_BYTES) return { ok: false, message: "PDF maksimal 20 MB." };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return { ok: false, message: "File penawaran harus PDF." };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 5).toString("utf8").startsWith("%PDF")) return { ok: false, message: "Isi file bukan PDF." };
  const path = `${id}/penawaran/penawaran.pdf`;
  const supabase = await createClient();
  const uploaded = await supabase.storage.from("quotations").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploaded.error) return { ok: false, message: "PDF tidak dapat diunggah. Jalankan migrasi storage quotation." };
  const { error } = await supabase.from("quotation_requests").update({ quote_pdf_path: path, status: "Selesai" }).eq("id", id);
  if (error) return { ok: false, message: "Status selesai tidak dapat disimpan." };
  revalidatePath("/quotation");
  return { ok: true, message: "PDF penawaran tersimpan. Status menjadi Selesai." };
}

function supportingFileProblem(file: File): string | null {
  if (file.size > MAX_BYTES) return "Lampiran maksimal 20 MB.";
  if (!SUPPORTING_TYPES.has(file.type)) return "Lampiran harus gambar atau PDF.";
  return null;
}

function empty(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "lampiran";
}
