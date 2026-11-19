import assert from "node:assert/strict";
import test from "node:test";
import {
  belongsTo,
  comparePeople,
  compareTotals,
  delta,
  emptySnapshot,
  summarize,
  unmatchedVisitCount,
} from "./metrics.ts";
import type { VisitMetricInput } from "./metrics.ts";

const people = [
  { name: "Ling Ling", email: "sales002.gmi@gmail.com" },
  { name: "Diah Ayu", email: null },
];

function visit(partial: Partial<VisitMetricInput> & Pick<VisitMetricInput, "visitDate" | "salesName">): VisitMetricInput {
  return {
    salesEmail: null,
    visitStatus: null,
    activityResult: null,
    potentialValue: 0,
    orderValue: 0,
    pipelineStatus: null,
    ...partial,
  };
}

test("empty visits summarize to zeros", () => {
  assert.deepEqual(summarize([]), emptySnapshot());
  const totals = compareTotals([], { start: "2026-11-01", end: "2026-11-30" }, { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(totals.current, emptySnapshot());
  assert.deepEqual(totals.previous, emptySnapshot());
});

test("pipeline counts only Prospek and Negosiasi", () => {
  const rows = [
    visit({
      visitDate: "2026-11-02",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      pipelineStatus: "Prospek",
      visitStatus: "Terlaksana",
      activityResult: "Deal",
      potentialValue: 1000,
      orderValue: 250,
    }),
    visit({
      visitDate: "2026-11-03",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      pipelineStatus: "Negosiasi",
    }),
    visit({
      visitDate: "2026-11-04",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      pipelineStatus: "Lost",
    }),
    visit({
      visitDate: "2026-11-05",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      pipelineStatus: "Deal",
    }),
  ];
  const snapshot = summarize(rows);
  assert.equal(snapshot.visits, 4);
  assert.equal(snapshot.pipeline, 2);
  assert.equal(snapshot.completed, 1);
  assert.equal(snapshot.deals, 1);
  assert.equal(snapshot.potential, 1000);
  assert.equal(snapshot.order, 250);
});

test("email match wins over a shared display name", () => {
  const row = visit({
    visitDate: "2026-11-02",
    salesName: "Ling Ling",
    salesEmail: "someoneelse@gmail.com",
  });
  assert.equal(belongsTo(row, people[0]), false);
  assert.equal(belongsTo(row, { name: "Ling Ling", email: "someoneelse@gmail.com" }), true);
});

test("a roster row without email only matches nameless-email visits", () => {
  const named = visit({ visitDate: "2026-11-02", salesName: "Diah Ayu" });
  const emailed = visit({
    visitDate: "2026-11-02",
    salesName: "Diah Ayu",
    salesEmail: "sales002.gmi@gmail.com",
  });
  assert.equal(belongsTo(named, people[1]), true);
  assert.equal(belongsTo(emailed, people[1]), false);
  assert.equal(belongsTo(emailed, people[0]), true);
});

test("per-person comparison keeps a zero row when that person has no visits", () => {
  const rows = [
    visit({
      visitDate: "2026-10-15",
      salesName: "Ling Ling",
      salesEmail: "sales002.gmi@gmail.com",
      orderValue: 10,
    }),
  ];
  const compared = comparePeople(
    people,
    rows,
    { start: "2026-11-01", end: "2026-11-30" },
    { start: "2026-10-01", end: "2026-10-31" },
  );
  assert.equal(compared[0].current.visits, 0);
  assert.equal(compared[0].previous.order, 10);
  assert.equal(compared[1].current.visits, 0);
  assert.equal(compared[1].previous.visits, 0);
  assert.equal(unmatchedVisitCount(rows, people), 0);
});

test("percent delta is withheld when last month is zero", () => {
  assert.deepEqual(delta(0, 0), { absolute: 0, percent: null });
  assert.deepEqual(delta(3, 0), { absolute: 3, percent: null });
  assert.deepEqual(delta(3, 2), { absolute: 1, percent: 50 });
});
