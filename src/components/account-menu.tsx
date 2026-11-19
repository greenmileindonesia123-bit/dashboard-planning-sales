import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/session";

export async function AccountMenu() {
  const viewer = await getViewer();
  if (viewer.kind !== "ok") {
    return <p className="text-sm text-muted-foreground">Akun belum siap</p>;
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="min-w-0 text-right">
        <p className="max-w-28 truncate text-sm font-medium sm:max-w-56">{viewer.name}</p>
        <p className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block">
          {viewer.team} · {viewer.email}
        </p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          Keluar
        </Button>
      </form>
    </div>
  );
}
