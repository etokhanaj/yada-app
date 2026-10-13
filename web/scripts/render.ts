/**
 * Writes the scripture on the home page from web/data/site-data.json into the marked
 * blocks of index.html (`<!-- data:NAME -->`) and site.css (`data:NAME` comments).
 * Hand-typed Greek, Hebrew or parsing is how a site ends up claiming what the data
 * does not say (CLAUDE.md rule 4), so none of it is typed by hand.
 *
 *   pnpm exec tsx web/scripts/render.ts
 *
 * Word cards follow the app's word card (apps/mobile/src/app/evidence/word.tsx):
 * headword, transliteration and gloss, form, dictionary form, counts.
 * Episode drops scripts on import, so a card is shown by CSS :has() on hover or focus.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BOOKS, bare, esc, ref, times } from "./format";

interface Word {
  surface: string;
  translit: string;
  gloss: string | null;
  form: string;
  lemma: string;
  usually: string | null;
  inBook: number;
  total: number;
}

interface Data {
  john: { verseId: string; words: Word[]; texts: Record<string, string> };
  differ: { verseId: string; bsb: string; readings: { about: string; options: string[]; credit: string }[] };
  hero: { john: string; plain: string };
}

const web = join(import.meta.dirname, "..");
const data = JSON.parse(readFileSync(join(web, "data/site-data.json"), "utf8")) as Data;

function card(id: string, w: Word, script: "greek" | "hebrew", book: string, isDefault: boolean): string {
  const lang = script === "greek" ? "grc" : "hbo";
  const dir = script === "hebrew" ? ' dir="rtl"' : "";
  // The dictionary form only says something when it differs from the word as written.
  const from =
    bare(w.lemma) === bare(w.surface)
      ? ""
      : `<p class="wc-line">From <span class="orig" lang="${lang}"${dir}>${esc(w.lemma)}</span>${w.usually === null ? "" : `, usually “${esc(w.usually)}”`}</p>`;
  return `<div class="wc" id="${id}" role="group" aria-label="${esc(w.translit)}, ${esc(w.gloss ?? "")}"${isDefault ? " data-default" : ""}>
  <div><p class="wc-head orig" lang="${lang}"${dir}>${esc(w.surface)}</p>
  <p class="wc-sub">${esc(w.translit)}${w.gloss === null ? "" : ` · ${esc(w.gloss)}`}</p></div>
  <div class="wc-detail"><p class="wc-line">${esc(w.form)}</p>
  ${from}
  <p class="wc-line wc-muted">${times(w.inBook)} in ${book}, ${w.total.toLocaleString("en-GB")} in the Bible</p></div>
</div>`;
}

function study(key: string, verseId: string, words: Word[], script: "greek" | "hebrew", defaultIndex: number) {
  const lang = script === "greek" ? "grc" : "hbo";
  const book = BOOKS[verseId.split(".")[0] ?? ""] ?? "";
  const buttons = words
    .map(
      (w, i) =>
        `<li><button type="button" class="word w-${i}" aria-describedby="${key}-${i}"><span class="orig" lang="${lang}">${esc(w.surface)}</span><span class="gl">${esc(w.gloss ?? "")}</span></button></li>`,
    )
    .join("\n");
  const cards = words.map((w, i) => card(`${key}-${i}`, w, script, book, i === defaultIndex)).join("\n");
  const html = `<div class="study study-${key}"${script === "hebrew" ? ' data-rtl' : ""}>
<div class="study-verse">
<ol class="words"${script === "hebrew" ? ' dir="rtl"' : ""} aria-label="${ref(verseId).replace(/&nbsp;/g, " ")}, word by word">
${buttons}
</ol>
</div>
<div class="study-detail">
${cards}
</div>
</div>`;
  const css = words
    .map((_, i) => `.study-${key}:has(.w-${i}:is(:hover, :focus-visible)) #${key}-${i}`)
    .join(",\n");
  return { html, css: `${css} { display: grid; }` };
}





/** 1 Corinthians 14:34 and the readings the Translation Notes set out, each in the source's words. */
function differ(): string {
  const d = data.differ;
  const credit = d.readings[0]?.credit ?? "";
  // One question keeps the card short; "women" has the two shortest readings.
  const groups = d.readings
    .filter((r) => r.about === "women")
    .map(
      (r) => `<div class="rd-group">
  <p class="rd-about">“${esc(r.about)}”</p>
  <ol class="rd-options">${r.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
</div>`,
    )
    .join("\n");
  return `<blockquote class="rd-verse"><p>${esc(d.bsb)}</p><footer>${ref(d.verseId)} · BSB</footer></blockquote>
<div class="rd-readings">
${groups}
</div>
<p class="rd-credit">${esc(credit)}</p>`;
}

/**
 * The opening: John 1:1, then its plain words with the Greek beneath, the two frames taking
 * turns on their own. Every line is the source's own words.
 */
function verseHero(): string {
  const h = data.hero;
  // Each word is its own span so the words can arrive one after another; "Word" is marked so it
  // can light up with λόγος.
  const words = (text: string) =>
    text
      .split(" ")
      .map((w, i) => `<span class="vh-t${/^Word\b/.test(w) ? " k" : ""}" style="--i: ${i}">${esc(w)}</span>`)
      .join(" ");
  const greek = data.john.words
    .map((w, i) => `<span class="vh-w${i === 4 ? " key" : ""}" style="--i: ${i}"><span class="orig" lang="grc">${esc(w.surface)}</span><span class="gl">${esc(w.gloss ?? "")}</span></span>`)
    .join("");
  return `<div class="vh-frame f-1" role="group" aria-label="John 1:1">
  <p class="vh-label">${ref("JHN.1.1")} · BSB</p>
  <p class="vh-verse">${words(h.john)}</p>
</div>
<div class="vh-frame f-2" role="group" aria-label="John 1:1 in plain words and in Greek">
  <p class="vh-label">In plain words</p>
  <p class="vh-verse">${words(h.plain)}</p>
  <p class="vh-greek" aria-label="The Greek, word by word">${greek}</p>
</div>`;
}

const greek = study("jn", data.john.verseId, data.john.words, "greek", 4);

function fill(file: string, open: (name: string) => string, close: (name: string) => string, parts: Record<string, string>) {
  let text = readFileSync(file, "utf8");
  for (const [name, body] of Object.entries(parts)) {
    const start = text.indexOf(open(name));
    const end = text.indexOf(close(name));
    if (start === -1 || end === -1) throw new Error(`${file}: no ${name} markers`);
    text = `${text.slice(0, start + open(name).length)}\n${body}\n${text.slice(end)}`;
  }
  writeFileSync(file, text);
}

fill(
  join(web, "src/index.html"),
  (n) => `<!-- data:${n} -->`,
  (n) => `<!-- /data:${n} -->`,
  {
    "study-greek": greek.html,
    differ: differ(),
    "verse-hero": verseHero(),
  },
);
fill(
  join(web, "src/assets/site.css"),
  (n) => `/* data:${n} */`,
  (n) => `/* /data:${n} */`,
  { "study-rules": greek.css },
);
console.log("rendered index.html and site.css");
