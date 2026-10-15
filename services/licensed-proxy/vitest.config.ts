import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "licensed-proxy",
    include: ["src/**/*.test.ts"],
  },
});
