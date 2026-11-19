"use server";

import { redirect } from "next/navigation";
import { interpretAllowlist } from "@/lib/allowlist";
import { isPlausibleEmail, normalizeEmail } from "@/lib/email";
import { mapPasswordSignInError, UNLISTED_EMAIL_MESSAGE } from "@/lib/password-login";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  message: string | null;
};

const ALLOWLIST_FAILED = "Pemeriksaan daftar sales gagal. Coba lagi.";

function configurationMessage(): string {
  return "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.";
}

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!isPlausibleEmail(email)) {
    return { message: "Masukkan email yang valid." };
  }
  if (password.length === 0) {
    return { message: "Masukkan kata sandi." };
  }
  if (!getSupabaseEnv()) {
    return { message: configurationMessage() };
  }

  const supabase = await createClient();
  const { data: registered, error: allowlistError } = await supabase.rpc("is_active_registered_email", {
    check_email: email,
  });
  const decision = interpretAllowlist(registered, Boolean(allowlistError));
  if (decision === "error") {
    return { message: ALLOWLIST_FAILED };
  }
  if (decision !== "allow") {
    return { message: UNLISTED_EMAIL_MESSAGE };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { message: mapPasswordSignInError(signInError.message) };
  }

  const { data: stillRegistered, error: secondCheckError } = await supabase.rpc("is_active_registered_email", {
    check_email: email,
  });
  if (interpretAllowlist(stillRegistered, Boolean(secondCheckError)) !== "allow") {
    await supabase.auth.signOut();
    return { message: secondCheckError ? ALLOWLIST_FAILED : UNLISTED_EMAIL_MESSAGE };
  }

  redirect("/planning");
}

export async function logout() {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
