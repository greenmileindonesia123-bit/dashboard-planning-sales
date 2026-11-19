import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { QuotationForm } from "@/app/(dashboard)/quotation/quotation-form";
import { loadCustomerDirectory } from "@/app/(dashboard)/customer/load";
import { AccessState } from "@/components/access-state";
import { buttonVariants } from "@/components/ui/button";
import { civilDateInJakarta, toISODate } from "@/lib/jakarta";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Permintaan quotation baru" };

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat formulir…</p>}>
      <NewQuotationScreen />
    </Suspense>
  );
}

async function NewQuotationScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  const today = toISODate(civilDateInJakarta(new Date()));
  const customers = await loadCustomerDirectory(viewer, null, today);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground"><Link href="/quotation" className={buttonVariants({ variant: "link" })}>Permintaan Quotation</Link></p>
        <h1 className="font-heading text-3xl tracking-tight">Permintaan baru</h1>
        <p className="text-sm text-muted-foreground">Tanggal permintaan {today}. Sales peminta: {viewer.name}. Nomor diisi otomatis.</p>
      </div>
      <QuotationForm customers={customers.customers.map((customer) => customer.name).slice(0, 200)} />
    </div>
  );
}
