# QA G, part 2: study notes, See also, People, iCloud, Understand, and a regression sweep

Branch `qa-study` from `new-flows` (11 Oct 2026). Release simulator build on "iPhone 17 Pro qa-study"
(iOS 26.5), served by a local QA manifest server on port 8796 that can hang or fail a study bundle
(SN-04 Genesis, SN-05 Psalms) or be stopped (SN-06, 1 Corinthians). Mockups rendered from the canvas
`.dc.html` files: `mock-<frame>.png` (Light, Dark, AX5 side by side). App captures:
`app-<frame>-light.png`, `-dark.png`, `-ax5.png` (AX5 = accessibility-extra-extra-extra-large, light).

Accepted departures, not flagged: wording follows the reviewed bundles; the iCloud line is one
sentence in both cases; Go further second lines are capped at 2× at AX5.

## Counts

| Severity | Found | Fixed | Left |
|---|---|---|---|
| Blocker | 0 | 0 | 0 |
| Visible | 10 | 9 | 1 (MT-02, needs John) |
| Nit | 10 | 0 | 10 |

Plus one item from the guide QA (PG-04, below): fixed.

## Differences

`frame · theme · what differs · severity` → status

### Study notes, See also, People

- SN-01 · all · Go further order was Original, Compare, Study notes, See also, passage; the frame has
  Original, Study notes, See also, Compare, passage · visible → **fixed** (`ea950c0`). People rows sit
  just before Study notes, as they lead without an entry (TD-01).
- SN-04/05/06 · all · the study line (getting / failed / offline) sat under the last Go further row,
  where the sheet's foot hides it; the frames put it in its own place straight above Go further ·
  visible → **fixed** (`ea950c0`). Genesis 1:1, Psalm 23:1 and 1 Cor 14:34 all have entries, so the
  line sits after Where readers differ and before Go further.
- SN-05 · all · Try again was an accent text link under the line; the frame has a filled capsule
  (44 pt) at the line's trailing edge, under it at AX5 · visible → **fixed** (`1305c91`).
- SN-03/SN-08/TD-01 · all · See also row names were weight 600; `.row.xr .xref` is 500 · visible →
  **fixed** (`1305c91`).
- SN-03/SN-08/TD-01 · light, dark · a See also verse was cut at three lines; the frames show it in full
  (AX5 still caps at four) · visible → **fixed** (`1305c91`).
- SN-07 · all · a See also row for John 3:19–20 arrived with only 3:19 selected and the bar said
  "Understand 3:19"; the frame selects both verses · visible → **fixed** (`1305c91`, new `to` on
  `ReaderTarget`, read by the reader).
- SN-07 · AX5 · the jump landed a fifth of the way down, under the two-row AX header, so the verse's
  first lines (and its number) were hidden · visible → **fixed** (`2c9de01`): at AX sizes a jump lands
  just below the header, as a resumed place does.
- SN-05 (and P-02, regression) · all · titles read "Psalms 23:1"; every frame says "Psalm 23:1" ·
  visible → **fixed** (`350a8d9`, schema `formatDisplayRef`, app `formatRange`, `rangeTitle`). The
  passage line kept "23, title–6" through one new helper, `formatRangeInBook` (`8b47d11`).
- SN-03 · all · a ranged OpenBible row ends "… were evil. …" (the range's first verse, then " …"); the
  frame shows no trailing ellipsis · nit, left: the ellipsis says the range goes on (lib/study.ts).
- SN-09 · all · glosses "In", "Word" capitalised and "Glosses: STEPBible (TAGNT)"; the frame has
  lower case and "(TAGNT, TBESG)" · nit, left: data, rule 4.
- SN-03 · light · medium detent top at 48 % of the screen against 44 % in the frame · nit.
- TD-03 · all · Search shows a Words row (Νικόδημος) between People and the verses, and labels them
  "Passages · 5" where the frame says "Verses"; excerpts open on the hit ("…of the Pharisees named
  Nicodemus") where the frame starts at the verse · nit, left: the earlier-approved S-02 search body
  (Words, Passages · N, excerpt around the hit) governs; TD-03's point, People first, holds.
- AX5 · Understand row names (Go further, People, See also) grow to 2× (34 pt) while some frames draw
  them at the claim size (TD-01 "Nicodemus" ~50 pt) · nit, left: brief §3 caps chrome at 2×, and the
  frames disagree among themselves (SN-04 draws 34 pt).
- SN-02, SN-08, TD-02 · all · match.
- IC-01 · all · matches (the line wraps to two lines at the default size; accepted wording).

### Regression sweep (v2 frames)

- MT-01 / C-01 · all · the current book showed its tick and a chevron; the frame has the tick alone ·
  visible → **fixed** (`3cb708f`).
- MT-02 · all · the header's left slot holds "Choose" (pick Compare's versions) where the frame has ‹
  back to Contents; × still closes · visible, **left**: it follows the "Compare cap" plan cited in
  `app/translations.tsx`; John to say whether ‹ returns.
- MT-02 · all · download rows show "3.4 MB" without the year ("1901 · 1.3 MB" in the frame) · nit,
  left: manifest data.
- S-02 · all · excerpts open a few words before the hit ("…son Isaac, whom you love") where the frame
  starts at the verse · nit, left: `excerptAroundHit` was a deliberate change so the hit is always seen.
- S-03 · all · "λόγος" lists λόγος only; the frame also lists λέγω and λογίζομαι · nit, left: unchanged
  since master, the frame's extra rows are illustrative.
- SO-01 · all · subtitle "Built-in texts need no connection. Downloaded translations work offline once
  saved." against "All of it is on your iPhone…" · nit, left: rewritten for downloads; flow 04 asserts it.
- DP-06 · all · "Preposition + common noun" against "Preposition with noun" · nit, left: morph data.
- S-01, C-02, B-01, B-03, R-01, T-01, JN-05, U-03 (Original now opens in place with a bare chevron,
  per SN-09) · match.

### From the guide QA (PG-04)

- PG-04 · all · a verse's Understand pushed inside the passage guide showed the verse line ("Show
  verse" at AX5), the first-time hint "Tap a line to see the evidence." and the Supported / Background
  labels, none of which PG-04 draws · visible → **fixed** (`78eacfa`): `UnderstandRoute inGuide`
  (set by `app/guide/verse.tsx`) drops all three; the hint is not marked seen there, so it still shows
  the first time Understand opens on its own. Outside the guide the hint stays (JN-03 draws it, once)
  and so do the labels (U-01, U-04 draw them). Capture: `app-PG-04-light.png`.

## Accessibility checks

- × is the only exit, labelled "Close, back to reading", on Understand, Study notes, See also and the
  profile; ‹ inside the sheet goes back one page.
- VoiceOver: the study line is `role="status"` and now comes before Go further, as on screen. Try
  again is one 44 pt button ("Try the study notes download again"). Rows speak name and second line
  ("Study notes, Tyndale, 2 notes"; "Original Greek, 17 words, 6 grammar notes, collapsed").
- Original swaps its chevron rather than rotating it, so Reduce Motion needs nothing.

## Files touched outside study and Understand

- `app/read/[book]/[chapter].tsx`: the `to` param (range arrives selected) and the AX landing. Shared
  with the guide and audio work; no audio lines changed.
- `app/guide/verse.tsx`: one prop, `inGuide` (guide QA's request).
- `packages/schema/src/refs.ts`: `formatDisplayRef` says Psalm for one psalm.

## Gates

`pnpm -r typecheck` and `pnpm -r test` exit 0 (checked directly) after every code commit.

Maestro 2.11 on the erased qa-study simulator, 07-guide-start first, against the QA manifest server:
all nine flows (01–06, 07-guide-start, 07-study-notes, 08) pass on the final build (`78eacfa`).
Three things the run needed, none of them app changes:

- On this simulator iOS 26.5 shows "Open in “Yada”?" for every `simctl openurl`, even after Open,
  and the flows do not answer it. The run used copies of the flows with a tap on Open after each
  `openLink` (scratchpad, not committed). Package F's run passed without one, so the prompt may belong to a freshly erased simulator; worth a line in the flow headers once confirmed.
- 07-study-notes: See also rows now show their verse in full (SN-03), so the OpenBible credit sits a
  scroll lower; the flow now scrolls to it (committed).
- 01-core-loop's last step expects 1 Tim 2:11's bar to keep Original, which holds only while 1 Timothy's
  study bundle is not on the phone. With a manifest that lists every study bundle, the notes download
  and the bar offers Understand, as package A intends ("every verse's bar offers Understand"). The run
  served 1 Timothy's bundle as a failure; the step needs a verse with no notes, cross-references or
  people once study bundles are published. Not changed here: the flow is the core loop's, not study's.
