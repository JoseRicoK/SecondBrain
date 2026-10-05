import { expect, it } from "vitest";
import { createPersonMentionResolver } from "@/lib/person-mentions";
const mother = {
  name: "Mamá",
  details: { relacion: { entries: [{ value: "madre", date: "2025-01-01" }] } },
};
it("resolves only unambiguous owner references and preserves canonical display names", () => {
  const resolver = createPersonMentionResolver([
    mother,
    { name: "Vero" },
    { name: "madre de Vero", details: mother.details },
  ]);
  expect(
    resolver.mentions(
      [" mi madre ", "MAMÁ", "vero"],
      "Mi madre estaba en casa",
    ),
  ).toEqual(["Mamá", "Vero"]);
  expect(resolver.mentions([], "Hoy fui a casa de mi madre.")).toEqual([
    "Mamá",
  ]);
  expect(resolver.resolve(" mi madre ")).toBe("Mamá");
  expect(
    resolver.mentions(
      [],
      "Su madre, su mamá, la madre de Vero, madre mía y Mamasita.",
    ),
  ).toEqual([]);
});
it("does not merge uncertain identities or invent links from profile dates", () => {
  const resolver = createPersonMentionResolver([
    mother,
    { ...mother, name: "mi madre" },
  ]);
  expect(resolver.mentions(["mi madre"], "Hoy escribí.")).toEqual(["mi madre"]);
  expect(resolver.mentions([], "He visto a mi madre.")).toEqual([]);
  expect(
    createPersonMentionResolver([
      { ...mother, name: "madre de Vero" },
    ]).mentions([], "Mi madre"),
  ).toEqual([]);
});
it("requires a known relationship and never uses substring name matches", () => {
  expect(
    createPersonMentionResolver([{ name: "Mamá" }, { name: "Ana" }]).mentions(
      [],
      "Mañana veré a mi madre.",
    ),
  ).toEqual([]);
});
