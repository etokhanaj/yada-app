# Yada v1 audit

Source: the 38 screenshots in `docs/app-v1/` (iPhone 17 Pro, 402 × 874 pt), checked against the
strings and styles in `apps/mobile/src`. Each screen lists what to cut or shorten (exact current copy →
proposed), IA problems, and the accessibility problems visible in that frame. System-wide findings
follow at the end.

**IA test used throughout:** within three seconds, can the reader tell where they are, which layer
they are in (Read, Understand, Evidence) and how to get back?

## Measured contrast (current tokens, WCAG 2.2)

| Pair | Light | Dark | Verdict |
|---|---|---|---|
| ink on paper | 16.97 | 15.20 | pass |
| mutedInk on paper | 5.61 | 5.97 | pass (AA text) |
| mutedInk on selection | 4.75 | 5.12 | pass, light only just |
| accent on paper | 10.92 | 9.17 | pass |
| divider on paper | 1.27 | 1.28 | decorative only |
| **selection wash vs paper** | **1.18** | **1.17** | **fails 3:1 as a state indicator** |

The selection wash is the only thing that marks a selected verse, a shaded word in Compare and the
chosen Appearance option. At 1.18:1 it is close to invisible for low-vision readers and in sunlight.

---

## 01 · Home, first launch

| Current | Proposed |
|---|---|
| `Search` · `Bookmarks` · `⋯` (text links) | Keep the three, as icons with labels for VoiceOver; text links overflow at AX sizes |
| `BEGIN READING` / `John 1` | Merge with Start here into one row: `Start with John` / `Passage by passage, 46 passages` |
| `START HERE` / `The Gospel of John, passage by passage` | (merged above) |
| `OLD TESTAMENT` | Keep |
| Chapter counts `50`, `40`, `27`… | Cut. They answer nothing the chapter grid doesn't |

**IA.** Two rows both lead into John with different labels; a first-time reader cannot tell which to
choose. Nothing on the screen says what Yada does that a Bible app doesn't.
**A11y.** Header links are 17 pt text with no padding; the hit area depends on hitSlop. Book rows pass 44 pt.

## 02 · Reader, 1 Corinthians 14

| Current | Proposed |
|---|---|
| `‹` (no label) | `‹ Home` |
| `1 Corinthians 14 · BSB` (two hidden tap targets) | `1 Corinthians 14 · BSB ⌄`, one target opening Contents, translation picker inside |
| `Aa` | Keep |

**IA.** `‹` doesn't say where it goes. The title opens Contents and `BSB` opens the translation picker,
but neither looks tappable. Verse 33 scrolls under the header with no edge, so it reads as a rendering
glitch rather than a scrolled page.
**A11y.** Title and `BSB` are 16 pt text with 8 pt hitSlop, about 37 pt tall: below 44. Verse numbers are
13 pt muted (5.61:1, pass).

## 03 · Verse 34 selected

| Current | Proposed |
|---|---|
| Floating pill `Understand · Original · Compare · ⋯` with shadow | Bottom-docked action bar, no shadow; `Understand` names the range: `Understand 14:34` |

**IA.** The pill floats over verse 33 and hides the end of its line. A floating, shadowed control is
what the brief bans ("no floating buttons").
**A11y.** Selection is the 1.18:1 wash only. Pill items are about 38 pt tall (16 pt label, 10 pt
vertical padding). `⋯` is about 38 pt wide.

## 04 · Understand 1 Cor 14:34

| Current | Proposed |
|---|---|
| `1 CORINTHIANS 14:34` / `DRAFT · NOT YET REVIEWED` (two stacked labels) | One line: `1 Corinthians 14:34 · Unreviewed` in the sheet header |
| Verse repeated at scripture size (4 lines, 21 pt) | Cut at the medium detent: the verse is visible, selected, in the reader above. At the large detent, one line at 17 pt |
| `WHAT WE CAN SEE` | Keep |
| `STRONG` above each claim | Cut when strong (the group header already vouches). Label only the exceptions: `SUPPORTED`, `BACKGROUND` |
| `‹ Back to reading — 1 Corinthians 14:34` | `Back to reading` (the header already names the verse; VoiceOver keeps the reference) |

**IA.** The sheet is full height, so the reader underneath is gone and "I'm still reading" is lost.
Claim rows have no visible affordance, so the signature "Why do we say that?" is undiscoverable.
"STRONG" reads as Strong's numbers to anyone who knows Bible tools.
**A11y.** Text runs under the footer with no edge (`The subject of σιγάτωσαν is αἱ γυναῖκες, a` is cut
mid-line). Greek inside English claims has no `accessibilityLanguage`, so VoiceOver spells it out in
an English voice.

## 05 · Why do we say that?

| Current | Proposed |
|---|---|
| `WHY DO WE SAY THAT?` / `DRAFT · NOT YET REVIEWED` | Header `Why we say this` · subtitle `1 Corinthians 14:34` |
| `STRONG` under the claim | Cut |
| `GROUNDING` | `HOW WE KNOW` |
| `Recoverable from the source data Yada ships: the Greek or Hebrew text, its morphology, or the alignment tables.` | Specific to the claim: `From the Greek text and its parsing (MorphGNT).` |
| (model knowledge) `Background knowledge, not grounded in a dataset Yada ships. Claims like this are capped at "supported" and never shown as strong.` | `From general scholarship, not from Yada's data.` |
| `σιγάω  G4601` / `V-PAM-3P` / `MORPHGNT` | `σιγάω · present active imperative, 3rd plural · MorphGNT` (cut the code and the Strong's number here; both stay on the word card) |
| `1 Corinthians 14:34 ›` | `See the word ›` (it currently links to the verse you are already on) |

**IA.** A second sheet is stacked on Understand, but the only visible exit is `Back to reading`, which
skips Understand. Getting back one layer needs a swipe.
**A11y.** Back-one-layer is gesture-only. Two-thirds of the sheet is empty, yet it is full height.

## 06 · Understand, Original expanded

| Current | Proposed |
|---|---|
| `DISPUTED` above `Who the instruction addresses is disputed.` | Cut the label; the group header `WHERE INTERPRETATION DIFFERS` already says it |
| `Compare 2 positions` | `Compare the 2 readings ›` |
| `Original Greek · Hide` | `Original Greek` with a disclosure chevron; state goes to VoiceOver as expanded/collapsed |
| `Word-for-word glosses from the STEPBible alignment data (TAGNT, TBESG). Derived, not composed.` | `Glosses: STEPBible (TAGNT, TBESG)` |
| `CLOSE RENDERING` + `Composed to sit close to the Greek or Hebrew; not a word-for-word gloss.` | `CLOSER TO THE GREEK` + `Composed, not a word-for-word gloss.` |
| Gloss `Not` (capitalised) | `not` (display lower-case unless the Greek is a proper noun) |

**IA.** Scrolled, the sheet has no persistent header: `WHERE INTERPRETATION DIFFERS` is clipped at
the top edge and nothing says which verse this is.
**A11y.** Greek ano teleia (`·`) renders as a small ring after `γυναῖκες` and `ἐπιτρέπεται`: check the
glyph in Gentium Plus. Each word/gloss pair needs to be one VoiceOver element.

## 07 · Word card σιγάτωσαν

| Current | Proposed |
|---|---|
| `ORIGINAL GREEK · 1 CORINTHIANS 14:34` | Sheet header subtitle `1 Corinthians 14:34` |
| `Gloss from TAGNT` | Cut; sources move to one line at the foot |
| `FORM` / `PARSING: MORPHGNT` | `FORM`; cut the parsing label |
| `Usually glossed "were silent" — the commonest of its word-for-word glosses in the STEPBible alignment data.` | `Usually "were silent".` |
| `FROM THE EXPLANATION` / `DRAFT · NOT YET REVIEWED` | `IN THIS VERSE` (the sheet header already carries `Unreviewed`) |
| `3 in 1 Corinthians · 9 in the Bible` / `See occurrences in 1 Corinthians ›` | `3 times in 1 Corinthians ›` / `9 in the Bible` |
| (new) | Foot: `Gloss: TAGNT · Parsing: MorphGNT` |

**IA.** The third stacked sheet. All three carry the same footer, so depth is invisible. The brief
asks for a popover-weight card, not a full-height page.

## 08 · Occurrences σιγάω

| Current | Proposed |
|---|---|
| `OCCURRENCES IN 1 CORINTHIANS` | Header `σιγάω in 1 Corinthians` |
| `3 verses` | Cut (the list is three rows; the word card already said 3) |
| `YOU ARE HERE` (accent) | `Here`, in ink, plus the selection bar on the row |

**A11y.** "You are here" is carried by colour. Rows need the form (`σιγάτω`) labelled with
`accessibilityLanguage="el"`.

## 09 · After a jump, 1 Timothy 2:11

| Current | Proposed |
|---|---|
| `‹ 1 Corinthian…` (truncated) | `‹ 1 Cor 14:34` (abbreviated book, full reference to VoiceOver) |
| `Berean Standard Bible` (footer) | Keep, note size |

**IA.** The return label truncates and the destination is unreadable. The action bar re-appears over
verse 10. The previous chapter link `‹ 1 Timothy 1` sits beside the return control `‹ 1 Corinthian…`,
two different "back" meanings on one screen.
**A11y.** Chapter links are 16 pt with 8 pt hitSlop, about 37 pt.

## 10 · Back to reading, exact position

Works: verse 34 is selected at the same scroll offset. Keep. Same issues as 02 and 03.

## 11 · John 1, verses 1–4 selected

| Current | Proposed |
|---|---|
| `JOHN 1` chapter head + rule under the header `John 1 · BSB` | Cut the in-text head and rule; the header is the heading |
| `Understand` | `Understand 1:1–4` |

**IA.** The pill sits on the chapter head. Nothing confirms that the action applies to four verses.

## 12 · Passage Understand, John 1:1–4

| Current | Proposed |
|---|---|
| `JOHN 1:1–4` + the four verses in full (half the screen) | Header `John 1:1–4`; verses visible in the reader above (medium detent) |
| `JOHN 1:1–18` / `The Word became flesh` | `The Word became flesh · 1:1–18` |
| `JOHN 1:1` / `DRAFT · NOT YET REVIEWED` / paragraph / `Understand John 1:1 ›` | `1:1` as a small label, paragraph, `More on 1:1 ›` |

**IA.** Three references at three scopes (1:1–4, 1:1–18, 1:1) with the same label style; the reader
cannot tell which one the page is about.

## 13 · Understand John 1:1

| Current | Proposed |
|---|---|
| `STRONG`, `STRONG`, `STRONG` | Cut all three |

Otherwise as 04.

## 14 · Original, Genesis 1:1

| Current | Proposed |
|---|---|
| `ORIGINAL HEBREW · GENESIS 1:1` (separate sheet) | Opens Understand scrolled to `Original Hebrew`, expanded |
| English verse in muted serif | Cut (visible in the reader above) |
| `Word-for-word glosses from the STEPBible alignment data (TAHOT). Derived, not composed.` | `Glosses: STEPBible (TAHOT)` |
| Gloss `obj`, `and obj` | Display `[object]`, `and [object]`; the source gloss is an abbreviation |

**IA.** `Original` from the action bar opens a different-looking sheet from `Understand`, so the
reader meets two destinations for one layer.
**A11y.** VoiceOver order must follow reading order (right to left), not the visual left-to-right
scan. Hebrew needs `accessibilityLanguage="he"`.

## 15 · Word card בְּרֵאשִׁית

| Current | Proposed |
|---|---|
| `ORIGINAL HEBREW · GENESIS 1:1` | Header subtitle `Genesis 1:1` |
| `Gloss from TAHOT` | Cut (moves to foot) |
| `PARSING: OPEN SCRIPTURES HEBREW BIBLE` | Cut (foot: `Parsing: OSHB`) |
| `Usually glossed "beginning of" — the commonest of its word-for-word glosses in the STEPBible alignment data.` | `Usually "beginning of".` |
| `FROM THE EXPLANATION` / `DRAFT · NOT YET REVIEWED` | `IN THIS VERSE` |
| `3 in Genesis · 51 in the Bible` / `See occurrences in Genesis ›` | `3 times in Genesis ›` / `51 in the Bible` |

**A11y.** The headword sits right-aligned while every label is left-aligned: correct for Hebrew, but
the morpheme table mixes RTL glyphs in a left column. Keep the Hebrew column on the right edge.

## 16 · Psalm 23, verse 3 selected

| Current | Proposed |
|---|---|
| `PSALM 23` + rule | Cut (header carries it) |

**IA.** The pill covers the end of verse 2 (`waters`).

## 17 · Original, Psalm 23:1 with title

| Current | Proposed |
|---|---|
| `ORIGINAL HEBREW · PSALMS 23:1` | `Psalm 23:1` (the header says `Psalm 23`; use the singular everywhere) |
| Gloss `shepherd my` | Known TAHOT limitation (handoff §8); flag, don't fix in UI |

## 18 · Original, John 8:3–5 (no Greek)

| Current | Proposed |
|---|---|
| `There is no Greek for this verse. The earliest manuscripts omit it, so SBLGNT, the Greek text Yada uses, does not include it. The English is shown as the translation prints it.` | Once, above the verses: `John 7:53–8:11 is not in the earliest manuscripts, so Yada's Greek text has none of it.` |
| `No Greek for this verse either.` (×2) | Cut |
| `JOHN 8:3` in ink, verse in muted serif | Label muted (as everywhere else), verse in ink |

## 19 · Home, returning reader

| Current | Proposed |
|---|---|
| `CONTINUE READING` / `John 8:2` / excerpt | `Continue` / `John 8:2` / excerpt, one line |
| `START HERE` row still shown | Show only until the thread is started; then its place is Continue |

**A11y.** The excerpt is muted serif at about 22 pt and truncates mid-word (`peo…`); VoiceOver should
read the full verse.

## 20 · Search, `jn 3 16`

| Current | Proposed |
|---|---|
| `‹ Back` + large title `Search` | Search as a sheet with the field focused; `Cancel` closes it |
| `REFERENCE` | `GO TO` row above the groups: `John 3:16 ›` |
| (empty field) placeholder `Jn 3:16, love, λόγος` | Keep (it teaches the three query types) |

**IA.** `‹ Back` names no destination. A third group label (`REFERENCE`) appears beside the agreed
`PASSAGES` / `WORDS`.
**A11y.** The field has no visible boundary beyond a 1.27:1 hairline and no search glyph.

## 21 · Search, `love`

| Current | Proposed |
|---|---|
| `H0157 · 211 occurrences · Hebrew` | `Hebrew · 211 times` (Strong's moves to the word card) |
| `Show all 25 words` | Keep |
| `PASSAGES · 331 IN BSB, FIRST 100 SHOWN` | `PASSAGES · 331`; say `Showing 100` only at the end of the list |

**A11y.** Matched term is bold, not coloured: good.

## 22 · Search, `λόγος`

| Current | Proposed |
|---|---|
| `G3056 · 330 occurrences · Greek` | `Greek · 330 times` |

## 23 · Occurrences λόγος in the Bible

| Current | Proposed |
|---|---|
| `OCCURRENCES IN THE BIBLE` / `318 verses` | `λόγος in the Bible` / `330 times in 318 verses` (search said 330, this says 318: state both once) |
| `‹ Back to search` | Keep (correct destination), but as the sheet header back |

**IA.** The English verse never shows which word renders λόγος (`except for sexual immorality`
hides it entirely). Bold the aligned English word when the alignment exists.

## 24 · Type settings

| Current | Proposed |
|---|---|
| `TEXT SIZE` / `A` `A` | `Text size` / `A−` `3 of 6` `A+`, the value between the buttons |
| `Step 3 of 6. Works on top of the system text size.` | Cut. At AX sizes replace with `Using iPhone text size` and disable the steps |
| `APPEARANCE` / `System` `Light` `Dark` | Keep; mark the chosen one with a check, not only the wash |

**A11y.** `A` / `A` buttons have no visible state; the chosen appearance is a 1.18:1 wash plus bold.

## 25 · Dark, type settings over the reader

**A11y.** In dark, the sheet edge and the scrim are nearly invisible: sheet paper over a darkened
paper. Add the grabber in mutedInk (5.97:1) and a divider-coloured top edge.

## 26 · Dark reader

Same as 02. Dark `‹` in accent is a 17 pt glyph.

## 27 · Compare, John 1:1 (dark)

| Current | Proposed |
|---|---|
| `COMPARE TRANSLATIONS · JOHN 1:1` | Header `Translations` · subtitle `John 1:1` |
| `Words that differ from BSB, the translation you are reading, are shaded.` | Cut. When nothing differs: `BSB, WEB and KJV agree here.` and show the verse once |
| `BSB · READING` | `BSB` (it is listed first; VoiceOver: "BSB, your translation") |

**IA.** Three identical paragraphs and an instruction about shading that shades nothing.

## 28 · AX3, live change, reader + pill

**A11y.** The app's own text step multiplies Dynamic Type: three words per line. The vertical action
list covers most of the selected verse it acts on. Header items grow to about 40 pt and will collide at
AX5.

## 29 · AX3, type settings

**A11y.** The helper sentence wraps to three lines. Appearance correctly becomes a vertical list.

## 30 · AX3, reader, light

Same as 28.

## 31 · AX3, Understand John 1:1

**A11y.** The first screen holds the reference, a two-line `DRAFT · NOT YET / REVIEWED` label and six
words of the verse. No explanation is visible: the brief's "if the user has to scroll significantly"
test fails. The footer wraps to two lines and takes about 15% of the screen.

## 32 · Compare, 1 Cor 14:34–35

| Current | Proposed |
|---|---|
| `COMPARE TRANSLATIONS · 1 CORINTHIANS 14:34–` / `35` | Header `Translations` · subtitle `1 Corinthians 14:34–35` |
| `Shaded: words a version does not share with BSB, and in BSB, words neither of the others uses.` | Cut |
| `BSB · READING` (×2) | `BSB` |

**A11y.** About half the words are shaded, so the shading carries no signal, and it is colour-only at
1.18:1. Mark differences with an underline as well as the wash; VoiceOver already says "differs"
(compare.tsx) and should keep doing so.

## 33 · More actions, 14:34–35

| Current | Proposed |
|---|---|
| Centred alert: `1 Corinthians 14:34–35` / `Copy` `Share` `Bookmark` `Cancel` | Native menu from `⋯`: `Copy`, `Share`, `Bookmark` (or `Remove bookmark`); no `Cancel` |

## 34 · Bookmarks

| Current | Proposed |
|---|---|
| `‹ Back` | `‹ Home` |
| (empty state) `Nothing bookmarked yet. Select a verse while reading, then ⋯ › Bookmark.` | `No bookmarks yet. Tap a verse, then ⋯ › Bookmark.` |

**A11y.** Removal is long-press only (`Long press for more`): add an `Edit` button and a VoiceOver
custom action. In the reader, a bookmarked verse is marked only by an accent-coloured verse number.

## 35 · Recently explored

| Current | Proposed |
|---|---|
| `Recently explored` | `Recent` |
| `UNDERSTAND` / `A WORD` | `Understand` / the word itself: `σιγάτωσαν`, `בְּרֵאשִׁית` |
| (empty) `Verses you look underneath — Understand, Original, a word — appear here.` | `Verses you explore appear here.` |

## 36 · Library

| Current | Proposed |
|---|---|
| Title `Library` | `Sources` (Library means "my books" in every reading app) |
| `UNDERSTAND BOOKS` | `EXPLANATIONS` |
| Per row `1 verse explained · version 1` / `DRAFT · NOT YET REVIEWED` (×7) | Row `Genesis · 1 verse · 44 KB`; one line under the label: `All unreviewed drafts.` |
| `All 66 books' text and original language: 83.7 MB, included with the app.` | `Bible text, Greek and Hebrew: 83.7 MB, built in.` |

## 37 · Sources & licences

| Current | Proposed |
|---|---|
| `Morphological annotations from MorphGNT, licensed CC BY-SA 3.0.` + `CC-BY-SA-3.0 · MORPHGNT` + raw URL | `MorphGNT · CC BY-SA 3.0` + `Source ›` (opens the URL) |
| Same pattern for every source | Same fix; keep every `Restriction:` note verbatim (licence obligations) |

**IA.** The large title `Library` stays pinned while rows scroll under it and clip
(`morphgnt/sblgnt (morphological annotations)`).

## 38 · Start here, John

| Current | Proposed |
|---|---|
| `‹ Back` | `‹ Home` |
| `THE GOSPEL OF JOHN · 46 PASSAGES` | Keep |
| Row 1 in accent with `· next` | `Next` label in ink beside the reference, plus the selection bar |

**A11y.** "Next" is carried by accent colour and a 15 pt muted word.

---

## System-wide findings

### Deslop, in one list

1. `DRAFT · NOT YET REVIEWED` appears up to three times on one sheet and seven times on Library.
   Show `Unreviewed` once, in the sheet header.
2. Evidence-strength labels on every claim (`STRONG`). Label only what changes how a row is weighed.
3. `DISPUTED` above sentences that end "is disputed".
4. Three different provenance captions per word (`Gloss from TAGNT`, `PARSING: MORPHGNT`, the
   STEPBible sentence). One source line per card.
5. Helper sentences that restate the layout: the Compare shading notes, `Step 3 of 6. Works on top…`,
   `· Hide` / `· Show`.
6. The verse repeated at full scripture size at the top of every layer.
7. In-text chapter heads that repeat the header.
8. `‹ Back to reading — 1 Corinthians 14:34` when the header already names the verse.

### IA

1. **One layer, three looks.** `Understand`, `Original` and `Compare` open three different sheets.
   The brief says one scrolling surface.
2. **Depth is invisible.** Understand → Word → Occurrences stacks three full-height sheets with the same
   footer. There is no visible "back one layer"; only a swipe.
3. **The reader disappears.** Every layer is a full-height modal; the brief's "reader visibly
   remains underneath" is not met.
4. **No persistent location in sheets.** Scrolled sheets lose the reference (06, 07).
5. **Unlabelled exits.** `‹`, `‹ Back`, `‹ 1 Corinthian…`.
6. **Hidden controls.** Header title and translation, claim rows: all tappable, none look it.
7. **Inconsistent counts and names.** 330 occurrences vs 318 verses; `Psalm 23` vs `PSALMS 23:1`;
   `Library` for sources.
8. **No product story.** Nothing in the first minute says what Yada is for or teaches the tap.

### Accessibility

1. **State by colour alone:** selected verse, Compare differences, bookmarked verse number, `next` in
   Start here, `YOU ARE HERE`, chosen appearance. The wash is 1.18:1.
2. **Dynamic Type compounds.** The in-app text step multiplies the system size (28–31). Understand at
   AX3 shows no explanation on the first screen. Tracked uppercase labels wrap mid-phrase.
3. **Targets under 44 pt:** action-bar items (about 38), header title and `BSB` (about 37), chapter
   links (about 37), `Show all` (about 37), `⋯` (about 38 wide).
4. **No `accessibilityLanguage`** on Greek or Hebrew anywhere: VoiceOver reads them in an English voice.
5. **No Reduce Motion handling** in the codebase (no `isReduceMotionEnabled` or equivalent).
6. **Gesture-only paths:** back one sheet layer (swipe), bookmark removal (long press).
7. **Edges missing:** text scrolls under the reader header and the sheet footer with no divider, so
   cut-off lines read as errors.
8. **Dark sheets** have no visible edge against the scrim.
