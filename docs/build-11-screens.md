# Build 11: every screen, mapped to the build

John, 18 Oct 2026: "map out every screen and plan to build them out". Plan only; nothing built. Frames:
https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ (Build 11 canvas, not yet approved) and the approved Build 10 frames
on https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc (page "Build 10 · scripture, crafted"). Code paths are from the
Build 10 branch `claude/loving-cori-d57938`, which Build 11 starts from once Build 10 ships. Colour: `docs/colour-rules.md`.
The order and gates: `docs/build-11-plan.md`.

## Phases, in build order

| Phase | What | Frames | Native build? | Needs John first |
|---|---|---|---|---|
| **11a** Pray safety | Reports queue in the review tool; Production schema check | none (review tool page) | no | CloudKit server-to-server key |
| **11b** Colour pass | tokens and the app-wide fixes below | none new | no | this plan |
| **11c** Pray and Circles | the rebuild, list, empty states | PC-01 to PC-13, PC-23, PC-24 | yes (Circles module grows) | canvas approval; three open questions below |
| **11d** Prayer notifications | Pray again, answered prayer | PA-01 to PA-03 | yes (push) | push on the App ID |
| **11e** Pray together | the circle's audio call, planned times, calendar | PC-14 to PC-22 | yes (SharePlay) | decided: SharePlay over FaceTime (John, 18 Oct) |
| **11f** Book introduction | handle, sheet, pause, states | SC-01, SC-05, SC-06, SC-07 to SC-09 | no | unfoldingWord credit wording |
| **11g** Orientation | shape, places, people, video | OR-01 to OR-09 | no | each book's data; BibleProject's reply |
| **11h** Verses for a moment | Search's moments and the pager | VM-01 to VM-04, VM-08 to VM-11 | no | topics and references in the queue |
| **11i** Web passage pages | yadabible.com | none (website) | no | which passages |

If credits run short, cut from the bottom: 11i, 11h, 11e. Never 11a or 11b. QA steps for every phase: `docs/build-11-plan.md`.

## 11b Colour pass (from the audit of 18 Oct 2026)

| # | Fix | Files |
|---|---|---|
| C1 | One forest and one dark forest: add `forest`, `forestDark` (#1E4A3E; #0F2A23 goes) and `chartreuse` to palette.ts; delete the three local `FOREST` constants | `app/office.tsx:21`, `app/return.tsx:35`, `components/ChapterClose.tsx:23`, `components/ChapterPages.tsx:105` |
| C2 | Text on pictures: two tokens, `onPicture` (white) and `onPictureMuted` (white 0.8), replacing seven different alphas (0.75 to 0.92) | `app/(tabs)/today.tsx`, `app/office.tsx`, `app/return.tsx`, `components/ChapterClose.tsx`, `components/ChapterPages.tsx` |
| C3 | Glass on pictures: one `glassOnPicture` (white 0.18) for the 0.16 and 0.22 circles | `app/office.tsx:106`, `app/return.tsx:128`, `app/sit.tsx:168`, `components/ChapterPages.tsx:140` |
| C4 | Destructive: words in ink; red only on the final confirm button (#B42318). iOS systemRed in the translations menu goes | `app/translations.tsx:412` |
| C5 | Switches: `trackColor` from `accent`, not iOS green | `app/reminder.tsx:114,147`, `app/settings.tsx:176`, `app/type-settings.tsx:213` |
| C6 | Circle and avatar tones as palette tokens, picked from the id; tests: text pairs 4.5:1, marks 3:1 | `design/palette.ts`, `design/palette.test.ts` |
| C7 | A test that fails on any hex or rgba outside `design/` (pictures' fades excepted by name) | `design/system.test.ts` |

Done when C7 passes with no exceptions but the named fades, and the QA gate's colour row is ticked for every screen.

## 11c Pray and Circles

| Frame | Screen | Code | New or changed | Data and native |
|---|---|---|---|---|
| PC-01 | Pray as a place | `app/pray/index.tsx` | rewrite; new `components/pray/PrayHero.tsx`, `CommunityCard.tsx`, `CircleCover.tsx` | waiting count: new `prayCloud.waitingCount()` (open, not mine, not prayed, not hidden); each circle's newest request: `circlesCloud.latest(id)` |
| PC-02 | New circle, explained | new `app/pray/new-circle.tsx` (sheet, step 0) | new | iCloud check reuses `pray/icloud.tsx` |
| PC-03 | Name it | same sheet, step 1 | new | the cover preview uses `CircleCover` |
| PC-04 | Invite with the real message | same sheet, step 2 | new | `circlesCloud.invite` sets the share's title and thumbnail; the bubble text is the sender's own in Messages, so the frame's sentence is a suggestion to copy, not something Yada sends |
| PC-05 | A circle | `app/pray/circle.tsx` | rewrite; new `CircleBand.tsx` | people and places: new `circlesCloud.members(id)` from the share's participants; Pray on a request: existing `prayed` |
| PC-06 | ⋯, Delete, Leave | `circle.tsx` | changed | existing `leave`; confirm sheet replaces the action sheet |
| PC-07 | Joining | new `app/pray/joined.tsx` | new | shown once from `takeAccepted()` (exists) |
| PC-08 | People | new `app/pray/people.tsx` | new | first names: a `Member` record in the circle's zone, written at join (new schema type) |
| PC-09 | Add to your list | new `app/pray/add.tsx` (sheet) | new; replaces `Alert.prompt` | `addToList` exists |
| PC-10 | Item ⋯, Answered | `index.tsx` | changed | `prayLocal` gains `answeredAt` per item (iCloud KV; a tested migration from the plain string list, rule "replace, don't layer") |
| PC-11 | Remove with Undo, Edit | `index.tsx`, `add.tsx` | changed | `removeFromList`, new `editListItem` |
| PC-12, PC-13 | Empty states | `index.tsx` | changed | the waiting count decides; never "0" |
| PC-23 | An answered prayer you prayed for | `index.tsx` | changed | from 11d's answered-prayer subscription; shown for 7 days after it was marked answered |
| PC-24 | Back from inviting | `circle.tsx` | changed | the share's pending participants give the invited count |

Open for John before 11c: members' names (first names they choose, as drawn); a circle description (not drawn);
Pray as its own tab (PT-01).

## 11d Prayer notifications

| Frame | Code | Data and native |
|---|---|---|
| PA-01 | `app/pray/someone.tsx`: Pray again link after Prayed | local notification, no text, one a day at most |
| PA-02 | notification content only | answered: `CKQuerySubscription` per prayed request, silent push, local notification with no request text; needs `aps-environment` and `remote-notification` background mode in `app.config.ts` |
| PA-03 | `app/reminder.tsx`: Prayer section, two switches | prefs in the reminder store |

## 11e Pray together (SharePlay, decided 18 Oct 2026)

| Frame | Code | Data and native |
|---|---|---|
| PC-14 | `circle.tsx`: Pray together, or who is on and Ask to join | a `Together` record in the circle's zone while a call runs (short life); Ask to join tells the caller in Yada, who adds you in FaceTime |
| PC-15 | first-time sheet | shown once per person |
| PC-16 | new `app/pray/together.tsx` | new native module `modules/yada-together` (GroupActivities: the shared request id and index; `GroupSessionMessenger` for Next); entitlement `com.apple.developer.group-session`. Audio is FaceTime's; Yada has no audio code |
| PC-17 | new `app/pray/plan.tsx` (sheet) | a `Gathering` record in the circle's zone: weekday, time, weekly or once, about how long, who planned it |
| PC-18 | `circle.tsx`: the planned time, who is coming, I'll be there, Add to calendar | `Coming` records per person; Add to calendar via `expo-calendar` (asks for calendar access at that tap only), one event in the person's own calendar, repeating if weekly |
| PC-20 | `pray/someone.tsx` opened with one circle request | `circlesCloud.prayed` |
| PC-21 | `together.tsx`: Ask to join line | the `Together` record's join requests |
| PC-22 | `circle.tsx`: the planned card's ⋯ | edit or delete the `Gathering`; `Coming` set false for this week |
| PC-19 | local notifications | 10 minutes before, to those coming: who will ring them; at the time, to the one who planned it: time to ring. Scheduled on the phone, no push, no request text |

Limits to say plainly: Yada can't put anyone into a running FaceTime call, so the one who planned it rings those coming;
SharePlay can't check that everyone on the call is in the circle, so PC-15 says everyone on the call sees the requests.

## 11f to 11h (approved Build 10 frames plus Build 11 states)

| Frames | Code |
|---|---|
| SC-01, SC-05, SC-06 | reader `app/read/[book]/[chapter].tsx`, new `components/AboutHandle.tsx`, new `app/about/[book].tsx` (sheet); SC-06 in `ChapterPages.tsx` |
| SC-07 | the handle renders only for an approved introduction |
| (replace) | Build 10 still draws the introduction above chapter 1's verses (`components/BookIntro.tsx`, used at `app/read/[book]/[chapter].tsx:824`, build 6's IG-01), which John turned down on 17 Oct. 11f deletes `BookIntro` and its call in the same commit as the handle (rule: replace, don't layer) |
| SC-08 | `app/sources.tsx`: Book introductions section with the full credit |
| SC-09 | `app/contents/[book].tsx`: About row first |
| OR-01 to OR-06 | the About sheet's sections: shape (pericopes), map (existing basemap), who (study profiles), video card |
| OR-07 | profile pushed in the sheet (reuse `guide/person.tsx`); the profile text in `study-*.db` starts with an `<h>` heading tag, so strip it and show the name as the sheet title (found 18 Oct: the frame printed the raw tag) |
| OR-08 | `expo-web-browser` sheet for bibleproject.com |
| OR-09 | the card hidden when the video data is withdrawn |
| VM-01 to VM-04 | `app/search.tsx` empty state; new `app/moments/[topic].tsx` pager |
| VM-08 | helpline row from the region table; Find A Helpline when none |
| VM-09 | last verse line |
| VM-10 | the moment always reads BSB; Open in Bible keeps the reader's translation |
| VM-11 | reader opened with Back to the moment |

## How each phase is checked (CLAUDE.md gates)

Before each phase's push: every frame in its rows is built or moved with John's yes; each screen against its frame in
Light, Dark and AX5; the design system pass (tokens and components, nothing one-off); no polling; replace, don't layer;
typecheck and tests; deslop, review-code, security-check.
