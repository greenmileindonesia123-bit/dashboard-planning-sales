import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { sheetsFromXlsx } from "./visit-import/read-workbook.ts";
import { dealNetTotal, parseSalesOrders, unmatchedDeals } from "./sales-order/parse.ts";
import { dealRoster, dealsForPerson, dealsInRange, summarizeDeals, visibleDeals, UNMAPPED_DEAL_NAME } from "./sales-order/metrics.ts";

const roster = [
  { name: "Ilya", email: "estimatorgreenmileindonesia@gmail.com" },
  { name: "Mariska", email: "gmi.salesjatim@gmail.com" },
  { name: "Marizka Etha", email: "greenmilesales1@gmail.com" },
  { name: "Peter Ang", email: "peter.angkawidjaja@gmail.com" },
  { name: "Puput", email: "operasionalgreenmileindonesia@gmail.com" },
  { name: "Lista", email: "greenmilesales2@gmail.com" },
  { name: "Dyah Kanthi", email: null },
  { name: "Diah Ayu", email: null },
];

const header = ["Sr", "Name", "Docstatus", "Quotation", "Customer", "Date", "Net Total", "Grand Total", "Status", "Source", "Sales Person", "Sales Order: Name", "Sales Order: Name"];

test("SO rows dedupe by number, map aliases, and keep unmatched names unmapped", () => {
  const parsed = parseSalesOrders(
    [
      header,
      row({ name: "SO-1", person: "Etha", net: "1000", status: "Completed", doc: "1" }),
      row({ name: "SO-1", person: "Etha", net: "1000", status: "Completed", doc: "1" }),
      row({ name: "SO-2", person: "Peter", net: "2000", status: "To Deliver", doc: "1" }),
      row({ name: "SO-3", person: "Mariska", net: "3000", status: "Closed", doc: "1" }),
      row({ name: "SO-4", person: "Putri", net: "4000", status: "Completed", doc: "1" }),
      row({ name: "SO-5", person: "Kanti", net: "5000", status: "Completed", doc: "1" }),
      row({ name: "SO-6", person: "Diah", net: "6000", status: "Completed", doc: "1" }),
      row({ name: "SO-7", person: "Puput", net: "700", status: "Cancelled", doc: "2" }),
      row({ name: "SO-8", person: "Riyan", net: "800", status: "Draft", doc: "0" }),
      row({ name: "SO-9", person: "Fajar", net: "900", status: "Cancelled", doc: "1" }),
    ],
    roster,
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.rowCount, 10);
  assert.equal(parsed.orders.length, 9);
  assert.equal(parsed.conflictCount, 0);
  const etha = parsed.orders.find((order) => order.soNumber === "SO-1");
  assert.equal(etha?.salesEmail, "greenmilesales1@gmail.com");
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-2")?.salesEmail, "peter.angkawidjaja@gmail.com");
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-3")?.salesEmail, "gmi.salesjatim@gmail.com");
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-4")?.salesEmail, null);
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-5")?.salesEmail, null);
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-6")?.salesEmail, null);
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-7")?.countsAsDeal, false);
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-8")?.countsAsDeal, false);
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-8")?.salesEmail, "greenmilesales2@gmail.com");
  assert.equal(parsed.orders.find((order) => order.soNumber === "SO-9")?.countsAsDeal, false);
  assert.equal(dealNetTotal(parsed.orders), 1000 + 2000 + 3000 + 4000 + 5000 + 6000);
  assert.deepEqual(
    unmatchedDeals(parsed.orders).map((item) => item.name),
    ["Diah", "Kanti", "Putri"],
  );
});

test("a disagreeing duplicate keeps the first row and counts one warning", () => {
  const parsed = parseSalesOrders(
    [
      header,
      row({ name: "SO-1", person: "Riyan", net: "1500", status: "Completed", doc: "1", customer: "Pelanggan A" }),
      row({ name: "SO-1", person: "Riyan", net: "9999", status: "Completed", doc: "1", customer: "Pelanggan B" }),
    ],
    roster,
  );
  assert.ok(!("error" in parsed));
  assert.equal(parsed.orders.length, 1);
  assert.equal(parsed.orders[0]?.netTotal, 1500);
  assert.equal(parsed.orders[0]?.customer, "Pelanggan A");
  assert.equal(parsed.conflictCount, 1);
});

test("Super Admin sees every deal, Ilya and Sales see only their own email", () => {
  const orders = [
    { orderDate: "2026-11-02", netTotal: 100, salesEmail: "greenmilesales2@gmail.com", countsAsDeal: true },
    { orderDate: "2026-11-03", netTotal: 50, salesEmail: "estimatorgreenmileindonesia@gmail.com", countsAsDeal: true },
    { orderDate: "2026-10-20", netTotal: 40, salesEmail: "estimatorgreenmileindonesia@gmail.com", countsAsDeal: true },
    { orderDate: "2026-11-04", netTotal: 80, salesEmail: null, countsAsDeal: true },
    { orderDate: "2026-11-05", netTotal: 70, salesEmail: "greenmilesales2@gmail.com", countsAsDeal: false },
  ];
  const admin = visibleDeals(orders, { superAdmin: true, viewerEmail: "operasionalgreenmileindonesia@gmail.com", selectedEmail: undefined });
  assert.equal(summarizeDeals(admin).netTotal, 100 + 50 + 40 + 80);
  const ilya = visibleDeals(orders, { superAdmin: false, viewerEmail: "estimatorgreenmileindonesia@gmail.com", selectedEmail: undefined });
  assert.deepEqual(ilya.map((order) => order.netTotal), [50, 40]);
  const sales = visibleDeals(orders, { superAdmin: false, viewerEmail: "greenmilesales2@gmail.com", selectedEmail: "estimatorgreenmileindonesia@gmail.com" });
  assert.deepEqual(sales.map((order) => order.netTotal), [100]);
  const november = dealsInRange(admin, { start: "2026-11-01", end: "2026-11-30" });
  assert.equal(summarizeDeals(november).count, 3);
  const people = dealRoster(roster, {
    superAdmin: true,
    viewer: { name: "Puput", email: "operasionalgreenmileindonesia@gmail.com" },
    selected: null,
  });
  const unmapped = people.find((person) => person.unmapped);
  assert.equal(unmapped?.name, UNMAPPED_DEAL_NAME);
  assert.equal(summarizeDeals(dealsForPerson(november, unmapped!)).netTotal, 80);
  const ilyaPeople = dealRoster(roster, {
    superAdmin: false,
    viewer: { name: "Ilya", email: "estimatorgreenmileindonesia@gmail.com" },
    selected: null,
  });
  assert.equal(ilyaPeople.length, 1);
  assert.equal(ilyaPeople.some((person) => person.unmapped), false);
});

test("an anonymized workbook uses Net Total from the Sales Order sheet", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Order");
  sheet.addRow(header);
  sheet.addRow(row({ name: "SO-A", person: "etha", net: "1250.5", status: "Completed", doc: "1", customer: "Pelanggan Anonim" }));
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const sheets = await sheetsFromXlsx(bytes);
  const parsed = parseSalesOrders(sheets[0]?.rows ?? [], roster);
  assert.ok(!("error" in parsed));
  assert.equal(parsed.orders[0]?.salesEmail, "greenmilesales1@gmail.com");
  assert.equal(parsed.orders[0]?.netTotal, 1250.5);
  assert.equal(parsed.orders[0]?.countsAsDeal, true);
});

function row(input: { name: string; person: string; net: string; status: string; doc: string; customer?: string }): string[] {
  return [
    "1",
    input.name,
    input.doc,
    "QTN-1",
    input.customer ?? "Pelanggan A",
    "2026-11-02",
    input.net,
    "999",
    input.status,
    "GMB",
    input.person,
    "child-a",
    "child-b",
  ];
}
