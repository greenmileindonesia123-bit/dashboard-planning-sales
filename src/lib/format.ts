export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

export function formatRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(value);
}

export function formatSignedRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
  return `${formatted}%`;
}

export function formatArea(area: string): string {
  const trimmed = area.trim();
  if (!trimmed) return "—";
  return trimmed.charAt(0).toLocaleUpperCase("id-ID") + trimmed.slice(1);
}

export function describeDataError(message: string): string {
  if (/relation .* does not exist|schema cache|could not find the table/i.test(message)) {
    return "Tabel belum ada di Supabase. Jalankan migrasi dan seed, lalu muat ulang halaman.";
  }
  return "Data tidak dapat dimuat. Muat ulang halaman, atau periksa kebijakan RLS dan kunci API.";
}
