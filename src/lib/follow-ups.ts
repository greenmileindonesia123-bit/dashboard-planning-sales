import { addDays, parseISODate, toISODate } from "./jakarta.ts";
import { belongsTo, type SalesIdentity } from "./metrics.ts";

export const UPCOMING_WINDOW_DAYS = 14;

export const EMPTY_FOLLOW_UP_TITLE = "Belum ada pengingat";

export const EMPTY_FOLLOW_UP_BODY =
  "Pengingat akan muncul setelah laporan kunjungan punya tanggal follow-up.";

export type FollowUpBucket = "terlambat" | "hari-ini" | "mendatang" | "nanti";

export const FOLLOW_UP_BUCKETS: FollowUpBucket[] = ["terlambat", "hari-ini", "mendatang", "nanti"];

export const FOLLOW_UP_BUCKET_LABEL: Record<FollowUpBucket, string> = {
  terlambat: "Terlambat",
  "hari-ini": "Hari ini",
  mendatang: "14 hari ke depan",
  nanti: "Lebih dari 14 hari",
};

export type FollowUp = {
  followUpDate: string;
  customerName: string | null;
  salesName: string;
  salesEmail: string | null;
  visitDate: string;
  visitPurpose: string | null;
  visitStatus: string | null;
  activityResult: string | null;
  notes: string | null;
  cityArea: string | null;
};

export function classifyFollowUp(followUpDate: string, todayIso: string): FollowUpBucket {
  if (followUpDate < todayIso) return "terlambat";
  if (followUpDate === todayIso) return "hari-ini";
  const upcomingEnd = toISODate(addDays(parseISODate(todayIso), UPCOMING_WINDOW_DAYS));
  if (followUpDate <= upcomingEnd) return "mendatang";
  return "nanti";
}

export function followUpsForViewer(
  rows: FollowUp[],
  scope: { superAdmin: boolean; viewer: SalesIdentity; selected: SalesIdentity | null },
): FollowUp[] {
  const dated = rows.filter((row) => row.followUpDate.trim() !== "");
  if (!scope.superAdmin) {
    return dated.filter((row) => belongsTo(asVisit(row), scope.viewer));
  }
  const selected = scope.selected;
  if (!selected) return dated;
  return dated.filter((row) => belongsTo(asVisit(row), selected));
}

export function groupFollowUps(rows: FollowUp[], todayIso: string): Record<FollowUpBucket, FollowUp[]> {
  const groups: Record<FollowUpBucket, FollowUp[]> = {
    terlambat: [],
    "hari-ini": [],
    mendatang: [],
    nanti: [],
  };
  const sorted = [...rows].sort(
    (a, b) => a.followUpDate.localeCompare(b.followUpDate) || (a.customerName ?? "").localeCompare(b.customerName ?? "", "id"),
  );
  for (const row of sorted) {
    groups[classifyFollowUp(row.followUpDate, todayIso)].push(row);
  }
  return groups;
}

function asVisit(row: FollowUp) {
  return {
    visitDate: row.visitDate,
    salesEmail: row.salesEmail,
    salesName: row.salesName,
    visitStatus: row.visitStatus,
    activityResult: row.activityResult,
    potentialValue: 0,
    orderValue: 0,
    pipelineStatus: null,
  };
}
