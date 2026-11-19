import assert from "node:assert/strict";
import test from "node:test";
import { activeSyncRequest, normalizeRequesterEmail, type SyncRequestSnapshot } from "./calendar-sync.ts";

const now = new Date("2026-11-09T03:30:00.000Z");

function request(partial: Partial<SyncRequestSnapshot> & Pick<SyncRequestSnapshot, "status" | "requestedAt">): SyncRequestSnapshot {
  return {
    id: partial.id ?? "1",
    requestedBy: partial.requestedBy ?? "sales002.gmi@gmail.com",
    ...partial,
  };
}

test("a fresh pending sync blocks another request, an old or finished one does not", () => {
  const recent = request({ id: "recent", status: "pending", requestedAt: "2026-11-09T03:29:00.000Z" });
  const stale = request({ id: "stale", status: "running", requestedAt: "2026-11-09T03:20:00.000Z" });
  const done = request({ id: "done", status: "done", requestedAt: "2026-11-09T03:29:30.000Z" });
  assert.equal(activeSyncRequest([stale, done, recent], now)?.id, "recent");
  assert.equal(activeSyncRequest([stale, done], now), null);
  assert.equal(activeSyncRequest([], now), null);
});

test("sync requests are stored with the viewer's own lowercase email", () => {
  assert.equal(normalizeRequesterEmail("  Peter.Angkawidjaja@gmail.com "), "peter.angkawidjaja@gmail.com");
});
