import assert from "node:assert/strict";
import test from "node:test";
import { classifyFollowUp, followUpsForViewer, groupFollowUps, type FollowUp } from "./follow-ups.ts";

const today = "2026-11-08";

function row(partial: Partial<FollowUp> & Pick<FollowUp, "followUpDate" | "salesName">): FollowUp {
  return {
    customerName: partial.customerName ?? null,
    salesEmail: partial.salesEmail ?? null,
    visitDate: partial.visitDate ?? "2026-11-01",
    visitPurpose: partial.visitPurpose ?? null,
    visitStatus: partial.visitStatus ?? null,
    activityResult: partial.activityResult ?? null,
    notes: partial.notes ?? null,
    cityArea: partial.cityArea ?? null,
    ...partial,
  };
}

test("follow-up dates group around Jakarta today, with 14 days upcoming", () => {
  assert.equal(classifyFollowUp("2026-11-07", today), "terlambat");
  assert.equal(classifyFollowUp("2026-11-08", today), "hari-ini");
  assert.equal(classifyFollowUp("2026-11-22", today), "mendatang");
  assert.equal(classifyFollowUp("2026-11-23", today), "nanti");
  const groups = groupFollowUps(
    [
      row({ followUpDate: "2026-11-23", salesName: "Lista", customerName: "Nanti" }),
      row({ followUpDate: "2026-11-08", salesName: "Lista", customerName: "Hari ini" }),
      row({ followUpDate: "2026-11-01", salesName: "Lista", customerName: "Paling lama" }),
      row({ followUpDate: "2026-11-05", salesName: "Lista", customerName: "Lebih baru" }),
      row({ followUpDate: "2026-11-22", salesName: "Lista", customerName: "Dua minggu" }),
    ],
    today,
  );
  assert.deepEqual(
    groups.terlambat.map((item) => item.customerName),
    ["Paling lama", "Lebih baru"],
  );
  assert.deepEqual(
    groups["hari-ini"].map((item) => item.customerName),
    ["Hari ini"],
  );
  assert.deepEqual(
    groups.mendatang.map((item) => item.customerName),
    ["Dua minggu"],
  );
  assert.deepEqual(
    groups.nanti.map((item) => item.customerName),
    ["Nanti"],
  );
});

test("sales and non-admin PPIC see only their follow-ups, and Super Admin can filter", () => {
  const rows = [
    row({
      followUpDate: "2026-11-09",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      customerName: "Ling",
    }),
    row({
      followUpDate: "2026-11-10",
      salesName: "Lista",
      salesEmail: "greenmilesales2@gmail.com",
      customerName: "Riyan",
    }),
    row({
      followUpDate: "2026-11-11",
      salesName: "Diah Ayu",
      customerName: "Dya",
    }),
    row({ followUpDate: "   ", salesName: "Ling Ling", salesEmail: "sales002.gmi@gmail.com" }),
  ];
  const sales = followUpsForViewer(rows, {
    superAdmin: false,
    viewer: { name: "Ling Ling", email: "sales002.gmi@gmail.com" },
    selected: { name: "Lista", email: "greenmilesales2@gmail.com" },
  });
  assert.deepEqual(sales.map((item) => item.customerName), ["Ling"]);
  const ppic = followUpsForViewer(rows, {
    superAdmin: false,
    viewer: { name: "Ilya", email: "estimatorgreenmileindonesia@gmail.com" },
    selected: null,
  });
  assert.deepEqual(ppic, []);
  const all = followUpsForViewer(rows, {
    superAdmin: true,
    viewer: { name: "Puput", email: "operasionalgreenmileindonesia@gmail.com" },
    selected: null,
  });
  assert.deepEqual(all.map((item) => item.customerName), ["Ling", "Riyan", "Dya"]);
  const dya = followUpsForViewer(rows, {
    superAdmin: true,
    viewer: { name: "Puput", email: "operasionalgreenmileindonesia@gmail.com" },
    selected: { name: "Diah Ayu", email: null },
  });
  assert.deepEqual(dya.map((item) => item.customerName), ["Dya"]);
});
