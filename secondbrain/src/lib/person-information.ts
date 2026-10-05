import type {
  PersonDetailCategory,
  PersonDetailEntry,
} from "./supabase-operations";

export const PROFILE_FIELDS = ["rol", "relacion", "cumpleaños", "direccion"];
export function localPersonDetailDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const cleanPersonName = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ");
export const personNameKey = (value: string) =>
  cleanPersonName(value).toLocaleLowerCase("es");
export const detailValueKey = (value: string) =>
  value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!;,]+$/, "")
    .toLocaleLowerCase("es");
const categoryAliases = new Map(
  Object.entries({
    role: "rol",
    relationship: "relacion",
    details: "detalles",
    cumpleanos: "cumpleaños",
    birthday: "cumpleaños",
    address: "direccion",
  }),
);
export function detailCategoryKey(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return categoryAliases.get(key) || key;
}
const unknown = new Set([
  "desconocido",
  "desconocida",
  "unknown",
  "n/a",
  "no especificado",
  "no especificada",
  "no mencionado",
  "no mencionada",
  "sin información",
  "sin informacion",
]);
export function normalizePersonDetails(
  input: unknown,
): Record<string, PersonDetailCategory> {
  const grouped: Record<string, PersonDetailEntry[]> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  for (const [rawKey, rawCategory] of Object.entries(input)) {
    const key = detailCategoryKey(rawKey);
    if (
      !key ||
      ["__proto__", "constructor", "prototype"].includes(key) ||
      key.endsWith("_textarea") ||
      key.endsWith("_input")
    )
      continue;
    const category = rawCategory as { entries?: unknown } | null;
    const rawEntries = Array.isArray(category?.entries)
      ? category.entries
      : Array.isArray(rawCategory)
        ? rawCategory
        : [rawCategory];
    for (const raw of rawEntries) {
      const value = typeof raw === "string" ? raw : raw?.value;
      if (typeof value !== "string" || !detailValueKey(value)) continue;
      if (PROFILE_FIELDS.includes(key) && unknown.has(detailValueKey(value)))
        continue;
      const date = typeof raw?.date === "string" ? raw.date : "";
      (grouped[key] ||= []).push({ value: cleanPersonName(value), date });
    }
  }
  const result: Record<string, PersonDetailCategory> = {};
  for (const [key, entries] of Object.entries(grouped)) {
    const stable = PROFILE_FIELDS.includes(key);
    const seen = new Set<string>();
    const unique = entries
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((item) => {
        const identity = `${item.date}:${detailValueKey(item.value)}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    const history: PersonDetailEntry[] = [];
    for (const item of unique) {
      // Collapse repeated observations, preserving real A -> B -> A transitions.
      if (
        !stable ||
        detailValueKey(history.at(-1)?.value || "") !==
          detailValueKey(item.value)
      )
        history.push(item);
    }
    if (history.length) result[key] = { entries: history };
  }
  return result;
}

export function mergePersonInformation(
  input: unknown,
  information: Record<string, unknown>,
  date: string,
) {
  const details = normalizePersonDetails(input);
  for (const [rawKey, rawValue] of Object.entries(information)) {
    const key = detailCategoryKey(rawKey);
    if (!key || ["__proto__", "constructor", "prototype"].includes(key))
      continue;
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).filter(
      (v): v is string => typeof v === "string" && Boolean(detailValueKey(v)),
    );
    if (!values.length) continue;
    const category = (details[key] ||= { entries: [] });
    for (const value of values) {
      if (PROFILE_FIELDS.includes(key)) {
        if (unknown.has(detailValueKey(value))) continue;
        const previous = [...category.entries]
          .reverse()
          .find((e) => e.date <= date);
        if (
          previous &&
          detailValueKey(previous.value) === detailValueKey(value)
        )
          continue;
        category.entries = category.entries.filter((e) => e.date !== date);
      }
      category.entries.push({ value: cleanPersonName(value), date });
    }
  }
  return normalizePersonDetails(details);
}

export function currentPersonValue(
  details: unknown,
  key: string,
  date?: string,
) {
  const entries =
    normalizePersonDetails(details)[detailCategoryKey(key)]?.entries || [];
  return (
    entries.filter((e) => !date || !e.date || e.date <= date).at(-1)?.value ||
    ""
  );
}
