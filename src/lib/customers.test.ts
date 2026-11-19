import assert from "node:assert/strict";
import test from "node:test";
import { eventsForSchedule } from "./calendar.ts";
import { buildCustomers, contactFromNotes, customerKeyFromSlug, normalizeCustomerName } from "./customers.ts";
import { followUpScheduleEvents } from "./follow-up-events.ts";
import { eventOverlapsCivilDay } from "./calendar.ts";

test("customer names normalize spacing and case, and the frequent spelling is shown", () => {
  assert.equal(normalizeCustomerName("  PT  Abadi  "), "pt abadi");
  const rows = buildCustomers(
    [
      visit("1", "2026-11-01", "PT Abadi", "sales002.gmi@gmail.com", "Ling Ling"),
      visit("2", "2026-11-02", "PT Abadi", "sales002.gmi@gmail.com", "Ling Ling"),
      visit("3", "2026-10-01", "PT ABADI", "greenmilesales2@gmail.com", "Riyan"),
    ],
    [],
    { superAdmin: true, viewerEmail: "operasionalgreenmileindonesia@gmail.com" },
    "2026-11-09",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "PT Abadi");
  assert.equal(rows[0]?.visitCount, 3);
  assert.equal(customerKeyFromSlug(rows[0]!.slug), "pt abadi");
});

test("deal totals count unique non-cancelled SO and sales only see their customers", () => {
  const orders = [
    order("SO-1", "2026-11-01", "Toko A", 1000, "Completed", 1, "sales002.gmi@gmail.com"),
    order("SO-2", "2026-11-03", "Toko A", 500, "Cancelled", 2, "sales002.gmi@gmail.com"),
    order("SO-3", "2026-11-04", "Toko A", 250, "Draft", 0, "sales002.gmi@gmail.com"),
    order("SO-4", "2026-11-02", "Toko B", 900, "Completed", 1, "greenmilesales2@gmail.com"),
  ];
  const visits = [visit("1", "2026-11-01", "Toko A", "sales002.gmi@gmail.com", "Ling Ling", "2026-11-20", "Jl. Mawar\nPIC: Budi\nMobile: 0812")];
  const ling = buildCustomers(visits, orders, { superAdmin: false, viewerEmail: "sales002.gmi@gmail.com" }, "2026-11-09");
  assert.equal(ling.length, 1);
  assert.equal(ling[0]?.orderCount, 1);
  assert.equal(ling[0]?.dealTotal, 1000);
  assert.equal(ling[0]?.lastPurchase, "2026-11-01");
  assert.equal(ling[0]?.nextFollowUp, "2026-11-20");
  assert.equal(ling[0]?.pic, "Budi");
  assert.equal(ling[0]?.phone, "0812");
  assert.equal(ling[0]?.address, "Jl. Mawar");
  const admin = buildCustomers(visits, orders, { superAdmin: true, viewerEmail: "operasionalgreenmileindonesia@gmail.com" }, "2026-11-09");
  assert.equal(admin.length, 2);
  assert.deepEqual(contactFromNotes(null), { pic: null, phone: null });
});

test("follow-up dates become all-day planning events for the owning sales email", () => {
  const events = followUpScheduleEvents([
    { id: "v1", followUpDate: "2026-11-12", customerName: "Toko A", salesEmail: "Sales002.gmi@gmail.com" },
    { id: "v2", followUpDate: "2026-11-12", customerName: null, salesEmail: null },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.title, "Kunjungan ulang: Toko A");
  assert.equal(events[0]?.kind, "kunjungan-ulang");
  assert.equal(events[0]?.allDay, true);
  assert.equal(eventOverlapsCivilDay(events[0]!, { year: 2026, month: 11, day: 12 }), true);
  const own = eventsForSchedule(events, {
    superAdmin: false,
    viewerEmail: "greenmilesales2@gmail.com",
    selectedEmail: "greenmilesales2@gmail.com",
  });
  assert.equal(own.length, 0);
});

function visit(
  id: string,
  visitDate: string,
  customerName: string,
  salesEmail: string,
  salesName: string,
  followUpDate: string | null = null,
  notes: string | null = null,
) {
  return {
    id,
    visitDate,
    customerName,
    salesName,
    salesEmail,
    address: notes?.split("\n")[0] ?? null,
    notes,
    activityResult: "Follow Up Lagi",
    visitStatus: "Terlaksana",
    visitPurpose: "GMB",
    followUpDate,
  };
}

function order(
  soNumber: string,
  orderDate: string,
  customer: string,
  netTotal: number,
  status: string,
  docstatus: number,
  salesEmail: string,
) {
  return { soNumber, orderDate, customer, netTotal, status, docstatus, salesEmail, salesPersonRaw: "Ling Ling" };
}
