import { AccountSidebarLink, DealSidebarLink, TemplateSidebarLink } from "@/components/dashboard-shell";
import { isSuperAdmin } from "@/lib/access";
import { getViewer } from "@/lib/session";

export async function TemplateMenuLink() {
  const viewer = await getViewer();
  if (viewer.kind !== "ok" || !isSuperAdmin(viewer)) return null;
  return (
    <>
      <DealSidebarLink />
      <AccountSidebarLink />
      <TemplateSidebarLink />
    </>
  );
}
