import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { COMPANY_NAME } from "@/lib/constants";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Dashboard Planning Sales",
    template: `%s · ${COMPANY_NAME}`,
  },
  description: `Dashboard internal planning kegiatan dan kinerja sales ${COMPANY_NAME}.`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${figtree.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
