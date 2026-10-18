# Design QA, 18 Oct 2026: the app against every frame on the canvas

John: "a lot doesn't look like the UI". Five reviewers compared all 433 frames (canvas pages v2 to b9) with the app's
code on branch claude/loving-cori-d57938. The full tables, with file:line and severity per frame, are beside this file:
qa-reader.md, qa-understand.md, qa-today.md, qa-browse.md, qa-system.md.

## Fixed already (shared components, so most screens changed at once)

| What | Commit |
|---|---|
| Section titles 22/20 pt bold ink, not 13 pt grey labels (every sheet, Settings, Search, Pray…) | ab164c6 |
| 56 pt rows with hairlines and 15 pt padding; white ringed sheet controls | ab164c6, 44b8770 |
| Page titles SF bold, not Literata | 44b8770 |
| Splash hand-over colour | 44b8770 |
| Ask for prayer and the circle's iCloud sheet were blank in TestFlight build 9 | 037ff10, 3a4a96d |
| The rules written down and tested | f3f5b63 (`docs/design-system.md`, `design/system.test.ts`) |

## Still to do, by workstream (each can be built on its own)

| # | Workstream | Frames | Main files |
|---|---|---|---|
| W1 | Sit with this and Pray for someone as calm full-screen moments; Your requests grouped | PR-02–06, AS-01, PR-09, PR-11, PR-12 | app/sit.tsx, lib/sit.ts, app/pray/someone.tsx, app/pray/mine.tsx |
| W2 | Your space: highlights in four colours, notes, Copy, the bar's second row, Saved, Share as an image | PS-01–05, HM-02, DR-18 | reader, ActionBar, Verse, data/user.ts, cloud sync, bookmarks → Saved |
| W3 | Today: Listen beside Read, the day's verse full screen, its ⋯, earlier days, about the picture, long verse clamp, Pray card, lamp states; Daily psalms page; Reminder page; Bible-tab notices | DR-11, 12, 14–17, 19, EB-03, XT-01, XT-02, DO-03, NB-04, NP-03, NT-09, NT-02 | app/(tabs)/today.tsx, data/today.ts, app/settings.tsx, app/reminder.tsx |
| W4 | Tabs and navigation: Search beside the tabs, pushed pages keep the tab bar, open on the last tab (first launch Bible), the mini player on every tab | IA-15, IA-17, DR-01 | app/(tabs)/_layout.tsx, app/_layout.tsx, audio bars |
| W5 | Understand, guide and Compare: people first, missing-verse line, no empty guide pages, Show the answer, Read it alongside, AX half view, Compare's difference marks and build 7 changes, chapter-foot rows in Literata, passage boundary | VS-02, 04, 07, TD-01, PD-01, PD-05, PD-06, UL-04, CP-01–08, MM-01, IA-16, DR-02, RP-04 | components/UnderstandViews.tsx, PassageGuide.tsx, app/evidence/translations.tsx, reader footer |
| W6 | Search and Contents: Dictionary and Guides groups, browsing before typing, Contents ⋯ (Recent, A to Z, Choose a verse; frames need redrawing first) | DI-03, DI-04, PD-04, IA-06, CT-01–03 | app/search.tsx, app/contents/* |
| W7 | System surfaces: the white palette on widgets, Lock Screen, Live Activity; the Today widget; night listening; Spotlight and Siri details; stopping a download | SX-01–22, DR-07, DR-08, BA-04 | apps/mobile/targets/*, modules/*, data/recordings.ts |
| W8 | New platforms: iPad, iPhone Duo, Apple Watch | TB-01–03, DU-01–02, AW-01–03 | new targets; weeks of work |
| Build 11 | Pray and Circles rebuilt with context | see `docs/build-11-pray-and-circles.md` | |

## Decisions the reports ask John for

- See also in the full Understand view (UX-02 wants it; VS-02 leaves it out).
- Play from: a "▶ 3:16" pill (HM-02, 18 Oct) or the bare glyph (15 Oct UX pass).
- The explanation glyph on every verse with an entry (HM-02) or only where readers differ (VS-03).
- The word card's way out: a footer (IG-03–05, as built) or none (WM-02–04).
