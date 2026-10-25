# Build 12 plan

- Frames: the Build 12 canvas, https://claude.ai/artifact/K7W4ov2ti3cY2csqgXCb1h, one page per journey (Design
  system; 1 Today; 2 Sit with a verse; 3 Reading and listening; 4 Pray; 5 You and Search), frames numbered in the order
  you meet them (Main: the design system; SW-01 to
  SW-06; PR-50, PR-51, TD-30, EM-01 approved by John, 24 Oct 2026, then cut back in a visual deslop pass; YO-30, SA-30,
  BI-30, PL-30, UN-30, SE-30, SE-31, BP-30 added the same day for review).
- Rules: `CLAUDE.md` § Design and `docs/design-system.md` § Build 12 additions (YouVersion patterns adopted, 24 Oct 2026;
  `docs/design-system-upgrade-2026-10-24.md`).
- Superseded and not built again: Sit with this as a page of steps (PR-02 to PR-06, BR-01 to BR-07, SV-01 to SV-03 on the
  Build 11 canvas). The breath, the orb, the word-by-word reading and rain are kept inside the new session.
- Branch: `claude/build-12`, cut from `claude/build-11` once its three local commits are pushed (your go-ahead).

## Phases, in build order

12a comes first: every other phase draws with its components. After it, 12b to 12e touch separate files and can run
side by side.

| Phase | Contents | Needs John first |
|---|---|---|
| **12a** Design system | The Build 12 components and tokens, used once each to replace what they supersede | this plan |
| **12b** Sit with a verse | SW-01 to SW-06: one setup screen, choose a verse, one continuous session, Amen | none |
| **12c** Pray | PR-50, PR-51, EM-01: tinted ways, moods on pictures, People with avatars, Your requests as cards | none |
| **12d** Today | TD-30: the verse card with its actions, picture rows, John's progress, Pray with avatars | none |
| **12e** Everywhere else | You (new), Saved, Bible, Reading plans, Understand, Search, Bible prayers: YO-30 to BP-30 | approval of those frames |
| **12g** Reading and listening | RD-30 to RD-34; Heart or George everywhere, the iPhone voice gone | approval of those frames |
| **12f** QA and upload | QA list, gates, TestFlight | go-ahead to upload |

## 12a Design system

New in `apps/mobile/src/components/` (each says why in a comment and replaces an old pattern in the same commit):

| Component | Replaces | First used by |
|---|---|---|
| `ListRow` gains `leading` (picture, swatch, avatar stack) and `action` (one `card`-filled pill; no chevron) | hand-made rows on Pray, the Sit step rows | Pray People, Choose a verse, Saved |
| `SectionTitle` gains `link` ("See all ›") | each screen's own "All" link | Pray, Today |
| `PictureTile` (a Yada photograph, the name in Literata on a fade) | Pray's mood chips | Pray, Choose a verse |
| `TintTile` (four tints, name in ink) | Pray's `Way` tiles (all `fill`) | Pray |
| `RaisedCard` (white, `#171917` dark, soft shadow) | none: new for what people wrote | Your requests |
| `Badge` (lime, ink words) | `CircleCover`'s "N new" chip | Pray People, Today |
| `StatTile` | Your rhythm's lead number | Your rhythm |
| `EmptyState` (glyph in a disc, title, one line, one pill) | each list's own empty text | Your list, Saved, circles |
| `VerseActions` (icon over label on a picture) | Today's "Sit with this" capsule | Today |
| `FilterPills` | none: `Segmented` stays for two to four equal views | Choose a verse |

Tokens in `src/design/palette.ts` and `tokens.ts`: the four tints (light and dark), `raised` and its shadow, `lime` and
`onLime`. `src/design/system.test.ts` gains two rules: a shadow only through `RaisedCard`, tints only from the tokens.
`docs/design-system.md` names each component in its table.

## 12b Sit with a verse (SW-01 to SW-06)

| Frame | What it needs | Files |
|---|---|---|
| SW-01 setup | A `fullScreenModal` on the verse's picture: the verse, Change, 5 / 10 / 15 min (`Segmented` on glass), rain, Begin. Every door opens it with a verse: Pray's tile and Today with today's verse, a moment's passage, the reader's ⋯ | `src/app/sit/index.tsx` (replaces `src/app/sit.tsx`), `_layout.tsx` |
| SW-02 choose a verse | A sheet: search (a reference or words, the queries Search already has), then Today, Saved, For when you're, Recent as `FilterPills`. Saved merges bookmarks, highlights and notes, newest first, with the highlight colour as the row's swatch; Recent is `recentlyExplored`; For when you're is the moments, BSB. Each row's Sit pill returns its verse to SW-01 | `src/app/sit/choose.tsx`, `src/lib/sitChoices.ts` (+ test) |
| SW-03 to SW-05 session | One player, four parts, the progress segments between × and rain (the part's name is for VoiceOver, not printed): breathe (one soft lime orb growing toward a faint ring that marks a full breath, the seconds inside it in ink, "Breathe in" and "Out for 6 next" under it; VoiceOver hears "Breathe in, 3 seconds. Then out for 6."; still under Reduce Motion), hear it read (the word lit), quiet (the time left large, the verse faint), hear it again. The day's picture blurred to colour behind. Pause, Skip, ×. The length sets the quiet: 5 min ≈ 2 min of quiet, 10 ≈ 7, 15 ≈ 12, from the parts' real timings. Rain as now | `src/app/sit/session.tsx`, `src/lib/sit.ts` (a session plan replaces `STEP_TITLES`, `stepLine`, `moveOnFrom`; tests rewritten) |
| SW-06 Amen | The day counts (`countDay`, as now, once the session reaches its end); "Today counts · N days"; tap one word of the verse to keep it as a line added to that verse's note, never overwriting what the note holds; Save (bookmark), Share (`share-image`), Again; Done docked | `src/app/sit/amen.tsx`, `src/data/user.ts` (`appendToNote`) |

Rule 9 as now: under a licensed translation the verse shown and heard is the BSB, and says so.

## 12c Pray (PR-50, PR-51, EM-01)

| Frame | What it needs | Files |
|---|---|---|
| PR-50 | The office on the day's picture with its own Begin; ways to pray as `TintTile`s; For when you're as `PictureTile`s with See all (opens the six) | `src/app/(tabs)/pray/index.tsx` |
| PR-51 (requests) | Pray starts something (a fill pill); Answered changes a request's state, so it is a quiet "Mark answered" text button with a tick, and an answered card carries a lime "Answered" badge with its words in muted ink | `components/pray/` |
| PR-51 | People as `ListRow`s: Your list (lock), each circle (avatar stack, `Badge` for new), Everyone on Yada (globe); each with a Pray pill. Pray on Your list prays through your list only; on a circle, that circle's hold screen (PC-20). Your requests (newest two, See all to `pray/mine`) as `RaisedCard`s: where and when you asked, the request in Literata, how many prayed (only you see it, as PR-11 already does), Answered | `pray/index.tsx`, `pray/through.tsx` (a `scope` param), `components/pray/` |
| EM-01 | `EmptyState` on Your list, Your requests, circles that are empty | `pray/list.tsx`, `pray/mine.tsx` |
| PF-30 to PF-32 | Pray for others on the evening picture, blurred: × and one segment per person; who asked and when, the request large, what they will see; Prayed and Next; the end says Amen, the day counts, who you prayed for by place, Done. Same order as built (your list, circles' requests, one from everyone) | `src/app/pray/through.tsx` |

## 12d Today (TD-30, TD-31, DV-30, OF-30)

The date over the greeting, the lamp and You on the right. The verse on its picture: "Today's verse · Jonah 2:4", the
verse, then `VerseActions` (Sit opens SW-01; Listen plays the chapter from the verse in Heart; Share opens Share as an
image; More holds Copy, Open in Bible, About this picture). Then **For you today**, each an experience card named for
what you do, with a picture and its length:

1. Sit with a verse (today's verse, 5 min).
2. Today's psalms: the 1662 Psalter (the whole book of Psalms once a month, morning and evening; on the 24th, Psalms
   116–118 in the morning, 119:1–32 in the evening), titled by its first line.
3. The devotional: Spurgeon's *Morning and Evening* for the date and part, titled by his heading (today "The trees of
   the Lord are full of sap.", Psalm 104:16), its length from its words (351, about 2 min). It opens **DV-30**: heading,
   verse, the reading whole, Sit with its verse, Share; no Listen (not recorded, and no iPhone voice).
4. The office ("Afternoon prayer" from noon to five). It opens **OF-30**: one part at a time over the day's picture,
   blurred as in Sit with a verse, the part's name over its words, Next, then Amen.
5. Your plan by its passage's name. 6. Pray for someone, with the first line of your list (opens PF-30).

A done one fades with a tick; "1 of 6 done"; the day counts at the first, as now. The floating tab bar stays as built.
Files: `src/app/(tabs)/today/index.tsx`, `src/lib/today.ts`, `src/app/devotional.tsx`, `src/app/office.tsx`.

## 12e Everywhere else (YO-30 to BP-30)

| Frame | What it needs | Files |
|---|---|---|
| YO-30 You (new) | A page from a person button beside Today's lamp: days in a row and this year as `StatTile`s, the week's dots, then rows with tinted icons for Saved, Your requests, Reminders, Translation; Settings under ⋯. Bible loses its bookmark button and its ⋯ menu (Recent and Settings move here) | `src/app/you.tsx` (new), `(tabs)/today/index.tsx`, `(tabs)/index.tsx`, `src/app/rhythm.tsx` (folded into You, then removed) |
| SA-30 Saved | `FilterPills` for Highlights, Notes, Bookmarks, Images; verses grouped by chapter with a count; the highlight as a tint on the words (the reader's own), not a bar down the side; "Your reading" leaves Saved | `src/app/saved.tsx` |
| BI-30 Bible | Continue as a card with Read and the book's progress (chapter n of N); the testament switch; books two to a row with their chapter counts, the book you're reading marked; RU-10's chapter grid still opens in place | `src/app/(tabs)/index.tsx` |
| PL-30 Reading plans | Each plan as a card: its picture (decision 5), what it is, progress, Continue or Start | `src/app/plans.tsx` |
| UN-30 Understand | What happens leads in Literata; Hear this passage as a card with play; places as cards opening the map; the study note and Read it alongside as now | `src/components/UnderstandPages.tsx`, `PlacesInPassage.tsx` |
| PM-30 A place | Inside the Understand sheet: the name in Literata, "Identified with …", the map PlaceMap already draws from Natural Earth (sage sea, paper land, the place ringed, nearby towns named), Open in Maps, the verses in the book that name it, the credit | `components/PlaceScreen.tsx`, `components/PlaceMap.tsx` |
| SE-30 Search | Ways in as `TintTile`s (Bible prayers, Reading plans, Dictionary, Places), For when you're as `PictureTile`s, recent searches kept on the phone | `src/app/search.tsx`, `src/data/user.ts` (recent searches) |
| SE-31 Search results | Verses first (they came last, under Dictionary, Guides and Words), with their true count ("394 verses in 59 books") and the books as chips with counts to jump by; the word marked; Words, Guides, Dictionary as pills. No invented "best" verse (RU-16) | `src/app/search.tsx`, `src/data/queries.ts` (counts by book) |
| SE-32 Nothing found | "Did you mean anxious?" from the nearest word the Bible's text uses (edit distance over the search index's words); when the word is a mood, its picture tile | `src/app/search.tsx`, `src/lib/search.ts` |
| DI-30 Dictionary | Find a word (filters as you type); Key words · People and places · More words as pills; each word with its own first sentence; an A to Z rail | `src/app/dictionary/index.tsx` |
| DI-31 A word | Its kind, the definition, "47 verses" (was "47 places", beside a section called People and places), the first verses written out, By book behind them, "unfoldingWord, adapted" | `src/app/dictionary/term.tsx` |
| BP-30 Bible prayers | The Lord's Prayer on a picture with Pray; the six needs as `TintTile`s, two to a row; every prayer with its reference | `(tabs)/pray/bible.tsx` |
| BP-31 A Bible prayer | One verse at a time on its picture, blurred; Listen in Heart, Next, then Amen (PT-44 restyled) | `src/app/prayer.tsx` |

Not redrawn: the Aa and translation sheets, Settings rows. The reader is 12g.

## 12g Reading and listening (RD-30 to RD-34)

The text itself is unchanged (Literata, BSB paragraphs, small verse numbers, highlights as a tint). Around it:

| Frame | What it needs | Files |
|---|---|---|
| RD-30 | "‹ Bible"; chapter and version as one split control (each half opens its own sheet); a hairline of how far through the chapter; the bar is Understand and Listen only (chapter arrows dropped: they sat where the player's verse arrows sit); the BSB/WEB paragraphs as now | `components/ReaderHeader.tsx`, `components/ActionBar.tsx` (`RestBar`) |
| CH-30 | "John 2" opens the book's chapters as a sheet: the one you're in filled, read ones with a wash and a bar, John › to change book | `components/Contents.tsx` |
| NT-30 | A note on a verse: the verse in view above the sheet, the note in Literata, Done | `src/app/note.tsx` |
| RD-31 | A chosen verse (wash and gutter bar, as now) opens one sheet: the four colours, Understand as the primary, then Sit, Note, Share, Compare, Save, Play from as labelled tiles (Copy lives in Share). Replaces the two-row bar and the ⋯ menu | `components/ActionBar.tsx` (`ActionBar` becomes `VerseSheet`), `read/[book]/[chapter].tsx` |
| RD-32 | Listening docks a player: passage, verse, time, verse back and forward; "Heart · 1×" opens Voice | `components/audio/` |
| LS-30 | Leaving the reader, the player shrinks to a mini player above the tab bar on every tab: passage, verse and voice, pause | `components/audio/MiniPlayer.tsx`, `(tabs)/_layout.tsx` |
| LS-31 | Offline with the book not downloaded: a sheet says so, with Download when online (queued) and Not now | `data/audio.ts`, `data/recordings.ts` |
| MO-30 | The mood page in the new system: its picture and name, the passage in BSB, Sit with this and Open in Bible docked, the helpline line | `src/app/moment.tsx` |
| RD-33 | The chapter's end (RT-03 kept): the next chapter leads with Continue, the book's chapters as a bar, Understand what you read | `components/ChapterClose.tsx` |
| RD-34 | Voice: Heart or George, each with a sample; speed; the book for offline with its size | `src/app/voice.tsx` |

**The Apple voice.** Chapters already play Heart (the live manifest holds every book, and builds point at it). The
iPhone voice reads only in Sit with this, which speaks the verse with `Speech.speak` (`sit.tsx`), and offline with
nothing downloaded, or when a stream fails. In Build 12:

- Sit with a verse plays the verse from its chapter's recording (`Speech.playSegment` with the verse's timings, as
  the reader does), the word lit from the same timings. Under a licensed translation, the BSB recording (rule 9).
- Offline with nothing saved, Listen says so and offers the download, instead of reading in the iPhone voice. A stream
  that fails says "This reading didn't load" with Try again.
- The system-voice path in `data/audio.ts` and the voice line in the Voice sheet go (replace, don't layer); the
  breath haptics in `modules/yada-speech` stay.

### Floating chrome (24 Oct 2026)

The floating tab bar and the mini player sit on a hairline and a barely-there lift (`--float`), not a drop shadow.

### Sheets (24 Oct 2026)

No shadow on any sheet: the page behind dims instead, as iOS does. Cards inside a sheet use `fill`. `SheetScreen`
changes once in 12a; every sheet follows.

### Cards (UX review, 24 Oct 2026)

Raised white cards with a shadow are only for what people wrote (Your requests). Everything to do is a flat fill card:
Today's experiences, the chapter's next, plans, Continue, Understand's cards, the top search result. `system.test.ts`
checks it (12a).

## QA, every phase (John, 24 Oct 2026: "remember to QA afterwards against the live mock design wise")

At the end of each phase, before its commit is called done:

1. Each screen the phase built beside its frame on the Build 12 canvas (https://claude.ai/artifact/K7W4ov2ti3cY2csqgXCb1h),
   in Light, Dark and AX5, on the QA simulator: layout, spacing, type step, colour token, copy word for word, states.
2. Every control tapped (docs/build-qa-lessons.md): it does what the frame's note says, and back names where it goes.
3. VoiceOver order and labels as the frame's markup gives them; Reduce Motion where something moves.
4. A row per frame in `docs/build-12-qa.md`: built / differs (how, why) / moved (with John's yes), with the simulator
   screenshot beside the frame's.

## Pictures (24 Oct 2026)

Every photograph comes from the bundled public-domain day pictures through one function, `pictureFor(role, day, part)`:
the day's verse, the office, Sit with a verse and its session use the day's picture for the part, as now; each mood, plan
and Bible prayer keeps its own fixed picture (decisions 3 and 5; the Lord's Prayer day 16); Today's experience cards
take the following days' pictures in turn, so no picture shows twice on one screen. The pool grows without code changes.
Open for John: growing the pool from 60 to about 180 (same sources, licences read from each; thumbnails at 300 pt).

## 12h Circles, asking one person, and the last older flows (approved by John 25 Oct 2026, Leave in red included)

John, 25 Oct 2026: "upgrade the circles call pages with our new design system/direction", "add [ask one specific
person]… if they are not on Yada you can send a text or mail", "should any other flow be upgraded?", and for praying
together "follow voice calls and video calls like Zoom, Meet". Canvas page 6 · Circles, asking and the rest.

| Frame | What it needs | Files |
|---|---|---|
| PC-30 a circle | Its own picture (chosen at New circle, from the day pictures), people as faces and how many; Pray together as one pill; the planned time as a row; requests as `RaisedCard`s with Pray or "You prayed"; Ask docked with Invite | `(tabs)/pray/circle.tsx`, a `picture` field on the circle record |
| PC-36, PC-31, PC-37, PC-38 praying together | As a call that never assumes a request: it opens on who is here and what to pray (the circle's requests when there are any, go round, today's verse, a Bible prayer); then the circle and the call's time, faces, the thing prayed large, round labelled controls (Next, Add, Leave in red); going round shows one person large; it ends on Amen with how long and who | `pray/together.tsx` |
| PC-32 to PC-35 | Before the first time (one line and Start), New circle with its picture, Joined (no box around text), Plan a time (S M T W T F S across the width) | `pray/together-start.tsx`, `pray/new-circle.tsx`, `pray/joined.tsx`, `pray/plan.tsx` |
| AO-01 to AO-04 Ask someone | + Prayer gains Ask someone; one person from iOS's contact picker (no contacts permission); the request; the exact message before it goes (Messages or other ways); the person opens it in Yada and says they prayed, or reads it without Yada. Underneath: a private circle of two that never shows in your circles, ending after 7 days or when answered | `pray/add-or-ask.tsx`, `pray/ask-someone.tsx` (new), `modules/yada-pray` (a share of one), a link page on yadabible.com |
| PR-60, SL-30, VF-30, ED-30 | The hold screen, Silence, the day's verse full screen and Earlier days on the Build 12 grounds | `pray/someone.tsx`, `silence.tsx`, `verse.tsx`, `earlier.tsx` |

Every sheet is as tall as what it holds (John, 25 Oct 2026: "bottom sheet is quite high"); 12h applies it to every sheet in the app, not only these. Decisions for John: Leave in red (the one red in Yada, as every call app has it); the yadabible.com link page.
Left as built: Compare, Share as an image, Settings, Reminders; Start small and Return go to Build 13's first-run pass.

By need (BN-30, BN-31; John, 25 Oct 2026: "use Nave's directions and have a way to design for a page for them so we
don't flood it, except it remains just 6"): Bible prayers keeps its six tiles and gains See all; By need lists every
need, John's six with their counts, then the headings Nave's Topical Bible adds (Grief, Family, Keep asking, The
nation, Before a meal), which reach the app only once John places prayers in them through the review queue. Drafted
on canvas page 4 for John's yes; built with BP-30 in 12e.

## 12f QA and upload

As `CLAUDE.md` requires: every frame above marked built (or moved with John's yes), each checked in Light, Dark and AX5
with VoiceOver order; the design-system pass (new components listed, superseded ones removed: `Way`, the mood chips, the
Sit step page); `pnpm -r typecheck` and `pnpm -r test`; deslop, review-code, security-check; the build number raised to
12; then TestFlight.

## Decided (John, 24 Oct 2026: "i like your six decisions")

1. Sessions of 5, 10 and 15 minutes, 5 first.
2. A kept word is its own line in the verse's note ("Kept: still").
3. Moods on days 14, 7, 13, 24, 10 and 16: Anxious, Afraid, Grieving, Lonely, Tired, Thankful.
4. Between noon and five the office card reads "Afternoon prayer"; the office itself is unchanged.
5. Each reading plan takes a day picture (John: day 1; the whole Bible: day 10).
6. Push `claude/build-11` first: after the push gates (typecheck, test, secrets, deslop, review-code, security-check), at
   the start of 12a.

Open: approval of YO-30 to BP-30, RD-30 to RD-34, and You as the home for Saved, rhythm and Settings.
