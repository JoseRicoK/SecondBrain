import {
  currentPersonValue,
  normalizePersonDetails,
  personNameKey,
} from "./person-information";

export type KnownIdentity = { id?: string; name: string; details?: unknown };
export class AmbiguousPersonError extends Error {
  readonly personName: string | null;
  constructor(name?: string) {
    super(
      "No se pudo distinguir con seguridad a las personas con el mismo nombre. Aclara en el texto a quién te refieres y vuelve a analizarlo.",
    );
    this.personName =
      name
        ?.replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || null;
  }
}
const familyRole = (value: string) => {
  const key = personNameKey(value);
  return ["madre", "padre", "hermana", "hermano", "hija", "hijo"].find(
    (role) => key === role || key === `mi ${role}`,
  );
};
export function hasMixedFamilyIdentity(person: KnownIdentity) {
  const roles = new Set(
    (normalizePersonDetails(person.details).relacion?.entries || [])
      .map((entry) => familyRole(entry.value))
      .filter(Boolean),
  );
  // These relationships with the writer cannot be a temporal change of one identity.
  return (
    (roles.has("madre") || roles.has("padre")) &&
    (roles.has("hermana") ||
      roles.has("hermano") ||
      roles.has("hija") ||
      roles.has("hijo"))
  );
}
export function identityContext(person: KnownIdentity, date: string) {
  const details = normalizePersonDetails(person.details);
  return {
    id: person.id || null,
    name: person.name,
    identityNeedsReview: hasMixedFamilyIdentity(person),
    profile: Object.fromEntries(
      ["rol", "relacion", "cumpleaños", "direccion"].map((key) => [
        key,
        currentPersonValue(details, key, date),
      ]),
    ),
    // Profile context only, known by the entry date; no historical diary events.
    history: Object.fromEntries(
      Object.entries(details)
        .filter(([key]) =>
          ["rol", "relacion", "cumpleaños", "direccion"].includes(key),
        )
        .map(([key, category]) => [
          key,
          category.entries
            .filter((entry) => !entry.date || entry.date <= date)
            .slice(-8),
        ]),
    ),
  };
}
export function resolveExtractedIdentity(
  id: unknown,
  name: string,
  information: Record<string, unknown>,
  known: KnownIdentity[],
) {
  if (id !== null && id !== undefined) {
    if (typeof id !== "string") throw new Error("Invalid person identity");
    const match = known.find((person) => person.id === id);
    // Model IDs are selectors, never authorization; only owner catalogue identities are valid.
    if (!match || personNameKey(name) !== personNameKey(match.name))
      throw new Error("Invalid person identity");
    if (hasMixedFamilyIdentity(match)) throw new AmbiguousPersonError(name);
    const oldRole = familyRole(currentPersonValue(match.details, "relacion"));
    const newRole = familyRole(String(information.relacion || ""));
    if (oldRole && newRole && oldRole !== newRole)
      throw new AmbiguousPersonError(name);
    return match;
  }
  const candidates = known.filter(
    (person) => personNameKey(person.name) === personNameKey(name),
  );
  if (!candidates.length) return null;
  const reliable = candidates.filter(
    (person) => !hasMixedFamilyIdentity(person),
  );
  // A genuinely new homonym requires an explicit, different relationship in the text.
  const role = personNameKey(String(information.relacion || ""));
  if (
    role &&
    reliable.every((person) => {
      const previous = personNameKey(
        currentPersonValue(person.details, "relacion"),
      );
      return previous && previous !== role;
    })
  )
    return null;
  // Existing people must be selected by ID, never silently merged by name.
  throw new AmbiguousPersonError(name);
}
