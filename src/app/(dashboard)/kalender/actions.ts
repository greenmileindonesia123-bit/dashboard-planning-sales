"use server";

import { redirect } from "next/navigation";
import {
  activeSyncRequest,
  normalizeRequesterEmail,
  SYNC_ALREADY_RUNNING_MESSAGE,
  SYNC_COOLDOWN_MS,
  SYNC_RECORDED_MESSAGE,
  SYNC_SENT_MESSAGE,
  SYNC_WEBHOOK_FAILED_MESSAGE,
  syncStatusMessage,
} from "@/lib/calendar-sync";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type SyncStartResult = {
  ok: boolean;
  message: string;
  requestId: string | null;
  status: string | null;
};

export async function requestCalendarSync(): Promise<SyncStartResult> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const email = normalizeRequesterEmail(viewer.email);
  const supabase = await createClient();
  const since = new Date(Date.now() - SYNC_COOLDOWN_MS).toISOString();

  const { data: activeFlag, error: activeError } = await supabase.rpc("calendar_sync_is_active", { since });
  if (activeError) {
    return { ok: false, message: "Permintaan sinkron belum dapat dicatat. Jalankan migrasi kalender.", requestId: null, status: null };
  }
  const visible = await loadRecentRequests();
  const running = activeSyncRequest(visible, new Date());
  if (activeFlag === true || running) {
    return {
      ok: true,
      message: SYNC_ALREADY_RUNNING_MESSAGE,
      requestId: running?.id ?? null,
      status: running?.status ?? "pending",
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("calendar_sync_requests")
    .insert({ requested_by: email, status: "pending" })
    .select("id, status")
    .single();
  if (insertError || !inserted) {
    return { ok: false, message: "Permintaan sinkron tidak tersimpan.", requestId: null, status: null };
  }

  const webhook = await notifyCalendarWorker(String(inserted.id), email);
  return {
    ok: true,
    message: webhook,
    requestId: String(inserted.id),
    status: "pending",
  };
}

export async function readCalendarSync(requestId: string): Promise<{ status: string; message: string } | null> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_sync_requests")
    .select("status, message")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return null;
  return { status: String(data.status), message: syncStatusMessage(String(data.status), data.message ? String(data.message) : null) };
}

async function loadRecentRequests() {
  const supabase = await createClient();
  const since = new Date(Date.now() - SYNC_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from("calendar_sync_requests")
    .select("id, requested_by, requested_at, status")
    .gte("requested_at", since)
    .order("requested_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    requestedBy: String(row.requested_by),
    requestedAt: String(row.requested_at),
    status: String(row.status),
  }));
}

async function notifyCalendarWorker(requestId: string, requestedBy: string): Promise<string> {
  const url = process.env.CALENDAR_SYNC_WEBHOOK_URL?.trim();
  if (!url) return SYNC_RECORDED_MESSAGE;
  const secret = process.env.CALENDAR_SYNC_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) {
    headers.authorization = `Bearer ${secret}`;
    headers["x-webhook-secret"] = secret;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ requestId, requestedBy }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return SYNC_WEBHOOK_FAILED_MESSAGE;
    return SYNC_SENT_MESSAGE;
  } catch {
    return SYNC_WEBHOOK_FAILED_MESSAGE;
  }
}
