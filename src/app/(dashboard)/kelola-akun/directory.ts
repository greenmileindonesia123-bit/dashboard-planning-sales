import "server-only";
import { accountRpcMessage, isAccountTeam, type LoginAccount } from "@/lib/account-admin";
import { createClient } from "@/lib/supabase/server";

type AccountRow = {
  id: string | null;
  profile_id: string | null;
  email: string | null;
  name: string | null;
  team: string | null;
  status: string | null;
  last_sign_in_at: string | null;
  banned: boolean | null;
};

export async function loadLoginAccounts(): Promise<{ accounts: LoginAccount[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_accounts");
  if (error) return { accounts: [], error: accountRpcMessage(error.message, "Daftar akun tidak dapat dimuat.") };

  const accounts = ((data ?? []) as AccountRow[])
    .filter((row) => row.email)
    .map((row) => ({
      profileId: row.profile_id,
      authUserId: row.id,
      email: String(row.email).toLowerCase(),
      name: row.name?.trim() || "Tanpa nama di Data Sales",
      team: row.team && isAccountTeam(row.team) ? row.team : null,
      active: row.status === "Aktif" && row.banned !== true,
      lastSignInLabel: row.id ? formatLastSignIn(row.last_sign_in_at) : "Belum terhubung ke Auth",
    }));
  return { accounts, error: null };
}

function formatLastSignIn(value: string | null): string {
  if (!value) return "Belum pernah masuk";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum pernah masuk";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
