import assert from "node:assert/strict";
import test from "node:test";
import { SUPER_ADMIN_EMAIL } from "./access.ts";
import {
  ACCOUNT_MIGRATION_MESSAGE,
  accountFieldMessage,
  accountRpcMessage,
  selfDeactivationMessage,
  superAdminGate,
  validateNewAccount,
  validateProfileUpdate,
  validateTemporaryPassword,
  SUPER_ADMIN_ONLY_MESSAGE,
  SELF_DEACTIVATION_MESSAGE,
} from "./account-admin.ts";

const puput = { email: SUPER_ADMIN_EMAIL };
const ilya = { email: "estimatorgreenmileindonesia@gmail.com" };

test("only Super Admin passes the account gate", () => {
  assert.equal(superAdminGate(puput), null);
  assert.equal(superAdminGate({ email: "OperasionalGreenMileIndonesia@gmail.com" }), null);
  assert.equal(superAdminGate(ilya), SUPER_ADMIN_ONLY_MESSAGE);
  assert.equal(superAdminGate({ email: "sales002.gmi@gmail.com" }), SUPER_ADMIN_ONLY_MESSAGE);
  assert.equal(superAdminGate(null), SUPER_ADMIN_ONLY_MESSAGE);
});

test("new login validation requires email, name, team, and an 8 character password", () => {
  assert.equal(
    validateNewAccount({
      email: "baru.gmi@gmail.com",
      name: "Baru",
      team: "Sales",
      password: "sementara1",
    }),
    null,
  );
  assert.equal(validateNewAccount({ email: "bukan-email", name: "Baru", team: "Sales", password: "sementara1" }), "email");
  assert.equal(validateNewAccount({ email: "baru.gmi@gmail.com", name: "  ", team: "Sales", password: "sementara1" }), "name");
  assert.equal(validateNewAccount({ email: "baru.gmi@gmail.com", name: "Baru", team: "Admin", password: "sementara1" }), "team");
  assert.equal(validateNewAccount({ email: "baru.gmi@gmail.com", name: "Baru", team: "PPIC", password: "1234567" }), "password");
  assert.equal(validateTemporaryPassword("12345678"), null);
  assert.equal(accountFieldMessage("password"), "Kata sandi sementara minimal 8 karakter.");
});

test("profile updates accept name and team only, and Super Admin cannot deactivate herself", () => {
  assert.equal(validateProfileUpdate({ name: "Puput", team: "PPIC" }), null);
  assert.equal(validateProfileUpdate({ name: "Puput", team: "sales" }), "team");
  assert.equal(selfDeactivationMessage(SUPER_ADMIN_EMAIL, "OperasionalGreenMileIndonesia@gmail.com"), SELF_DEACTIVATION_MESSAGE);
  assert.equal(selfDeactivationMessage(SUPER_ADMIN_EMAIL, "estimatorgreenmileindonesia@gmail.com"), null);
});

test("database errors stay in Indonesian and hide the provider text", () => {
  assert.equal(
    accountRpcMessage("ERROR: Menu ini hanya untuk Super Admin.", "gagal"),
    "Menu ini hanya untuk Super Admin.",
  );
  assert.equal(
    accountRpcMessage('function public.admin_list_accounts() does not exist', "gagal"),
    ACCOUNT_MIGRATION_MESSAGE,
  );
  assert.equal(accountRpcMessage("duplicate key value violates unique constraint", "Perubahan tidak dapat disimpan."), "Perubahan tidak dapat disimpan.");
});
