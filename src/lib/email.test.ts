import assert from "node:assert/strict";
import test from "node:test";
import { isPlausibleEmail, normalizeEmail } from "./email.ts";

test("normalizes the email used for password login", () => {
  assert.equal(normalizeEmail("  Peter.Angkawidjaja@gmail.com "), "peter.angkawidjaja@gmail.com");
  assert.equal(isPlausibleEmail("peter.angkawidjaja@gmail.com"), true);
  assert.equal(isPlausibleEmail("bukan-email"), false);
});
