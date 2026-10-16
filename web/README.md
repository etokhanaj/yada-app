# Yada website

Static home page with `/privacy`, `/terms` and `/support`. Episode was dropped on 16 Oct 2026, so
the page may use scripts; each one enhances a page that already reads and works without it.

```
src/index.html            home
src/privacy/index.html    /privacy (App Store Connect privacy policy URL)
src/terms/index.html      /terms
src/support/index.html    /support (App Store Connect support URL)
src/assets/site.css       the one stylesheet
src/assets/site.js        the read-along in Listen; Read it your way starting in view and on a chosen case
src/audio/                George reading John 1:1–2 (Kokoro-82M, Apache-2.0; BSB, public domain)
src/brand, fonts, phones, story, wall, photos, bento
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

## Fonts

Literata and Gentium Plus, subset to what the page uses, with their OFL files. Gentium's licence reserves its name for unmodified copies, so the subset is renamed
"Yada Greek".

## Screens

Frames from the design canvas (`.claude/skills/design/scripts/build_canvas.py` on `master`, 16 Oct 2026),
rendered with the real day pictures (`content/pictures`, public domain) and captured at 3× without the
canvas's bezel, island or Placeholder notes. `src/phones/` sets them in Apple's iPhone 17 Pro Silver product
bezel (Apple Design Resources); `src/story/` holds the bare screens for the hero phone and Read it your way;
`src/wall/` holds small copies for the closing wall. Show the iPhone straight on and unaltered (Apple's
marketing guidelines). `src/photos/walk.webp` is an Unsplash photograph (Unsplash Licence).

The brand pattern is the Yada symbol (`brand/logos/yada-symbol-chartreuse.svg`) tiled in CSS. Icons in Read it
your way are Untitled UI's, the set the app uses.

`src/bento/` holds Made for every day: crops of the canvas's AU-04 player and DR-02 reader (light, dark, AX5),
and two day pictures, `day-04` and `day-11` from `content/pictures` (public domain).
