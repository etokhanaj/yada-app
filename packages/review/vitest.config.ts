import { defineConfig } from "vitest/config";

export default defineConfig({
  // The client tests render App; the client tsconfig uses the automatic JSX runtime.
  esbuild: { jsx: "automatic" },
  test: {
    name: "review",
    include: ["src/**/*.test.ts"],
  },
});
