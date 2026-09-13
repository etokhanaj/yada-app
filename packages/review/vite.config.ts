import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Must match DEFAULT_PORT in src/server/config.ts.
const apiPort = Number(process.env["YADA_REVIEW_PORT"] ?? 4317);

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: path.join(root, "dist", "client"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}` },
    },
  },
});
