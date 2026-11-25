import "server-only";
import { buildCustomers, customerKeyFromSlug, customerTimeline, type CustomerOrder, type CustomerSummary, type CustomerVisit } from "@/lib/customers";
import { isSuperAdmin } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/types";

export async function loadCustomerDirectory(
  viewer: Viewer,
  selectedEmail: string | null,
  today: string,
): Promise<{ customers: CustomerSummary[]; visits: CustomerVisit[]; orders: CustomerOrder[]; error: string | null }> {
  const supabase = await createClient();
  const [visitResult, orderResult] = await Promise.all([
    supabase
      .from("visit_reports")
      .select("id, visit_date, customer_name, sales_name, sales_email, address, notes, activity_result, visit_status, visit_purpose, follow_up_date"),
    supabase
      .from("sales_orders")
      .select("so_number, order_date, customer, net_total, status, docstatus, sales_email, sales_person_raw"),
  ]);
  if (visitResult.error || orderResult.error) {
    return { customers: [], visits: [], orders: [], error: visitResult.error?.message ?? orderResult.error?.message ?? "Data customer gagal dimuat." };
  }
  const visits = ((visitResult.data ?? []) as VisitRow[]).map(mapVisit);
  const orders = ((orderResult.data ?? []) as OrderRow[]).map(mapOrder);
  const customers = buildCustomers(visits, orders, {
    superAdmin: isSuperAdmin(viewer),
    viewerEmail: viewer.email,
    selectedEmail,
  }, today);
  return { customers, visits, orders, error: null };
}

export async function loadCustomerDetail(viewer: Viewer, slug: string, today: string) {
  const key = customerKeyFromSlug(slug);
  if (!key) return { summary: null, timeline: [], error: null };
  const loaded = await loadCustomerDirectory(viewer, null, today);
  const summary = loaded.customers.find((customer) => customer.key === key) ?? null;
  if (!summary) return { summary: null, timeline: [], error: loaded.error };
  const supabase = await createClient();
  const pattern = `%${key.replace(/[%_,]/g, "").replace(/\s+/g, "%")}%`;
  const { data } = await supabase
    .from("calendar_events")
    .select("title, starts_at, location, sales_email")
    .or(`title.ilike.${pattern},location.ilike.${pattern}`)
    .limit(100);
  const roster = new Map<string, string>();
  const timeline = customerTimeline(
    summary,
    loaded.visits,
    loaded.orders,
    ((data ?? []) as { title: string | null; starts_at: string; location: string | null; sales_email: string | null }[]).map((event) => ({
      title: event.title ?? "",
      startsAt: event.starts_at,
      location: event.location,
      salesEmail: event.sales_email ?? "",
      salesName: (event.sales_email && roster.get(event.sales_email)) || event.sales_email || "Belum dipetakan",
    })),
  );
  return { summary, timeline, error: loaded.error };
}

type VisitRow = {
  id: string;
  visit_date: string;
  customer_name: string | null;
  sales_name: string;
  sales_email: string | null;
  address: string | null;
  notes: string | null;
  activity_result: string | null;
  visit_status: string | null;
  visit_purpose: string | null;
  follow_up_date: string | null;
};

type OrderRow = {
  so_number: string;
  order_date: string;
  customer: string | null;
  net_total: number | string | null;
  status: string | null;
  docstatus: number | null;
  sales_email: string | null;
  sales_person_raw: string | null;
};

function mapVisit(row: VisitRow): CustomerVisit {
  return {
    id: row.id,
    visitDate: row.visit_date,
    customerName: row.customer_name,
    salesName: row.sales_name,
    salesEmail: row.sales_email,
    address: row.address,
    notes: row.notes,
    activityResult: row.activity_result,
    visitStatus: row.visit_status,
    visitPurpose: row.visit_purpose,
    followUpDate: row.follow_up_date,
  };
}

function mapOrder(row: OrderRow): CustomerOrder {
  const net = typeof row.net_total === "number" ? row.net_total : Number(row.net_total ?? 0);
  return {
    soNumber: row.so_number,
    orderDate: row.order_date,
    customer: row.customer,
    netTotal: Number.isFinite(net) ? net : 0,
    status: row.status,
    docstatus: row.docstatus,
    salesEmail: row.sales_email,
    salesPersonRaw: row.sales_person_raw,
  };
}
