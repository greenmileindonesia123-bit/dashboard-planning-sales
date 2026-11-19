import { DashboardActions } from "@/components/dashboard-actions";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";

export async function DashboardActionBar() {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return null;
  const lastUpdatedLabel = await latestCalendarLabel();
  return <DashboardActions lastUpdatedLabel={lastUpdatedLabel} />;
}

async function latestCalendarLabel(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.updated_at) return null;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(String(data.updated_at)));
}
