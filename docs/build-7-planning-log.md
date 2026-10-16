# Build 7 planning log (15 Oct 2026): how the plan got here. The plan itself is docs/build-7-plan.md.

Drafted 15 Oct 2026, from John's request that day: "What's meant to be on build 7 … and then I want that to have some
daily habit things built into it." Branch `claude/build-7-plan`, from `build-6`. Nothing here is built yet; the
build waits for John's answers to the open questions and his review of the frames.

**Frames:** the canvas's **Build 7 · a daily rhythm** page, https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc
(DR-01–10, each in Light, Dark and AX5). Render them for QA with
`YADA_ROOT=/Users/johnetokhana/yada python3 .claude/skills/design/scripts/render_frames.py <out> GROUPS=dr`.

**Rules that stay as they are:** CLAUDE.md's non-negotiables, rule 9 (licensed text never reaches a notification,
widget, Siri or Spotlight), and the decisions already made against streaks, tallies, "you missed", "behind",
"Day 47", confetti and celebration (roadmap v2, NT notes, MM review). Section 3 shows where a habit idea would
break one of them, and leaves that choice to John.

## 1. What goes in build 7

| # | Item | Source | Size | Frames |
|---|---|---|---|---|
| A | **Daily psalms**, morning and evening (the daily-habit feature) | John, 15 Oct | large | DR-01–09, drawn |
| A2 | **Today**, the rhythm's home: a photo of the day, Spurgeon's *Morning and Evening*, the day's psalms, your plan's next reading, the reminder | John, 15 Oct (option 2, photo, devotional) | large | DR-11–15, drawn |
| IA4 | **IA v4: two tabs, Today and Bible, with Search beside them** (John, 15 Oct 2026: "go with tabs"; `docs/build-7-ia-stress-test.md`) | stress test | large | IA-15–17, drawn |
| B | **Mini player on every page**, now the tab bar's accessory (IA-17) rather than a custom root overlay | IA stress test #8 | medium | IA-17, drawn |
| C | **Live Activity tap opens the player** | IA stress test; `Widgets.swift` has `widgetURL` on both Home Screen widgets but none on the `ActivityConfiguration` | small | none (behaviour only) |
| D | **Search from anywhere**: a button beside the tab bar (IA-15). The reader still needs its own door, since it covers the tabs | IA stress test #11 | small | SD, the reader's door, to draw |
| E | **Download a book's audio without starting playback** | IA stress test #11 | small–medium | AD, to draw |
| F | **Naming leftovers** (#10, anything build 6 did not finish) | IA stress test #10 | small | none |

**Still later**, unless John moves them in: the timeline (TL), themes (TH), JPS 1917 (`OT_ONLY_TEXTS_READY` stays
false), and the licensed Download (LD-01–05: on hold while API.Bible Starter allows 5,000 calls a month for the
whole account).

The mini player (B) comes before the evening listening in A: "play the evening psalms and put the phone down" only
works if the player can be reached from Home and the guide, not just the reader.

## 2. Daily psalms: what each frame shows

The idea: a habit comes from a time and a place in the day, not from a score. Yada already has plans with no dates,
one reminder, a widget and "Where you stopped". Build 7 adds the Psalms, read morning and evening, so the day itself
carries the rhythm. Nothing counts days.

| Frame | What it shows |
|---|---|
| DR-01 | Home: one line under Your plan, "Psalms 1–5 · This morning"; after 5 pm "Psalms 6–8 · This evening". AX5 is drawn scrolled to the line. |
| DR-02 | The reader on Psalm 1: at the end, "Next this morning · Psalm 2" leads, as RP-04 does for M'Cheyne. |
| DR-03 | The morning's last psalm: no "done" and no celebration. The evening's set is named and can be opened early. |
| DR-04 | Settings › Daily psalms: Morning and evening (the 1662 Prayer Book's 30-day division), One a day (Psalm 1 to 150, today's `psalmForDay`), Off. |
| DR-05 | **Decision:** the Reminder with a morning time and an evening time. |
| DR-06 | The evening notification: "This evening · Psalms 6–8" and the first words. Nothing about yesterday. |
| DR-07 | The "A passage for today" widget becomes the day's psalms and switches at 5 pm; a Lock Screen widget says the same. BSB only. |
| DR-08 | The player at night: Stop playing gains "End of this evening's psalms · After Psalm 8", and build 6's status line shows it. |
| DR-09 | Back after three weeks: "Where you stopped" (MM-05), and the day's psalms are that day's. There is nothing to catch up on. |
| DR-10 | **Decision, not recommended:** "Days you read", a private month with a dot on each day read. |

Mobbin, cited on the canvas note: Calm's Morning, Afternoon and Night as plain rows; Waking Up's one time window and
one button; 5 Minute Journal's morning and evening entries; Journal's month with dots (DR-10 only). Rejected: the
Apple Fitness rings and daily goal (mobbin.com/screens/17983edf-6073-47c5-b072-270002fce54e) and every flame streak
(Speak, Mimo, Deepstash, Alta), because a ring that isn't closed reads as a failure.

### How it works

- **The data:** a 30-day table (day → morning set, evening set) read from a pinned public-domain printing of the 1662
  Psalter table, kept with a sha256 like M'Cheyne's. Only the numbers are used. The text is always the BSB, or the
  reader's WEB, KJV or LSV, and never a licensed version (rule 9). The table splits Psalm 119 into verse ranges, so a
  set is a list of ranges, not whole psalms. The canvas draws only day 1 (1–5 morning, 6–8 evening). Every other day
  comes from the pinned source and is never typed in from memory (rule 4).
- **Logic:** `lib/dailyPsalms.ts`, pure and tested beside `lib/reminder.ts`: `setFor(date, mode, part)`,
  the 31st-day and February rules exactly as the source states them, and the switch time.
- **Morning and evening:** the evening starts at 17:00 local time. With an evening reminder set, it starts at the
  earlier of 17:00 and that time. The day of the month always picks the set, so nobody is "behind".
- **Home:** one row, inside the IA-14 rule of a single Home lead (Continue stays the lead).
- **Reader:** a psalm opened from the daily row carries "Next this morning" until the set ends (MM-01's boundary
  logic, with the set as the passage).
- **Widget:** the timeline gains a 17:00 entry beside midnight's. `system.ts` writes two weeks of sets to the app
  group, as it does now for `psalmForDay`.
- **Notifications:** the existing scheduler, kind `"psalms"`. A second time only if John agrees (DR-05).
- **Player:** the stop option exists only while the queue holds a daily set. It reuses build 6's stop code.
- **Siri and Shortcuts:** an App Shortcut, "Today's psalms in Yada", opens the current set through `openFromOutside`
  (build 6). BSB only.

## 2a. Today, the photo and the devotional (John, 15 Oct 2026)

John chose a Today page (option 2), asked for a photo and a daily devotional, and lifted brief §14's
"no mood photography" rule ("break that rule from 9 oct").

| Frame | What it shows |
|---|---|
| DR-01 (revised) | Home's row is now "Today · This morning · Psalms 1–5", and it opens Today. |
| DR-11 | Today: the day's photo, then This morning (Spurgeon's morning entry, the morning psalms, your plan's next reading), This evening, and the reminder times. |
| DR-12 | After 5 pm the evening comes first. The morning stays below and is not marked as read. |
| DR-13 | The devotional page: the date's entry, whole and unchanged, credited once at the end, with a link to the evening entry. |
| DR-14 | Tapping the photo opens its credit: title, who made it, the collection and the licence. |
| DR-15 | No photo yet (first day, or offline before it downloaded): the page without it, with no skeleton and no grey box. |

Home's row, the widget, the reminders and the App Shortcut all open Today.

- **The devotional:** C. H. Spurgeon, *Morning and Evening* (1865–69). Spurgeon died in 1892, so it is public domain.
  It has an entry for every date, morning and evening, which fits the rhythm. Each entry is read from a pinned copy
  with a sha256, shown unchanged and credited, as the debate lines are. No AI touches it (rule 2), and nothing is
  written by John or credited to him. Its verses are the KJV as Spurgeon printed them, so they come under the open
  CUP question.
- **The photos:** one a day, chosen ahead from public-domain and CC0 collections, for example the National Gallery
  of Art and the Met Open Access (both CC0), the Rijksmuseum, or US National Park Service photography (public domain).
  Each licence is read from the source's own files (rule 3). The images go on R2 with their credits in a
  manifest, and the app downloads a week ahead. That way the photo shows offline, no third party sees the reader,
  and the privacy line is unchanged. John approves the year's list in the review queue, as he does the debates.

**Choices for John on Today:**
1. **Where the photos come from.** *Recommended:* a year chosen ahead from CC0 and public-domain collections, as
   above. The alternative is a fresh photo every day from the Unsplash API through the Worker. That needs no
   curation, but Unsplash requires hotlinking (so the phone contacts Unsplash and the privacy page changes), shows
   nothing offline, needs an approved API key, and its pictures can't be reviewed before they show.
2. **Spurgeon is one voice:** a 19th-century Baptist preacher, with some lines today's readers may find harsh.
   *Recommended:* a sample of his entries goes through the review queue first, as the debates did, and an entry John
   rejects is skipped for that date. A second devotional (for example a public-domain Puritan or Anglican collection)
   could be added later.
3. **Kind of image.** Landscapes and nature, historical art, or both. *Recommended:* both, alternating, with no
   generated images.

**Other places imagery could go** (John asked, 15 Oct; none is drawn yet):

| Place | Why it fits | Recommendation |
|---|---|---|
| The day's photo behind the widget and StandBy | It ties the Home Screen to Today; the text sits on a dark layer so it stays readable | build 7 |
| Places in People and places (Bethany, Galilee, Jerusalem) | The photo is information, beside the OpenBible map | build 7 |
| Manuscript pages beside "Missing from older manuscripts" | It shows what the note means; the brief already allowed this once the rights clear | later, licence per library |
| Reading plan covers (M'Cheyne's public-domain portrait) | Small, real, and helps tell the plans apart | optional |
| Doré's Bible engravings (1866) at a book's first chapter | Historical art, one picture per book at most | John's call |
| The reader, the verse sheet, the guide, or a watermark anywhere | It would pull attention from the text and lose contrast in Dark and at AX5 | no |

### Today, UX pass (15 Oct 2026)

Before the pass, Today showed seven rows of equal weight and no single next step. It now has one job: read (or
listen to) this morning's psalms.
- **The picture has a purpose.** It shows a line from the morning's psalms, captioned with that verse. Day 1 is Psalm 1:3,
  "He is like a tree planted by streams of water", shown with Jacob van Ruisdael's *Old Trees along a Bank* (late 1640s,
  National Gallery of Art, CC0 under its Open Access policy). Tapping the caption opens Psalm 1 at verse 3, and the
  credit opens "About this picture" (DR-14).
- **One lead:** "This morning · Psalms 1–5" with the first words. The lead itself opens the reader, and Listen sits
  under it. Spurgeon is one row below. The evening folds to one line ("Later"), and your plan and Reminders come last.
  After 5 pm the evening leads and the morning folds under "Earlier".
- **AX5:** the lead comes before the picture, so what to do is on the first screen.
- **The pictures follow the psalter, not the calendar:** 30 days means 30 morning pictures, reused each month, not 365.

### After YouVersion (15 Oct 2026)

John shared 13 YouVersion screenshots and asked for its flows to be studied. Frames DR-16 to DR-20:
- **DR-16, the day's verse full screen:** tapping Today's picture opens it edge to edge, with the whole verse,
  Read, Listen and Share, and no like or comment counts.
- **DR-17, its ⋯ menu:** Read Psalm 1, Compare translations, Share as an image, Earlier days, About this picture.
- **DR-18, Share as an image:** the verse on the day's picture, with both credited (BSB, WEB, KJV or LSV only).
- **DR-19, Earlier days:** this month's pictures and verses, at most 30, since the psalter repeats monthly.
- **DR-20, Your reading (decision):** John asked for "better gamification". The gentlest version is days with
  Scripture this year, counting up only, plus books filling in chapter by chapter and books read through, under
  Bible › ⋯. It has no streak, no best and no badges, and nothing is ever lost. It is still a tally, so it ships
  only if John says yes.

## 3a. Decided by John (15 Oct 2026)

John: "I like all four. i like all your other decisions even the ones that needed me. and i dont mind the sharing and
dr-20 count that only goes up."

| Question | Decision |
|---|---|
| Two reminders a day (DR-05) | Yes: a second time for the evening psalms only, off by default |
| "Days you read" month (DR-10) | No, as recommended |
| A streak | **Yes, defined** (DR-21, DR-22): a day counts when you read or listen. One day of rest a week never breaks it. If it stops, it starts again quietly. No "lost", no best, no restore, no notifications. Its mark is a lamp, on Today only |
| Your reading (DR-20) | Yes: days with Scripture this year (counting up only), books filling in, books read through |
| Share as an image (DR-18) | Yes |
| Which psalter | The 1662 morning and evening table; One a day stays in Settings |
| Doors from outside | Content lands on content, and "Today" opens the Today tab |
| Widget name | "Today" |
| Greeting | "Good morning", "Good afternoon" or "Good evening", with no name |
| Cards | Allowed, used right (CLAUDE.md, `docs/redesign/polish-2026-10-15.md`): one card per self-contained thing you tap, no shadow, never nested |
| Pictures | Public-domain US government photography (US Fish & Wildlife, NPS, NOAA, NASA), with Unsplash photos downloaded once and kept on R2 to fill gaps. One treatment for all: portrait crop, gentle grade, soft fade. Each shows a line from the day's psalms. Day 1 is drawn: morning, *River reflection* (Steve Hillebrand, USFWS) for Psalm 1:3; evening, *Milky Way over Big Prairie* (Glacier NPS) for Psalm 8:3 |
| Spurgeon | A sampled review first, as with the debates |
| Devotional | `docs/devotional-plan.md`: ask Our Daily Bread for a licence (John sends the request); ship Spurgeon, with Daily Light as a second choice, until then |

## 3. Choices for John (as first written; see 3a for the decisions)

These would change a rule John or the design record already set, so they are not decided here.

1. **Two reminders a day (DR-05).** NT says one notification a day at most. *Recommended:* allow a second time for
   the evening psalms only, off by default. If John says no, the Reminder keeps one time, and the evening psalms
   reach the reader through the widget and Home.
2. **A record of days read (DR-10).** A private month with a dot on each day read is a tally, so it breaks the RP,
   NT and MM rules. *Recommended: no.* The habit rests on the time of day, not on a record. If John wants a record,
   this frame is the gentlest version: private, no number, no line joining days, and no notification about it.
3. **A streak** (a count of days in a row, as in Speak or Duolingo). *Recommended: no.* It is not drawn. It would
   break four rules: streaks, "Day N", "you missed" when it resets, and the celebration on milestones. If John wants
   one anyway, it gets drawn first, and the rules in roadmap v2 and the NT notes change in writing.
4. **Which psalter.** *Recommended:* morning and evening by the 1662 table, as DR-04's default. The alternative is
   One a day, today's 150-day cycle, which needs no new data. Both stay in Settings.

## 4. Order of work

Each step ends as the next-release plan's phases do: `pnpm -r typecheck` and `pnpm -r test` green (check `$?`
directly, never through a pipe), Maestro flow updated, simulator screenshots in Light, Dark and AX5 beside the
rendered frames, and one commit.

0. **Gate.** John answers §3 and reviews DR-01–10. Build 6 has merged into `build-next-release`, and build 7 rebases
   on it: it depends on build 6's stop menu, `openFromOutside` and the widget redesign.
1. **Draw the rest** with `/design`, with a Mobbin pattern cited for each: SD (the reader's Search door) and AD
   (Download John in the Voice sheet without playing). John reviews them.
1b. **IA v4 tabs** (IA-15–17): move the routes under `(tabs)` with Expo Router's native tabs (first check that SDK 57
   supports the bottom accessory). Today and Bible are stacks; the reader is presented full-screen over them, and its
   return chip names the tab. Update `openFromOutside` so content lands on content and "Today" opens the tab.
2. **C: Live Activity tap.** Add `widgetURL` to the `ActivityConfiguration`, pointing at a player deep link handled by
   `openFromOutside`. Test it on a device.
3. **Daily psalms data.** Pin the 1662 table source, add a `dailyPsalms` table or JSON with its sha256 in
   `sources.manifest.json` and Sources, then `lib/dailyPsalms.ts` with tests (each day, the 31st, February, Psalm 119
   ranges, the 17:00 switch, DST).
3b. **Spurgeon and the photos:** pin *Morning and Evening*, build `devotional.v1.db`, and run a sampled review in
   `packages/review`. Build the photo list and its manifest from CC0 sources, publish to R2 (John's step), and
   prefetch a week ahead on the phone.
4. **Today (DR-11–15) and daily psalms in the app:** Settings (DR-04), the Home row (DR-01, DR-09), the reader's next-in-set (DR-02,
   DR-03), the widget's 17:00 switch (DR-07), and the reminder kind (DR-06; DR-05 only if approved).
5. **B: the mini player** as the tab bar's accessory (IA-17), collapsing on scroll. Inside the reader, the reader's
   own bar keeps Listen.
6. **Evening listening (DR-08):** queue a set, add the stop option.
7. **D and E:** the Search door and the audio download, as drawn in step 1.
8. **F and the App Shortcut.**
9. **QA against the frames**, as in the next-release plan's Phase 8, written to `docs/redesign/qa-build-7.md`.

## 5. Risks

- **The 1662 table's source and rights.** The Book of Common Prayer is under Crown rights in England, administered
  like the KJV by Cambridge University Press. A table of psalm numbers is very likely not protectable, but this is
  checked rather than assumed: it is added to the open CUP question, and the licence is read from the source file
  (rule 3). No Coverdale psalter text is used.
- **Superscriptions sit inside verse 1** in the BSB data ("For the choirmaster … A Psalm of David. O LORD …"), so a
  notification or widget shows the heading first (DR-06, DR-07 draw it that way). Showing the psalm's own first words
  needs the heading marked in the data. That is a pipeline rule, never a hand edit.
- **Psalm 119 in parts** needs ranges throughout: Home's label, the reader's next-in-set, the player queue.
- **Time zones and DST:** the set comes from the local date, and the 17:00 widget entry must survive a clock change.
  Tests cover both.
- **Build 6 is not merged yet.** Its stop menu, `openFromOutside` and the widget redesign are dependencies. If they
  change, DR-07 and DR-08 are redrawn.
- **Notification budget:** two kinds with a two-week horizon is up to 28 scheduled notifications, well under iOS's
  64. NT-09's pause after 14 days away still applies to both.
- **Photos:** a year of images is about 365 files on R2. Size them for the phone (about 1200 px, HEIC or AVIF),
  keep a week on the device, and remove the rest. Each needs alt text, written in the review queue and approved by
  John, since VoiceOver reads it.
- **Habit creep:** each later "habit" idea is checked against §3 before it is drawn.

## 6. Open questions (besides §3)

1. Should the evening start at 17:00 for everyone, or follow the reader's evening reminder time when one is set?
   (Proposed: the earlier of the two.)
2. Should the daily psalms follow the reader's translation (WEB, KJV or LSV) in the reader, while widgets and
   notifications stay BSB as today? (Proposed: yes.)
3. Should the Home row hide after the evening set is read, or stay until midnight? (Proposed: it stays. Hiding it
   would mark the day as "done".)
4. Should the M'Cheyne plan and daily psalms both show on Home when both are on? (Proposed: yes, as two lines. They
   are different things: one is a plan, the other is the day.)
