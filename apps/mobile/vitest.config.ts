import { defineConfig } from "vitest/config";

/**
 * The app has no unit tests yet — it is verified by building and running it on
 * a simulator, not by vitest. This config exists so `pnpm -r test` does not
 * fail here: without it, vitest walks up to the root config, inherits its
 * `projects: ["packages/*"]`, resolves nothing from inside apps/mobile, and
 * errors out before `--passWithNoTests` can apply.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
