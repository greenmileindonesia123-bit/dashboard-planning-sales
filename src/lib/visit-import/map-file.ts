import { isSuperAdmin } from "../access.ts";
import { matchSalesPerson } from "./match-sales.ts";
import type { ParsedVisitFile, RosterPerson, SheetMatrix, SkippedRow, VisitDraft } from "./types.ts";

const VISIT_SHEET = "laporan kunjungan sales";
const TRAINING_SHEET = "training record";
const ALLOWED_SOURCES = new Set(["gmb", "reference", "canvassing", "canvassing online"]);

const PIPELINE_BY_STATUS: Record<string, string | null> = {
  prospect: "Prospek",
  negotiate: "Negosiasi",
  purpose: null,
  deal: "Deal",
  lost: "Lost",
};

export function parseVisitSheets(sheets: SheetMatrix[], roster: RosterPerson[]): ParsedVisitFile {
  const drafts: VisitDraft[] = [];
  const skipped: SkippedRow[] = [];
  let trainingRowsIgnored = 0;
  let sawVisitSheet = false;

  for (const sheet of sheets) {
    const name = sheet.name.trim().toLowerCase();
    const header = sheet.rows[0] ?? [];
    if (name === TRAINING_SHEET || looksLikeTraining(header)) {
      trainingRowsIgnored += Math.max(0, sheet.rows.length - 1);
      continue;
    }
    if (name !== VISIT_SHEET && !looksLikeVisit(header)) continue;
    sawVisitSheet = true;
    const columns = indexHeaders(header);
    sheet.rows.slice(1).forEach((cells, index) => {
      const rowNumber = index + 2;
      if (isBlank(cells)) return;
      const mapped = mapVisitRow(cells, columns, roster);
      if (mapped.ok) drafts.push(mapped.draft);
      else skipped.push({ sheet: sheet.name, rowNumber, externalId: mapped.externalId, reason: mapped.reason });
    });
  }

  if (!sawVisitSheet) {
    skipped.push({
      sheet: "",
      rowNumber: 0,
      externalId: null,
      reason: "Sheet LAPORAN KUNJUNGAN SALES tidak ditemukan.",
    });
  }

  return { drafts, skipped, trainingRowsIgnored };
}

export function rowsForViewer(
  drafts: VisitDraft[],
  viewer: { email: string },
): { allowed: VisitDraft[]; skippedOther: VisitDraft[] } {
  if (isSuperAdmin(viewer)) return { allowed: drafts, skippedOther: [] };
  const email = viewer.email.trim().toLowerCase();
  const allowed: VisitDraft[] = [];
  const skippedOther: VisitDraft[] = [];
  for (const draft of drafts) {
    if (draft.salesEmail && draft.salesEmail.toLowerCase() === email) allowed.push(draft);
    else skippedOther.push(draft);
  }
  return { allowed, skippedOther };
}

export function planUpsert(existingIds: Iterable<string>, drafts: VisitDraft[]): { inserted: number; updated: number } {
  const existing = new Set(existingIds);
  let inserted = 0;
  let updated = 0;
  for (const draft of drafts) {
    if (existing.has(draft.externalId)) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated };
}

type HeaderIndex = Map<string, number>;

function mapVisitRow(
  cells: string[],
  columns: HeaderIndex,
  roster: RosterPerson[],
): { ok: true; draft: VisitDraft } | { ok: false; externalId: string | null; reason: string } {
  const externalId = cell(cells, columns, "reference number");
  if (!externalId) return { ok: false, externalId: null, reason: "Reference Number kosong." };
  const reportStatus = cell(cells, columns, "report status");
  if (reportStatus && reportStatus.toLowerCase() !== "submitted") {
    return { ok: false, externalId, reason: "Status laporan bukan Submitted." };
  }
  const submission = parseDateTime(cell(cells, columns, "submission time"));
  if (!submission.date) return { ok: false, externalId, reason: "Tanggal kunjungan tidak terbaca." };
  const person = matchSalesPerson(cell(cells, columns, "reporter"), cell(cells, columns, "employee id"), roster);
  if (!person) {
    const reporter = cell(cells, columns, "reporter") || "tanpa nama";
    const employeeId = cell(cells, columns, "employee id");
    const who = employeeId ? `${reporter} (${employeeId})` : reporter;
    return { ok: false, externalId, reason: `Reporter ${who} tidak cocok dengan Data Sales.` };
  }

  const location = splitLocation(cell(cells, columns, "lokasi"));
  const startTime = location.time ?? submission.time;
  const source = cell(cells, columns, "source");
  const visitPurpose = ALLOWED_SOURCES.has(source.toLowerCase()) ? source : null;
  const statusKunjungan = cell(cells, columns, "status kunjungan");
  const pipelineKey = statusKunjungan.toLowerCase();
  const pipelineStatus = Object.prototype.hasOwnProperty.call(PIPELINE_BY_STATUS, pipelineKey)
    ? PIPELINE_BY_STATUS[pipelineKey]
    : null;
  const followUp = parseDateOnly(cell(cells, columns, "next contact date"));
  const photos = extractUrls(cell(cells, columns, "foto"));
  const notes = composeNotes({
    externalId,
    reporter: cell(cells, columns, "reporter"),
    employeeId: cell(cells, columns, "employee id"),
    attendance: cell(cells, columns, "status absen"),
    visitStage: statusKunjungan,
    pic: cell(cells, columns, "nama pic"),
    authority: cell(cells, columns, "authority"),
    mobile: cell(cells, columns, "mobile no."),
    extraSource: visitPurpose ? "" : source,
  });

  return {
    ok: true,
    draft: {
      externalId,
      visitDate: submission.date,
      startTime,
      salesName: person.name,
      salesEmail: person.email ? person.email.toLowerCase() : null,
      customerName: emptyToNull(cell(cells, columns, "nama customer")),
      visitPurpose,
      visitStatus: "Terlaksana",
      activityResult: emptyToNull(cell(cells, columns, "hasil kunjungan")),
      pipelineStatus,
      notes,
      followUpDate: followUp,
      address: location.address,
      cityArea: location.address ? extractCity(location.address) : null,
      documentationUrl: photos.length > 0 ? photos.join("\n") : null,
    },
  };
}

function indexHeaders(header: string[]): HeaderIndex {
  const index = new Map<string, number>();
  header.forEach((value, position) => {
    const key = value.trim().toLowerCase();
    if (key && !index.has(key)) index.set(key, position);
  });
  return index;
}

function cell(cells: string[], columns: HeaderIndex, name: string): string {
  const position = columns.get(name);
  if (position === undefined) return "";
  return (cells[position] ?? "").trim();
}

function looksLikeVisit(header: string[]): boolean {
  const names = new Set(header.map((value) => value.trim().toLowerCase()));
  return names.has("reference number") && names.has("nama customer") && names.has("reporter");
}

function looksLikeTraining(header: string[]): boolean {
  return header.some((value) => value.trim().toLowerCase() === "judul pelatihan");
}

function isBlank(cells: string[]): boolean {
  return cells.every((value) => value.trim() === "");
}

export function parseDateTime(value: string): { date: string | null; time: string | null } {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?)?/);
  if (!match) return { date: null, time: null };
  const time = match[2] ? `${match[2]}:${match[3] ?? "00"}` : null;
  return { date: match[1], time };
}

function parseDateOnly(value: string): string | null {
  return parseDateTime(value).date;
}

export function splitLocation(value: string): { address: string | null; time: string | null } {
  const match = value.match(/(?:^|\n)\s*Get:\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?\s*$/i);
  if (!match || match.index === undefined) return { address: emptyToNull(value), time: null };
  const time = `${match[2]}:${match[3] ?? "00"}`;
  return { address: emptyToNull(value.slice(0, match.index)), time };
}

export function extractCity(address: string): string | null {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const provinceIndex = parts.findIndex((part) => /jawa timur|jawa tengah|jawa barat|dki jakarta|banten|bali/i.test(part));
  if (provinceIndex <= 0) return null;
  const city = parts[provinceIndex - 1].replace(/\b\d{5}\b/g, "").trim();
  return city || null;
}

export function extractUrls(value: string): string[] {
  if (!value.trim()) return [];
  return Array.from(value.matchAll(/https?:\/\/[^\s<>"']+/g), (match) => match[0].replace(/[),.;]+$/g, ""));
}

function composeNotes(input: {
  externalId: string;
  reporter: string;
  employeeId: string;
  attendance: string;
  visitStage: string;
  pic: string;
  authority: string;
  mobile: string;
  extraSource: string;
}): string | null {
  const lines = [
    `Ref: ${input.externalId}`,
    input.reporter ? `Reporter: ${plainText(input.reporter)}` : "",
    input.employeeId ? `Employee ID: ${plainText(input.employeeId)}` : "",
    input.attendance ? `Status Absen: ${plainText(input.attendance)}` : "",
    input.visitStage ? `Status Kunjungan: ${plainText(input.visitStage)}` : "",
    input.pic ? `PIC: ${plainText(input.pic)}` : "",
    input.authority ? `Authority: ${plainText(input.authority)}` : "",
    input.extraSource ? `Source: ${plainText(input.extraSource)}` : "",
    isMissingMobile(input.mobile) ? "" : `Mobile: ${plainText(input.mobile)}`,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

function isMissingMobile(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 || /^0+$/.test(digits);
}

function emptyToNull(value: string): string | null {
  const cleaned = plainText(value).trim();
  return cleaned ? cleaned : null;
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\u0000/g, "").trim();
}
