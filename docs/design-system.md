# Yada's design system

What every screen is built from, in one place. Written after the design QA of 18 Oct 2026 found the same mistakes across
the app: the 15 Oct polish (`docs/redesign/polish-2026-10-15.md`) had been decided but never applied to the shared
components, and screens were built from the wrong pieces. The rules marked **(tested)** are checked by
`apps/mobile/src/design/system.test.ts`; break one and `pnpm test` fails.

## Where the truth lives

| What | Source | Notes |
|---|---|---|
| Approved screens | the canvas, https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc | the newest frame of a screen wins; page order v2 < guide < next < b6 < sys < b7 < b9 |
| Decisions that change frames | `docs/redesign/polish-2026-10-15.md`, the build plans, `docs/build-6-decisions.md` | a frame drawn before a decision is read through it |
| Colour | `apps/mobile/src/design/palette.ts` | Light, Dark, and the high-contrast pair; nothing else hard-codes a colour except the brand forest and chartreuse on the forest cards |
| Type | `apps/mobile/src/design/type.ts` | every step has its AX5 size |
| Space, controls, springs | `apps/mobile/src/design/tokens.ts` | `useLayout()` gives the gutter, section gap, pill and control sizes for the reader's text size |

Before building a screen: open its newest frame, read the decisions, draft it with `/design` if no frame exists, cite the
Mobbin screen in a comment (CLAUDE.md).

## Colour

- White ground, neutral greys, forest (#183F35) as the accent; chartreuse (#DBEC9A) is dark mode's accent and the
  difference highlighter. Chartreuse is never text on white.
- `ink` for text, `mutedInk` for secondary, `divider` for hairlines, `card` (#F4F4F2) for a card's soft fill, `fill` for a
  capsule or a disc on paper, `sheet` for a sheet's ground.
- The forest card (#183F35, dark #1E4A3E) is for the one thing to tap next: Daily prayer, the calm close, the end of a
  book. Its kicker is chartreuse, its text white.
- No state by colour alone: a wash always comes with a bar, an underline or a word.
- System surfaces (widgets, Lock Screen, Live Activity, the reminder's long-press) use the same palette, copied into
  each target's `expo-target.config.js` and asset catalogue **(tested**, `src/lib/systemSurfaces.files.test.ts`).

## Type

| Use | Component, step | Size (default → AX5) |
|---|---|---|
| Scripture, passage titles, book names, the day's verse, prompts the reader writes into | `Scripture`, or `Chrome` with `FONTS.scripture` | 21 → 52 (`scripture`) |
| Explanations | `Prose` (`explanation`, Literata) | 17 → 53 |
| Page titles, Today's greeting | `pageTitle`, bold sans | 34 → 58 |
| Section titles | `SectionTitle` (22 on a page, `inSheet` 20) **(tested)** | 22 → 40 |
| Controls, row titles | `Chrome` (`chrome`) | 17 → 34 |
| Notes and captions | `Chrome step="note"` | 13 → 40 |
| A small caption inside a block (a reference over a line) | `Label` | 13 → 37; never a section title **(tested)** |

Scripture is never set in the system sans: Sit with this and Pray for someone did, and read as forms (design QA).

## Layout

- 20 pt side margins (16 at AX sizes), 40 pt between sections (24 at AX): `useLayout()`.
- Rows (`ListRow`) are 56 pt with a hairline between them **(tested)**.
- Every target is at least 44 pt.
- A page that sits under the tab bar pads its foot so its last row scrolls clear (`PageScreen clearTabBar`).

## Components: which one, when

| You need | Use | Never |
|---|---|---|
| A page pushed onto the stack | `PageScreen` (back capsule naming where it goes, large title) | |
| Anything presented as a sheet (`options={sheet}`, `formSheet`) | `SheetScreen` (title, round × and ‹, its own scroll) **(tested)** | `PageScreen` inside a sheet: its scroll view collapses and the sheet draws blank (Ask for prayer, TestFlight build 9) |
| A full-screen moment (Return, end of a book, Daily prayer, Sit with this) | a `fullScreenModal` route with its own ground, a 44 pt × top left, one primary pill at the foot | a white page with a large title |
| A section inside a sheet | `Section` from `Sheet.tsx` (bold ink title) | a hand-made `Label` heading |
| One tappable self-contained thing (the reading to do now, a plan, the day's picture) | a card: `card` fill, 24 pt radius, no shadow, never nested, never around text or a list | a box around a list or a paragraph |
| A list | `ListRow`s on paper, hairlines between | cards around rows |
| The primary action | an ink pill (forest on full-screen moments and the forest card's white) | two primaries on one screen |
| A secondary action | a `card`-filled pill, or a text link in `mutedInk` | |
| A disabled action | the same pill on `card` with `mutedInk` text | grey pill with white text |
| Round controls (×, ‹) in sheets | white circle with a hairline ring (`sheet` + `edge`) | grey discs |
| A text field | the field itself carries the words; a pill-shaped field on `card` for short answers; Literata for what the reader writes to God or about Scripture | an `Alert.prompt` for anything a reader will meet more than once |
| A picture that fills a box (Today, the day's verse, Return, Daily prayer, the share image) | `FillPicture` in a box that clips (`overflow: "hidden"`) **(tested)** | an `<Image>` with `StyleSheet.absoluteFill`: it drew far larger and showed a corner of the picture; unclipped, it drew past its box |
| An action bar for a field | `InputAccessoryView` over the keyboard, and the same bar in the sheet when no on-screen keyboard is up | a button the keyboard covers |

## Motion and accessibility

- Springs from `tokens.ts`; Reduce Motion swaps every movement for a cross-fade or none (`useReduceMotion`).
- Reduce Transparency: text over a picture sits on a darker full-bleed fade, at least 86% under the words (about 5.5:1
  on white), never a boxed band (Today, 18 Oct 2026).
- VoiceOver: each tappable thing is one element whose label says where it goes; decorative pictures have no label;
  headers carry `accessibilityRole="header"`.
- Dynamic Type to AX5: every step has its AX5 size; check every new screen at AX5.

## Words

Every word on screen earns its place: no subtitles that restate the layout, no "coming later", no counts that shame, no
coloured category labels (CLAUDE.md). Say in one line who sees what wherever the reader shares anything (Pray, Circles).

## How to check a screen

A whole build is checked as `docs/build-qa-lessons.md` says: an inventory of every frame, counted built only by behaviour, every control tapped.


1. Open the newest frame beside the simulator (Light, Dark, AX5).
2. Walk the table above: right component, right type step, right colour token.
3. `pnpm -r typecheck && pnpm -r test`: the tested rules fail loudly.
4. Note any departure from the frame in the code comment, with the reason.
