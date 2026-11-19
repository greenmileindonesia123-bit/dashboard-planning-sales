import { SALES_PERSON_ALIASES } from "../sales-order/aliases.ts";
import type { RosterPerson } from "./types.ts";

const EMPLOYEE_NAME_HINTS: Record<string, string> = {
  "SL-2026017": "Marizka Etha",
  "SL-2026019": "Lista",
};

export function matchSalesPerson(
  reporter: string,
  employeeId: string,
  roster: RosterPerson[],
): RosterPerson | null {
  const hint = EMPLOYEE_NAME_HINTS[employeeId.trim().toUpperCase()];
  if (hint) {
    const fromHint = uniqueNameMatch(hint, roster);
    if (fromHint) return fromHint;
  }
  return uniqueNameMatch(reporter, roster);
}

function aliasExpandedNames(candidate: string): string[] {
  const names = [candidate];
  const key = candidate.trim().toLowerCase();
  if (SALES_PERSON_ALIASES[key]) names.push(SALES_PERSON_ALIASES[key]);
  for (const token of tokensOf(candidate)) {
    const alias = SALES_PERSON_ALIASES[token];
    if (alias) names.push(alias);
  }
  return names;
}

function uniqueNameMatch(candidate: string, roster: RosterPerson[]): RosterPerson | null {
  const ranked = roster
    .map((person) => ({
      person,
      score: Math.max(0, ...aliasExpandedNames(candidate).map((name) => matchScore(person.name, name))),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
  return ranked[0].person;
}

function matchScore(profileName: string, candidate: string): number {
  if (!namesMatch(profileName, candidate)) return 0;
  return tokensOf(profileName).length;
}

export function namesMatch(profileName: string, candidate: string): boolean {
  const profileTokens = tokensOf(profileName);
  const candidateTokens = tokensOf(candidate);
  if (profileTokens.length === 0 || candidateTokens.length === 0) return false;
  const pool = [...candidateTokens];
  for (const token of profileTokens) {
    const index = pool.findIndex((item) => tokensClose(token, item));
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  return true;
}

function tokensOf(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokensClose(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return levenshtein(left, right) <= 1;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = previous[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = saved;
    }
  }
  return previous[right.length];
}
