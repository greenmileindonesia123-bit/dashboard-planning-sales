import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleEvent } from "@/lib/calendar";
import { countsAsDeal } from "@/lib/sales-order/parse";
import type { ProfileStatus, SalesProfile, Team, ViewerResult, VisitRecord } from "@/lib/types";

const PROFILE_COLUMNS = "id, roster_order, name, email, area, team, status, auth_user_id";

type ProfileRow = {
  id: string;
  roster_order: number;
  name: string;
  email: string | null;
  area: string;
  team: string;
  status: string;
  auth_user_id: string | null;
};

function asTeam(value: string): Team | null {
  if (value === "Sales" || value === "PPIC") return value;
  return null;
}

function asStatus(value: string): ProfileStatus | null {
  if (value === "Aktif" || value === "Nonaktif") return value;
  return null;
}

function mapProfile(row: ProfileRow): SalesProfile | null {
  const team = asTeam(row.team);
  const status = asStatus(row.status);
  if (!team || !status) return null;
  return {
    id: row.id,
    rosterOrder: row.roster_order,
    name: row.name,
    email: row.email,
    area: row.area,
    team,
    status,
  };
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export const getViewer = cache(async (): Promise<ViewerResult> => {
  await connection();
  if (!getSupabaseEnv()) return { kind: "unconfigured" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const email = data?.claims.email?.toLowerCase();
  if (error || !userId || !email) redirect("/login");

  const byId = await supabase
    .from("sales_profiles")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (byId.error) return { kind: "data-error", message: byId.error.message };

  let row = (byId.data as ProfileRow | null) ?? null;
  if (!row) {
    const byEmail = await supabase
      .from("sales_profiles")
      .select(PROFILE_COLUMNS)
      .eq("email", email)
      .maybeSingle();
    if (byEmail.error) return { kind: "data-error", message: byEmail.error.message };
    row = (byEmail.data as ProfileRow | null) ?? null;
  }

  if (!row) return { kind: "unlinked" };
  const profile = mapProfile(row);
  if (!profile) return { kind: "data-error", message: "Profil sales tidak valid." };
  if (profile.status !== "Aktif") return { kind: "inactive", email };

  return {
    kind: "ok",
    userId,
    email: profile.email ?? email,
    name: profile.name,
    area: profile.area,
    team: profile.team,
    status: profile.status,
  };
});

export async function loadRoster(): Promise<{
  viewer: ViewerResult;
  roster: SalesProfile[];
  error: string | null;
}> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { viewer, roster: [], error: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_profiles")
    .select("id, roster_order, name, email, area, team, status")
    .order("roster_order", { ascending: true });
  if (error) return { viewer, roster: [], error: error.message };
  const roster = ((data ?? []) as Omit<ProfileRow, "auth_user_id">[])
    .map((row) => mapProfile({ ...row, auth_user_id: null }))
    .filter((row): row is SalesProfile => row !== null);
  return { viewer, roster, error: null };
}

type VisitRow = {
  visit_date: string;
  sales_email: string | null;
  sales_name: string;
  visit_status: string | null;
  activity_result: string | null;
  potential_value: number | string | null;
  order_value: number | string | null;
  pipeline_status: string | null;
  customer_name: string | null;
  visit_purpose: string | null;
};

export async function loadVisits(
  start: string,
  end: string,
): Promise<{ viewer: ViewerResult; visits: VisitRecord[]; error: string | null }> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { viewer, visits: [], error: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_reports")
    .select(
      "visit_date, sales_email, sales_name, visit_status, activity_result, potential_value, order_value, pipeline_status, customer_name, visit_purpose",
    )
    .gte("visit_date", start)
    .lte("visit_date", end)
    .order("visit_date", { ascending: false });
  if (error) return { viewer, visits: [], error: error.message };
  const visits = ((data ?? []) as VisitRow[]).map((row) => ({
    visitDate: row.visit_date,
    salesEmail: row.sales_email,
    salesName: row.sales_name,
    visitStatus: row.visit_status,
    activityResult: row.activity_result,
    potentialValue: asNumber(row.potential_value),
    orderValue: asNumber(row.order_value),
    pipelineStatus: row.pipeline_status,
    customerName: row.customer_name,
    visitPurpose: row.visit_purpose,
  }));
  return { viewer, visits, error: null };
}

export type FollowUpRecord = {
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

type FollowUpRow = {
  follow_up_date: string;
  customer_name: string | null;
  sales_name: string;
  sales_email: string | null;
  visit_date: string;
  visit_purpose: string | null;
  visit_status: string | null;
  activity_result: string | null;
  notes: string | null;
  city_area: string | null;
};

export async function loadFollowUps(): Promise<{
  viewer: ViewerResult;
  followUps: FollowUpRecord[];
  error: string | null;
}> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { viewer, followUps: [], error: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_reports")
    .select(
      "follow_up_date, customer_name, sales_name, sales_email, visit_date, visit_purpose, visit_status, activity_result, notes, city_area",
    )
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true });
  if (error) return { viewer, followUps: [], error: error.message };
  const followUps = ((data ?? []) as FollowUpRow[])
    .filter((row) => row.follow_up_date)
    .map((row) => ({
      followUpDate: row.follow_up_date,
      customerName: row.customer_name,
      salesName: row.sales_name,
      salesEmail: row.sales_email,
      visitDate: row.visit_date,
      visitPurpose: row.visit_purpose,
      visitStatus: row.visit_status,
      activityResult: row.activity_result,
      notes: row.notes,
      cityArea: row.city_area,
    }));
  return { viewer, followUps, error: null };
}

type CalendarRow = {
  sales_email: string;
  google_event_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  html_link: string | null;
  status: string;
};

export async function loadCalendarEvents(
  start: Date,
  end: Date,
  salesEmail: string | null,
): Promise<{ viewer: ViewerResult; events: ScheduleEvent[]; error: string | null }> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { viewer, events: [], error: null };
  if (salesEmail === "") return { viewer, events: [], error: null };
  const supabase = await createClient();
  let query = supabase
    .from("calendar_events")
    .select("sales_email, google_event_id, title, starts_at, ends_at, all_day, location, html_link, status")
    .neq("status", "cancelled")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .order("starts_at", { ascending: true });
  if (salesEmail) query = query.eq("sales_email", salesEmail.toLowerCase());
  const { data, error } = await query;
  if (error) return { viewer, events: [], error: error.message };
  const events = ((data ?? []) as CalendarRow[]).map((row) => ({
    salesEmail: row.sales_email,
    googleEventId: row.google_event_id,
    title: row.title ?? "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    location: row.location,
    htmlLink: row.html_link,
    status: row.status,
    kind: "kalender" as const,
  }));
  return { viewer, events, error: null };
}

export async function loadFollowUpVisits(
  startDate: string,
  endDate: string,
  salesEmail: string | null,
): Promise<{ rows: { id: string; followUpDate: string; customerName: string | null; salesEmail: string | null }[]; error: string | null }> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { rows: [], error: null };
  if (salesEmail === "") return { rows: [], error: null };
  const supabase = await createClient();
  let query = supabase
    .from("visit_reports")
    .select("id, follow_up_date, customer_name, sales_email")
    .not("follow_up_date", "is", null)
    .gte("follow_up_date", startDate)
    .lte("follow_up_date", endDate);
  if (salesEmail) query = query.eq("sales_email", salesEmail.toLowerCase());
  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  const rows = ((data ?? []) as { id: string; follow_up_date: string; customer_name: string | null; sales_email: string | null }[])
    .filter((row) => row.follow_up_date)
    .map((row) => ({
      id: row.id,
      followUpDate: row.follow_up_date,
      customerName: row.customer_name,
      salesEmail: row.sales_email,
    }));
  return { rows, error: null };
}

export type SalesOrderRecord = {
  orderDate: string;
  netTotal: number;
  salesEmail: string | null;
  salesPersonRaw: string;
  status: string;
  docstatus: number | null;
  countsAsDeal: boolean;
};

type SalesOrderRow = {
  order_date: string;
  net_total: number | string | null;
  sales_email: string | null;
  sales_person_raw: string | null;
  status: string | null;
  docstatus: number | null;
};

export async function loadSalesOrders(
  start: string,
  end: string,
): Promise<{ viewer: ViewerResult; orders: SalesOrderRecord[]; error: string | null }> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return { viewer, orders: [], error: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select("order_date, net_total, sales_email, sales_person_raw, status, docstatus")
    .gte("order_date", start)
    .lte("order_date", end);
  if (error) return { viewer, orders: [], error: error.message };
  const orders = ((data ?? []) as SalesOrderRow[]).map((row) => {
    const status = row.status ?? "";
    return {
      orderDate: row.order_date,
      netTotal: asNumber(row.net_total),
      salesEmail: row.sales_email,
      salesPersonRaw: row.sales_person_raw ?? "",
      status,
      docstatus: row.docstatus,
      countsAsDeal: countsAsDeal(status, row.docstatus),
    };
  });
  return { viewer, orders, error: null };
}
