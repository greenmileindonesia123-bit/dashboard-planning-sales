import { canReadQuotation } from "@/lib/quotation-access";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return new Response("Masuk terlebih dahulu.", { status: 401 });
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotation_requests").select("id, sales_email, quote_pdf_path").eq("id", id).maybeSingle();
  if (error || !data?.quote_pdf_path) return new Response("PDF belum ada.", { status: 404 });
  if (!canReadQuotation(viewer, { salesEmail: String(data.sales_email) })) return new Response("Tidak diizinkan.", { status: 403 });
  const signed = await supabase.storage.from("quotations").createSignedUrl(String(data.quote_pdf_path), 60);
  if (signed.error || !signed.data?.signedUrl) return new Response("Tautan unduhan tidak dapat dibuat.", { status: 404 });
  return Response.redirect(signed.data.signedUrl);
}
