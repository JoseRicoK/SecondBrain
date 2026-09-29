import { mkdtemp, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { fileURLToPath } from "node:url";

for (const workspace of ["secondbrain", "secondbrain-landing"]) {
  it(`${workspace} prebuild rejects source conflict copies and ignores build output`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "secondbrain-guard-test-"));
    try {
      await mkdir(join(directory, "scripts"));
      const script = join(directory, "scripts", "check-source-duplicates.mjs");
      await copyFile(
        fileURLToPath(
          new URL(
            `../../${workspace}/scripts/check-source-duplicates.mjs`,
            import.meta.url,
          ),
        ),
        script,
      );
      for (const folder of ["src", "node_modules", ".next", ".next-test"])
        await mkdir(join(directory, folder));
      await writeFile(join(directory, "src", "page.tsx"), "canonical");
      for (const folder of ["node_modules", ".next", ".next-test"])
        await writeFile(join(directory, folder, "generated 2.js"), "ignored");
      const run = () =>
        spawnSync(process.execPath, [script], { encoding: "utf8" });
      expect(run().status).toBe(0);
      await writeFile(join(directory, "src", "page 2.tsx"), "conflict");
      expect(run().status).toBe(1);
      expect(run().stderr).toContain("src/page 2.tsx");
      // The guard reports conflicts; it must never remove files itself.
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
