import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  test: {
    projects: ["secondbrain", "secondbrain-landing"].map((workspace) => ({
      plugins: [react()],
      css: { postcss: { plugins: [] } },
      resolve: { alias: { "@": root(`./${workspace}/src`) } },
      test: {
        name: workspace,
        root: root(`./${workspace}`),
        include: ["tests/**/*.test.{ts,tsx}"],
        environment: "node",
        setupFiles: [root("./tests/setup.ts")],
        clearMocks: true,
        restoreMocks: true,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
          SUPABASE_SERVICE_ROLE_KEY: "test-service",
          OPENAI_API_KEY: "test-openai",
          RESEND_API_KEY: "re_test",
        },
      },
    })),
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "secondbrain/src/**/*.{ts,tsx}",
        "secondbrain-landing/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*_new.tsx",
        "**/opengraph-image.tsx",
        "**/twitter-image.tsx",
      ],
      thresholds: {
        statements: 40,
        lines: 40,
        branches: 35,
        functions: 35,
        "secondbrain/src/lib/supabase-operations.ts": {
          lines: 90,
          functions: 90,
        },
        "secondbrain/src/lib/subscription-operations.ts": {
          lines: 90,
          functions: 90,
        },
        "secondbrain/src/lib/store.ts": { lines: 90, functions: 90 },
        "secondbrain/src/middleware/subscription.ts": {
          lines: 90,
          functions: 90,
        },
      },
    },
  },
});
