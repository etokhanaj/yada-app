# Build 6: open questions, decided (15 Oct 2026)

John asked for the open questions to be decided by common UX practice rather than waiting for him. Each
decision names the practice it follows. Frames: the canvas's **Build 6** page
(https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc). Rule 9 and the licensing rules are unchanged.

## Listening (LB-01 to LB-11)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | One menu with three rows, or every option inline? | One menu: Speed, Stop playing, Repeat, each a submenu showing its setting. | Inline would be about 15 rows, past what a menu can show without scrolling. Apple Podcasts and Matter keep each setting a short submenu. |
| 2 | Wording | Keep "Stop playing", "End of this passage", "End of this chapter", "In 15 minutes", "Stops after 1:18", "Stops in 27 min", "Repeats 1:1–18". | Plain verbs that say what happens; no metaphor, and nothing of Dwell's. |
| 3 | Stop with repeat | Stop lists only the breaks the loop can reach; a smaller repeat clears a stop it would never reach. | Never offer a choice that cannot happen (Nielsen: error prevention). |
| 4 | Pause during a chapter's name | Play says the name again, then verse 1. | Resuming re-orients after a pause, as audiobook players rewind a little on resume; the name is about 2 s. |
| 5 | Should the mini player show a set stop or repeat? | No. The full player's line says it; the mini player keeps its three controls. | The mini player's job is now-playing and play/pause; its second line is the place. |
| 6 | WEB, KJV and LSV: should the voice name open the Voice sheet? | Yes, for the book's download; the single voice shows without a tick. | One door to a book's reading in every version, as in the BSB. |

## Download for the NKJV, NLT and The Message (LD-01 to LD-05)

**Not in build 6.** API.Bible's Starter plan allows 5,000 calls a month for the whole account, shared by
every reader. One downloaded book of Psalms is 150 calls, so a few downloads could stop licensed reading for
everyone. Best practice is not to ship a feature that can break the core one. It returns with a Pro plan or
a publisher licence. When it does, Stop keeps the chapters already fetched, as the BSB audio download does.

## IA stress test (15 Oct 2026)

| # | Finding | Decision |
|---|---|---|
| 1 | "‹ Home" goes elsewhere | Fix in build 6: every push into the reader names its origin, and a chapter move keeps it. |
| 2 | Doors from outside stack differently | Fix in build 6: one `openFromOutside`, used by notification, Siri, Spotlight and widget links. It closes sheets and the player and lands on the reader. |
| 3 | Word uses on a licensed page show blank verses | Fix in build 6: show the BSB, labelled, as Peek does. |
| 4 | Exits name the wrong place | Fix in build 6: labels come from what is underneath. |
| 5 | Sources and Reminder open as pages over sheets | Fix in build 6: Sources opens inside the sheet. The guide's reminder offer goes; the reminder lives in Settings (IA-11). |
| 6 | The guide can be blank | Fix in build 6: one sentence and Try again, as US-08. |
| 7 | A returning reader lands in different places | Fix in build 6: a cold launch after a gap holds "Where you stopped" (MM-05). The widget lands where Continue lands. |
| 8 | Audio has no control off the reader | Build 6: the paused mini player can be put away (done), and Stop listening joins the player's menu. A mini player on every page is a later build: it needs a root overlay. |
| 9 | Licensed labels | Fix in build 6: Home's Continue excerpt and the Continue widget say "· BSB" under a licensed version. Compare's two pickers offer the same versions. |
| 10 | Names | "Go deeper" everywhere (the guide's "More" too, IA-12). The guide's loading line names the guide. The rest bar keeps "Understand 1:1–18", the action. |
| 11 | Search only from Home; audio downloads only from a playing session | Later: both need a new door, drawn first. |

## System surfaces (SX-01 to SX-23, drawn 15 Oct 2026)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Psalm 138:1 opens "Of David." | Set it as the psalm's title line, italic, above the verse. | It is the BSB's own superscription, unchanged; only its setting differs, as printed Bibles do. |
| 2 | Listen on the Lock Screen and in Control Center? | Yes, both. | Audio apps put play where the phone is picked up (Control Center media controls); one tap, no app launch. |
| 3 | Six App Shortcuts or three? | Six. | Each is a sentence a person would say; Apple allows ten. |
| 4 | Does a reminder replace yesterday's? | Yes. | A pile of unanswered reminders reads as "you missed"; one at a time keeps the no-guilt rule. |
| 5 | Should today's passage lead the Scheduled Summary? | No: an ordinary relevance score. | A reading app shouldn't push itself to the top of someone's summary. |
| 6 | Widget sizes for 402 pt screens | Confirm against Xcode previews when built. | The canvas scaled Apple's 393 pt table. |
| 7 | How long a stopped Live Activity stays | It ends at once. | A stop usually means sleep: nothing should stay lit on the Lock Screen at night. |

## Decided with John during the build (15 Oct 2026)

| # | Decision | Where |
|---|---|---|
| 1 | Licensed Download (NKJV, NLT, MSG) is held: API.Bible Starter allows 5,000 calls a month for the whole account. Its frames stay drawn (LD-01–05). | canvas LD; this doc |
| 2 | Licensed text is never spoken by any voice, the iPhone voice included (API.Bible §9.1): Listen under a licensed page plays the BSB. | rule 9; EG-03 |
| 3 | The WEB, KJV and LSV are read in one voice each: WEB Heart, KJV George, LSV Heart. The Heart or George choice applies only where both read the text (the BSB). | LB-09–11 |
| 4 | "More on this verse" shows the full view by the tap alone, whether or not the sheet can grow; the verse repeats only when the sheet is truly full. Flow 11 tests the tap with no drag fallback. | fix dc6f594 |
| 5 | Audio stays in view: the mini player shows the chapter's progress as a line split at its passages, and the playing verse's words as its second line. | 6b8035a |
| 6 | While a verse is selected and audio plays, a strip above the verse's actions shows the line and the playing verse, opens the player and pauses. | 6b8035a |
| 7 | The full player's menu ends with Stop listening; the paused mini player has an ×. | 4e9c5ab, 5fe312b |
| 8 | Notifications: Yada asks in its own words at the end of the first passage, showing the reminder it would send and the time; iOS asks only after Turn on, because its prompt comes once. Not now asks once more on Home after three or more days, then never; the reminder lives in Settings. Closing the sheet any way counts as Not now. | NP-01–03 |
| 9 | A reminder due while Yada is open goes to Notification Center without a banner (it was dropped unseen before). | _layout.tsx |
| 10 | The old reminder offer at the foot of the passage guide is removed: it counted as offered when drawn, seen or not. | PassageGuide.tsx |
| 11 | Build 7 is planned in its own session, with daily-habit features inside Yada's rules (no streaks, counts or "you missed"); any idea that would break them goes to John as a choice. | Build 7 session |
| 12 | The pipeline session rebuilds and publishes the Understand bundles once, after the book-introduction and word-link branches are merged into build-6 and their dry-run reports pass: one rebuild carries both. Old apps ignore the new keys, so the publish is safe for build 5. | pipeline session |
| 13 | Book introductions and grammar sentences ship hidden until approved. Rule 2 stands: only John approves, and Claude cannot approve for him. They go to the review queue as one batch (65 introductions, about 90 grammar sentences), each a verbatim check against its source; an approved item appears in the app at the next launch, nothing else waits on the rest. 1 Corinthians and Romans are listed first, as they read weakly. | review queue |
| 14 | Widget and Control Center Listen read the reader's own text where a voice reads it (BSB, WEB, KJV or LSV), as Listen does in the app; under a licensed version they read the BSB (EG-03). | system surfaces |
| 15 | Siri and Spotlight show a psalm's first verse whole, title included, as the BSB prints it; widgets set the title on its own line. Both are the BSB's words unchanged. | SX-10, SX-12 |
| 16 | A reminder can only take back earlier ones when Yada next opens (iOS runs no app code on arrival); until then they stack in one thread. Accepted: one thread reads as one reminder, not a pile. | SX-15 |
| 17 | The notification content extension needs `npx expo prebuild --platform ios --clean` once before the next archive; release-ios.sh refuses until ios/ has it. No Apple developer portal step: the extension needs no App Group (it draws from the notification itself), and the archive's automatic signing with the App Store Connect key registers its App ID (studio.yada.reader.notification) and profile. | release step |
| 18 | Widget sizes: no fixed widget sizes. Every layout takes the size iOS gives each family (fills and bars are fractions of the space; only 44 pt targets are fixed), so a 402 pt iPhone is laid out by the system. Checked once in Xcode previews and on the simulator before upload. | SX-01–08 |
| 19 | Siri's Read and Listen buttons show only on iOS 26 and later, where snippet buttons act; earlier, a tap on the snippet opens the passage and "Listen to the next passage in Yada" stays a spoken shortcut. Never a button that does nothing. | SX-10 |
| 20 | MM-03 underlines the word's own English ("Word"), not the article beside it: the BSB tables give ὁ as "the" separately (rule 4). | WM-01 |
| 21 | Places: OpenBible.info confidence 500 of 1,000 or more; places whose coordinates come from OpenStreetMap or Google are left out (ODbL); an identification the source gives as interpretive (Babylon in 1 Peter 5:13 as Rome) says "Identified with …", never states it. Natural Earth is credited though it asks no credit. | WM-02–07 |
| 22 | John's review of the intros and grammar (116 approved, 41 rejected) is redone from better sources rather than corrected by hand, since Yada writes none of the words (rule 2). Book introductions: the opening paragraph of each Tyndale Open Study Notes book introduction (CC BY-SA 4.0, already pinned), cut by the same rules; translationNotes is the fallback. Question sentences are skipped; Galatians' "faith alone" is checked at review. Genesis: John's own draft is only the brief for picking the source paragraph, and Tyndale's opening matches it. | intro.ts, after the pipeline rebuild |
| 23 | Grammar sentences: Machen, *New Testament Greek for Beginners* (1923) for Greek and Gesenius' Hebrew Grammar (Kautzsch–Cowley 1910) for Hebrew, both public domain; each sentence is checked against the page scan, and OCR noise is held for review. STEPBible's morphology codes (CC BY 4.0) only check a sentence and are never shown. The aorist, the rare stems and the Aramaic terms show nothing until a grammar has a clean sentence. | grammar.ts, after the pipeline rebuild |
| 24 | Script fixes from the rejections: a reviewed table of spelling-only corrections, shown to John beside the original; no cut that leaves a sentence setting up the next; a held "weak" entry is never a draft; a second sentence when the first is generic; an intro that opens on another book starts at this book or shows nothing; a sentence repeated across terms is held; a rejection is kept across re-runs. Each with a test. | intro.ts, grammar.ts |
| 25 | As built: Tyndale replaces only the 16 introductions John rejected and fills Genesis; the 49 he approved stay, since 43 are live (moving all 66 would have sent every one back for review). Zephaniah shows nothing: Tyndale's opening is a quotation, a question and a fragment, and tN's was rejected. Gesenius is not used: its scan is OCR noise with garbled Hebrew. Machen gives six Greek terms; seven slips are corrected with a note. | intro.ts, grammar.ts |
| 26 | Whatever is still empty at the end of build 6 moves to build 8 (John: "anything empty and doesn't pass today"): Zephaniah's introduction, 13 rejected grammar terms, 8 Aramaic terms with no article, and the Aramaic gloss and Strong's gaps. | docs/build-8-plan.md §7 |
