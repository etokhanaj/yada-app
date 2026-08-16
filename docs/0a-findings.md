# Milestone 0A — findings

**Status: COMPLETE.** The vertical slice runs on an iPhone 17 Pro simulator (iOS 26.5) and all
eight rubric questions have been answered on device. Nothing below is inferred; every verdict has a
screenshot or a crash log behind it.

Date: 16 Aug 2026. Device: iPhone 17 Pro, iOS 26.5. Expo SDK 57, React Native 0.86.2, New
Architecture enabled.

## Verdicts

| # | Question | Verdict |
|---|---|---|
| 1 | Pointed Hebrew renders correctly at every Dynamic Type size | **PASS** (default, AX3) |
| 2 | Polytonic Greek renders correctly at every size | **PASS** |
| 3 | FTS5 and ATTACH work on device; driver decision recorded | **PASS, with a caveat that matters** |
| 4 | Tap-to-extend selection works without pixel-precise dragging | **PASS at default, FAIL at AX3** |
| 5 | Word tap opens a popover, reading position untouched | **PASS** |
| 6 | Back to reading returns to the exact verse | **PASS** |
| 7 | Understand default state answers the question without significant scrolling | **PASS at default; not yet verified at AX3** |
| 8 | 1 Cor 14:34's full depth lands within 60 seconds on the first screen | **PASS** |

Screenshots in `docs/0a/`.

## The three findings that would have cost real money

### 1. Bidi corruption in every claim that opens with a Hebrew word (fixed)

Two of the three Genesis text claims rendered with the Hebrew word thrown to the far end of the line
and the full stop moved to the *start* of the next line: `.is a masculine plural noun form אֱלֹהִים`.
The third claim rendered perfectly.

The difference is which script the sentence starts with. The Unicode Bidi Algorithm derives a
paragraph's base direction from its first strong character, so an English sentence that opens with a
Hebrew word is laid out right-to-left. Morphology claims open with the word under discussion as a
matter of course — `בָּרָא is a Qal perfect…` — so this would have corrupted a large share of every
OT entry, while looking intermittent enough to be dismissed as a font glitch.

Fixed by pinning `writingDirection: "ltr"` on every prose surface that can embed an
original-language word (`LTR_PROSE` in `src/design/tokens.ts`). **This is a permanent constraint, not
a one-off patch:** any new component that renders claim or explanation text must carry it.

### 2. expo-sqlite segfaults when closing a database holding an FTS5 table

The capability probe crashed the app with `SIGSEGV`, repeatedly, and then crash-looped on launch
because expo-router restored the probe route and re-ran it. Stack:

```
exsqlite3_close -> disconnectAllVtab -> sqlite3VtabDisconnect -> sqlite3VtabUnlock
  -> fts5DisconnectMethod -> fts5FreeVtab -> sqlite3Fts5IndexClose -> exsqlite3_finalize -> SIGSEGV
```

The capabilities themselves are fine — SQLite 3.50.3, FTS5 `MATCH` returned exactly the expected two
hits, and `ATTACH` joined across two databases successfully. It is **closing** the connection that
kills the process.

This matters directly for the bundle architecture: the design is a base database with per-book
Understand bundles attached and detached as the user moves around, and every one of those databases
carries an FTS index. **Decide before the app is built** whether to (a) never close a connection
holding an FTS5 table, (b) drop the FTS table before closing, or (c) move to op-sqlite, which the
build plan already names as the fallback. Option (a) is what the probe now does, and it is a
constraint the app would have to honour everywhere.

### 3. Dynamic Type corrupts layout on a live change, and `lineHeight` double-scales

Two separate bugs found together, because the first masked the second.

**Double scaling (fixed).** The standing advice for React Native is that `lineHeight` is not scaled
by Dynamic Type and you must multiply it by `PixelRatio.getFontScale()` yourself. On RN 0.86 with
the New Architecture that is **wrong** — an explicit `lineHeight` is scaled along with `fontSize`, so
doing it by hand applies the scale twice. At AX5 that produced leading roughly 4.8x the font size,
with single words marooned in whitespace. `leading()` now expresses a ratio of the unscaled size and
lets the platform scale it.

**Live changes corrupt layout (open).** Changing the text size while the app is running leaves line
boxes computed at the old size while glyphs render at the new one: text is sliced horizontally
mid-word and lines overlap. A fresh launch at the same size renders perfectly. Verified both
directions — see `docs/0a/original-hebrew-ax3.png` (live change, corrupt) against
`docs/0a/reader-ax3-fresh-launch.png` (fresh launch, clean).

The user consequence is real: someone who changes their text size in Settings and switches back to
Yada sees corrupted scripture until they force-quit. Given the PRD's position that the audience skews
older and accessibility is non-negotiable, this needs a fix or a documented workaround before
TestFlight.

## Also found

- **The selection pill breaks at AX3.** Three labelled actions in a horizontal pill overflow the
  screen — the primary action is clipped at both ends and "Compare" is cut off entirely
  (`docs/0a/selection-pill-ax3-BROKEN.png`). It also covers the verse it acts on even at the default
  size. The pill needs to stack vertically, or shed its secondary actions, above some size
  threshold. Recorded rather than patched: it is a design decision, not a spacing tweak.
- **CocoaPods needs a UTF-8 locale.** `pod install` dies with
  `Unicode Normalization not appropriate for ASCII-8BIT` unless `LANG`/`LC_ALL` are set to
  `en_US.UTF-8`. This belongs in the repo setup notes; it cost a full build cycle.
- **pnpm needs `node-linker=hoisted`.** Metro and CocoaPods both resolve modules by walking a flat
  tree. Added to `.npmrc`.
- **Deep links prompt.** iOS shows an "Open in Yada Spike?" confirmation for every custom-scheme URL,
  so `scripts/capture-0a-matrix.sh` cannot run unattended as written. The screenshot matrix was
  captured by driving the UI directly instead. Either the script needs a universal link, or matrix
  capture stays tap-driven.
- **Scroll restoration needs care.** Estimating a pixel offset for an unmeasured row lands on the
  wrong verse (it put the reader on verse 7 instead of 34). `onScrollToIndexFailed` now gets close,
  lets rows render, then re-asks by index. Verse-ID anchoring, as the build plan requires.

## What went right

- **Hebrew is not a problem.** Niqqud and cantillation render cleanly and legibly in Noto Serif
  Hebrew, right-to-left word order is correct including wrapping onto a third line, and per-`Text`
  `writingDirection` keeps the app chrome LTR without touching the global RTL switch. This was the
  single biggest risk in the spike and it passed.
- **Polytonic Greek is not a problem.** Gentium Plus renders breathings, accents, and iota subscript
  correctly (ἀρχῇ, ἦν, θεὸς), and the system font handles Greek well enough inside claim prose.
- **One component set handles all three passages.** 1 Cor 14:34, John 1:1, and Genesis 1:1 render
  through identical components with no special-casing beyond script direction. That was the design
  brief's foundation test and it holds.
- **The claim UI reads as reference work, not as an AI product.** Quiet rows, tracked-uppercase
  labels, hairline rules, no cards, no colour-coded categories, no confidence scores.

## Deliberate deviations from the prompt

- **FlatList, not FlashList.** The rubric questions are text-layout questions, and FlashList's RN
  0.86 compatibility is avoidable risk in a spike. FlashList belongs in the real reader, where 31,000
  verses make virtualization matter.
- **Bundle size estimate skipped.** It needs real ingested text, which is out of scope here. The
  ~150MB decision is still open.
- **Design pass applied mid-spike.** The reader was rebuilt against e-reader conventions (chapter
  identity inside the scroll as a centred small-caps head, no header bar, selection pill anchored to
  the selection rather than pinned to the screen edge) after reviewing Apple Books, Fable, Pocket,
  and Matter. Container-heavy dictionary patterns were rejected as conflicting with the brief's ban
  on cards.

## Recommendation

**The rendering gate is passed. Corpus generation is not yet unblocked, and the reasons are now
specific rather than speculative.**

Hebrew and Greek both render to a standard worth building on, which was the question that could have
killed the approach. What remains are three decisions, none of which needs more spiking:

1. Turn the bidi constraint into a rule — a shared text component, so no future screen can forget it.
2. Decide the SQLite close strategy (never close / drop-then-close / op-sqlite) before the bundle
   manager is designed around attaching and detaching per-book databases.
3. Fix or document the live Dynamic Type corruption before TestFlight.

Then the two schema findings from Part 1 still stand: `WordGloss` cannot express a Hebrew word's
morpheme structure, and Hebrew morphology claims must attribute the pointing tradition rather than
assert it. Both are cheap now and expensive after Psalms and Genesis are generated.

The two spike fixtures remain `review.status: flagged` and should be read end to end before they are
trusted as regression fixtures.
