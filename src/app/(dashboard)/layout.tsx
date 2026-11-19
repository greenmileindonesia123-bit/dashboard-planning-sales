import { Suspense, type ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { DashboardShell } from "@/components/dashboard-shell";
import { TemplateMenuLink } from "@/components/template-menu-link";
import { COMPANY_NAME } from "@/lib/constants";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-muted-foreground">Memuat menu…</p>}>
    <DashboardShell
      templateLink={
        <Suspense fallback={null}>
          <TemplateMenuLink />
        </Suspense>
      }
      account={
        <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat akun…</p>}>
          <AccountMenu />
        </Suspense>
      }
      footer={
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl px-4 py-4 text-sm text-muted-foreground md:px-6">
            <p>{COMPANY_NAME} · zona waktu Asia/Jakarta</p>
          </div>
        </footer>
      }
    >
      {children}
    </DashboardShell>
    </Suspense>
  );
}
