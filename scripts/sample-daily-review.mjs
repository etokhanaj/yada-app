// The review queue's sample of build 7a's daily texts (plan §0 step 1: "a small sample of each goes to
// John's review queue"; rule 2: only John approves). Writes two Extracts files beside book_intros.json:
//   devotional_samples.json   Spurgeon's Morning and Evening, the entry as the app shows it
//   daily_light_samples.json  the Daily Light headline reference as parsed, beside the source's own line
// Re-running keeps any decision already made, so it never undoes a review.
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = process.env.YADA_ROOT ?? "/Users/johnetokhana/yada";
const out = new URL("../packages/pipeline/prototypes/data/", import.meta.url);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Fourteen days spread over the year, morning and evening alternating, 29 February among them.
const DAYS = ["0101", "0127", "0222", "0229", "0320", "0415", "0511", "0606", "0702", "0728", "0823", "0918", "1014", "1225"];
const picks = DAYS.map((mmdd, i) => ({ mmdd, part: i % 2 === 0 ? "am" : "pm" }));
const label = ({ mmdd, part }) => `${Number(mmdd.slice(2))} ${MONTHS[Number(mmdd.slice(0, 2)) - 1]}, ${part === "am" ? "morning" : "evening"}`;

function write(file, entries) {
  const path = new URL(file, out);
  // Keep John's decisions: a re-run only adds or refreshes drafts.
  const before = existsSync(path) ? new Map(JSON.parse(readFileSync(path, "utf8")).entries.map((e) => [e.key, e])) : new Map();
  const merged = entries.map((e) => {
    const old = before.get(e.key);
    return old !== undefined && old.text === e.text ? { ...e, status: old.status } : e;
  });
  // extracts.ts refuses to rewrite a file not in JSON.stringify(_, null, 1) form.
  writeFileSync(path, `${JSON.stringify({ entries: merged }, null, 1)}\n`);
  console.log(`${file}: ${merged.length} entries`);
}

const spurgeon = new DatabaseSync(`${root}/content/bundles/devotional-spurgeon.v1.db`, { readOnly: true });
const row = spurgeon.prepare("select heading, ref, body from entries where mmdd = ? and part = ?");
write(
  "devotional_samples.json",
  picks.map((p) => {
    const r = row.get(p.mmdd, p.part);
    return {
      key: `spurgeon:${p.mmdd}${p.part}`,
      label: label(p),
      text: `${r.heading}\n\n${r.body}`,
      paragraph: "",
      ref: `${r.ref} · C. H. Spurgeon, Morning and Evening (CCEL, public domain)`,
      status: "draft",
    };
  }),
);

const xml = readFileSync(`${root}/content/raw/daily-light/daily_light.xml`, "utf8");
const table = JSON.parse(readFileSync(new URL("../apps/mobile/src/data/dailyLight.json", import.meta.url), "utf8"));
const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
write(
  "daily_light_samples.json",
  picks.map((p) => {
    const div = xml.match(new RegExp(`<div2[^>]*id="d${p.mmdd}${p.part}"[\\s\\S]*?</div2>`))?.[0] ?? "";
    // The headline is the day's third paragraph: the bold verse and its scripRef.
    const headline = plain(div.match(new RegExp(`<p id="d${p.mmdd}${p.part}-p3">([\\s\\S]*?)</p>`))?.[1] ?? "");
    const r = table[p.mmdd][p.part];
    return {
      key: `dailylight:${p.mmdd}${p.part}`,
      label: label(p),
      text: `${r.book} ${r.chapter}:${r.verse}${r.to ? `–${r.to}` : ""}`,
      paragraph: headline,
      ref: "Daily Light on the Daily Path (Bagster), CCEL. The app shows this verse in the reader's translation.",
      status: "draft",
    };
  }),
);
