/**
 * `pnpm --filter @yada/review export`: regenerates review/review_state.jsonl
 * from staging.db. Opens the database read-only and never migrates it.
 */

import { exportReviewState } from "./actions.js";
import { reviewDir, stagingDbPath } from "./config.js";
import { openReadOnly } from "./db.js";

const dbPath = stagingDbPath();
const db = openReadOnly(dbPath);
try {
  const { file, rows } = exportReviewState(db, reviewDir());
  console.log(`Wrote ${rows} review_state rows from ${dbPath} to ${file}`);
} finally {
  db.close();
}
