# Build 11 plan

John, 18 Oct 2026. Plan only; nothing built. **Build 10** is 10a (Return) plus the items John moved into it, going out
from `claude/loving-cori-d57938`. Build 11 holds the rest of `docs/build-10-plan.md` (on
`claude/funny-brahmagupta-a36845`), Pray v2, and the Pray and Circles rebuild John asked for on 18 Oct.

- Every screen, mapped to code: `docs/build-11-screens.md`
- Colour: `docs/colour-rules.md`
- Frames: https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ (Build 11 canvas, 37 frames, **approved by John on 18 Oct 2026**; audit: `docs/build-11-ux-audit.md`), plus the
  approved Build 10 frames (SC, OR, VM) on https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc
- Rules: CLAUDE.md (gates: plan-and-frames QA, design system pass, no polling, replace don't layer)

## Phases, in build order

| Phase | Contents | Needs John first |
|---|---|---|
| **11a** Pray safety | Reports queue in the review tool; schema in Production (`docs/pray-ask-plan.md`) | CloudKit server-to-server key |
| **11b** Colour pass | C1 to C7 in `docs/build-11-screens.md`: one forest, tokens for text on pictures, destructive in ink, switches in accent, circle and avatar tones, a test against stray colours | this plan |
| **11c** Pray and Circles | PC-01 to PC-13, PC-23, PC-24: Pray as a place, new circle in three steps, a circle's page, joining, people, your list, empty states | canvas approval |
| **11d** Prayer notifications | PA-01 to PA-03 | push on the App ID |
| **11e** Pray together | PC-14 to PC-22: SharePlay over FaceTime, planned times, calendar | the Apple group-session entitlement |
| **11f** Book introduction | SC-01, SC-05, SC-06, SC-07 to SC-09 | unfoldingWord credit wording |
| **11g** Orientation | OR-01 to OR-09 | each book's data; BibleProject's reply |
| **11h** Verses for a moment | VM-01 to VM-04, VM-08 to VM-11 | topics and references in the queue |
| **11i** Web passage pages | approved passages on yadabible.com | which passages |

If credits run short, cut from the bottom: 11i, 11h, 11e. Never 11a or 11b. One push per phase.

## Decided on 18 Oct 2026 (carried across every Build 11 frame)

| Decision | Applies to |
|---|---|
| Pray is a place: the day's picture, a line from your list, then the people waiting | PC-01, PC-12, PC-13 |
| The forest card is only for the next action; empty states use the quiet `card` surface; never "0 waiting" | PC-01, PC-12, PC-13, every future empty state |
| On forest or dark: chartreuse on the one action and at most one mark; kickers and meta in muted white, sentence case | all forest screens |
| Each person has one avatar tone, from their id, on every screen; the inviter or speaker gets a chartreuse ring, never a new colour | PC-01, PC-04, PC-05, PC-07, PC-08, PC-14, PC-16, PC-18 |
| A circle shows its twelve places | PC-02, PC-05, PC-07 |
| Destructive words in ink; red only on a final confirm button | PC-06, PC-10, PC-11 |
| Your list: Add is a sheet like Ask; items have Mark answered, Edit, Remove with Undo | PC-09 to PC-11 |
| Pray together uses SharePlay over FaceTime; Yada shares only the request on screen; nothing recorded; the one who planned a time rings those coming | PC-14 to PC-19 |
| Planned times: one per circle, once or weekly; I'll be there; Add to calendar; reminders carry no request text | PC-17 to PC-19 |

## QA steps for every phase (lessons from Build 10)

From the Build 10 session (`docs/build-qa-lessons.md` on its branch). In Build 10, screens were counted as built because
a comment named their frame: tapping Today's picture opened the reader where DR-16 says the day's verse, and highlights,
notes, Saved and Share as an image (PS-01 to PS-05) were never built. QA was screenshots only, so the native tab bar
(`unstable-native-tabs`) passed while it took no taps, drew no glass and showed a stray strip of picture.

1. **Start:** list every plan item and every canvas frame assigned to the phase. The newest frame of a screen wins.
2. **Built means behaviour:** a frame counts only when its copy, its controls and where each tap goes match, cited
   file:line. A comment that names a frame proves nothing.
3. **Tap-test** every changed screen on the simulator: every control, tabs and back included. Then Light, Dark, AX5,
   Reduce Transparency on and off, and VoiceOver order.
4. **Beta components:** before building on a beta or `unstable_` component, prove taps, rendering and both themes. If
   any fail, draw it ourselves. For 11e, prove SharePlay on two devices before drawing PC-16 in code.
5. **End:** each row marked built (file:line) or moved, with John's yes and where to. Anything else blocks the upload.
   The list goes in the upload or PR notes, with the design system pass and the colour rules.
6. **Earlier QA reports are leads, not truth:** re-check each against its frame.

PS-01 to PS-05, DR-14, DR-16, DR-17 and DR-19 are built and tap-tested on the Build 10 branch (7ead8a9, per its session). If Build 10 ships without that commit, they join 11c's list before anything new. Still open in Build 10: the 30 evening pictures (John deciding whether to source them) and W5 (Understand, guide and Compare, with ON-04's Next passage); whatever Build 10 doesn't ship moves here with John's yes.

## Moved in from Build 10 (John, 18 Oct 2026)

| Item | State | Next |
|---|---|---|
| **The collects** | no permitted source on disk: the 1662 Book of Common Prayer is Crown copyright in the UK | find an openly licensed or public-domain source (the 1979 US collects, copyright relinquished, per `docs/build-8-plan.md` §3), read its licence from the file (rule 3), then John chooses |
| **Readers differ follow-ups** | not defined yet | John says what they are; until then nothing is built |

Build 10 shipped to TestFlight as 1.0.0 (10) from `claude/loving-cori-d57938` (8ebb8ba); PR #16 is open and not merged.
Henry's 66 summaries are steered in #16's pipeline (exactly the 66 change); approving the texts and publishing stay
John's steps.

## Moved to Build 12

- The handout (HO-01) and learn by heart (LH-01 to LH-03).
- Other languages: a spike only, blocked until John names a reviewer for that language (rule 2).

## Moved into Build 10 (John, 18 Oct 2026)

Prayers of the Bible (39 approved, `docs/review-2026-10-18-henry-prayers.md`); Henry's 66 summaries (the content
rebuild, `docs/content-rebuild-plan.md`); evening Daily prayer and the collects; Readers differ follow-ups; from build 7
the day's verse full screen, Your reading, iPad, Apple Watch, evening pictures. Out until there is evidence: hosted
video, Android.

## What John decides first

1. ~~Approve the Build 11 canvas~~: approved 18 Oct 2026. Next: 11a, steps in `docs/build-11a-plan.md`.
2. Create the CloudKit server-to-server key; check the schema is in Production.
3. Open questions: members' names (drawn: first names they choose), a circle description (not drawn), Pray as its own
   tab (PT-01).
