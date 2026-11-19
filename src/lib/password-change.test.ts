import assert from "node:assert/strict";
import test from "node:test";
import {
  mapOldPasswordError,
  mapPasswordUpdateError,
  MISMATCH_PASSWORD_MESSAGE,
  PASSWORD_RATE_LIMIT_MESSAGE,
  PASSWORD_SAVE_FAILED_MESSAGE,
  passwordChangeIssueMessage,
  SAME_PASSWORD_MESSAGE,
  SHORT_PASSWORD_MESSAGE,
  validatePasswordChange,
  WRONG_OLD_PASSWORD_MESSAGE,
} from "./password-change.ts";

const valid = {
  currentPassword: "sementara-1",
  newPassword: "milik-saya-2",
  confirmPassword: "milik-saya-2",
};

test("password change validation blocks empty, short, mismatched, and unchanged passwords", () => {
  assert.equal(validatePasswordChange({ ...valid, currentPassword: "" }), "empty-current");
  assert.equal(validatePasswordChange({ ...valid, newPassword: "", confirmPassword: "" }), "empty-new");
  assert.equal(
    validatePasswordChange({ ...valid, newPassword: "1234567", confirmPassword: "1234567" }),
    "too-short",
  );
  assert.equal(validatePasswordChange({ ...valid, confirmPassword: "lain-lagi-2" }), "mismatch");
  assert.equal(
    validatePasswordChange({
      currentPassword: "milik-saya-2",
      newPassword: "milik-saya-2",
      confirmPassword: "milik-saya-2",
    }),
    "same-as-old",
  );
  assert.equal(validatePasswordChange(valid), null);
  assert.equal(passwordChangeIssueMessage("too-short"), SHORT_PASSWORD_MESSAGE);
  assert.equal(passwordChangeIssueMessage("mismatch"), MISMATCH_PASSWORD_MESSAGE);
  assert.equal(passwordChangeIssueMessage("same-as-old"), SAME_PASSWORD_MESSAGE);
});

test("password change auth errors stay in Indonesian and hide provider text", () => {
  const raw = "Invalid login credentials for user secret-value";
  assert.equal(mapOldPasswordError(raw), WRONG_OLD_PASSWORD_MESSAGE);
  assert.equal(mapOldPasswordError(raw).includes("secret-value"), false);
  assert.equal(mapOldPasswordError("Too many requests"), PASSWORD_RATE_LIMIT_MESSAGE);
  const updateRaw = "Password should be at least 6 characters: hunter2";
  const mapped = mapPasswordUpdateError(updateRaw);
  assert.equal(mapped.includes("hunter2"), false);
  assert.match(mapped, /minimal 8 karakter/);
  assert.equal(
    mapPasswordUpdateError("New password should be different from the old password."),
    SAME_PASSWORD_MESSAGE,
  );
  assert.equal(mapPasswordUpdateError("unexpected storage outage"), PASSWORD_SAVE_FAILED_MESSAGE);
});
