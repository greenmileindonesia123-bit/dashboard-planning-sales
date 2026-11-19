import { isSuperAdmin } from "./access.ts";
import { personKey, type SalesIdentity } from "./metrics.ts";
import type { Viewer } from "./types.ts";

export function viewerIdentity(viewer: Viewer): SalesIdentity {
  return { name: viewer.name, email: viewer.email };
}

export function resolvePersonFilter(
  viewer: Viewer,
  requested: string | undefined,
  roster: SalesIdentity[],
): SalesIdentity | null {
  if (!isSuperAdmin(viewer)) return viewerIdentity(viewer);
  if (!requested || requested === "semua") return null;
  return roster.find((person) => personKey(person) === requested) ?? null;
}

export function figuresFor(
  viewer: Viewer,
  roster: SalesIdentity[],
  selected: SalesIdentity | null,
): SalesIdentity[] {
  if (!isSuperAdmin(viewer)) return [viewerIdentity(viewer)];
  if (selected) return [selected];
  return roster;
}
