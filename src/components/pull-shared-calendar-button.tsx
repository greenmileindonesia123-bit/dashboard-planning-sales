"use client";

import { useActionState } from "react";
import { pullSharedCalendar } from "@/app/(dashboard)/kalender/pull-shared-calendar";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import type { SharedCalendarPullResult } from "@/lib/shared-calendar";

const TITLE_HELP =
  "Judul acara diawali nama sales, contoh: Lista - Kunjungan PT ABC atau [Etha] Kunjungan gudang. Nama pendek yang sudah dikenal ikut dikenali, misalnya Riyan untuk Lista dan Etha untuk Marizka Etha. Atau tulis satu baris di deskripsi: Sales: Nama.";

export function PullSharedCalendarButton() {
  const [result, action, pending] = useActionState(pullSharedCalendar, null);
  const failed = result !== null && !result.ok;
  const warn = failed || (result?.ok === true && result.unmapped > 0);

  return (
    <div className="w-full max-w-xl space-y-2">
      <form action={action}>
        <Button type="submit" size="sm" disabled={pending} aria-describedby="tarik-jadwal-bantuan" aria-busy={pending}>
          {pending ? "Menarik jadwal…" : "Tarik jadwal kalender"}
        </Button>
      </form>
      <p id="tarik-jadwal-bantuan" className="text-xs leading-5 text-muted-foreground">
        {TITLE_HELP}
      </p>
      {result ? <PullResult result={result} warn={warn} /> : null}
    </div>
  );
}

function PullResult({ result, warn }: { result: SharedCalendarPullResult; warn: boolean }) {
  return (
    <Notice title={result.ok ? "Jadwal kalender ditarik" : "Jadwal tidak dapat ditarik"} tone={warn ? "warning" : "info"}>
      <p>{result.message}</p>
      {result.ok && result.unmappedEvents.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {result.unmappedEvents.map((event) => (
            <li key={event.googleEventId}>
              {event.title}
              {event.cancelled ? " (dibatalkan)" : ""} · {formatWhen(event.startsAt, event.allDay)}
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

function formatWhen(iso: string, allDay: boolean): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    ...(allDay ? {} : { timeStyle: "short" as const }),
  }).format(new Date(iso));
}
