import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewerControls } from "@/app/(dashboard)/quotation/quotation-form";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { describeDataError, formatNumber } from "@/lib/format";
import { isQuotationReviewer, type QuotationStatus } from "@/lib/quotation-access";
import { firstParam } from "@/lib/query";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Permintaan Quotation" };

type RequestRow = {
  id: string;
  request_number: string;
  requested_at: string;
  sales_name: string;
  sales_email: string;
  customer_name: string;
  project_name: string;
  target_date: string | null;
  status: QuotationStatus;
  quote_pdf_path: string | null;
};

export default function QuotationPage(props: PageProps<"/quotation">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat permintaan…</p>}>
      <QuotationScreen searchParams={props.searchParams} />
    </Suspense>
  );
}

async function QuotationScreen({ searchParams }: { searchParams: PageProps<"/quotation">["searchParams"] }) {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  const reviewer = isQuotationReviewer(viewer);
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim().toLowerCase();
  const status = firstParam(params.status) ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_requests")
    .select("id, request_number, requested_at, sales_name, sales_email, customer_name, project_name, target_date, status, quote_pdf_path")
    .order("requested_at", { ascending: false });
  const rows = ((data ?? []) as RequestRow[]).filter((row) => {
    const haystack = `${row.customer_name} ${row.project_name} ${row.request_number}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (status && row.status !== status) return false;
    return true;
  });
  const counts = countStatus((data ?? []) as RequestRow[]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">Permintaan Quotation</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {reviewer ? "Anda dapat melihat semua permintaan dan mengunggah PDF penawaran." : `Permintaan ${viewer.name}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/quotation/baru" className={buttonVariants({ variant: "default", size: "sm" })}>Permintaan baru</Link>
          <a href={`/quotation/export?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Ekspor Excel</a>
        </div>
      </div>
      {error ? <Notice title="Permintaan gagal dimuat">{describeDataError(error.message)}</Notice> : null}
      {reviewer ? (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["Baru", "Diproses", "Selesai", "Batal"] as const).map((item) => (
            <div key={item} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <dt className="text-xs text-muted-foreground">{item}</dt>
              <dd className="font-heading text-2xl">{formatNumber(counts[item])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <form className="flex flex-wrap gap-2" action="/quotation">
        <input name="q" defaultValue={query} placeholder="Cari customer atau proyek" className="h-10 min-w-56 rounded-lg border border-input bg-card px-2.5" />
        <select name="status" defaultValue={status} className="h-10 rounded-lg border border-input bg-card px-2.5">
          <option value="">Semua status</option>
          {["Baru", "Diproses", "Selesai", "Batal"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className={buttonVariants()} type="submit">Terapkan</button>
      </form>
      {rows.length === 0 ? <Notice title="Belum ada permintaan">Buat permintaan baru untuk estimator.</Notice> : null}
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{row.request_number} · {row.status}</p>
              <p>{row.customer_name} · {row.project_name}</p>
              <p className="text-muted-foreground">{row.requested_at} · {row.sales_name} · Target {row.target_date || "-"}</p>
              {row.quote_pdf_path ? (
                <a className="inline-block font-medium text-primary underline underline-offset-4" href={`/quotation/${row.id}/unduh`}>Unduh PDF</a>
              ) : (
                <p className="text-muted-foreground">PDF penawaran belum ada.</p>
              )}
            </div>
            {reviewer ? <ReviewerControls id={row.id} status={row.status} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function countStatus(rows: RequestRow[]): Record<QuotationStatus, number> {
  const counts: Record<QuotationStatus, number> = { Baru: 0, Diproses: 0, Selesai: 0, Batal: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
