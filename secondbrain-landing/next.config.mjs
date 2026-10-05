import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SECOND_BRAIN_TEST_BUILD === "1" ? ".next-test" : ".next",
  outputFileTracingRoot: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  ),
};

export default nextConfig;
