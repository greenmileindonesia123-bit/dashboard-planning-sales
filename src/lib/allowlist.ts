export type AllowlistDecision = "allow" | "unlisted" | "error";

export function interpretAllowlist(
  registered: boolean | null,
  hasError: boolean,
): AllowlistDecision {
  if (hasError) return "error";
  return registered === true ? "allow" : "unlisted";
}
