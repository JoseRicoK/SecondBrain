import { spawn } from "node:child_process";
import { testEnvironment } from "./test-environment.mjs";
const workspace = process.argv[2];
if (!["secondbrain", "secondbrain-landing"].includes(workspace))
  throw new Error("Invalid test workspace");
const port = workspace === "secondbrain" ? "3100" : "3101";
const child = spawn(
  "npm",
  [
    "run",
    "start",
    "--workspace",
    workspace,
    "--",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  { stdio: "inherit", env: testEnvironment },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
