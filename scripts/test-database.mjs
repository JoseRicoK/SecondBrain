import { execFileSync, spawnSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const name = `secondbrain-tests-${randomUUID().slice(0, 8)}`;
const docker = (args, options = {}) =>
  execFileSync("docker", args, { encoding: "utf8", ...options });
try {
  // A disposable container with no published ports, host volumes or external network.
  docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--network",
    "none",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:16-alpine",
  ]);
  const deadline = Date.now() + 30_000;
  while (
    spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      {
        stdio: "ignore",
      },
    ).status !== 0
  ) {
    if (Date.now() > deadline) throw new Error("Test PostgreSQL did not start");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const schema = readFileSync("secondbrain/supabase-schema.sql", "utf8");
  const integrity = readFileSync(
    "secondbrain/supabase/migrations/20260928210316_firebase_import_integrity.sql",
    "utf8",
  );
  // The baseline already has the FKs/unique constraints. Apply the actual current
  // policy/grant section, not a separately rewritten test security model.
  const policies = integrity.slice(integrity.indexOf("drop policy"));
  const sql =
    readFileSync("tests/database/bootstrap.sql", "utf8") +
    "commit;\n" +
    schema +
    policies +
    // Mirror hosted Supabase defaults: new tables may inherit broad grants.
    "alter default privileges in schema public grant all on tables to anon,authenticated,service_role;\n" +
    readFileSync("tests/database/billing-backfill-seed.sql", "utf8") +
    readFileSync(
      "secondbrain/supabase/migrations/20260929231804_normalized_billing_and_atomic_usage.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20260929231923_billing_catalog_permissions_and_indexes.sql",
      "utf8",
    ) +
    readFileSync("tests/database/billing-backfill.sql", "utf8") +
    readFileSync(
      "secondbrain/supabase/migrations/20260929232943_remove_profile_subscription_json.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20260929234816_billing_subscription_lineage.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20261001192323_person_information_integrity.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20261002055046_admin_dashboard_and_feedback.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20261002213018_neutral_diary_emotion.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20261002220537_admin_diary_reanalysis.sql",
      "utf8",
    ) +
    readFileSync(
      "secondbrain/supabase/migrations/20261005183128_increase_monthly_chat_limits.sql",
      "utf8",
    ) +
    readFileSync("secondbrain/supabase/migrations/20261006085055_person_identity_mentions.sql", "utf8") +
    readFileSync("secondbrain/supabase/migrations/20261006091542_automatic_diary_analysis.sql", "utf8") +
    "begin;\n" +
    readFileSync("tests/database/automatic-analysis.sql", "utf8") +
    readFileSync("tests/database/security.sql", "utf8") +
    readFileSync("tests/database/billing.sql", "utf8") +
    readFileSync("tests/database/people.sql", "utf8") +
    readFileSync("tests/database/person-identities.sql", "utf8") +
    readFileSync("tests/database/dashboard.sql", "utf8") +
    readFileSync("tests/database/emotions.sql", "utf8") +
    readFileSync("tests/database/reanalysis.sql", "utf8");
  process.stdout.write(
    docker(
      [
        "exec",
        "-i",
        name,
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "--quiet",
      ],
      { input: sql },
    ),
  );
  const psql = [
    "exec",
    "-i",
    name,
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-t",
    "-A",
  ];
  docker(psql, {
    input:
      "insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'); insert into public.profiles(uid,email) values('11111111-1111-4111-8111-111111111111','parallel@test.invalid');",
  });
  const query = (statement) =>
    new Promise((resolve, reject) => {
      const process = spawn("docker", psql);
      let stdout = "";
      let stderr = "";
      process.stdout.on("data", (value) => {
        stdout += value;
      });
      process.stderr.on("data", (value) => {
        stderr += value;
      });
      process.on("error", reject);
      process.on("close", (code) =>
        code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)),
      );
      process.stdin.end(`set role service_role; ${statement}`);
    });
  const results = await Promise.all(
    Array.from({ length: 24 }, () =>
      query(
        "select public.reserve_usage('11111111-1111-4111-8111-111111111111','personalChatMessages');",
      ).then(JSON.parse),
    ),
  );
  const allowed = results.filter((result) => result.allowed);
  if (allowed.length !== 10)
    throw new Error(
      `Concurrency quota failure: ${allowed.length} requests allowed instead of 10`,
    );
  await Promise.all(
    allowed.map((result) =>
      query(
        `select public.finish_usage('11111111-1111-4111-8111-111111111111','${result.id}',true);`,
      ),
    ),
  );
  const counters = JSON.parse(
    await query(
      "select public.read_monthly_usage('11111111-1111-4111-8111-111111111111');",
    ),
  );
  if (counters[0].used !== 10 || counters[0].reserved !== 0)
    throw new Error("Concurrent completion lost a usage update");
  process.stdout.write(
    "Concurrency: 24 parallel requests, exactly 10 allowed and charged.\n",
  );
  const checkoutClaims = await Promise.all(
    Array.from({ length: 24 }, () =>
      query(
        `select public.claim_checkout_attempt('11111111-1111-4111-8111-111111111111','${randomUUID()}','pro');`,
      ).then(JSON.parse),
    ),
  );
  if (new Set(checkoutClaims.map((value) => value.requestId)).size !== 1)
    throw new Error("Concurrent checkout created multiple attempt keys");
  process.stdout.write(
    "Checkout concurrency: 24 parallel reservations share one payment attempt.\n",
  );
  docker(psql, {
    input:
      "insert into public.people(id,user_id,name) values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Concurrency person');",
  });
  const personVersion = await query(
    "select updated_at from public.people where id='33333333-3333-4333-8333-333333333333';",
  );
  const personWrites = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      query(
        `update public.people set details='{"detalles":{"entries":[{"value":"Fact ${index}","date":"2026-10-01"}]}}'::jsonb where id='33333333-3333-4333-8333-333333333333' and user_id='11111111-1111-4111-8111-111111111111' and updated_at='${personVersion}' returning id;`,
      ),
    ),
  );
  if (personWrites.filter(Boolean).length !== 1)
    throw new Error(
      "Optimistic person updates failed to reject stale versions",
    );
  const afterPerson = JSON.parse(
    await query(
      "select jsonb_build_object('details',details,'version',updated_at) from public.people where id='33333333-3333-4333-8333-333333333333';",
    ),
  );
  afterPerson.details.detalles.entries.push({
    value: "Retried fact",
    date: "2026-10-01",
  });
  await query(
    `update public.people set details='${JSON.stringify(afterPerson.details)}'::jsonb where id='33333333-3333-4333-8333-333333333333' and user_id='11111111-1111-4111-8111-111111111111' and updated_at='${afterPerson.version}';`,
  );
  if (
    (await query(
      "select jsonb_array_length(details->'detalles'->'entries') from public.people where id='33333333-3333-4333-8333-333333333333';",
    )) !== "2"
  )
    throw new Error("Person retry lost another writer fact");
  process.stdout.write(
    "People concurrency: one of eight stale writes accepted, retry preserves both facts.\n",
  );
  const feedbackWrites = await Promise.all(
    Array.from({ length: 24 }, (_, index) =>
      query(
        `select public.submit_feedback('11111111-1111-4111-8111-111111111111',md5('report-${index}')||md5('id-${index}'),'suggestion','Synthetic concurrency report ${index}');`,
      ).then(JSON.parse),
    ),
  );
  if (feedbackWrites.filter((row) => row.allowed).length !== 5)
    throw new Error(
      "Parallel feedback exceeded five reports per owner per hour",
    );
  process.stdout.write(
    "Feedback concurrency: 24 parallel submissions, exactly 5 saved.\n",
  );
  await query(
    "update public.profiles set admin=true where uid='11111111-1111-4111-8111-111111111111'; insert into public.diary_entries(user_id,date,content) values('11111111-1111-4111-8111-111111111111','2026-01-01','Synthetic concurrency diary');",
  );
  const analysisJobs = await Promise.all(
    Array.from({ length: 24 }, () =>
      query(
        `select public.admin_start_reanalysis('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','${randomUUID()}');`,
      ).then(JSON.parse),
    ),
  );
  if (new Set(analysisJobs.map((job) => job.id)).size !== 1)
    throw new Error("Concurrent reanalysis created duplicate jobs");
  const analysisClaims = await Promise.all(
    Array.from({ length: 24 }, () =>
      query(
        `select public.admin_claim_reanalysis('11111111-1111-4111-8111-111111111111','${analysisJobs[0].id}');`,
      ).then(JSON.parse),
    ),
  );
  if (analysisClaims.filter((result) => result.claim).length !== 1)
    throw new Error("Concurrent reanalysis claimed multiple provider calls");
  process.stdout.write(
    "Reanalysis concurrency: 24 starts share one job; 24 processors claim exactly one entry.\n",
  );
} finally {
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
}
