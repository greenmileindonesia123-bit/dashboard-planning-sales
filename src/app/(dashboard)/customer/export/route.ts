import { loadCustomerDirectory } from "@/app/(dashboard)/customer/load";
import { excelResponse, workbookBuffer } from "@/lib/excel-file";
import { formatNumber, formatRp } from "@/lib/format";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { getViewer } from "@/lib/session";
import type { CustomerSummary } from "@/lib/customers";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return new Response("Masuk terlebih dahulu.", { status: 401 });
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") ?? "nama";
  const sales = url.searchParams.get("sales") ?? "";
  const today = toISODate(civilDateInJakarta(new Date()));
  const loaded = await loadCustomerDirectory(viewer, isSuperAdmin(viewer) && sales ? sales : null, today);
  const rows = loaded.customers
    .filter((customer) => customer.name.toLowerCase().includes(query))
    .sort((a, b) => compareCustomers(a, b, sort));
  const body = await workbookBuffer([
    {
      name: "Customer",
      rows: [
        ["Customer", "Alamat", "PIC", "No telp", "Sales", "Kunjungan", "Kunjungan terakhir", "Jumlah SO", "Nilai deal", "Pembelian terakhir", "Follow-up berikutnya"],
        ...rows.map((customer) => [
          customer.name,
          customer.address || "-",
          customer.pic || "-",
          customer.phone || "-",
          customer.salesName,
          formatNumber(customer.visitCount),
          customer.lastVisit || "-",
          formatNumber(customer.orderCount),
          formatRp(customer.dealTotal),
          customer.lastPurchase || "-",
          customer.nextFollowUp || "-",
        ]),
      ],
    },
  ]);
  return excelResponse("data-customer.xlsx", body);
}

function compareCustomers(a: CustomerSummary, b: CustomerSummary, sort: string): number {
  if (sort === "kunjungan") return b.visitCount - a.visitCount || a.name.localeCompare(b.name, "id");
  if (sort === "deal") return b.dealTotal - a.dealTotal || a.name.localeCompare(b.name, "id");
  if (sort === "terakhir") return (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "") || a.name.localeCompare(b.name, "id");
  return a.name.localeCompare(b.name, "id");
}
