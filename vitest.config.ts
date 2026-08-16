import { defineConfig } from "vitest/config";

// Workspace-wide runner. Individual packages also expose `pnpm test`
// (see each package.json); this root config is what `pnpm test` uses.
export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
