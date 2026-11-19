"use client";

import { useState } from "react";
import { importCalendarFile, previewCalendarFile, type CalendarPreview } from "@/app/(dashboard)/unggah-jadwal/actions";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { preselectSalesEmail } from "@/lib/calendar-owner";

export function CalendarUploadForm({
  canChooseOwner,
  people,
}: {
  canChooseOwner: boolean;
  people: { name: string; email: string }[];
}) {
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<CalendarPreview | null>(null);
  const [salesEmail, setSalesEmail] = useState("");

  async function submit(kind: "preview" | "save", formData: FormData) {
    setPending(kind);
    setFailure(null);
    const result = kind === "preview" ? await previewCalendarFile(formData) : await importCalendarFile(formData);
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
        {canChooseOwner ? (
          <div className="space-y-2">
            <Label htmlFor="salesEmail">Pemilik jadwal</Label>
            <select
              id="salesEmail"
              name="salesEmail"
              required
              value={salesEmail}
              onChange={(event) => setSalesEmail(event.target.value)}
              className="block h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Pilih sales</option>
              {people.map((person) => (
                <option key={person.email} value={person.email}>
                  {person.name} · {person.email}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="file">Berkas .ics</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".ics,text/calendar"
            required
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || !canChooseOwner) return;
              const match = preselectSalesEmail(file.name, people.map((person) => person.email));
              if (match) setSalesEmail(match);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending !== null}>
            {pending === "preview" ? "Memeriksa…" : "Periksa berkas"}
          </Button>
          <Button type="button" variant="outline" disabled={pending !== null} onClick={(event) => submit("save", new FormData(event.currentTarget.form!))}>
            {pending === "save" ? "Menyimpan…" : "Simpan jadwal"}
          </Button>
        </div>
      </form>
      {failure ? <Notice title="Berkas tidak dapat diproses">{failure}</Notice> : null}
      {report ? <CalendarReport report={report} /> : null}
    </div>
  );
}

function CalendarReport({ report }: { report: CalendarPreview }) {
  return (
    <div className="space-y-4">
      <Notice title={report.saved ? "Jadwal tersimpan" : "Pratinjau jadwal"}>
        {report.fileName}. Disimpan sebagai {report.ownerName} ({report.ownerEmail}). {report.saved ? "Tersimpan" : "Siap disimpan"}:{" "}
        {report.inserted} acara baru, {report.updated} acara diperbarui, {report.total} acara dalam berkas
        {report.cancelled > 0 ? `, ${report.cancelled} dibatalkan dan tidak tampil di papan` : ""}.
        {report.earliest && report.latest ? ` Rentang ${formatWhen(report.earliest)} sampai ${formatWhen(report.latest)}.` : ""}
        {report.truncated ? " Pengulangan dipotong setelah batas kejadian." : ""}
        {report.unreadable > 0 ? ` ${report.unreadable} acara tidak dapat dibaca.` : ""}
        {report.total === 0 ? " Tidak ada acara di berkas ini." : ""}
      </Notice>
      {report.sample.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Contoh acara dari berkas</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Judul", "Mulai", "Selesai"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.sample.map((event) => (
                <tr key={event.googleEventId} className="border-t border-border">
                  <td className="px-3 py-2">{event.title || "Tanpa judul"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatWhen(event.startsAt, event.allDay)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatWhen(event.endsAt, event.allDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatWhen(iso: string, allDay = false): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    ...(allDay ? {} : { timeStyle: "short" as const }),
  }).format(new Date(iso));
}
