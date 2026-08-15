import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "review",
    include: ["src/**/*.test.ts"],
  },
});
