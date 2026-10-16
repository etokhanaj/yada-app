# Build 7 plan

Written 15 Oct 2026 with John, in one session. How each decision was reached is in `docs/build-7-planning-log.md`.
This page is the plan to build from.

**Branch:** `claude/build-7-plan`, from `build-6`. Build 7 starts once build 6 has merged into
`build-next-release`; rebase on it then.
**Frames:** the canvas's **Build 7 · a daily rhythm** page, https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc,
each frame in Light, Dark and AX5. Render any frame for QA with
`YADA_ROOT=/Users/johnetokhana/yada python3 .claude/skills/design/scripts/render_frames.py <out> ONLY=DR-11`.
**Rules:** CLAUDE.md, updated today for cards. Rule 9 holds everywhere: licensed text (and a licensed devotional)
never reaches AI, the pipeline, notifications, widgets, Siri or share images.

## 0. Lean plan (John, 15 Oct 2026: "i dont have alot of credits, plan the build again with that in mind")

This section replaces §5's twelve phases. The design is done and stays as drawn. What changes is how much gets built
now, and how cheaply. Build 7 ships in two small releases; everything else moves to build 8.

### Build 7a: the daily rhythm (ship first)

1. **Sources, scripted once:**
   - the 1662 table (30 days);
   - the Daily Light references (732);
   - Spurgeon's *Morning and Evening* (732 entries), both from pinned CCEL copies;
   - the psalm-heading rule;
   - 30 morning pictures, one per psalter day, chosen in one batch and run through `grade_picture.py`.

   Evenings use the plain verse layout with no picture (DR-15). A small sample of each goes to John's review queue.
2. **Tabs and white:** Today and Bible tabs with Search beside them. The white tokens, titles and card component.
   The phone only: `supportsTablet` is false today, so iPad and the iPhone Duo's open layout wait for build 8.
3. **Today:**
   - the full-bleed picture with the greeting, lamp and verse;
   - the reading card (daily psalms, morning and evening);
   - the devotional card (Spurgeon) and the plan card;
   - Later and Earlier;
   - the 03:00 day boundary and the 17:00 switch;
   - first-day and no-picture states.
4. **The streak:** the lamp (lit or outlined) and the Your rhythm sheet (rest day, quiet restart, "This year").
   `lib/rhythm.ts`, tested.
5. **Daily psalms and the evening reminder:** `lib/dailyPsalms.ts`, tested; Settings › Daily psalms; next-in-set in
   the reader; a second reminder time.

### Build 7b: your space and quiet prayer

6. **Highlights** (four colours), **notes** (verse or chapter), **Copy**, **Saved**, export to Markdown.
7. **Share as an image** from the day's verse and from any selection, with Save and Share.
8. **Sit with this** (Settle, Breathe the verse, Sit with it, Silence) and the **private prayer list**. The list syncs
   through the iCloud key-value store Yada already uses (`modules/yada-cloud`), so no new native code is needed.

### Moved to build 8 (designed, not built now)

- Pray for others: CloudKit public database, moderation, legal text, age rating. It's the most expensive piece, and
  it needs the most of John's time.
- Prayers of the Bible: needs John's approval of the list first.
- The day's verse full screen: Earlier days, About this picture.
- Your reading page: build 7 keeps "This year: N days" in the rhythm sheet.
- Our Daily Bread: waits for the licence anyway. Spurgeon ships.
- Compare changes, Contents ⋯, tapping a verse in the player, downloading audio without playing.
- iPad, the iPhone Duo open layout, the Apple Watch.
- Evening pictures, and pictures beyond the first 30.
- Learn a verse by heart.

The CloudKit entitlement added on 15 Oct is harmless until then: the container just registers.

### Working cheaply

- **No more design work:** no new frames, Mobbin searches or canvas publishes during the build. Build from the frames
  as drawn; anything not drawn is built to this plan's text.
- **Delegate mechanical work** (data extraction, transcription diffs, unit tests) to a smaller, cheaper model through
  subagents, and keep the main session for app code and review.
- **QA once per release, not per phase:** screenshots in Light, plus AX5 for Today only, against the frames. Tests
  run per package while working; the full `pnpm -r typecheck` and `pnpm -r test` run before each commit
  (CLAUDE.md).
- **One push per release:** `/deslop`, `/review-code` and `/security-check` once, before the push, not per phase.
- **No web research during the build.** Sources are pinned in step 1, once.

### What John still needs to do

- Merge build 6.
- Send the Our Daily Bread draft, or not: Spurgeon covers 7a either way.
- Approve the sample batches in the review queue.
- Publish to R2 when asked.

CloudKit is set; the app group already existed. Pray for others' legal text, reports and age rating aren't needed
until build 8.

## 1. What build 7 is

Yada gets a second daily job beside reading the Bible: **the day**. A day has five parts:
- **the day's verse,** on a picture;
- **a reading,** the psalms, morning and evening;
- **a devotional;**
- **a gentle streak;**
- **your plan.**

The app moves to two tabs so both jobs have a home. The rest of the build is the polish John asked for, and the
carry-overs from build 6.

| # | Feature | Frames | Status |
|---|---|---|---|
| 1 | **IA v4: two tabs**, Today and Bible, with Search beside them; the reader covers the tabs; the mini player sits above the bar | IA-15–17 | drawn, approved |
| 2 | **Today:** greeting, the day's verse on a picture, the reading card (Read · Listen), devotional and plan cards, This evening / Earlier, Reminders | DR-11, DR-12, DR-15 | drawn, approved |
| 3 | **The day's verse full screen,** its ⋯ menu, Share as an image (Save to Photos · Share), Earlier days, About this picture | DR-14, DR-16–19 | drawn, approved |
| 4 | **Daily psalms:** the 1662 morning and evening table; One a day; Off | DR-02–04 | drawn, approved |
| 5 | **Reminders:** morning (next passage) and evening (psalms), each with its own time | DR-05, DR-06 | drawn, approved |
| 6 | **Widget "Today"** and Lock Screen: the day's verse; switches at 17:00 | DR-07 | drawn; picture variant to draw (§4) |
| 7 | **Night listening:** Stop at "End of this evening's psalms" | DR-08 | drawn, approved |
| 8 | **The streak, defined:** a lamp and a number on Today; the Your rhythm sheet | DR-21, DR-22 | drawn, approved |
| 9 | **Your reading:** days this year (counting up only), books filling in, books read through | DR-20 | drawn, approved |
| 10 | **Devotional:** Our Daily Bread once licensed; Spurgeon until then; Daily Light as a choice | DR-13 | drawn; licence pending |
| 11 | **Compare after YouVersion:** full names, Add or remove at the foot, drag to reorder | CP-01–09 (next page) | drawn |
| 12 | **Contents ⋯:** Recent, Book order (Traditional / A to Z), Choose a verse | CT-01–03 | drawn |
| 13 | **System polish:** white, spacing, titles, controls, cards used right | all v2 frames | drawn; `docs/redesign/polish-2026-10-15.md` |
| 14 | **Player, from the lyrics study:** tap a verse in the full player to play from it; select verses in the reader › Share as an image | §4 | to draw |
| 16 | **Your space:** highlights in four colours, notes on a verse or chapter, Copy in the bar, Saved (highlights, notes, bookmarks, images, Your reading), export, an image for any verse | PS-01–05 | drawn; badges recommended against (`docs/research/bible-app-needs-2026-10.md`) |
| 17 | **Today's devotional and plan cards** redesigned: full width, title, author or reference, reading time, plan progress | DR-11, DR-12 | drawn |
| 18 | **Pray, inside Today** (John approved 15 Oct 2026, via the build-next-release session): Sit with this (Settle, Breathe the verse, Sit with it, Silence); a private prayer list; Prayers of the Bible (the list awaits John's approval); pray for each other, lean v1 on the CloudKit public database | PR-01–12 | drawn |
| 19 | **Learn a verse by heart:** the verse read aloud, then words fade a few at a time while the reader says it back; no score | to draw | decided by Claude for John, 15 Oct |
| 15 | **Carry-overs:** the Live Activity tap opens the player (`widgetURL` on the `ActivityConfiguration`); download a book's audio without playing it; a Search door in the reader | §4 | to draw |

**Not in build 7:** the timeline, themes, JPS 1917 (OT-only texts), and the licensed Download (LD, on hold: API.Bible
Starter's 5,000 calls a month).

## 2. Decisions (John, 15 Oct 2026)

| Topic | Decision |
|---|---|
| Habits | No streak-as-score. The streak is defined (row 8): read or listen counts; one rest day a week never breaks it; it restarts quietly; no "lost", no best, no restore, no notifications; a lamp, not a flame; on Today only |
| Tally | Your reading (row 9) only. No "days you read" month (DR-10 rejected) |
| Tabs | Today · Bible, Search beside them. A tab only for a daily job |
| Doors from outside | Content lands on content (the evening notification opens Psalm 6). Only "Today" opens the Today tab |
| Widget | Named "Today" |
| Greeting | "Good morning", "Good afternoon" or "Good evening", with no name |
| Cards | Allowed, used right: one card per self-contained thing you tap; soft fill, 24 pt radius, no shadow, never nested |
| White | White ground, neutral greys; forest stays the accent (brief §15 updated) |
| Pictures | Allowed on Today and the widget (brief §14 updated). Public-domain US government photography first, Unsplash and Pexels as backups, one colour treatment for all, no credit line on the picture |
| The day's verse | **Changed from the psalms to *Daily Light on the Daily Path*** (Bagster, about 1875, public domain): each date's morning and evening entry opens with a verse chosen by theme from across the Bible. That makes it a verse a day that isn't random, the same for everyone, and shown in the reader's translation from its reference. The psalms stay the day's *reading* |
| Devotional | Ask Our Daily Bread for a licence (John sends the drafted request in `docs/devotional-plan.md`); ship Spurgeon until then; Daily Light verses double as a Scripture-only devotional |
| Two reminders | Yes: morning and evening, the evening one off by default |
| Psalter | The 1662 table; One a day stays as a choice |

### Decided for John (15 Oct 2026: "on the things waiting for me, decide for me")

- **Badges:** no. Books read through (DR-20) are the milestones.
- **Learn a verse by heart:** yes, in build 7 (row 19).
- **Verses for a moment:** build 8. Its source (Daily Light's topics, or Nave's Topical Bible, 1896) needs vetting and
  John's review first.
- **The Our Daily Bread email:** John sends it; the draft is in `docs/devotional-plan.md`.
- **Push:** not until build 6 is on GitHub. This branch sits on unpushed `build-6`, and pushing it would publish
  that session's work.

### Pray, inside Today (row 18)

- **The loop:** the day's verse → Sit with this → the day's reading → Pray → tomorrow, where Answered lives.
- **Where:** no third tab. "Sit with this" is a pill on the day's verse, and Pray is one card after the reading.
- **Sit with this:** four optional steps.
  - Settle: a breathing pacer, in 4, out 6, with haptics. Under Reduce Motion, only the word and the haptic.
  - Breathe the verse: the verse split only at its own break, otherwise the step is skipped.
  - Sit with it: read slowly, twice, with silence between. Under a licensed translation the BSB shows.
  - Silence: 3, 5, 10 or 20 min.
  - Never: music, scripts, or claims about wellbeing. Meditation counts towards the streak; prayer never does.
- **Pray for each other, lean v1:**
  - Ask: 280 characters, first name optional, live 7 days, renewable.
  - Pray: press and hold about 20 s, or use a timer.
  - "N prayed" is shown only to the asker. Mark answered, Renew, Delete.
  - Safety: a word filter, Report (3 reports hide the request), Block. A request that mentions self-harm shows a
    helpline before it posts. Worldwide plan (John, 15 Oct: "whats the plan for like someone in nigeria?"):
    - a small bundled list of each region's main line, verified against Find A Helpline (ThroughLine; verified
      services in 175+ countries) before every release, so it works offline: Samaritans 116 123 (UK, Ireland),
      988 (US), SURPIN 0800 078 7746 (Nigeria, 24 hours, toll-free), and so on;
    - "More helplines in <country>" opens findahelpline.com/<country>. Only the country code leaves the phone;
    - a region with no verified line shows Find A Helpline only;
    - later: ask ThroughLine about its helpline API or widget for apps (terms and price unknown), to replace the
      bundled list.
  - UI (John, 15 Oct: "clean up UI for just prayer"): Pray and its lists keep the tab bar; praying, asking and Sit
    with this cover it. Post sits on a bar above the keyboard. Hold to pray is a pill at the foot that fills as you
    hold. Your requests use a ⋯ menu per row.
  - Storage: CloudKit public database.
  - Built to grow (`docs/build-8-plan.md` on build-next-release): a stable record ID per request and per prayed
    mark, and an answered field with its date, so answered notifications, moderation in the review tool, reminders
    and circles come later without a redesign.
- **Needs John outside the code:** CloudKit on the App ID; privacy and terms text with "I agree"; checking reports;
  the age rating for user content.
- **Scope risk:** if build 7 runs long, move community prayer to build 8 whole.

### Apple Watch (John, 15 Oct 2026: "do an apple watch pass on build 7"; frames AW-01–03)

- **In build 7, cheap because it shares code with the iPhone widget:**
  - a Smart Stack widget "Today": the day's verse, short, and this morning's or evening's psalms;
  - complications: rectangular "Today · Psalms 1–5", and a circular Yada mark that opens Today;
  - mirrored from the iPhone for free: the two reminders (Listen plays on the iPhone) and the listening Live Activity
    in the Smart Stack. Test both on a watch.
- **Correction from the UX stress test:** watchOS widgets and complications need a watch app target; the iPhone's
  widget doesn't appear on the watch. So build 7 ships only the mirrored reminders and the Live Activity. The Smart
  Stack widget and complications move to build 8 with the watch app.
- **Build 8 candidate, a small watch app:** Sit with this on the wrist (Settle with a haptic tap on each breath,
  Breathe the verse, Silence). It needs a native SwiftUI watch target (Expo has none; expo-apple-targets can add one,
  as for the widget) and the day's verse passed through the app group or WatchConnectivity.
- **Never on the watch:** whole chapters, Understand, Compare, the prayer list, pray-for-others, licensed text
  (rule 9), the streak.

### Accessibility, iPad and iPhone Duo passes (John, 15 Oct 2026)

- **Accessibility:** `docs/redesign/a11y-build-7.md`. Fixed:
  - the note mark gets a 44 pt hit area;
  - verse numbers on highlights use ink;
  - "Sit with this" and "First name" are 44 pt;
  - a stronger fade under the verse, with a contrast check for every picture in the pipeline.
- **Rules added:**
  - timed gestures always have an alternative (hold to pray: a timer and a VoiceOver action);
  - Silence ends with a VoiceOver announcement and an optional sound;
  - requests are read in their own language.
- **iPad (TB-01–03):** one regular-width layout family. The sidebar in landscape and tabs at the top in portrait;
  Today in two columns; the reader keeps a reading measure and opens Understand beside the text. Keyboard
  shortcuts, pointer and Stage Manager widths.
- **iPhone Duo (DU-01–02):** reported 9 Sep 2026, 7.6" inner and 5.4" cover; not verified with Apple.
  - Cover: compact width, so the iPhone layout.
  - Open: the iPad family.
  - Folding keeps the place, the selection and any sheet.
  - Nothing crosses the hinge: the reader's two columns meet at the fold.
  - Size classes, never fixed points. Test on the device once it ships.

### UX and UI stress test (15 Oct 2026; `docs/build-7-ux-stress-test.md`, frames XT-01–05)

- **Day boundary:** 03:00 for Today, the streak and the widget.
- **The lamp:** outlined until today counts, then filled.
- **First day:** no lamp; "A place to start"; no Pray card.
- **Today's content:** the Reminders row leaves Today. Settings › Today can hide the devotional and Pray cards.
- **Licensed readers:** Today shows the reader's own translation on screen; system surfaces and the spoken word stay BSB.
- **Prayer:** no "0 prayed"; "That's everyone for now"; a request you prayed for isn't shown again; a hint to leave out
  others' names; the iCloud signed-out state.
- **Sit with this:** Begin states its length.
- **Highlights and notes** follow the verse reference across translations. Exports never carry licensed text.
- **Interruptions:** Silence and praying hold outside doors until they end.
- **Remove my data offline:** your community requests are deleted on the next connection.

## 3. Sources: what we have and what we still need

Nothing ships that isn't in this ledger with its licence read from the source (rule 3) and a pinned copy (sha256).

| Source | Needed for | Licence | Status | Next step |
|---|---|---|---|---|
| BSB, WEB, KJV, LSV | every text | public domain / CC BY-SA (LSV) | **have** (core bundle) | none |
| 1662 Psalter table (day → morning and evening psalms, Psalm 119 in parts, the 31st and February rules) | Daily psalms | the numbers are facts; the BCP is under Crown rights in England, so it is checked. Source site says: "none of the other materials on this site are protected by copyright"; it notes the Crown holds the BCP text in the UK | **have** (15 Oct 2026) | pinned eskimo.com/~lhowell/bcp1662 psalter pages in `content/raw/bcp1662/` (SHA256SUMS; fetched 2026-10-15), parsed twice by different methods, which agree; `apps/mobile/src/lib/dailyPsalms.ts`. Note the site transcribes a modern base text, not the 1662 printing; only the day division is used. CUP question still open |
| *Daily Light on the Daily Path* (references for 366 mornings and evenings) | the day's verse | CCEL ThML header: `<DC.Rights>Public Domain</DC.Rights>` | **have** (15 Oct 2026) | `content/raw/daily-light/daily_light.xml` (CCEL whole-book ThML, sha256 `431c581d…8868`, fetched 2026-10-15); headline references parsed from its `scripRef` markup into `apps/mobile/src/data/dailyLight.json` (732 entries, all checked against core.v5 by `scripts/check-daily-light.mjs`). 1 Nov am Prov 8:34 and pm Isa 9:6 now confirmed from the source. Still to do: sample against a printed copy |
| Spurgeon, *Morning and Evening* | devotional (until ODB) | CCEL ThML header: `<DC.Rights>Public Domain</DC.Rights>` | **have** (15 Oct 2026) | `content/raw/spurgeon-morneve/morneve.xml` (CCEL whole-book ThML, sha256 `3512797a…a4`, fetched 2026-10-15) loaded to `content/bundles/devotional-spurgeon.v1.db` (732 entries, status `unreviewed`). Still to do: sampled review in `packages/review` |
| Our Daily Bread | devotional | © ODB; needs a written licence | **requested** (John sends the email) | on reply, record the terms in `docs/licensed-translations.md` style; build to the terms |
| Day pictures: one for each Daily Light morning verse (366) and a smaller evening set | Today, widget, full screen | public domain or Unsplash/Pexels licence, read per file | **3 chosen** (day 1 morning and evening; see `docs/pictures-plan.md`) | build the manifest; choose in batches of a month; John approves; publish to R2 (John's step) |
| Picture treatment | every picture | ours | **have** (`.claude/skills/design/scripts/grade_picture.py`) | move into `packages/pipeline` |
| Psalm superscriptions marked apart from verse 1 | notification and card excerpts ("For the choirmaster…") | data | **missing** | a pipeline rule that marks the heading in the bundle; never a hand edit |
| Recorded audio for the psalms (Heart) | Listen on Today, night listening | ours | **partial** (BSB run in progress) | the psalms first in the next audio batch |
| Lamp icon, tab icons | Today, tab bar | ours | drawn on the canvas | an SF Symbol is preferred if one fits; otherwise ship our SVG |

## 4. Still to draw (before building them)

1. **The widget with the day's picture** (medium and small; the Lock Screen stays text). Check text contrast on the fade.
2. **Player:** tap a verse in the full player to play from it. Apple Music and Spotify both do this, and it's the
   commonest correction while listening.
3. **Reader:** select verses › ⋯ › Share as an image, making DR-18's card from the selection (Spotify's "Select
   lyrics" to a card). BSB/WEB/KJV/LSV only.
4. **The reader's Search door,** now the reader covers the tabs.
5. **Download a book's audio without playing it** (in the Voice sheet).
6. **Learn a verse by heart** (fading words, building on Repeat) and **Verses for a moment** (from a public-domain
   topical source), if John wants them: `docs/research/bible-app-needs-2026-10.md`.
7. **Today with a Daily Light verse:** redraw DR-11, DR-16 and DR-18 with 1 November's verse and a matching picture,
   once the references are verified.

From the lyrics study, not taken: Apple Music's controls that hide themselves (they're hard to find again), YouTube
Music's lyrics tab (ours shows the text by default), Spotify's translation under each line (Compare does this
better), and blurred past lines (they're harder to read).

## 5. Order of work (superseded by §0, the lean plan; kept for build 8)

Each phase ends with:
- `pnpm -r typecheck` and `pnpm -r test` green (exit code checked directly, never through a pipe);
- the Maestro flow updated;
- simulator screenshots in Light, Dark and AX5 next to the rendered frames;
- one local commit.

Pushes go out per phase, only after John says yes and after `/deslop`, `/review-code` and `/security-check`.

**Phase 0, gate (needs John, §8):** build 6 merged into `build-next-release` and this branch rebased on it; the §8
checklist done.

**Phase 1, sources (pipeline only, no app work).** Each with tests against a frozen fixture:
- pin and transcribe the 1662 psalter table (two passes, diffed);
- extract the Daily Light references (366 × 2);
- pin Spurgeon's *Morning and Evening*, with a sampled entry set for John's review;
- mark psalm superscriptions apart from verse 1;
- build `content/pictures/manifest.json` and move `grade_picture.py` into `packages/pipeline`, with the 4.5:1
  contrast check;
- the helpline list (§3 of Pray), verified against Find A Helpline.

**Phase 2, foundations in the app:**
- IA v4 tabs: routes under `(tabs)`, with the sidebar on iPad and the iPhone Duo open;
- the reader presented full screen, its return chip naming the tab;
- `openFromOutside` holds while Silence or praying is running;
- the system polish: the white tokens, the card component, titles and controls.

**Phase 3, Today:**
- the full-bleed picture with the greeting, lamp and verse;
- the sheet holding the reading, devotional, plan and Pray cards, and Later or Earlier;
- the 03:00 day boundary, and the 17:00 switch to evening;
- the AX5 and no-picture layouts;
- first-day and edge states (XT, EB).

**Phase 4, the day's verse:** full screen, ⋯, Share as an image (Save and Share), Earlier days, About this picture.

**Phase 5, daily psalms and reminders:**
- `lib/dailyPsalms.ts`;
- Settings › Daily psalms and Settings › Today;
- next-in-set in the reader;
- the morning and evening reminders;
- Stop at the end of this evening's psalms.

**Phase 6, the streak and Your reading:** `lib/rhythm.ts` (rest day, restart, time zones, the clock moved back,
iCloud union); the lamp, the Your rhythm sheet, the Your reading page.

**Phase 7, the devotional:** Spurgeon from the bundle; Daily Light; Our Daily Bread behind a flag until licensed.

**Phase 8, your space:**
- highlights and notes in `user.db`, synced through iCloud;
- the bar's second row;
- Saved;
- export (Markdown or PDF, never licensed text);
- Share as an image from any selection.

**Phase 9, Pray, private:**
- Sit with this (Settle, Breathe the verse, Sit with it, Silence; haptics; Reduce Motion);
- the prayer list in iCloud;
- Prayers of the Bible, once John approves the list.

**Phase 10, Pray for others:**
- the CloudKit public database, with a stable record ID per request and per prayed mark;
- Ask, Pray (hold or timer), Your requests;
- word filter, Report, Block;
- helplines by region.

Ships only if complete; otherwise it moves to build 8 whole.

**Phase 11, the rest:**
- Compare (full names, Add or remove, reorder);
- Contents ⋯;
- tap a verse in the player to play from it;
- the Live Activity tap;
- download a book's audio without playing;
- the reader's Search door;
- the Watch's mirrored notifications and Live Activity checked on a watch.

**Phase 12, QA against the frames:** written to `docs/redesign/qa-build-7.md`, with the accessibility checks in
`docs/redesign/a11y-build-7.md`.

**Drawn later, before their phase:**
- the widget with the picture;
- the reader's Search door;
- the audio download;
- Learn a verse by heart;
- Today with the Daily Light verse, once the references are verified.

## 6. Edge cases

| Area | Case | Handling |
|---|---|---|
| Daily psalms | the 31st; February; Psalm 119 split over days | the 1662 rules exactly as the pinned source states them; a set is a list of verse ranges ("Psalm 119:1–32") |
| Time | Today open across 17:00 or midnight; travel across time zones; daylight saving | the set comes from the local date; Today refreshes on foreground and on a timer at the boundaries; the widget timeline has entries at 00:00 and 17:00 |
| Daily psalms off | no reading card | the lead card becomes your plan's next reading (Continue's target) |
| No plan | the plan card has nothing to show | "Choose a plan", opening Reading plans |
| Licensed reader (NKJV) | Today's verse and reading | Today's text is the BSB, labelled; Read opens the NKJV page; share images and widgets stay BSB (rule 9) |
| Picture | not downloaded yet; offline on first day | DR-15: no picture and no placeholder; the verse shows as text on the page |
| Picture | Reduce Transparency, High Contrast | the fade becomes a solid dark band under the text |
| Verse length | a long Daily Light verse | Today clamps at 4 lines (3 at AX5) with "…"; full screen shows it whole and scrolls at AX5 |
| Devotional | ODB offline or licence ended; Spurgeon entry rejected in review | ODB offline: "Our Daily Bread needs a connection" in the card. Licence ended: falls back to Spurgeon. A rejected date: no devotional card that day |
| Leap day | 29 February | Daily Light and Spurgeon both have entries; the 1662 rule from the source |
| Streak | the clock moved back; a new phone; two phones | days are stored as local dates, never counted twice; future dates are ignored; iCloud merges the set of days from all devices |
| Streak | reading just before and after midnight | one day each; listening counts after two minutes in that day |
| Streak | Remove my data | the alert says it clears the streak and Your reading too (ST-03's sentence gains "your rhythm and reading record") |
| Your reading | re-reading a chapter; one-chapter books | a chapter counts once; one-chapter books show "1 of 1" and move to Read through |
| Reminders | permission denied; away for two weeks | NT-10 and NT-09 cover both kinds |
| Tabs | a notification arrives with a sheet or the player open | `openFromOutside` closes them, then lands; the return chip names Today if the door was Today's, otherwise Bible |
| Tabs | the keyboard is up (Search) | the mini player and tab bar hide while it is up |
| Share as an image | the reader's translation is licensed | the image uses the BSB and says "BSB" |
| Contents | Choose a verse on a version with different verse numbers (Psalm headings, JPS later) | the grid uses that version's own verse count |
| Contents | A to Z with numbered books | sorted by name, numbers after ("John, 1 John, 2 John, 3 John") |
| Compare | only one version chosen; removing your own | one is allowed; your own can't be removed, it is the base |
| Accessibility | every picture | alt text written in review and approved by John; never the photographer's caption copied blindly |

## 7. Risks

- **Expo native tabs and the bottom accessory** may not be in SDK 57. Fallback: a custom tab bar with the same look,
  keeping VoiceOver's tab traits.
- **The 1662 table's rights** sit with the CUP question.
- **Daily Light extraction errors:** two people's transcriptions are diffed; the oracle rule (CLAUDE.md 5) applies.
- **Picture supply** for the whole year: do it in monthly batches, so the launch needs only the first month.
- **ODB may refuse or charge:** Spurgeon stays the default; Our Daily Bread is only an option.
- **Habit creep:** any new habit feature is checked against §2's streak and tally rules before it is drawn.

## 8. What I need from John before Phase 1 (15 Oct 2026)

Everything else I can do myself. These need John, his accounts or his decision.

| # | What | Why | How long |
|---|---|---|---|
| 1 | **Merge build 6 into `build-next-release`** (or say it's done), then say "go" | Build 7 builds on build 6's stop menu, `openFromOutside` and widgets; `build-6` has moved since this branch was cut | the other session's job; a yes from John |
| 2 | **Permission to push this branch** once rebased, after `/deslop`, `/review-code` and `/security-check` | CLAUDE.md: ask before any push | a yes |
| 3 | **Send the Our Daily Bread email** (draft in `docs/devotional-plan.md`) | licence for the devotional; Spurgeon ships until then | 2 min |
| 4 | **CloudKit on the App ID:** in the Apple Developer portal, Identifiers › Yada's App ID › iCloud › CloudKit, with a container (suggested `iCloud.studio.yada.reader`) | the prayer list's iCloud sync and Pray for others | 5 min |
| 5 | **App group for the widget** already exists for build 6; confirm the same group can hold the day's verse and picture | the widget reads the day from it | a yes |
| 6 | **Approve, in the review queue, as each is ready:** the Prayers of the Bible list; a sample of Spurgeon entries; the first month of pictures and their alt text | rule 2: John approves what readers see | in batches |
| 7 | **Privacy policy and terms text for Pray for others** (I draft; John approves and publishes on the website): UK GDPR special-category data (religion, health), "I agree" before a first post, deletion on request | required before community prayer can ship | review the draft |
| 8 | **App Store Connect:** update the age rating questionnaire for user-generated content and add a support contact | App Review guideline 1.2 for user content | 10 min, at submission |
| 9 | **Checking reports** every few days once Pray for others is live (CloudKit Console, until the review tool has a moderation view in build 8) | 3 reports hide a request until John looks | ongoing |
| 10 | **R2 publishing** of the pictures and the new bundles (Daily Light, Spurgeon, the psalter table) | publishing to R2 is always John's step | when each is ready |
| 11 | **A real Apple Watch, and later an iPhone Duo,** for the checks only devices can do | haptics, mirrored notifications, the fold | when available |

**Not needed from John:** the sources work, the pictures' first selection, the helpline list, the drafts in §8.7,
every app phase, and the QA. I'll ask only at the gates in the table above.
