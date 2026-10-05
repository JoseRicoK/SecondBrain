import { expect, it } from "vitest";
import {
  currentPersonValue,
  mergePersonInformation,
  normalizePersonDetails,
} from "@/lib/person-information";
const category = (...entries: [string, string][]) => ({
  entries: entries.map(([value, date]) => ({ value, date })),
});
it("collapses repeated stable observations preserving their first date and real A-B-A changes", () => {
  const normalized = normalizePersonDetails({
    relacion: category(
      ["novia", "2025-01-01"],
      ["Novia.", "2025-02-01"],
      ["amiga", "2025-03-01"],
      ["novia", "2025-04-01"],
    ),
  });
  expect(normalized.relacion.entries).toEqual(
    category(
      ["novia", "2025-01-01"],
      ["amiga", "2025-03-01"],
      ["novia", "2025-04-01"],
    ).entries,
  );
});
it("deduplicates same-day facts but retains repeated activities on different dates", () => {
  expect(
    normalizePersonDetails({
      detalles: category(
        ["Café.", "2025-01-01"],
        ["café", "2025-01-01"],
        ["Café", "2025-02-01"],
      ),
    }).detalles.entries,
  ).toHaveLength(2);
});
it("does not confuse different accented values or erase semantic paraphrases", () => {
  expect(
    normalizePersonDetails({
      detalles: category(
        ["Dijo sí", "2025-01-01"],
        ["Dijo si", "2025-01-01"],
        ["Fuimos al café", "2025-01-01"],
      ),
    }).detalles.entries,
  ).toHaveLength(3);
});
it("merges category aliases, removes unknown stable markers and keeps undated legacy data", () => {
  expect(
    normalizePersonDetails({
      cumpleanos: "1 de enero",
      relationship: "Madre",
      rol: "desconocido",
      detalles: ["desconocido"],
    }),
  ).toEqual({
    cumpleaños: category(["1 de enero", ""]),
    relacion: category(["Madre", ""]),
    detalles: category(["desconocido", ""]),
  });
});
it("ignores invalid shapes, temporary fields and prototype keys", () => {
  expect(
    normalizePersonDetails(
      JSON.parse(
        '{"__proto__":"bad","rol_input":"bad","rol_textarea":"bad","detalles":{"entries":[null,{},12]}}',
      ),
    ),
  ).toEqual({});
});
it("reanalysis is idempotent and never mutates the input", () => {
  const original = {
    relacion: category(["Madre", "2025-01-01"]),
    detalles: category(["Comimos juntas", "2025-02-01"]),
  };
  const before = JSON.stringify(original);
  const result = mergePersonInformation(
    original,
    { relacion: "madre", detalles: ["Comimos juntas."] },
    "2025-02-01",
  );
  expect(result).toEqual(original);
  expect(JSON.stringify(original)).toBe(before);
});
it("uses historical state when analyzing an older diary date", () => {
  const details = {
    relacion: category(["amiga", "2025-01-01"], ["pareja", "2025-03-01"]),
  };
  expect(currentPersonValue(details, "relacion", "2025-02-01")).toBe("amiga");
  expect(currentPersonValue(details, "relacion", "2024-01-01")).toBe("");
  expect(
    mergePersonInformation(details, { relacion: "Amiga" }, "2025-02-01"),
  ).toEqual(details);
});
it("corrects same-day stable data while preserving other dates", () => {
  expect(
    mergePersonInformation(
      {
        rol: category(
          ["Estudiante", "2025-01-01"],
          ["Comercial", "2025-02-01"],
        ),
      },
      { rol: "Ingeniera" },
      "2025-02-01",
    ).rol.entries,
  ).toEqual(
    category(["Estudiante", "2025-01-01"], ["Ingeniera", "2025-02-01"]).entries,
  );
});
