import { connection } from "next/server";
import { Suspense } from "react";
import { AccountPanel } from "@/app/(dashboard)/kelola-akun/account-panel";
import { loadLoginAccounts } from "@/app/(dashboard)/kelola-akun/directory";
import { AccessState } from "@/components/access-state";
import { Notice } from "@/components/notice";
import { isSuperAdmin } from "@/lib/access";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Kelola ID login" };

export default function AccountAdminPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AccountAdminScreen />
    </Suspense>
  );
}

async function AccountAdminScreen() {
  await connection();
  const viewer = await getViewer();
  if (viewer.kind !== "ok") return <AccessState viewer={viewer} />;
  if (!isSuperAdmin(viewer)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-heading text-3xl tracking-tight">Kelola ID login</h1>
        <Notice title="Halaman terbatas">Menu ini hanya untuk Super Admin.</Notice>
      </div>
    );
  }

  const loaded = await loadLoginAccounts();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl tracking-tight">Kelola ID login</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Tambah akun, ubah nama pemakai dan tim, reset kata sandi sementara, atau nonaktifkan akses. Email login tidak diubah. Tidak ada email undangan.
        </p>
      </div>
      {loaded.error ? (
        <Notice title="Daftar belum dapat dimuat">{loaded.error}</Notice>
      ) : (
        <AccountPanel accounts={loaded.accounts} actorEmail={viewer.email} />
      )}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl tracking-tight">Kelola ID login</h1>
      <p className="text-sm text-muted-foreground">Memuat data…</p>
    </div>
  );
}
