export const SUPER_ADMIN_EMAIL = "operasionalgreenmileindonesia@gmail.com";

export function isSuperAdmin(viewer: { email: string | null | undefined }): boolean {
  return (viewer.email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
