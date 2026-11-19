export const QUOTATION_REVIEWER_EMAILS = [
  "operasionalgreenmileindonesia@gmail.com",
  "estimatorgreenmileindonesia@gmail.com",
  "halogreenmile@gmail.com",
] as const;

export const QUOTATION_STATUSES = ["Baru", "Diproses", "Selesai", "Batal"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export function isQuotationReviewer(viewer: { email: string | null | undefined }): boolean {
  const email = (viewer.email ?? "").trim().toLowerCase();
  return QUOTATION_REVIEWER_EMAILS.some((item) => item === email);
}

export function isQuotationStatus(value: string): value is QuotationStatus {
  return QUOTATION_STATUSES.includes(value as QuotationStatus);
}

export function canReadQuotation(
  viewer: { email: string },
  request: { salesEmail: string },
): boolean {
  if (isQuotationReviewer(viewer)) return true;
  return request.salesEmail.trim().toLowerCase() === viewer.email.trim().toLowerCase();
}
