# Build 11: UI and UX audit of the canvas

18 Oct 2026, all 32 frames on https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ (canvas version 15) in Light, Dark and
AX5, each flow walked as a reader would. Rules checked: CLAUDE.md design rules, `docs/colour-rules.md`, the Build 11
decisions in `docs/build-11-plan.md`. All 11 were fixed or drawn the same day (canvas version 16): 1 to 6 on the frames, 7 to 11 as PC-20 to PC-24.

## Must fix before approval

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | PC-01, PC-13, PC-18 (AX5) | The card links ("Ask ›", "Your requests ›") stay at 15 pt at AX5 while everything around them grows | the link takes the AX5 body size |
| 2 | PC-05, PC-14, PC-18 (all, worst at AX5) | "Ask Home group" docked over the tabs hides the last request; nothing scrolls clear of it | bottom padding on a circle's page equal to the dock plus the tab bar |
| 3 | PA-01 (AX5) | "Pray again tomorrow" grows and "Next request" doesn't: the secondary reads larger than the primary | the hold screen's pills take the AX5 size (PR-09 has the same gap) |
| 4 | PC-06 (AX5) | the Delete and Leave sheets keep 16 pt body text | AX5 size |
| 5 | PC-12 | two primaries on one screen: chartreuse "Add to your list" on the picture and the ink "Ask" in the card | the card's Ask becomes a link, as in PC-01 |
| 6 | PC-01, PC-10 to PC-13 | two ways to add to your list: the header's + and "Your list · Add" | keep the labelled "Add" by the list; drop the header + |

## Flows with a missing step

| # | Flow | Missing | Proposed |
|---|---|---|---|
| 7 | A circle's request, Pray | where the tap goes is not drawn | **PC-20**: the calm hold screen (PR-09) with that request; Back to Home group |
| 8 | Pray together, Ask to join (PC-14) | what the caller sees | **PC-21**: one line in the call, Add opens FaceTime's add-people sheet |
| 9 | Planned time (PC-17, PC-18) | who may plan, and how to change or cancel it | **PC-22**: anyone in the circle plans one time; the card's ⋯ has Change the time, Can't make it this week, Stop planning |
| 10 | Answered prayer (PA-02) | nothing on Pray showed requests you prayed for that were answered | **PC-23**: one quiet line under the card for a week, opening the request |
| 11 | New circle (PC-02 to PC-04) | what happens after Invite | **PC-24**: the circle with you alone, 3 invited, Ask ready, an Invite sent toast |

## Consistency (fixed already today, recorded so the build keeps them)

- One avatar hue per person, deep on light and pale on dark and forest (`docs/colour-rules.md`).
- The compact card for "4 requests waiting", "No requests waiting" and "No one else is waiting".
- "Pray" and "Ask" as the card's actions; full names for VoiceOver.
- One avatar row per screen (PC-18).

## Fine as drawn

Hierarchy on PC-01 after the card was made quieter; the circle page's twelve places; joining (PC-07); the call screen
(PC-16); notifications carry no request text (PA-02, PC-19); Sources (SC-08); the states for 11f to 11h.

## Accessibility notes for the build

- Every avatar is `aria-hidden`; the name beside it is what VoiceOver reads. Keep that in code.
- PC-16: the speaking ring is colour plus a ring shape; VoiceOver needs "Sam, speaking".
- The day's picture on Pray is decorative (empty alt), so VoiceOver starts at "Pray".
- PC-17's day chips need `aria-pressed` and full day names (drawn so).
