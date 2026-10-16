// One-off: every Daily Light headline reference must be a real verse in the core
// bundle (rule 4: never state a reference the source data does not contain).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const root = process.env.YADA_ROOT ?? "/Users/johnetokhana/yada";
const db = new DatabaseSync(`${root}/content/bundles/core.v5.db`, { readOnly: true });
const data = JSON.parse(readFileSync(new URL("../apps/mobile/src/data/dailyLight.json", import.meta.url)));
const q = db.prepare("select count(*) n from verses where book=? and chapter=? and verse=?");
let n = 0;
const missing = [];
for (const [mmdd, parts] of Object.entries(data)) {
  for (const [part, r] of Object.entries(parts)) {
    n++;
    const ends = [r.verse, ...(r.to ? [r.to] : [])];
    for (const v of ends) {
      if (q.get(r.book, r.chapter, v).n === 0) missing.push(`${mmdd} ${part} ${r.book} ${r.chapter}:${v}`);
    }
  }
}
console.log(`checked ${n} entries, ${missing.length} missing verse(s)`);
for (const m of missing) console.log(m);
process.exitCode = missing.length ? 1 : 0;
