import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "mobile",
    include: ["src/**/*.test.ts"],
  },
});
