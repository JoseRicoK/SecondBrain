import { writeFileSync, mkdirSync } from "node:fs";
import {
  authEmail,
  AUTH_EMAILS,
  feedbackEmail,
  billingEmail,
} from "../secondbrain/src/lib/email-templates.ts";
mkdirSync("secondbrain/supabase/templates", { recursive: true });
mkdirSync("docs/email-previews", { recursive: true });
const subjects = {};
for (const kind of Object.keys(AUTH_EMAILS)) {
  const email = authEmail(kind);
  subjects[kind] = email.subject;
  writeFileSync(`secondbrain/supabase/templates/${kind}.html`, email.html);
  writeFileSync(
    `docs/email-previews/${kind}.html`,
    email.html
      .replaceAll(
        "{{ .ConfirmationURL }}",
        "https://app.lumadiary.com/reset-password",
      )
      .replaceAll("{{ .Token }}", "123456"),
  );
}
writeFileSync(
  "secondbrain/supabase/templates/subjects.json",
  JSON.stringify(subjects, null, 2) + "\n",
);
const feedback = feedbackEmail(
  "suggestion",
  "ana@example.invalid",
  "Me gustaría añadir etiquetas a mi diario.\nGracias.",
  new Date("2026-09-30T10:00:00Z"),
);
writeFileSync("docs/email-previews/feedback.html", feedback.html);
for (const [name, status, cancel] of [
  ["subscription-active", "active", false],
  ["subscription-canceled", "canceled", false],
  ["subscription-cancellation", "active", true],
  ["subscription-past-due", "past_due", false],
])
  writeFileSync(
    `docs/email-previews/${name}.html`,
    billingEmail("pro", status, cancel, "2026-10-30T10:00:00Z").html,
  );
writeFileSync(
  "docs/email-previews/index.html",
  '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Correos de LumaDiary</title><body style="font:18px Arial;padding:24px"><h1>Correos de LumaDiary</h1><p>Vista previa con datos ficticios. No envía correos.</p><ul>' +
    [
      ...Object.keys(AUTH_EMAILS),
      "feedback",
      "subscription-active",
      "subscription-canceled",
      "subscription-cancellation",
      "subscription-past-due",
    ]
      .map(
        (name) =>
          `<li style="margin:16px 0"><a href="${name}.html">${name}</a></li>`,
      )
      .join("") +
    "</ul></body></html>",
);
console.log("Email templates and previews generated. Nothing was sent.");
