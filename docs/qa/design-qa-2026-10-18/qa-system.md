# Design QA: audio and system surfaces (18 Oct 2026)

Area: the player and read-along, the listening controls (speed, stop, repeat, voices), WEB/KJV audio,
Understand and Listen, widgets, the Lock Screen, the Live Activity, the Dynamic Island, Siri, Spotlight, Control
Center, StandBy, notifications, and the platforms that were never built (Apple Watch, iPad, iPhone Duo).

Method: I read every frame's markup and CSS (Light column, plus AX5 where it matters) and compared it with the
code that renders the same thing. Paths are under `apps/mobile/` unless they start with `docs/`. Newer pages
supersede older ones (v2 → guide → next → b6 → sys → b7 → b9). I also applied the canvas notes (refs_*), the
15 Oct polish and the decisions in `docs/build-6-decisions.md` and `docs/build-7-plan.md` §0.

Counts (83 frames): **MATCHES 40 · DIFFERS 14 · NOT BUILT 7 · SUPERSEDED 14 · DEFERRED BY DECISION 8**.

## Cross-cutting findings

| # | Finding | Where | Frame / rule | Severity |
|---|---|---|---|---|
| X1 | **The widgets, Lock Screen, Live Activity and Island still use the pre-polish chalk palette.** Paper #F7F8F0 (dark #0E1814), ink #16231E, muted #526D63, divider #DFE5D7, selection #E7EED8. The app moved to white #FFFFFF / #0B0C0B, ink #111311, muted #686B69, divider #E9E9E7, selection #EEF3E4. Every Home Screen widget and the Lock Screen activity are tinted green-cream next to a white app. The config comment says the colours come "from src/design/palette.ts", which is no longer true. | `targets/widget/expo-target.config.js:16-24` (generates `targets/widget/Assets.xcassets/*`); `src/design/palette.ts:51-75` | polish-2026-10-15 "we go white"; SX-01–08, SX-17–22 | **high** (seen on the Home and Lock Screens) |
| X2 | The reminder's long-press has the same problem: old ink and muted colours, and it uses the system serif (New York) where the frame uses Literata. The widget moved to Literata in build 8; the notification extension did not. | `targets/notification/Assets.xcassets/{ink,mutedInk}.colorset`; `targets/notification/NotificationViewController.swift:49-62` (`design: .serif`) | SX-14; build-8-plan §6 "Literata in the extension" | low |
| X3 | **The mini player never leaves the reader.** It is rendered only in `read/[book]/[chapter].tsx`. The Today and Bible tabs have no player above the tab bar, so after leaving the reader the only control is the Lock Screen. | `src/app/read/[book]/[chapter].tsx:998`; `src/app/(tabs)/_layout.tsx` (NativeTabs, no accessory) | IA-17; ia4 note "The mini player sits above the bar on every tab" | **high** |
| X4 | **Today has no Listen.** The reading card offers Read only. DR-11, DR-12 and DR-16 all draw "Listen to Psalms 1–5" beside Read, and build-7-plan row 2 says "the reading card (Read · Listen)". (This is the Today reviewer's screen, but the missing door is audio.) | `src/app/(tabs)/today.tsx:138-143` (Read only; no `listen` import) | DR-11, DR-12, DR-16; build-7-plan.md:102 | **high** |
| X5 | Sheet section titles in my screens are 13 pt grey labels. The polish asks for 20 pt bold ink in sheets. | `src/components/Sheet.tsx:303` → `Label` (`src/design/type.ts:49`); Voice sheet "Download" (`src/app/voice.tsx:66`); Downloads "Readings" (`src/app/downloads.tsx:56`) | polish: `.sheet .sec > .lbl{font-size:20px;font-weight:700;color:ink}` | medium |
| X6 | The player's close control is a grey-fill circle. The polish asks for a white circle with a hairline ring in light mode (fill only in dark). | `src/app/player.tsx:246` (`backgroundColor: palette.fill`) | polish: `.sh-x{background:paper;box-shadow:0 0 0 1px div}` | low |

## Audio read-along (guide page: AU)

| Frame | Status | Differences (app file:line · frame vs app) | Severity |
|---|---|---|---|
| AU-01 Reader at rest | MATCHES | The ink "Understand 1:1–18" pill and the round Listen sit in RestBar (`src/components/ActionBar.tsx:239-246`, `src/components/audio/ReaderBars.tsx:44-70`). At AX sizes the full-width "Listen ▶" row matches `.abar-list`. | – |
| AU-02 Playing, mini player | MATCHES | The ink pill on the spoken word matches (`Spoken.tsx:58-69`). The frame's second line is "Verse 5 · BSB"; the app shows the playing verse's words plus a split progress line (`[chapter].tsx:1003-1014`, `ReaderBars.tsx:210`). Build-6 decision 5 changed this on purpose. | – |
| AU-03 Play from 1:6 | DIFFERS | The frame has a fill pill reading "▶ 1:6". The app shows ▶ alone (`ActionBar.tsx:94-106`). The reason, "said the verse twice", is recorded only in a code comment (UX pass, 15 Oct), not in a doc. | low |
| AU-04 Full player | DIFFERS | Layout, lyrics, segments, "Verse 5 / of 51", speed · prev · pause · next · Guide all match (`player.tsx:238-407`). Two differences: the close control is a grey fill, not a white ringed circle (X6); and the menu gains "Stop listening", which build-6 decision 7 added on purpose. | low |
| AU-05 Reduce Motion | MATCHES | It snaps without animation and the playing line is semibold (`player.tsx:100`, `:462`; `Spoken.tsx:58`). | – |
| AU-06 VoiceOver order | MATCHES | Close → verses → adjustable progress → speed → prev → pause → next → Guide (`player.tsx:146-160`, `:348-356`). The title header and the voice button (BA-01, added later) now come between close and the verses. Mini player: label → prev → pause → next, plus magic tap (`ReaderBars.tsx:223-260`). | low |
| AU-07 First listen on the basic voice | NOT BUILT | The line "For a clearer voice: Settings › Accessibility › Spoken Content › Voices" was removed in 3cee5a2 (build 6). `player.tsx:17-20` cites "John, 13 Oct 2026: the iPhone voice and Personal Voice are no longer choices", but no doc records it, and refs_us still says the line under the title "stays for AU-07's first listen". | low |

## Human-read audio (next page: BA)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| BA-01 Voice under the title | SUPERSEDED by LB-09 | The app names "Heart, computer voice ⌄" as LB-01–10 draw it (`player.tsx:143`, `:260-279`). | – |
| BA-02 First play downloads | MATCHES | "Getting the recording", the stop ring, and the label "Stop, 40 percent" (`[chapter].tsx:1005`, `ReaderBars.tsx:244-255`, `:280-301`). | – |
| BA-03 Voice sheet | SUPERSEDED by LB-10 and the 13 Oct decision | "Recorded reading / iPhone voice · Works offline" has become Heart and George rows, each "Computer voice" (`voice.tsx:46-64`). See LB-10 for the copy that still differs. | – |
| BA-04 Downloading John | DIFFERS | The frame's "Downloading John · 6 of 21 chapters" row carries a trailing stop ring ("Stop downloading"). The app's row has no trailing control (`voice.tsx:67-73`), and `data/recordings.ts` has no cancel function (only `downloadBook`/`removeBook`, `:350`, `:398`). A book download cannot be stopped. | medium |
| BA-05 Offline | MATCHES | "You're offline." under the title, announced to VoiceOver (`data/audio.ts:238-242`, `player.tsx:73-75`, `:284-288`). | – |
| BA-06 WEB, one voice | MATCHES | "iPhone voice" as plain muted text when there is no reading (`player.tsx:275-278`). | – |
| BA-07 ⋯ Remove | MATCHES | "Remove John's audio", destructive (`voice.tsx:77`). | – |
| BA-08 Not enough space | MATCHES | Same sentence; the button stays (`voice.tsx:126-129`). | – |

## Build 6 listening (b6 page: LB)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| LB-01 One menu | MATCHES | Speed / Stop playing / Repeat, each with its value as subtitle (`lib/audio/voice.ts:68-85`, `player.tsx:178-215`). "Stop listening" is a fourth, destructive row (build-6 decision 7). | – |
| LB-02 Stop choices | MATCHES | Rows and "After 1:18" subtitles are identical (`lib/audio/voice.ts:47-53`, `:70-74`). | – |
| LB-03 Stop line | MATCHES | "Stops after 1:18" / "Stops in 27 min" (`lib/audio/stop.ts:126-138`, `player.tsx:383-387`). | – |
| LB-04 Stopped at break | MATCHES | Pauses, moves on to 1:19, and the setting returns to Off (`data/audio.ts:443-453`). | – |
| LB-05 Repeat | MATCHES | This verse 1:5 / This passage 1:1–18 / This chapter John 1 / Off. | – |
| LB-06 Repeating passage | MATCHES | "Repeats 1:1–18 · Stops in 12 min". | – |
| LB-07 Stop with repeat | MATCHES | Only the times while a verse repeats (`stop.ts:89-94`). | – |
| LB-08 Chapter name | MATCHES | The title line in ink above verse 1 (`player.tsx:305-314`). The name is spoken in the reading's voice (`data/audio.ts:481-499`). | – |
| LB-09 WEB Heart / KJV George | MATCHES | Each version's reading names its voice (`player.tsx:143`). | – |
| LB-10 Voice on the KJV | DIFFERS | The single George row without a tick matches. The Download row's subtitle in the app is "George, computer voice · 21 chapters · 34 MB" (`voice.tsx:40`, `:122-124`); the frame has "21 chapters · size", since the voice is already named above it. The "Download" section title is a 13 pt grey label (X5). | low |
| LB-11 Downloads | DIFFERS | Rows read "John · Heart · BSB" (matches). The frame puts the size as a trailing value with no ⋯; the app shows "21 chapters · 34 MB" as a subtitle with a trailing ⋯ (`downloads.tsx:45-49`, `:71`). The "Readings" title is the 13 pt label (X5). | low |

## WEB and KJV human audio (next page: WA)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| WA-01 WEB recorded (Winfred W. Henson) | SUPERSEDED | Build-6 decision 3 (`docs/build-6-decisions.md:59`, 15 Oct) settles it: the WEB, KJV and LSV are read in one computer voice each (Heart/George), and LB-09–11 draw that. The Henson and Armenta recordings are not in the app; `docs/plan-additions-2026-10-12.md:47-49` still lists them as waiting. | – |
| WA-02 KJV recorded (Mike Armenta) | SUPERSEDED | As WA-01. | – |

## Understand and Listen (b6 page: UL)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| UL-01 Hear this passage (verse) | MATCHES | "Hear this passage" with "Nicodemus by night · 3:1–21" and a trailing ▶, above More on this verse. The sheet closes and play starts (`components/HearPassage.tsx`, `UnderstandViews.tsx:281`, `:237-239`). | – |
| UL-02 Hear this passage (guide) | MATCHES | Under In short (`PassageGuide.tsx:168-171`). | – |
| UL-03 Playing line opens Understand | MATCHES | `player.tsx:445-448`, with the hint "Opens Understand". | – |
| UL-04 A book with little written | MATCHES (structure) | In short shows the headline with no empty heading (`PassageGuide.tsx:150-165`). The content is for the Understand reviewer. | – |

## System surfaces (sys page: SX). X1 (old palette) applies to every widget and activity frame below.

| Frame | Status | Differences | Severity |
|---|---|---|---|
| SX-01 Continue small/medium | MATCHES (layout) | Overline, name, verse (medium), "John 5:6 · BSB", hairline and Listen (`Widgets.swift:236-281`). Colours: X1. | high via X1 |
| SX-02 Continue large | DIFFERS | The frame's foot has the hairline and then "John 5:6 · BSB" beside Listen. The app puts the reference above the hairline (`Widgets.swift:245-250`). Colours: X1. | low |
| SX-03 A passage for today, small/medium | DIFFERS | The layout matches (`Widgets.swift:379-391`, `:461-478`). Its content is now superseded by DR-07: build 7 names the widget "Today" and has it follow the morning and evening psalms (`docs/build-7-plan.md:106`, `:132`). The app still shows one psalm per day by day of year mod 150 (`lib/reminder.ts:97-101`, `data/system.ts:87-98`). So the widget's Psalm 138 disagrees with Today's "This morning · Psalms 1–5", and it turns at midnight, not 03:00 / 17:00 (`Widgets.swift:103-112`). | medium |
| SX-04 A passage for today, large | DIFFERS | As SX-03: the layout matches (`Widgets.swift:393-413`) and the content is out of step with Today. | medium |
| SX-05 Listen pressed | MATCHES | Pause, "Playing · 138:2", and the Island (`Widgets.swift:361-370`, `data/system.ts:265-273`). | – |
| SX-06 Tinted | MATCHES | `widgetAccentable` on the name, the ring and Listen. | – |
| SX-07 Lock Screen | MATCHES | Inline with a book glyph, the ring with "5:6", the rectangle with "Psalm 138:1" and the verse, and headphones for Listen (`Widgets.swift:321-330`, `:421-438`, `:497-518`). | – |
| SX-08 StandBy | MATCHES | "Psalm 138" and the verse at title3 (`Widgets.swift:480-492`). | – |
| SX-09 Control Center | MATCHES | A Listen toggle with the place, and a Continue button (`Widgets.swift:551-581`). | – |
| SX-10 Siri snippet | DIFFERS | The frame has "Psalm 23 · BSB", then the passage name large ("The Lord is my shepherd"), then the verses. The snippet has no name line (`modules/yada-system/app/YadaIntents.swift:186-208`). Read and Listen show only on iOS 26 (build-6 decision 19, accepted). | low |
| SX-11 Six shortcuts | MATCHES | All six phrases are present (`YadaIntents.swift:318-331`). | – |
| SX-12 Spotlight | DIFFERS | The frame's top hit is "Psalm 23", subtitle "The Lord is my shepherd", the first verse, and Read and Listen beside it. The app indexes a plain `CSSearchableItem`: title "Psalm 23" and description "verse\nBerean Standard Bible", with no passage name and no Read or Listen (`modules/yada-system/ios/YadaSystemModule.swift:187-199`, `src/data/system.ts:230-238`). | medium |
| SX-13 Reminder collapsed | MATCHES | "Next in John: …" over the first words (`lib/reminder.ts:108-110`). The body may now open with "Your rhythm: N days", an intended build 8 change (NB frames, commit 71f87cf). | – |
| SX-14 Long-press | DIFFERS | The structure matches (overline, name, ref, two verses, Read or Listen). The type and colours differ: X2. | low |
| SX-15 Grouped | MATCHES | One thread; earlier reminders are taken back when the app next schedules (`YadaSystemModule.swift:162-182`; build-6 decision 16). | – |
| SX-16 Scheduled Summary | SUPERSEDED by build-6 decision 5 | Ordinary relevance (`YadaSystemModule.swift:166`). | – |
| SX-17 Live Activity | DIFFERS | Name, ref, verse, segments, stop line with the moon, and controls all match (`Widgets.swift:679-706`). The frame leads the title row with the Yada mark (24 pt ink tile, `.sxlam`); the app has none. Colours: X1. | low |
| SX-18 Repeating, paused | MATCHES | "Repeats 1:1–18" with the repeat glyph and Play. | – |
| SX-19 Between chapters | MATCHES | "John, chapter 2" in ink (`lib/systemSurfaces.ts:242-244`, `Widgets.swift:690-691`). | – |
| SX-20 Island compact/minimal | MATCHES | The ring and "1:5" in chartreuse; minimal is the ring (`Widgets.swift:760-766`). | – |
| SX-21 Island expanded | MATCHES | `Widgets.swift:735-759`. | – |
| SX-22 StandBy listening | DIFFERS | The frame's overline reads "The Word became flesh · John 1:5"; the app's reads "… · 1:5" (`Widgets.swift:713`, `state.ref`). | low |
| SX-23 At the stop | SUPERSEDED by build-6 decision 7 | The activity ends at once (`src/data/system.ts:154-159`). | – |

## Widget and Live Activity, first pass (next page: WL), and Maps, Siri and Spotlight (MS)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| WL-01 – WL-04 | SUPERSEDED by SX-01–23 | refs_sx: "Supersedes WL-01–04, MS-02/03, NT-04–08, EG-05". WL-04's rule (BSB under a licensed version) holds: `data/system.ts:53`. | – |
| MS-02 Spotlight | SUPERSEDED by SX-12 | – | – |
| MS-03 Siri | SUPERSEDED by SX-10 | – | – |
| MS-04 UST as a translation | NOT BUILT | The UST appears only as Understand's "In plain words" source (`UnderstandPages.tsx:230`, `lib/sources.ts:75`), not as a row in Translations. Still open in `docs/build-8-plan.md` §6. | low (not audio) |
| MS-05 Reading John 1 in the UST | NOT BUILT | As MS-04. | low |

## Other frames in this area

| Frame | Status | Differences | Severity |
|---|---|---|---|
| IA-17 Mini player above the bar on every tab | NOT BUILT | See X3. The frame draws a tab accessory with "Psalm 6 · Verse 3 · BSB", Pause and Next above the Today/Bible bar. It is in neither the 7a list nor the "moved to build 8" list in `docs/build-7-plan.md` §0. Build-6 decision 8 said it "needs a root overlay". | **high** |
| DR-07 Widget follows the day | NOT BUILT | No "Today" widget, no "This morning / This evening · Psalms 1–5 · BSB", and no 17:00 entry in the timeline (`Widgets.swift:103-112`). The plan's picture variant (§4.1) is also absent. Not in the 7a list, not in the moved list. | medium-high |
| DR-08 Night listening | NOT BUILT | There is no "End of this evening's psalms" stop and no session that spans a psalm set; titles like "Evening · Psalms 6–8" do not exist (`lib/audio/stop.ts:84-94` offers only passage, chapter and times). Listening carries on from Psalm 8 into Psalm 9 (`data/audio.ts:450-468`). | medium |
| EG-03 Audio under a licensed page | MATCHES | "Audio is the BSB" and "Read along in the BSB" (`[chapter].tsx:1018-1022`, `ReaderBars.tsx:211-222`). | – |
| EG-05 Widget before anything is read | SUPERSEDED by SX | The app's empty state reads "Open Yada to start reading." (`Widgets.swift:222-228`). | – |
| US-01 Voice help in the menu | SUPERSEDED | The voice choices were removed on 13 Oct (`lib/audio/voice.ts:7-8`); LB-01 is the menu now. | – |
| US-02 No passages | MATCHES | "Mark 1", then "BSB · iPhone voice" (`player.tsx:252-279`). | – |
| US-03 Next while paused | MATCHES | "John 2 · Verse 1" (`[chapter].tsx:1014`). | – |
| US-04 End of a book | MATCHES | "End of John", with Next disabled (`[chapter].tsx:1007`, `ReaderBars.tsx:193-200`). | – |
| MM-09 Following again | MATCHES | `[chapter].tsx:1009-1010`. | – |
| IC-01 Bookmarks in iCloud | DIFFERS (not audio) | The frame says "Bookmarks and your reading place are kept in iCloud."; the app adds "… when you're signed in." (`bookmarks.tsx:127`). | low |
| IC-02 Signed out | NOT BUILT, reasoned in code | `bookmarks.tsx:8-13` says no reliable signed-in signal exists, so one sentence covers both cases. No doc records the decision. | low |
| PR-06 Silence timer shared with Stop playing | not reviewed | This belongs to the Pray reviewer. | – |

## Platforms never built

| Frame | Status | What exists | What building it would take | Severity |
|---|---|---|---|---|
| AW-01 Watch Smart Stack and complications | DEFERRED BY DECISION | Nothing. There is no watch target (`targets/` holds only `widget` and `notification`). `docs/build-7-plan.md:193-195` notes that watchOS widgets need a watch app target, and §0 moves the watch to build 8. | A SwiftUI watchOS app target plus a watch widget extension. `@bacons/apple-targets`, already used for the widget, can add it. The day's psalms and verse must reach the watch through **WatchConnectivity** (applicationContext). The plan's "through the app group" would not work, because App Groups do not sync between iPhone and Watch. Any text sent is BSB only (rule 9). | – |
| AW-02 Mirrored reminder and Live Activity | DEFERRED BY DECISION (free, unchecked) | iOS mirrors notifications and Live Activities without code. The reminder's Read and Listen actions both set `opensAppToForeground: true` (`src/data/reminder.ts:192-196`), so Listen from the wrist opens Yada on the iPhone rather than playing in the background. | Check on a real watch (`docs/build-7-plan.md:348`, `:413`). To make Listen work from the wrist, a background action that calls `listen` without foregrounding. | – |
| AW-03 Sit with this on the wrist | DEFERRED BY DECISION (build 8 candidate) | Nothing. | The same watch target as AW-01, plus a haptic pacer (WKInterfaceDevice haptics) and timers. Counting toward the streak needs the watch to report back over WatchConnectivity. | – |
| TB-01 – TB-03 iPad | DEFERRED BY DECISION | `supportsTablet: false` (`app.config.ts:84`) and `orientation: "portrait"` (`:74`). On an iPad, Yada runs as a scaled iPhone app. | Set `supportsTablet: true` and allow orientations. Check whether expo-router's NativeTabs (`src/app/(tabs)/_layout.tsx`) gives iPadOS 18's top tab bar and sidebar. Add a regular-width layout family: Today in two columns; the reader at about a 70-character measure; Understand, Compare and the guide in a side column. Today these are all `formSheet` routes (`src/app/_layout.tsx:257-330`), so the reader route needs a split layout. Then keyboard commands (Space, arrows, ⌘F, ⌘[ ]) through a native key-command module, pointer hover, and Stage Manager widths. Multiple windows, "one reader per window", is the costliest part for React Native and could wait. There are 12 files using `useWindowDimensions`; check each against widths beyond 402 pt. | – |
| DU-01 Duo closed/open | DEFERRED BY DECISION | Nothing. The device is unconfirmed (`docs/build-7-plan.md:216`). | Closed (compact width) is the iPhone layout already. Open (regular width) needs the iPad family above, so it depends on TB. Folding must keep state: React Native keeps state across a size change as long as the root is not remounted, so this needs testing. | – |
| DU-02 Nothing across the fold | DEFERRED BY DECISION | Nothing. | No public iOS hinge API exists today. The two-column gutter would come from size classes, and the hinge position needs the device SDK. | – |

## Also not built (build-7 carry-overs without their own frames)

- Download a book's audio without playing. The Voice sheet opens only from a playing session (`player.tsx:262`). `docs/build-7-plan.md` §0 moves this to build 8.
- Stopping a book download that is under way (BA-04, above).
