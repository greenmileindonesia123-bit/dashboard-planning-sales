import type { ReactNode } from "react";

export function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/10"
      : "border-primary/20 bg-accent";
  return (
    <aside className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </aside>
  );
}
