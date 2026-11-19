export type Team = "Sales" | "PPIC";
export type ProfileStatus = "Aktif" | "Nonaktif";

export type SalesProfile = {
  id: string;
  rosterOrder: number;
  name: string;
  email: string | null;
  area: string;
  team: Team;
  status: ProfileStatus;
};

export type VisitRecord = {
  visitDate: string;
  salesEmail: string | null;
  salesName: string;
  visitStatus: string | null;
  activityResult: string | null;
  potentialValue: number;
  orderValue: number;
  pipelineStatus: string | null;
  customerName: string | null;
  visitPurpose: string | null;
};

export type Viewer = {
  kind: "ok";
  userId: string;
  email: string;
  name: string;
  area: string;
  team: Team;
  status: ProfileStatus;
};

export type ViewerResult =
  | Viewer
  | { kind: "unconfigured" }
  | { kind: "unlinked" }
  | { kind: "inactive"; email: string }
  | { kind: "data-error"; message: string };
