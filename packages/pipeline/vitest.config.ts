import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "pipeline",
    include: ["src/**/*.test.ts"],
    // These tests read one real SQLite file (content/staging.db) rather than a
    // per-test fixture, because the oracle's whole value is that it checks the
    // actual derived corpus. Parallel files therefore contend on it and fail
    // with "database is locked" — serial execution is the correct shape for a
    // suite with a shared on-disk fixture, not a workaround for a flaky test.
    fileParallelism: false,
  },
});
