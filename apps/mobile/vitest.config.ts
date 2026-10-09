import { defineConfig } from "vitest/config";

/**
 * Pure logic (src/lib) and the app's SQL (src/data/queries.test.ts, run against
 * the real bundles under node:sqlite when content/bundles exists). Screens are
 * verified on the simulator and by the Maestro flows in .maestro/.
 *
 * The config must exist here: without it vitest walks up to the root config,
 * inherits its `projects: ["packages/*"]`, and resolves nothing in apps/mobile.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
