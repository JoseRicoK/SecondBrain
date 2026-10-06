import { expect, it, vi } from "vitest";
import { extractDiaryPeople } from "@/lib/diary-analysis";
import { createPersonMentionResolver } from "@/lib/person-mentions";
import {
  AmbiguousPersonError,
  hasMixedFamilyIdentity,
  identityContext,
  resolveExtractedIdentity,
} from "@/lib/person-identity";
const mother = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Teresa",
  details: { relacion: { entries: [{ value: "madre", date: "2025-01-01" }] } },
};
const sister = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Teresa",
  details: {
    relacion: { entries: [{ value: "hermana", date: "2025-01-01" }] },
  },
};
it("resolves homonyms by owner-catalogue identity while preserving their names", () => {
  expect(
    resolveExtractedIdentity(mother.id, "Teresa", {}, [mother, sister]),
  ).toBe(mother);
  expect(
    resolveExtractedIdentity(sister.id, "Teresa", {}, [mother, sister]),
  ).toBe(sister);
  expect(() =>
    resolveExtractedIdentity("foreign-id", "Teresa", {}, [mother, sister]),
  ).toThrow();
  expect(() =>
    resolveExtractedIdentity(null, "Teresa", {}, [mother, sister]),
  ).toThrow(AmbiguousPersonError);
});
it("does not overwrite a mother with a sister's information and permits a clearly new homonym", () => {
  expect(() =>
    resolveExtractedIdentity(mother.id, "Teresa", { relacion: "hermana" }, [
      mother,
    ]),
  ).toThrow(AmbiguousPersonError);
  expect(
    resolveExtractedIdentity(null, "Teresa", { relacion: "hermana" }, [mother]),
  ).toBeNull();
});
it("does not treat a legitimate relationship change as a different identity", () => {
  const friend = {
    ...mother,
    details: {
      relacion: { entries: [{ value: "amiga", date: "2025-01-01" }] },
    },
  };
  expect(
    resolveExtractedIdentity(friend.id, "Teresa", { relacion: "pareja" }, [
      friend,
    ]),
  ).toBe(friend);
});
it("detects already mixed family profiles without mutating or discarding them", () => {
  const mixed = {
    ...mother,
    details: {
      relacion: {
        entries: [
          ...mother.details.relacion.entries,
          ...sister.details.relacion.entries,
        ],
      },
    },
  };
  expect(hasMixedFamilyIdentity(mixed)).toBe(true);
  expect(() =>
    resolveExtractedIdentity(mixed.id, "Teresa", {}, [mixed]),
  ).toThrow(AmbiguousPersonError);
  expect(mixed.details.relacion.entries).toHaveLength(2);
});
it("provides profile context without historical diary events or future profile facts", () => {
  const context = identityContext(
    {
      ...mother,
      details: {
        ...mother.details,
        detalles: { entries: [{ value: "Private event", date: "2025-01-01" }] },
        rol: { entries: [{ value: "future", date: "2027-01-01" }] },
      },
    },
    "2026-01-01",
  );
  expect(JSON.stringify(context)).not.toContain("Private event");
  expect(JSON.stringify(context)).not.toContain("future");
  expect(context.id).toBe(mother.id);
});
it("keeps explicit diary memberships separate and never assigns an ambiguous legacy name to both people", () => {
  const resolver = createPersonMentionResolver([mother, sister]);
  expect(resolver.mentions(["Teresa"], "Vi a Teresa", [mother.id])).toEqual([
    mother.id,
  ]);
  expect(
    resolver.mentions(["Teresa"], "Vi a ambas", [mother.id, sister.id]),
  ).toEqual([mother.id, sister.id]);
  expect(resolver.mentions(["Teresa"], "Vi a Teresa")).toEqual(["Teresa"]);
  expect(resolver.mentions(["Teresa"], "", [])).toEqual([]);
  expect(resolver.mentions(["Teresa"], "", ["foreign-id"])).toEqual([]);
});
it("validates both Teresa identities before saving and retains their separate facts", async () => {
  const create = vi.fn().mockResolvedValue({
    output_text: JSON.stringify({
      people: [
        {
          id: mother.id,
          ambiguous: false,
          name: "Teresa",
          information: { detalles: ["Tomamos café"] },
        },
        {
          id: sister.id,
          ambiguous: false,
          name: "Teresa",
          information: { detalles: ["Fuimos al cine"] },
        },
      ],
    }),
  });
  const output = await extractDiaryPeople(
    "Vi a mi madre Teresa y a mi hermana Teresa",
    "2026-01-01",
    [mother, sister],
    { responses: { create } } as any,
  );
  expect(output).toHaveLength(2);
  expect(output.map((p) => p.name)).toEqual(["Teresa", "Teresa"]);
  expect(output.map((p) => p.id)).toEqual([mother.id, sister.id]);
  expect(output[0].information.detalles).toEqual(["Tomamos café"]);
});

it("identifies the mention flagged as ambiguous by the provider", async () => {
  const create = vi
    .fn()
    .mockResolvedValue({
      output_text: JSON.stringify({
        people: [
          {
            id: null,
            ambiguous: true,
            name: "Teresa",
            information: { detalles: [] },
          },
        ],
      }),
    });
  await expect(
    extractDiaryPeople("Vi a Teresa", "2026-01-01", [mother, sister], {
      responses: { create },
    } as any),
  ).rejects.toMatchObject({ personName: "Teresa" });
});
it("identifies a conflicting catalogue identity in the ambiguity error", () => {
  try {
    resolveExtractedIdentity(mother.id, "Teresa", { relacion: "hermana" }, [
      mother,
    ]);
  } catch (error) {
    expect(error).toMatchObject({ personName: "Teresa" });
    return;
  }
  throw new Error("Expected ambiguous identity");
});
