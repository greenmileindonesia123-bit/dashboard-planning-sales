import { inRange } from "../metrics.ts";
import type { DateRange } from "../jakarta.ts";

export const UNMAPPED_DEAL_NAME = "Belum dipetakan";

export type DealOrder = {
  orderDate: string;
  netTotal: number;
  salesEmail: string | null;
  countsAsDeal: boolean;
};

export type DealPerson = {
  name: string;
  email: string | null;
  unmapped?: boolean;
};

export type DealSnapshot = {
  count: number;
  netTotal: number;
};

export function visibleDeals(
  orders: DealOrder[],
  scope: { superAdmin: boolean; viewerEmail: string; selectedEmail: string | null | undefined },
): DealOrder[] {
  const deals = orders.filter((order) => order.countsAsDeal);
  if (!scope.superAdmin) {
    const email = scope.viewerEmail.trim().toLowerCase();
    return deals.filter((order) => (order.salesEmail ?? "").toLowerCase() === email);
  }
  if (scope.selectedEmail === undefined) return deals;
  const selected = scope.selectedEmail?.trim().toLowerCase() ?? "";
  if (!selected) return [];
  return deals.filter((order) => (order.salesEmail ?? "").toLowerCase() === selected);
}

export function summarizeDeals(orders: DealOrder[]): DealSnapshot {
  let count = 0;
  let netTotal = 0;
  for (const order of orders) {
    if (!order.countsAsDeal) continue;
    count += 1;
    netTotal += order.netTotal;
  }
  return { count, netTotal };
}

export function dealsInRange(orders: DealOrder[], range: DateRange): DealOrder[] {
  return orders.filter((order) => inRange(order.orderDate, range));
}

export function dealRoster(
  roster: { name: string; email: string | null }[],
  scope: { superAdmin: boolean; viewer: { name: string; email: string }; selected: { name: string; email: string | null } | null },
): DealPerson[] {
  if (!scope.superAdmin) return [{ name: scope.viewer.name, email: scope.viewer.email }];
  if (scope.selected) return [{ name: scope.selected.name, email: scope.selected.email }];
  return [...roster.map((person) => ({ name: person.name, email: person.email })), { name: UNMAPPED_DEAL_NAME, email: null, unmapped: true }];
}

export function dealsForPerson(orders: DealOrder[], person: DealPerson): DealOrder[] {
  if (person.unmapped) return orders.filter((order) => !order.salesEmail);
  const email = person.email?.trim().toLowerCase();
  if (!email) return [];
  return orders.filter((order) => (order.salesEmail ?? "").toLowerCase() === email);
}
