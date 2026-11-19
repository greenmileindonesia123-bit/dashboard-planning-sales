"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  accountFieldMessage,
  accountRpcMessage,
  isAccountTeam,
  selfDeactivationMessage,
  superAdminGate,
  validateNewAccount,
  validateProfileUpdate,
  validateTemporaryPassword,
} from "@/lib/account-admin";
import { normalizeEmail } from "@/lib/email";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type AccountActionResult = { ok: true; message: string } | { ok: false; message: string };

const ACCOUNT_PATHS = [
  "/kelola-akun",
  "/tim",
  "/kinerja",
  "/report",
  "/pengingat",
  "/planning",
  "/unggah",
  "/unggah-jadwal",
  "/unggah-deal",
];

export async function createLoginAccount(formData: FormData): Promise<AccountActionResult> {
  const gate = await openSession();
  if (!gate.ok) return gate;
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const team = String(formData.get("team") ?? "");
  const password = String(formData.get("password") ?? "");
  const issue = validateNewAccount({ email, name, team, password });
  if (issue || !isAccountTeam(team)) return { ok: false, message: accountFieldMessage(issue ?? "team") };

  const { error } = await gate.supabase.rpc("admin_create_account", {
    p_email: email,
    p_name: name,
    p_team: team,
    p_password: password,
  });
  if (error) return { ok: false, message: accountRpcMessage(error.message, "Akun tidak dapat dibuat. Tidak ada email yang dikirim.") };

  refreshAccountSurfaces();
  return { ok: true, message: "ID login ditambahkan. Tidak ada email yang dikirim." };
}

export async function updateLoginAccount(formData: FormData): Promise<AccountActionResult> {
  const gate = await openSession();
  if (!gate.ok) return gate;
  const authUserId = String(formData.get("authUserId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const team = String(formData.get("team") ?? "");
  const issue = validateProfileUpdate({ name, team });
  if (issue || !isAccountTeam(team)) return { ok: false, message: accountFieldMessage(issue ?? "team") };
  if (!authUserId) return { ok: false, message: "Akun Auth untuk email ini belum ada." };

  const { error } = await gate.supabase.rpc("admin_update_account", {
    p_user_id: authUserId,
    p_name: name,
    p_team: team,
  });
  if (error) return { ok: false, message: accountRpcMessage(error.message, "Perubahan tidak dapat disimpan.") };

  refreshAccountSurfaces();
  return { ok: true, message: "Nama dan tim disimpan." };
}

export async function resetLoginPassword(formData: FormData): Promise<AccountActionResult> {
  const gate = await openSession();
  if (!gate.ok) return gate;
  const authUserId = String(formData.get("authUserId") ?? "");
  const password = String(formData.get("password") ?? "");
  const issue = validateTemporaryPassword(password);
  if (issue) return { ok: false, message: accountFieldMessage(issue) };
  if (!authUserId) return { ok: false, message: "Akun Auth untuk email ini belum ada." };

  const { error } = await gate.supabase.rpc("admin_reset_password", {
    p_user_id: authUserId,
    p_password: password,
  });
  if (error) return { ok: false, message: accountRpcMessage(error.message, "Kata sandi tidak dapat diubah.") };
  return { ok: true, message: "Kata sandi sementara diperbarui. Tidak ada email yang dikirim." };
}

export async function setLoginActive(formData: FormData): Promise<AccountActionResult> {
  const gate = await openSession();
  if (!gate.ok) return gate;
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const authUserId = String(formData.get("authUserId") ?? "");
  const nextActive = String(formData.get("active") ?? "") === "true";
  if (!nextActive) {
    const blocked = selfDeactivationMessage(gate.viewer.email, email);
    if (blocked) return { ok: false, message: blocked };
  }
  if (!authUserId) return { ok: false, message: "Akun Auth untuk email ini belum ada." };

  const { error } = await gate.supabase.rpc("admin_set_active", {
    p_user_id: authUserId,
    p_active: nextActive,
  });
  if (error) {
    return {
      ok: false,
      message: accountRpcMessage(error.message, nextActive ? "Akun tidak dapat diaktifkan." : "Akun tidak dapat dinonaktifkan."),
    };
  }

  refreshAccountSurfaces();
  return { ok: true, message: nextActive ? "Akun diaktifkan." : "Akun dinonaktifkan." };
}

function refreshAccountSurfaces() {
  for (const path of ACCOUNT_PATHS) revalidatePath(path);
  revalidatePath("/", "layout");
}

async function openSession(): Promise<
  | { ok: true; viewer: { email: string }; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; message: string }
> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");
  const denied = superAdminGate(viewer);
  if (denied) return { ok: false, message: denied };
  return { ok: true, viewer, supabase: await createClient() };
}
