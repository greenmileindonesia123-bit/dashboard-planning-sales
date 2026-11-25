import assert from "node:assert/strict";
import test from "node:test";
import { expansionWindow, parseIcsCalendar } from "./calendar-ics.ts";
import { calendarOwnerEmail, preselectSalesEmail } from "./calendar-owner.ts";

const window = expansionWindow({ year: 2026, month: 11, day: 9 });

test("the expansion window covers two months before through six months after", () => {
  assert.equal(window.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(window.end.toISOString(), "2027-05-31T17:00:00.000Z");
});

test("a UTC event, an all-day date, and a cancelled weekly instance are parsed", () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Asia/Jakarta
BEGIN:STANDARD
TZOFFSETFROM:+0700
TZOFFSETTO:+0700
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:once
SUMMARY:Ukur kaca
DTSTART:20261109T020000Z
DTEND:20261109T030000Z
LOCATION:Gudang
URL:https://calendar.google.com/calendar/event?eid=once
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:day
SUMMARY:Seharian
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
END:VEVENT
BEGIN:VEVENT
UID:weekly
SUMMARY:Rutin
DTSTART;TZID=Asia/Jakarta:20261102T090000
DTEND;TZID=Asia/Jakarta:20261102T100000
RRULE:FREQ=WEEKLY;COUNT=3
EXDATE;TZID=Asia/Jakarta:20261109T090000
END:VEVENT
BEGIN:VEVENT
UID:weekly
RECURRENCE-ID;TZID=Asia/Jakarta:20261116T090000
SUMMARY:<b>Dipindah</b>
DTSTART;TZID=Asia/Jakarta:20261116T110000
DTEND;TZID=Asia/Jakarta:20261116T120000
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;
  const parsed = parseIcsCalendar(ics, window);
  const once = parsed.events.find((event) => event.googleEventId === "once");
  const day = parsed.events.find((event) => event.googleEventId === "day");
  const weekly = parsed.events.filter((event) => event.googleEventId.startsWith("weekly::"));
  assert.equal(once?.description, null);
  assert.equal(once?.organizerEmail, null);
  assert.deepEqual(once?.attendeeEmails, []);
  assert.equal(once?.startsAt, "2026-11-09T02:00:00.000Z");
  assert.equal(once?.htmlLink?.startsWith("https://calendar.google.com/"), true);
  assert.equal(once?.location, "Gudang");
  assert.equal(day?.allDay, true);
  assert.equal(day?.startsAt, "2026-11-09T17:00:00.000Z");
  assert.equal(day?.endsAt, "2026-11-10T17:00:00.000Z");
  assert.equal(weekly.some((event) => event.startsAt === "2026-11-09T02:00:00.000Z"), false);
  const cancelled = weekly.find((event) => event.status === "cancelled");
  assert.equal(cancelled?.title, "Dipindah");
  assert.match(cancelled?.googleEventId ?? "", /^weekly::/);
  assert.equal(weekly.filter((event) => event.status === "confirmed").length, 1);
});

test("filename email is preselected only on the roster, and only Super Admin chooses another owner", () => {
  const emails = ["greenmilesales1@gmail.com", "greenmilesales2@gmail.com"];
  assert.equal(preselectSalesEmail("hennyweng99@yahoo.com.ics", emails), null);
  assert.equal(preselectSalesEmail("GreenMileSales2@gmail.com.ics", emails), "greenmilesales2@gmail.com");
  assert.equal(
    calendarOwnerEmail({ email: "greenmilesales1@gmail.com" }, "greenmilesales2@gmail.com"),
    "greenmilesales1@gmail.com",
  );
  assert.equal(
    calendarOwnerEmail({ email: "estimatorgreenmileindonesia@gmail.com" }, "greenmilesales2@gmail.com"),
    "estimatorgreenmileindonesia@gmail.com",
  );
  assert.equal(
    calendarOwnerEmail({ email: "operasionalgreenmileindonesia@gmail.com" }, "greenmilesales2@gmail.com"),
    "greenmilesales2@gmail.com",
  );
  assert.equal(calendarOwnerEmail({ email: "operasionalgreenmileindonesia@gmail.com" }, null), null);
});
