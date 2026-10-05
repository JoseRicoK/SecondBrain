// Explicit, opt-in provider evaluation. Built-in synthetic text only: no database,
// user identifiers, diary reads/writes, quota changes or emails.
import { createServer } from "vite";
import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(path.join(root, "secondbrain"), true, {
  info() {},
  error() {},
});
if (
  !process.env.OPENAI_API_KEY ||
  /^(fixture|test)-/.test(process.env.OPENAI_API_KEY)
)
  throw new Error(
    "La evaluación requiere OPENAI_API_KEY local; no usa claves de prueba.",
  );
const cases = [
  {
    id: "routine",
    text: "Fui a la oficina, compré pan y preparé la cena. Fue un día normal, sin nada destacable y sin una emoción especial.",
    check: (m) => m.neutral >= 65 && m.happiness <= 30 && m.stress <= 30,
  },
  {
    id: "descriptive_enjoyment",
    text: "Llegamos al parque con los bocadillos. Hicimos una competición de juegos y acabamos doblados de la risa. Al volver propuse repetir la tarde el sábado. Me fui con ganas de seguir un rato más.",
    check: (m) => m.happiness >= 40 && m.neutral <= 40,
  },
  {
    id: "descriptive_pressure",
    text: "La entrega era en diez minutos y faltaban dos archivos. El programa se cerró tres veces. El jefe preguntaba cada minuto si estaba listo; revisaba el reloj continuamente y apenas pude parar. Al acabar seguía pensando en si habría mandado algo mal.",
    check: (m) => m.stress >= 40 && m.neutral <= 40,
  },
  {
    id: "humour_and_pressure",
    text: "Durante el encargo urgente íbamos haciendo bromas y me reía mucho. Disfruté el reto y me alegró conseguirlo, aunque estaba muy pendiente del reloj y sentía bastante presión por llegar a tiempo. Las dos cosas se mezclaron durante la mañana.",
    check: (m) => m.happiness >= 40 && m.stress >= 40 && m.neutral <= 40,
  },
];
const server = await createServer({
  configFile: false,
  root,
  logLevel: "silent",
  server: { middlewareMode: true, watch: null },
});
try {
  const { analyzeDiaryMood } = await server.ssrLoadModule(
    "/secondbrain/src/lib/diary-analysis.ts",
  );
  let failures = 0;
  // Two small requests at once; no retries or automatic history processing.
  for (let index = 0; index < cases.length; index += 2) {
    const results = await Promise.allSettled(
      cases
        .slice(index, index + 2)
        .map(async (item) => ({
          id: item.id,
          mood: await analyzeDiaryMood(item.text),
          check: item.check,
        })),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        failures++;
        console.error(
          "Evaluación no disponible",
          result.reason?.status || result.reason?.name || "Error",
        );
      } else {
        const passed = result.value.check(result.value.mood);
        if (!passed) failures++;
        console.log(
          JSON.stringify({
            case: result.value.id,
            passed,
            scores: result.value.mood,
          }),
        );
      }
    }
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  await server.close();
}
