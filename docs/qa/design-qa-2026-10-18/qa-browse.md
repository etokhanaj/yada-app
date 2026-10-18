# Design QA: browse area (18 Oct 2026)

Area: the Bible tab home, Contents, Search, Bookmarks, Recent, Settings and its pages, Sources, the splash,
translations and downloads, reading plans, the reminder page and the notification ask, iCloud, and the IA pages
that draw them.

Judged against **HEAD 3a4a96d** on `claude/loving-cori-d57938`. Paths below are relative to `apps/mobile/src/`.

**Uncommitted edits in progress.** While this review ran, another session was editing this worktree (12 files,
uncommitted): `components/Type.tsx` (SectionTitle gets `inSheet`), `components/Sheet.tsx` (Section uses
SectionTitle), `components/Page.tsx` (ListRow minHeight 52 to 56), plus label changes in settings, reminder,
sources, downloads, search, contents/index, mcheyne, type-settings and pray/index. These look like fixes for G2 and
part of G3 below. The line numbers here are from HEAD. Check G2 and G3 again once those edits land. G1 (the page
title) is not in that diff.

Frames: the Light column of each `.dc.html`, read as markup and CSS. The polish block (style-v2.css "we go white",
15 Oct) applies to every v2 frame, so the frame colours here are already the current ones.

## Status counts (87 frames: 67 assigned, plus 20 found in frames.txt for these screens)

| Status | Count |
|---|---|
| MATCHES | 26 |
| DIFFERS | 29 |
| NOT BUILT | 8 |
| SUPERSEDED | 14 |
| DEFERRED BY DECISION | 8 |
| Left to the reader report | 2 (MT-06, IA-12) |

---

## Global differences (apply to every page in this area)

| # | What | App (HEAD) | Frame / decision | Severity |
|---|---|---|---|---|
| G1 | **Page titles are serif, not SF bold.** | `components/Page.tsx:31-51` LargeTitle uses `useType("display")`, which is Literata 34/600 with -0.6 tracking (`design/type.ts:33`). `TYPE.pageTitle` (SF 34/700, -0.8) exists at `type.ts:47` but PageScreen never uses it. | Polish: "Page titles: Literata serif → SF bold, tight tracking". Every frame: `.ltitle{font-family:-apple-system…;font-weight:700;letter-spacing:-0.8px}`. Affects Settings, Bookmarks, Recent, Reading plans, M'Cheyne, The Gospel of John plan, Sources and licences, Downloads and Reminder. | **high** |
| G2 | **Section titles are 13 pt grey labels, not 22 pt bold ink.** | `<Label>` (13 pt semibold, muted) at `settings.tsx:114,126,150,166,169,190`, `reminder.tsx:69,140,151`, `sources.tsx:76,115,152,167,186`, `downloads.tsx:56`, `search.tsx:190,213,242,276,292,316`, `contents/index.tsx:32`, `mcheyne.tsx:117`, `type-settings.tsx:116,141`, and sheet Sections (`Sheet.tsx:303`, used by Translations). `SectionTitle` (`Type.tsx:222`) was used only on Today and in the rhythm sheet. | Polish: "Section titles: 13 pt grey labels → 22 pt bold sans in ink (20 pt in sheets)". Frames: `.sec > .lbl{font-size:22px;font-weight:700;color:var(--ink)}` and `.sheet .sec > .lbl{font-size:20px}`. (An uncommitted edit is changing this now.) | **high** |
| G3 | Rows are tighter than the polish. | `Page.tsx:303-309` ListRow minHeight 52 and paddingVertical 12; the divider is `0 -1px 0` (`Page.tsx:232`). | Polish: "Rows: 52 pt, 1 px rule → 56 pt, hairline". Frames: `.lrow{min-height:56px;padding:15px 0}`, `box-shadow:0 -0.5px 0`. (An uncommitted edit sets minHeight to 56. The padding and the hairline remain.) | medium |
| G4 | **IA v4 tab bar.** No Search button beside the tabs. Pushed pages hide the tab bar. Launch always opens Today. | `app/(tabs)/_layout.tsx:12-29` has Today and Bible only. Its comment calls the search button "a separate piece of work (lean plan §0)", but build-7-plan §0 item 2 puts "Today and Bible tabs with Search beside them" in 7a. Settings, Bookmarks, Recent, Plans, Downloads, Reminder and Sources are root Stack screens (`app/_layout.tsx:278-287`), so they cover the bar. No last-tab memory: Today is the first trigger, and grep finds no `initialRouteName` or last-tab code. | IA-15: `.tbs` round Search button beside `.tbar`. Canvas note ia4: "Pushed pages (Settings, Reading plans, Bookmarks, Downloads) keep the bar". DR-04, DO-03, NB-04 and PS-04 all draw the tab bar under the page. refs_i7: "Yada opens on the last tab used; the first launch opens Bible." From Today there is no way to Search. | **high** |
| G5 | Secondary buttons are not grey pills. | Bookmarks' Edit is GlassText, with blur and shadow (`bookmarks.tsx:70`, `Page.tsx:62-70`). Home's Resume, Turn off and Not now are accent text links (`(tabs)/index.tsx:295-331`). Reminder's Open Settings is a list row with a chevron (`reminder.tsx:63`). The Translations failure shows "Try again" as accent text (`translations.tsx:236-239`). | Polish: "grey-fill pills for secondary actions" (`.tbtn`, `.tbtn2`, `.tbtn2.outline`). | medium |
| G6 | Sheet header × and ‹ are grey-filled. | `Sheet.tsx:164` `backgroundColor: palette.fill` | Polish: `.sh-x,.sh-back{background:var(--paper);box-shadow:0 0 0 1px var(--div)}`, a white circle with a hairline ring. | low |
| G7 | Page back chip text is 16 pt. | `Page.tsx:134` `size={16}` | `.hb-back` font-size `var(--chrome)` = 17 | low |

---

## Bible tab home (`app/(tabs)/index.tsx`)

| Frame | Status | Differences (file:line, frame vs app) | Sev |
|---|---|---|---|
| BH-01 (b9, newest) | DIFFERS | The structure matches: wordmark, a serif "Continue" heading (Literata 24/600), one 24 pt fill card (Literata 26 title, muted passage heading), serif "Old Testament" heading, book rows with no chevron. Differences: (1) no Search circle beside the tab bar (G4). (2) The first heading has no 26 pt top margin; the frame's `.bhh{margin:26px 0 10px}` sits under the wordmark, but the app's StartCard Heading has only marginBottom 10 (`index.tsx:397,445`) after PageScreen's 18 pt. (3) G3 row metrics. | high (Search), low (rest) |
| DR-01 (b7) | SUPERSEDED | BH-01 replaces its Bible tab: no progress ticks, and Your plan lives on Today only (`index.tsx:217-222`). "Yada opens on the last one used" is not built (G4). | medium (launch tab) |
| IA-14 | SUPERSEDED | BH-01 replaces it: the one-line plan row has moved to Today. | n/a |
| ST-05 | SUPERSEDED (layout) / MATCHES (menu) | The ⋯ menu (Recent, Reading plans, Settings) matches `index.tsx:199-203`. The Home layout behind it is replaced by BH-01. | n/a |
| NT-11 | SUPERSEDED | The Reminder row moved into Settings (build-6-decisions #5, IA-11, ST-05). | n/a |
| NP-03 | DIFFERS | The copy matches ("A reminder to read each day?", Turn on, Not now). The frame's `.pnote` has the line as a 17 pt/500 ink `.claim`, two pills (`.tbtn2` grey fill, `.tbtn2.outline`), and a hairline under the block. The app has a 13 pt muted note (`index.tsx:305`), accent text buttons (`index.tsx:309-331`), and no rule. | medium |
| NT-09 | DIFFERS | Same pattern for "Reminders paused while you were away." with Resume and Turn off (`index.tsx:288-302`): muted 13 pt text and accent links, where the frame has a claim line and grey and outline pills. | medium |

## Contents (`app/contents/*`, `components/Contents.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| C-01 | SUPERSEDED | MT-01 replaced its BSB/WEB/KJV segment with a Translation row. The rest (the testament being read first, a tick on the current book in place of a chevron) matches `contents/index.tsx:25,55-57`. | n/a |
| MT-01 | MATCHES | Translation row with value "BSB" (`Contents.tsx:23-42`) and tick plus semibold on the book being read. The testament headings follow G2: 13 pt grey vs 20 pt bold in a sheet (`contents/index.tsx:32`). | (G2) |
| C-02 | DIFFERS (low) | The chapter grid matches: 5 columns (3 at AX), 56 pt cells (96 at AX), radius 16, Literata 20, the current chapter in ink (`[book].tsx:20-44`). The segment is replaced by the Translation row, as MT-01 decided. | low |
| CT-01 | DEFERRED BY DECISION (not built) | There is no ⋯ in Contents (grep finds no "book order" or "choose a verse"). build-7-plan.md §0, "Moved to build 8": "Compare changes, **Contents ⋯**, …". **But build-8-plan.md does not list it**, so it is in no current plan. Also, CT-01 to CT-03 still draw the old segmented BSB/WEB/KJV control with ⋯ beside it, which contradicts MT-01's Translation row; the frame needs redrawing before it is built. | medium |
| CT-02 | DEFERRED BY DECISION (not built) | A to Z book order. Same note as CT-01. | medium |
| CT-03 | DEFERRED BY DECISION (not built) | Choose a verse grid. Same note as CT-01. | medium |

## Search (`app/search.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| S-01 | MATCHES | Field with Cancel, then the "Go to" group with the reference and its excerpt (`search.tsx:138-207`). Section label: G2. | (G2) |
| S-02 | MATCHES | Words group (5, then "Show all N words") and verse hits with the match bold. The frame's "Passages · 331" is now "Verses · N" in the newer EG-07 and PD-04 frames; the app follows them (`search.tsx:316`). | (G2) |
| S-03 | MATCHES | Greek headword, transliteration, "gloss", and "Greek · N times" (`search.tsx:242-271`). | — |
| S-04 | DIFFERS | (1) "330 times in 318 verses" is the header subtitle `.ssub` in the frame; the app puts it in the body as muted claim text and uses the verse reference as the subtitle (`evidence/in-bible.tsx:31-44`). (2) The title's λόγος is in Gentium (`.gk`) in the frame; the app sets it in the sheet title's SF. | low |
| E-04 | MATCHES | "No results for “…”." plus the one-line hint (`search.tsx:340-347`). | — |
| VM-01 (b9) | NOT BUILT | Before typing, the app shows an empty body: `search.tsx:187-348` renders nothing until a query exists. The "For a moment" tiles are build 10c, approved 18 Oct and not yet built. | medium |
| DI-04 | NOT BUILT | "Browse the dictionary from Search's empty state" (refs_di, IA-11). Same empty body as above. | medium |
| DI-03 / PD-04 | NOT BUILT | A "Dictionary" group before the verses. Search has Go to, People, Words and Verses only (`search.tsx:188-338`). IA-11 lists "Dictionary (Translation Words) → term". | medium |
| IA-06 | NOT BUILT | A "Guides" group (a passage title finds its guide). Not in `search.tsx`. IA-11 lists "Guides → guide". | medium |

## Bookmarks, Recent, Saved (`app/bookmarks.tsx`, `app/recent.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| B-01 | DIFFERS (low) | The rows match: reference overline, 2-line Literata excerpt, no chevron. The Edit control is a blurred glass capsule with a shadow (`bookmarks.tsx:70`); the frame's `.tbtn` is a grey-fill pill with no shadow (G5). G1 title. | low (+G1) |
| B-02 | MATCHES | "No bookmarks yet." and "Tap a verse, then ⋯ › Bookmark." (`bookmarks.tsx:74-83`). | (G1) |
| B-03 | MATCHES | The filled bookmark glyph sits beside the verse number (`components/Verse.tsx:10,201`). | — |
| US-11 | MATCHES | "· BSB" on the reference under a licensed version (`bookmarks.tsx:85`). | — |
| IC-01 | DIFFERS (low) | The copy adds a clause: "…kept in iCloud **when you’re signed in**." (`bookmarks.tsx:127`) vs "Bookmarks and your reading place are kept in iCloud." The line is also hidden whenever `cloudAvailable()` is false. | low |
| IC-02 | NOT BUILT | The signed-out line ("On this iPhone only. Sign in to iCloud in Settings to keep them.") is omitted on purpose. `bookmarks.tsx:9-13` says no reliable signed-in signal exists. That decision is recorded only in a code comment, not in a doc. | low |
| R-01 | MATCHES | Reference · tag (Greek or Hebrew word, or "Understand") in ink semibold over the excerpt (`recent.tsx:94-111`). | (G1) |
| E-05 | MATCHES | "Nothing yet." / "Verses you explore appear here." | — |
| PS-04 (b7) | NOT BUILT | Saved (Highlights, Notes, Bookmarks, Images, Your reading). This is build 7b; the header still opens "Bookmarks" and grep finds no highlight store. | medium |

## Settings and its pages (`app/settings.tsx`, `reminder.tsx`, `sources.tsx`, `downloads.tsx`, `type-settings.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| ST-01 | DIFFERS | (1) G1 and G2 apply, and Settings is where they show most. (2) Voice and Speed are native pop-up menus with no chevron (`settings.tsx:127-147`); the frame draws value rows with a chevron. Voice's value is the narrator ("Heart"), not "Recorded reading"; that naming is consistent with LB-09. (3) iCloud is a Switch (`settings.tsx:171-188`) where the frame has a value row "On ›". The whole row is hidden when `cloudAvailable()` is false, so a signed-out reader sees no iCloud row. (4) Added: a "Today" section (Daily psalms, from DR-04 and DO-03) and Privacy, Terms and Support rows (`settings.tsx:193-195`). refs_st held those links back until the site was live; it went live 16 Oct, so they are fine. | high (G1/G2), low (rest) |
| ST-03 | MATCHES | The alert copy matches, plus "your rhythm" (build 7) (`settings.tsx:91-103`). | — |
| DN-04 | MATCHES | "The download stops, then …" (`settings.tsx:95-96`). | — |
| DR-04 | SUPERSEDED | DO-03 has the four choices. | n/a |
| DO-03 (b7) | DIFFERS | Daily psalms is a native pop-up menu inside Settings (`settings.tsx:149-164`). The frame has its own page: "Daily psalms" title, "‹ Settings", radio rows with a tick, and the tab bar. The choice titles match (`lib/dailyPsalms.ts:163-169`). | medium |
| NB-04 (b7) | DIFFERS | The Reminder page structure: the frame has **Morning** (Every day 7:30, "The next passage" ✓), **Evening** ("This evening’s psalms · From Daily psalms" ✓), and **Sunday** ("Week in review" as a radio-tick row). The app has Time, an evening Switch shown only under the 1662 table, Sunday as a Switch, then "What it says" (`reminder.tsx:69-169`). The frame's back chip reads "Settings"; the app's is always "Back" (`reminder.tsx:56`). | medium |
| NT-02 | DIFFERS | (1) The preview frame is a solid `palette.accent` (`components/ReminderPreview.tsx:17`), which is **chartreuse #DBEC9A in Dark**. The frame's `.ntprev` is a sage-to-forest gradient (#6F8A7E→#2C4038), radius 24, with a translucent light banner (rgba(245,245,240,.82); dark rgba(30,40,36,.86)). The app's banner is solid `palette.sheet`, radius 16. (2) The frame's back is "Back" to the guide, but the guide offer is gone (build-6 decision #10), so the back should name Settings. (3) G2. | medium |
| NT-10 | DIFFERS | The message is a 13 pt muted note (`reminder.tsx:60`); the frame has a `.claim` line. Open Settings is a list row with a chevron (`reminder.tsx:63`); the frame has a grey `.tbtn2` pill. The frame dims the Time rows (`.valrow.off`); the app does not. | low |
| ST-04 | DIFFERS | (1) An added subtitle, "Built-in texts need no connection. Downloaded translations work offline once saved." (`sources.tsx:43`); ST-04 has none. (2) Explanations rows have no onPress or chevron, and the credit sits on second and third lines (`sources.tsx:119-137`); the frame has the trailing value "unfoldingWord · CC BY‑SA 4.0" with a chevron. (3) Extra groups (Understand, Today, Audio, Study notes). The frame's closing "Adapted: …" paragraph is replaced by a short line under Explanations (`sources.tsx:139-141`). | low-medium |
| SO-01, SO-02 | SUPERSEDED | Sources became "Sources and licences" under Settings (ST-04, IA-11). | n/a |
| ST-02 | DIFFERS (low) | The size is a second line, with a ⋯ glyph on the right (`downloads.tsx:45-51`); the frame has the size as the trailing `.valr`. "Recorded readings" is renamed "Readings" per LB-11, which is newer. | low |
| DN-05 | DIFFERS (low) | The order matches (Understand, then readings). The size placement is the same as ST-02. | low |
| LB-11 | MATCHES | "John · Heart · BSB" (`downloads.tsx:70-71`). | — |
| T-01 | DIFFERS (low) | The stepper ("3 of 6", A− and A+) and the three thumbnails match (`type-settings.tsx`). The section labels follow G2 (`type-settings.tsx:116,141`). The thumbnails keep the old chalk #F7F8F0 and #0E1814, as the frame does. | low |

## Translations (`app/translations.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| MT-02 | DIFFERS | (1) The header has a "Choose" text control in place of ‹ Back (`translations.tsx:112-126,205`); no frame draws it on Translations, and CP-06 puts Choose inside Compare. (2) Translations is a separate root sheet (`_layout.tsx:323`), pushed over Contents as a second sheet; MT-02 draws ‹ Back inside the same sheet (IA-12: pushed pages ‹ inside a sheet). (3) The download line drops the year ("1.3 MB", not "1901 · 1.3 MB"), by John's 10 Oct decision (`lib/translations.ts:215`); that is fine. (4) Section titles in sheets follow G2. | medium |
| MT-03 | MATCHES | Ring with a stop square, "0.6 of 1.3 MB"; tap cancels. | — |
| MT-04 | MATCHES | "Downloaded · 1.3 MB" and ⋯ › Remove. | — |
| MT-05 | MATCHES | "Downloads need a connection."; the glyphs go and the rows are not dimmed. | — |
| US-05 | DIFFERS (low) | "Didn’t download" matches. "Try again" is accent text (`translations.tsx:236-239`); the frame has a `.tbtn2` grey pill. | low |
| US-06 | MATCHES | "Not enough space on this iPhone"; the button stays. | — |
| LT-01 | DIFFERS (low) | The Online hint is "Needs a connection." (`translations.tsx:179,286`); the frame has "Needs a connection. Not read aloud." | low |
| MS-04 | NOT BUILT | UST ("Simplified Text") as an on-phone translation. BUILT_IN is BSB, WEB, KJV and LSV (`data/queries.ts:31`). build-8-plan §6 lists it as still open. | low |
| MT-06 | (reader report) | Reading John 1 in the YLT is the reader page. | — |
| LD-01 – LD-05 | DEFERRED BY DECISION | Licensed Download is not built. build-6-decisions.md "Download for the NKJV, NLT and The Message (LD-01 to LD-05): **Not in build 6**"; build-7-plan §1 "licensed Download (LD, on hold)"; build-8-plan line 31 needs the API.Bible Pro plan. Canvas note refs_ld: "ON HOLD". | n/a |

## Reading plans (`app/plans.tsx`, `mcheyne.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| RP-01 | DIFFERS (low) | Plan names are SF 17/500 (`plans.tsx:41,48`); the frame's `.nt` is Literata 20 (`--lrow`). The copy matches. | low |
| RP-02 | DIFFERS (low) | "Reading 1 of 365" is the page subtitle, a 13 pt muted note (`mcheyne.tsx:81`); the frame has it as the section title (`h3.lbl`, 22 pt bold). The Next row title is SF 18/600 (`mcheyne.tsx:103`); the frame's `.lmain.nt` is Literata 20/600. "No dates. It waits where you stop." matches. | low |
| RP-03 | DIFFERS (low) | As RP-02. The "Read" group matches, with its label under G2. | low |
| RP-04 | MATCHES | "Next in M’Cheyne" leads at the chapter end (`read/[book]/[chapter].tsx:904`). | — |

## Reminder ask and notifications (`app/remind-ask.tsx`, `data/reminder.ts`, `lib/reminder.ts`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| NP-01, NP-02 | SUPERSEDED | RT-05 (build 10a, approved 18 Oct) replaces them. `remind-ask.tsx` matches RT-05: "When will you read?", four tiles with times, the "Remind me at 7:30" pill, Remind me (accent), and Not now. iOS still asks only after Remind me, as NP-02 requires. | n/a |
| NT-01 | SUPERSEDED | The guide's "Remind me to read" row was removed (build-6-decisions #10). The ask is now RT-05 after the first passage (`read/[book]/[chapter].tsx:231`). | n/a |
| NT-03 | MATCHES | iOS's own alert, only after Turn on or Remind me. | — |
| NT-04 | MATCHES | "Next in John: <label>" over the first words (`lib/reminder.ts:110`). | — |
| NT-05 | MATCHES | Read and Listen actions (`data/reminder.ts:192-195`). | — |
| NT-06 | MATCHES | "A passage for today" (`lib/reminder.ts:120`). | — |
| NT-07 | MATCHES | "M’Cheyne · Reading N" (`lib/reminder.ts:115`). | — |
| NT-08 | DIFFERS (low) | The copy matches (`data/recordings.ts:343-346`). It fires only while the process is alive in the background; build-8-plan §6 still lists "background URLSession" as open. It carries no `data` target, so a tap cannot land on Settings › Downloads as IA-13 says. | low |

## Splash (`components/LaunchOverlay.tsx`)

| Frame | Status | Differences | Sev |
|---|---|---|---|
| SP-01 | DIFFERS (low) | The overlay ground is `PALETTES.dark.paper` = **#0B0C0B** (`LaunchOverlay.tsx:47`). The native splash is **#0E1814** (`app.config.ts:125`), and so is the frame (`.splash.on-dark{background:#0E1814}`). The comment at `LaunchOverlay.tsx:45` promises an invisible hand-over, but the ground changes colour at hand-over. | low |
| SP-02 | SUPERSEDED | A comparison only; SP-01 was chosen (canvas note refs_sp_v2). | n/a |
| SP-03 | MATCHES | A 150 ms cross-fade under Reduce Motion. | — |
| SP-04, SP-05 | DIFFERS (low) | The motion matches the note: tilt -8° with SPRING.standard, then scale 0.9, fade, and a 6 pt lift over 160 to 520 ms. Only the ground colour differs (SP-01). | low |

## Reader frames assigned here

| Frame | Status | Note |
|---|---|---|
| M-01 | MATCHES | Copy, Share and Bookmark in the native menu (`components/ActionBar.tsx:46-48,162-186`). |
| N-01 | SUPERSEDED (layout) | The note text is built word for word (`lib/omissions.ts`). The sheet layout follows the VS and UX Understand frames now. |
| P-01 | MATCHES | Italic Literata superscription and LORD in small capitals (`components/Verse.tsx:165,270-274`). |
| P-02 | SUPERSEDED | Understand v2 is replaced by VS-01 to VS-07 and UX-*. |

## IA pages

| Frame | Status | Differences | Sev |
|---|---|---|---|
| IA-11 | DIFFERS | The Search doors list "Guides → guide" and "Dictionary (Translation Words) → term"; neither is in Search. The ⋯ menu and the Settings items match. "Home is the only root" is replaced by IA v4. "Your plan" under the lead is replaced by BH-01. | medium |
| IA-12 | (reader report) | The Contents part ("title → Contents: books, chapters, Translation row") matches. The rest is the reader. | — |
| IA-13 | DIFFERS (low) | "Notification · download finished → Settings › Downloads" has no target (NT-08). The other doors are outside this area. | low |
| IA-15 | DIFFERS | See G4: no Search button beside the bar, pushed pages hide the bar, and the app does not open on the last tab. The tab labels and SF icons are present. | **high** |

---

## Ten most important differences

1. **G1:** every browse page title is Literata serif (`Page.tsx:31-51`, `type.ts:33`). The polish and all frames use SF bold with -0.8 tracking. This is the single most visible "doesn't look like the UI" cause.
2. **G2:** section titles are 13 pt grey `Label`s across Settings, Reminder, Sources, Downloads, Search, Contents, Translations and M'Cheyne. The polish and the frames use 22 pt bold ink (20 pt in sheets). An uncommitted edit is changing this now.
3. **IA-15 / G4:** there is no Search button beside the tab bar (`(tabs)/_layout.tsx`), so Search cannot be reached from Today, even though build-7-plan §0 put it in 7a.
4. **G4:** Settings, Bookmarks, Recent, Plans, Downloads, Reminder and Sources cover the tab bar (root Stack, `_layout.tsx:278-287`). The IA v4 note says pushed pages keep it. The app also opens on Today every time, not on the last tab, and the first launch does not open Bible.
5. **CT-01 to CT-03:** Contents ⋯ (Recent, Book order, Choose a verse) is not built. build-7 moved it to build 8, but build-8-plan dropped it. The frames also still draw the retired segment.
6. **Search:** no Dictionary or Guides groups (DI-03, PD-04, IA-06, IA-11) and nothing before typing (DI-04, VM-01).
7. **NP-03 / NT-09:** Bible-tab notices are 13 pt muted text with accent text links (`index.tsx:288-333`). The frames have a 17 pt claim line, grey and outline pills, and a hairline.
8. **DO-03 / NB-04:** Daily psalms is a pop-up menu, not its page. The Reminder page has a different structure: Time / switch / Sunday switch / What it says, where the frame has Morning / Evening / Sunday radio-tick rows. Its back chip says "Back", not "Settings".
9. **NT-02:** the reminder preview is a solid accent block, chartreuse in Dark (`ReminderPreview.tsx:17`). The frame has a sage-to-forest gradient with a translucent banner.
10. **ST-01 / MT-02 / ST-04:** Voice and Speed are menus without chevrons. iCloud is a switch that disappears when unavailable. Translations has an undrawn "Choose" in place of ‹ Back and opens as a second sheet rather than inside Contents. Sources' Explanations rows are not tappable and the page carries an extra subtitle.

(Also low but easy to fix: the splash overlay ground #0B0C0B vs the native and frame #0E1814, which causes a colour change at hand-over.)

## Every NOT BUILT frame

- **IC-02:** iCloud signed-out line. Omitted on purpose; the reason is only in the comment at `bookmarks.tsx:9-13`.
- **VM-01:** Search before typing, "For a moment". Build 10c, approved and not started.
- **DI-04:** browse the dictionary from Search's empty state.
- **DI-03 / PD-04:** Dictionary group in Search results.
- **IA-06:** Guides group in Search results.
- **PS-04:** Saved (build 7b).
- **MS-04:** UST as an on-phone translation (build-8-plan §6, open).
- Also not built but covered by a decision: **CT-01, CT-02, CT-03** (Contents ⋯; build-7-plan §0 moved it to build 8, but build-8-plan omits it) and **LD-01 to LD-05** (licensed Download, on hold).
- Not built inside frames otherwise counted as DIFFERS: the IA-15 Search tab button, the last-tab launch (DR-01, refs_i7), and the Daily psalms page (DO-03).
