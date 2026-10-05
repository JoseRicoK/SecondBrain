import {
  cleanPersonName,
  currentPersonValue,
  personNameKey,
} from "./person-information";

type KnownPerson = { name: string; details?: unknown };
// These are references to the writer's own parents, never 'su madre',
// 'madre de ...', similar names, or matches inferred from dated profile facts.
const parentReferences = [
  {
    names: ["mamá", "mama", "madre", "mi madre"],
    relationship: "madre",
    phrases: ["mi madre"],
  },
  {
    names: ["papá", "papa", "padre", "mi padre"],
    relationship: "padre",
    phrases: ["mi padre"],
  },
];
export function createPersonMentionResolver(people: KnownPerson[]) {
  const canonical = new Map(
    people.map((person) => [
      personNameKey(person.name),
      cleanPersonName(person.name),
    ]),
  );
  const references: { name: string; pattern: RegExp }[] = [];
  for (const group of parentReferences) {
    const candidates = people.filter(
      (person) =>
        group.names.includes(personNameKey(person.name)) &&
        personNameKey(currentPersonValue(person.details, "relacion")) ===
          group.relationship,
    );
    if (candidates.length !== 1) continue;
    const name = cleanPersonName(candidates[0].name);
    for (const alias of group.names)
      if (!canonical.has(alias)) canonical.set(alias, name);
    references.push({
      name,
      pattern: new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?:${group.phrases.join("|")})(?=$|[^\\p{L}\\p{N}])`,
        "iu",
      ),
    });
  }
  return {
    resolve: (value: string) =>
      canonical.get(personNameKey(value)) || cleanPersonName(value),
    mentions(names: string[] | null | undefined, content: string) {
      const result = new Map<string, string>();
      for (const raw of names || []) {
        if (typeof raw !== "string" || !raw.trim()) continue;
        const name = canonical.get(personNameKey(raw)) || cleanPersonName(raw);
        result.set(personNameKey(name), name);
      }
      for (const { name, pattern } of references)
        if (pattern.test(content)) result.set(personNameKey(name), name);
      return [...result.values()];
    },
  };
}
