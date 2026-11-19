import { countsAsDeal } from "./sales-order/parse.ts";

export type CustomerVisit = {
  id: string;
  visitDate: string;
  customerName: string | null;
  salesName: string;
  salesEmail: string | null;
  address: string | null;
  notes: string | null;
  activityResult: string | null;
  visitStatus: string | null;
  visitPurpose: string | null;
  followUpDate: string | null;
};

export type CustomerOrder = {
  soNumber: string;
  orderDate: string;
  customer: string | null;
  netTotal: number;
  status: string | null;
  docstatus: number | null;
  salesEmail: string | null;
  salesPersonRaw: string | null;
};

export type CustomerScope = {
  superAdmin: boolean;
  viewerEmail: string;
  selectedEmail?: string | null;
};

export type CustomerSummary = {
  key: string;
  slug: string;
  name: string;
  address: string | null;
  pic: string | null;
  phone: string | null;
  salesName: string;
  salesEmail: string | null;
  visitCount: number;
  lastVisit: string | null;
  orderCount: number;
  dealTotal: number;
  lastPurchase: string | null;
  nextFollowUp: string | null;
};

export type CustomerTimelineItem = {
  kind: "kunjungan" | "so" | "kalender";
  date: string;
  title: string;
  detail: string;
  salesName: string;
};

export function normalizeCustomerName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function customerSlug(normalized: string): string {
  return Buffer.from(normalized, "utf8").toString("base64url");
}

export function customerKeyFromSlug(slug: string): string | null {
  try {
    const text = Buffer.from(slug, "base64url").toString("utf8");
    if (!text || normalizeCustomerName(text) !== text) return null;
    return text;
  } catch {
    return null;
  }
}

export function contactFromNotes(notes: string | null): { pic: string | null; phone: string | null } {
  if (!notes) return { pic: null, phone: null };
  let pic: string | null = null;
  let phone: string | null = null;
  for (const line of notes.split("\n")) {
    const picMatch = line.match(/^PIC:\s*(.+)$/i);
    const phoneMatch = line.match(/^Mobile:\s*(.+)$/i);
    if (picMatch) pic = picMatch[1].trim() || null;
    if (phoneMatch) phone = phoneMatch[1].trim() || null;
  }
  return { pic, phone };
}

export function buildCustomers(
  visits: CustomerVisit[],
  orders: CustomerOrder[],
  scope: CustomerScope,
  today: string,
): CustomerSummary[] {
  const visibleVisits = visits.filter((visit) => inScope(visit.salesEmail, scope) && normalizeCustomerName(visit.customerName ?? "") !== "");
  const visibleOrders = orders.filter((order) => inScope(order.salesEmail, scope) && normalizeCustomerName(order.customer ?? "") !== "");
  const groups = new Map<string, { visits: CustomerVisit[]; orders: CustomerOrder[] }>();
  for (const visit of visibleVisits) {
    const key = normalizeCustomerName(visit.customerName ?? "");
    const group = groups.get(key) ?? { visits: [], orders: [] };
    group.visits.push(visit);
    groups.set(key, group);
  }
  for (const order of visibleOrders) {
    const key = normalizeCustomerName(order.customer ?? "");
    const group = groups.get(key) ?? { visits: [], orders: [] };
    group.orders.push(order);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => summarizeCustomer(key, group.visits, group.orders, today))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export function customerTimeline(
  summary: CustomerSummary,
  visits: CustomerVisit[],
  orders: CustomerOrder[],
  calendar: { title: string; startsAt: string; location: string | null; salesEmail: string; salesName: string }[],
): CustomerTimelineItem[] {
  const items: CustomerTimelineItem[] = [];
  for (const visit of visits) {
    if (normalizeCustomerName(visit.customerName ?? "") !== summary.key) continue;
    items.push({
      kind: "kunjungan",
      date: visit.visitDate,
      title: visit.visitPurpose || "Kunjungan",
      detail: [visit.visitStatus, visit.activityResult, visit.notes, visit.followUpDate ? `Follow-up ${visit.followUpDate}` : ""]
        .filter(Boolean)
        .join(" · "),
      salesName: visit.salesName,
    });
  }
  for (const order of orders) {
    if (normalizeCustomerName(order.customer ?? "") !== summary.key) continue;
    const counted = countsAsDeal(order.status ?? "", order.docstatus);
    items.push({
      kind: "so",
      date: order.orderDate,
      title: order.soNumber,
      detail: [`Net Total ${order.netTotal}`, order.status || "-", counted ? "dihitung" : "tidak dihitung"].join(" · "),
      salesName: order.salesPersonRaw || order.salesEmail || "-",
    });
  }
  for (const event of calendar) {
    if (!mentionsCustomer(event.title, event.location, summary.key)) continue;
    items.push({
      kind: "kalender",
      date: event.startsAt.slice(0, 10),
      title: event.title,
      detail: event.location || "-",
      salesName: event.salesName,
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}

export function mentionsCustomer(title: string, location: string | null, normalizedName: string): boolean {
  if (normalizedName.length < 3) return false;
  const haystack = normalizeCustomerName(`${title} ${location ?? ""}`);
  return haystack.includes(normalizedName);
}

function summarizeCustomer(key: string, visits: CustomerVisit[], orders: CustomerOrder[], today: string): CustomerSummary {
  const deals = orders.filter((order) => countsAsDeal(order.status ?? "", order.docstatus));
  const sales = modeSales(visits, orders);
  const upcoming = visits
    .map((visit) => visit.followUpDate)
    .filter((date): date is string => Boolean(date && date >= today))
    .sort();
  return {
    key,
    slug: customerSlug(key),
    name: displayName(visits, orders),
    address: latestText(visits, (visit) => visit.address, (visit) => visit.visitDate),
    pic: latestText(visits, (visit) => contactFromNotes(visit.notes).pic, (visit) => visit.visitDate),
    phone: latestText(visits, (visit) => contactFromNotes(visit.notes).phone, (visit) => visit.visitDate),
    salesName: sales.name,
    salesEmail: sales.email,
    visitCount: visits.length,
    lastVisit: maxDate(visits.map((visit) => visit.visitDate)),
    orderCount: deals.length,
    dealTotal: deals.reduce((sum, order) => sum + order.netTotal, 0),
    lastPurchase: maxDate(deals.map((order) => order.orderDate)),
    nextFollowUp: upcoming[0] ?? null,
  };
}

function displayName(visits: CustomerVisit[], orders: CustomerOrder[]): string {
  const counts = new Map<string, { count: number; latest: string }>();
  const add = (raw: string | null, date: string) => {
    const name = raw?.trim();
    if (!name) return;
    const current = counts.get(name) ?? { count: 0, latest: date };
    current.count += 1;
    if (date > current.latest) current.latest = date;
    counts.set(name, current);
  };
  for (const visit of visits) add(visit.customerName, visit.visitDate);
  for (const order of orders) add(order.customer, order.orderDate);
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest) || a[0].localeCompare(b[0], "id"))[0]?.[0] ?? "";
}

function modeSales(visits: CustomerVisit[], orders: CustomerOrder[]): { name: string; email: string | null } {
  const counts = new Map<string, { name: string; email: string | null; count: number }>();
  const add = (name: string, email: string | null) => {
    const key = email?.toLowerCase() || `nama:${name}`;
    const current = counts.get(key) ?? { name, email, count: 0 };
    current.count += 1;
    counts.set(key, current);
  };
  for (const visit of visits) add(visit.salesName, visit.salesEmail);
  for (const order of orders) add(order.salesPersonRaw || order.salesEmail || "-", order.salesEmail);
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"))[0] ?? { name: "-", email: null };
}

function latestText<T>(rows: T[], pick: (row: T) => string | null, date: (row: T) => string): string | null {
  const sorted = [...rows].sort((a, b) => date(b).localeCompare(date(a)));
  for (const row of sorted) {
    const value = pick(row)?.trim();
    if (value) return value;
  }
  return null;
}

function maxDate(dates: string[]): string | null {
  const sorted = dates.filter(Boolean).sort();
  return sorted[sorted.length - 1] ?? null;
}

function inScope(email: string | null, scope: CustomerScope): boolean {
  const value = email?.trim().toLowerCase() || null;
  if (!scope.superAdmin) return value === scope.viewerEmail.trim().toLowerCase();
  if (!scope.selectedEmail) return true;
  return value === scope.selectedEmail.trim().toLowerCase();
}
