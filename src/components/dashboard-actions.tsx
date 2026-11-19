import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function DashboardActions({ lastUpdatedLabel }: { lastUpdatedLabel: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Link href="/unggah" className={buttonVariants({ variant: "default", size: "sm" })}>
          Unggah laporan Smart Salary
        </Link>
        <Link href="/unggah-jadwal" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Unggah jadwal kalender
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {lastUpdatedLabel ? `Kalender terakhir diperbarui ${lastUpdatedLabel}.` : "Belum ada acara kalender yang diunggah."}
      </p>
    </div>
  );
}
