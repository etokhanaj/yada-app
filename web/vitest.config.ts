import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "web",
    include: ["scripts/**/*.test.ts"],
  },
});
