import assert from "node:assert/strict";
import test from "node:test";
import {
  civilDateInJakarta,
  monthRange,
  periodRange,
  previousMonthRange,
  toISODate,
  weekDays,
} from "./jakarta.ts";

test("Jakarta date rolls over at 17:00 UTC", () => {
  const before = civilDateInJakarta(new Date("2026-11-08T16:59:00.000Z"));
  const after = civilDateInJakarta(new Date("2026-11-08T17:00:00.000Z"));
  assert.equal(toISODate(before), "2026-11-08");
  assert.equal(toISODate(after), "2026-11-09");
});

test("week containing Sunday 8 Nov 2026 starts Monday 2 Nov", () => {
  const today = { year: 2026, month: 11, day: 8 };
  const days = weekDays(today).map(toISODate);
  assert.deepEqual(days, [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ]);
  assert.deepEqual(periodRange("minggu", today), {
    start: "2026-11-02",
    end: "2026-11-08",
  });
});

test("November 2026 compares with the full previous calendar month", () => {
  const today = { year: 2026, month: 11, day: 8 };
  assert.deepEqual(monthRange(today), { start: "2026-11-01", end: "2026-11-30" });
  assert.deepEqual(previousMonthRange(today), {
    start: "2026-10-01",
    end: "2026-10-31",
  });
});

test("January compares with December of the previous year", () => {
  const today = { year: 2026, month: 1, day: 3 };
  assert.deepEqual(previousMonthRange(today), {
    start: "2025-12-01",
    end: "2025-12-31",
  });
  assert.deepEqual(periodRange("tahun", today), {
    start: "2026-01-01",
    end: "2026-12-31",
  });
  assert.deepEqual(periodRange("hari", today), {
    start: "2026-01-03",
    end: "2026-01-03",
  });
});
