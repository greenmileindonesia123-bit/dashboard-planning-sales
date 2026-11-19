import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const loginUrl = new URL("/login", requestUrl.origin);
  if (!getSupabaseEnv() || !tokenHash || !type) {
    loginUrl.searchParams.set("error", "tautan");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    loginUrl.searchParams.set("error", "tautan");
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.redirect(new URL("/planning", requestUrl.origin));
}
