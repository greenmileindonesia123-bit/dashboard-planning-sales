import { isSuperAdmin } from "./access.ts";
import { isPlausibleEmail, normalizeEmail } from "./email.ts";
import { MIN_PASSWORD_LENGTH } from "./password-change.ts";

export const ACCOUNT_TEAMS = ["Sales", "PPIC"] as const;
export type AccountTeam = (typeof ACCOUNT_TEAMS)[number];

export const SUPER_ADMIN_ONLY_MESSAGE = "Menu ini hanya untuk Super Admin.";
export const SELF_DEACTIVATION_MESSAGE = "Super Admin tidak dapat menonaktifkan akunnya sendiri.";
export const INVALID_EMAIL_MESSAGE = "Masukkan email yang valid.";
export const INVALID_NAME_MESSAGE = "Masukkan nama pemakai.";
export const INVALID_TEAM_MESSAGE = "Pilih tim Sales atau PPIC.";
export const INVALID_PASSWORD_MESSAGE = "Kata sandi sementara minimal 8 karakter.";
export const ACCOUNT_MIGRATION_MESSAGE = "Fungsi kelola akun belum ada. Jalankan migrasi admin akun.";

const ACCOUNT_RPC_MESSAGES = [
  SUPER_ADMIN_ONLY_MESSAGE,
  SELF_DEACTIVATION_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  INVALID_NAME_MESSAGE,
  INVALID_TEAM_MESSAGE,
  INVALID_PASSWORD_MESSAGE,
  "Email ini sudah ada di Data Sales.",
  "Nama pemakai sudah dipakai.",
  "Akun tidak ditemukan.",
  "Baris Data Sales tidak ditemukan.",
  "Akun Auth untuk email ini belum ada.",
];

const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 80;

export type AccountField = "email" | "name" | "team" | "password";

export type LoginAccount = {
  profileId: string | null;
  authUserId: string | null;
  email: string;
  name: string;
  team: AccountTeam | null;
  active: boolean;
  lastSignInLabel: string;
};

export function superAdminGate(viewer: { email: string | null | undefined } | null): string | null {
  if (!viewer || !isSuperAdmin(viewer)) return SUPER_ADMIN_ONLY_MESSAGE;
  return null;
}

export function validateNewAccount(input: {
  email: string;
  name: string;
  team: string;
  password: string;
}): AccountField | null {
  if (!isPlausibleEmail(normalizeEmail(input.email))) return "email";
  if (validateProfileName(input.name)) return "name";
  if (!isAccountTeam(input.team)) return "team";
  if (validateTemporaryPassword(input.password)) return "password";
  return null;
}

export function validateProfileUpdate(input: { name: string; team: string }): AccountField | null {
  if (validateProfileName(input.name)) return "name";
  if (!isAccountTeam(input.team)) return "team";
  return null;
}

export function validateTemporaryPassword(password: string): AccountField | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return "password";
  return null;
}

export function accountFieldMessage(field: AccountField): string {
  switch (field) {
    case "email":
      return INVALID_EMAIL_MESSAGE;
    case "name":
      return INVALID_NAME_MESSAGE;
    case "team":
      return INVALID_TEAM_MESSAGE;
    case "password":
      return INVALID_PASSWORD_MESSAGE;
  }
}

export function selfDeactivationMessage(actorEmail: string, targetEmail: string): string | null {
  if (normalizeEmail(actorEmail) === normalizeEmail(targetEmail)) return SELF_DEACTIVATION_MESSAGE;
  return null;
}

export function accountRpcMessage(errorMessage: string, fallback: string): string {
  for (const message of ACCOUNT_RPC_MESSAGES) {
    if (errorMessage.includes(message)) return message;
  }
  if (/does not exist|schema cache|could not find the function/i.test(errorMessage)) return ACCOUNT_MIGRATION_MESSAGE;
  return fallback;
}

export function isAccountTeam(value: string): value is AccountTeam {
  return ACCOUNT_TEAMS.includes(value as AccountTeam);
}

function validateProfileName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return true;
  return /[<>\r\n]/.test(trimmed);
}
