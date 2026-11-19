"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { COMPANY_NAME } from "@/lib/constants";
import { cn } from "cn";

const LINKS = [
  { href: "/planning", label: "Planning Kegiatan" },
  { href: "/pengingat", label: "Pengingat kunjungan ulang" },
  { href: "/customer", label: "Data Customer" },
  { href: "/quotation", label: "Permintaan Quotation" },
  { href: "/unggah", label: "Unggah laporan kunjungan", hint: "Smart Salary" },
  { href: "/unggah-jadwal", label: "Unggah jadwal kalender" },
  { href: "/kinerja", label: "Kinerja" },
  { href: "/report", label: "Report" },
  { href: "/tim", label: "Tim Sales" },
];

const TEMPLATE_LINK = {
  href: "/template-kunjungan",
  label: "Template kunjungan sales",
  hint: "Laporan Kunjungan",
};

const DEAL_LINK = {
  href: "/unggah-deal",
  label: "Unggah data deal (SO)",
  hint: "Net Total",
};

const ACCOUNT_LINK = {
  href: "/kelola-akun",
  label: "Kelola ID login",
  hint: "Akun staf",
};

const MENU_TOGGLE_ID = "menu-samping-toggle";

export function DashboardShell({
  account,
  children,
  footer,
  templateLink = null,
}: {
  account: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  templateLink?: ReactNode;
}) {
  const pathname = usePathname();
  const toggleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toggleRef.current) toggleRef.current.checked = false;
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && toggleRef.current) toggleRef.current.checked = false;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-svh w-full flex-1">
        <input ref={toggleRef} id={MENU_TOGGLE_ID} type="checkbox" className="peer sr-only" aria-label="Menu" />
      <label
        htmlFor={MENU_TOGGLE_ID}
        className="fixed inset-0 z-30 hidden bg-foreground/40 peer-checked:block lg:hidden"
        aria-label="Tutup menu"
      />
      <aside
        id="menu-samping"
        className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card peer-checked:flex lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-svh lg:w-64"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{COMPANY_NAME}</p>
            <p className="font-heading text-base leading-tight">Menu</p>
          </div>
          <label htmlFor={MENU_TOGGLE_ID} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer lg:hidden")}>
            Tutup
          </label>
        </div>
        <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {LINKS.map((link) => (
            <SidebarLink key={link.href} href={link.href} label={link.label} hint={link.hint} active={isActive(pathname, link.href)} />
          ))}
          {templateLink}
        </nav>
        <div className="space-y-2 border-t border-border px-3 py-3">
          <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Akun</p>
          <SidebarLink href="/akun/kata-sandi" label="Ubah kata sandi" active={isActive(pathname, "/akun/kata-sandi")} />
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Keluar
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-1 bg-primary" />
        <header className="border-b border-border bg-background">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <label
                htmlFor={MENU_TOGGLE_ID}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer lg:hidden")}
              >
                Menu
              </label>
              <BrandMark className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium tracking-wide text-primary uppercase">{COMPANY_NAME}</p>
                <p className="hidden truncate font-heading text-base leading-tight sm:block">Dashboard Planning Sales</p>
              </div>
            </div>
            {account}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
        {footer}
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  hint,
  active,
}: {
  href: string;
  label: string;
  hint?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm leading-5 font-medium",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {label}
      {hint ? (
        <span className={cn("mt-0.5 block text-xs font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {hint}
        </span>
      ) : null}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TemplateSidebarLink() {
  const pathname = usePathname();
  return (
    <SidebarLink
      href={TEMPLATE_LINK.href}
      label={TEMPLATE_LINK.label}
      hint={TEMPLATE_LINK.hint}
      active={isActive(pathname, TEMPLATE_LINK.href)}
    />
  );
}

export function DealSidebarLink() {
  const pathname = usePathname();
  return (
    <SidebarLink
      href={DEAL_LINK.href}
      label={DEAL_LINK.label}
      hint={DEAL_LINK.hint}
      active={isActive(pathname, DEAL_LINK.href)}
    />
  );
}

export function AccountSidebarLink() {
  const pathname = usePathname();
  return (
    <SidebarLink
      href={ACCOUNT_LINK.href}
      label={ACCOUNT_LINK.label}
      hint={ACCOUNT_LINK.hint}
      active={isActive(pathname, ACCOUNT_LINK.href)}
    />
  );
}
