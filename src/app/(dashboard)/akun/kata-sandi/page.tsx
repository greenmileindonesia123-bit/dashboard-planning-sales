import { connection } from "next/server";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/app/(dashboard)/akun/kata-sandi/change-password-form";
import { AccessState } from "@/components/access-state";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Ubah kata sandi" };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ChangePasswordScreen />
    </Suspense>
  );
}

async function ChangePasswordScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Ubah kata sandi</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Ganti kata sandi untuk {viewer.email}. Setelah tersimpan, Anda tetap masuk. Tidak ada email yang dikirim.
        </p>
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <ChangePasswordForm />
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Ubah kata sandi</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
