# Colour rules

John, 18 Oct 2026. This extends the Colour section of `docs/design-system.md` (Build 10 branch) and
`apps/mobile/src/design/palette.ts`; where they disagree, palette.ts is the source and this file says what to change.
Contrast figures are WCAG 2 ratios, measured on 18 Oct 2026.

## The one idea

Colour says how much a thing wants from you. White and grey are for reading. Forest is for the one thing to do next.
Chartreuse marks something on forest or on dark. Nothing else in the app is coloured, except the circle tones,
which mean nothing at all.

## Rule map

| Role | Token | Light | Dark | Use it for | Never |
|---|---|---|---|---|---|
| Ground | `paper` | #FFFFFF | (palette.ts) | every page | tinted pages |
| Text | `ink` | #111311 | | all reading and labels | grey body text |
| Secondary text | `mutedInk` | #686B69 | | dates, counts, who sees what | anything you must read to act |
| Hairline | `divider` | #E9E9E7 | | between rows | boxes around rows |
| Quiet surface | `card` | #F4F4F2 | | **empty states**, a secondary pill, a request you posted | the next action |
| Next action surface | forest card | #183F35 | #1E4A3E | **the one thing to do next**: Daily prayer, the calm close, Pray for someone when requests wait | empty states, information, more than one per screen |
| Accent | `accent` | #183F35 | chartreuse | links, selection bar, switches, the answered mark, the "Pray" chip text | large fills on white |
| Chartreuse | brand | #DBEC9A | | kicker and primary pill **on forest or dark** (9.2:1 on forest) | text or marks on white (1.3:1) |
| Primary action | ink pill | `ink` fill, `paper` text | inverted | one per screen | a second primary |
| Destructive | text: `ink`; confirm button: #B42318 with white | | | Remove, Delete, Leave: the word says it; only the final confirm is red | red text in menus (#E5484D was 3.9:1 on white) |
| Circle tones | `circleTone[0..3]` | forest #1F4A3D · night #22302A · sage #4E6E60 · moss #7E9466 | same | a circle's cover and band, picked from the circle's id | meaning (no tone means "new", "yours" or "busy") |
| Avatar hues | `avatarHue[0..5]`: lime, amber, clay, sky, rose, lilac | deep: #4F6B12 · #7E5D1E · #9A4A30 · #2F6494 · #954058 · #62509A, white initials (6.0:1+) | pale: #DBEC9A · #EBD9AE · #E8B49C · #B4CDE6 · #EBBDC6 · #D2C6EC, ink initials (6.3:1+ on forest) | initials; a person's hue comes from their id and never changes; the shade follows the surface: deep on light, pale on dark and forest (as iOS system colours adapt) | greens for people (green is the place); recolouring someone to show state (use a chartreuse ring); one colour for everyone |
| Pictures | the day's picture | | | Today's lead, Pray's hero, the Lock Screen | behind reading text |

**Text on tones:** white on forest (9.0:1), night (12.5:1) and sage #4E6E60; **ink on moss** (4.9:1; white is
3.0:1), on chartreuse and on cream. The old sage #56786A was 4.4:1 with white and is replaced.

**Marks that aren't text** (dots, rings, switches) need 3:1 against their ground: the answered dot uses `accent`
(11.7:1), not the light green #9DBF3E (2.1:1). Switches use `accent` when on, not iOS green #34C759 (2.2:1).

## Audit of the Build 11 frames (18 Oct 2026), and what changed

| Where | Was | Now | Why |
|---|---|---|---|
| PC-12, PC-13: "No requests waiting" / "No one else is waiting" | forest card | `card` fill, ink text, ink pill | the forest card is for the next action; an empty state is the quietest thing on the page |
| Circle covers and bands | 5 tones incl. lime and moss with white text | 4 circle tones, ink on moss | moss with white was 3.0:1 |
| Avatars | greens (sage, moss, forest) | six light warm tones with ink initials | green on the forest band was muddy and hard to tell apart; 4.4:1 sage failed |
| Remove, Delete circle in menus | red text #E5484D | ink | 3.9:1; the word already says it |
| Delete / Leave confirm | #E5484D button | #B42318 button, white text | contrast |
| Answered dot | #9DBF3E | `accent` | 2.1:1 |
| Reminder switches | iOS green | `accent` | brand, 3:1 |
| Pray hero's "Add to your list" (PC-12) | chartreuse pill on the picture | kept | on the picture's dark scrim, as on forest |

## To change in code (with the Build 11 build)

1. `palette.ts`: add `circleTones`, `avatarTones` and `destructive`; tests for each text pairing at 4.5:1 and each mark
   at 3:1, as the existing contrast tests do.
2. `docs/design-system.md`: link this file from its Colour section.
3. `Switch` everywhere: `trackColor` from `accent`.
