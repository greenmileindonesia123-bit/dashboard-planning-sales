import assert from "node:assert/strict";
import test from "node:test";
import { parseVisitSheets, planUpsert, rowsForViewer } from "./visit-import/map-file.ts";
import type { RosterPerson, SheetMatrix } from "./visit-import/types.ts";

const roster: RosterPerson[] = [
  { name: "Mariska", email: "gmi.salesjatim@gmail.com" },
  { name: "Marizka Etha", email: "greenmilesales1@gmail.com" },
  { name: "Lista", email: "greenmilesales2@gmail.com" },
  { name: "Diah Ayu", email: null },
];

const headers = [
  "Reference Number",
  "Report Title",
  "Submission Time",
  "Report Status",
  "Reporter",
  "Employee ID",
  "Department",
  "Status Absen",
  "Status Kunjungan",
  "Nama Customer",
  "Nama PIC",
  "Authority",
  "Source",
  "Foto",
  "Hasil Kunjungan",
  "Next Contact Date",
  "Mobile No.",
  "Lokasi",
];

function visitRow(values: Partial<Record<(typeof headers)[number], string>>): string[] {
  return headers.map((header) => values[header] ?? "");
}

const sampleVisit = visitRow({
  "Reference Number": "2026110700001",
  "Report Title": "Laporan Kunjungan Sales",
  "Submission Time": "2026-11-07 10:19:39",
  "Report Status": "Submitted",
  Reporter: "Marizka Etha Pramudityas",
  "Employee ID": "SL-2026017",
  "Status Absen": "In",
  "Status Kunjungan": "Prospect",
  "Nama Customer": "widi",
  "Nama PIC": "etha",
  Authority: "Owner",
  Source: "GMB",
  Foto: "https://cdn.example.test/a.png",
  "Hasil Kunjungan": "ukur kaca",
  "Next Contact Date": "2026-11-10",
  "Mobile No.": "089680668373",
  Lokasi: "Blok C5, Babat Jerawat, Kec. Pakal, Surabaya, Jawa Timur 60197, Indonesia\nGet: 2026-11-07 10:19:20",
});

test("Smart Salary visit rows map fields and ignore the training sheet", () => {
  const sheets: SheetMatrix[] = [
    {
      name: "TRAINING RECORD",
      rows: [
        ["Reference Number", "Judul Pelatihan"],
        ["2026103100005", "Creating Growth Salesman"],
      ],
    },
    { name: "LAPORAN KUNJUNGAN SALES", rows: [headers, sampleVisit] },
  ];
  const parsed = parseVisitSheets(sheets, roster);
  assert.equal(parsed.trainingRowsIgnored, 1);
  assert.equal(parsed.skipped.length, 0);
  assert.equal(parsed.drafts.length, 1);
  const draft = parsed.drafts[0];
  assert.equal(draft.externalId, "2026110700001");
  assert.equal(draft.visitDate, "2026-11-07");
  assert.equal(draft.startTime, "10:19:20");
  assert.equal(draft.salesName, "Marizka Etha");
  assert.equal(draft.salesEmail, "greenmilesales1@gmail.com");
  assert.equal(draft.customerName, "widi");
  assert.equal(draft.visitPurpose, "GMB");
  assert.equal(draft.visitStatus, "Terlaksana");
  assert.equal(draft.pipelineStatus, "Prospek");
  assert.equal(draft.activityResult, "ukur kaca");
  assert.equal(draft.followUpDate, "2026-11-10");
  assert.equal(draft.cityArea, "Surabaya");
  assert.equal(draft.address?.includes("Get:"), false);
  assert.equal(draft.documentationUrl, "https://cdn.example.test/a.png");
  assert.match(draft.notes ?? "", /Status Kunjungan: Prospect/);
  assert.match(draft.notes ?? "", /Mobile: 089680668373/);
});

test("Get timestamp is optional, mobile 0 is missing, and unknown reporters are skipped", () => {
  const purpose = visitRow({
    "Reference Number": "2026110400001",
    "Submission Time": "2026-11-04 15:52:42",
    "Report Status": "Submitted",
    Reporter: "Riyan Fenando",
    "Employee ID": "SL-2026019",
    "Status Kunjungan": "Purpose",
    "Nama Customer": "toko kaca",
    Source: "Canvassing",
    "Hasil Kunjungan": "canvasing",
    "Next Contact Date": "2026-11-06",
    "Mobile No.": "0",
    Lokasi: "Jl. Raya, Sidoarjo, Jawa Timur 61234, Indonesia",
  });
  const unknown = visitRow({
    "Reference Number": "2026110400002",
    "Submission Time": "2026-11-04 09:00:00",
    "Report Status": "Submitted",
    Reporter: "Orang Luar",
    "Employee ID": "SL-000",
    "Nama Customer": "x",
  });
  const parsed = parseVisitSheets([{ name: "LAPORAN KUNJUNGAN SALES", rows: [headers, purpose, unknown] }], roster);
  assert.equal(parsed.drafts.length, 1);
  assert.equal(parsed.drafts[0].startTime, "15:52:42");
  assert.equal(parsed.drafts[0].pipelineStatus, null);
  assert.equal(parsed.drafts[0].salesName, "Lista");
  assert.equal(parsed.drafts[0].cityArea, "Sidoarjo");
  assert.equal((parsed.drafts[0].notes ?? "").includes("Mobile:"), false);
  assert.match(parsed.drafts[0].notes ?? "", /Status Kunjungan: Purpose/);
  assert.equal(parsed.skipped[0].externalId, "2026110400002");
  assert.match(parsed.skipped[0].reason, /tidak cocok/);
});

test("re-upload plans updates by external id, and only Super Admin keeps other people's rows", () => {
  const parsed = parseVisitSheets(
    [
      {
        name: "LAPORAN KUNJUNGAN SALES",
        rows: [
          headers,
          sampleVisit,
          visitRow({
            "Reference Number": "2026110800009",
            "Submission Time": "2026-11-08 08:00:00",
            "Report Status": "Submitted",
            Reporter: "Riyan Fenando",
            "Employee ID": "SL-2026019",
            "Nama Customer": "baru",
          }),
        ],
      },
    ],
    roster,
  );
  assert.deepEqual(planUpsert(["2026110700001"], parsed.drafts), { inserted: 1, updated: 1 });
  const sales = rowsForViewer(parsed.drafts, { email: "greenmilesales1@gmail.com" });
  assert.deepEqual(sales.allowed.map((row) => row.externalId), ["2026110700001"]);
  assert.deepEqual(sales.skippedOther.map((row) => row.externalId), ["2026110800009"]);
  const ppic = rowsForViewer(parsed.drafts, { email: "estimatorgreenmileindonesia@gmail.com" });
  assert.deepEqual(ppic.allowed.map((row) => row.externalId), []);
  assert.equal(ppic.skippedOther.length, 2);
  const admin = rowsForViewer(parsed.drafts, { email: "operasionalgreenmileindonesia@gmail.com" });
  assert.equal(admin.allowed.length, 2);
  assert.equal(admin.skippedOther.length, 0);
});
