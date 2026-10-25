# Build 12 QA

Checked in the simulator (iPhone 17 Pro, Release build) against the Build 12 canvas,
https://claude.ai/artifact/K7W4ov2ti3cY2csqgXCb1h, in Light, Dark and AX5.

## 12a Design system (24 Oct 2026)

| Item | State | Checked |
|---|---|---|
| Tokens: four tints, `raised`, `raisedShadow`, `BADGE` | built | Light and Dark tints on Pray |
| Lighter floating-chrome shadow (`GlassSurface`) | built | tab bar, + Prayer |
| Icons: sit, play, pin, person | built | Sit tile shows the new glyph |
| `ListRow` `leading` and `action` | built | first screen use is 12c (PR-51), 12b (SW-02) |
| `SectionTitle` `link` | built | first screen use is 12c, 12d |
| `TintTile` replaces Pray's `Way` tiles | built | PR-50 tiles: Light, Dark, AX5 (stacked full width) |
| `PictureTile` replaces the mood chips | built | PR-50 moods: Light, Dark, AX5. QA found the photo inset by the tile padding; fixed |
| `pictureFor(day or fixed day, part)`; each mood keeps its day (14, 7, 13, 24, 10, 16) | built | moods show their fixed pictures |
| `Badge` replaces CircleCover's "N new" | built | not seen yet: needs iCloud and a circle where someone else has asked. Check on TestFlight in 12f |
| `StatTile` replaces Your rhythm's lead number | built | YO-30, with "Days this year" first, a departure from the frame decided 24 Oct 2026: a number that only grows leads (RT-02), as a run that restarts at 1 reads as a reset |
| `EmptyState` replaces Your list's empty line | built | EM-01. To check on a fresh simulator with 12b's QA (the QA phone's list has two people) |
| `RaisedCard`, `VerseActions`, `FilterPills` | built | first screen use is 12c (PR-51), 12d (TD-30), 12b (SW-02) |
| design/system.test.ts: shadow only through RaisedCard; tints only from the palette | built | passing |

Fixed in passing: at AX5 the tab bar broke "Today" over two lines ("Toda / y"). The label now stays under its glyph on
one line at AX sizes, as iOS keeps its own tab labels (components/TabBar.tsx). Recheck with 12b's QA.

## 12b Sit with a verse (24 Oct 2026)

| Frame | State | Checked |
|---|---|---|
| SW-01 setup | built: `app/sit/index.tsx` (replaces `app/sit.tsx`, the page of four steps) | Light, AX5. QA found the length switch leaving "15 min" alone on a second row at AX5; the three lengths now share one line |
| SW-02 choose a verse | built: `app/sit/choose.tsx`, `lib/sitChoices.ts`, `data/sitChoices.ts` | Light: Saved first with swatches and Sit pills; the chosen verse returns to the setup |
| SW-03 breathe | built: `app/sit/session.tsx` | Light, AX5 (smaller ring). Orb, count, next breath, Pause, Skip |
| SW-04 hear it read | built | Light: each word lit in lime as it is read |
| SW-05 quiet | built | Light: time left counts down; Pause stops it. QA found a skip while paused carried the pause into the next part; fixed |
| SW-06 Amen | built: `app/sit/amen.tsx`, `data/user.ts` `keepWord` | Light: the day counts, a tapped word is kept in the verse's note, Done closes Sit back to Pray. QA found the status bar white on paper and the words spaced wider than the frame; both fixed |
| PR-50's Sit tile reads "5–15 min" | built | |

Doors: Pray's tile, Today's verse, a mood's passage and the reader's ⋯ open the new setup with their verse.
Not yet checked: Dark for SW-02 and SW-06 (both drawn from palette tokens; the other four sit on the picture in both
themes), VoiceOver order. Sit still reads with the iPhone voice: Heart replaces it in 12g.

## Heart everywhere, the iPhone voice gone (24 Oct 2026, brought forward from 12g)

John: "switch to heart voice but also did we do for every other surface?" Every place that spoke:

| Surface | Before | Now |
|---|---|---|
| Sit with a verse (SW-04, hear it again) | iPhone voice (`Speech.speak`) | Heart or George from the verse's chapter recording, words lit from its timings (`data/sitVoice.ts`, `lib/sitVoice.ts`). Checked: Isaiah 41:17 lit word by word |
| Reader's Listen, Play from, the player, mini player, lock screen | Heart; the iPhone voice when offline, a stream failed or a verse's timings didn't fit | Heart only. Offline or a failed load pauses and opens LS-31; a verse whose timings don't fit plays unlit. Checked: John 3 plays in Heart |
| Today's Listen, Hear this passage, the day's verse, Bible prayers' Listen | through the reader's player, so as above | as above |
| A chapter's name between chapters | the recording's titles file, else the iPhone voice | the titles file, else straight to verse 1 |
| Voice sheet and player line | could say "iPhone voice" | Heart or George only |

Removed (replace, don't layer): `Speech.speak`, `voice`, Personal Voice and the synthesizer in `modules/yada-speech`
(545 to 321 lines of Swift), `lib/audio/cadence.ts` and `rateFor`, the store's `voice` and `voiceNote`. The breath
haptics, rain, Now Playing and remote commands stay.

New: LS-31 (`app/listen-unavailable.tsx`): "You're offline", Heart can read the book once it's downloaded with its
size, Download when online (starts on the network's own event, no polling) and Not now; or "This reading didn't load"
with Try again. Sit offline reads in silence with one line saying why. Tested in `recordings.test.ts`; not yet seen in
the simulator, which has no way to go offline here.

## 12c Pray (24 Oct 2026)

| Frame | State | Checked |
|---|---|---|
| PR-50 the office with Begin; ways on tints; moods as picture tiles | built (`(tabs)/pray/index.tsx`); the office card says "Afternoon prayer" from noon to five (decision 4, `officeName`) | Light, Dark, AX5 |
| PR-51 People as rows | built: Your list (lock), each circle (avatar stack, lime "N new", Pray), Everyone on Yada (globe), New circle; Pray prays through that list or circle (`through.tsx` `scope`) | Light, Dark, AX5 for Your list and Everyone. QA found the Pray pill squeezing the words at AX5; at AX sizes it now sits under them (`ListRow`). Circle rows not seen (below) |
| PR-51 Your requests as raised cards | built (`components/pray/RequestCard.tsx`, newest two on Pray, all on Everyone on Yada with ⋯ for Renew and Delete) | not seen: no requests on the QA account |
| EM-01 | built on Your list and Your requests. QA found Your requests calling a failed load "Nothing asked yet", the empty line repeating the page's subtitle, and Ask shown twice; all fixed | Light |
| PF-30 to PF-32 | built (`pray/through.tsx`, `lib/prayThrough.ts`): evening picture blurred, a segment per person, who and what they'll see, Prayed and Next; Amen with the day counted and who you prayed for by place | Light: Your list, two prayed, Amen, Done back to Pray. Circle and public turns not seen (below) |

Departures, for John:
- For when you're has no See all: all six moods are already in the row, and there is no page of moods to open.
- People has no See all: every place is a row already, and New circle (the circle covers' last tile) is a row too.
- Your requests on Pray are the ones asked of everyone; a request asked in a circle stays on that circle's page,
  where it already shows with how many prayed (CircleRequest has no date to order it by).
- A circle row's Pray prays through that circle's requests one by one (`through.tsx`), not the single hold screen.
- The circle page's empty state stays as built in Build 11 (the ring of people and a docked Ask or Invite): EM-01
  there would add a second button for the same thing.

Not seen in the simulator: circles, circle and public turns, request cards. The simulator build is signed ad hoc
without the iCloud entitlement, so CloudKit is out of reach however the simulator is signed in. They need the
TestFlight build (12f) or a development-signed run on a phone.

## 12d Today (24 Oct 2026)

| Frame | State | Checked |
|---|---|---|
| TD-30 Today | built (`(tabs)/today/index.tsx`, `components/ExperienceCard.tsx`, `data/today.ts`): the date over the greeting, the lamp; the verse on its picture with Sit, Listen, Share, More (Copy, Open in Bible, About this picture); For you today with real lengths (words at 200 a minute) and each card on a following day's picture | Light, Dark, AX5. QA found Psalm 119's "ALEPH" heading as the psalms card's words (fixed in `excerptOf`), Your plan naming a verse not its passage (fixed), the four actions leaving More alone at AX5 and the scrolled bar's title running into the lamp at AX5 (both fixed) |
| TD-31 scrolled, a tick | built: the paper bar with the lamp; "1 of 6 done" once something is; done is recorded when it is finished (`today_done`: Sit's Amen, Pray for others' Amen, the office's Amen, the devotional read to its end, the psalm or plan chapter read to its end) | the bar in Light and AX5; a tick not yet seen finished end to end |
| DV-30 devotional | built (`devotional.tsx`): "Devotional · evening", the heading in Literata, its verse, the reading, the other half, credit; Share and "Sit with John 13:5" docked; no Listen | Light |
| OF-30 the office | built (`office.tsx`): the day's picture blurred, a segment per part, the office and part named over the words, Next then Amen, which counts the day | Light (Evening prayer, Opening sentence) |

Replaced: the hero picture with the sheet over it, the reading card's Read and Listen, the forest office card, the Pray
card's list, Later and Earlier. The office is on For you today every day, whatever Daily psalms is set to.
Departure: "Pray for someone" shows the first of your list's open prayers, as the frame does, and opens Pray for
others; with nothing on your list it says "Your list, and someone on Yada".

## 12h Circles, asking one person, and the last older flows (25 Oct 2026)

Simulator build (ad hoc, no iCloud entitlement): anything that needs iCloud (a circle's page with its people and
requests, praying together, New circle making a circle, Ask someone sending, a person accepting) is checked as far as
its screen opens; the rest needs a phone with iCloud before upload.

| Frame | State | Checked |
|---|---|---|
| PC-30 a circle | built (`(tabs)/pray/circle.tsx`): its picture, faces and count, Pray together, the planned time as a row with its menu, requests as raised cards, Invite and Ask docked | needs iCloud |
| PC-36, PC-31, PC-37, PC-38 praying together | built (`pray/together.tsx`, `lib/togetherPlan.ts`): choose (requests, go round, today's verse, a Bible prayer), the steps, Next, Add, Leave in red, Amen; one shared number carries the choice and the step, so Build 11 phones still follow requests | needs iCloud and SharePlay; the big line capped at 1.4× (QA) |
| PC-32 before the first time | built (`pray/together-start.tsx`), full screen on the circle's picture | needs iCloud |
| PC-33 New circle | built (`pray/new-circle.tsx`): cover as you name it, six pictures, Invite in Messages | needs iCloud; without it, the iCloud sheet (checked) |
| PC-34 Joined | built (`pray/joined.tsx`) | needs an invitation |
| PC-35 Plan a time | built (`pray/plan.tsx`): seven equal day circles, Weekly or Once, the time, how long | Light (fitted sheet, days centred, John's note), Dark and AX5 (opens large, days centred) |
| AO-01 Add or ask | built (`pray/add-or-ask.tsx`) | Light: the sheet as tall as its rows |
| AO-02, AO-03 Ask someone | built (`pray/ask-someone.tsx`, `YadaAskModule.swift`): iOS's contact picker, the request, the exact message, Messages or other ways; not sent, it is deleted | needs iCloud; without it, the iCloud sheet, whose line now names both uses (QA) |
| AO-04 Asked | built (`pray/asked.tsx`, `data/accepted.ts`): opened when iOS accepts the link, wherever the app is | needs a second phone |
| Your requests | asks of one person sit among Your requests on Pray and Everyone on Yada ("You asked Sam"), with Mark answered and Delete | needs iCloud |
| PR-60 hold | built (`pray/someone.tsx`) on the blurred picture, "Hold while you pray", a timer instead | the empty state in Light and AX5 (AX5 ran the words under ×: capped at 1.4× and scrolls, QA); a request needs iCloud |
| SL-30 Silence | built (`silence.tsx`, `components/PauseButton.tsx` shared with Sit) | choose, run, Pause and resume; "Silence" said twice before Begin (fixed) |
| VF-30 the day's verse | built (`verse.tsx`): Earlier days at the top, Sit, Listen, Share, More | Light; "This evening" where Today says "Today's verse" (fixed) |
| ED-30 Earlier days | built (`earlier.tsx`): Mornings or Evenings, the part now chosen first | Light, both pills |
| BN-30, BN-31 By need | drafted on the canvas; built with BP-30 in 12e | — |

Every sheet that holds a few rows is as tall as them (`Sheet` `fit`, `_layout.tsx` `fitted`; John: "bottom sheet is
quite high… other screens have it too"); at AX sizes they open large. QA found 80 pt of empty sheet under the last
row (the inset sheet already clears the home indicator): fixed.

Departures: the Ask someone link is iCloud's share link, not a yadabible.com page (no link page yet).

Design system: added `PauseButton` (Sit and Silence), `Sheet` `fit`; removed `pray/Fact.tsx`, `circleTone` and
`CIRCLE_TONES` (a circle has its own picture now).

Bible prayers (John, 25 Oct 2026, docs/review-2026-10-25-naves-needs.md): ten more from Nave's, needs Keep asking and
The nation; Daniel 9 and Nehemiah 1 moved to The nation; 49 in all.

## 12e Everywhere else (25 Oct 2026)

Built by four agents in parallel plus Bible prayers here; reviewed and integrated. Simulator QA was cut short: other
work on the Mac pushed the load average past 25 and the simulator dropped taps, so the rows marked "to check" wait for a
quieter run before upload.

| Frame | State | Checked |
|---|---|---|
| YO-30 You | built (`you.tsx`, new; Your rhythm folded in and removed) | Light |
| SA-30 Saved | built (`saved.tsx`) | Light |
| BI-30 Bible | built (`(tabs)/index.tsx`) | Light; long book names shrank to unreadable (fixed: wrap to two lines) |
| PL-30 Reading plans | built (`plans.tsx`) | to check |
| UN-30 Understand | built (`PassageGuide.tsx`, `PlacesInPassage.tsx`) | Light; Hear this passage removed (John, 25 Oct 2026: "the play button beside Understand is enough") |
| PM-30 A place | built (`PlaceScreen.tsx`) | to check |
| SE-30, SE-31, SE-32 Search | built (`search.tsx`, `lib/search.ts`, `queries.ts`, recent searches in `user.ts`) | SE-30 and SE-31 in Light; "peace" froze the app for most of a minute (fixed: 30 verses at a time); a chosen pill's count was dark green on black (fixed); SE-32 to check |
| DI-30, DI-31 Dictionary | built (`dictionary/index.tsx`, `term.tsx`) | to check |
| BP-30 Bible prayers | built (`(tabs)/pray/bible.tsx`) | Light; back names Search when opened from it |
| BN-30, BN-31 By need | built (`(tabs)/pray/needs.tsx`, `need.tsx`) | BN-31 Light |
| BP-31 A Bible prayer | built (`prayer.tsx`) | Light; doubled quote marks and Listen lower than Next (fixed) |

Departures: Search has no Places tile (there is no places screen); the dictionary's example verses are each book's first
(the data keeps no more); You lists days this year before days in a row (RT-02); Saved keeps ⋯ Edit and Export.

Design system: added `StepSegments` (Sit, the office, Pray for others, a Bible prayer each drew their own), `TintTile`
without icon or line, `PictureTile` `wide`, `FilterPills` counts, `PageScreen` `scrollRef`; removed `HearPassage`,
`rhythm.tsx`, `lib/yearGrid.ts`, `yourReadingLine`, `booksReadThrough`, `tilePassages`, `groupDictionary`.

Still to do for all of Build 12 before upload (John, 25 Oct 2026): code review, security review and deslop over every
phase together; Light, Dark and AX5 on the rows above marked "to check".

## 12g Reading and listening (25 Oct 2026)

Built by three agents in parallel (the reader, the player, the rest), each on its own files; reviewed and integrated.
The iPhone voice and LS-31 were done earlier in Build 12. The Mac stayed heavily loaded, so QA covered the reader and
the player; the rest waits for the Build 12 pass before upload.

| Frame | State | Checked |
|---|---|---|
| RD-30 the reader's top | built (`ReaderHeader.tsx`): ‹ Bible, chapter and version as one split control, a progress hairline | Light; the hairline read full on opening until the first scroll (fixed: recomputed when the chapter's size settles) |
| RD-31 a chosen verse | built (`ActionBar.tsx` → `VerseSheet`): colours, Understand, Sit, Note, Share (with Copy), Compare, Save, Play from | Light; "Psalms 119:103" (fixed: a single psalm is a Psalm) |
| CH-30 chapters | built (`Contents.tsx`, `contents/[book].tsx`) | to check |
| RD-32 the docked player | built (`audio/ReaderBars.tsx`): passage, verse, time, verse back and forward, voice and speed | Light; the pill said "1×" without "Heart" when the chapter was on the phone (fixed: the voices are read once) |
| LS-30 the mini player | built (`audio/TabsPlayer.tsx`) | Light; the same voice fix |
| RD-34 Voice | built (`voice.tsx`) | to check |
| NT-30 a note | built (`note.tsx`; the sheet opens at medium) | to check |
| MO-30 a mood | built (`moment.tsx`) | to check |
| RD-33 the chapter's end | built (`ChapterClose.tsx`) | to check |

Departures: RD-31 is docked in the reader with no dim or handle, so other verses stay tappable for a selection of
several; speeds start at 0.8×, not 0.75×; the mood page keeps the OpenBible.info credit (CC BY).

Design system: removed `BRAND.forestCardDark` (the forest close is gone), `barItems`/`moreActions`, the two-row bar.

## 12f Build 12 QA, review and deslop (25 Oct 2026)

- Code review over every Build 12 phase (27e899f..HEAD): 8 findings, 6 fixed (7e6b116): Next in praying together waits
  for its steps, Amen counts only the requests reached, a failed share acceptance opens nothing, Mark answered reads
  every page, a half-made ask is deleted, the streak is read after countDay. Left: Build 11 and Build 12 phones in one
  call can show different steps (gone once everyone has Build 12); an ask's link lets its holder edit the request
  (write is needed to mark prayed; CloudKit has no write-only link).
- Security review: no high-confidence findings (SQL bound throughout, circles invite-only, contact data only into
  Messages, no new licensed-text or secret paths).
- Deslop over all of Build 12 (5cbbf4f): comments and small tidy-ups, no behaviour change.
- Simulator, the rows left "to check": chapters, note, dictionary and a word, plans, a mood, Voice, the chapter's end,
  You and the reader in Dark at AX5. Fixed: the chapters sheet opens on your chapter (it opened on Psalm 1 from
  Psalm 119); the dictionary rail cleared the group pills; Start on a plan is an ink pill (a fill pill vanished on the
  card); the mood's picture fills its band.
- Still only on a phone with iCloud: circles, praying together, Ask someone end to end, Your requests with asks.
