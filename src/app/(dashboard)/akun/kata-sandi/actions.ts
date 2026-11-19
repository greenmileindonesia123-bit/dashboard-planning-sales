"use server";

import { redirect } from "next/navigation";
import { interpretAllowlist } from "@/lib/allowlist";
import {
  mapOldPasswordError,
  mapPasswordUpdateError,
  PASSWORD_SAVED_MESSAGE,
  passwordChangeIssueMessage,
  validatePasswordChange,
} from "@/lib/password-change";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = {
  status: "idle" | "error" | "success";
  message: string | null;
  formKey: string;
};

const ALLOWLIST_FAILED = "Pemeriksaan daftar sales gagal. Coba lagi.";

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const issue = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
  if (issue) {
    return { status: "error", message: passwordChangeIssueMessage(issue), formKey: "edit" };
  }

  const supabase = await createClient();
  const { data: registered, error: allowlistError } = await supabase.rpc("is_active_registered_email", {
    check_email: viewer.email,
  });
  const decision = interpretAllowlist(registered, Boolean(allowlistError));
  if (decision === "error") {
    return { status: "error", message: ALLOWLIST_FAILED, formKey: "edit" };
  }
  if (decision !== "allow") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { status: "error", message: mapOldPasswordError(verifyError.message), formKey: "edit" };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { status: "error", message: mapPasswordUpdateError(updateError.message), formKey: "edit" };
  }

  return {
    status: "success",
    message: PASSWORD_SAVED_MESSAGE,
    formKey: crypto.randomUUID(),
  };
}
