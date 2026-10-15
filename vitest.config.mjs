import { defineConfig } from "vitest/config";
export default defineConfig({
  envDir: false,
  // Keep timing-sensitive conversion checks reproducible on shared desktops.
  // CLI users may override the concurrency; assertion time budgets stay intact.
  test: { include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"], maxWorkers: 2 },
});
