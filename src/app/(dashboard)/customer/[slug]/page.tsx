import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { loadCustomerDetail } from "@/app/(dashboard)/customer/load";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Detail customer" };
export const instant = false;

export default function CustomerDetailPage(props: PageProps<"/customer/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat customer…</p>}>
      <DetailScreen params={props.params} />
    </Suspense>
  );
}

async function DetailScreen({ params }: { params: PageProps<"/customer/[slug]">["params"] }) {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  const { slug } = await params;
  const today = toISODate(civilDateInJakarta(new Date()));
  const loaded = await loadCustomerDetail(viewer, slug, today);
  if (!loaded.summary) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl tracking-tight">Customer tidak ditemukan</h1>
        <Notice title="Tidak ada di daftar Anda">Customer ini tidak ada, atau bukan bagian dari data yang boleh Anda lihat.</Notice>
        <Link href="/customer" className={buttonVariants({ variant: "outline" })}>Kembali ke Data Customer</Link>
      </div>
    );
  }
  const customer = loaded.summary;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground"><Link href="/customer" className="underline underline-offset-4">Data Customer</Link></p>
          <h1 className="font-heading text-3xl tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">Sales penanggung jawab: {customer.salesName}</p>
        </div>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/customer/${customer.slug}/export`}>Ekspor Excel</a>
      </div>
      <dl className="grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Alamat</dt><dd>{customer.address || "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">PIC</dt><dd>{customer.pic || "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">No telp</dt><dd>{customer.phone || "-"}</dd></div>
      </dl>
      <ol className="space-y-3">
        {loaded.timeline.length === 0 ? <Notice title="Belum ada histori">Tidak ada kunjungan, SO, atau jadwal yang cocok.</Notice> : null}
        {loaded.timeline.map((item, index) => (
          <li key={`${item.kind}-${item.date}-${index}`} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">{item.date} · {labelKind(item.kind)} · {item.salesName}</p>
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.detail || "-"}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function labelKind(kind: string): string {
  if (kind === "so") return "Sales Order";
  if (kind === "kalender") return "Kalender";
  return "Kunjungan";
}
