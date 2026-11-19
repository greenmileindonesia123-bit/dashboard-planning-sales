import type { DateRange } from "./jakarta";

export type SalesIdentity = {
  name: string;
  email: string | null;
};

export type VisitMetricInput = {
  visitDate: string;
  salesEmail: string | null;
  salesName: string;
  visitStatus: string | null;
  activityResult: string | null;
  potentialValue: number;
  orderValue: number;
  pipelineStatus: string | null;
  visitPurpose?: string | null;
};

export type Snapshot = {
  visits: number;
  potential: number;
  order: number;
  pipeline: number;
  completed: number;
  deals: number;
};

export type PersonComparison = {
  name: string;
  email: string | null;
  current: Snapshot;
  previous: Snapshot;
};

const ACTIVE_PIPELINE = new Set(["Prospek", "Negosiasi"]);

export function emptySnapshot(): Snapshot {
  return {
    visits: 0,
    potential: 0,
    order: 0,
    pipeline: 0,
    completed: 0,
    deals: 0,
  };
}

export function inRange(isoDate: string, range: DateRange): boolean {
  return isoDate >= range.start && isoDate <= range.end;
}

export function personKey(person: SalesIdentity): string {
  return person.email ?? `nama:${person.name}`;
}

export function belongsTo(row: VisitMetricInput, person: SalesIdentity): boolean {
  const rowEmail = row.salesEmail?.trim().toLowerCase() || null;
  const personEmail = person.email?.trim().toLowerCase() || null;
  if (rowEmail && personEmail) return rowEmail === personEmail;
  if (rowEmail && !personEmail) return false;
  return row.salesName.trim().toLowerCase() === person.name.trim().toLowerCase();
}

export function summarize(rows: VisitMetricInput[]): Snapshot {
  const snapshot = emptySnapshot();
  for (const row of rows) {
    snapshot.visits += 1;
    snapshot.potential += row.potentialValue;
    snapshot.order += row.orderValue;
    if (row.pipelineStatus && ACTIVE_PIPELINE.has(row.pipelineStatus)) {
      snapshot.pipeline += 1;
    }
    if (row.visitStatus === "Terlaksana") snapshot.completed += 1;
    if (row.activityResult === "Deal") snapshot.deals += 1;
  }
  return snapshot;
}

export function compareTotals(
  rows: VisitMetricInput[],
  current: DateRange,
  previous: DateRange,
): { current: Snapshot; previous: Snapshot } {
  return {
    current: summarize(rows.filter((row) => inRange(row.visitDate, current))),
    previous: summarize(rows.filter((row) => inRange(row.visitDate, previous))),
  };
}

export function comparePeople(
  people: SalesIdentity[],
  rows: VisitMetricInput[],
  current: DateRange,
  previous: DateRange,
): PersonComparison[] {
  return people.map((person) => {
    const mine = rows.filter((row) => belongsTo(row, person));
    return {
      name: person.name,
      email: person.email,
      current: summarize(mine.filter((row) => inRange(row.visitDate, current))),
      previous: summarize(mine.filter((row) => inRange(row.visitDate, previous))),
    };
  });
}

export function unmatchedVisitCount(
  rows: VisitMetricInput[],
  people: SalesIdentity[],
): number {
  return rows.filter((row) => !people.some((person) => belongsTo(row, person))).length;
}

export function delta(
  current: number,
  previous: number,
): { absolute: number; percent: number | null } {
  const absolute = current - previous;
  if (previous === 0) return { absolute, percent: null };
  return { absolute, percent: (absolute / previous) * 100 };
}

export function purposeCounts(rows: VisitMetricInput[]): { purpose: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = row.visitPurpose?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([purpose, count]) => ({ purpose, count }))
    .sort((a, b) => b.count - a.count || a.purpose.localeCompare(b.purpose, "id"));
}
