import { excelResponse, workbookBuffer } from "@/lib/excel-file";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return new Response("Masuk terlebih dahulu.", { status: 401 });
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_requests")
    .select("request_number, requested_at, sales_name, customer_name, project_name, target_date, status")
    .order("requested_at", { ascending: false });
  if (error) return new Response("Data tidak dapat diekspor.", { status: 500 });
  const rows = (data ?? []).filter((row) => {
    const haystack = `${row.customer_name} ${row.project_name} ${row.request_number}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (status && row.status !== status) return false;
    return true;
  });
  const body = await workbookBuffer([
    {
      name: "Quotation",
      rows: [
        ["Nomor", "Tanggal", "Sales", "Customer", "Proyek", "Target", "Status"],
        ...rows.map((row) => [row.request_number, row.requested_at, row.sales_name, row.customer_name, row.project_name, row.target_date || "-", row.status]),
      ],
    },
  ]);
  return excelResponse("permintaan-quotation.xlsx", body);
}
