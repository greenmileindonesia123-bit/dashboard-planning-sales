import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { describeDataError } from "@/lib/format";
import type { ViewerResult } from "@/lib/types";

export function AccessState({ viewer }: { viewer: Exclude<ViewerResult, { kind: "ok" }> }) {
  if (viewer.kind === "unconfigured") {
    return (
      <NoticeBlock
        title="Supabase belum dikonfigurasi"
        body="Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu muat ulang."
      />
    );
  }
  if (viewer.kind === "data-error") {
    return <NoticeBlock title="Data tidak dapat dimuat" body={describeDataError(viewer.message)} />;
  }
  if (viewer.kind === "inactive") {
    return (
      <NoticeBlock
        title="Akun tidak aktif"
        body="Status di sales_profiles bukan Aktif, jadi dashboard tidak menampilkan angka."
        logout
      />
    );
  }
  return (
    <NoticeBlock
      title="Profil belum terhubung"
      body="Email login ini tidak cocok dengan baris Aktif di sales_profiles. Jalankan seed dan skrip penyediaan akun."
      logout
    />
  );
}

function NoticeBlock({ title, body, logout: showLogout = false }: { title: string; body: string; logout?: boolean }) {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      {showLogout ? (
        <form action={logout}>
          <Button type="submit" variant="outline">
            Keluar
          </Button>
        </form>
      ) : null}
    </div>
  );
}
