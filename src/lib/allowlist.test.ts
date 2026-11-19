import assert from "node:assert/strict";
import test from "node:test";
import { interpretAllowlist } from "./allowlist.ts";

test("only an explicit true allowlist result may try a password sign-in", () => {
  assert.equal(interpretAllowlist(true, false), "allow");
  assert.equal(interpretAllowlist(false, false), "unlisted");
  assert.equal(interpretAllowlist(null, false), "unlisted");
  assert.equal(interpretAllowlist(true, true), "error");
  assert.equal(interpretAllowlist(false, true), "error");
});
