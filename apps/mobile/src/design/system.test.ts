import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The design system's rules, held in code (docs/design-system.md). Each one is here because the app broke it once.
const SRC = resolve(__dirname, "..");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(SRC, dir))) {
    const path = join(dir, name);
    if (statSync(join(SRC, path)).isDirectory()) out.push(...files(path));
    else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx")) out.push(path);
  }
  return out;
}

/** Routes the root layout presents as a form sheet: `options={sheet}` or `{fitted}` (sized to content), `{ ...sheet, … }` or `presentation: "formSheet"`. */
function sheetRoutes(): string[] {
  const layout = read("app/_layout.tsx");
  const routes = new Set<string>();
  for (const m of layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"([\s\S]*?)\/>/gu)) {
    const options = m[2] ?? "";
    if (/options=\{\s*(?:sheet|fitted)\s*\}|options=\{\{\s*\.\.\.(?:sheet|fitted)\b|presentation:\s*"formSheet"/u.test(options)) routes.add(m[1] ?? "");
  }
  return [...routes];
}

function routeFiles(route: string): string[] {
  if (existsSync(join(SRC, "app", `${route}.tsx`))) return [join("app", `${route}.tsx`)];
  if (existsSync(join(SRC, "app", route))) return files(join("app", route));
  return [];
}

describe("the design system (docs/design-system.md)", () => {
  it("never sizes a picture by absoluteFill (it drew far larger and showed a corner; components/FillPicture.tsx)", () => {
    const offenders = [...files("app"), ...files("components")].filter((f) => /<Image\b[^>]*absoluteFill/u.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("finds the sheet routes it checks", () => {
    expect(sheetRoutes()).toEqual(expect.arrayContaining(["pray/ask", "pray/icloud", "understand", "note", "start-small"]));
  });

  // TestFlight build 9: Ask for prayer was a full page inside a form sheet; its scroll view collapsed and only the
  // back pill showed over the keyboard (John, 18 Oct 2026).
  it("never draws a full page inside a sheet: a sheet route uses SheetScreen, not PageScreen", () => {
    const offenders = sheetRoutes().flatMap((route) => routeFiles(route).filter((f) => /\bPageScreen\b/u.test(read(f))));
    expect(offenders).toEqual([]);
  });

  // The 15 Oct polish: section titles are bold ink (SectionTitle), never the 13 pt grey Label, which shipped on every
  // sheet until the design QA of 18 Oct. Label stays for small captions inside a block: these files use it that way.
  it("titles sections with SectionTitle; Label only where it captions inside a block", () => {
    const captions = new Set([
      "app/evidence/translations.tsx", // the verse reference over each version's line
      "components/OriginalWords.tsx", // "Title" over a psalm's original superscription
      "components/UnderstandViews.tsx", // the language name over each half of a shared opening
    ]);
    const using = [...files("app"), ...files("components")].filter((f) => /<Label\b/u.test(read(f)));
    expect(using.filter((f) => !captions.has(f))).toEqual([]);
  });

  // The polish: page titles in SF bold, serif kept for Scripture; every page shipped Literata until 18 Oct.
  it("sets page titles in the sans pageTitle step, not the serif display step", () => {
    expect(read("components/Page.tsx")).toMatch(/function LargeTitle[\s\S]*?useType\("pageTitle"\)/u);
  });

  // Build 11 colour pass (docs/colour-rules.md): seven screens had drawn their own whites and alphas.
  it("draws colours from design/, never a literal in a screen", () => {
    const own = new Set([
      "components/TranslationCover.tsx", // the covers' own shading, part of the cover art (MT-02)
      "lib/translations.ts", // the covers' five tones (MT-02 to MT-06)
    ]);
    const source = (dir: string): string[] =>
      readdirSync(join(SRC, dir)).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(join(SRC, path)).isDirectory()) return source(path);
        return /\.tsx?$/u.test(path) && !/\.(test|generated)\./u.test(path) ? [path] : [];
      });
    const stray = ["app", "components", "lib", "data"]
      .flatMap(source)
      .filter((f) => !own.has(f))
      .flatMap((f) =>
        read(f)
          .split("\n")
          // A picture's fade and a shadow are drawn, not chosen colours.
          .filter((line) => /"#[0-9A-Fa-f]{3,8}"|rgba?\(/u.test(line) && !/gradient\(|[Ss]hadow/u.test(line))
          .map((line) => `${f}: ${line.trim()}`),
      );
    expect(stray).toEqual([]);
  });

  it("keeps rows at 56 pt", () => {
    expect(read("components/Page.tsx")).toMatch(/listRow:\s*\{[^}]*minHeight:\s*56/u);
  });

  // Build 12 (John, 24 Oct 2026): cards may now cast a shadow, but only the raised card, for what people wrote. A
  // hairline drawn as a boxShadow ("0 -1px 0") is a divider, not a shadow; floating chrome keeps its own barely-there lift.
  it("casts a shadow only through RaisedCard (and the floating chrome)", () => {
    const allowed = new Set([
      "components/RaisedCard.tsx",
      "components/Glass.tsx", // floating chrome's hairline lift
      "components/Segmented.tsx", // the switch's thumb
      "components/TranslationCover.tsx", // the covers' own shading (MT-02)
    ]);
    const blurred = /shadowOpacity|shadowRadius|elevation:|boxShadow:[^,}]*[`"]-?\d+(?:px)? -?\d+(?:px)? [1-9]/u;
    const offenders = [...files("app"), ...files("components")].filter((f) => !allowed.has(f) && blurred.test(read(f)));
    expect(offenders).toEqual([]);
  });

  // Build 12: the four tints colour ways to pray; a screen takes them from the palette, never its own pastel.
  it("takes the tints from the palette", () => {
    const palette = read("design/palette.ts");
    const tints = [...palette.matchAll(/tints: \{([^}]*)\}/gu)].flatMap((m) => (m[1] ?? "").match(/#[0-9A-Fa-f]{6}/gu) ?? []);
    expect(tints).toHaveLength(8);
    const stray = [...files("app"), ...files("components")].filter((f) => tints.some((t) => read(f).includes(t)));
    expect(stray).toEqual([]);
    expect(read("components/Tiles.tsx")).toMatch(/palette\.tints\[tint\]/u);
  });
});
