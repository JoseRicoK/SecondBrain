// Explicit synthetic provider evaluation; no database reads/writes or real diary content.
import { createServer } from "vite";
import nextEnv from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(path.join(root, "secondbrain"), true, {
  info() {},
  error() {},
});
if (
  !process.env.OPENAI_API_KEY ||
  /^(fixture|test)-/.test(process.env.OPENAI_API_KEY)
)
  throw new Error("A real local provider key is required");
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
const cases = [
  {
    name: "writer_perspective",
    known: [],
    text: "Marta me invitó a su recital el sábado. Lucía trabaja limpiando mi oficina. Marta también invitó a su hermana Irene.",
    check: (people) => {
      const marta = people.find((p) => p.name === "Marta");
      const lucia = people.find((p) => p.name === "Lucía");
      const details = (marta?.information.detalles || []).join(" ");
      return (
        /me invit[oó]/i.test(details) &&
        /mi oficina/i.test(lucia?.information.rol || "") &&
        !/quien escribe|el autor|el usuario|el diarista/i.test(
          JSON.stringify(people),
        ) &&
        !/la invit[eé]/i.test(details)
      );
    },
  },
  {
    name: "both_homonyms",
    known: [mother, sister],
    text: "Mi madre Teresa vino a tomar un café. Después fui al cine con mi hermana Teresa. Son dos personas distintas que se llaman igual.",
    check: (people) =>
      people.length === 2 &&
      people.some((p) => p.id === mother.id) &&
      people.some((p) => p.id === sister.id),
  },
  {
    name: "new_homonym",
    known: [sister],
    text: "Hoy he llamado a mi madre Teresa. Mi hermana también se llama Teresa, pero hoy no he hablado con ella.",
    check: (people) =>
      people.some(
        (p) =>
          p.id === null &&
          p.name === "Teresa" &&
          /madre/i.test(p.information.relacion || ""),
      ),
  },
  {
    name: "mixed_legacy_profile",
    known: [
      {
        ...mother,
        details: {
          relacion: {
            entries: [
              ...mother.details.relacion.entries,
              ...sister.details.relacion.entries,
            ],
          },
        },
      },
    ],
    text: "Hoy he tomado un café con mi madre Teresa.",
    check: (people) =>
      people.some(
        (p) =>
          p.id === null &&
          p.name === "Teresa" &&
          /madre/i.test(p.information.relacion || ""),
      ),
  },
  {
    name: "ambiguous_reference",
    known: [mother, sister],
    text: "Hoy he tomado un café con Teresa.",
    ambiguous: true,
  },
];
const server = await createServer({
  configFile: false,
  root,
  logLevel: "silent",
  server: { middlewareMode: true, watch: null },
});
try {
  const { extractDiaryPeople } = await server.ssrLoadModule(
    "/secondbrain/src/lib/diary-analysis.ts",
  );
  let failed = 0;
  for (const item of cases) {
    let passed = false;
    try {
      const people = await extractDiaryPeople(
        item.text,
        "2026-01-01",
        item.known,
      );
      passed = !item.ambiguous && item.check(people);
    } catch (error) {
      passed =
        !!item.ambiguous && error?.constructor?.name === "AmbiguousPersonError";
    }
    console.log(JSON.stringify({ case: item.name, passed }));
    if (!passed) failed++;
  }
  process.exitCode = failed ? 1 : 0;
} finally {
  await server.close();
}
