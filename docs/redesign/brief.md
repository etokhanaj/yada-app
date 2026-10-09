# Yada redesign brief

For the next `/design` session. Inputs: `audit.md` (what's wrong, screen by screen) and
`mobbin-study.md` (the patterns and their links). The frozen design brief
(`~/Downloads/Yada/yada-design-brief.md`) still governs; this brief applies it more strictly.

**Goal.** Same product, fewer words, one visible structure. A reader always knows they are still in the
chapter, which depth they are at, and how to get back. Accessibility is designed in, not checked after.

---

## 1. IA

```
Home ─────────────────────────────┐
  Continue · Start with John      │ ‹ Home
  Old / New Testament             │
  [Search] [Bookmarks] [⋯]        │
                                  ▼
READ (depth 0) ── Reader: John 1 · BSB ⌄ ── Contents sheet (books, chapters, translation)
  │ tap verse(s)
  ▼
  Action bar (docked bottom): Understand 1:1 · Original · Compare · ⋯
  │
  ▼
UNDERSTAND (depth 1) ── one sheet over the reader; medium detent, drag to large
  │  header: John 1:1 · Unreviewed
  │  What's happening
  │  What we can see ›        Where interpretation differs ›
  │  Original Greek ⌄ (inline)   Compare translations ›
  │  Passage ›   Go deeper ›
  │  footer: Back to reading
  ▼
EVIDENCE (depth 2) ── a second sheet on Understand; at most one
     Why we say this │ Word ─push→ Occurrences │ Compare the readings │ Translations │ Peek
     header: title · parent verse, ‹ back inside the sheet, × closes to Understand
     footer: Back to reading
        │ Read / jump
        ▼
     Reader at the new verse, header shows ‹ 1 Cor 14:34 (return chip)
```

**Rules**
1. `Original` and `Compare` in the action bar open **Understand**, scrolled to that section. One
   depth-1 surface, never three.
2. Never more than two sheets. Pushes happen inside the evidence sheet.
3. Every sheet header names what it is and which verse it belongs to, and stays pinned while the body scrolls.
4. Every exit names its destination: `‹ Home`, `‹ 1 Cor 14:34`, `Back to reading`.
5. Leaving the chapter always previews first (`Read 1 Timothy 2 ›`), then sets the return chip.
6. VoiceOver escape (two-finger Z) goes back one depth, always.

---

## 2. The product story

No onboarding screens. Each beat teaches the next depth once, inside the real surface, then disappears.

| Beat | What the reader sees | What they grasp |
|---|---|---|
| **First launch** | The reader at John 1, not Home. One muted line under the header: `Tap a verse to see what it meant.` | It's a Bible. I'm reading John. There is something under each verse. |
| **First tap** | Verse marked (wash + bar). Action bar docks: **`Understand 1:1`** dominant. The hint line is gone for good. | Understand is the main thing. |
| **First Understand** | Sheet at medium height; John 1:1 still visible above it. `What's happening` first. Under `WHAT WE CAN SEE`, once: `Tap a line to see the evidence.` | This explains the verse and shows its working, and I haven't left John 1. |
| **First evidence** | `Why we say this` over Understand: the claim, how we know, the Greek. Disagreements show both readings, no verdict. | Every claim has a source. Disputes are shown, not settled. |
| **First return** | `Back to reading`: John 1:1 still selected, same scroll position. Home's `Continue` now reads `John 1:1`. | Nothing here loses my place. |

`Unreviewed` opens a one-line popover: `A reviewer hasn't checked this explanation yet.`

---

## 3. Tokens

### Type

The `Aa` step multiplies sizes marked "step". At any system size of AX1 or above the step is fixed at
default, so the two never compound (audit 28–31). `Max ×` is `maxFontSizeMultiplier`; AX5 sizes
match iOS's own text styles at AX5.

| Token | Font | Size | Leading | Tracking | Step | Max × | AX5 |
|---|---|---|---|---|---|---|---|
| display | Literata | 34 | 1.15 | −0.5 | – | 1.75 | 60 |
| scripture | Literata | 21 | 1.55 | −0.1 | ✓ | 2.5 | 52 |
| verseNumber | Literata | 13 | – | 0 | ✓ | 2.5 | 33 |
| original | Gentium Plus · Noto Serif Hebrew | 24 | 1.85 | 0 | ✓ | 2.5 | 60 |
| headword | as original | 32 | 1.15 | −0.6 | ✓ | 1.8 | 58 |
| explanation | SF Pro Text | 17 | 1.5 | −0.05 | ✓ | 3.1 | 53 |
| claim | SF Pro Text | 16 | 1.45 | 0 | ✓ | 3.1 | 50 |
| sheetTitle | SF Pro Text Semibold | 17 | 1.3 | 0 | – | 2.0 | 34 |
| chrome | SF Pro Text | 17 | 1.3 | 0 | – | 2.0 | 34 |
| note | SF Pro Text | 13 | 1.4 | 0 | – | 3.1 | 40 |
| label | SF Pro Text, uppercase | 12 | 1.3 | +1.1 | – | 3.1 | 37 |

- `label` turns sentence case and untracked from AX1 (tracked capitals at 37 pt wrap mid-phrase).
- `chapterHead` is removed with the in-text chapter heads.
- Respect the system Bold Text setting; no in-app bold switch.

### Spacing

Keep `SPACE`: xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48.

| Layout token | Default | AX1+ |
|---|---|---|
| gutter | 24 | 16 |
| verse gap | 16 | 16 |
| section gap (Understand) | 32 | 24 |
| label → content | 8 | 8 |
| row padding (vertical) | 16 | 16 |
| min target | 44 × 44 | 44 × 44 |
| reader header | 44 + safe area | two rows from AX3 |
| sheet header | 56 | grows with text |
| action bar | 56 + safe area | vertical list, rows ≥ 56 |
| back-to-reading bar | 52 + safe area | one line (chrome capped at 34 pt) |
| Understand detents | medium 55% · large | opens large |

### Colour

Five tokens plus the selection wash, unchanged. What changes is how they are used: **no state is ever
carried by colour alone.**

| State | Mark |
|---|---|
| Selected verse(s) | wash + 3 pt accent bar in the leading gutter, full height of the selection |
| Translation difference | wash + 1.5 pt mutedInk underline, 2 pt offset |
| Bookmarked verse | filled bookmark glyph (accent) beside the verse number |
| Chosen option | check glyph + semibold |
| `Here` / `Next` | the word in ink + the selection bar |

Increase Contrast (iOS setting) swaps three values:

| Token | Light | Light, IC | Dark | Dark, IC |
|---|---|---|---|---|
| mutedInk | #6B635A | #4F4740 | #9A9086 | #B8AEA3 |
| divider | #E4DED4 | #8A7E6C | #2C2823 | #706659 |
| selection | #ECE6D9 | #ECE6D9 | #252118 | #252118 |

### Motion

System sheet springs; `SPRING.standard` for everything Yada animates; `momentum` only after a drag.
Reduce Motion rules are in §5.

---

## 4. Screen by screen

Copy changes are itemised in `audit.md`; this section is the layout.

**Reader.** Header: `‹ Home` (or `‹ 1 Cor 14:34` after a jump) · `John 1 · BSB ⌄` (one target, opens
Contents) · `Aa`. A hairline appears under the header once the text scrolls. No in-text chapter head.
Chapter links at the foot, 44 pt targets, then `Berean Standard Bible` in `note`. First launch only: the
hint line, `note`, mutedInk, under the header.

**Action bar.** Docked to the bottom, full width, hairline top, paper ground, no shadow. Four equal
items: `Understand 14:34` (accent, semibold) · `Original` · `Compare` · `⋯`. The selected verse scrolls to
stay above it. `⋯` opens a native menu: `Copy`, `Share`, `Bookmark` / `Remove bookmark`. AX1+: a
vertical list, same order.

**Contents sheet.** The Apple Books / Fable sheet already chosen, plus a `BSB · WEB · KJV` segmented
control at the top.

**Understand.** Pinned header: `1 Corinthians 14:34` (sheetTitle) · `Unreviewed` (label) · `×`. Medium
detent: no verse quote (it is visible above). Large detent: the verse in one 17 pt Literata line,
expandable. Order: What's happening → `WHAT WE CAN SEE` (3 rows, `Show all 7`) → `WHERE INTERPRETATION
DIFFERS` (2 rows) → `Original Greek ⌄` → `Compare translations ›` → `PASSAGE` → `GO DEEPER`. Claim rows:
the claim, a label only for `SUPPORTED` or `BACKGROUND`, and a trailing `›`. Disputed rows add
`Compare the 2 readings ›`. Go deeper rows: `1 Corinthians 11:5 — Contrast` and the one-line why. Footer:
`Back to reading`.

**Original (inline in Understand).** Interlinear word over gloss, flowing in reading direction. Below:
`Glosses: STEPBible (TAGNT, TBESG)`, then `CLOSER TO THE GREEK` with the composed rendering and
`Composed, not a word-for-word gloss.` AX3+: one word per row, original and gloss side by side.

**Evidence sheet.** Medium detent over Understand. Header: title · parent verse, `‹` when a push is
inside it, `×` back to Understand. Footer: `Back to reading`.
- *Why we say this:* the claim (claim size) → `HOW WE KNOW` + one specific sentence → evidence rows
  (`σιγάω · present active imperative, 3rd plural · MorphGNT`) → `See the word ›`.
- *Word:* headword (with the selected word marked inside the verse above, ElevenReader-style) →
  transliteration · gloss → `FORM` → `DICTIONARY FORM` (lemma, transliteration, Strong's) → `IN THIS
  VERSE` → `3 times in 1 Corinthians ›` / `9 in the Bible` → sources on one line.
- *Occurrences:* header `σιγάω in 1 Corinthians`; rows: reference label, verse with the aligned English
  word in bold, form; current verse marked `Here`. Tap → peek → `Read 1 Corinthians 14 ›`.
- *Compare the readings:* the question as title; each reading as label + case + evidence links, same
  rhythm, no colour, no winner.
- *Translations:* `BSB`, `WEB`, `KJV` stacked; differences marked (wash + underline), content words
  only. If none differ: `BSB, WEB and KJV agree here.` and the verse once. `translation_note` only on a
  real divergence.
- *Peek:* reference, relationship, the verse, `Read 1 Timothy 2 ›`.

**Passage Understand.** Same sheet. Header `1 Corinthians 14:34–35`. If the pericope has a payload:
summary, `HOW THE PASSAGE MOVES`, key ideas. Otherwise `Order in the assembly · 14:26–40` then each verse entry
under a small `14:34` label with `More on 14:34 ›`. Never a stitched explanation.

**Home.** Large `Yada` (display). First launch: `Start with John` / `Passage by passage, 46 passages`.
Returning: `Continue` / `John 8:2` / one-line excerpt; Start here moves under it until the thread is
started. Books without chapter counts. Header icons: search, bookmark, ellipsis (`Recent`, `Sources`).

**Search.** A sheet with the field focused; `Cancel`. Groups: `GO TO` (when the query parses as a
reference) → `WORDS` (5, then `Show all 25 words`) → `PASSAGES · 331`. Word rows: `ἀγάπη agapē "love"` /
`Greek · 116 times`.

**Bookmarks, Recent.** `‹ Home`. Medium-style rows. `Edit` in the header for removal. Recent's tag names
the word (`σιγάτωσαν`) or `Understand`.

**Sources.** Formerly Library. `EXPLANATIONS` (`All unreviewed drafts.`, then `Genesis · 1 verse · 44 KB`)
and `TEXTS AND DATA` (`MorphGNT · CC BY-SA 3.0` + `Source ›`; restriction notes verbatim).

**Type settings.** `Text size`: `A−  3 of 6  A+`. At AX1+: `Using iPhone text size`, steps disabled.
`Appearance`: `System` `Light` `Dark` with a check on the chosen one.

**Start here.** `‹ Home`; the next passage marked `Next` in ink with the bar; finished passages with a check.

---

## 5. Accessibility spec

### VoiceOver order and labels

| Screen | Order (labels in quotes) |
|---|---|
| Reader | "Home", button → "1 Corinthians 14, BSB", heading, button, hint "Opens books, chapters and translations" → "Text size and appearance" → verses: "Verse 34, selected, bookmarked. Women are…" with custom actions Understand, Original, Compare, Copy, Share, Bookmark → chapter links "Previous chapter, 1 Corinthians 13" → attribution |
| Action bar | after the verses, not before; "Understand verse 34", "Original Greek", "Compare translations", "More actions". Appearing does not move focus |
| Understand | announced as its own screen; "1 Corinthians 14:34, unreviewed", heading → "Close" → What's happening → "What we can see", heading → each claim: claim text, then label if any, hint "Shows why we say this" → "Show all 7" → "Where interpretation differs", heading → … → "Original Greek, collapsed" → "Compare translations" → passage → go deeper → "Back to reading, 1 Corinthians 14:34" |
| Interlinear | one element per word: original (language el/he), then "sigatōsan, let them be silent". Hebrew in logical order: the rightmost word first |
| Evidence sheet | "Why we say this, 1 Corinthians 14:34", heading → "Back to Understand" → content → "Back to reading". Escape goes back one layer |
| Word | headword (language el/he) → "sigatōsan, they should be silent" → form → dictionary form → in this verse → "3 times in 1 Corinthians, button" → sources |
| Occurrences | each row: "1 Corinthians 14:28. Form σιγάτω. But if there is no interpreter…"; current row adds "Here" |
| Translations | "BSB, your translation" → text, each marked word "differs" → WEB → KJV |
| Home | "Yada", heading → Continue, one element: "Continue reading, John 8:2. Early in the morning…" → Start with John → "Old Testament", heading → books "Genesis, 50 chapters" |
| Search | field "Search the Bible" → group headings → rows |
| Type settings | "Text size, 3 of 6", adjustable (swipe up/down) → Appearance, each option with selected state |

Every Greek or Hebrew run sets `accessibilityLanguage` (`el`, `he`), including Greek inside English claims.

### Dynamic Type to AX5

| Screen | AX1–AX2 | AX3–AX5 |
|---|---|---|
| Reader | step fixed; gutter 16; action bar becomes a list | header in two rows (`‹ Home` · `Aa`, then the title, wrapping) |
| Understand | opens at large; verse behind `Show verse`; labels sentence case | same; What's happening is the first thing after the header |
| Original | flowing interlinear | one word per row, original and gloss side by side |
| Evidence | stacked | stacked; evidence rows wrap, codes never truncate |
| Search, Home | counts move to their own line | excerpts three lines |
| Type settings | buttons stack | steps disabled, `Using iPhone text size` |

Nothing truncates with `…` at AX sizes except verse excerpts in lists, which VoiceOver reads in full.

### Contrast

| Pair | Light | Dark | Use |
|---|---|---|---|
| ink / paper | 16.97 | 15.20 | text |
| ink / selection | 14.35 | 13.04 | selected text |
| mutedInk / paper | 5.61 | 5.97 | labels, notes, verse numbers |
| mutedInk / selection | 4.75 | 5.12 | verse numbers when selected |
| accent / paper | 10.92 | 9.17 | links, selection bar, bookmark glyph |
| accent / selection | 9.23 | 7.87 | `Understand` while pressed |
| mutedInk IC / paper | 8.65 | 8.57 | Increase Contrast |
| divider IC / paper | 3.78 | 3.32 | Increase Contrast separators |
| selection / paper | 1.18 | 1.17 | never alone (§3 Colour) |

Text ≥ 4.5:1 everywhere; state indicators ≥ 3:1 through the bar, underline or glyph.

### Reduce Motion

- Sheets present and change detent with a cross-fade, no slide or spring.
- The action bar appears without movement.
- Jumps (Go deeper, occurrences, Contents) land instantly; no animated scroll.
- `Original Greek ⌄` expands without a height animation; the chevron swaps rather than rotates.
- Read `AccessibilityInfo.isReduceMotionEnabled` and listen for changes; none of this exists today.

### Targets

44 × 44 pt minimum, measured on the frame, not by hitSlop. Fix: action-bar items, header title, chapter
links, `Show all`, `⋯`, `×`. Whole claim rows, word units and list rows are the target, not their text.

### Hebrew right to left

- `writingDirection: "rtl"` per Text; never `I18nManager.forceRTL`.
- Interlinear flows from the right edge, wrapping right to left; each gloss centred under its word; the
  page around it stays LTR.
- English that contains Hebrew keeps `LTR_PROSE`.
- Transliteration is always LTR.
- Word card: the Hebrew headword aligns to the trailing edge; morpheme rows keep the Hebrew column at
  the trailing edge.
- Noto Serif Hebrew at 1.85 leading; check niqqud below the baseline for clipping at AX5.
- The search field takes its direction from the first strong character, not a fixed LTR.

### Gestures

Every gesture has a visible or VoiceOver equivalent: back one sheet (`‹` / `×`, escape), remove a
bookmark (`Edit`, custom action), extend a selection (tap another verse; hint already present), dismiss
a sheet (`×`, `Back to reading`).

---

## 6. Artboards for `/design`

Frame: iPhone 17 Pro, 402 × 874 pt. Every frame in **Light**, **Dark** and **AX5** (light). Real content
only: `golden/1co.14.34.json`, `jhn.1.1.json`, `gen.1.1.json`, BSB text from the core bundle; every entry
shows `Unreviewed`. Name frames `J01-03 · Light`.

**Journey 01: 1 Corinthians 14**

| ID | Frame |
|---|---|
| J01-01 | Reader, 1 Cor 14:33–38 |
| J01-02 | Verse 34 selected, action bar |
| J01-03 | Understand 14:34, medium detent |
| J01-04 | Understand, large, `What we can see` expanded (7 rows) |
| J01-05 | Why we say this: "σιγάτωσαν is a present active imperative…" |
| J01-06 | Understand, `Original Greek` expanded |
| J01-07 | Word: σιγάτωσαν |
| J01-08 | Occurrences: σιγάω in 1 Corinthians |
| J01-09 | Compare the readings: "Who the instruction addresses" |
| J01-10 | Peek: 1 Timothy 2:11–12, same theme |
| J01-11 | Reader at 1 Timothy 2:11, return chip `‹ 1 Cor 14:34` |
| J01-12 | 34–35 selected → Passage Understand 14:34–35 |
| J01-13 | Translations 14:34–35, differences marked |
| J01-14 | Back to reading at 14:34, exact position |

**John 1:1**

| ID | Frame |
|---|---|
| JN-01 | First launch: John 1 with the hint line |
| JN-02 | 1:1 selected |
| JN-03 | Understand 1:1, medium, first-time evidence hint |
| JN-04 | `Original Greek` expanded |
| JN-05 | Word: λόγος |
| JN-06 | Translations: all three agree |
| JN-07 | Passage Understand 1:1–5 |

**Genesis 1:1**

| ID | Frame |
|---|---|
| GN-01 | Reader, Genesis 1, 1:1 selected |
| GN-02 | Understand 1:1 (Hebrew inside English claims) |
| GN-03 | `Original Hebrew` expanded, right to left |
| GN-04 | Word: בְּרֵאשִׁית with morphemes |
| GN-05 | Occurrences: רֵאשִׁית in Genesis |

26 frames × 3 = 78 artboards. If time remains: Home (first launch, returning), Search `love`,
Contents, Type settings, in light and AX5.

---

## 7. Decisions for John

1. First launch opens the reader at John 1, not Home.
2. The action bar docks to the bottom instead of floating over the text.
3. `Library` becomes `Sources`.
4. Claim labels appear only for `SUPPORTED` and `BACKGROUND`; strong, data-grounded claims carry none.
5. TAHOT's `obj` displays as `[object]` (an abbreviation expanded, not a new gloss).

**Content notes for the pipeline, not the app:** debated claims restate their label ("…is disputed");
`key_words` notes repeat claim text on the word card. Both belong in the prompt, not the UI.

---

## 8. Amendments, 9 Oct (v2 canvas)

These supersede the sections they name. Reasons and evidence: `v2-review.md`.

1. **Understand at the medium detent** (§4): `What's happening` is clamped to four lines with `More`, so
   the first claims sit above the fold while the verse stays visible above the sheet. Large detent and
   AX sizes show it in full.
2. **Translations** (§4): only BSB, the reader's translation, carries difference marks (wash +
   underline). WEB and KJV are shown unmarked beneath it.
3. **A verse with no explanation**: the action bar is `Original · Compare · ⋯`, with no Understand and no
   placeholder text. Original opens the same sheet with only Original and Compare in it.
4. **AX action bar** (§4, §5): `Understand 14:34` and `More` only, so the list never covers the verse.
5. **Explanation type** (§3): `explanation` and passage prose set in Literata; claims stay SF Pro Text.
6. **Colour** (§3): primary actions in ink; selection `#E4EBF4` / `#232A34`; translation differences
   `#F4E7CB` / `#3A3021`; surfaces `fill`, `glass`, `sheet` as in `style-v2.css`. Navy stays for the
   selection bar and links.
7. **Reader header**: title is book and chapter, translation small beneath; title centred on the screen.
8. **Chapter numeral**: verse 1 shows the chapter number large in place of its verse number
   (VoiceOver: "Chapter 1, verse 1"). No chapter head returns.
9. **Delight** (D-01 to D-04 on the canvas): word lift into the word card, glosses arriving in reading
   order, echo pairs in Go deeper peeks, the chapter numeral. All collapse to cross-fades under Reduce
   Motion.
10. **Explanation marker**: verses with an entry end in a small muted note glyph (VoiceOver: "has an
    explanation"). No marker means no Understand for that verse.
11. **Type settings**: Appearance as three page thumbnails (System, Light, Dark), chosen = ring + check +
    semibold; a list at AX sizes.
12. **Scripture typography**: LORD in small capitals (the BSB's convention); a psalm's title (bundle
    verse 0) sits on its own italic line above verse 1.
13. **Reader title** (decided 9 Oct, after John's YouVersion recording): one centred title target, no
    split `Book | Translation` capsule. Switching translation stays at the top of Contents; seeing other
    translations is Compare's job. While reading, the header steps back to one 13 pt line under the
    island (`1 Corinthians 14 · BSB`); scrolling up or tapping it restores the controls (canvas D-05).
14. **Depth** (canvas DP-01–06, approved by John 9 Oct): the passage's key word (first `key_words`
    entry) set large in its own script, with transliteration and gloss and the passage title beneath, on
    Home's Start / Continue row and the Start here header; when the passage has no entry, the passage
    title carries it in Literata. Chapter openings show the passage title in small caps above verse 1.
    Start here passages are numbered in Literata. No illustration, mood photography or background
    watermark; manuscript photography only after image rights clear PRD 0E.
15. **Brand** (kit v1.0, 9 Oct; details `brand/README.md`): palette moves from warm paper + navy to chalk
    + forest, chartreuse as the dark-mode accent and the difference highlighter. Home title is the
    outlined wordmark. App icon, dark and tinted icons, splash symbol and web favicons from the kit.
    Kit fonts (Inter, Fraunces) and mobile UI concepts not adopted.
16. **Splash** (canvas SP-01 · Dark, chosen by John 9 Oct): the chartreuse symbol (#DBEC9A), 76 pt,
    centred on the dark ground (#0E1814), in both light and dark appearance. In light mode the reader
    (chalk) follows it: fade the splash out over 150 ms so the change from dark to chalk is a dissolve,
    not a flash; instant under Reduce Motion. No wordmark, tagline or spinner.
17. **Splash motion, "the page lifts"** (canvas SP-03–05, approved by John 9 Oct). Cold launch only, 520 ms total:
    the leaf rotates −8° about the join (0–160 ms, SPRING.standard); then the whole symbol scales to 0.9 and
    fades while the dark ground fades out over the reader, which fades in and rises 6 pt (160–520 ms).
    Layers `splash-stem.png` + `splash-leaf.png` share `splash-symbol-dark.png`'s frame; pivot at 54.4% x,
    57.0% y. Runs only once the reader is ready (never lengthens launch). Reduce Motion: 150 ms cross-fade.
    Warm launch: none. No haptic. VoiceOver focus waits for the reader.
