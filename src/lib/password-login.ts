export const UNLISTED_EMAIL_MESSAGE = "Email ini belum terdaftar.";
export const WRONG_PASSWORD_MESSAGE = "Kata sandi salah.";

export function mapPasswordSignInError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalid password") ||
    normalized.includes("wrong password") ||
    normalized.includes("user not found") ||
    normalized.includes("email not found")
  ) {
    return WRONG_PASSWORD_MESSAGE;
  }
  if (
    normalized.includes("rate") ||
    normalized.includes("too many") ||
    normalized.includes("security purposes") ||
    normalized.includes("once every")
  ) {
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
  }
  return "Tidak dapat masuk. Coba lagi.";
}
