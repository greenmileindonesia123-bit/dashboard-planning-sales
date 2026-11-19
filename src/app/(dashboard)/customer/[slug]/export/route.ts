import { loadCustomerDetail } from "@/app/(dashboard)/customer/load";
import { excelResponse, workbookBuffer } from "@/lib/excel-file";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { getViewer } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return new Response("Masuk terlebih dahulu.", { status: 401 });
  const { slug } = await context.params;
  const today = toISODate(civilDateInJakarta(new Date()));
  const loaded = await loadCustomerDetail(viewer, slug, today);
  if (!loaded.summary) return new Response("Customer tidak ditemukan.", { status: 404 });
  const customer = loaded.summary;
  const body = await workbookBuffer([
    {
      name: "Profil",
      rows: [
        ["Customer", customer.name],
        ["Alamat", customer.address || "-"],
        ["PIC", customer.pic || "-"],
        ["No telp", customer.phone || "-"],
        ["Sales", customer.salesName],
      ],
    },
    {
      name: "Histori",
      rows: [
        ["Tanggal", "Jenis", "Judul", "Detail", "Sales"],
        ...loaded.timeline.map((item) => [item.date, item.kind, item.title, item.detail || "-", item.salesName]),
      ],
    },
  ]);
  return excelResponse("histori-customer.xlsx", body);
}
