export const MIN_PASSWORD_LENGTH = 8;

export const EMPTY_CURRENT_PASSWORD_MESSAGE = "Masukkan kata sandi lama.";
export const EMPTY_NEW_PASSWORD_MESSAGE = "Masukkan kata sandi baru.";
export const SHORT_PASSWORD_MESSAGE = "Kata sandi baru minimal 8 karakter.";
export const MISMATCH_PASSWORD_MESSAGE = "Konfirmasi kata sandi baru tidak sama.";
export const SAME_PASSWORD_MESSAGE = "Kata sandi baru harus berbeda dari kata sandi lama.";
export const WRONG_OLD_PASSWORD_MESSAGE = "Kata sandi lama salah.";
export const PASSWORD_SAVED_MESSAGE = "Kata sandi sudah diperbarui.";
export const PASSWORD_SAVE_FAILED_MESSAGE = "Kata sandi belum dapat disimpan. Coba lagi.";
export const PASSWORD_RATE_LIMIT_MESSAGE = "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";

export type PasswordChangeIssue = "empty-current" | "empty-new" | "too-short" | "mismatch" | "same-as-old";

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): PasswordChangeIssue | null {
  if (input.currentPassword.length === 0) return "empty-current";
  if (input.newPassword.length === 0) return "empty-new";
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) return "too-short";
  if (input.newPassword !== input.confirmPassword) return "mismatch";
  if (input.newPassword === input.currentPassword) return "same-as-old";
  return null;
}

export function passwordChangeIssueMessage(issue: PasswordChangeIssue): string {
  switch (issue) {
    case "empty-current":
      return EMPTY_CURRENT_PASSWORD_MESSAGE;
    case "empty-new":
      return EMPTY_NEW_PASSWORD_MESSAGE;
    case "too-short":
      return SHORT_PASSWORD_MESSAGE;
    case "mismatch":
      return MISMATCH_PASSWORD_MESSAGE;
    case "same-as-old":
      return SAME_PASSWORD_MESSAGE;
  }
}

export function mapOldPasswordError(message: string): string {
  if (isRateLimit(message)) return PASSWORD_RATE_LIMIT_MESSAGE;
  return WRONG_OLD_PASSWORD_MESSAGE;
}

export function mapPasswordUpdateError(message: string): string {
  const normalized = message.toLowerCase();
  if (isRateLimit(message)) return PASSWORD_RATE_LIMIT_MESSAGE;
  if (
    normalized.includes("password") &&
    (normalized.includes("same") || normalized.includes("different") || normalized.includes("old password"))
  ) {
    return SAME_PASSWORD_MESSAGE;
  }
  if (
    normalized.includes("at least") ||
    normalized.includes("too short") ||
    normalized.includes("weak") ||
    normalized.includes("should be") ||
    normalized.includes("password")
  ) {
    return "Kata sandi baru belum memenuhi aturan. Gunakan minimal 8 karakter.";
  }
  return PASSWORD_SAVE_FAILED_MESSAGE;
}

function isRateLimit(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate") ||
    normalized.includes("too many") ||
    normalized.includes("security purposes") ||
    normalized.includes("once every")
  );
}
