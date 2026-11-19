import { matchSalesPerson, type SalesProfileName } from "./aliases.ts";

export type SalesOrderDraft = {
  soNumber: string;
  quotation: string | null;
  customer: string | null;
  orderDate: string;
  netTotal: number;
  grandTotal: number;
  status: string;
  docstatus: number | null;
  source: string | null;
  salesPersonRaw: string;
  salesEmail: string | null;
  countsAsDeal: boolean;
};

export type SalesOrderParseResult = {
  orders: SalesOrderDraft[];
  rowCount: number;
  skippedCount: number;
  conflictCount: number;
};

export type UnmatchedDeal = {
  name: string;
  count: number;
  netTotal: number;
};

const REQUIRED = ["name", "date", "net total", "status", "docstatus", "sales person"] as const;

export function countsAsDeal(status: string, docstatus: number | null): boolean {
  const normalized = status.trim().toLowerCase();
  if (docstatus === 0 || docstatus === 2) return false;
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "draft") return false;
  if (docstatus === null && !normalized) return false;
  return true;
}

export function parseSalesOrders(rows: string[][], roster: SalesProfileName[]): SalesOrderParseResult | { error: string } {
  const header = rows[0] ?? [];
  const columns = indexHeaders(header);
  for (const name of REQUIRED) {
    if (!columns.has(name)) return { error: "Kolom Sales Order tidak lengkap. Butuh Name, Date, Net Total, Status, Docstatus, dan Sales Person." };
  }

  const orders: SalesOrderDraft[] = [];
  const indexByNumber = new Map<string, number>();
  const seenConflict = new Set<string>();
  let rowCount = 0;
  let skippedCount = 0;
  let conflictCount = 0;

  for (const cells of rows.slice(1)) {
    if (cells.every((value) => value.trim() === "")) continue;
    rowCount += 1;
    const soNumber = cell(cells, columns, "name");
    const orderDate = parseOrderDate(cell(cells, columns, "date"));
    if (!soNumber || !orderDate) {
      skippedCount += 1;
      continue;
    }
    const draft = toDraft(cells, columns, soNumber, orderDate, roster);
    const existingIndex = indexByNumber.get(soNumber);
    if (existingIndex === undefined) {
      indexByNumber.set(soNumber, orders.length);
      orders.push(draft);
      continue;
    }
    if (!seenConflict.has(soNumber) && fingerprint(orders[existingIndex]) !== fingerprint(draft)) {
      seenConflict.add(soNumber);
      conflictCount += 1;
    }
  }

  return { orders, rowCount, skippedCount, conflictCount };
}

export function unmatchedDeals(orders: SalesOrderDraft[]): UnmatchedDeal[] {
  const groups = new Map<string, UnmatchedDeal>();
  for (const order of orders) {
    if (order.salesEmail || !order.countsAsDeal) continue;
    const name = order.salesPersonRaw.trim() || "Tanpa nama";
    const current = groups.get(name) ?? { name, count: 0, netTotal: 0 };
    current.count += 1;
    current.netTotal += order.netTotal;
    groups.set(name, current);
  }
  return [...groups.values()].sort((a, b) => b.netTotal - a.netTotal || a.name.localeCompare(b.name, "id"));
}

export function dealNetTotal(orders: SalesOrderDraft[]): number {
  return orders.reduce((sum, order) => (order.countsAsDeal ? sum + order.netTotal : sum), 0);
}

function toDraft(
  cells: string[],
  columns: Map<string, number>,
  soNumber: string,
  orderDate: string,
  roster: SalesProfileName[],
): SalesOrderDraft {
  const status = cell(cells, columns, "status");
  const docstatus = parseDocstatus(cell(cells, columns, "docstatus"));
  const salesPersonRaw = cell(cells, columns, "sales person");
  const matched = matchSalesPerson(salesPersonRaw, roster);
  return {
    soNumber,
    quotation: emptyToNull(cell(cells, columns, "quotation")),
    customer: emptyToNull(cell(cells, columns, "customer")),
    orderDate,
    netTotal: parseAmount(cell(cells, columns, "net total")),
    grandTotal: parseAmount(cell(cells, columns, "grand total")),
    status,
    docstatus,
    source: emptyToNull(cell(cells, columns, "source")),
    salesPersonRaw,
    salesEmail: matched?.email ? matched.email.trim().toLowerCase() : null,
    countsAsDeal: countsAsDeal(status, docstatus),
  };
}

function fingerprint(order: SalesOrderDraft): string {
  return [
    order.quotation ?? "",
    order.customer ?? "",
    order.orderDate,
    order.netTotal.toFixed(3),
    order.grandTotal.toFixed(3),
    order.status.trim().toLowerCase(),
    order.docstatus === null ? "" : String(order.docstatus),
    order.source ?? "",
    order.salesPersonRaw.trim().toLowerCase(),
  ].join("|");
}

function indexHeaders(header: string[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((value, position) => {
    const key = value.trim().toLowerCase();
    if (key && !index.has(key)) index.set(key, position);
  });
  return index;
}

function cell(cells: string[], columns: Map<string, number>, name: string): string {
  const position = columns.get(name);
  if (position === undefined) return "";
  return (cells[position] ?? "").trim();
}

function parseDocstatus(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmount(value: string): number {
  const trimmed = value.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOrderDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!local) return null;
  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}
