import assert from "node:assert/strict";
import test from "node:test";
import {
  eventOverlapsCivilDay,
  eventsForSchedule,
  jakartaDayBounds,
  jakartaHour,
  safeEventLink,
  visiblePlanBounds,
  type ScheduleEvent,
} from "./calendar.ts";

function event(partial: Partial<ScheduleEvent> & Pick<ScheduleEvent, "salesEmail" | "startsAt" | "endsAt">): ScheduleEvent {
  return {
    googleEventId: partial.googleEventId ?? "evt",
    title: partial.title ?? "Kunjungan",
    allDay: partial.allDay ?? false,
    location: partial.location ?? null,
    htmlLink: partial.htmlLink ?? null,
    status: partial.status ?? "confirmed",
    ...partial,
  };
}

test("Jakarta midnight is 17:00 UTC the previous day", () => {
  const bounds = jakartaDayBounds({ year: 2026, month: 11, day: 8 });
  assert.equal(bounds.start.toISOString(), "2026-11-07T17:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-11-08T17:00:00.000Z");
});

test("an event is included only when it overlaps the Jakarta civil day", () => {
  const onDay = event({
    salesEmail: "sales002.gmi@gmail.com",
    startsAt: "2026-11-08T02:00:00.000Z",
    endsAt: "2026-11-08T03:00:00.000Z",
  });
  const previous = event({
    salesEmail: "sales002.gmi@gmail.com",
    startsAt: "2026-11-07T02:00:00.000Z",
    endsAt: "2026-11-07T03:00:00.000Z",
  });
  const endingAtMidnight = event({
    salesEmail: "sales002.gmi@gmail.com",
    startsAt: "2026-11-07T10:00:00.000Z",
    endsAt: "2026-11-07T17:00:00.000Z",
  });
  const day = { year: 2026, month: 11, day: 8 };
  assert.equal(eventOverlapsCivilDay(onDay, day), true);
  assert.equal(eventOverlapsCivilDay(previous, day), false);
  assert.equal(eventOverlapsCivilDay(endingAtMidnight, day), false);
  assert.equal(jakartaHour(onDay.startsAt), 9);
});

test("week and month bounds stay in Asia/Jakarta", () => {
  const today = { year: 2026, month: 11, day: 8 };
  const week = visiblePlanBounds("minggu", today);
  assert.equal(week.start.toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(week.end.toISOString(), "2026-11-08T17:00:00.000Z");
  const month = visiblePlanBounds("bulan", today);
  assert.ok(month.start < jakartaDayBounds({ year: 2026, month: 11, day: 1 }).end);
  assert.ok(month.end > jakartaDayBounds({ year: 2026, month: 11, day: 30 }).start);
});

test("sales and non-admin PPIC see only their events, and Super Admin can filter", () => {
  const rows = [
    event({
      salesEmail: "sales002.gmi@gmail.com",
      googleEventId: "a",
      startsAt: "2026-11-08T02:00:00.000Z",
      endsAt: "2026-11-08T03:00:00.000Z",
    }),
    event({
      salesEmail: "greenmilesales2@gmail.com",
      googleEventId: "b",
      startsAt: "2026-11-08T04:00:00.000Z",
      endsAt: "2026-11-08T05:00:00.000Z",
      status: "cancelled",
    }),
    event({
      salesEmail: "greenmilesales2@gmail.com",
      googleEventId: "c",
      startsAt: "2026-11-08T05:00:00.000Z",
      endsAt: "2026-11-08T06:00:00.000Z",
    }),
  ];
  const sales = eventsForSchedule(rows, {
    superAdmin: false,
    viewerEmail: "sales002.gmi@gmail.com",
    selectedEmail: "greenmilesales2@gmail.com",
  });
  assert.deepEqual(sales.map((item) => item.googleEventId), ["a"]);
  const ppic = eventsForSchedule(rows, {
    superAdmin: false,
    viewerEmail: "estimatorgreenmileindonesia@gmail.com",
    selectedEmail: "all",
  });
  assert.deepEqual(ppic, []);
  const all = eventsForSchedule(rows, {
    superAdmin: true,
    viewerEmail: "operasionalgreenmileindonesia@gmail.com",
    selectedEmail: "all",
  });
  assert.deepEqual(all.map((item) => item.googleEventId), ["a", "c"]);
  const one = eventsForSchedule(rows, {
    superAdmin: true,
    viewerEmail: "operasionalgreenmileindonesia@gmail.com",
    selectedEmail: "greenmilesales2@gmail.com",
  });
  assert.deepEqual(one.map((item) => item.googleEventId), ["c"]);
  const noEmail = eventsForSchedule(rows, {
    superAdmin: true,
    viewerEmail: "operasionalgreenmileindonesia@gmail.com",
    selectedEmail: null,
  });
  assert.deepEqual(noEmail, []);
});

test("only http links are rendered for a calendar event", () => {
  assert.equal(safeEventLink("https://www.google.com/calendar/event?eid=abc"), "https://www.google.com/calendar/event?eid=abc");
  assert.equal(safeEventLink("javascript:alert(1)"), null);
  assert.equal(safeEventLink(null), null);
});
