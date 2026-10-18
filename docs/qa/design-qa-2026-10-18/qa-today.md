# Design QA: Today area (18 Oct 2026)

Area: the Today tab, the day's verse and picture, daily psalms, the devotional, Daily prayer (office), the streak and
Your rhythm, Sit with this, Pray (list, pray for someone, ask, requests, circles), build 8 notifications, first-day and
edge states.

Method: I read each frame's Light column markup and the CSS rules for its classes, then the app component that draws
the same screen. Decisions came from canvas notes (refs_dr, refs_pr, refs_xt, refs_eb7, refs_st7, refs_yv, refs_i7),
docs/build-7-plan.md (§0 lean plan, §2, §6), docs/build-8-plan.md, the build-10 plan, polish-2026-10-15.md and the
build 8 / 10a commit messages. App paths are relative to `apps/mobile/src/`. This was a code comparison only. I did not
run the app in the simulator.

## Status counts (67 frame ids; DO-02 does not exist)

| Status | Count | Frames |
|---|---|---|
| MATCHES | 23 | DR-02, DR-03, DR-06, DR-09, DR-13, XT-05, DO-01, DO-04, DO-05, DO-06, CI-02, CI-03, NB-01, NB-02, NB-03, RT-01–RT-08 (RT-06 has no frame file; built in data/reminder.ts) |
| DIFFERS | 28 | DR-01, DR-07, DR-11, DR-12, DR-15, DR-21, XT-01, XT-02, XT-03, XT-04, EB-01, EB-03, PR-01, PR-02, PR-03, PR-04, PR-05, PR-06, AS-01, PR-07, PR-09, PR-10, PR-11, PR-12, DO-03, CI-01, NB-04, IA-15 |
| NOT BUILT | 3 | DR-08, DR-18, IA-17 |
| SUPERSEDED | 6 | DR-04 (by DO-03), DR-05 (by NB-04), DR-10 (rejected), DR-22 (by RT-02), EB-04 (John, 18 Oct), PT-01 (proposal not taken) |
| DEFERRED BY DECISION | 7 | DR-14, DR-16, DR-17, DR-19, DR-20, EB-02, PR-08 |

(RT-01–08 were compared earlier today in 9fec4b6. I confirmed that each one is built and did not compare them again.
Each of IA-15 and DR-21 also carries a superseded part, noted in its row.)

## Changes that cut across the area

1. **Pushed pages lose the tab bar.** `sit`, `pray`, `pray/someone`, `pray/mine`, `pray/circle` and `devotional` are
   routes in the root Stack (`app/_layout.tsx:274-296`), so they cover the tabs. PR-02, AS-01, PR-07, PR-11, CI-01,
   CI-02 and DR-13 draw the tab bar. The canvas note refs_pr says "Pray and its lists keep the tab bar … praying,
   asking and Sit with this cover it", and refs_i7 says "Pushed pages keep the bar". Severity: medium.
2. **Section titles on Pray, Reminder and Settings use `Label`** (13 pt grey semibold, `design/type.ts:49`). Frames use
   `.sec > .lbl` at 20 px, weight 650, in ink. The polish doc replaced 13 pt grey labels with bold ink titles. Today
   already uses `SectionTitle`. Files: `app/pray/index.tsx:63,71,80`, `app/reminder.tsx:69,140,151`. Severity: medium.
3. **Scripture in the step screens of Sit and Pray uses system sans.** `<Scripture step="claim">` and
   `<Prose step="claim">` take the `claim` spec (`design/type.ts:40`: `font: undefined`, 16 pt). That spec draws the
   verse in SF at 16 pt where every frame sets Literata at 21–30 px. This is the main reason Sit with this "does not
   look like the design". Severity: high.

## Today (DR-11, DR-12, DR-15, DR-21, PR-01, XT-01, XT-02, EB-01, EB-03; app `app/(tabs)/today.tsx`, `data/today.ts`)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| DR-11 | DIFFERS | **Reading card has no Listen.** The frame has `.cbtns` with Read (ink pill) and Listen (paper pill with icon), and build-7-plan row 2 says "the reading card (Read · Listen)". The app has only Read (`today.tsx:135-145`). | high |
| DR-11 | | **Pray card content.** The frame `.prc` card has the label "Pray" (13/600 muted), the list count on the right, and the first two list items as `.pli` lines (Literata 16 with an accent dot). The app shows the title "Pray" in Literata 20/600 and a fixed subtitle, "Your list, and someone to pray for" (`today.tsx:243-250`). | medium |
| DR-11 | | **Sit with this placement.** The frame puts "Psalm 1:⁠3 · Sit with this" on one line: the ref, a dot, then an underlined 13/600 link (`.dpr`, `.sitl`). The app puts "Sit with this" and "Done" on a separate row under the ref (`today.tsx:93-118`). "Done" comes from the build 10 decision (RT-07; "The day's verse counts for the day when the reader taps Done") but is not drawn in any frame. | medium |
| DR-11 | | **Streak pill on the picture.** The frame `.thero .stk.lit` is a white 0.92 pill with #111 text and a forest lamp; unlit, it is a white 0.2 blurred pill with white text. The app pill is rgba(0,0,0,0.28) with a white lamp in both states (`today.tsx:275-281`). The plain layout uses `palette.card` in both states, where the frame uses `--sel` when lit and glass with a hairline ring when unlit. | medium |
| DR-11 | | **Later row has no subtitle.** The frame has "This evening · Psalms 6–8" with "and Spurgeon for the evening" under it. The app is one line (`today.tsx:255-261`). The section title is 22/700 in the app and 20/650 in the frame, and the gap above it is 30 against `--secgap` 40. | low |
| DR-11 AX5 | | **AX order.** The frame's AX layout runs: title, lead card, then a 300 px picture carrying the verse and Sit with this, then the cards. The app's AX layout runs: all cards, then the verse as a filled card, then a separate 260 px picture with nothing on it (`today.tsx:320-342`). | medium |
| DR-12 | DIFFERS | **Evening has no picture: DEFERRED.** Build-7-plan §0 says "Evenings use the plain verse layout with no picture" and lists "Evening pictures" under Moved to build 8. In the plain layout the verse comes last, after every card. The Earlier row reads "This morning · Psalms 1–5" where the frame has "This morning" with "Psalms 1–5 · Spurgeon" under it. The other differences are as in DR-11. | medium |
| DR-15 | DIFFERS | The frame shows the page with no verse block. The app shows the verse as a filled 24 pt card after all the other cards (`today.tsx:338`); build-7-plan §6 says "the verse shows as text on the page", so this is half allowed. The lamp pill styling differs as in DR-11. | low |
| DR-21 | DIFFERS | Today side: the same lamp pill difference as DR-11. The rhythm sheet is superseded by RT-02 (`app/rhythm.tsx`). | low |
| PR-01 | DIFFERS | The same as DR-11: Sit with this is a separate row and not the inline link, and the Pray card has no list items or count. Pray does sit after the reading, devotional and plan cards, which matches. | medium |
| XT-01 | DIFFERS | No lamp on the first day matches (`today.tsx:269`), and "A place to start · The Gospel of John · Passage by passage, explained" matches. But the frame and refs_xt say "no Pray card on the first day (it appears from the second, or when the list has anything)". The app always renders the Pray card (`today.tsx:243`). | medium |
| XT-02 | DIFFERS | The only lit/unlit signal is the lamp's fill. The frame also changes the pill: lit is a solid white or `--sel` pill with ink text; unlit is glass with muted or white text. See DR-11. | medium |
| EB-01 | DIFFERS | With Daily psalms Off and no plan, the frame's lead card reads "Your plan" (label), "Choose a plan" (30 pt Literata) and a "Reading plans" button. The app shows no lead card and only the small "A place to start" or plan card (`today.tsx:125,205`). With a plan, refs_eb7 says it should lead as the plan's next reading; the app keeps it as a small card. | medium |
| EB-03 | DIFFERS | The verse on the picture should clamp at four lines with "…" (three at AX5). The app renders `verse.text` with no `numberOfLines` (`today.tsx:85-87`). The verse block is absolutely positioned at bottom 52 in a 520 pt hero (`today.tsx:386,393`), so a long Daily Light verse grows up over the greeting. | high |
| EB-04 | SUPERSEDED | John, 18 Oct 2026: a darker full-bleed fade replaces the solid band (commits a7811e6, deca5c3; `today.tsx:293-299,349`). | - |
| DO-01 | MATCHES | The Daily prayer card matches `.dpcard` exactly: #183F35, kicker #DBEC9A 13/600, Literata 22, ref 13 at 0.7, six step marks 14×3, "About 15 min", and a white Begin pill (`today.tsx:149-182,376-385`). It replaces the psalms card and Later, as drawn. The rest of the page carries the DR-11 differences. | - |

## The day's verse and its pages (DR-13–DR-20)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| DR-13 | MATCHES | The title, ‹ Today, heading in Literata 26/600, ref, the whole entry, the "For the evening" row and the credit all match (`app/devotional.tsx`). Small differences: the date line drops "· morning", deliberately (comment at line 46); body text is 17 pt where `.dvp` is 19 px; there is no tab bar. | low |
| DR-14 | DEFERRED | Build-7-plan §0 "Moved to build 8": "The day's verse full screen: Earlier days, About this picture." | - |
| DR-16 | DEFERRED | Same line. Tapping the verse opens the reader instead (`today.tsx:79`). | - |
| DR-17 | DEFERRED | Same line. | - |
| DR-18 | NOT BUILT | Share as an image was build 7b item 7 ("Share as an image from the day's verse and from any selection") and is not on the moved list. No image share exists anywhere in the app: the only share is `Share.share` of text in the reader. | medium |
| DR-19 | DEFERRED | Same build 8 line as DR-14. | - |
| DR-20 | DEFERRED | "Your reading page: build 7 keeps 'This year: N days' in the rhythm sheet." | - |
| DR-21 / DR-22 sheet | SUPERSEDED | RT-02 (build 10a) replaced the Your rhythm sheet. DR-22's "Started again today" is gone by design. | - |

## Daily psalms, reminders, widget, listening (DR-01–DR-10, NB-01–04, DO-03)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| DR-01 | DIFFERS | Bible-tab layout belongs to the Bible reviewer. Today area: "Yada opens on the last one used; the first launch opens Bible" (refs_i7). Nothing in `app/(tabs)/_layout.tsx` stores or restores the tab; NativeTabs opens on its first trigger, Today, on every launch. | medium |
| DR-02 | MATCHES | The reader's "Next this morning · Psalm 2" lead (`read/[book]/[chapter].tsx:316-331,891-897`). Styling was not re-checked (reader area). | - |
| DR-03 | MATCHES | After the morning's last psalm, "This evening · Psalms 6–8" (same lines). | - |
| DR-04 | SUPERSEDED | Replaced by DO-03: four choices, no subtitles. | - |
| DR-05 | SUPERSEDED | Decision taken: a second time for the evening psalms is built; NB-04 is the newer layout. | - |
| DR-06 | MATCHES | Title "This evening · Psalms 6–8", BSB first words (`data/reminder.ts:161-172`). | - |
| DR-07 | DIFFERS | The widget is still "A passage for today": one psalm a day, with `psalmForDay` turning at midnight (`targets/widget/Widgets.swift:103,359`). The frame's "This morning · Psalms 1–5 · BSB", switching to the evening set at 17:00, is not built. Build-7-plan row 6 has it as "drawn"; it is not on the moved list. | medium |
| DR-08 | NOT BUILT | No "End of this evening's psalms · After Psalm 8" in Stop playing. `lib/audio/voice.ts:49-59` has only passage and chapter. | low |
| DR-09 | MATCHES | Bible's "Where you stopped" (`(tabs)/index.tsx:256`). | - |
| DR-10 | SUPERSEDED | Rejected (build-7-plan line 129: "No 'days you read' month"). | - |
| DO-03 | DIFFERS | The frame is its own page, "Daily psalms", under ‹ Settings: four `.opt` rows (1662 Prayer Book, One a day, Daily prayer, Off) with a tick and the tab bar. The app has a native pop-up menu on a "Daily psalms" row under a "Today" label in Settings (`app/settings.tsx:149-164`). | medium |
| NB-01 | MATCHES | "Your rhythm: N days" goes over the first reminder only, once today counts (`lib/reminder.ts:166-173`, `data/reminder.ts:203-208`). Not checked on a device. | - |
| NB-02 | MATCHES | On Sunday, "This week you read on N days" takes the line's place (`data/reminder.ts:208`). | - |
| NB-03 | MATCHES | "Your week" alone at 18:00 (`data/reminder.ts:250-259`, `WEEKLY_AT`). | - |
| NB-04 | DIFFERS | The frame's Reminder page has sections Morning ("Every day 7:30" value row, then "The next passage" ticked), Evening ("This evening's psalms" as a tick row), Sunday ("Week in review" as a tick row), then the footnote. The app keeps the older NT-02 page (`app/reminder.tsx`): a notification preview on top, a "Time" label, seven day circles, a Switch for the evening, a Switch for Week in review, a "What it says" section that still offers "A passage for today", and Turn on/Turn off. Section titles are 13 pt grey `Label`. | medium |

## Sit with this, step by step (PR-02–PR-06, AS-01; app `app/sit.tsx`, `lib/sit.ts`)

John said Sit with this does not look like the design, and he is right on every screen. The design is a calm,
full-screen practice: a dark ground for the breathing steps, large Literata, a "Step · n of 4" caption, an × to end, and
no page chrome. The app builds each step as an ordinary pushed list page with a large title and a back chip, the verse
in 16 pt system sans, and no step captions.

| Frame | Status | Frame | App | Sev |
|---|---|---|---|---|
| PR-02 index | DIFFERS | The verse in Literata 21/1.45 (`.sitv`) | `<Scripture step="claim">`, which is system sans 16 pt (`sit.tsx:71`; `type.ts:40`) | high |
| | | "Psalm 1:⁠3 · BSB" | the ref only, with no translation (`sit.tsx:73`; Today passes only `text` and `ref`, `today.tsx:95`) | low |
| | | Four rows, each with a 28 pt numbered disc (`.stn`, fill, 13/600), the title at 17/500 and a muted subtitle: "Breathe, 1–2 min" · "Half on the in-breath, half on the out" · "Read slowly, twice" · "3, 5, 10 or 20 min" | `ListRow` with the title only: no number, no subtitle (`sit.tsx:75-77`) | high |
| | | A chevron on each row | `ListRow` default chevron: matches | - |
| | | Begin pill: "Begin · about 9 min" (stress test: "Begin states its length"); a11y "Begin all four, in order, about 9 minutes" | "Begin", 50 pt; a11y "Begin, all four in order", even when Breathe is skipped (`sit.tsx:78-80`) | medium |
| | | Tab bar visible | root-stack push covers the tabs | medium |
| | | Does not count toward the streak per the frame; the plan says "Meditation counts towards the streak" (refs_pr: "Counts towards the streak (it is Scripture)") | nothing in Sit calls `countDay` | medium |
| AS-01 | DIFFERS | "+ Add rain" directly under Begin, `.more`: accent forest, 15/600, 44 pt | `Chrome tone="muted"`, 17/500 grey, 20 pt below Begin (`sit.tsx:42-46,81`) | low |
| | | Shown on the index only | also repeated on every step screen (`sit.tsx:65`); steps are drawn with nothing but the practice | low |
| PR-03 Settle | DIFFERS | Full-screen `.calm` on #10140F (dark in Light and Dark), text #F2F4EF | a white `PageScreen` with the large title "Settle" and back "Sit with this" (`sit.tsx:50`) | high |
| | | × "End" top left (44 pt glass circle) | a back chip in the header | medium |
| | | "Settle · 1 of 4" caption at the top, 13/600 at 0.75 | none | high |
| | | A soft radial chartreuse circle (rgba(219,236,154,.55→.12)), 240 px in, 150 px out | a flat `palette.selection` (#EEF3E4) circle, 180 pt, scaled 0.6→1 (108–180 pt) (`sit.tsx:117,151`) | high |
| | | The word "In" / "Out" at 28/600 | "Breathe in" / "Breathe out" at 22 (`sit.tsx:51,118`) | medium |
| | | "In for 4, out for 6" caption, 14 pt at 0.75 | none | medium |
| | | Reduce Motion: no shape, the word and a haptic | matches (`sit.tsx:117`) | - |
| PR-04 Breathe the verse | DIFFERS | Both halves shown at once in Literata 30, each with a small "In"/"Out" label (13/600); the current half at full opacity, the other at 0.35 | only the current half, alone, at 16 pt sans, centred (`sit.tsx:52,118`) | high |
| | | "Psalm 46:⁠10 · BSB" caption; "Breathe the verse · 2 of 4" | none; large title "Breathe the verse" | high |
| | | Psalm 46:10 split as "Be still" / "and know that I am God" (refs_pr) | `breathSplit` splits at ";" first and needs at least 3 words a side (`lib/sit.ts:14-22`), so Psalm 46:10 gives "Be still, and know that I am God;" / "I will be exalted among the nations…". "Be still" (2 words) can never be the in-breath. | medium |
| | | Dark `.calm` ground, × End | white page, back chip | high |
| PR-05 Sit with it | DIFFERS | Full-screen `.calm.lite` (paper), "Sit with it · 3 of 4", × End | `PageScreen` titled "Sit with it" | high |
| | | The verse in Literata 27/1.45 with read-along word marking (`.au-w` ink pill on the current word, the rest muted): "Heart or George reads it slowly, twice … (build 6's repeat)" | no audio at all: the text shows for 30 s, disappears for 15 s and shows for 30 s, in 16 pt sans (`sit.tsx:124-134`) | high |
| | | Caption "First reading · then silence · then again"; under the NKJV, "Read aloud in the BSB" | none | medium |
| | | "Original" pill (`.clink`): the Hebrew/Greek of the verse one tap away | none | medium |
| PR-06 Silence | DIFFERS | Choose: the verse in Literata 27 above chips "3 min · 5 min · 10 min · 20 min" (radio, 44 pt pills, 5 preselected), then a Begin pill | four `ListRow`s, "3 minutes" … "20 minutes", that start at once with no verse shown (`sit.tsx:55-60`) | high |
| | | Running: a dark `.calm` with only the verse (`.sitbig.quiet`) and "4 min left"; no × (Silence holds outside doors) | the white page with a large title, the verse in 16 pt sans, no time left, the rain line, and a back chip | high |
| | | "The timer shared with Stop playing" | a separate `setTimeout` (`sit.tsx:137-147`) | low |
| | | Haptic at the end | matches (`sit.tsx:140`); the a11y plan also asks for a VoiceOver announcement at the end, which is missing | low |

Root causes, in order of effect: (1) every step renders through `PageScreen` instead of a full-screen calm view, with
`office.tsx` as the in-app model to follow; (2) `step="claim"` puts the verse in sans 16; (3) the step captions,
captions under the practice and the Original link were never built; (4) Sit with it has no voice.

## Pray (PR-07–PR-12, XT-03–05, CI-01–03, PT-01; app `app/pray/*`, `lib/pray.ts`, `data/prayLocal.ts`)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| PR-07 | DIFFERS | CI-01 (build 8, newer) redraws the page's structure, which the app follows. Still missing against PR-07: list items have no "Added 2 Oct" or "Answered 12 Oct" line. The list is plain strings (`data/prayLocal.ts:25-37`), so the "optional answered date" of refs_pr cannot exist; tapping an item only offers Remove (`pray/index.tsx:55-59`). The "Only you see your list." footnote with a lock is missing. Add is a "Add to your list" row, where the frame has a + glass button in the header. There is no tab bar. | medium |
| CI-01 | DIFFERS | The sections Your list / For each other / Circles and their rows match (`pray/index.tsx:61-87`). Section titles are 13 pt grey `Label`, not 20/650 ink. "Pray for someone" carries an extra subtitle, "Hold to pray for a request", which the frame does not. There is no tab bar. | medium |
| PR-08 | DEFERRED | "Prayers of the Bible: needs John's approval of the list first" (build-7-plan §0, moved to build 8). The Pray page has no row for it, which is consistent. | - |
| PR-09 | DIFFERS | The frame is a full-screen `.calm.lite` page with × "Close, back to Pray" top left and a ⋯ glass circle top right. The request sits centred in Literata 24/1.45, with "Anna · 2 days ago". At the foot: a 60 pt full-width hold pill on `--fill` with an accent fill at 0.22, its label changing to "Keep holding", and a "Use a timer instead" pill link. The app (`pray/someone.tsx:81-115`) is a `PageScreen` with the large title "Pray for someone", back "Pray" and a text "⋯". The request is left-aligned in 16 pt sans (`Prose step="claim"`) and shows the first name only, with no age. The 56 pt pill on `palette.card` sits straight under the text, not at the foot. The label never changes. "Use a timer" is 13 pt muted text. | high |
| XT-03 | DIFFERS | The frame is the calm page: "That's everyone for now." in Literata 24, the note, an "Ask for prayer" ink pill and a "Back to Pray" link. The app shows a `PageScreen` with the text in 16 pt sans and the note, and no Ask for prayer or Back to Pray (`pray/someone.tsx:71-79`). | medium |
| PR-10 | DIFFERS | The frame is a sheet titled "Ask for prayer" with × Cancel. The text area is Literata 21. Under it: a "First name · optional" chip, "Live for 7 days" and the hint "Leave out other people's names and details." A post bar sits above the keyboard with "0 / 280" and a Post pill that stays disabled until text is entered. The app (`pray/ask.tsx:70-92`) is a sheet with the `PageScreen` title and back "Pray". Its input is 17 pt sans, the first name is a second text field, and there is no "Live for 7 days" and no hint (the hint is in build-7-plan §2 stress test: "a hint to leave out others' names"). The counter shows the remainder ("280"), not "0 / 280". The Post bar flows under the fields instead of riding above the keyboard, and Post is never disabled. | medium |
| PR-11 | DIFFERS | The frame groups rows under "Live" and "Answered". Each row has the text clamped to two lines, "3 people prayed · 5 days left" or "Answered 12 Oct · 7 people prayed", and a ⋯ button (`.trbtn`, accent). The app has one ungrouped list. Its line reads "Live · 5 days left · 3 prayed" (order and wording differ). The whole row opens the action sheet, with no ⋯ (`pray/mine.tsx:32-35`, `lib/pray.ts:19-31`). | medium |
| XT-04 | DIFFERS | "Live · 7 days left" with no "0 prayed" matches (`lib/pray.ts:29-31`). The "Live" grouping and the ⋯ are missing, as in PR-11. | low |
| PR-12 | DIFFERS | The frame stacks a second sheet, "Before you post", over Ask. It has two sentences ("It sounds like you might be going through something very hard. You don't have to face it alone." and "Samaritans is a free, confidential helpline, open day and night, for anyone who is struggling."), then three buttons: "Call Samaritans · 116 123", "More helplines in the UK" and "Back to my request". The app replaces the Ask content with a page titled "You don't have to carry this alone". It has one sentence, "Samaritans is there to listen, any time: 116 123.", and buttons "Call 116 123", "More lines" and "Post my request" (`pray/ask.tsx:55-67`). It offers posting where the frame offers going back to the request. Nigeria's SURPIN line, named in refs_pr, is absent from `helplineFor` (`lib/pray.ts:46-51`); the code comment says only lines known to be right are named. | medium |
| XT-05 | MATCHES | The sheet has the same sentence, Open Settings and Not now (`pray/ask.tsx:44-53`). The header has the `PageScreen` back "Pray" where the frame has a sheet title and ×. | low |
| CI-02 | MATCHES | The title, the requests with "Live · n days left", Ask this circle, Invite "5 of 12", "Only people in Family see these." and ⋯ in the header all match (`pray/circle.tsx`). Request titles are prefixed "Name: ". There is no tab bar. | low |
| CI-03 | MATCHES | The sheet, the sentence and the buttons match (`pray/icloud.tsx`). The header is a back chip, not ×. | low |
| PT-01 | SUPERSEDED | A proposal, not taken: build 8 commit 71f87cf, "back to build 7's Today with a Daily prayer card … TV frames dropped". | - |

## Daily prayer (DO-04–DO-06; app `app/office.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| DO-04 | MATCHES | The layout, sizes and copy match `.ostep`: a 44 pt × circle at 0.16, 18×3 step marks, a 13/600 label, Literata 26/1.38, a 13 pt ref, "+ Add rain" at 15, and a white Next pill at 50 pt. Small differences: the scrim is a flat rgba(8,14,12,.62) where the frame grades .35→.62→.78 (`office.tsx:104`); the ground with no picture is #183F35 where the frame uses #0E1814; the Next text is forest where the frame uses #0E1814; × is a text glyph. | low |
| DO-05 | MATCHES | The Venite is one step and long parts scroll within it (`office.tsx:66-83`). | - |
| DO-06 | MATCHES | The Lord's Prayer from 6:9b; Amen returns (`office.tsx:48,95`). | - |

## Tabs (IA-15, IA-17)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| IA-15 | DIFFERS | The frame has Today and Bible plus a round Search button beside the bar (`.tbs`); Search left Bible's header. The app has two NativeTabs triggers and no Search button. The code says "Search stays in Bible's header for build 7a … a search tab is a separate piece of work (lean plan §0)" (`(tabs)/_layout.tsx:4-5`), but lean plan §0 item 2 says "Today and Bible tabs with Search beside them". The pages that should keep the bar do not (see the changes that cut across the area). | medium |
| IA-17 | NOT BUILT | No mini player above the tab bar on Today or Bible. `MiniPlayer` exists only inside the reader (`read/[book]/[chapter].tsx:998`). Build-7-plan row 1 has it "drawn, approved"; no deferral found. | medium |

## Return (RT-01–RT-08), confirmed only

All were compared earlier today in 9fec4b6 ("10a visual QA against the approved frames"). Built in `app/return.tsx`
(RT-01, RT-08), `app/rhythm.tsx` (RT-02), `components/ChapterClose.tsx` (RT-03, RT-04), `app/remind-ask.tsx` (RT-05),
`data/reminder.ts:269` (RT-06; the canvas export has no RT-06 file to compare) and `app/start-small.tsx` (RT-07).
Status MATCHES per that pass; I did not compare them again. One related point: `app/rhythm.tsx:11-12` says the
frame's second tint for "the day's verse alone" is not drawn, because synced days carry no kind.

## The ten most important differences

1. Sit with this steps are ordinary pushed pages, where the design has full-screen calm screens: no dark ground, no ×,
   no "Step · n of 4" caption, and a large title with a back chip instead (`sit.tsx:48-67`). (PR-03–06, high)
2. Every verse in Sit and on Pray for someone is in 16 pt system sans (`step="claim"`, `type.ts:40`), where the
   frames use Literata at 21–30. (PR-02–06, PR-09, XT-03, high)
3. Sit with it has no voice, no read-along marking and no Original link; it only hides and reshows the text on timers
   (`sit.tsx:124-134`). (PR-05, high)
4. Silence starts from four list rows, with no verse, chips or Begin, and runs without "n min left" (`sit.tsx:55-62`).
   (PR-06, high)
5. Breathe the verse shows one half at a time and cannot produce the drawn split "Be still / and know that I am God"
   (`lib/sit.ts:14-22`). (PR-04, high and medium)
6. The Today reading card has no Listen button (`today.tsx:135-145`). (DR-11, DR-12, DR-15, high)
7. The day's verse on the picture is not clamped to four lines, so a long verse runs over the greeting
   (`today.tsx:85`). (EB-03, high)
8. Pray for someone is a list page, not the calm hold screen: the pill is not at the foot, the label never changes,
   there is no age line and no × (`pray/someone.tsx`). (PR-09, high)
9. The Sit with this index has no numbered steps and no step subtitles, and Begin does not state its length
   (`sit.tsx:75-80`). (PR-02, high)
10. Today's Pray card shows a fixed sentence instead of the list's first items and count, and it appears on the
    first day, which it should not (`today.tsx:243-250`). (DR-11, PR-01, XT-01, medium)

Next after these: pushed pages losing the tab bar; 13 pt grey section labels on Pray and Reminder; the lamp pill's
lit and unlit styling; the Reminder page not matching NB-04; Daily psalms as a menu instead of DO-03's page; no Search
button or mini player on the tabs.

## NOT BUILT frames

- **DR-08:** "End of this evening's psalms" in Stop playing.
- **DR-18:** Share as an image (build 7b item 7; not on the moved list).
- **IA-17:** the mini player above the tab bar on every tab.

Also unbuilt but deferred by a recorded decision: DR-14, DR-16, DR-17, DR-19, DR-20, EB-02 and PR-08.
