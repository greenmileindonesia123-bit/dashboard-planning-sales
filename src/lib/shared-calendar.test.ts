import assert from "node:assert/strict";
import test from "node:test";
import { expansionWindow, parseIcsCalendar } from "./calendar-ics.ts";
import {
  diffSharedCalendarEvents,
  formatSharedCalendarPullMessage,
  mapSharedCalendarOwner,
  sharedCalendarIcsUrl,
  SHARED_CALENDAR_ID,
  toSharedCalendarIncoming,
  type SharedCalendarExisting,
  type SharedCalendarIncoming,
  type SharedCalendarRosterPerson,
} from "./shared-calendar.ts";

const roster: SharedCalendarRosterPerson[] = [
  { id: "lista", name: "Lista", email: "lista@greenmile.test" },
  { id: "etha", name: "Marizka Etha", email: "etha@greenmile.test" },
  { id: "diah", name: "Diah Ayu", email: null },
  { id: "peter", name: "Peter Ang", email: "peter@greenmile.test" },
];

const window = {
  start: new Date("2026-11-01T00:00:00.000Z"),
  end: new Date("2026-12-01T00:00:00.000Z"),
};

function incoming(partial: Partial<SharedCalendarIncoming> & Pick<SharedCalendarIncoming, "googleEventId">): SharedCalendarIncoming {
  return {
    title: partial.title ?? "Kunjungan",
    startsAt: partial.startsAt ?? "2026-11-09T02:00:00.000Z",
    endsAt: partial.endsAt ?? "2026-11-09T03:00:00.000Z",
    allDay: partial.allDay ?? false,
    location: partial.location ?? null,
    htmlLink: partial.htmlLink ?? null,
    status: partial.status ?? "confirmed",
    salesProfileId: partial.salesProfileId === undefined ? "lista" : partial.salesProfileId,
    salesEmail: partial.salesEmail === undefined ? "lista@greenmile.test" : partial.salesEmail,
    googleEventId: partial.googleEventId,
  };
}

function existing(partial: Partial<SharedCalendarExisting> & Pick<SharedCalendarExisting, "id" | "googleEventId">): SharedCalendarExisting {
  return { ...incoming(partial), id: partial.id };
}

test("the public feed url encodes the calendar id and accepts an https override", () => {
  const fallback = sharedCalendarIcsUrl(undefined);
  assert.equal(
    fallback,
    `https://calendar.google.com/calendar/ical/${encodeURIComponent(SHARED_CALENDAR_ID)}/public/basic.ics`,
  );
  assert.match(fallback ?? "", /%40group\.calendar\.google\.com/);
  assert.equal(sharedCalendarIcsUrl("  "), fallback);
  assert.equal(sharedCalendarIcsUrl("  https://example.com/cal.ics  "), "https://example.com/cal.ics");
  assert.equal(sharedCalendarIcsUrl("http://example.com/cal.ics"), null);
  assert.equal(sharedCalendarIcsUrl("not a url"), null);
});

test("email, then title, then description map a shared event onto Data Sales", () => {
  const base = { description: null, organizerEmail: null, attendeeEmails: [] as string[] };

  assert.equal(
    mapSharedCalendarOwner(
      { ...base, title: "Tamu lain - gudang", organizerEmail: "ETHA@greenmile.test", attendeeEmails: ["lista@greenmile.test"] },
      roster,
    )?.id,
    "etha",
  );
  assert.equal(
    mapSharedCalendarOwner(
      { ...base, title: "Tanpa nama", organizerEmail: "unknown@example.com", attendeeEmails: ["lista@greenmile.test", "lista@greenmile.test"] },
      roster,
    )?.id,
    "lista",
  );
  assert.equal(
    mapSharedCalendarOwner(
      {
        ...base,
        title: "Etha - Cek stok",
        organizerEmail: "unknown@example.com",
        attendeeEmails: ["lista@greenmile.test", "peter@greenmile.test"],
      },
      roster,
    )?.id,
    "etha",
  );
  assert.equal(mapSharedCalendarOwner({ ...base, title: "Riyan - Cek stok" }, roster)?.name, "Lista");
  assert.equal(mapSharedCalendarOwner({ ...base, title: "[etha] Gudang" }, roster)?.name, "Marizka Etha");
  assert.equal(mapSharedCalendarOwner({ ...base, title: "  [Dya Ayu] follow up" }, roster)?.id, "diah");
  assert.equal(
    mapSharedCalendarOwner({ ...base, title: "Kunjungan - Lista", description: "Catatan\nSales: Riyan" }, roster)?.name,
    "Lista",
  );
  assert.equal(
    mapSharedCalendarOwner({ ...base, title: "[Bukan sales] kunjungan", description: "Sales: Dya Ayu - catatan tambahan" }, roster)?.id,
    "diah",
  );
  assert.equal(mapSharedCalendarOwner({ ...base, title: "Lista-kunjungan" }, roster), null);
  assert.equal(mapSharedCalendarOwner({ ...base, title: "Diah Ayu - kunjungan" }, roster)?.email, null);
  assert.equal(
    mapSharedCalendarOwner(
      { ...base, title: "Umum", description: "sales: bukan siapa\nSales: Peter" },
      roster,
    )?.name,
    "Peter Ang",
  );
});

test("parsed public ICS fields are what the mapper reads", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:map-me
SUMMARY:Riyan - Cek stok
DESCRIPTION:Catatan\\nSales: Etha
DTSTART:20261109T020000Z
DTEND:20261109T030000Z
ORGANIZER:mailto:someone@example.com
ATTENDEE;CN=Lista:mailto:lista@greenmile.test
END:VEVENT
BEGIN:VEVENT
UID:weekly-map
SUMMARY:Rutin
DESCRIPTION:Sales: Lista
DTSTART:20261102T020000Z
DTEND:20261102T030000Z
RRULE:FREQ=WEEKLY;COUNT=2
ORGANIZER:mailto:puput@greenmile.test
ATTENDEE:mailto:lista@greenmile.test
END:VEVENT
END:VCALENDAR`;
  const parsed = parseIcsCalendar(ics, expansionWindow({ year: 2026, month: 11, day: 9 }));
  const single = parsed.events.find((event) => event.googleEventId === "map-me");
  assert.equal(single?.organizerEmail, "someone@example.com");
  assert.deepEqual(single?.attendeeEmails, ["lista@greenmile.test"]);
  assert.match(single?.description ?? "", /Sales: Etha/);
  assert.equal(mapSharedCalendarOwner(single!, roster)?.id, "lista");

  const weekly = parsed.events.filter((event) => event.googleEventId.startsWith("weekly-map::"));
  assert.equal(weekly.length, 2);
  assert.equal(weekly[0]?.organizerEmail, "puput@greenmile.test");
  assert.deepEqual(weekly[0]?.attendeeEmails, ["lista@greenmile.test"]);
  assert.match(weekly[0]?.description ?? "", /Sales: Lista/);
  assert.equal(mapSharedCalendarOwner(weekly[0]!, roster)?.id, "lista");
});

test("upsert diff inserts, updates, and deletes by UID inside the feed window", () => {
  const kept = incoming({ googleEventId: "same", title: "Lista - sama" });
  const changed = incoming({ googleEventId: "edit", title: "Lista - baru" });
  const added = incoming({ googleEventId: "new", title: "Etha - baru", salesProfileId: "etha", salesEmail: "etha@greenmile.test" });
  const unmapped = incoming({ googleEventId: "none", title: "Tanpa pemilik", salesProfileId: null, salesEmail: null });
  const duplicateIncoming = incoming({ googleEventId: "new", title: "Etha - judul terakhir", salesProfileId: "etha", salesEmail: "etha@greenmile.test" });

  const diff = diffSharedCalendarEvents(
    [kept, changed, added, unmapped, duplicateIncoming],
    [
      existing({ id: "row-same", ...kept, startsAt: "2026-11-09T02:00:00+00:00" }),
      existing({ id: "row-edit", ...changed, title: "Lista - lama" }),
      existing({ id: "row-edit-copy", googleEventId: "edit", title: "salinan" }),
      existing({ id: "row-gone", googleEventId: "gone", title: "hilang" }),
      existing({
        id: "row-outside",
        googleEventId: "outside",
        title: "di luar",
        startsAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-10-01T01:00:00.000Z",
      }),
      existing({
        id: "row-edge",
        googleEventId: "edge",
        startsAt: "2026-10-31T22:00:00.000Z",
        endsAt: "2026-11-01T00:00:00.000Z",
      }),
    ],
    window,
  );

  assert.deepEqual(diff.inserts.map((event) => event.googleEventId), ["new", "none"]);
  assert.equal(diff.inserts.find((event) => event.googleEventId === "new")?.title, "Etha - judul terakhir");
  assert.deepEqual(diff.updates.map((event) => event.googleEventId), ["edit"]);
  assert.deepEqual(diff.deleteIds.sort(), ["row-edit-copy", "row-gone"].sort());
  assert.equal(diff.summary.pulled, 4);
  assert.equal(diff.summary.inserted, 2);
  assert.equal(diff.summary.updated, 1);
  assert.equal(diff.summary.deleted, 2);
  assert.equal(diff.summary.unmapped, 1);
  assert.equal(
    formatSharedCalendarPullMessage(diff.summary),
    "4 acara ditarik, 2 baru, 1 diperbarui, 2 dihapus, 1 belum dipetakan.",
  );
});

test("a second pull of the same UID updates the owner in place and does not insert", () => {
  const first = incoming({ googleEventId: "uid-1", title: "Lista - kunjungan", salesProfileId: "lista", salesEmail: "lista@greenmile.test" });
  const stored = existing({ id: "row-1", ...first });
  const again = diffSharedCalendarEvents([first], [stored], window);
  assert.equal(again.inserts.length, 0);
  assert.equal(again.updates.length, 0);
  assert.equal(again.deleteIds.length, 0);

  const reassigned = incoming({
    googleEventId: "uid-1",
    title: "Etha - kunjungan",
    salesProfileId: "etha",
    salesEmail: "etha@greenmile.test",
  });
  const moved = diffSharedCalendarEvents([reassigned], [stored], window);
  assert.equal(moved.inserts.length, 0);
  assert.equal(moved.updates.length, 1);
  assert.equal(moved.deleteIds.length, 0);
  assert.equal(moved.summary.pulled, 1);
});

test("an event that moves into the window is updated, and incomplete feeds do not delete", () => {
  const moved = incoming({
    googleEventId: "moved",
    startsAt: "2026-11-12T02:00:00.000Z",
    endsAt: "2026-11-12T03:00:00.000Z",
  });
  const previous = existing({
    id: "row-moved",
    ...moved,
    startsAt: "2026-10-02T02:00:00.000Z",
    endsAt: "2026-10-02T03:00:00.000Z",
  });
  const stillThere = existing({ id: "row-keep", googleEventId: "keep" });
  const diff = diffSharedCalendarEvents([moved], [previous, stillThere], window, { removeMissing: false });
  assert.deepEqual(diff.updates.map((event) => event.googleEventId), ["moved"]);
  assert.deepEqual(diff.deleteIds, []);
  assert.match(formatSharedCalendarPullMessage(diff.summary, { keptMissing: true, unreadable: 1 }), /1 acara tidak dapat dibaca/);
  assert.match(formatSharedCalendarPullMessage(diff.summary, { keptMissing: true }), /tidak dihapus/);
});

test("toSharedCalendarIncoming stores the profile id and a lowercase email", () => {
  const row = toSharedCalendarIncoming(
    {
      googleEventId: "uid",
      title: "  Etha - judul  ",
      startsAt: "2026-11-09T02:00:00.000Z",
      endsAt: "2026-11-09T03:00:00.000Z",
      allDay: false,
      location: "  Gudang  ",
      htmlLink: null,
      status: "confirmed",
    },
    roster[1],
  );
  assert.equal(row.salesProfileId, "etha");
  assert.equal(row.salesEmail, "etha@greenmile.test");
  assert.equal(row.location, "Gudang");
  const unmapped = toSharedCalendarIncoming(
    { ...row, title: "Umum" },
    null,
  );
  assert.equal(unmapped.salesProfileId, null);
  assert.equal(unmapped.salesEmail, null);
});
