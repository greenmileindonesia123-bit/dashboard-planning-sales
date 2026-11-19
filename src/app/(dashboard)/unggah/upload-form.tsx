"use client";

import { useState } from "react";
import { importVisitFile, previewVisitFile, type ImportPreview } from "@/app/(dashboard)/unggah/actions";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadForm() {
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<ImportPreview | null>(null);

  async function submit(kind: "preview" | "save", formData: FormData) {
    setPending(kind);
    setFailure(null);
    const result = kind === "preview" ? await previewVisitFile(formData) : await importVisitFile(formData);
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
          <Label htmlFor="file">Berkas laporan</Label>
          <Input id="file" name="file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending !== null}>
            {pending === "preview" ? "Memeriksa…" : "Periksa berkas"}
          </Button>
          <Button type="button" variant="outline" disabled={pending !== null} onClick={(event) => submit("save", new FormData(event.currentTarget.form!))}>
            {pending === "save" ? "Menyimpan…" : "Simpan ke laporan"}
          </Button>
        </div>
      </form>
      {failure ? <Notice title="Berkas tidak dapat diproses">{failure}</Notice> : null}
      {report ? <ReportSummary report={report} /> : null}
    </div>
  );
}

function ReportSummary({ report }: { report: ImportPreview }) {
  return (
    <div className="space-y-4">
      <Notice title={report.saved ? "Laporan tersimpan" : "Pratinjau berkas"}>
        {report.fileName}. {report.saved ? "Disimpan" : "Siap disimpan"}: {report.inserted} baris baru, {report.updated}{" "}
        baris diperbarui, {report.skippedCount} baris dilewati
        {report.trainingRowsIgnored > 0 ? `, ${report.trainingRowsIgnored} baris Training Record diabaikan` : ""}.
      </Notice>
      {report.ready.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Baris yang lolos pemetaan</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Reference", "Tanggal", "Sales", "Customer", "Pipeline", "Follow-up"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.ready.map((row) => (
                <tr key={row.externalId} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{row.externalId}</td>
                  <td className="px-3 py-2 tabular-nums">{row.visitDate}</td>
                  <td className="px-3 py-2">{row.salesName}</td>
                  <td className="px-3 py-2">{row.customerName || "—"}</td>
                  <td className="px-3 py-2">{row.pipelineStatus || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.followUpDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {report.skipped.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="px-3 py-2 text-left font-medium">Baris dilewati</caption>
            <tbody>
              {report.skipped.map((row, index) => (
                <tr key={`${row.externalId ?? "row"}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{row.externalId || "—"}</td>
                  <td className="px-3 py-2">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
