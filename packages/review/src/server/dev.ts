/**
 * `pnpm --filter @yada/review dev`: the API on 127.0.0.1:4317 and Vite on
 * 127.0.0.1:5173, which proxies /api to it (see vite.config.ts).
 */

import path from "node:path";

import { createServer as createViteServer } from "vite";

import { PACKAGE_ROOT } from "./config.js";
import { announceSummaries, describe, startReviewServer } from "./main.js";

const running = await startReviewServer({ staticDir: null });
console.log(describe(running));
announceSummaries(running);

const vite = await createViteServer({
  configFile: path.join(PACKAGE_ROOT, "vite.config.ts"),
  root: PACKAGE_ROOT,
});
await vite.listen();
vite.printUrls();
