export type RosterPerson = {
  name: string;
  email: string | null;
};

export type SheetMatrix = {
  name: string;
  rows: string[][];
};

export type VisitDraft = {
  externalId: string;
  visitDate: string;
  startTime: string | null;
  salesName: string;
  salesEmail: string | null;
  customerName: string | null;
  visitPurpose: string | null;
  visitStatus: "Terlaksana";
  activityResult: string | null;
  pipelineStatus: string | null;
  notes: string | null;
  followUpDate: string | null;
  address: string | null;
  cityArea: string | null;
  documentationUrl: string | null;
};

export type SkippedRow = {
  sheet: string;
  rowNumber: number;
  externalId: string | null;
  reason: string;
};

export type ParsedVisitFile = {
  drafts: VisitDraft[];
  skipped: SkippedRow[];
  trainingRowsIgnored: number;
};
