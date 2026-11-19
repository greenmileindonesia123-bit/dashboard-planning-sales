import assert from "node:assert/strict";
import test from "node:test";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "./access.ts";
import { personKey } from "./metrics.ts";
import { figuresFor, resolvePersonFilter } from "./scope.ts";
import type { Viewer } from "./types.ts";

const puput = viewer("Puput", SUPER_ADMIN_EMAIL, "PPIC");
const ilya = viewer("Ilya", "estimatorgreenmileindonesia@gmail.com", "PPIC");
const ling = viewer("Ling Ling", "sales002.gmi@gmail.com", "Sales");
const roster = [puput, ilya, ling, { name: "Diah Ayu", email: null }];

test("only Puput's active email is Super Admin", () => {
  assert.equal(isSuperAdmin(puput), true);
  assert.equal(isSuperAdmin({ email: "OperasionalGreenMileIndonesia@gmail.com" }), true);
  assert.equal(isSuperAdmin(ilya), false);
  assert.equal(isSuperAdmin(ling), false);
  assert.equal(isSuperAdmin({ email: "  " }), false);
});

test("Super Admin can filter the roster, while PPIC and Sales stay on their own row", () => {
  assert.equal(resolvePersonFilter(puput, "semua", roster), null);
  assert.equal(resolvePersonFilter(puput, personKey(ling), roster)?.email, ling.email);
  assert.equal(resolvePersonFilter(ilya, personKey(ling), roster)?.email, ilya.email);
  assert.equal(resolvePersonFilter(ilya, "semua", roster)?.email, ilya.email);
  assert.equal(resolvePersonFilter(ling, personKey(ilya), roster)?.email, ling.email);
  assert.deepEqual(
    figuresFor(puput, roster, null).map((person) => person.name),
    ["Puput", "Ilya", "Ling Ling", "Diah Ayu"],
  );
  assert.deepEqual(figuresFor(ilya, roster, null).map((person) => person.email), [ilya.email]);
  assert.deepEqual(figuresFor(ling, roster, ling).map((person) => person.email), [ling.email]);
});

function viewer(name: string, email: string, team: "Sales" | "PPIC"): Viewer {
  return {
    kind: "ok",
    userId: email,
    email,
    name,
    area: "surabaya",
    team,
    status: "Aktif",
  };
}
