# v2 build plan: bringing the canvas into `apps/mobile`

Source of truth: the **v2 · Modern** page of the canvas
(https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc), `brief.md` §8 (amendments 1–13) and `v2-review.md`.
Where the canvas and the brief disagree, §8 wins; where §8 is silent, the canvas wins.

Starting point (mapped 9 Oct): Expo 57, RN 0.86, expo-router stack with native `modal` / `formSheet`
sheets, `SheetScreen` frame in `src/components/Sheet.tsx`, `SelectionPill.tsx` anchored over the text,
tokens in `src/design/tokens.ts` with `Type.tsx` text components, user state in SQLite (`src/data/user.ts`),
settings in zustand. Reanimated 4 is installed but unused; expo-blur is not installed. No
`accessibilityLanguage`, no Reduce Motion handling, one `maxFontSizeMultiplier`. Tests: Vitest on
`src/lib` and queries; 4 Maestro flows; no UI tests.

Every phase ends green on `pnpm -r typecheck` and `pnpm -r test`, its Maestro flow updated, and screenshots
on the iPhone 17 Pro simulator in Light, Dark and AX5 compared side by side with the canvas frame IDs
listed. Commit per phase; no push or PR without asking John.

---

## Phase 0 · Foundations (no visible change yet)

| Change | Where | Canvas |
|---|---|---|
| Palette v2: `sel` #E4EBF4/#232A34, `hl` #F4E7CB/#3A3021, `fill`, `glass`, `sheet`; Increase Contrast swaps, driven by iOS's darker-system-colors setting (check RN 0.86's `AccessibilityInfo` for it first; if absent, a small Expo module wrapping `UIAccessibility.isDarkerSystemColorsEnabled`) | `tokens.ts` | E-06 |
| Type v2: `explanation` → Literata; `label` sentence case, semibold, untracked; AX step lock (in-app step fixed at default once `PixelRatio.getFontScale() >= AX1`); `maxFontSizeMultiplier` per brief §3 table | `tokens.ts`, `Type.tsx` | all AX5 frames |
| `useReduceMotion()` hook (`AccessibilityInfo.isReduceMotionEnabled` + change listener) | `src/lib/motion.ts` | motion note |
| `lang` helper: wraps Greek runs `accessibilityLanguage="el"`, Hebrew `"he"` + `writingDirection:"rtl"` inside `LTR_PROSE` | `Type.tsx` (`<Prose>` parses runs) | GN-02 |
| Glass surface: add `expo-blur`; `GlassButton` (44 pt circle / capsule, blur + hairline) | `src/components/Glass.tsx` | reader header |
| Unit tests: palette contrast pairs ≥ 4.5 (text) / 3 (marks) in all four palettes; `lang` run-splitting; AX step lock | `src/design/*.test.ts` | — |

## Phase 1 · Reader

| Change | Where | Canvas |
|---|---|---|
| Floating glass header: `‹ Home` / return chip, centred title (book chapter, `BSB ⌄` beneath; one target opening Contents), `Aa`; paper fade under it; two rows at AX3+ | new `ReaderHeader.tsx` | J01-01, E-01 |
| Header steps back after 24 pt down-scroll to one 13 pt line; up-scroll or tap restores; instant under Reduce Motion | `ReaderHeader.tsx` | D-05 |
| Chapter numeral on verse 1; no chapter head; psalm superscription (verse 0) italic line; LORD small caps | `[chapter].tsx` verse renderer | D-04, P-01 |
| Selection: wash + rounded 3 pt bar, range as one block | verse renderer | J01-02 |
| Explanation marker after verses with an entry (`entryOrdsInRange`), bound to the last word, VO "has an explanation" | verse renderer | J01-01 |
| Bookmark glyph beside the verse number | verse renderer | B-03 |
| Chapter links as capsules; none past Genesis 1 / Revelation 22 | `[chapter].tsx` | E-03 |
| **Replace `SelectionPill` with a docked `ActionBar`**: ink `Understand 14:34` full width, then `α Original` · `Compare` · `⋯`; no Understand when the verse has no entry; AX: `Understand` + `More` only; selected verse scrolls above it | new `ActionBar.tsx`; delete `SelectionPill.tsx`, `src/lib/pill.ts` (+ its test) | J01-02, J01-15, E-02 |
| `⋯` as a native context menu (Copy, Share, Bookmark / Remove bookmark) | `ActionBar.tsx` | M-01 |
| First launch opens John 1 with the hint line; hint gone after the first tap (user.db flag) | `_layout.tsx` / `index.tsx` routing, `user.ts` | JN-01 |
| Haptics: `selectionAsync` on verse select (exists); rigid at sheet detent | reader | motion note |

Maestro: update 01-core-loop for the bar (testIDs move from pill to bar).

## Phase 2 · Understand and the evidence layer

| Change | Where | Canvas |
|---|---|---|
| One depth-1 sheet: `understand.tsx` absorbs `original.tsx` and `compare.tsx` (Original / Compare in the bar open Understand scrolled to that section); delete those two routes | `understand.tsx` | J01-03, J01-06 |
| Sheet chrome: inset sheet, grabber, centred title + subtitle, round `×` / `‹`, `Unreviewed` popover; `Back to reading` capsule footer; AX header: controls row, title below | rewrite `Sheet.tsx` `SheetScreen` | all sheets |
| Detents: medium 55% / large via `formSheet` `sheetAllowedDetents:[0.55,1]`; AX opens large | `_layout.tsx` options | J01-03 vs AX5 |
| What's happening clamped to 4 lines + `More` at medium | `understand.tsx` | J01-03 |
| Claim rows: label only for Supported / Background; disputed rows `Compare the N readings` | `Claims.tsx` | J01-04 |
| Original section: flowing interlinear; AX3+ one word per row; RTL for Hebrew; chosen word marked with the selection tint + ink semibold gloss; `Glosses:` line; `Closer to the Greek` | `OriginalWords.tsx` | J01-06, GN-03 |
| Evidence sheet (depth 2) pushes inside itself: Why we say this, Word, Occurrences, Compare the readings, Translations, Peek; never a third sheet | `why.tsx`, `word.tsx`, `occurrences.tsx` + new `readings.tsx`, `translations.tsx`, `peek.tsx` | J01-05…10, J01-13 |
| Translations: BSB marked (warm `hl` + underline), WEB/KJV unmarked; agreement line | `translations.tsx` (diff from `src/lib/diff.ts`) | J01-13, JN-06 |
| Peek before jump, then return chip in the reader header | `peek.tsx`, `navigation.ts` | J01-10, J01-11 |
| Passage Understand: label row + per-verse paragraphs + `More on 14:34` | `understand.tsx` | J01-12 |
| No-Greek note once (John 7:53–8:11) | `understand.tsx`, `src/lib/omissions.ts` | N-01 |
| VoiceOver: two-finger Z = back one depth; `accessibilityViewIsModal` per sheet | `Sheet.tsx` | — |

Maestro: update 02-original-languages; add 05-evidence (Understand → Why → Word → Occurrences → back).

## Phase 3 · Home, Search, Contents

| Change | Where | Canvas |
|---|---|---|
| Home: serif `Yada`, glass icon buttons, `Start with John · 46 passages, in order` or `Continue`, book list without counts | `index.tsx` | H-01, H-02 |
| Search as a sheet, field focused, `Go to` / `Words` (5 + Show all) / `Passages · N`; no-results line | `search.tsx` → formSheet | S-01…04, E-04 |
| Contents sheet: segmented BSB/WEB/KJV, book list with `Reading` row, chapter grid (current in ink) | replace the RN `Modal` in `[chapter].tsx` with a `contents.tsx` formSheet route | C-01, C-02 |

Maestro: update 03-search.

## Phase 4 · Settings, saved, Sources

| Change | Where | Canvas |
|---|---|---|
| Type settings: `A− 3 of 6 A+`; appearance thumbnails; AX: `Using iPhone text size`, list | `type-settings.tsx` | T-01 |
| Bookmarks with `Edit` (and VO custom action) instead of long press; empty state | `bookmarks.tsx` | B-01, B-02 |
| Recent (rename `explored.tsx` → `recent.tsx`), tag = word or `Understand`; empty state | `recent.tsx` | R-01, E-05 |
| Sources (rename `library.tsx` → `sources.tsx`): `Explained so far · N verses`, then Bible text / Word data rows by role; offline line; no `encumbered` text | `sources.tsx` | SO-01, SO-02 |
| Start here: done ticks, `Next` with the bar | `thread.tsx` | ST-01 |

Maestro: update 04-settings-bookmarks.

## Phase 5 · Delight and motion (last, behind Reduce Motion)

Word lift into the card (Reanimated shared transition, D-01); glosses in reading order on first open (D-02);
echo pair in peeks when both entries share words (D-03, from `related_passages` + tokens). Every one has a
cross-fade fallback; none blocks a phase above.

## Phase 6 · Verify and gate

1. Simulator pass per frame ID, Light / Dark / AX5 / Increase Contrast; VoiceOver walk of journeys J01, JN, GN.
2. `ui_audit`-equivalent by hand: 44 pt targets on the frame, nothing truncated at AX5 except list excerpts.
3. `/deslop` → `/review-code` → `/security-check` → ask John before any upload or PR.

---

## Risks and decisions to watch

- **Two-sheet stack on `formSheet`:** react-native-screens supports stacked form sheets, but pushes *inside* the
  evidence sheet need a nested stack in that route. Spike this first in Phase 2 (half a day); fallback is
  replacing content in place with an in-sheet back.
- **Blur cost:** glass over scrolling text at 120 Hz. If it drops frames, use `fill` with a 0.92 paper
  tint; the look survives.
- **Header step-back + VoiceOver:** collapse only on user scroll, never on VO focus moves, and keep the
  title element focusable in both states.
- **Deleting `SelectionPill` / `pill.ts`** removes a tested module; the bar's placement logic needs its
  own tests (verse kept above the bar).
- **Copy changes need i18n?** The app is English-only today; no translation step.
- **Open, not for the build:** PRD 0E licence questions (SBLGNT, KJV UK, STEPBible) must close before
  release; the `encumbered` notes are hidden in the UI, not resolved.

## Order of work

0 → 1 → 2 is the critical path (the reader and Understand are the product). 3 and 4 can run in parallel
worktrees after 2's sheet chrome lands, since both reuse `SheetScreen`. 5 last. Estimate, one person:
Phase 0 one day, 1 two days, 2 three to four days (incl. the sheet spike), 3 two days, 4 one and a half,
5 one and a half, 6 one day: about two working weeks.
