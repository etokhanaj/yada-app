# v2 canvas review — 9 Oct 2026

Four separate passes over the **v2 · Modern** page of the redesign canvas
(https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc), then the fixes. Frames were rendered in headless
Chrome and measured with `.claude/skills/design/scripts/ui_audit.py` (26 frames plus 3 stress frames
built from real data: 1 Thessalonians 5 with a `‹ 2 Thess 3:10` return chip, Song of Songs 8, and
Esther 8:9 selected, the longest verse in the Bible).

## 1. UI stress test (does it hold up)

Audit before → after: 71 occlusion hits → 12, and those 12 are rows scrolled under a sheet footer, as
they should be; 6 targets under 44 pt → 0; contrast (light and dark) and horizontal overflow clean
both times.

| # | Finding | Fix |
|---|---|---|
| U1 | The reader header painted above every scrim and sheet: stacked Understand headers vanished and every AX5 sheet title sat under the reader title (15 of 26 frames). | Header, scrim and sheets get explicit layers; the header can never sit over a sheet. |
| U2 | `1 Thessalonians 5 · BSB` wrapped the title into two lines at default size. | Title is the book and chapter on one line, `BSB ⌄` small beneath it, as an iOS title and subtitle. |
| U3 | At AX5 the title's chevron fell onto a line of its own. | Same title structure; chevron rides with `BSB`. |
| U4 | At AX5 sheet titles squeezed between two 64 pt buttons into three lines (`1 / Corinthians / 14:34`). | AX sheet header: controls on one row, the title left-aligned beneath. |
| U5 | AX5 interlinear broke words mid-word (`beginnin / g`, Hebrew split in two). | Rows wrap the gloss below the word instead; Hebrew stays at the trailing edge when wrapped. |
| U6 | Evidence chips in Compare the readings were 40 pt tall. | 44 pt. |
| U7 | Inset sheet's bottom corners (38) didn't follow the device corner, leaving grey wedges. | Bottom radius 48, concentric with the 56 pt screen corner and 8 pt inset. |

## 2. UX stress test (does it make sense)

| # | Finding | Status |
|---|---|---|
| X1 | At AX5 the four-row action list covered the whole selected verse it acts on (Esther 8:9: none of it visible). | Fixed: at AX sizes the list is `Understand 8:9` and `More` (which holds Original, Compare, Copy, Share, Bookmark). **Departs from brief §4** ("vertical list, same order"). |
| X2 | `Why we say this` evidence chips linked to the verse already open (audit item 05 again, in Compare the readings). | Fixed: a chip for the current verse is never drawn. |
| X3 | At the medium detent Understand shows only `What's happening`; the claims that make Yada different start below the fold, and the first-time hint (`Tap a line…`) sits at the very bottom. | **Open for John:** clamp What's happening to four lines at medium, or open at a taller detent. |
| X4 | Passage Understand (14:34–35, John 1:1–5) names a range but only one verse has an explanation. | Open (carried from the first canvas). |
| X5 | 1 Timothy has no entries, so tapping a verse there has no Understand. The action bar for that state isn't designed. | **Open:** draw the bar without Understand (Original · Compare · ⋯). |
| X6 | Translations 14:34–35: WEB and KJV differ from BSB in many content words, so a third of the words carry marks. The marks are honest, but they stop guiding. | Partly fixed: compare by word stem and skip archaic function words (`unto`, `saith`). **Open:** mark only BSB against the others, with the alternatives on tap. |
| X7 | Two different "back" meanings in one place: sheet `×` (to Understand) and `Back to reading` (to the verse). | Kept: both name their destination; VoiceOver escape goes one layer. No change. |

## 3. Slop pass (things that look generated)

| # | Finding | Fix |
|---|---|---|
| S1 | Word card said the word twice: header `σιγάτωσαν` and the headword `σιγάτωσαν` right under it. | Header names the layer: `Word` · `1 Corinthians 14:34`. |
| S2 | `Why we say this` showed the claim, then an evidence row restating it (`present active imperative, 3rd plural`). | Row cut; one action `See the word σιγάτωσαν ›`. |
| S3 | Khaki selection wash (#ECE6D9) read as a stain, not a selection. | Selection tied to the accent: #E4EBF4 light, #232A34 dark (as Matter, Fable, Apple Books). |
| S4 | Navy filled primary and a sky-blue pill in dark mode: brand-blue buttons on a warm reading surface. | Primary is ink: near-black on paper, warm white in dark (Apple Books, Deepstash). Navy stays for the selection bar and links. |
| S5 | Translation differences used the same wash as selection, so "selected" and "differs" looked alike. | Differences get their own warm mark (#F4E7CB / #3A3021) plus the underline. |

## 4. Wireframe pass (things that look unfinished)

| # | Finding | Fix |
|---|---|---|
| W1 | An empty band above the header and nothing at the foot: frames read as boxes, not screens. | Dynamic Island and home indicator (hardware, not a fake status bar). |
| W2 | Identical flat grey capsules everywhere. | Reader controls are glass: translucent, blurred, hairline edge, soft shadow, with text scrolling under them (Apple Books). |
| W3 | Text-only grey action pills. | Original and Compare carry icons (α, columns). |
| W4 | Explanations in system sans looked like form text. | `What's happening` and passage prose in Literata, claims stay sans (Matter's explainer sheet). **Departs from brief §3** (`explanation` is SF Pro Text). |

## Colour, against Mobbin

Kept: the warm paper and ink (Apple Books Original, Fable, Tolan all read on cream), and navy as the
one accent. Changed: what the accent fills. Mobbin's reading apps never fill a primary button with a
brand colour; they use ink. They colour selection with a cool tint of the accent instead. References:
[Matter selection](https://mobbin.com/screens/058e54c1-2c6e-4568-939e-72ca0bd6ef85),
[Fable selection](https://mobbin.com/screens/37c599ad-b4f0-469e-825e-6e2e972b6953),
[Apple Books menu](https://mobbin.com/screens/fda02365-2264-4eff-a55e-7850616e58bf),
[Deepstash ink button on cream](https://mobbin.com/screens/780e563b-579c-4bf4-a941-4c4a550e3628),
[Pocket warm highlight](https://mobbin.com/screens/6e005a16-1328-4178-b388-8ad0eaa34e85).

New tokens beyond brief §3 (each measured ≥ 4.5:1 for mutedInk text on it): `sel` #E4EBF4 / #232A34,
`hl` #F4E7CB / #3A3021, `glass`, `fill`, `sheet`.

## Decisions taken (9 Oct, on John's instruction)

1. Medium detent: clamp What's happening to four lines with `More` (keeps the verse visible, puts claims
   above the fold; a taller detent would hide the verse).
2. Translations: mark only BSB; WEB and KJV unmarked.
3. No explanation: action bar `Original · Compare · ⋯` (frame J01-15).
4. Departures kept: two-item AX action list, serif explanations, the new colour tokens.

All four are written into `brief.md` §8. Also fixed after the passes: the reader title is now centred on
the screen (measured 0 pt offset with `Home` and with `‹ 1 Cor 14:34`), and text scrolling under the
header no longer shows through the translation label.

## Slop pass 2: delight frames (9 Oct)

| # | Finding | Fix |
|---|---|---|
| S6 | D-02 captions in invented milliseconds (`0 ms`, `120 ms`, `280 ms`) that contradicted the motion note (7 × 40 ms + 160 ms = 400 ms). | Captions say what happens; timings live only in the motion note. |
| S7 | D-01's travelling word: white chip, drop shadow, 2° tilt, and its slot still showed the word, so it appeared twice. | No floating copy: the slot empties and the word rides up as the card's headword. |
| S8 | The drawn `α` icon read as ∝; the Compare icon read as a list. | A real Gentium α at text size; Compare is a split pane. |
| S9 | D-03 said "the same opening words" above a pair that shows them. | Sentence cut; label `Same first words`. |
| S10 | The chosen word in the interlinear was a tinted box with an accent underline, like a text field; nothing else in the app looks like that. | Marked as everything chosen is: the selection tint, gloss in ink and semibold. No border. |
| U8 | AX5: `submissiveness` ran off the screen edge. | Hyphenation on scripture, explanations and claims at AX sizes. |
