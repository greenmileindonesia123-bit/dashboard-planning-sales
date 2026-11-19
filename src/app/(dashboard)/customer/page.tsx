import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { loadCustomerDirectory } from "@/app/(dashboard)/customer/load";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { describeDataError, formatNumber, formatRp } from "@/lib/format";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { firstParam } from "@/lib/query";
import { getViewer, loadRoster } from "@/lib/session";
import type { CustomerSummary } from "@/lib/customers";

export const metadata = { title: "Data Customer" };

export default function CustomerPage(props: PageProps<"/customer">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CustomerScreen searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CustomerScreen({ searchParams }: { searchParams: PageProps<"/customer">["searchParams"] }) {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim();
  const sort = firstParam(params.sort) ?? "nama";
  const sales = firstParam(params.sales) ?? "";
  const superAdmin = isSuperAdmin(viewer);
  const roster = superAdmin ? await loadRoster() : null;
  const today = toISODate(civilDateInJakarta(new Date()));
  const loaded = await loadCustomerDirectory(viewer, superAdmin && sales ? sales : null, today);
  const filtered = loaded.customers
    .filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => compareCustomers(a, b, sort));
  const exportQuery = new URLSearchParams();
  if (query) exportQuery.set("q", query);
  if (sort) exportQuery.set("sort", sort);
  if (superAdmin && sales) exportQuery.set("sales", sales);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">Data Customer</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Gabungan customer dari laporan kunjungan dan Sales Order. {filtered.length} customer.
            {!superAdmin ? ` Hanya customer ${viewer.name}.` : ""}
          </p>
        </div>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/customer/export?${exportQuery.toString()}`}>
          Ekspor Excel
        </a>
      </div>
      {loaded.error ? <Notice title="Data customer gagal dimuat">{describeDataError(loaded.error)}</Notice> : null}
      <form className="grid gap-3 md:grid-cols-[1fr_12rem_12rem_auto] md:items-end" action="/customer">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Cari nama</span>
          <input name="q" defaultValue={query} className="block h-10 w-full rounded-lg border border-input bg-card px-2.5" />
        </label>
        {superAdmin ? (
          <label className="space-y-2 text-sm">
            <span className="font-medium">Sales</span>
            <select name="sales" defaultValue={sales} className="block h-10 w-full rounded-lg border border-input bg-card px-2.5">
              <option value="">Semua sales</option>
              {(roster?.roster ?? []).filter((person) => person.email).map((person) => (
                <option key={person.email} value={person.email ?? ""}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-2 text-sm">
          <span className="font-medium">Urutkan</span>
          <select name="sort" defaultValue={sort} className="block h-10 w-full rounded-lg border border-input bg-card px-2.5">
            <option value="nama">Nama</option>
            <option value="kunjungan">Jumlah kunjungan</option>
            <option value="deal">Nilai deal</option>
            <option value="terakhir">Kunjungan terakhir</option>
          </select>
        </label>
        <button className={buttonVariants({ variant: "default" })} type="submit">
          Terapkan
        </button>
      </form>
      {filtered.length === 0 ? <Notice title="Belum ada customer">Customer muncul setelah ada laporan kunjungan atau Sales Order.</Notice> : null}
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[72rem] text-sm">
          <caption className="sr-only">Daftar customer</caption>
          <thead className="bg-muted text-left">
            <tr>
              {["Customer", "Alamat", "PIC", "No telp", "Sales", "Kunjungan", "Terakhir", "SO", "Nilai deal", "Beli terakhir", "Follow-up"].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.slug} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <Link href={`/customer/${customer.slug}`} className="underline underline-offset-4">{customer.name}</Link>
                </th>
                <td className="px-3 py-2">{customer.address || "-"}</td>
                <td className="px-3 py-2">{customer.pic || "-"}</td>
                <td className="px-3 py-2">{customer.phone || "-"}</td>
                <td className="px-3 py-2">{customer.salesName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(customer.visitCount)}</td>
                <td className="px-3 py-2 tabular-nums">{customer.lastVisit || "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(customer.orderCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRp(customer.dealTotal)}</td>
                <td className="px-3 py-2 tabular-nums">{customer.lastPurchase || "-"}</td>
                <td className="px-3 py-2 tabular-nums">{customer.nextFollowUp || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareCustomers(a: CustomerSummary, b: CustomerSummary, sort: string): number {
  if (sort === "kunjungan") return b.visitCount - a.visitCount || a.name.localeCompare(b.name, "id");
  if (sort === "deal") return b.dealTotal - a.dealTotal || a.name.localeCompare(b.name, "id");
  if (sort === "terakhir") return (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "") || a.name.localeCompare(b.name, "id");
  return a.name.localeCompare(b.name, "id");
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Data Customer</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
