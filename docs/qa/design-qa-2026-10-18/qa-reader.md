# Reader area design QA (18 Oct 2026)

Area: the reading screen, verse selection and its bar, chapter swipe, reader header, Text and appearance, Compare,
magic moments, reader edge states. Read-only review; no repo file was changed.

App root for file references: `apps/mobile/src/`. `[chapter].tsx` = `app/read/[book]/[chapter].tsx`.

How judged: newest frame wins (v2 < guide < next < b6 < sys < b7 < b9). The 15 Oct "we go white" polish is applied
to every v2 frame's CSS, so the frames' colours are current. IA v4 (canvas note `ia4_*`, 15 Oct) means every older
frame's `‹ Home` reads as `‹ Bible` (or `‹ Today`); not reported. Build 7 plan §1 puts highlights, notes, Copy in the
bar, Saved and Share as an image in **build 7b**; build 10 plan puts SC-01/05/06 in phase 10d and Learn a verse by
heart in 10c (`git show claude/funny-brahmagupta-a36845:docs/build-10-plan.md`).

## Summary

Frames covered: 118 (every ID in the brief, plus the other frames that draw the reader: PG-01, AU-01-03, DR-02, RP-04,
RT-03, RT-04, SC-01/05, TB-02, listed at the end of the reader tables).

| Status | Count |
|---|---|
| MATCHES | 39 |
| DIFFERS | 42 |
| SUPERSEDED | 23 |
| NOT BUILT | 7 (PS-02, PS-03, PS-04, PS-05, HM-02, HL-01, HL-02) |
| DEFERRED BY DECISION | 1 (VS-06, in part) |
| Out of reader scope, light check | 6 (IA-01/02 diagrams; IA-03, IA-06, DP-01-03 belong to Home and Search) |

Partly unbuilt inside DIFFERS: PS-01's second bar row, the Compare difference marks (CP-01-05), Compare's build 7
YouVersion changes, the VS-04 Manuscripts row, the SW-04 VoiceOver rotor, SC-01's handle (planned build 10d).

### The ten most important differences

1. **Highlights and notes don't exist (PS-01, PS-02, PS-03).** The four colours, the bar's second row (colour
   dots, Note, Copy), the note mark and the Note sheet are all missing. Planned for build 7b. High.
2. **Compare has no difference marks (CP-01, CP-02, CP-04, CP-05).** Changed words should get the wash and
   underline. The app shows plain text with only the one-line summary. High.
3. **Sheet section titles are 13 pt grey labels, not 20 pt bold ink** (`components/Sheet.tsx:303`, `app/type-settings.tsx:116, 141`, `app/search.tsx`).
   This shows on every Understand, guide, Compare, Translations and Search sheet, and on Text and appearance. It is
   the biggest single reason the sheets "don't look like the UI". High.
4. **The verse's ⋯ menu and Play from** (PS-01, HM-02, IA-05). The frames' ⋯ holds Share as an image, Share and
   Bookmark (HM-02 adds Learn this verse); the app's holds Copy, Share and Bookmark. Play from is drawn as a
   `▶ 3:16` pill; the app shows a bare glyph (a 15 Oct decision, but HM-02 on 18 Oct still draws the pill). Medium.
5. **Compare is still the pre-build-7 layout** (CP-01, CP-06). It lacks full version names, the "Add or remove"
   pill at the foot, and Choose with drag-to-reorder. It also has a top Translations row and Back to reading that
   the frames don't. CP-07 labels the BSB "yours"; CP-08's manuscripts row is missing. Medium.
6. **"Next this morning" and "Next in M’Cheyne" at the foot of a chapter** (IA-16, DR-02, RP-04). The frames set the
   title in Literata 26/600; the app uses a plain SF 17/400 list row (`[chapter].tsx:892-912`). Medium.
7. **Understand at AX sizes skips the half view** (VS-07), so More on this verse never appears. The VS-04 Go
   deeper Manuscripts row is missing. Medium.
8. **The passage boundary (MM-01).** The rule is the faint divider colour, not ink at 50%. The 0.4 s draw and the
   haptic are missing. Medium.
9. **Text and appearance (T-01).** Section titles, gap and close button are off, and an extra "Open Understand in
   full" switch is there (refs_vs puts it in Settings). The Light thumbnail still shows the old chalk page. Medium.
10. **VoiceOver chapter actions (SW-04).** The reader has no Next chapter, Previous chapter or Contents actions in
    the rotor. Medium. Also: Understand's Compare row ignores licensed versions, so it names different versions from
    Compare itself (J01-09, `components/UnderstandViews.tsx:507, 623`; a bug).

### NOT BUILT

PS-02 highlights · PS-03 notes · PS-04 Saved · PS-05 Share as an image · HM-02 the ⋯ with Share as an image and Learn
this verse · HL-01, HL-02 large and raised Hebrew letters. Also not built and planned: SC-01/SC-05 book-intro handle
(build 10d); TB-02 iPad (deferred to build 8).

## Headline: the selected verse and highlights (PS-01, PS-02)

What matches: the selection itself. PS-01's `.selg` is the wash `--sel` #EEF3E4 (dark #1C2418), 14 pt radius,
padding 10/14/10/22, a 3 pt accent bar inset 8 pt with 14 pt clear top and bottom. `components/Verse.tsx:246-268`
draws exactly that (RADIUS.wash 14, WASH_INSET 14 + BAR_LEFT 8, bar top/bottom 14, palette.selection #EEF3E4 /
#1C2418, palette.accent). Verse type (Literata 21/1.6, numbers SF 12/600 muted) matches too.

What does not exist anywhere in the app: everything else PS-01 and PS-02 draw.

- No highlights. PS-02 draws four highlight washes (light yellow #FBEFA6, green #D6F0C8, blue #CFE5F8, pink #F7D7E5;
  dark #4B4420, #21401F, #1D3448, #48283A), 10 pt radius, 4/8 pt padding bleeding 8 pt past the text, the verse number
  in ink at 80%. `design/palette.ts:18-46` has no highlight colours (its `highlight` #DBEC9A is Compare's difference
  mark), `components/Verse.tsx` has no highlight prop, `data/user.ts` has no highlights table. Grep for
  "highlight" in app code finds only Compare and search.
- No second row in the bar. PS-01 (and HM-02, 18 Oct) draw row 2 under Play from / Understand / Compare / ⋯: a
  grey pill holding four 44 pt colour dots (28 pt swatches with a 1 px inner ring), then `Note` and `Copy` pills
  (52 pt, 15/600, icon + word). `components/ActionBar.tsx:190-207` draws one row only.
- No notes. PS-02's note mark (accent, 24 pt with a 44 pt hit area, after the verse number) and PS-03's Note sheet do
  not exist.
- Copy is in the wrong place. PS-01 moves Copy out of ⋯ into row 2; ⋯ holds Share as an image, Share, Bookmark (HM-02
  adds Learn this verse). App ⋯ = Copy, Share, Bookmark (`lib/reader.ts:137-140`, `components/ActionBar.tsx:44-50`).
- Play from: PS-01, IA-05, AU-03 and HM-02 draw a grey pill `▶ 3:16` (`.selp .pfh`: icon and the verse). The app
  draws the glyph alone in a 48 pt circle (`components/ActionBar.tsx:93-109`), by a 15 Oct UX-pass decision recorded in
  the comment there. The newest frame (HM-02) still draws the label: John should pick one.

## Per-frame tables

Frames in the Understand, Compare, licensed and edge-state groups were reviewed by two helper passes against the same
rules; their file:line citations were not all re-checked by hand.

### Your space and the verse's ⋯ (build 7 page, HM-02 build 10 page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| PS-01 Select a verse: four colours, Note, Copy | DIFFERS (row 2 NOT BUILT) | Selection wash and bar match (`components/Verse.tsx:246-268`). Missing: row 2 (colour dots, Note, Copy) under the bar (`components/ActionBar.tsx:190-207` one row); ⋯ holds Copy instead of Share as an image (`lib/reader.ts:137-140`); Play from is a glyph circle, frame a `▶ 3:16` pill (`ActionBar.tsx:93-109`). AX5 frame list: Understand, colour dots, Note, Copy, More; app AX list: Understand, Play from, More (with Compare in More). Planned build 7b (build-7-plan.md §1 item 6). | high |
| PS-02 Highlights as a soft wash, note mark | NOT BUILT | No highlight colours in `design/palette.ts`, no highlight or note state on `Verse` (`components/Verse.tsx:100-147`), no storage in `data/user.ts`. Frame: 4 washes, 10 pt radius, number in ink 80%, accent note glyph after the number with a 44 pt target; VoiceOver "verse 16, highlighted yellow". | high |
| PS-03 Note on the verse or the whole chapter | NOT BUILT | No Note sheet (title "Note" + reference, the verse quoted muted, two-way switch "John 3:16 / All of John 3", editor on the card fill, "Kept on this iPhone and in your iCloud. Only you see it."). | high |
| PS-04 Saved | NOT BUILT | `app/bookmarks.tsx` is still Bookmarks (B-01/B-02). Frame: page title "Saved", 4-way segment Highlights / Notes / Bookmarks / Images, "Your reading" row on top, colour bar (6 pt, saturated swatch) beside each excerpt, ⋯ Export in the header. | medium |
| PS-05 Share as an image | NOT BUILT | No "Share as an image" anywhere (grep). Frame: sheet with a 300 pt square card (picture, verse in Literata 17 over a dark fade, "John 3:16 · BSB"), four backgrounds (day's picture, evening picture, white, dark), Save to Photos + Share. | medium |
| HM-02 A selected verse's ⋯ | NOT BUILT | Frame ⋯ menu: Share as an image, Share, Bookmark, Learn this verse, over the two-row PS-01 bar. App ⋯: Copy, Share, Bookmark (`lib/reader.ts:137-140`). Learn this verse is build 10c; Share as an image build 7b. | medium |

### Reader at rest, selected, header (v2 journeys, IA, guide page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| J01-01 Reader, 1 Cor 14:33–38 | MATCHES (footer SUPERSEDED) | Text, numbers, header match. Frame footer = prev/next chapter capsules + "Berean Standard Bible"; app shows RT-03's calm close card instead and hides both links (`[chapter].tsx:914-931`), which RT-03 (build 10) supersedes. Frame's note glyph after every explained verse: app shows it only where readers differ (`components/Verse.tsx:176-183`, citing VS-03); HM-02 (newest) still draws it on Psalm 23:1, so this is unresolved. | low |
| J01-02 Verse 34 selected | SUPERSEDED by IA-05 / PS-01 | v2 bar was two rows (Understand full width; Original, Compare, ⋯). App follows IA-05. | n/a |
| J01-11 Reader at 1 Tim 2:11, return chip | MATCHES | `‹ 1 Cor 14:34` via `lib/reader.ts shortRef`, `[chapter].tsx:734`. | n/a |
| J01-14 Back to reading at 14:34 | MATCHES (bar SUPERSEDED) | Selection kept under the sheet. Bar per IA-05. | n/a |
| J01-15 1 Tim 2:11 selected, no explanation | MATCHES | Original + Compare (word) + ⋯ when no entry (`lib/reader.ts:131-134`, `ActionBar.tsx:147-159`). | n/a |
| JN-01 First launch: John 1, hint line | MATCHES | "Tap a verse to see what it meant." 13 pt muted; app puts it under the passage title per ON-03 (`[chapter].tsx:854-859`). | n/a |
| JN-02 1:1 selected | SUPERSEDED by IA-05 | Selection matches; bar per IA-05. | n/a |
| GN-01 Genesis 1, 1:1 selected | SUPERSEDED by IA-05 | Same. Note: the chapter numeral at AX5 is 110 pt in every frame (`.ax5 .cn`); the app fixes it at 3.2 x 21 = 67 pt with scaling off (`components/Verse.tsx:340, 348-349`). | low |
| E-01 Long book name, long return chip | MATCHES | Off-centre title rather than truncation; two rows from AX3 (`components/ReaderHeader.tsx:60-68, 159-166`). | n/a |
| E-02 Longest verse selected (Esther 8:9) | MATCHES | Opening words kept below the header (`lib/reader.ts scrollToClearBar`). Bar per IA-05 (Original kept when no entry). | n/a |
| E-03 Last chapter of the Bible | SUPERSEDED by RT-03 / RT-04 | Frame: only "Revelation 21" link. Build 10 decision "After Revelation, a card to Psalms"; app does that (`components/ChapterPages.tsx:70-134`). | n/a |
| E-06 Increase Contrast | MATCHES | `design/palette.ts:88-102` firms muted and divider; frame values are pre-polish green greys, app's are the neutral equivalents. The sheet in the frame is the old Understand (VS supersedes). | n/a |
| IA-04 Reader at rest | MATCHES | `Understand 1:1–18` ink pill + 48 pt Listen circle (`ActionBar.tsx:216-254`, `components/audio/ReaderBars.tsx:44-70`); title button above verse 1. | n/a |
| IA-05 Verse selected, no Original | DIFFERS | Bar layout matches (Play from, Understand, Compare glyph, ⋯) except Play from: frame `▶ 1:1` pill, app glyph only (`ActionBar.tsx:93-109`). VoiceOver actions on the verse still offer "Original" (`components/Verse.tsx:224-231`), which IA-05 removed from the bar. | low |
| IA-16 Reader covers the tabs; chip names the tab | DIFFERS | Chip `‹ Today` matches (`app/(tabs)/today.tsx:32`). Footer "Next this morning / Psalm 2": frame `.lead` with the title in Literata 26/600 and a 13/600 muted label; app uses a plain `ListRow`, title SF 17/400, label 13/500 (`[chapter].tsx:892-899`, `components/Page.tsx:237-260`). Same for "Next in M’Cheyne" (RP-04, `[chapter].tsx:901-912`). | medium |
| PG-01 (guide page) Passage title opens its guide | MATCHES | Literata 19/600 ink + 16 pt chevron, 44 pt (`[chapter].tsx:1078-1108, 1177-1191`). | n/a |
| DP-04 Chapter opening: John 1 | SUPERSEDED by PG-01 | v2 small-caps muted title above verse 1; now a title button. App keeps small caps only when a chapter opens mid-passage (`[chapter].tsx:179-182, 825-836`). | n/a |
| DP-05 Chapter opening: Genesis 1 | SUPERSEDED by PG-01 | As DP-04. | n/a |
| T-01 Text size and appearance | DIFFERS | Section titles: polish makes sheet section titles 20 pt bold ink (`.sheet .sec > .lbl`); app uses the 13 pt grey `Label` for "Text size" and "Appearance" (`app/type-settings.tsx:116, 141`). Section gap: frame 40 pt (`--secgap`), app 24/28 (`type-settings.tsx:116, 141`). Close: polish draws a paper circle with a 1 px ring; app a grey fill circle (`type-settings.tsx:92`). Extra row not in the frame: "Open Understand in full" switch (`type-settings.tsx:209-214`); refs_vs puts it in Settings. Thumbnails still use the old chalk #F7F8F0 / #0E1814 (`type-settings.tsx:30-34`); the frame does too, but the app is white now, so the Light tile no longer previews the Light page. | medium |

### Chapter swipe (next page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| SW-01 John 2 peeks in from the right | DIFFERS | Whole page moves with the header, hairline edge (`components/ChapterSwipe.tsx:117-136`) match. The peeking page in the frame is a full reader page: its own glass header (‹ back, "John 2 / BSB", Aa) and verse 1 with the large chapter numeral. App peek (`components/ChapterPages.tsx:29-59`) draws a plain centred "John 2" in 17/600 with no controls, and verse 1 with a small "1" instead of the numeral. Frame edge also has a soft shadow (`-18px 0 40px rgba(0,0,0,.10)`); app hairline only. | low |
| SW-02 Past a third it goes on | MATCHES | `COMMIT_SHARE = 1/3`, spring back, one light impact at commit (`ChapterSwipe.tsx:20-26, 93-115`). | n/a |
| SW-03 End of a book | SUPERSEDED by RT-04 | Frame "End of John · 21 chapters · Acts 1"; RT-04 (build 10, merges MM-08) is built (`components/ChapterPages.tsx:70-134`). | n/a |
| SW-04 Swiping off; other ways to turn the page | DIFFERS | Off while a verse is selected, under VoiceOver and Reduce Motion cross-fade: built (`[chapter].tsx:746-748`, `ChapterSwipe.tsx:100-104`). Missing: the AX5 column's VoiceOver Actions rotor on the reader ("Next chapter, John 2", "Previous chapter, Luke 24", "Contents"); `[chapter].tsx` defines no screen-level `accessibilityActions`. VoiceOver users get only the footer links. | medium |

### Magic moments (next page; MM-03, MM-06, MM-11 sit in Understand, see that section)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| MM-01 Passage boundary | DIFFERS | Frame: a 1 px rule in ink at 50% opacity, 22 pt above and 14 below, then "Next" (13/600 muted) on the same line as the title (`.nextop`, nowrap). App: hairline in `palette.divider` #E9E9E7 (far fainter), 10 pt above and 18 below, and "Next passage" on its own line above (`[chapter].tsx:1091-1099`). The line placement and copy follow John's 12 Oct call in the comment there; the colour does not. The notes' 0.4 s draw-across and one soft haptic per passage are not built (static line; `finishBefore` at `[chapter].tsx:217-235` fires no haptic). | medium |
| MM-02 Same first words | MATCHES (not checked in detail) | Built inside Understand (`components/UnderstandViews.tsx:714-750`, `lib/sameWords.ts`): "John and Genesis open with the same words in the BSB." | n/a |
| MM-04 A word's footprints | MATCHES | Ink tick 10 x 2 in the margin (`components/Verse.tsx:260, 432`); frame offset -18 vs app -14, negligible. | low |
| MM-05 Back after a gap | MATCHES | "Where you stopped" on Home; reader holds the verse two seconds (`[chapter].tsx:382-394`). | n/a |
| MM-07 John 2's first passage in the peek | DIFFERS | Frame: the passage title as the small-caps muted opener (Literata 17, `.opener.chop`) above the numeral. App: Literata 19/600 ink (`components/ChapterPages.tsx:46-50, 138`), plus the header differences in SW-01. | low |
| MM-08 End of a book, quotation | SUPERSEDED by RT-04 | Build 10 plan: "delete MM-08 from the canvas". | n/a |
| MM-09 Audio catches up | MATCHES | "Following again", light tick (`[chapter].tsx:578-598, 1006-1007`). | n/a |
| MM-12 A plan's last reading | MATCHES | Begun date, the preface sentence, "Start again from reading 1" (`app/mcheyne.tsx:63-72`). | n/a |

### Psalms and prophets in the reader, and their sheets (next page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| JR-01 Psalm 51 with the tip | DIFFERS (minor) | Order and copy match (`components/ReaderLeads.tsx:69-101`, `[chapter].tsx:822, 847-853`). Frame closes the tip with a hairline rule under it (`.ptip`: 14 pt padding, 1 px rule, 18 pt gap); app has no rule, just a 28 pt gap (`ReaderLeads.tsx:77`). | low |
| JR-02 Psalm 51 after | MATCHES | Two lines 13 pt muted, "About this psalm" pill, superscription italic (`ReaderLeads.tsx:42-67`, `components/Verse.tsx:270-283`). | n/a |
| JR-03 About this psalm | DIFFERS | Built (`app/guide/about.tsx`). Its section titles (Title, The picture, How it moves, Sources) use `Section` = the 13 pt grey label (`components/Sheet.tsx:299-310`); polish says 20 pt bold ink in sheets. | medium |
| JR-04 Isaiah 40: section in plain words | MATCHES | `ProphetLeadLines` 13/600 muted + 13 muted line above the title (`ReaderLeads.tsx:25-40`). | n/a |
| JR-05 Isaiah 40:1–5 guide | DIFFERS | Slots In short, Read it alongside, More, Sources built (`components/PassageGuide.tsx:150-211`); same 13 pt grey section titles as JR-03. | medium |
| JR-07 A major debate | DIFFERS | Same slots; Readers differ absent until approved, as drawn. Same section-title issue. | medium |
| HL-01 Deuteronomy 6:4 large letters | NOT BUILT | No large/small/raised letter handling (grep "x-large", "suspended"); refs_hl says it needs a bundle column. | low |
| HL-02 Judges 18:30 raised letter | NOT BUILT | As HL-01. | low |

### Sitemaps, Home and Search frames listed for this area (light check only)

| Frame | Status | Note | Sev |
|---|---|---|---|
| IA-01, IA-02 Sitemaps | n/a (diagram) | The "after" map is what the reader implements: title button above verse 1, bar at rest `Understand 1:1–18 · Listen`, verse Understand pushed inside the guide. | n/a |
| IA-03 Home | SUPERSEDED in part by IA v4 / Bible tab | Home lives in `app/(tabs)/index.tsx`; the Home reviewer owns it. Its Continue lead and "N of 46 passages read" are built. | n/a |
| IA-06 Search | out of reader scope | Search reviewer. | n/a |
| DP-01, DP-02 Home, DP-03 Start here | out of reader scope | Home reviewer; cover word under the lead built (`components/Cover.tsx`). | n/a |

### Other frames that draw the reader

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| AU-01 Reader at rest: Listen in the bar | MATCHES | As IA-04. | n/a |
| AU-02 Playing, mini player | MATCHES BY DECISION | Frame detail "Verse 5 · BSB"; app shows the playing verse's words (John, 15 Oct; `[chapter].tsx:1008-1010`). | n/a |
| AU-03 Play from 1:6 | DIFFERS | Play from pill label, as IA-05. | low |
| DR-02 Next psalm in the set | DIFFERS | As IA-16: Literata 26/600 lead drawn, SF 17/400 row built. | medium |
| RP-04 Next in M’Cheyne | DIFFERS | As IA-16. | medium |
| RT-03 Calm close | MATCHES | `components/ChapterClose.tsx` (forest card 24 pt radius, Literata 26/600 title, 17 pt verse). | n/a |
| RT-04 End of a book | MATCHES | `components/ChapterPages.tsx:70-134`. | n/a |
| SC-01 / SC-05 Book introduction as a handle | NOT BUILT (planned 10d) | App still prints the whole introduction paragraph above chapter 1's first passage (`components/BookIntro.tsx:18-34`, IG-01 build 6). SC-01: nothing above the first passage; an "About John" handle above the home indicator that opens a sheet. | medium |
| TB-02 iPad reader | DEFERRED BY DECISION | build-7-plan.md: "iPad, the iPhone Duo open layout ... wait for build 8". | n/a |

### Understand verse sheet (VS, next page) and the v2 Understand screens

Decided, not reported: title "John 3:16" without "· Understand"; no source codes in headings; "More on this verse" with ⌄;
the added-words tip as a muted line; the 15 Oct colours.

Applies to every sheet (Understand, word, evidence, guide, About this psalm, Compare, Translations, Search):
section titles are still 13 pt grey semibold labels. `Section` (`components/Sheet.tsx:299-310`) renders `Label`
(`design/type.ts:48`: 13/600 muted, 6 pt below). The polish sets 20 pt bold ink, tracking -0.4, 8 pt below (frame rules
932-933; polish-2026-10-15.md "22 pt bold sans in ink (20 pt in sheets)"). `SectionTitle` exists (`components/Type.tsx:222`)
but only Today and Rhythm use it. **High.** Also low, everywhere: round × and ‹ are grey fills (`components/Sheet.tsx:164`);
polish draws white circles with a 1 px ring (rule 942). Sheet radius 38 (`app/_layout.tsx:262`) vs 36.

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| VS-01 John 3:16 half view | DIFFERS | Section titles (above). "More on this verse" weight 500 (`components/UnderstandViews.tsx:288`), frame 600. Hear this passage above it comes from UL-01 (newer). Plain line alone over 30 words: matches. | high / low |
| VS-02 John 3:16 full view | DIFFERS | Full view always repeats the verse at the top (`UnderstandViews.tsx:168-173`); VS-02/04/06 don't (only VS-07 at AX5). Adds Explained, People and places, Check what you read (`:431-445`), not in any VS frame (Explained and Check are in docs/no-ai-understand.md). Original row note lacks "· evidence marks (MACULA)" (`lib/goFurther.ts:7-11`) and opens in place with ⌄ (`:563-578`) where the frame has a › row. Readers differ: rule only between entries (`:455`), frame a rule under each. Read it alongside rows 44 pt / weight 500 (`:423-427`), frame 56 pt hairline weight 400. | low-medium |
| VS-03 1 Cor 14:34 half view | MATCHES | Order matches. One way to read it is Literata 16 (`:318, 333`), frame 17. | low |
| VS-04 1 Cor 14:34 full view | DIFFERS | Go deeper "Manuscripts · What the manuscripts differ on" row and its page are not built (`GoDeeper`, `UnderstandViews.tsx:502-546`); fixed order is Original, Compare, Study notes, Key words, Manuscripts, Sources. | medium |
| VS-05 Isaiah 7:14 half view | MATCHES | | n/a |
| VS-06 Isaiah 7:14 full view | DEFERRED BY DECISION (part) | JPS 1917 held behind `OT_ONLY` (`lib/sources.ts:125-130`). Rest matches. | low |
| VS-07 Verse low on screen at AX5 | DIFFERS | App skips the half view at AX sizes (`UnderstandViews.tsx:96, 122`; `app/_layout.tsx:308` opens large); frame shows the half view (repeated verse, plain line, More on this verse) first. AX5 readers never see More on this verse. | medium |
| J01-03, J01-04, J01-05, J01-09, J01-12, J01-13, JN-03, JN-07, GN-02 | SUPERSEDED | AI Understand, claims, evidence and passage Understand retired by the no-AI decision; replaced by VS, NA, the passage guide and CP (build-plan-next-release.md "Superseded frames"). | n/a |
| J01-06, JN-04, GN-03 Original expanded | DIFFERS | Interlinear gaps 16 rows / 10 words (`components/OriginalWords.tsx:167-168`), newest rule 6 / 14. Caption "Glosses: STEPBible (TAGNT, …)" vs "Glosses: STEPBible". Hebrew right-to-left matches. | low |
| J01-07, JN-05, GN-04 Word card | MATCHES | Plus newer In the BSB, grammar terms, "N in the Bible". Form and Dictionary form 40 pt apart (`app/evidence/word.tsx:102, 151`), frame 14. | low |
| J01-08, GN-05 Occurrences | DIFFERS | The English word is not bold in each verse (`app/evidence/occurrences.tsx:140-142`); the BSB word links built for MM-03 now provide the data. | low |
| J01-10 Peek 1 Timothy 2 | MATCHES | Pill margin 20 (`app/evidence/peek.tsx:149`), frame 8. | low |
| DP-06 Word card headword | MATCHES | | n/a |
| IA-07 Word budget, IA-08 Where readers differ | SUPERSEDED | No-AI decision (refs_na, 12 Oct). | n/a |
| MM-03 First Greek word tapped | DIFFERS | Built as WM-01-04. Hairline at a fixed 40% offset (`components/BsbPartner.tsx:109`), not joined to the word; the "λόγος · logos · 'Word'" caption is not built; the interlinear sits in Go deeper; its mark clears when the card closes (`word.tsx:55`). | low |
| MM-06 A kept verse | MATCHES | "Kept 12 Oct" under the title (`UnderstandViews.tsx:130-133`). | n/a |
| MM-11 LORD in small capitals | DIFFERS | No "Key words" heading over the Yahweh row (`UnderstandViews.tsx:695-707`). | low |

### Compare (next page)

Build 7 item 11 (Compare after YouVersion: full names, Add or remove at the foot, drag to reorder) is still to build.

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| CP-01 The bar's Compare opens Compare | DIFFERS | The bar opens Compare directly (`[chapter].tsx:662-665`): matches. 1) No difference marks: frame gives each changed word the wash + 1.5 px muted underline (`.df`); app draws plain text via `DivineText` (`app/evidence/translations.tsx:147-149`), only the one-line summary shows the change. 2) No full version name on the right of each block; code only (`:132-137`). 3) Frame pins an "Add or remove" grey pill (48 pt, 600) at the foot, no top row, no Back to reading; app has a "Translations · BSB · WEB · KJV · LSV" row on top (`:68-78`) and the Back to reading capsule (`components/Sheet.tsx:78, 260`, footer defaults true). 4) Frame: hairline between blocks, names 13/600 ink, yours Literata 18 and others 16; app 18 pt gap, muted Label, all 17. | high (1), medium (2-3), low (4) |
| CP-02 John 3:16 | DIFFERS | Change lines built (`lib/diff.ts`); marks, full names and foot control missing as CP-01. | high |
| CP-03 When they agree | DIFFERS | Frame "All four say the same." then names then the verse with a left rule; app follows MM-10 ("… agree here.", `translations.tsx:98-109`). The two frames conflict. | low |
| CP-04 1 Cor 14:34 | DIFFERS | "Worded differently throughout" built (`lib/diff.ts:52, 117`); the marks, the point of the frame, are missing. | high |
| CP-05 Several verses | DIFFERS | Verse-by-verse with "1:3" labels built (`translations.tsx:119-124`); marks, names, foot control missing. | medium |
| CP-06 Choose inside Compare | DIFFERS | No chosen-first list with drag handles; fixed order and `compareSelection` ignores saved order (`app/evidence/choose.tsx:30-31, 56`; `lib/compare.ts:15-19`). Subtitle "Compare with up to 3" vs "Up to 3, in your order" (`choose.tsx:55`). Back to reading shown from Compare (`choose.tsx:55`). | medium |
| CP-07 Reading the NKJV | DIFFERS | When the NKJV can't load the BSB block is labelled "BSB · yours" (`translations.tsx:88, 132`); frame keeps NKJV as yours. The sentence (`:114-117`) matches. | medium |
| CP-08 Your version lacks the verse | DIFFERS | "Not in the BSB." built (`lib/translations.ts:166-169`); the "Why: not in the oldest manuscripts ›" row is missing (`translations.tsx:142-145`). | medium |
| CP-09 The Message | MATCHES | Apart from the CP-01 items. | n/a |
| MM-10 Translations agree | DIFFERS | Frame title "John 11:35 · Compare", short sheet, 13 pt line; app title "Compare", Translations row above, 16 pt line (`translations.tsx:105`). | low |
| JN-06 All three agree | SUPERSEDED by CP-03 / MM-10 | | n/a |
| J01-09 (Compare row only) | DIFFERS | Row says "Compare" with codes, frame "Compare translations" (`components/UnderstandViews.tsx:513-521, 629-634`). Bug: the row lists only built-in and downloaded versions (`:507, 623`) while Compare includes licensed ones (`app/evidence/translations.tsx:47`), so a reader who chose the NKJV sees "WEB · KJV · LSV" on the row and the NKJV inside (build-6 decision 9: the pickers must agree). | medium |

### Licensed translations (next page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| LT-01 Translations | DIFFERS | Header left is "Choose" instead of ‹ Back (`app/translations.tsx:112-126, 208`): no way back to Contents and a second Compare picker the CP redesign moved into Compare. Online line "Needs a connection." vs "Needs a connection. Not read aloud." (`:286`). The Message line "NavPress" vs "A paraphrase · NavPress" (`data/online.ts:42`). 13 pt section titles. | medium / low |
| LT-02 Reading John 1 in the NKJV | MATCHES (Listen SUPERSEDED) | Notice under the text verbatim (`[chapter].tsx:936-941`). Listen now plays the BSB (build-6 decision 2, EG-03). | n/a |
| LT-03 Offline and not saved | DIFFERS | Frame sentence Literata 22 (`.empty`), 40 pt top; app 17 pt explanation, 32 pt (`[chapter].tsx:1144-1147`). Pill text 500, polish 600 (`:1137-1140`). | low |
| LT-04 Share from the NKJV | MATCHES | App writes "— John 1:1, NKJV", frame without the dash (`[chapter].tsx:652`). | low |
| LT-05 Share from The Message | MATCHES | | n/a |

### States nobody drew (US, next page)

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| US-01 Voice help | SUPERSEDED BY DECISION | 13 Oct voice decision (`app/player.tsx:17-20`). | n/a |
| US-02 Book with no passages | DIFFERS | Frame keeps Guide, off ("Mark has no passage guides yet"); app leaves an empty slot (`player.tsx:216-217`). | low |
| US-03 Next while paused | MATCHES | | n/a |
| US-04 End of a book while listening | MATCHES | | n/a |
| US-05 Translation download failed | DIFFERS | Try again is accent text; frame a grey pill (`translations.tsx:246-251`). | low |
| US-06 Not enough space | MATCHES | | n/a |
| US-07 Licensed chapter didn't load | MATCHES | Type sizes as LT-03. | low |
| US-08 Understand couldn't open | DIFFERS | Frame title "John 1:5 · Understand", ink sentence, Try again pill; app title + "Understand" subtitle, muted sentence, accent text Try again (`components/UnderstandViews.tsx:136-149`). | low |
| US-09 Chapter couldn't be opened | MATCHES | "Back to Bible" per IA v4 (`[chapter].tsx:801-808`). Type sizes as LT-03. | low |
| US-10 Couldn't open text at launch | DIFFERS | Frame left-aligned Literata 22; app centred SF 17 semibold (`app/_layout.tsx:219-234`). | low |
| US-11 Bookmarks on the NKJV | MATCHES | Small bug: `DivineText translation={translation}` passes NKJV for BSB text (`app/bookmarks.tsx:113`). | low |

### Edge states (EG, next page) and E-04, E-05

| Frame | Status | Differences (frame vs app) | Sev |
|---|---|---|---|
| EG-01 Flagged summary held back | SUPERSEDED (behaviour built) | Held back in the schema (`packages/schema/src/understand.ts:211`); layout replaced by the guide's slots. | n/a |
| EG-02 Understand offline before Luke's bundle | DIFFERS | Frame "Understand for Luke downloads when you're online."; app shows "Getting Understand for Luke." only while fetching (`UnderstandViews.tsx:639-642`) and nothing offline (`data/understand.ts:69-71`). Row "Compare" vs "Compare translations". | medium |
| EG-03 Listening on the NKJV | MATCHES | `[chapter].tsx:1017-1021`. | n/a |
| EG-04 Swipe into an unsaved licensed chapter | DIFFERS | The peek shows BSB verses with no "BSB" label under an NKJV reader (`components/ChapterPages.tsx:35-56`); refs_eg says peeks are labelled BSB. | low-medium |
| EG-05 Widget before anything is read | DIFFERS | App widget "Continue · Open Yada to start reading." (`targets/widget/Widgets.swift:222-224`); frame "Start here · The Gospel of John · One passage at a time, explained." (may be overtaken by the build 7 widget). | medium |
| EG-06 Search on the NKJV | DIFFERS | "… with Words" vs "… with Words and Dictionary" (`app/search.tsx:295`). | low |
| EG-07 Search on the NKJV offline | MATCHES | | low |
| E-04 Search: no results | MATCHES | Frame Literata 22, app 17 (`search.tsx:340-346`). | low |
| E-05 Recent, empty | MATCHES | `app/recent.tsx:72-80, 120-125`. | n/a |
