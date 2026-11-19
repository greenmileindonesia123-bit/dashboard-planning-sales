import { isSuperAdmin } from "./access.ts";

export function preselectSalesEmail(filename: string, emails: string[]): string | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const match = base.match(/([^\\/\s]+@[^\\/\s]+\.[a-z0-9]+)\.ics$/i);
  if (!match) return null;
  const email = match[1].toLowerCase();
  return emails.some((item) => item.toLowerCase() === email) ? email : null;
}

export function calendarOwnerEmail(
  viewer: { email: string },
  selectedEmail: string | null,
): string | null {
  if (!isSuperAdmin(viewer)) return viewer.email.trim().toLowerCase();
  const selected = selectedEmail?.trim().toLowerCase() ?? "";
  return selected || null;
}
