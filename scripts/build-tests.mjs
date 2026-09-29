import { spawn } from "node:child_process";
import { testEnvironment } from "./test-environment.mjs";
for (const workspace of ["secondbrain", "secondbrain-landing"]) {
  const args = ["run", "build", "--workspace", workspace];
  if (workspace === "secondbrain") args.push("--", "--webpack");
  const child = spawn("npm", args, { stdio: "inherit", env: testEnvironment });
  const code = await new Promise((resolve) => child.on("exit", resolve));
  if (code !== 0) process.exit(code || 1);
}
