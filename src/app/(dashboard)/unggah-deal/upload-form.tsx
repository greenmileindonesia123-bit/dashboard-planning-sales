"use client";

import { useState } from "react";
import { importDealFile, previewDealFile, type DealPreview } from "@/app/(dashboard)/unggah-deal/actions";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatRp } from "@/lib/format";

export function DealUploadForm() {
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<DealPreview | null>(null);

  async function submit(kind: "preview" | "save", formData: FormData) {
    setPending(kind);
    setFailure(null);
    const result = kind === "preview" ? await previewDealFile(formData) : await importDealFile(formData);
    setPending(null);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setReport(result);
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10" action={(formData) => submit("preview", formData)}>
        <div className="space-y-2">
          <Label htmlFor="file">Berkas Sales Order</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending !== null}>
            {pending === "preview" ? "Memeriksa…" : "Periksa berkas"}
          </Button>
          <Button type="button" variant="outline" disabled={pending !== null} onClick={(event) => submit("save", new FormData(event.currentTarget.form!))}>
            {pending === "save" ? "Menyimpan…" : "Simpan data deal"}
          </Button>
        </div>
      </form>
      {failure ? <Notice title="Berkas tidak dapat diproses">{failure}</Notice> : null}
      {report ? <DealReport report={report} /> : null}
    </div>
  );
}

function DealReport({ report }: { report: DealPreview }) {
  return (
    <div className="space-y-4">
      <Notice title={report.saved ? "Data deal tersimpan" : "Pratinjau data deal"}>
        {report.fileName}. {formatNumber(report.rowCount)} baris dibaca, {formatNumber(report.uniqueCount)} nomor SO unik.{" "}
        {formatNumber(report.dealCount)} SO dihitung sebagai deal dengan nilai {formatRp(report.dealNetTotal)}.{" "}
        {formatNumber(report.excludedCount)} SO batal atau draft disimpan tetapi tidak dihitung.{" "}
        {report.saved ? "Tersimpan" : "Siap disimpan"}: {formatNumber(report.inserted)} baru, {formatNumber(report.updated)} diperbarui.
        {report.skippedCount > 0 ? ` ${formatNumber(report.skippedCount)} baris dilewati karena nomor SO atau tanggal kosong.` : ""}
        {report.conflictCount > 0
          ? ` ${formatNumber(report.conflictCount)} nomor SO punya baris yang tidak sama. Nilai dari baris pertama yang dipakai.`
          : ""}
      </Notice>
      {report.unmatched.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[24rem] text-sm">
            <caption className="px-3 py-2 text-left font-medium">Belum dipetakan</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Nama di berkas", "Jumlah SO", "Net Total"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.unmatched.map((item) => (
                <tr key={item.name} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {item.name}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.count)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(item.netTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {report.sample.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Contoh SO yang dihitung</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Nomor SO", "Customer", "Tanggal", "Sales", "Net Total"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.sample.map((order) => (
                <tr key={order.soNumber} className="border-t border-border">
                  <td className="px-3 py-2">{order.soNumber}</td>
                  <td className="px-3 py-2">{order.customer || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{order.orderDate}</td>
                  <td className="px-3 py-2">{order.salesEmail ? order.salesPersonRaw : `${order.salesPersonRaw || "Tanpa nama"} · Belum dipetakan`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRp(order.netTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
