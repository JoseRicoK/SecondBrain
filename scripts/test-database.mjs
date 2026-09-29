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
    readFileSync("tests/database/billing-backfill-seed.sql", "utf8") +
    readFileSync(
      "secondbrain/supabase/migrations/20260929204059_normalized_billing_and_atomic_usage.sql",
      "utf8",
    ) +
    readFileSync("tests/database/billing-backfill.sql", "utf8") +
    "begin;\n" +
    readFileSync("tests/database/security.sql", "utf8") +
    readFileSync("tests/database/billing.sql", "utf8");
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
  if (allowed.length !== 5)
    throw new Error(
      `Concurrency quota failure: ${allowed.length} requests allowed instead of 5`,
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
  if (counters[0].used !== 5 || counters[0].reserved !== 0)
    throw new Error("Concurrent completion lost a usage update");
  process.stdout.write(
    "Concurrency: 24 parallel requests, exactly 5 allowed and charged.\n",
  );
} finally {
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
}
