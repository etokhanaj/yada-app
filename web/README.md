# Yada website

Static home page with `/privacy`, `/terms` and `/support`, packaged for Episode's "import zipped
website".

```
src/index.html            home
src/privacy/index.html    /privacy (App Store Connect privacy policy URL)
src/terms/index.html      /terms
src/support/index.html    /support (App Store Connect support URL)
src/assets/site.css       the one stylesheet
src/brand, fonts, phones, story, wall, photos
scripts/verse-data.ts     shipping bundles → data/site-data.json
scripts/render.ts         data/site-data.json → the marked blocks in index.html and site.css
```

```bash
pnpm exec tsx web/scripts/verse-data.ts /path/to/content/bundles
pnpm exec tsx web/scripts/render.ts
./web/build.sh            # dist/yada-site.zip (gitignored)
```

Preview with `python3 -m http.server 4321 --directory web/src`.

## Where the scripture comes from

Every Greek and Hebrew word, gloss, parsing, count, verse text and Understand line on the
home page is read from the release bundles named in `content/bundles/manifest.json`
(`core.v4`, `*.v2`), through the app's own decoders (`morphLine`, `displayGloss`,
`markReadingDifferences`). `verse-data.ts` refuses a bundle that is not `reviewed` and an
entry that is not `human_reviewed`. Edit the template around the `data:` markers, never
inside them; `render.ts` rewrites them.

## Episode's import rules

From `episode-api/src/services/designImport`:

- A page is a top-level `.html` or `<dir>/index.html`; the directory is the slug.
- Each top-level `header`, `section`, `article` and `footer` (inside `main` too) becomes
  one section, named by its `aria-label`. A ported section's CSS must stay under 32 KB.
- Scripts are dropped, so the page has none. Word cards switch with `:has()` on hover and
  focus; FAQ answers are `<details>`.
- A rule pairing `opacity: 0` with a `transition` is forced visible on import, so scroll
  reveals use keyframes on a `view()` timeline instead.
- Tokens are read from `:root` by name (`--paper`, `--ink`, `--accent`, `--cta`, `--muted`,
  `--divider`, `--font-display`, `--font-body`); dark values come from the
  `prefers-color-scheme: dark` block.

## Fonts

Literata and Gentium Plus, subset to what the page uses, with their OFL files. Gentium's licence reserves its name for unmodified copies, so the subset is renamed
"Yada Greek".

## Screens

Real screens from the iPhone 17 Pro simulator (build-next-release, 13 Oct 2026), status bar 9:41 and
full. `src/phones/` sets them in Apple's iPhone 17 Pro Silver product bezel (Apple Design Resources);
`src/story/` holds the bare screens and the bezel for the pinned story; `src/wall/` holds small copies
for the closing wall. Show the iPhone straight on and unaltered (Apple's marketing guidelines).
`src/photos/` holds two Unsplash photographs (Unsplash Licence), one with Yada's Home composited
onto the phone. Recapture when the screens change.
