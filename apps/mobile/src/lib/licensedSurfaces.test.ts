/**
 * Where licensed text (NIV, NKJV, NLT, MSG) may go in the app: its own reading screen and nowhere
 * else (CLAUDE.md rule 9; policy of 12 Oct 2026). Static checks over the source, so a new widget,
 * intent or selectable view that would carry it fails here first.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { maySurfaceText } from "./systemSurfaces";

const SRC = resolve(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("system surfaces (Siri, Spotlight, App Intents, widgets, Now Playing)", () => {
  it("carry only the four open texts, never a licensed one", () => {
    for (const t of ["BSB", "WEB", "KJV", "LSV"]) expect(maySurfaceText(t)).toBe(true);
    for (const t of ["NIV", "NKJV", "NLT", "MSG", "YLT"]) expect(maySurfaceText(t)).toBe(false);
  });

  // Next release (12 Oct 2026): Compare (CP-07, CP-09) and Search (EG-06, John's decision 5) show licensed
  // text on screen, display only; Bookmarks, Recent and Choose only ask whether a code is licensed (US-11),
  // and so does audio, to read the BSB under a licensed page and never the licensed text (EG-03).
  // None of them is a system surface.
  it("licensed text is read only by the reader, Compare, Search, the launch and user.db", () => {
    const importers = files(SRC)
      .filter((f) => /from\s+"[./]+(?:data\/)?(?:licensed|useLicensedChapter)"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f))
      .sort();
    expect(importers).toEqual([
      "app/_layout.tsx",
      "app/evidence/choose.tsx",
      "app/evidence/translations.tsx",
      // Verses for a moment (VM-10): asks only whether the reader's version is licensed, to say the words are the BSB.
      "app/moment.tsx",
      // Your space (PS-03, PS-04): the note's quoted verse and Saved's excerpts ask only whether a code is licensed,
      // and draw the BSB if it is (US-11, rule 9). The share image uses the system surfaces' allow-list instead.
      "app/note.tsx",
      "app/read/[book]/[chapter].tsx",
      "app/recent.tsx",
      "app/saved.tsx",
      "app/search.tsx",
      // Sources and licences names the versions read online (ST-04); it reads no licensed text.
      "app/sources.tsx",
      // Translations › Choose offers the licensed versions to Compare by name, as Compare's own Choose does (IA
      // stress test, 15 Oct 2026); it reads no licensed text.
      "app/translations.tsx",
      "data/audio.ts",
      "data/useLicensedChapter.ts",
      "data/user.ts",
    ]);
  });
});

describe("Writing Tools", () => {
  it("React Native has no per-view switch for it, so licensed text relies on not being selectable", () => {
    // If this fails, React Native has added one: use it on licensed text (handoff, 12 Oct 2026).
    const rn = dirname(createRequire(__filename).resolve("react-native/package.json"));
    const sources = ["Libraries/Text/TextProps.js", "Libraries/Text/Text.d.ts", "Libraries/Components/TextInput/TextInput.d.ts"];
    for (const file of sources) expect(readFileSync(join(rn, file), "utf8"), file).not.toMatch(/writingTools/i);
  });

  it("the reading screen and its text components never make text selectable", () => {
    for (const file of ["components/Verse.tsx", "components/Type.tsx", "app/read/[book]/[chapter].tsx"]) {
      expect(readFileSync(join(SRC, file), "utf8"), file).not.toMatch(/\bselectable\b/);
    }
  });
});
