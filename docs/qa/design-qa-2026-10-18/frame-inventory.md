# Frame inventory, 18 Oct 2026: every approved frame against the app

Read-only audit of the 374 frames in the canvas list (six pages) against `apps/mobile` on branch claude/loving-cori-d57938, working tree included (some files, such as `app/(tabs)/search.tsx` and `components/audio/TabsPlayer.tsx`, are not committed yet). A frame counts as built only where the screen, its words, its controls and what a tap does were found in code; comments naming a frame were not taken as evidence. Paths are relative to `apps/mobile/src` unless they start with `targets/`, `modules/` or `apps/`.

Eighteen frames have no HTML on the canvas export (OR-02 to OR-06, RT-06, VM-02 to VM-07, HO-01, LH-01 to LH-03, HM-01, HM-03); they were judged from their captions and the canvas notes. N/A means a decision or diagram frame, a proposal, or a frame a later frame or decision replaced (named in the row). Frames that were redrawn later but are built anyway are counted as built.

## Summary

All frames: 374. Built 244, partial 27, missing 66, not applicable 37.

| Prefix | Canvas page | Frames | Built | Partial | Missing | N/A |
|---|---|---|---|---|---|---|
| DR | Build 7 · a daily rhythm | 22 | 9 | 5 | 5 | 3 |
| IA | Build 7 · a daily rhythm | 3 | 3 | 0 | 0 | 0 |
| CT | Build 7 · a daily rhythm | 3 | 0 | 0 | 3 | 0 |
| EB | Build 7 · a daily rhythm | 4 | 1 | 1 | 2 | 0 |
| PS | Build 7 · a daily rhythm | 5 | 0 | 1 | 4 | 0 |
| PR | Build 7 · a daily rhythm | 12 | 9 | 2 | 1 | 0 |
| AW | Build 7 · a daily rhythm | 3 | 1 | 0 | 2 | 0 |
| TB | Build 7 · a daily rhythm | 3 | 0 | 0 | 3 | 0 |
| DU | Build 7 · a daily rhythm | 2 | 0 | 0 | 2 | 0 |
| XT | Build 7 · a daily rhythm | 5 | 3 | 2 | 0 | 0 |
| NB | Build 7 · a daily rhythm | 4 | 4 | 0 | 0 | 0 |
| DO | Build 7 · a daily rhythm | 5 | 5 | 0 | 0 | 0 |
| AS | Build 7 · a daily rhythm | 1 | 1 | 0 | 0 | 0 |
| PT | Build 7 · a daily rhythm | 1 | 0 | 0 | 0 | 1 |
| CI | Build 7 · a daily rhythm | 3 | 3 | 0 | 0 | 0 |
| SX | System surfaces | 23 | 20 | 3 | 0 | 0 |
| SC | Build 10 · scripture, crafted | 3 | 0 | 0 | 3 | 0 |
| OR | Build 10 · scripture, crafted | 6 | 0 | 0 | 6 | 0 |
| RT | Build 10 · scripture, crafted | 8 | 8 | 0 | 0 | 0 |
| VM | Build 10 · scripture, crafted | 7 | 0 | 0 | 4 | 3 |
| HO | Build 10 · scripture, crafted | 1 | 0 | 0 | 1 | 0 |
| LH | Build 10 · scripture, crafted | 3 | 0 | 0 | 3 | 0 |
| HM | Build 10 · scripture, crafted | 3 | 0 | 1 | 2 | 0 |
| BH | Build 10 · scripture, crafted | 1 | 1 | 0 | 0 | 0 |
| LB | Build 6 · listening | 11 | 11 | 0 | 0 | 0 |
| LD | Build 6 · listening | 5 | 0 | 0 | 5 | 0 |
| NP | Build 6 · listening | 3 | 2 | 0 | 0 | 1 |
| UL | Build 6 · listening | 4 | 4 | 0 | 0 | 0 |
| IG | Build 6 · listening | 5 | 4 | 0 | 0 | 1 |
| WM | Build 6 · listening | 7 | 7 | 0 | 0 | 0 |
| GD | Next release · new flows | 4 | 3 | 0 | 0 | 1 |
| BA | Next release · new flows | 8 | 8 | 0 | 0 | 0 |
| SW | Next release · new flows | 4 | 3 | 1 | 0 | 0 |
| WL | Next release · new flows | 4 | 4 | 0 | 0 | 0 |
| RP | Next release · new flows | 4 | 4 | 0 | 0 | 0 |
| PD | Next release · new flows | 6 | 2 | 2 | 2 | 0 |
| LT | Next release · new flows | 5 | 5 | 0 | 0 | 0 |
| MS | Next release · new flows | 5 | 3 | 0 | 2 | 0 |
| TY | Next release · new flows | 4 | 0 | 1 | 2 | 1 |
| GS | Next release · new flows | 3 | 0 | 0 | 3 | 0 |
| MC | Next release · new flows | 3 | 0 | 0 | 0 | 3 |
| UW | Next release · new flows | 2 | 2 | 0 | 0 | 0 |
| TH | Next release · new flows | 2 | 0 | 1 | 1 | 0 |
| TL | Next release · new flows | 2 | 0 | 0 | 2 | 0 |
| WA | Next release · new flows | 2 | 0 | 0 | 0 | 2 |
| HL | Next release · new flows | 2 | 0 | 0 | 2 | 0 |
| UX | Next release · new flows | 12 | 7 | 3 | 0 | 2 |
| CP | Next release · new flows | 9 | 9 | 0 | 0 | 0 |
| NT | Next release · new flows | 11 | 11 | 0 | 0 | 0 |
| NA | Next release · new flows | 8 | 7 | 0 | 1 | 0 |
| ST | Next release · new flows | 5 | 5 | 0 | 0 | 0 |
| IA | Next release · new flows | 4 | 0 | 0 | 0 | 4 |
| DI | Next release · new flows | 4 | 1 | 1 | 2 | 0 |
| EG | Next release · new flows | 7 | 6 | 0 | 0 | 1 |
| JR | Next release · new flows | 6 | 6 | 0 | 0 | 0 |
| DN | Next release · new flows | 6 | 4 | 1 | 1 | 0 |
| VS | Next release · new flows | 7 | 6 | 1 | 0 | 0 |
| US | Next release · new flows | 11 | 11 | 0 | 0 | 0 |
| MM | Next release · new flows | 12 | 12 | 0 | 0 | 0 |
| PG | Passage guide · audio · IA | 10 | 3 | 0 | 0 | 7 |
| AU | Passage guide · audio · IA | 7 | 6 | 0 | 0 | 1 |
| IA | Passage guide · audio · IA | 8 | 2 | 0 | 1 | 5 |
| ON | Passage guide · audio · IA | 7 | 6 | 0 | 1 | 0 |
| SN | Passage guide · audio · IA | 9 | 8 | 0 | 0 | 1 |
| TD | Passage guide · audio · IA | 3 | 3 | 0 | 0 | 0 |
| IC | Passage guide · audio · IA | 2 | 1 | 1 | 0 | 0 |
| **All** | | **374** | **244** | **27** | **66** | **37** |

By canvas page:

| Canvas page | Frames | Built | Partial | Missing | N/A |
|---|---|---|---|---|---|
| Build 7 · a daily rhythm | 76 | 39 | 11 | 22 | 4 |
| System surfaces | 23 | 20 | 3 | 0 | 0 |
| Build 10 · scripture, crafted | 32 | 9 | 1 | 19 | 3 |
| Build 6 · listening | 35 | 28 | 0 | 5 | 2 |
| Next release · new flows | 162 | 119 | 11 | 18 | 14 |
| Passage guide · audio · IA | 46 | 29 | 1 | 2 | 14 |

## The most visible gaps

Ranked by how often a reader would meet them.

1. **DR-16, DR-17, DR-14 (missing).** Tapping the day's picture or verse on Today opens the reader at that verse (`app/(tabs)/today.tsx:33, 81`). There is no full-screen verse with Read, Listen and Share, no ⋯ on it, and no About this picture.
2. **DR-11, DR-12, PR-01 (partial).** Today's psalms card has Read but no Listen. The Pray card is a fixed line with no count and none of your requests. The Later and Earlier rows leave out Spurgeon. After 17:00 the picture disappears and the page goes plain (`today.tsx:72`).
3. **PS-01, PS-02, PS-03 (missing).** A selected verse has no highlight colours, no Note and no Copy row. The reader shows no highlights or note marks, and notes don't exist anywhere.
4. **PS-05, DR-18, HM-02 (missing or partial).** The app can't make a share image of any verse. The verse ⋯ holds only Copy, Share and Bookmark, so Share as an image and Learn this verse aren't there.
5. **PS-04 (partial).** The bookmark in Bible's header opens Bookmarks. There is no Saved page with highlights, notes, images and Your reading.
6. **ON-04 (missing).** A passage guide ends on Sources. There is no Next passage row, so moving on means closing the guide and scrolling.
7. **VM-01, DI-03, DI-04, IA-06, PD-04 (missing).** The Search tab is a blank field until you type: no moments to start from and no dictionary to browse. Results never include a Dictionary or Guides group.
8. **CT-01, CT-02, CT-03 (missing).** Contents has no ⋯. There is no Recent, no A to Z order and no verse grid, and a chapter always opens at verse 1.
9. **SC-01, SC-05, SC-06, OR-01 to OR-06 (missing).** Chapter 1 still shows the book's paragraph inline above the text, IG-01's older design. There is no About John handle or sheet, no shape of the book, no places or people, and no pause between books.
10. **DR-07 (partial).** The Today widget shows one psalm by day of the year. It ignores Settings › Daily psalms and never switches from the morning's psalms to the evening's.
11. **EB-03 (missing).** The day's verse on the picture isn't clamped. A long verse such as Esther 8:9 runs down the 520 pt picture, and there's no full view to read it in.
12. **PR-07, XT-01, XT-03, PR-08 (partial or missing).** The Pray page shows no "Added" or "Answered" dates and no "Only you see your list." Pray for someone isn't a card, and there is no Prayers of the Bible. The Pray card shows on day one. "That's everyone for now." has no Ask for prayer or Back to Pray buttons.
13. **DR-04, DR-08 (partial).** Daily psalms is a bare menu whose choices don't say what they are. While listening, Stop playing can't stop at the end of the evening's psalms.
14. **PD-05, PD-06 (missing or partial).** In the BSB reader, John 5:4 and other omitted verses simply vanish, with no "Not in the oldest manuscripts" line to tap.
15. **TB, DU, AW-01, AW-03 (missing).** There is no iPad layout (`supportsTablet: false`), no foldable layout and no watch app. Only the free mirroring of the reminder and the Live Activity reaches the watch.

## Missing

Grouped by area. What the user sees today is in each line.

### Today (7)

- **DR-14** (About this picture (⋯ on the day’s verse, or a long press): what it is, who made it, the verse, its licence). No About this picture. There is no ⋯ on the day's verse and a long press does nothing; title, photographer, source and licence of the picture appear nowhere (only an accessibility label, app/(tabs)/today.tsx:294).
- **DR-16** (Tap the picture: the day’s verse fills the screen; Read, Listen, Share; no counts). Tapping the picture or the day's verse calls open(verse.place) (app/(tabs)/today.tsx:33, 81), which pushes the reader at that verse (John 19:34, Psalm 1:3…). There is no full-screen verse with Read, Listen and Share.
- **DR-17** (⋯ on the day’s verse: read the psalm, compare, share, earlier days, about the picture). No ⋯ on the day's verse, so no Read the psalm / Compare / Share as an image / Earlier days / About this picture.
- **DR-18** (Share as an image: the verse on the day’s picture, the text and picture credited). No Share as an image anywhere in the app; Share sends plain text only (app/read/[book]/[chapter].tsx:658-659).
- **DR-19** (Earlier days: this month’s pictures and verses, newest first; the psalter repeats each month). No Earlier days page; nothing lists past days' pictures and verses.
- **EB-02** (Our Daily Bread offline: the card says so in one line; Spurgeon is not swapped in silently). There is no Our Daily Bread option; Today only ever shows Spurgeon (app/(tabs)/today.tsx:186-205), so its offline line cannot exist.
- **EB-03** (A long verse (Esther 8:9, the Bible’s longest, as the test): four lines and ‘…’ on Today; whole in the full v). The day's verse is not clamped to four lines (no numberOfLines, app/(tabs)/today.tsx:87-89), so a long verse runs over the 520 pt picture; and there is no full view to show it whole.

### Bible and the reader (15)

- **SC-01** (Opening John directly: the first passage and its verses, nothing above them; an “About John” handle waits abo). No "About John" handle above the home indicator. Chapter 1 opens with the book's paragraph inline above the first passage (components/BookIntro.tsx:17-34; IG-01's design).
- **SC-05** (Drag the handle up: the paragraph in a sheet over the reading, with a one-line source; Back to reading closes). No sheet that the handle drags up; the paragraph is inline text.
- **SC-06** (Arriving from Matthew: one pause for the next book, its paragraph and Start Mark 1; opening Mark directly ski). No pause between books with the next book's paragraph and "Start Mark 1"; Matthew 28's end goes to the End page (RT-04) and then Mark 1.
- **OR-01** (About John, pulled up: the paragraph, then the shape of the book: its sections in order, no dates). No About John sheet, so no "The shape" list of sections.
- **OR-02** (Scrolled: where, the book’s places on a map drawn on the phone, high confidence only). No book map of places in an About sheet.
- **OR-03** (The end: who, the seven Tyndale profiles in John; then one card for the BibleProject overview with its length). No "who" profiles list or BibleProject card.
- **OR-04** (All the places, pushed inside the sheet: in the order they first appear, with the verse; each opens its map). No "All the places" page in book order.
- **LH-01** (Learn a verse by heart, step 1 of 3: read it, hear it; nothing is hidden yet). No Learn a verse by heart (no HTML on the canvas; checked by caption).
- **LH-02** (Step 2 of 3: some words fade; tap a gap to see the word (shown on the last one); no penalty). Same: no fading-words step.
- **LH-03** (Step 3 of 3: most words gone, equal-width gaps; Again goes back, Done ends it; no score, no streak, no badge). Same: no step 3.
- **OR-05** (A book with no places or profiles in the data (1 John): those sections simply do not appear; no empty heading). Edge case of the About sheet, which does not exist.
- **OR-06** (The video card with no connection: the same card, quieter, saying why; it never shows an error and never down). Edge case of the About sheet's video card, which does not exist.
- **PD-05** (John 5: verse 4 keeps its place as one line). A verse the BSB omits (John 5:4) has no line in the reader; the chapter goes from 3 to 5 with no "Not in the oldest manuscripts".
- **MS-05** (Reading John 1 in the UST). The UST cannot be read as a translation.
- **TY-04** (About the Gospel of John: purpose, author, date, setting). No Purpose / Author / Date / Setting page for a book.

### Understand, the guide and Compare (15)

- **HO-01** (The small-group handout: Yada’s wordmark, the passage in the BSB, one plain line, and where readers differ, e). No small-group handout (no HTML on the canvas; checked by caption).
- **HM-01** (The passage guide’s ⋯: Share handout, which opens HM-03; only for passages John has approved). The passage guide has no ⋯ and no Share handout (components/PassageGuide.tsx:93-114).
- **HM-03** (Share handout opens on the page itself, as a PDF (after Satispay’s Export and inDrive’s receipt): Share is th). No handout PDF page.
- **TY-01** (John 1:42: Peter’s profile now shows in John, not only in Matthew). Profiles are matched by name in the book's own Tyndale bundle only (data/study.ts:55-64), so John 1:42 shows no Simon Peter from Matthew's.
- **GS-01** (Where we are: who speaks, in Glyssen’s own names). No "Speaking" line from Glyssen in the guide (Glyssen is only credited in lib/sources.ts:73).
- **GS-02** (John 3: Jesus speaks to 3:13; 3:14–21 is not marked, so 3:16 is never ‘Jesus says’). No unmarked-speaker line ("In 3:14–21 the text doesn't say who is speaking").
- **GS-03** (Many speakers: four, then ‘and 5 more’; open shows all, as written). No "and 2 more" speaker list.
- **TH-02** (A theme opens the passages that develop it, pushed). A theme opens nothing.
- **TL-01** (Where we are gains one line placing the passage in time). No "In time" line.
- **TL-02** (The order of events: sequence first, a date only where John reviewed it). No order of events page.
- **HL-01** (Deuteronomy 6:4: the large letters shown as written). Large letters are not drawn in Original Hebrew (no large/small/suspended handling anywhere).
- **HL-02** (Judges 18:30: a raised letter, said in one plain line). No raised-letter line for Judges 18:30.
- **NA-02** (14:34 once John’s note is approved: the note first, then ‘One way to read it’ with ‘Paul tells them’). There is no slot for John's own approved note ("Written by John · reviewed"); nothing in the app reads or shows one.
- **DN-01** (A term this book never uses: ‘Elsewhere in the Bible’ with the count, never ‘In 1 Corinthians · 0’). A term this book never uses shows no uses section at all (components/UnderstandPages.tsx:103-116); there is no "Elsewhere in the Bible · N".
- **ON-04** (End of the guide: the next passage is one tap). The guide does not end on the next passage. Its last row is Sources (components/PassageGuide.tsx:206-213); the reader's follow hook (state/guide.ts setFollow) is never called by the guide, so "Next · 1:19–34" is one close and a scroll away.

### Search and Contents (11)

- **CT-01** (Contents › ⋯: Recent, Book order and Choose a verse, each showing its setting). Contents has no ⋯: only the Translation row and the books (app/contents/index.tsx:29-73). No Recent, Book order or Choose a verse.
- **CT-02** (Book order › A to Z: one list, no Testament headings; a number sorts by the name (1 John under J)). No A to Z book order; Contents is always Old then New Testament.
- **CT-03** (Choose a verse on: John › 3 shows its 36 verses; 16 opens the reader at 3:16). No verse grid. Picking a chapter opens the reader at verse 1 (app/contents/[book].tsx).
- **VM-01** (Search, before you type: six moments to start from, each with the opening words of its first verse; no rankin). Search before you type is an empty field (app/search.tsx:137-357 shows nothing until a query); no "For a moment" list of six moments.
- **VM-02** (Anxious, one verse at a time (after Once and Noom): swipe for the next, one button to open it; the Samaritans). No Anxious verse pages or Samaritans line (no HTML on the canvas; checked by caption).
- **VM-03** (Lonely, the second of five: a short verse sits large and alone; Samaritans beneath; Matthew 28:20 is flagged). No Lonely verse page.
- **VM-04** (Tired: no support row, because the moment does not call for one; a passage shows its opening and opens whole). No Tired verse page.
- **PD-04** (Search: a term finds its dictionary entry first). Search has no Dictionary group: its groups are Go to, People, Words, Verses (app/search.tsx:198-348).
- **DI-03** (Search: a term finds its dictionary entry before the verses). Search has no Dictionary group before the verses (app/search.tsx:198-348).
- **DI-04** (Browse the dictionary: from Search’s empty state, grouped, no tab). No dictionary browse from Search's empty state (the empty state is blank).
- **IA-06** (Search: a passage title finds its guide). Search has no Guides group; a passage title such as "The Word became flesh" finds only verses (app/search.tsx:198-348).

### Pray (1)

- **PR-08** (Prayers of the Bible: a thread of prayers in Scripture, BSB text; the list ships only once John approves it (). No Prayers of the Bible (the frame says it ships only after John approves the list, rule 2).

### Settings and your space (10)

- **PS-01** (Select a verse: highlight in one of four colours, Note and Copy, under Understand and Compare). A selected verse gives Play from, Understand, Compare and ⋯ (components/ActionBar.tsx:190-207). No second row with four highlight colours, Note and Copy; Copy is inside ⋯ (lib/reader.ts:137-140).
- **PS-02** (In the reader: highlights as a soft wash, a small mark where you left a note). No highlights or note marks in the reader (components/Verse.tsx has neither).
- **PS-03** (A note on the verse, or on the whole chapter; private, kept in iCloud). No notes on a verse or chapter anywhere.
- **PS-05** (An image for any verse: ⋯ › Share as an image; the day’s pictures or plain, then Save or Share). No Share as an image for any verse; the reader's ⋯ is Copy, Share, Bookmark.
- **LD-01** (Reading the NKJV: Download John sits under the version, as a free translation’s download does). No "Download John" for the NKJV (canvas: on hold until John decides, 15 Oct 2026).
- **LD-02** (Downloading: chapters counted, one at a time; the ring stops it). No licensed download progress (on hold).
- **LD-03** (Downloaded: ⋯ holds Remove; after 30 days without a refresh it is Download John again). No downloaded licensed book with ⋯ Remove (on hold).
- **LD-04** (Can’t download now: the day’s limit, or no connection; the row stays, the button goes). No "Can't download now" state (on hold).
- **LD-05** (Downloads lists the book under Translations, removed like the others). Downloads has no licensed books (on hold).
- **MS-04** (The UST joins as a plain-English translation, said in one line). No UST row in Translations ("Plain English").

### System surfaces, widgets, watch, iPad and foldable (7)

- **AW-01** (Apple Watch: the day at a glance; a Smart Stack widget and complications; no streak, BSB only). No Apple Watch target (apps/mobile/targets holds widget and notification only). The canvas moved it to build 8 with a watch app.
- **AW-03** (Sit with this on the wrist (build 8 candidate): Settle with a tap on each breath, Breathe the verse, Silence). No watch app, so no Sit with this on the wrist.
- **TB-01** (iPad: Today in two columns, the picture and the day’s cards; the tab bar becomes a sidebar). iPad is off: supportsTablet false (apps/mobile/app.config.ts:84). No two-column Today, no sidebar.
- **TB-02** (iPad: the reader keeps the text in a measure and puts Understand beside it, not over it). No iPad reader with Understand beside the text.
- **TB-03** (iPad: the Bible tab, with iPadOS’s tab bar at the top in portrait). No iPad Bible tab with the top tab bar.
- **DU-01** (iPhone Duo: closed, the cover is the iPhone layout; opened, Today becomes two columns, nothing moves). No regular-width layout, so nothing changes on a foldable's open screen.
- **DU-02** (iPhone Duo open: text on the left page, Understand on the right; nothing crosses the fold). No two-page reader with Understand on the right.

## Partial

Grouped by area; each line says exactly what differs.

### Today (4)

- **DR-11** (Today: the picture shows a line from this morning’s psalms; one lead, Read or Listen; the rest waits below). The psalms card has Read only, no Listen (app/(tabs)/today.tsx:137-147). The Pray card shows a fixed line, no count and none of your list (245-252). The Later row says "This evening · Psalms 6–8" without "and Spurgeon for the evening" (254-265). The picture carries the whole verse, not a short line. An extra "Done" button sits beside Sit with this (107-119, from RT-07).
- **DR-12** (Today after 5 pm: the evening psalms lead; the morning folds to one line under Earlier, unmarked). After 17:00 the picture is dropped and the page goes plain, because evening hides it (app/(tabs)/today.tsx:72). The frame keeps the picture with the evening verse. No Listen; the Earlier row lacks "· Spurgeon".
- **EB-01** (Daily psalms off and no plan: the lead asks for a plan; nothing empty, nothing nagging). With Daily psalms off and no plan, Today shows "A place to start · The Gospel of John" (app/(tabs)/today.tsx:207-218) instead of "Your plan · Choose a plan" with Reading plans.
- **XT-01** (First day: no streak yet, ‘A place to start’ instead of Your plan, and no Pray card until it is wanted). No lamp before a day counts (app/(tabs)/today.tsx:271) and "A place to start" (207-218) are built, but the Pray card always shows (245-252) instead of waiting until the second day or a first list item.

### Bible and the reader (2)

- **HM-02** (A selected verse’s ⋯: Share as an image, Share, Bookmark, and Learn this verse). A selected verse's ⋯ holds Copy, Share, Bookmark (lib/reader.ts:137-140); no Share as an image, no Learn this verse.
- **SW-04** (When swiping is off, and the other ways to turn the page). Swipe is off with a selection and under VoiceOver (app/read/[book]/[chapter].tsx:748), but there are no VoiceOver actions "Next chapter, John 2" / "Previous chapter"; only the footer links.

### Understand, the guide and Compare (10)

- **PD-01** (John 11:1: people and places in one line, in the verse’s order). People show as Tyndale profile rows (components/StudyLayer.tsx:314), only in the full view or when no entry (components/UnderstandViews.tsx:440-444, 644-648). No one-line "Lazarus · Bethany · Mary · Martha" at the top of the half view, and places are not in it.
- **PD-06** (The note: plain words, the verse the KJV has, no sigla). Understand on an omitted verse shows the manuscripts fact and the UST line (components/UnderstandViews.tsx:202-234), not the KJV's verse; and from the BSB reader the verse cannot be tapped (PD-05).
- **TY-02** (Simon Peter: the passages in this book come first). The profile lists its passages (components/StudyLayer.tsx:348-400) but not this book first with the rest behind "Elsewhere".
- **TH-01** (Themes in this passage: a short list near the end of the guide). Themes are one "Themes: a · b" line inside In short (lib/passageGuide.ts:67), not a list of rows near the end of the guide.
- **UX-03** (No explanation for this verse: who’s here, the passage, a study note). A verse with no entry shows People, study notes, See also and Go deeper (components/UnderstandViews.tsx:613-655), but not "In this passage" with the guide's line and a link to the guide.
- **UX-08** (A book with no guides (Mark 1:1–4): verse by verse, a study note each). A book with no guides shows Tyndale's note on the passage (components/PassageGuide.tsx:54-87), not verse by verse with a study note each.
- **UX-11** (Reading the KJV: the same Understand; BSB-bound lines say ‘in the BSB’ or step aside). Understand shows the same facts on the KJV, but nothing rewords BSB-bound lines as "In the BSB, …" or "Compare · your KJV against the others"; the facts appear exactly as stored.
- **DI-02** (A term’s page, pushed inside the sheet: definition, where this book uses it, related terms). The term page has the definition and where this book uses it (components/UnderstandPages.tsx:80-122) but no related terms.
- **DN-06** (Depth: each ‹ names where it goes back to (‹ 14:34), so three pushes never feel lost). ‹ inside a sheet is a round glyph; where it goes back to is only in its VoiceOver label (components/Sheet.tsx useBackName), not shown as "‹ 14:34".
- **VS-06** (Isaiah 7:14, full view: both readings in full, Compare with JPS 1917, Go deeper). No "Compare with JPS 1917": the JPS is kept out of the app (lib/sources.ts:125-126), so Compare offers BSB, WEB, KJV, LSV only.

### Pray (3)

- **PR-01** (Today: ‘Sit with this’ on the day’s verse; Pray is one card after the reading). Sit with this on the day's verse (app/(tabs)/today.tsx:96-106) and one Pray card (245-252) are built, but the card shows "Your list, and someone to pray for" with no count and none of your requests.
- **PR-07** (Pray: your private list, then Pray for someone as the one card, asking and your requests, prayers of the Bibl). app/pray/index.tsx:61-88. List rows have no "Added 2 Oct" or "Answered 12 Oct" line; no "Only you see your list."; Add is a row and an Alert prompt, not a + in the header; Pray for someone is a plain row ("Hold to pray for a request"), not the one card ("One request at a time"); Ask for prayer lacks "Others pray for it; only you see how many"; no Prayers of the Bible row.
- **XT-03** (Pray for someone with no requests left: say so plainly; never repeat a request you prayed for). "That's everyone for now." and its line are there (app/pray/someone.tsx:95-101), but the Ask for prayer and Back to Pray buttons are not; only × leaves.

### Audio (2)

- **DR-08** (Listening at night: the evening’s psalms play through and stop after the last). Stop playing offers end of passage, end of chapter and times only (lib/audio/voice.ts:66-84). There is no "End of this evening's psalms · After Psalm 8" or "End of this psalm" row, the player is not titled "Evening · Psalms 6–8", and the set does not play through as one.
- **SX-23** (At the stop: audio paused at 1:18, Play goes on from 1:19; the phone ends the activity later). At a stop the app ends the Live Activity at once (data/system.ts:154-158), so the paused "Stopped after 1:18" activity with Play from 1:19 never shows.

### Settings and your space (3)

- **DR-04** (Settings › Daily psalms: three choices, each saying what it is). Daily psalms is a native menu on a Settings row (app/settings.tsx:150-164), not a page. The choices have no line saying what each is ("All 150 in a month, as the 1662 Prayer Book divides them", "Psalm 1 to 150, then again", "No psalms on Today or in the widget"), and the first is titled "1662 Prayer Book", not "Morning and evening" (lib/dailyPsalms.ts:163-169).
- **PS-04** (Saved, from the bookmark in Bible’s header: highlights, notes, bookmarks and images; your reading on top). Bible's header bookmark opens Bookmarks (app/(tabs)/index.tsx:192, app/bookmarks.tsx): bookmarks only. No "Saved" page, no Highlights/Notes/Images, no Your reading on top, no export.
- **IC-02** (Not signed in to iCloud: on this iPhone only, and how to change it). Signed out, Bookmarks shows the same line ("…kept in iCloud when you're signed in", app/bookmarks.tsx:127), not "On this iPhone only. Sign in to iCloud in Settings to keep them."

### System surfaces, widgets, watch, iPad and foldable (3)

- **DR-07** (The widget follows the day: this morning’s psalms, then this evening’s). The "A passage for today" widget always shows one psalm by day of the year (data/system.ts:86-96, targets/widget/Widgets.swift:335-439). It does not follow Settings › Daily psalms, never shows "This morning · Psalms 1–5" and does not switch to the evening set at 17:00.
- **SX-12** (Spotlight: Psalm 23 as the top hit, its first verse, Read and Listen beside it). Psalm 23 is indexed (modules/yada-system/ios/YadaSystemModule.swift:129, 180-190), but as a plain CSSearchableItem, so Spotlight shows no Read and Listen beside the hit.
- **SX-16** (Scheduled Summary: today’s psalm leads it, as its verse, not as a nudge). The reminder is scheduled with relevanceScore 0 (YadaSystemModule.swift:162), so a Scheduled Summary is not led by today's psalm as drawn; the code cites a later "decision 5".

## Every frame

### Build 7 · a daily rhythm

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| DR-01 | Two tabs: Bible keeps your place, Today holds the day; Yada opens on the last one used | BUILT | Two tabs, Today and Bible, and Yada reopens on the last tab used: app/(tabs)/_layout.tsx:21-56 (last tab 25-28). |
| DR-02 | Reading this morning’s psalms: at the end of each, the next one leads | BUILT | "Next this morning · Psalm 2" at the foot of each of the day's psalms: app/read/[book]/[chapter].tsx:316-338, 891-900. |
| DR-03 | The morning’s last psalm: no ‘done’, no confetti; the evening’s psalms are named | BUILT | After the morning's last psalm the evening set is named, no "done": app/read/[book]/[chapter].tsx:331-333. |
| DR-04 | Settings › Daily psalms: three choices, each saying what it is | PARTIAL | Daily psalms is a native menu on a Settings row (app/settings.tsx:150-164), not a page. The choices have no line saying what each is ("All 150 in a month, as the 1662 Prayer Book divides them", "Psalm 1 to 150, then again", "No psalms on Today or in the widget"), and the first is titled "1662 Prayer Book", not "Morning and evening" (lib/dailyPsalms.ts:163-169). |
| DR-05 | Decision for John · the reminder, morning and evening: a second time (NT allows one a day) | N/A | Decision frame. What was chosen is built: an evening time for the psalms, offered only under the 1662 table (app/reminder.tsx:107-136). |
| DR-06 | The evening reminder: the psalms and their first words, nothing about yesterday | BUILT | Evening reminder "This evening · Psalms 6–8" over the first words: data/reminder.ts:168. |
| DR-07 | The widget follows the day: this morning’s psalms, then this evening’s | PARTIAL | The "A passage for today" widget always shows one psalm by day of the year (data/system.ts:86-96, targets/widget/Widgets.swift:335-439). It does not follow Settings › Daily psalms, never shows "This morning · Psalms 1–5" and does not switch to the evening set at 17:00. |
| DR-08 | Listening at night: the evening’s psalms play through and stop after the last | PARTIAL | Stop playing offers end of passage, end of chapter and times only (lib/audio/voice.ts:66-84). There is no "End of this evening's psalms · After Psalm 8" or "End of this psalm" row, the player is not titled "Evening · Psalms 6–8", and the set does not play through as one. |
| DR-09 | Back after three weeks: where you stopped, and today’s psalms are today’s; nothing to catch up | BUILT | Bible's lead says "Where you stopped" after a gap (app/(tabs)/index.tsx:255); Today's psalms come from today's date (data/today.ts). |
| DR-10 | Decision for John · ‘Days you read’: a private month with dots; it breaks the no-tallies rule, so not recomme | N/A | Decision frame, not recommended; not built. |
| DR-11 | Today: the picture shows a line from this morning’s psalms; one lead, Read or Listen; the rest waits below | PARTIAL | The psalms card has Read only, no Listen (app/(tabs)/today.tsx:137-147). The Pray card shows a fixed line, no count and none of your list (245-252). The Later row says "This evening · Psalms 6–8" without "and Spurgeon for the evening" (254-265). The picture carries the whole verse, not a short line. An extra "Done" button sits beside Sit with this (107-119, from RT-07). |
| DR-12 | Today after 5 pm: the evening psalms lead; the morning folds to one line under Earlier, unmarked | PARTIAL | After 17:00 the picture is dropped and the page goes plain, because evening hides it (app/(tabs)/today.tsx:72). The frame keeps the picture with the evening verse. No Listen; the Earlier row lacks "· Spurgeon". |
| DR-13 | Spurgeon for the morning: the date’s entry, whole and unchanged, credited once at the end | BUILT | Spurgeon's entry whole, the other half of the day, credit once at the end: app/devotional.tsx:22-90. |
| DR-14 | About this picture (⋯ on the day’s verse, or a long press): what it is, who made it, the verse, its licence | MISSING | No About this picture. There is no ⋯ on the day's verse and a long press does nothing; title, photographer, source and licence of the picture appear nowhere (only an accessibility label, app/(tabs)/today.tsx:294). |
| DR-15 | No photo yet (first day, or offline before it downloaded): the page without it; no skeleton, no grey box | BUILT | With no picture the page is plain type, no placeholder: app/(tabs)/today.tsx:322-345 (the day's verse sits as a card after the others). |
| IA-15 | IA v4 · Three doors at the bottom: Today, Bible, and Search on its own | BUILT | Today, Bible, and Search as the round search-role button: app/(tabs)/_layout.tsx:42-53, app/(tabs)/search.tsx (search.tsx is an uncommitted file in the working tree). |
| IA-16 | IA v4 · The reader covers the tabs; its return chip names the tab it came from | BUILT | The reader is a root route over the tabs; its chip names "Today" (app/(tabs)/today.tsx:33) or "Bible" (components/ReaderHeader.tsx:45, 92). |
| IA-17 | IA v4 · Listening: the mini player rides above the bar on every tab | BUILT | Mini player in the tab bar's accessory while listening: app/(tabs)/_layout.tsx:35-39, components/audio/TabsPlayer.tsx:22 (TabsPlayer.tsx is uncommitted). |
| DR-16 | Tap the picture: the day’s verse fills the screen; Read, Listen, Share; no counts | MISSING | Tapping the picture or the day's verse calls open(verse.place) (app/(tabs)/today.tsx:33, 81), which pushes the reader at that verse (John 19:34, Psalm 1:3…). There is no full-screen verse with Read, Listen and Share. |
| DR-17 | ⋯ on the day’s verse: read the psalm, compare, share, earlier days, about the picture | MISSING | No ⋯ on the day's verse, so no Read the psalm / Compare / Share as an image / Earlier days / About this picture. |
| DR-18 | Share as an image: the verse on the day’s picture, the text and picture credited | MISSING | No Share as an image anywhere in the app; Share sends plain text only (app/read/[book]/[chapter].tsx:658-659). |
| DR-19 | Earlier days: this month’s pictures and verses, newest first; the psalter repeats each month | MISSING | No Earlier days page; nothing lists past days' pictures and verses. |
| DR-20 | Decision for John · ‘Your reading’: days that only count up, and books filling in; never ‘in a row’, never lo | N/A | Decision frame. The "days this year" count went into RT-02's sheet; "Books you have opened" with chapters filling in is not built. |
| DR-21 | The streak, defined: a lamp and a number; read or listen counts; a day of rest each week never breaks it | BUILT | Lamp and number at the top of Today, opening Your rhythm: app/(tabs)/today.tsx:270-285; app/rhythm.tsx (sheet redrawn as RT-02). |
| DR-22 | When it stops: it starts again at 1 the next day you read; no ‘lost’, no best, nothing to restore | BUILT | The run restarts at 1 with nothing to restore (lib/rhythm.ts); the sheet follows RT-02, which has no "Started again today" line. |
| CT-01 | Contents › ⋯: Recent, Book order and Choose a verse, each showing its setting | MISSING | Contents has no ⋯: only the Translation row and the books (app/contents/index.tsx:29-73). No Recent, Book order or Choose a verse. |
| CT-02 | Book order › A to Z: one list, no Testament headings; a number sorts by the name (1 John under J) | MISSING | No A to Z book order; Contents is always Old then New Testament. |
| CT-03 | Choose a verse on: John › 3 shows its 36 verses; 16 opens the reader at 3:16 | MISSING | No verse grid. Picking a chapter opens the reader at verse 1 (app/contents/[book].tsx). |
| EB-01 | Daily psalms off and no plan: the lead asks for a plan; nothing empty, nothing nagging | PARTIAL | With Daily psalms off and no plan, Today shows "A place to start · The Gospel of John" (app/(tabs)/today.tsx:207-218) instead of "Your plan · Choose a plan" with Reading plans. |
| EB-02 | Our Daily Bread offline: the card says so in one line; Spurgeon is not swapped in silently | MISSING | There is no Our Daily Bread option; Today only ever shows Spurgeon (app/(tabs)/today.tsx:186-205), so its offline line cannot exist. |
| EB-03 | A long verse (Esther 8:9, the Bible’s longest, as the test): four lines and ‘…’ on Today; whole in the full v | MISSING | The day's verse is not clamped to four lines (no numberOfLines, app/(tabs)/today.tsx:87-89), so a long verse runs over the 520 pt picture; and there is no full view to show it whole. |
| EB-04 | Reduce Transparency: the fade under the verse becomes a solid band, so the text keeps its contrast | BUILT | Reduce Transparency swaps the fade for a near-solid band: app/(tabs)/today.tsx:298-301, 351. |
| PS-01 | Select a verse: highlight in one of four colours, Note and Copy, under Understand and Compare | MISSING | A selected verse gives Play from, Understand, Compare and ⋯ (components/ActionBar.tsx:190-207). No second row with four highlight colours, Note and Copy; Copy is inside ⋯ (lib/reader.ts:137-140). |
| PS-02 | In the reader: highlights as a soft wash, a small mark where you left a note | MISSING | No highlights or note marks in the reader (components/Verse.tsx has neither). |
| PS-03 | A note on the verse, or on the whole chapter; private, kept in iCloud | MISSING | No notes on a verse or chapter anywhere. |
| PS-04 | Saved, from the bookmark in Bible’s header: highlights, notes, bookmarks and images; your reading on top | PARTIAL | Bible's header bookmark opens Bookmarks (app/(tabs)/index.tsx:192, app/bookmarks.tsx): bookmarks only. No "Saved" page, no Highlights/Notes/Images, no Your reading on top, no export. |
| PS-05 | An image for any verse: ⋯ › Share as an image; the day’s pictures or plain, then Save or Share | MISSING | No Share as an image for any verse; the reader's ⋯ is Copy, Share, Bookmark. |
| PR-01 | Today: ‘Sit with this’ on the day’s verse; Pray is one card after the reading | PARTIAL | Sit with this on the day's verse (app/(tabs)/today.tsx:96-106) and one Pray card (245-252) are built, but the card shows "Your list, and someone to pray for" with no count and none of your requests. |
| PR-02 | Sit with this: four steps, in order with Begin, or any one on its own | BUILT | Four numbered steps and Begin · about N min: app/sit.tsx:103-151. |
| PR-03 | Settle: a soft shape grows on the in-breath and shrinks on the out, a haptic on each; Reduce Motion keeps onl | BUILT | Settle: the shape grows and shrinks, haptic each breath, words only under Reduce Motion: app/sit.tsx:182-227. |
| PR-04 | Breathe the verse: split only where the verse’s own words break (Psalm 46:10); no clean split, no step | BUILT | Breathe the verse split on the verse's own break, step dropped when none: app/sit.tsx:59-60, 230-245. |
| PR-05 | Sit with it: read slowly, twice, silence between; on the NKJV the BSB shows, so the words seen are the words | BUILT | Read slowly twice with silence between, BSB shown and "Read aloud in the BSB": app/sit.tsx:251-324. |
| PR-06 | Silence: 3, 5, 10 or 20 min, the timer shared with Stop playing; then only the verse, and a haptic at the end | BUILT | 3/5/10/20 min, then the verse alone and a haptic: app/sit.tsx:327-392 (its own timer, not Stop playing's). |
| PR-07 | Pray: your private list, then Pray for someone as the one card, asking and your requests, prayers of the Bibl | PARTIAL | app/pray/index.tsx:61-88. List rows have no "Added 2 Oct" or "Answered 12 Oct" line; no "Only you see your list."; Add is a row and an Alert prompt, not a + in the header; Pray for someone is a plain row ("Hold to pray for a request"), not the one card ("One request at a time"); Ask for prayer lacks "Others pray for it; only you see how many"; no Prayers of the Bible row. |
| PR-08 | Prayers of the Bible: a thread of prayers in Scripture, BSB text; the list ships only once John approves it ( | MISSING | No Prayers of the Bible (the frame says it ships only after John approves the list, rule 2). |
| PR-09 | Pray for someone: the request alone; a pill at the foot fills while you hold (about 20 s), or use a timer | BUILT | The request alone, hold pill that fills (~20 s) or a timer, then Prayed and Next request: app/pray/someone.tsx:21-160. |
| PR-10 | Ask for prayer: a sheet over Pray; just the words; Post on a bar above the keyboard; first name optional | BUILT | Sheet over Pray, words and optional first name, Post on a bar above the keyboard: app/pray/ask.tsx:24-171; app/_layout.tsx:293. |
| PR-11 | Your requests: how many prayed (only you see it); ⋯ for Mark answered, Renew, Delete; Answered keeps its date | BUILT | Live and Answered, how many prayed, ⋯ Mark answered / Renew / Delete: app/pray/mine.tsx:18-80. |
| PR-12 | Safety: a request that mentions self-harm shows the phone region’s helpline before it posts, and more from Fi | BUILT | Helpline by the phone's region before posting: app/pray/ask.tsx:79-103; lib/pray.ts:48. |
| AW-01 | Apple Watch: the day at a glance; a Smart Stack widget and complications; no streak, BSB only | MISSING | No Apple Watch target (apps/mobile/targets holds widget and notification only). The canvas moved it to build 8 with a watch app. |
| AW-02 | Mirrored from the iPhone for free: the evening reminder with Listen, and the listening Live Activity in the S | BUILT | Comes free from iOS: the reminder's Listen action (data/reminder.ts:195) and the Live Activity (targets/widget/Widgets.swift:727-770) mirror to the watch. Not checked on a watch. |
| AW-03 | Sit with this on the wrist (build 8 candidate): Settle with a tap on each breath, Breathe the verse, Silence | MISSING | No watch app, so no Sit with this on the wrist. |
| TB-01 | iPad: Today in two columns, the picture and the day’s cards; the tab bar becomes a sidebar | MISSING | iPad is off: supportsTablet false (apps/mobile/app.config.ts:84). No two-column Today, no sidebar. |
| TB-02 | iPad: the reader keeps the text in a measure and puts Understand beside it, not over it | MISSING | No iPad reader with Understand beside the text. |
| TB-03 | iPad: the Bible tab, with iPadOS’s tab bar at the top in portrait | MISSING | No iPad Bible tab with the top tab bar. |
| DU-01 | iPhone Duo: closed, the cover is the iPhone layout; opened, Today becomes two columns, nothing moves | MISSING | No regular-width layout, so nothing changes on a foldable's open screen. |
| DU-02 | iPhone Duo open: text on the left page, Understand on the right; nothing crosses the fold | MISSING | No two-page reader with Understand on the right. |
| XT-01 | First day: no streak yet, ‘A place to start’ instead of Your plan, and no Pray card until it is wanted | PARTIAL | No lamp before a day counts (app/(tabs)/today.tsx:271) and "A place to start" (207-218) are built, but the Pray card always shows (245-252) instead of waiting until the second day or a first list item. |
| XT-02 | Have I read today? The lamp is outlined until today counts, then lit; no tick, no message | BUILT | Lamp outlined until today counts, then lit: app/(tabs)/today.tsx:280; components/Lamp.tsx:13. |
| XT-03 | Pray for someone with no requests left: say so plainly; never repeat a request you prayed for | PARTIAL | "That's everyone for now." and its line are there (app/pray/someone.tsx:95-101), but the Ask for prayer and Back to Pray buttons are not; only × leaves. |
| XT-04 | A new request nobody has prayed for yet: no ‘0 prayed’; the count appears from the first | BUILT | "Live · 7 days left", never "0 prayed": lib/pray.ts:79-85. |
| XT-05 | Signed out of iCloud: Ask explains in one line and opens Settings; your list still works on this iPhone | BUILT | Signed out: one line, Open Settings, Not now: app/pray/ask.tsx:66-75. |
| NB-01 | The rhythm line: on the next reminder only, once today counts, so it is still true when it arrives | BUILT | "Your rhythm: 4 days" on the next reminder once today counts: lib/reminder.ts:172. |
| NB-02 | Sunday: the week in review takes the line’s place, still one notification | BUILT | Sunday's week in review takes the line's place: lib/reminder.ts:184. |
| NB-03 | No reminder on Sunday: the week in review alone, at 18:00; never a missed day, never zero | BUILT | "Your week" alone at 18:00 when no reminder that Sunday: data/reminder.ts:259. |
| NB-04 | Reminder: the week in review, off until you turn it on | BUILT | Week in review switch, off by default: app/reminder.tsx:140-149. |
| DO-01 | Today: Morning and Evening Prayer, when the Daily Office is chosen in Daily psalms | BUILT | Daily prayer card in the psalms' place: app/(tabs)/today.tsx:151-184. |
| DO-03 | Settings › Daily psalms: the Daily Office as a fourth choice | BUILT | Daily prayer as a fourth choice: lib/dailyPsalms.ts:163-169 (same menu-without-descriptions gap as DR-04). |
| AS-01 | Sit with this: a quiet sound, off until you turn it on; one tap stops it | BUILT | "+ Add rain", tapped again it stops: app/sit.tsx:146-150. |
| DO-04 | Daily prayer, guided: the opening sentence over the day’s picture; one part per screen | BUILT | Guided daily prayer, one part per screen over the picture: app/office.tsx:23-119. |
| DO-05 | A psalm: the Venite, which opens the office; long readings scroll within the step | BUILT | The Venite as a step; long parts scroll: app/office.tsx. |
| DO-06 | The last part: the Lord’s Prayer, and Amen ends it, back to Today | BUILT | The Lord's Prayer and Amen back to Today: app/office.tsx:94. |
| PT-01 | Proposal: Pray as its own tab once it is live, with Circles; Today keeps one Pray row | N/A | Proposal (Pray as a third tab); not adopted, Today keeps the Pray card. |
| CI-01 | Pray: Circles below For each other; a circle is people you know, by invitation | BUILT | Circles under For each other, New circle: app/pray/index.tsx:78-86. |
| CI-02 | A circle: its requests, Ask this circle; Invite for its creator, 12 at most; one line says who sees them | BUILT | A circle's requests, Ask this circle, Invite, "Only people in Family see these.": app/pray/circle.tsx:19-80. |
| CI-03 | Joining without iCloud: one line, Open Settings, as XT-05 | BUILT | Sign in to iCloud sheet for circles: app/pray/icloud.tsx:14-31. |

### System surfaces

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| SX-01 | Continue, small and medium: the passage by name, your place on one line; Listen without opening | BUILT | Continue small and medium with the place line and Listen: targets/widget/Widgets.swift:207-281. |
| SX-02 | Continue, large: the verses around your place, the place marked as in the reader | BUILT | Continue large with verses around the place marked: Widgets.swift:283-319. |
| SX-03 | A passage for today, small and medium: the psalm’s number set large, its first words | BUILT | Psalm number large, first words: Widgets.swift:443-478, 379-391. |
| SX-04 | A passage for today, large: the psalm’s opening, read or heard | BUILT | Large: the psalm's opening and Listen: Widgets.swift:393-413. |
| SX-05 | Listen pressed: it plays where you are, the button turns to Pause, the Island takes over | BUILT | Listen turns to Pause, "Playing · 138:2": Widgets.swift:186-203, 361-370. |
| SX-06 | Tinted Home Screen: the background goes, type and the Listen ring take the tint | BUILT | Tinted mode via widgetAccentable: Widgets.swift:156-158. |
| SX-07 | Lock Screen: today’s psalm inline, your place in a ring, the verse in a rectangle, Listen in a circle | BUILT | Inline, ring, rectangle and Listen circle: Widgets.swift:322-330, 421-438, 497-518. |
| SX-08 | StandBy at night: the psalm beside the clock, in night mode’s one red | BUILT | StandBy fills with the verse: Widgets.swift:480-492. |
| SX-09 | Control Center: Listen as a wide toggle showing the place; Continue as a small button | BUILT | Control Center Listen toggle and Continue button: Widgets.swift:551-581. |
| SX-10 | Siri, “Read Psalm 23 in Yada”: Siri reads the BSB; Read opens it, Listen plays the recording | BUILT | Siri reads the BSB with Read and Listen: modules/yada-system/app/YadaIntents.swift:154-200. |
| SX-11 | Shortcuts: six, each with the sentence to say; two new for build 6 (stop, repeat) | BUILT | Six App Shortcuts with phrases: YadaIntents.swift:318-330. |
| SX-12 | Spotlight: Psalm 23 as the top hit, its first verse, Read and Listen beside it | PARTIAL | Psalm 23 is indexed (modules/yada-system/ios/YadaSystemModule.swift:129, 180-190), but as a plain CSSearchableItem, so Spotlight shows no Read and Listen beside the hit. |
| SX-13 | The reminder, collapsed: the next passage by name over its first words | BUILT | "Next in John: …" over first words: lib/reminder.ts:108-110. |
| SX-14 | Long-press: the passage opens in Yada’s serif; Read or Listen, nothing else | BUILT | Long-press in Yada's serif with Read and Listen: targets/notification/NotificationViewController.swift:75. |
| SX-15 | Grouped: today’s reminder on top; yesterday’s was taken back when this one came | BUILT | One thread; yesterday's reminder is taken back, but only when Yada next opens: YadaSystemModule.swift:170-177. |
| SX-16 | Scheduled Summary: today’s psalm leads it, as its verse, not as a nudge | PARTIAL | The reminder is scheduled with relevanceScore 0 (YadaSystemModule.swift:162), so a Scheduled Summary is not led by today's psalm as drawn; the code cites a later "decision 5". |
| SX-17 | Live Activity: passage, verse in the BSB, the passages as segments, and the stop set | BUILT | Live Activity with passage, verse, segments and "Stops after 1:18": Widgets.swift:661-706; lib/systemSurfaces.ts:192-209. |
| SX-18 | Repeating the passage, paused: the line says Repeats; Play goes on from the same verse | BUILT | "Repeats 1:1–18" line: lib/audio/stop.ts:106-115. |
| SX-19 | Between chapters: the spoken chapter name is the line, in ink, while it is said | BUILT | "John, chapter 2" while it is said: lib/systemSurfaces.ts:213. |
| SX-20 | Dynamic Island: compact shows the passage ring and the verse; minimal, the ring alone | BUILT | Island compact ring and verse; minimal ring: Widgets.swift:760-766. |
| SX-21 | Dynamic Island, expanded: the Lock Screen activity, black, around the camera | BUILT | Island expanded: Widgets.swift:735-759. |
| SX-22 | StandBy while listening: the verse fills the screen, three controls at arm’s length | BUILT | StandBy while listening: Widgets.swift:708-722. |
| SX-23 | At the stop: audio paused at 1:18, Play goes on from 1:19; the phone ends the activity later | PARTIAL | At a stop the app ends the Live Activity at once (data/system.ts:154-158), so the paused "Stopped after 1:18" activity with Play from 1:19 never shows. |

### Build 10 · scripture, crafted

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| SC-01 | Opening John directly: the first passage and its verses, nothing above them; an “About John” handle waits abo | MISSING | No "About John" handle above the home indicator. Chapter 1 opens with the book's paragraph inline above the first passage (components/BookIntro.tsx:17-34; IG-01's design). |
| SC-05 | Drag the handle up: the paragraph in a sheet over the reading, with a one-line source; Back to reading closes | MISSING | No sheet that the handle drags up; the paragraph is inline text. |
| SC-06 | Arriving from Matthew: one pause for the next book, its paragraph and Start Mark 1; opening Mark directly ski | MISSING | No pause between books with the next book's paragraph and "Start Mark 1"; Matthew 28's end goes to the End page (RT-04) and then Mark 1. |
| OR-01 | About John, pulled up: the paragraph, then the shape of the book: its sections in order, no dates | MISSING | No About John sheet, so no "The shape" list of sections. |
| OR-02 | Scrolled: where, the book’s places on a map drawn on the phone, high confidence only | MISSING | No book map of places in an About sheet. |
| OR-03 | The end: who, the seven Tyndale profiles in John; then one card for the BibleProject overview with its length | MISSING | No "who" profiles list or BibleProject card. |
| OR-04 | All the places, pushed inside the sheet: in the order they first appear, with the verse; each opens its map | MISSING | No "All the places" page in book order. |
| RT-01 | Back after a month or more: the day’s picture, where you were, one button, and a way out; no count, no apolog | BUILT | Back after a month: picture, "You were in Mark 4.", Continue, Start small, ×: app/return.tsx:38-110; opened from app/(tabs)/index.tsx:104-106. |
| RT-02 | Your rhythm after a long break: it leads with the days read this year, large; the run is second, with the lam | BUILT | Days this year large, the run second with the lamp, year grid: app/rhythm.tsx:41-118. |
| RT-03 | A calm close: chapters read in the book, and the next chapter as the one thing to tap; no confetti, no points | BUILT | Chapters read in the book and Next as the one card: components/ChapterClose.tsx:106-155. |
| RT-04 | The end of a book, one screen: its own last verse as a quotation, the claim only when every chapter was read, | BUILT | End of a book, last verse as a quotation, claim only when all read: components/ChapterPages.tsx:70-135. |
| RT-05 | First launch, after the first passage: one question with four ways in, each tile carrying its time; Not now i | BUILT | "When will you read?" with four tiles, Remind me, Not now: app/remind-ask.tsx:33-140. |
| RT-06 | A week away: one notification, once; where you were, nothing from your notes, nothing about days missed | BUILT | One "welcome back" a week after the last open: data/reminder.ts:269-285. |
| RT-07 | Start something small: three ways in, each saying how long; any of them counts for the day | BUILT | Start small, three ways in with their length: app/start-small.tsx:35-120. |
| RT-08 | The same screen with no picture on the phone: the deep forest, never blank | BUILT | No picture: the deep forest ground: app/return.tsx:21-22, 50. |
| VM-01 | Search, before you type: six moments to start from, each with the opening words of its first verse; no rankin | MISSING | Search before you type is an empty field (app/search.tsx:137-357 shows nothing until a query); no "For a moment" list of six moments. |
| VM-02 | Anxious, one verse at a time (after Once and Noom): swipe for the next, one button to open it; the Samaritans | MISSING | No Anxious verse pages or Samaritans line (no HTML on the canvas; checked by caption). |
| HO-01 | The small-group handout: Yada’s wordmark, the passage in the BSB, one plain line, and where readers differ, e | MISSING | No small-group handout (no HTML on the canvas; checked by caption). |
| LH-01 | Learn a verse by heart, step 1 of 3: read it, hear it; nothing is hidden yet | MISSING | No Learn a verse by heart (no HTML on the canvas; checked by caption). |
| LH-02 | Step 2 of 3: some words fade; tap a gap to see the word (shown on the last one); no penalty | MISSING | Same: no fading-words step. |
| LH-03 | Step 3 of 3: most words gone, equal-width gaps; Again goes back, Done ends it; no score, no streak, no badge | MISSING | Same: no step 3. |
| HM-01 | The passage guide’s ⋯: Share handout, which opens HM-03; only for passages John has approved | MISSING | The passage guide has no ⋯ and no Share handout (components/PassageGuide.tsx:93-114). |
| HM-02 | A selected verse’s ⋯: Share as an image, Share, Bookmark, and Learn this verse | PARTIAL | A selected verse's ⋯ holds Copy, Share, Bookmark (lib/reader.ts:137-140); no Share as an image, no Learn this verse. |
| HM-03 | Share handout opens on the page itself, as a PDF (after Satispay’s Export and inDrive’s receipt): Share is th | MISSING | No handout PDF page. |
| OR-05 | A book with no places or profiles in the data (1 John): those sections simply do not appear; no empty heading | MISSING | Edge case of the About sheet, which does not exist. |
| OR-06 | The video card with no connection: the same card, quieter, saying why; it never shows an error and never down | MISSING | Edge case of the About sheet's video card, which does not exist. |
| VM-03 | Lonely, the second of five: a short verse sits large and alone; Samaritans beneath; Matthew 28:20 is flagged | MISSING | No Lonely verse page. |
| VM-04 | Tired: no support row, because the moment does not call for one; a passage shows its opening and opens whole | MISSING | No Tired verse page. |
| BH-01 | Bible, one way to start (after Apple Books Home): a serif Continue heading over one card, the plan on Today o | BUILT | Serif "Continue" heading over one card, books below: app/(tabs)/index.tsx:222-281, 377-418. |
| VM-05 | Alternative to VM-02: Anxious as a list of five equal cards, each a reference above its verse (after Insight | N/A | Alternative to VM-02 (neither built). |
| VM-06 | Alternative to VM-03: Lonely as equal cards; Samaritans beneath | N/A | Alternative to VM-03 (neither built). |
| VM-07 | Alternative to VM-04: Tired as equal cards; no support row | N/A | Alternative to VM-04 (neither built). |

### Build 6 · listening

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| LB-01 | The speed button opens one menu: speed, stop and repeat, each showing its setting | BUILT | One menu from the speed button: Speed, Stop playing, Repeat with their settings: lib/audio/voice.ts:66-84; app/player.tsx:190-210. |
| LB-02 | Stop playing: two natural breaks, then three times; a time finishes its verse first | BUILT | Stop playing rows with "After 1:18": lib/audio/voice.ts:48-75. |
| LB-03 | A stop is set: one line under the progress says when | BUILT | The line under the progress: lib/audio/stop.ts:106-115. |
| LB-04 | Stopped at the break: paused on the next verse, so Play carries on | BUILT | Paused on the next verse at the break: lib/audio/stop.ts:44-60. |
| LB-05 | Repeat: the verse, the passage or the chapter, each naming its span | BUILT | Repeat this verse/passage/chapter with spans: lib/audio/voice.ts:76-79. |
| LB-06 | Repeating the passage: after 1:18 it starts again at 1:1 | BUILT | Passage repeat loops: lib/audio/stop.ts:31-43. |
| LB-07 | Repeating a verse: Stop offers only the times, since no break will come | BUILT | Repeating a verse leaves only times: lib/audio/stop.ts:65. |
| LB-08 | Between chapters: the chapter’s name is spoken, shown as the line playing | BUILT | The chapter's name spoken and shown as the playing line: app/player.tsx:300-310. |
| LB-09 | The WEB read by Heart, the KJV by George: the version’s own reading, its voice named | BUILT | Each text's own computer voice named under the title: app/player.tsx:138-143. |
| LB-10 | Voice on the KJV: George reads it, so no choice; the book’s KJV reading to download | BUILT | KJV: one voice, nothing to choose, the book's download: app/voice.tsx:24-130. |
| LB-11 | Downloads: a book’s readings listed by voice and text | BUILT | Downloads lists readings "John · Heart · BSB": app/downloads.tsx:68-75. |
| LD-01 | Reading the NKJV: Download John sits under the version, as a free translation’s download does | MISSING | No "Download John" for the NKJV (canvas: on hold until John decides, 15 Oct 2026). |
| LD-02 | Downloading: chapters counted, one at a time; the ring stops it | MISSING | No licensed download progress (on hold). |
| LD-03 | Downloaded: ⋯ holds Remove; after 30 days without a refresh it is Download John again | MISSING | No downloaded licensed book with ⋯ Remove (on hold). |
| LD-04 | Can’t download now: the day’s limit, or no connection; the row stays, the button goes | MISSING | No "Can't download now" state (on hold). |
| LD-05 | Downloads lists the book under Translations, removed like the others | MISSING | Downloads has no licensed books (on hold). |
| NP-01 | The first passage finished: Yada asks in its own words, showing the reminder it would send | N/A | Superseded by RT-05: the ask after the first passage is now "When will you read?" (app/remind-ask.tsx). |
| NP-02 | Turn on, then iOS asks, once (Apple’s own words) | BUILT | iOS asks only after Remind me / Turn on: app/remind-ask.tsx; data/reminder.ts turnOnFromAsk. |
| NP-03 | Not now: asked once more, on a later return, as one line on Home; then only in Settings | BUILT | One line on Bible, "A reminder to read each day?" with Turn on / Not now: app/(tabs)/index.tsx:302-333. |
| UL-01 | A verse’s Understand: Hear this passage, from its first verse | BUILT | Hear this passage above More on this verse: components/UnderstandViews.tsx:279-283; components/HearPassage.tsx:19. |
| UL-02 | A passage’s guide: Hear this passage under In short | BUILT | Hear this passage under In short: components/PassageGuide.tsx:168-171. |
| UL-03 | From the full player: the playing line opens its Understand; other lines play from there | BUILT | The playing line opens its Understand: app/player.tsx:444-448. |
| UL-04 | A book with little written: the outline line and its rows, nothing empty, nothing promised | BUILT | A guide with only its outline line, nothing empty: components/PassageGuide.tsx:149-167. |
| IG-01 | John 1: one paragraph about the book above the first passage, then the text | N/A | Superseded by SC-01/SC-05 (the handle and sheet, both MISSING). The inline paragraph IG-01 draws is what ships: components/BookIntro.tsx:17-34. |
| IG-02 | Genesis 1: tN has no introduction for Genesis, so the chapter opens as it does today | BUILT | Genesis has no intro, so nothing shows: components/BookIntro.tsx:19-21. |
| IG-03 | Word: under Form, each grammar term is a row; nothing opens until asked | BUILT | Grammar terms as rows under Form: components/GrammarTerms.tsx:25. |
| IG-04 | A term opened: the grammar’s first sentence, word for word, and its credit | BUILT | A term opened in place with its credit: components/GrammarTerms.tsx. |
| IG-05 | Hebrew: בָּרָא, qal perfect. Hebrew perfect is its own entry, not the Greek one | BUILT | Hebrew perfect its own entry: components/GrammarTerms.tsx; data/grammar.generated.ts. |
| WM-01 | MM-03 built: λόγος tapped, “Word” in the verse takes the evidence underline; the hairline once per device | BUILT | The tapped word's BSB partner underlined, hairline once: components/BsbPartner.tsx:46-115. |
| WM-02 | The word card: In the BSB, the verse with the word’s partner underlined | BUILT | "In the BSB" on the word card: components/BsbPartner.tsx:116-140. |
| WM-03 | Genesis 1:1: the Hebrew’s verb comes first; its partner “created” is underlined where the BSB puts it | BUILT | Hebrew verb partner underlined where the BSB puts it: components/BsbPartner.tsx. |
| WM-04 | A word the BSB leaves untranslated (τὸν), or reading the WEB: no In the BSB, nothing underlined | BUILT | No partner, no In the BSB: components/BsbPartner.tsx (BSB only). |
| WM-05 | A passage’s guide: Places in this passage, each a row to its map | BUILT | Places in this passage in the guide: components/PlacesInPassage.tsx:17-40. |
| WM-06 | Bethany: the map in Yada’s tokens, drawn on the phone; the identification and its verses | BUILT | Bethany: the map drawn on the phone, identification, verses: components/PlaceScreen.tsx:25-70; components/PlaceMap.tsx:21. |
| WM-07 | A place the data knows, in the verse: its name in accent ink opens its map | BUILT | Place names in accent ink open the map (in Understand's repeated verse): components/BsbPartner.tsx. |

### Next release · new flows

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| GD-01 | Start here, every passage guided: Next is passage 10 | BUILT | Start here list, Next marked with its orientation line: app/thread.tsx:33-140. |
| GD-02 | Guide for John 5:1–15, medium: the same four parts | N/A | Superseded by the No-AI guide (NA-04, JR-05): Where we are / Three things / The passage are no longer the guide's parts. |
| GD-03 | The guide’s passage keeps the verse-4 line | BUILT | Verse by verse keeps the missing verse's manuscripts line: components/UnderstandPages.tsx:212-215 (the reader itself does not, see PD-05). |
| GD-04 | A book with no guides yet: no passage link, Listen alone | BUILT | No passages: the bar offers Listen alone: app/read/[book]/[chapter].tsx:1032-1059. |
| BA-01 | Full player, recorded reading: the voice is named under the title | BUILT | The voice named under the title: app/player.tsx:138-143, 255-277 ("Heart, computer voice", John 13 Oct 2026, not "Recorded"). |
| BA-02 | First play of a chapter: it downloads, then plays; one line, a stop | BUILT | "Getting the recording" with a stop in the mini player: app/read/[book]/[chapter].tsx:1001-1002, 1015-1016. |
| BA-03 | Voice: recorded or iPhone; download the whole book | BUILT | Voice sheet and Download John: app/voice.tsx:24-130 (Heart/George rather than Recorded/iPhone voice). |
| BA-04 | Downloading John, then done: Remove sits under ⋯ | BUILT | Downloading N of 21, then downloaded with ⋯: app/voice.tsx:80-116. |
| BA-07 | ⋯ on a downloaded book: one action, Remove | BUILT | ⋯ Remove John's audio: app/voice.tsx:84-88. |
| BA-08 | Not enough space: one line, the button stays | BUILT | "Not enough space on this iPhone to download John.": app/voice.tsx:122. |
| BA-05 | Offline, chapter not saved: the iPhone voice reads, one line says why | BUILT | "You're offline." under the title: data/audio.ts:241; app/player.tsx:284-288. |
| BA-06 | Reading the WEB: one voice, so the voice line says so and opens nothing | BUILT | One voice: the line is plain text: app/player.tsx:144, 276-277. |
| SW-01 | Swiping: John 2 peeks in from the right | BUILT | The next chapter peeks in: components/ChapterPages.tsx ChapterPeek; components/ChapterSwipe.tsx:28. |
| SW-02 | Motion: past a third it goes on; short of it, it springs back | BUILT | Past a third it goes on, else springs back: components/ChapterSwipe.tsx. |
| SW-03 | End of a book: the swipe stops on a page with a link, never into Acts | BUILT | The swipe stops on the End page: app/read/[book]/[chapter].tsx:950-957. |
| SW-04 | When swiping is off, and the other ways to turn the page | PARTIAL | Swipe is off with a selection and under VoiceOver (app/read/[book]/[chapter].tsx:748), but there are no VoiceOver actions "Next chapter, John 2" / "Previous chapter"; only the footer links. |
| WL-01 | Home Screen: Continue (small) and a passage for today (medium) | BUILT | Redrawn as SX-01–04 and built there (Widgets.swift). |
| WL-02 | Lock Screen while listening: where you are, three controls | BUILT | Built as SX-17 (Live Activity). |
| WL-03 | Dynamic Island: verse number compact; the same three controls expanded | BUILT | Built as SX-20/21 (Dynamic Island). |
| WL-04 | Reading the NKJV: the widget keeps the place and shows the BSB | BUILT | Widgets show the BSB whatever the reader reads: Widgets.swift:1-4; data/system.ts. |
| RP-01 | Reading plans: two, each saying what it is | BUILT | Two plans, each saying what it is: app/plans.tsx:17-60. |
| RP-02 | M’Cheyne, not started: reading 1 of 365, no dates | BUILT | M'Cheyne reading 1 of 365, "No dates. It waits where you stop.": app/mcheyne.tsx:26-120. |
| RP-03 | Back after a gap: it picks up at the next chapter, nothing to catch up | BUILT | Picks up at the next portion: app/mcheyne.tsx; lib/plans.ts. |
| RP-04 | End of a plan chapter: the next reading leads, the next chapter stays | BUILT | "Next in M'Cheyne" above the chapter links: app/read/[book]/[chapter].tsx:901-913. |
| PD-01 | John 11:1: people and places in one line, in the verse’s order | PARTIAL | People show as Tyndale profile rows (components/StudyLayer.tsx:314), only in the full view or when no entry (components/UnderstandViews.tsx:440-444, 644-648). No one-line "Lazarus · Bethany · Mary · Martha" at the top of the half view, and places are not in it. |
| PD-02 | Bethany: a place pushes inside the sheet, map first | BUILT | A place pushes inside the sheet, map first: components/PlaceScreen.tsx:25-70. |
| PD-03 | A term from the verse: Pharisees, pushed like a profile | BUILT | A term pushes like a profile (Translation Words, not Aquifer): components/UnderstandPages.tsx:80-122. |
| PD-04 | Search: a term finds its dictionary entry first | MISSING | Search has no Dictionary group: its groups are Go to, People, Words, Verses (app/search.tsx:198-348). |
| PD-05 | John 5: verse 4 keeps its place as one line | MISSING | A verse the BSB omits (John 5:4) has no line in the reader; the chapter goes from 3 to 5 with no "Not in the oldest manuscripts". |
| PD-06 | The note: plain words, the verse the KJV has, no sigla | PARTIAL | Understand on an omitted verse shows the manuscripts fact and the UST line (components/UnderstandViews.tsx:202-234), not the KJV's verse; and from the BSB reader the verse cannot be tapped (PD-05). |
| LT-01 | Translations: NKJV, NLT and The Message online, said plainly | BUILT | Translations with an Online section: app/translations.tsx:53, 179-190. |
| LT-02 | Reading John 1 in the NKJV: the notice under the text, no Listen | BUILT | The notice under the text: app/read/[book]/[chapter].tsx:936-941 (Listen reads the BSB per EG-03). |
| LT-03 | Offline and not saved: one sentence and the way on | BUILT | "needs a connection" and Read in the BSB: app/read/[book]/[chapter].tsx:809-818, 1115-1126. |
| LT-04 | Share from the NKJV: the name and copyright always go with it | BUILT | Copy and Share append name and copyright: app/read/[book]/[chapter].tsx:647-659. |
| LT-05 | Share from The Message: its own notice goes with it | BUILT | The Message by name with its notice: app/read/[book]/[chapter].tsx:652. |
| MS-01 | Map in Yada’s own style: paper, ink, one accent dot | BUILT | Map in Yada's style: components/PlaceMap.tsx:21 ("Open in Maps" stands where the frame says "Show on a larger map"). |
| MS-02 | Spotlight: a reference finds the verse in the BSB; two App Shortcuts | BUILT | Spotlight references and two App Shortcuts: YadaSystemModule.swift:129; YadaIntents.swift:318-330. |
| MS-03 | Siri: the verse in the BSB, read in Siri’s voice; open to keep reading | BUILT | Siri reads the BSB: YadaIntents.swift:154-200. |
| MS-04 | The UST joins as a plain-English translation, said in one line | MISSING | No UST row in Translations ("Plain English"). |
| MS-05 | Reading John 1 in the UST | MISSING | The UST cannot be read as a translation. |
| TY-01 | John 1:42: Peter’s profile now shows in John, not only in Matthew | MISSING | Profiles are matched by name in the book's own Tyndale bundle only (data/study.ts:55-64), so John 1:42 shows no Simon Peter from Matthew's. |
| TY-02 | Simon Peter: the passages in this book come first | PARTIAL | The profile lists its passages (components/StudyLayer.tsx:348-400) but not this book first with the rest behind "Elsewhere". |
| TY-03 | John 1: the book summary is one line above the first passage | N/A | Superseded by SC-01 (the About John handle), itself MISSING. |
| TY-04 | About the Gospel of John: purpose, author, date, setting | MISSING | No Purpose / Author / Date / Setting page for a book. |
| GS-01 | Where we are: who speaks, in Glyssen’s own names | MISSING | No "Speaking" line from Glyssen in the guide (Glyssen is only credited in lib/sources.ts:73). |
| GS-02 | John 3: Jesus speaks to 3:13; 3:14–21 is not marked, so 3:16 is never ‘Jesus says’ | MISSING | No unmarked-speaker line ("In 3:14–21 the text doesn't say who is speaking"). |
| GS-03 | Many speakers: four, then ‘and 5 more’; open shows all, as written | MISSING | No "and 2 more" speaker list. |
| MC-01 | A claim marks its own words: God, loved, world from MACULA’s frame | N/A | Superseded: the claims MACULA would mark ("Three things to notice") left the guide with the No-AI decision (NA-04, JR-05). Not built. |
| MC-02 | Tap a marked word: the verb and the words MACULA links to it, no role names | N/A | Same as MC-01. |
| MC-03 | Reduce Motion and VoiceOver: marks appear without a fade; one stop reads all three | N/A | Same as MC-01. |
| UW-01 | A key term in the guide opens a short article, pushed | BUILT | Guide › Key words › a term's article, pushed: components/PassageGuide.tsx:196-205; components/UnderstandPages.tsx:51-122. |
| UW-02 | End of a guide: an optional Check what you read, answers one tap away | BUILT | Check what you read, answers one tap away: components/UnderstandPages.tsx:124-165 (no Next after it, see ON-04). |
| TH-01 | Themes in this passage: a short list near the end of the guide | PARTIAL | Themes are one "Themes: a · b" line inside In short (lib/passageGuide.ts:67), not a list of rows near the end of the guide. |
| TH-02 | A theme opens the passages that develop it, pushed | MISSING | A theme opens nothing. |
| TL-01 | Where we are gains one line placing the passage in time | MISSING | No "In time" line. |
| TL-02 | The order of events: sequence first, a date only where John reviewed it | MISSING | No order of events page. |
| WA-01 | WEB recorded: the reader and the year are named | N/A | Superseded by LB-09 (WEB read by the Heart computer voice). |
| WA-02 | KJV recorded: same sheet; off in the UK until Cambridge answers | N/A | Superseded by LB-09/LB-10 (KJV read by George). |
| HL-01 | Deuteronomy 6:4: the large letters shown as written | MISSING | Large letters are not drawn in Original Hebrew (no large/small/suspended handling anywhere). |
| HL-02 | Judges 18:30: a raised letter, said in one plain line | MISSING | No raised-letter line for Judges 18:30. |
| UX-01 | Beginner: three parts and nothing else at the medium detent | N/A | Superseded by VS-01 (the half view John approved 12 Oct). |
| UX-02 | Pull up: Go deeper, grouped by the question you’d ask | N/A | Superseded by VS-02's fixed Go deeper order; whether See also belongs in the full view is still John's call (README). |
| UX-03 | No explanation for this verse: who’s here, the passage, a study note | PARTIAL | A verse with no entry shows People, study notes, See also and Go deeper (components/UnderstandViews.tsx:613-655), but not "In this passage" with the guide's line and a link to the guide. |
| UX-04 | 1:1–18 selected: the bar says Understand 1:1–18 | BUILT | A range selected: "Understand 1:1–18": components/ActionBar.tsx:111-127. |
| UX-05 | …and it opens the passage guide: the same answer as the bar at rest | BUILT | …opens the passage guide: components/UnderstandViews.tsx:68-74. |
| UX-06 | Part of a passage (1:3–5): its guide, your verses first, marked in the text | BUILT | Your verses first: components/PassageGuide.tsx:95-101. |
| UX-07 | Across two passages (1:15–20): the first guide, then the next one row | BUILT | "Your selection continues" row: components/PassageGuide.tsx:103-112. |
| UX-08 | A book with no guides (Mark 1:1–4): verse by verse, a study note each | PARTIAL | A book with no guides shows Tyndale's note on the passage (components/PassageGuide.tsx:54-87), not verse by verse with a study note each. |
| UX-09 | Understand 1:1–18 gives more than one verse: overview, then verse by verse | BUILT | Overview, then Verse by verse one push away: components/PassageGuide.tsx:196-205; components/UnderstandPages.tsx:193-235. |
| UX-10 | …then Go deeper for the whole passage, the same five groups | BUILT | Go deeper for the whole passage: components/PassageGuide.tsx:196-213. |
| UX-11 | Reading the KJV: the same Understand; BSB-bound lines say ‘in the BSB’ or step aside | PARTIAL | Understand shows the same facts on the KJV, but nothing rewords BSB-bound lines as "In the BSB, …" or "Compare · your KJV against the others"; the facts appear exactly as stored. |
| UX-12 | Reading the NKJV: Understand is the same, because it is about the verse, not the version | BUILT | Same Understand on the NKJV, "Explanation based on BSB": components/UnderstandViews.tsx:161-165. |
| CP-01 | The bar’s Compare opens Compare itself: yours, then each version against yours | BUILT | The bar's Compare opens Compare: app/read/[book]/[chapter].tsx:662-665; app/evidence/translations.tsx:38. |
| CP-02 | John 3:16: ‘only begotten’, ‘whosoever’, ‘everlasting’ now show, with one line each | BUILT | One change line per version: app/evidence/translations.tsx; lib/diff.ts. |
| CP-03 | When they agree, it says so once (punctuation never counts) | BUILT | All agree said once: app/evidence/translations.tsx. |
| CP-04 | 1 Corinthians 14:34: the marks the old Compare missed | BUILT | "Worded differently throughout": lib/diff.ts. |
| CP-05 | Several verses (1:3–5): verse by verse, the same pattern | BUILT | Verse by verse for a range: app/evidence/translations.tsx. |
| CP-06 | Choose, inside Compare: any one to three, tick to swap | BUILT | Choose inside Compare: app/evidence/translations.tsx:70; app/evidence/choose.tsx:23. |
| CP-07 | Reading the NKJV: it is ‘yours’ and the base, never silently swapped | BUILT | A licensed version is yours and the base: app/evidence/translations.tsx:1-13. |
| CP-09 | Comparing with The Message: shown whole, unmarked, one line says why | BUILT | The Message whole and unmarked: app/evidence/translations.tsx:35. |
| CP-08 | Your version lacks the verse (John 5:4): it says so; nothing becomes the base | BUILT | "Not in the BSB." with nothing promoted: lib/translations.ts:167-168 (reachable from a WEB or KJV reader; the BSB reader has no 5:4 to select). |
| NT-01 | When we ask: once, after the first passage is finished; never at launch | BUILT | Asked once after the first passage is finished, never at launch: app/read/[book]/[chapter].tsx:226-232 (now in RT-05's form). |
| NT-02 | Reminder, before iOS asks: see it, pick a time and what it says | BUILT | The reminder shown before iOS asks, time and days, what it says: app/reminder.tsx:55-186. |
| NT-03 | Then iOS asks, once (Apple’s own words) | BUILT | iOS asks once on Turn on: data/reminder.ts turnOn. |
| NT-04 | The reminder: the next passage by name and its first words | BUILT | "Next in John: …": lib/reminder.ts:108-110. |
| NT-05 | Long-press: Read, or Listen (BSB) — no snooze, no guilt | BUILT | Long-press Read or Listen: targets/notification/NotificationViewController.swift:75; data/reminder.ts:195. |
| NT-06 | A passage for today: the verse itself, public-domain text only | BUILT | A passage for today, public-domain text: lib/reminder.ts:94. |
| NT-07 | On a plan: the next reading, never a day number | BUILT | "M'Cheyne · Reading 2": lib/reminder.ts:113-115. |
| NT-08 | A book download finished while Yada was closed: one, then quiet | BUILT | "John is downloaded": data/recordings.ts:345. |
| NT-09 | Away for two weeks: reminders pause themselves and say so once, in the app | BUILT | "Reminders paused while you were away." with Resume / Turn off: app/(tabs)/index.tsx:287-301. |
| NT-10 | If iOS says no: one sentence and the way to Settings, no nagging | BUILT | Denied: one sentence and Open Settings: app/reminder.tsx:57-64. |
| NT-11 | Where it lives: Home › ⋯ › Reminder, beside Reading plans | BUILT | Bible › ⋯ holds Recent, Reading plans, Settings (the Reminder lives in Settings, ST-05): app/(tabs)/index.tsx:193-212. |
| NA-03 | No AI · 14:34–35 selected: the guide, the note on exactly these verses first | BUILT | A range opens the guide with your verses in plain words first: components/PassageGuide.tsx:95-101. |
| NA-01 | 14:34 today: a major debate with no approved note, so no plain reading and no readings; facts and verses stay | BUILT | Readers differ, then One way to read it, facts and verses: components/UnderstandViews.tsx:241-295; lib/understand.ts:80, 132. |
| NA-02 | 14:34 once John’s note is approved: the note first, then ‘One way to read it’ with ‘Paul tells them’ | MISSING | There is no slot for John's own approved note ("Written by John · reviewed"); nothing in the app reads or shows one. |
| NA-04 | The guide for 14:26–40: the passage summary in plain words, Tyndale moved to Study notes | BUILT | In short, Before/After, Study notes under Go deeper: components/PassageGuide.tsx:143-216; lib/passageGuide.ts:48-71. |
| NA-05 | John 1:5: readers differ first, then the plain line as one way to read it | BUILT | Plain line then Readers differ and Notice: components/UnderstandViews.tsx:241-295. |
| NA-06 | Isaiah 7:14: a major debate awaiting John’s note; whose words, then facts only | BUILT | Isaiah 7:14 readings and facts from the data: components/UnderstandViews.tsx. |
| NA-07 | Job 8:6: ‘Bildad the Shuhite says:’ above the plain line, so his claim isn’t read as Yada’s | BUILT | "Bildad the Shuhite says:" above the plain line: components/UnderstandViews.tsx:312-316. |
| NA-08 | Revelation 20:2: ‘In John’s vision’, and the thousand years is a major debate awaiting a note | BUILT | "In John's vision:" and the debate: components/UnderstandViews.tsx:312-316, 386-393. |
| ST-01 | Settings: eight real choices, each row showing its value | BUILT | Settings rows with values: app/settings.tsx:113-204. |
| ST-02 | Downloads: what is on this iPhone and its size; ⋯ removes one | BUILT | Downloads with sizes, ⋯ removes one: app/downloads.tsx:27-115. |
| ST-03 | Remove my data: one alert that says exactly what goes, and where | BUILT | One alert that says what goes and where: app/settings.tsx:91-103. |
| ST-04 | Sources and licences: every source, plain role first, licence second | BUILT | Sources and licences: app/sources.tsx:40. |
| ST-05 | Where it lives: Home › ⋯ › Settings; the reader’s Aa stays as the shortcut | BUILT | Bible › ⋯ › Settings; Aa stays: app/(tabs)/index.tsx:199-203; app/type-settings.tsx:36. |
| IA-11 | IA v3 · Home and the pages it opens | N/A | IA v3 diagram; the root has since become IA v4's tabs (IA-15). |
| IA-12 | IA v3 · The reader, its sheets and depth | N/A | IA v3 diagram of the reader and its sheets. |
| IA-13 | IA v3 · Doors from outside the app, and the rules that hold everywhere | N/A | IA v3 diagram of outside doors and rules. |
| IA-14 | IA v3 · Home: one lead, your plan in one line, the books | N/A | Superseded by BH-01 (plan on Today only, no "Your plan" line on Bible). |
| DI-01 | Understand 14:34, Go deeper: Key words, each with its first sentence | BUILT | Key words each with its first sentence: components/UnderstandPages.tsx:51-79; components/UnderstandViews.tsx:531-538. |
| DI-02 | A term’s page, pushed inside the sheet: definition, where this book uses it, related terms | PARTIAL | The term page has the definition and where this book uses it (components/UnderstandPages.tsx:80-122) but no related terms. |
| DI-03 | Search: a term finds its dictionary entry before the verses | MISSING | Search has no Dictionary group before the verses (app/search.tsx:198-348). |
| DI-04 | Browse the dictionary: from Search’s empty state, grouped, no tab | MISSING | No dictionary browse from Search's empty state (the empty state is blank). |
| EG-01 | A flagged summary in the app: held back; the guide keeps its facts and its verses | BUILT | A flagged summary is held back while facts stay: components/PassageGuide.tsx:5-6; lib/passageGuide.ts:48-71. |
| EG-02 | Understand offline before Luke’s bundle is saved: one line, and what is already on the iPhone | BUILT | Offline before the book's file: one line, then what is on the phone: components/StudyLayer.tsx:122-170; components/UnderstandViews.tsx:639-643. |
| EG-03 | Listening while reading the NKJV: ‘Audio is the BSB’, and one tap to read along in it | BUILT | "Audio is the BSB" with Read along in the BSB: app/read/[book]/[chapter].tsx:1017-1021. |
| EG-04 | Swiping into a licensed chapter that isn’t saved, offline: the same one sentence and the way on | BUILT | Swiping into an unsaved licensed chapter offline: the same sentence: app/read/[book]/[chapter].tsx:809-818. |
| EG-05 | Widget before anything is read: Start here, the same as Home | N/A | Superseded by SX (canvas note). The Continue widget's empty state reads "Open Yada to start reading." (Widgets.swift:221-227), not Start here. |
| EG-06 | Search while reading the NKJV: it searches the NKJV, online | BUILT | Search on the NKJV searches it online: app/search.tsx:284-312. |
| EG-07 | Search on the NKJV, offline: the BSB, said once | BUILT | Offline: "You're offline, so this searches the BSB.": app/search.tsx:314-322. |
| JR-01 | Psalm 51, the first psalm a reader opens: the tip once, then two lines before the psalm | BUILT | The tip once, then the psalm's two lines: components/ReaderLeads.tsx:70; app/read/[book]/[chapter].tsx:822, 851-853. |
| JR-02 | Psalm 51 after: Written when and What kind; everything else waits behind About this psalm | BUILT | Written when and What kind, About this psalm row: components/ReaderLeads.tsx:42-69. |
| JR-03 | About this psalm: title, the picture, how it moves; sources once at the bottom | BUILT | About this psalm page, sources once: components/UnderstandPages.tsx:167-191. |
| JR-04 | Isaiah 40: the section in plain words, and when and to whom, before the text | BUILT | Prophet's section in plain words and setting line: components/ReaderLeads.tsx:25-41; lib/passageGuide.ts:130. |
| JR-05 | Isaiah 40:1–5 guide: the same four slots as every genre; no readings here, so that slot is absent | BUILT | The same slots, absent when empty: components/PassageGuide.tsx:143-216. |
| JR-07 | A major debate (Isaiah 7:14): a human-written note once approved; until then the slot is absent and the repor | BUILT | Until a note is approved the slot is absent (the slot itself is missing, see NA-02). |
| DN-01 | A term this book never uses: ‘Elsewhere in the Bible’ with the count, never ‘In 1 Corinthians · 0’ | MISSING | A term this book never uses shows no uses section at all (components/UnderstandPages.tsx:103-116); there is no "Elsewhere in the Bible · N". |
| DN-02 | Reading the NKJV: Read it alongside shows BSB text, labelled BSB | BUILT | Read it alongside peeks show BSB text, "Shown in BSB": app/evidence/peek.tsx:97-99. |
| DN-03 | A plan’s last reading: one quiet line, no celebration | BUILT | One quiet line at the plan's end: app/mcheyne.tsx:53-58. |
| DN-04 | Remove my data during a download: the alert says the download stops first | BUILT | The alert says the download stops first: app/settings.tsx:95-96. |
| DN-05 | Downloads lists Understand per book, with its size | BUILT | Downloads lists Understand per book with size: app/downloads.tsx:62-65. |
| DN-06 | Depth: each ‹ names where it goes back to (‹ 14:34), so three pushes never feel lost | PARTIAL | ‹ inside a sheet is a round glyph; where it goes back to is only in its VoiceOver label (components/Sheet.tsx useBackName), not shown as "‹ 14:34". |
| VS-01 | John 3:16, half view: the plain line alone (34 words), then More on this verse | BUILT | Half view: the plain line alone, then More on this verse: components/UnderstandViews.tsx:241-295. |
| VS-02 | John 3:16, full view: Go deeper straight after the first view, then readings, Notice, Read it alongside | BUILT | Full view: Go deeper straight after, readings, Notice, Read it alongside: components/UnderstandViews.tsx:364-448. |
| VS-03 | 1 Corinthians 14:34, half view: Readers differ first, then one way to read it, then the manuscripts fact | BUILT | Readers differ first, One way to read it, manuscripts: components/UnderstandViews.tsx:258-277. |
| VS-04 | 1 Corinthians 14:34, full view: every reading, then Go deeper | BUILT | Every reading with Read the full note, then Go deeper: components/UnderstandViews.tsx:386-470. |
| VS-05 | Isaiah 7:14, half view: the JPS 1917 verse and the BSB’s own footnote, then one way to read it | BUILT | Isaiah 7:14 half view from the data: components/UnderstandViews.tsx:241-295. |
| VS-06 | Isaiah 7:14, full view: both readings in full, Compare with JPS 1917, Go deeper | PARTIAL | No "Compare with JPS 1917": the JPS is kept out of the app (lib/sources.ts:125-126), so Compare offers BSB, WEB, KJV, LSV only. |
| VS-07 | A verse low on the screen at AX5: scrolled up first, the sheet opens large, the verse repeats at its top | BUILT | At AX the sheet opens large and repeats the verse: components/UnderstandViews.tsx:166-173; app/_layout.tsx:260. |
| US-01 | Voice help: in the player’s menu, as each row’s second line, not a line under the title | BUILT | Voice help as each row's second line: app/voice.tsx:40-58. |
| US-02 | Player in a book with no passages: “Mark 1” once, “BSB” under it | BUILT | A book with no passages: "Mark 1", "BSB", Guide off: app/player.tsx:217-235, 255-260. |
| US-03 | Next while paused at a chapter’s end: John 2 waits in the mini player, paused | BUILT | John 2 waits in the mini player, paused: app/read/[book]/[chapter].tsx:995-1013. |
| US-04 | The end of a book while listening: “End of John”, Next unavailable | BUILT | "End of John", Next unavailable: app/read/[book]/[chapter].tsx:1003-1004, 1014. |
| US-05 | A translation download failed: its row says so, Try again in place of the button | BUILT | A failed download says so with Try again: app/translations.tsx:246. |
| US-06 | Not enough space: the reason in the row, the button stays | BUILT | Not enough space, the button stays: app/translations.tsx:246. |
| US-07 | A licensed chapter that didn’t load: one sentence, Try again, Read in the BSB | BUILT | Licensed chapter didn't load: one sentence, Try again, Read in the BSB: app/read/[book]/[chapter].tsx:1115-1126. |
| US-08 | Understand couldn’t be opened: the verse in the title, one sentence, Try again | BUILT | Understand couldn't be opened: title, one sentence, Try again: components/UnderstandViews.tsx:136-149. |
| US-09 | A chapter that couldn’t be opened: one sentence, Try again, Back to Home | BUILT | A chapter that couldn't be opened: Try again, Back to Bible (IA v4's name for Home): app/read/[book]/[chapter].tsx:800-808. |
| US-10 | Yada couldn’t open its text at launch: plain words, Try again, no error code | BUILT | Launch failure: plain words, Try again: app/_layout.tsx:217-236. |
| US-11 | Bookmarks while reading the NKJV: each excerpt is the BSB’s, labelled | BUILT | Bookmarks on the NKJV show the BSB, labelled: app/bookmarks.tsx:54-55, 85. |
| MM-01 | The passage boundary: a hairline draws across, the next passage’s title arrives as an opener | BUILT | Hairline and "Next passage" opener at the boundary: app/read/[book]/[chapter].tsx:1078-1108. |
| MM-02 | Same first words: John 1:1 and Genesis 1:1, set one over the other | BUILT | John 1:1 over Genesis 1:1: components/UnderstandViews.tsx:716-755. |
| MM-03 | The first Greek word tapped: “the Word” in the verse takes the evidence underline, joined for a moment | BUILT | "Word" takes the evidence underline: components/BsbPartner.tsx (WM-01). |
| MM-04 | A word’s footprints: its other uses are ticked in the reader behind the sheet | BUILT | Footprints ticked behind the sheet: app/read/[book]/[chapter].tsx:1069; state/footprints.ts. |
| MM-05 | Back after a gap: “Where you stopped”, the last verse held for two seconds, no day count | BUILT | "Where you stopped", one verse early, held 2 s: app/read/[book]/[chapter].tsx:382-394; app/(tabs)/index.tsx:255, 266-276. |
| MM-06 | A verse kept before: “Kept” and the date under Understand’s title | BUILT | "Kept" and the date under Understand's title: components/UnderstandViews.tsx:129-133. |
| MM-07 | The next chapter’s name in the swipe: John 2 peeks in with its first passage title | BUILT | John 2 peeks with its first passage title: components/ChapterPages.tsx ChapterPeek. |
| MM-08 | The end of a book: its own last verse, set like a quotation, and the way on | BUILT | Merged into RT-04's End page: components/ChapterPages.tsx:70-135. |
| MM-09 | The audio catches up: following resumes where the reader is, with one light tick | BUILT | Following resumes with one light tick: app/read/[book]/[chapter].tsx:581-588. |
| MM-10 | Translations agree: the rows fold into one block | BUILT | Agreeing translations fold into one block: app/evidence/translations.tsx. |
| MM-11 | LORD in small capitals, the first time: the name Yahweh comes first, once per device | BUILT | LORD explained once, Yahweh first: components/UnderstandViews.tsx:685-710. |
| MM-12 | A plan’s last reading: when it was begun, and a sentence from M’Cheyne’s own preface | BUILT | Plan's end: begun date and M'Cheyne's preface: app/mcheyne.tsx:59-69. |

### Passage guide · audio · IA

| Frame | Caption | Status | Where, or what differs |
|---|---|---|---|
| PG-01 | Reader: the passage title opens its guide | BUILT | The passage title opens its guide: app/read/[book]/[chapter].tsx:848-850, 1078-1108. |
| PG-02 | Passage guide, medium: where we are, three things | N/A | Superseded by the No-AI guide (NA-04, JR-05). |
| PG-03 | Guide, large: readers differ, then the text; 1:1 tapped | N/A | Superseded by the No-AI guide (NA-04, JR-05). |
| PG-04 | 1:1 opens its Understand inside the guide | BUILT | A verse's Understand pushes inside the guide: app/guide/verse.tsx; components/UnderstandPages.tsx:193-235. |
| PG-05 | Closer to the Greek: λόγος, one line that expands | N/A | Superseded: "Closer to the Greek" belonged to Three things to notice, removed by NA-04/JR-05. |
| PG-10 | Tap a thing to notice: its evidence is marked in the passage | N/A | Superseded with Three things to notice (NA-04, JR-05). |
| PG-06 | Start here: Next marked in type, with its orientation line | BUILT | Start here: Next marked in type with its orientation line: app/thread.tsx:33-140. |
| PG-07 | Second guide: 1 Corinthians 14:26–40, medium | N/A | Superseded by NA-04 (the 1 Corinthians 14 guide in its No-AI form). |
| PG-08 | 1 Cor guide, large: σιγάω evidence open | N/A | Superseded by NA-04. |
| PG-09 | 1 Cor guide, scrolled: where readers differ, then the text | N/A | Superseded by NA-01/NA-04. |
| AU-01 | Reader at rest: Listen in the bar | BUILT | Listen in the bar at rest: app/read/[book]/[chapter].tsx:1044-1056; components/audio/ReaderBars.tsx:44. |
| AU-02 | Playing: the spoken word in an ink pill, upcoming muted; mini player docked | BUILT | The spoken word in ink, mini player docked: components/audio/Spoken.tsx:26; components/audio/ReaderBars.tsx:142. |
| AU-03 | Playing 1:5, 1:6 selected: Play from 1:6 is one tap; the audio keeps going until then | BUILT | Play from 1:6 on a selection: components/ActionBar.tsx:93-109; app/read/[book]/[chapter].tsx:983-993. |
| AU-04 | Full player: spoken words fill in ink; tap any verse to jump there | BUILT | Full player, tap a verse to jump: app/player.tsx:52, 440-450. |
| AU-05 | Reduce Motion: no smooth scroll, the next verse snaps into place | BUILT | Reduce Motion snaps: app/read/[book]/[chapter].tsx:591. |
| AU-06 | VoiceOver: player order and labels | BUILT | VoiceOver order and labels: app/player.tsx:146-235. |
| AU-07 | First listen on the basic voice: one line, once | N/A | Superseded: the iPhone voice is no longer a choice (Heart/George, John 13 Oct 2026; app/player.tsx:17-20); no first-listen hint exists. |
| IA-01 | Sitemap, before and after (light) | N/A | Sitemap, before and after. |
| IA-02 | Sitemap, before and after (dark) | N/A | Sitemap, dark. |
| IA-03 | Home: where you are in John, the next passage oriented | N/A | Superseded by ON-05/BH-01 (one lead, no "Next in John" row beside Continue). |
| IA-04 | Reader at rest: the passage is the primary action | BUILT | At rest the passage is the primary action: components/ActionBar.tsx:216-254. |
| IA-05 | Verse selected: Understand 1:1, Compare, more; no Original | BUILT | Verse selected: Understand 1:1, Compare, ⋯; no Original: components/ActionBar.tsx:52-209. |
| IA-06 | Search: a passage title finds its guide | MISSING | Search has no Guides group; a passage title such as "The Word became flesh" finds only verses (app/search.tsx:198-348). |
| IA-07 | House style: the first-screen word budget, medium detent | N/A | House-style word-budget annotation for the AI guide, superseded by NA-04. |
| IA-08 | Where readers differ: agreed first, equal parts, no winner | N/A | Superseded by VS-03/NA-05 (Readers differ as source readings, no "Supporters point to"). |
| ON-01 | First launch: Home is the start; one lead, the books below | BUILT | First launch: "Start here · The Gospel of John": app/(tabs)/index.tsx:226-236. |
| ON-02 | Start here opens John 1:1–18 in its guide | BUILT | Start here opens John 1:1–18 with its guide over it: app/(tabs)/index.tsx:185-188; app/read/[book]/[chapter].tsx:401-412. |
| ON-03 | × closes the guide onto the text; the hint shows once | BUILT | × lands on the text with the one-time hint: app/read/[book]/[chapter].tsx:854-859. |
| ON-04 | End of the guide: the next passage is one tap | MISSING | The guide does not end on the next passage. Its last row is Sources (components/PassageGuide.tsx:206-213); the reader's follow hook (state/guide.ts setFollow) is never called by the guide, so "Next · 1:19–34" is one close and a scroll away. |
| ON-05 | Second launch, mid-passage: Continue is the one lead | BUILT | Continue is the one lead mid-passage: app/(tabs)/index.tsx:253-279. |
| ON-07 | Passage finished: the lead becomes Next | BUILT | After a passage, the lead becomes Next: app/(tabs)/index.tsx:238-251. |
| ON-06 | VoiceOver: Home, first launch, order 1–7 | BUILT | VoiceOver order on Bible: app/(tabs)/index.tsx:19-21, 207, 397-403. |
| SN-01 | Understand 1:1 with an entry: Study notes and See also wait in Go further | N/A | Superseded by VS-02 (Study notes in Go deeper; See also question open). |
| SN-09 | Original Greek opens in place; its chevron turns up | BUILT | Original opens in place, chevron turns: components/UnderstandViews.tsx:549-607. |
| SN-02 | Study notes, pushed: the whole note, then the note on 1:1–18 | BUILT | Study notes pushed, the whole note then the passage note: components/StudyLayer.tsx:266-310. |
| SN-03 | John 1:5 has no Yada entry yet: Study notes leads | BUILT | No entry: study notes lead: components/UnderstandViews.tsx:613-655. |
| SN-04 | First open of John, still fetching: one line, nothing to tap | BUILT | Fetching: one line: components/StudyLayer.tsx:136-142. |
| SN-05 | The download failed: one line and Try again | BUILT | Failed: one line and Try again: components/StudyLayer.tsx:143-165. |
| SN-06 | Offline, not downloaded: one quiet line, no error | BUILT | Offline: one quiet line: components/StudyLayer.tsx:165-170. |
| SN-07 | A See also row opens the verse, with a way back | BUILT | A See also row opens the verse with a way back: components/StudyLayer.tsx:437-476. |
| SN-08 | See also, all of them: pushed inside the sheet | BUILT | See also, all of them, pushed: components/UnderstandPages.tsx:237-257. |
| TD-01 | John 3:1: a person named in the verse gets a row | BUILT | A person named in the verse gets a row: components/StudyLayer.tsx:314-346. |
| TD-02 | Nicodemus: the profile pushes inside the sheet; ‹ goes back | BUILT | The profile pushes inside the sheet: components/StudyLayer.tsx:348-400. |
| TD-03 | Search: a name finds the person first, then the verses | BUILT | A name finds the person first: app/search.tsx:220-248. |
| IC-01 | Bookmarks kept in iCloud: one line says so | BUILT | One line on Bookmarks: app/bookmarks.tsx:127. |
| IC-02 | Not signed in to iCloud: on this iPhone only, and how to change it | PARTIAL | Signed out, Bookmarks shows the same line ("…kept in iCloud when you're signed in", app/bookmarks.tsx:127), not "On this iPhone only. Sign in to iCloud in Settings to keep them." |
