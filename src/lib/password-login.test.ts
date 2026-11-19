import assert from "node:assert/strict";
import test from "node:test";
import { interpretAllowlist } from "./allowlist.ts";
import { mapPasswordSignInError, UNLISTED_EMAIL_MESSAGE, WRONG_PASSWORD_MESSAGE } from "./password-login.ts";

test("password sign-in is attempted only after the allowlist returns true", () => {
  assert.equal(interpretAllowlist(true, false), "allow");
  assert.notEqual(interpretAllowlist(false, false), "allow");
  assert.notEqual(interpretAllowlist(null, false), "allow");
  assert.notEqual(interpretAllowlist(true, true), "allow");
});

test("credential failures stay a password error and do not add another existence message", () => {
  assert.equal(mapPasswordSignInError("Invalid login credentials"), WRONG_PASSWORD_MESSAGE);
  assert.equal(mapPasswordSignInError("Invalid login credentials"), WRONG_PASSWORD_MESSAGE);
  assert.notEqual(mapPasswordSignInError("User not found"), UNLISTED_EMAIL_MESSAGE);
  assert.equal(mapPasswordSignInError("User not found"), WRONG_PASSWORD_MESSAGE);
  assert.equal(mapPasswordSignInError("Email not found"), WRONG_PASSWORD_MESSAGE);
  assert.match(mapPasswordSignInError("Too many requests"), /Terlalu banyak percobaan/);
  assert.equal(mapPasswordSignInError("network down"), "Tidak dapat masuk. Coba lagi.");
});
