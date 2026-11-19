// Short ERP names that do not match a sales_profiles name exactly.
// Keys are trimmed lowercase. Values are the profile name to look up.
export const SALES_PERSON_ALIASES: Record<string, string> = {
  etha: "Marizka Etha",
  "mariszka etha": "Marizka Etha",
  mariszka: "Marizka Etha",
  peter: "Peter Ang",
  mariska: "Mariska",
  puput: "Puput",
  riyan: "Lista",
  lista: "Lista",
  "dya ayu": "Diah Ayu",
  dya: "Diah Ayu",
  "diah ayu": "Diah Ayu",
  "diah kanthi": "Dyah Kanthi",
  "dyah kanthi": "Dyah Kanthi",
};

export type SalesProfileName = {
  name: string;
  email: string | null;
};

export function matchSalesPerson(raw: string, roster: SalesProfileName[]): SalesProfileName | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const exact = roster.find((person) => person.name.trim().toLowerCase() === key);
  if (exact) return exact;
  const alias = SALES_PERSON_ALIASES[key] ?? SALES_PERSON_ALIASES[key.split(/\s+/)[0] ?? ""];
  if (!alias) return null;
  return roster.find((person) => person.name.trim().toLowerCase() === alias.toLowerCase()) ?? null;
}
