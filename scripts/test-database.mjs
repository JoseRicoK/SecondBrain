import { execFileSync, spawnSync } from "node:child_process";
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
    spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], {
      stdio: "ignore",
    }).status !== 0
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
    schema +
    policies +
    readFileSync("tests/database/security.sql", "utf8");
  process.stdout.write(
    docker(
      [
        "exec",
        "-i",
        name,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "--quiet",
      ],
      { input: sql },
    ),
  );
} finally {
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
}
