import { connection } from "next/server";
import { Suspense } from "react";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { SalesSelect } from "@/components/query-controls";
import { describeDataError } from "@/lib/format";
import {
  EMPTY_FOLLOW_UP_BODY,
  EMPTY_FOLLOW_UP_TITLE,
  FOLLOW_UP_BUCKET_LABEL,
  FOLLOW_UP_BUCKETS,
  followUpsForViewer,
  groupFollowUps,
  type FollowUp,
} from "@/lib/follow-ups";
import { civilDateInJakarta, formatLongDate, toISODate } from "@/lib/jakarta";
import { isSuperAdmin } from "@/lib/access";
import { personKey } from "@/lib/metrics";
import { firstParam } from "@/lib/query";
import { resolvePersonFilter } from "@/lib/scope";
import { loadFollowUps, loadRoster } from "@/lib/session";

export const metadata = { title: "Pengingat kunjungan ulang" };

export default function FollowUpPage(props: PageProps<"/pengingat">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FollowUpScreen searchParams={props.searchParams} />
    </Suspense>
  );
}

async function FollowUpScreen({
  searchParams,
}: {
  searchParams: PageProps<"/pengingat">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const [rosterLoaded, followLoaded] = await Promise.all([loadRoster(), loadFollowUps()]);
  const viewer = followLoaded.viewer.kind === "ok" ? followLoaded.viewer : rosterLoaded.viewer;
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;

  const canFilterPeople = isSuperAdmin(viewer);
  const selected = resolvePersonFilter(viewer, firstParam(params.sales), rosterLoaded.roster);
  const visible = followUpsForViewer(followLoaded.followUps, {
    superAdmin: canFilterPeople,
    viewer: { name: viewer.name, email: viewer.email },
    selected: canFilterPeople ? selected : { name: viewer.name, email: viewer.email },
  });
  const todayIso = toISODate(civilDateInJakarta(new Date()));
  const groups = groupFollowUps(visible, todayIso);
  const error = followLoaded.error ?? rosterLoaded.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">Pengingat kunjungan ulang</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Dari tanggal follow-up di laporan kunjungan. Zona waktu Asia/Jakarta. Email pengingat tidak dikirim dari
            dashboard ini.
          </p>
        </div>
        {canFilterPeople ? (
          <SalesSelect
            value={selected ? personKey(selected) : ""}
            includeAll
            param="sales"
            pathname="/pengingat"
            preserved={{}}
            options={rosterLoaded.roster.map((person) => ({
              value: personKey(person),
              label: person.email ? person.name : `${person.name} (belum ada email)`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Menampilkan pengingat {viewer.name}.</p>
        )}
      </div>
      {selected && !selected.email ? (
        <Notice title="Belum ada email" tone="warning">
          {selected.name} belum punya email Google, jadi pengingat email nanti tidak bisa dikirim. Daftar ini hanya
          dari laporan yang cocok dengan namanya.
        </Notice>
      ) : null}
      {error ? <Notice title="Pengingat gagal dimuat">{describeDataError(error)}</Notice> : null}
      {!error && visible.length === 0 ? (
        <Notice title={EMPTY_FOLLOW_UP_TITLE}>{EMPTY_FOLLOW_UP_BODY}</Notice>
      ) : null}
      {FOLLOW_UP_BUCKETS.map((bucket) => {
        const items = groups[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket} className="space-y-3">
            <h2 className="font-heading text-2xl">
              {FOLLOW_UP_BUCKET_LABEL[bucket]}{" "}
              <span className="text-base font-normal text-muted-foreground">({items.length})</span>
            </h2>
            <div className="space-y-3">
              {items.map((item, index) => (
                <FollowUpCard key={`${item.followUpDate}-${item.salesName}-${item.customerName ?? ""}-${index}`} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FollowUpCard({ item }: { item: FollowUp }) {
  const details = [
    item.visitDate ? { label: "Kunjungan", value: formatLongDate(item.visitDate) } : null,
    item.visitPurpose ? { label: "Tujuan", value: item.visitPurpose } : null,
    item.activityResult ? { label: "Hasil", value: item.activityResult } : null,
    item.visitStatus ? { label: "Status", value: item.visitStatus } : null,
    item.cityArea ? { label: "Kota", value: item.cityArea } : null,
    item.notes ? { label: "Catatan", value: item.notes } : null,
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium">{item.customerName?.trim() || "—"}</h3>
        <p className="text-sm tabular-nums">{formatLongDate(item.followUpDate)}</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.salesName}
        {item.salesEmail ? ` · ${item.salesEmail}` : ""}
      </p>
      {details.length > 0 ? (
        <dl className="mt-3 space-y-1 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className="whitespace-pre-wrap">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Pengingat kunjungan ulang</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
