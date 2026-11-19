import { connection } from "next/server";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Notice } from "@/components/notice";
import { COMPANY_NAME, SHEET_URL } from "@/lib/constants";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { firstParam } from "@/lib/query";
import { LoginForm } from "@/app/login/login-form";

export const metadata = {
  title: "Masuk",
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="h-1 bg-primary" />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{COMPANY_NAME}</p>
            <p className="font-heading text-lg">Dashboard Planning Sales</p>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl tracking-tight">Masuk</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Masuk dengan email terdaftar dan kata sandi.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginNotices searchParams={props.searchParams} />
        </Suspense>
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <LoginForm />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Pendaftaran umum ditutup. Hanya email berstatus Aktif di daftar sales yang dapat masuk.
        </p>
      </main>
      <footer className="border-t border-border px-4 py-4 text-sm text-muted-foreground">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-1">
          <p>{COMPANY_NAME} · zona waktu Asia/Jakarta</p>
          <a href={SHEET_URL} className="underline underline-offset-4" target="_blank" rel="noreferrer">
            Template Laporan Kunjungan Sales
          </a>
        </div>
      </footer>
    </div>
  );
}

async function LoginNotices({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const linkFailed = firstParam(params.error) === "tautan";
  const configured = Boolean(getSupabaseEnv());
  return (
    <>
      {configured ? null : (
        <Notice title="Konfigurasi belum lengkap">
          Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY sebelum masuk. Kunci publishable boleh dipakai
          sebagai anon key.
        </Notice>
      )}
      {linkFailed ? (
        <Notice title="Tautan tidak berlaku" tone="warning">
          Masuk dengan email dan kata sandi di form bawah.
        </Notice>
      ) : null}
    </>
  );
}
