export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  if (value.length < 3 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
