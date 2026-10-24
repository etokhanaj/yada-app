# Build 11 QA against the plan and the frames

18 Oct 2026, Release build on a simulator of its own ("Yada QA Build 11", iPhone 17 Pro, iOS 26.5), not signed in
to iCloud. Frames from the approved Build 11 canvas (https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ). Each frame
is built, or waits with the reason; nothing was moved.

**Simulator** means checked by tapping through, in Light, Dark and AX5 where it says so. **Device** means built but
needing iCloud, a second person, a FaceTime call or a push, none of which a simulator without an Apple ID can do;
John checks these on his iPhone before TestFlight.

## 11b Colour

| Frame | State | Checked |
|---|---|---|
| Palette tokens, Toggle, contrast tests | built | tests (palette.test.ts, system.test.ts) |

## 11c Pray and Circles

| Frame | State | Checked |
|---|---|---|
| PC-01 Pray, hero with a line from your list | built | simulator, Light |
| PC-02 New circle, what it is | built | device (needs iCloud); simulator showed CI-03 |
| PC-03 Name your circle | built | device |
| PC-04 Invite | built | device; departure: one Invite button |
| PC-05 A circle | built | device |
| PC-06 Leave or Delete, confirmed | built | device |
| PC-07 Joining | built | device; departure: Open and Leave |
| PC-08 People | built | device |
| PC-09 Add to your list | built | simulator, Light |
| PC-10 Item ⋯ | built | simulator, Light |
| PC-11 Edit; Remove with Undo | built | simulator: Edit and Remove; Undo to recheck after the toast fix |
| PC-12 Nothing anywhere | built | simulator, Light, Dark, AX5 |
| PC-13 Only your request out | built | device (needs a request in iCloud) |
| PC-23 An answered prayer you prayed for | built | device |
| PC-24 Back from inviting | built | device |
| CI-03 Sign in to iCloud | built (Build 10) | simulator |

## 11d Prayer notifications

| Frame | State | Checked |
|---|---|---|
| PA-01 Pray again | built | device (needs a public request) |
| PA-02 The two notices, no request text | built | device (needs push); code review: no request text |
| PA-03 Reminder's Prayer section | built | simulator, Light |
| DR-04 Daily psalms Off line | built | "No psalms on Today or in the widget" (decision 3, 22 Oct) |

## 11e Pray together

| Frame | State | Checked |
|---|---|---|
| PC-14 to PC-22 | built | device, two iPhones on a FaceTime call; departures in docs/build-11-screens.md |
| PC-20 Pray on a circle's request | built | device |

## 11f Book introductions

| Frame | State | Checked |
|---|---|---|
| SC-01 Handle at the bottom of John 1 | built | simulator, Light |
| SC-05 About John sheet | built | simulator, Light |
| SC-06 Arriving from Matthew | built | to check: needs Matthew's end of book |
| SC-07 No approved introduction, no handle | built | code (parseBookIntro returns null unless approved) |
| SC-08 Sources: Book introductions | built | to check |
| SC-09 Contents: About first | built | simulator, Light: closes Contents, opens About |

## 11g Orientation

| Frame | State | Checked |
|---|---|---|
| OR-01 to OR-05, OR-07 | built, held | waits for John to approve each book (ORIENTATION_APPROVED is empty); a debug build shows them as a draft |
| OR-03, OR-06 | built | the BibleProject card, after BibleProject agreed in writing on 19 Oct (docs/decisions-2026-10-22.md): Mark, John (two parts) and 1–3 John, each address and length checked on bibleproject.com; opens in a Safari sheet; quieter with "Needs a connection" offline. Device check |
| OR-08 | built | BibleProject's own page in the system Safari sheet, Done back to About; Yada adds nothing. Device check |
| OR-09 | built | the withdrawal case: a book with no checked overview has no card, and Who ends the sheet before the credit (lib/overviews.ts) |

## 11h Verse moments

| Frame | State | Checked |
|---|---|---|
| VM-01 | built | Search before you type: "For a moment", six tiles, each its name over its first passage's opening words |
| VM-02 to VM-04 | built | one passage at a time, swiped up; reference, dots, Open in Bible; a passage shows its opening and opens whole |
| VM-05 to VM-07 | not built | the equal-card alternatives; the frames prefer the pager |
| VM-08 | built | the helpline line follows the phone's region (Samaritans in the UK and Ireland, 988 in the US, Find A Helpline elsewhere), on Anxious, Afraid, Grieving and Lonely only |
| VM-09 | built | the last passage says "That’s all four for Tired." (each moment has 4 to 8 passages, as John kept them) |
| VM-10 | built | words always the BSB; with a licensed version the source line reads "BSB · OpenBible.info" |
| VM-11 | built | Open in Bible: the reader at the passage, selected, its back button reading the moment's name |

## Streaming (ST-01, ST-02; John, 23 Oct 2026)

| Frame | State | Checked |
|---|---|---|
| ST-01 Mini player, waiting for bytes | built | code: the play control shows the spinner, VoiceOver "Loading. Pause"; on the simulator John 3 started within about 3 s, too fast to catch the spinner. Device check on a slow connection |
| ST-02 Full player, waiting for bytes | built | as ST-01 |
| BA-02 Download ring before the first play | replaced | the ring and its Stop are gone; the book download (BA-04) keeps its ring |

Simulator, Release build against content.yadabible.com: John 3 played from the server with words marked, and was saved
as it played. The saved file's size and sha256 match the manifest (1,570,499 bytes); no second download. Tests cover a
mismatched file (deleted, nothing kept) and offline (the iPhone voice reads, BA-05).

## Sit with this: Settle and Breathe (BR-01 to BR-04; John, 23 Oct 2026)

| Frame | State | Checked |
|---|---|---|
| BR-01 Settle, breathing in | built | simulator, Light and AX5: "Breathe in", Next reads "Breathe the verse" |
| BR-02 Settle, breathing out | built | simulator, Light: "Breathe out", the circle drawn back |
| BR-03 Breathe the verse | built | simulator, Light and AX5: each half labelled; Next reads "Sit with it". AX5 fixed: the caption ran into the × and the first label |
| BR-04 Settle alone, Done | built | simulator: Done, and a tap on the circle, both return to the list |

| BR-05 A, BR-06 The orb | built | simulator, Light and AX5: the lit orb grows and draws back with the breath; the arc and its head trace the ring, closing at the turn. AX5 draws it smaller. Reduce Motion (orb still, no arc) is a code check: the simulator can't switch it from the command line |

A tap anywhere on the ground moves on, as Next does (the text and the circle included). Moving on early does not count
the day; a step that reaches its end still does (lib/sit.test.ts). The haptic: rising taps through the in-breath, a firm
tap at the turn, stillness out (BreathHaptics.swift, Core Haptics). The simulator has no Taptic Engine, so it takes
the single-tap fallback; the pattern itself is a device check.

Seen in passing, not part of this change: at AX5 the step numbers on the first page clip, and running Silence's verse
runs under the caption.

## Circles signed in to iCloud (simulator, 24 Oct 2026)

John signed the QA simulator in to his Apple ID. Checked: PC-12 Pray, PC-02 What a circle is, PC-03 Name it (the cover
follows the name), PC-04 Invite, PC-05 the new circle, its ⋯ menu, PC-08 People and the system's invite sheet. The circle
was made in iCloud in about 5 s.

Found, and where each stands after the fixes (retested on the simulator, 24 Oct 2026):
- Fixed: Invite said "Invite sent" with nothing sent. Invite now uses iOS's share sheet with the circle's share
  (Messages first on a phone; the simulator has no Messages) and resolves when the sheet closes. Closed without
  sending: the circle page, no toast. Checked.
- Fixed: "Anyone can add people". The share sheet offers no such choice: the circle stays private to those invited,
  and from iOS 26 they cannot add others. Checked: no options in the sheet. iOS 16 to 25 had no way for members of a
  private share to add people.
- Fixed: the clock and battery vanished on white pages. White over the picture or the circle's tone, dark once that
  has scrolled away, dark on People. Checked.
- Fixed: a stuck iCloud left Pray's circles empty and New circle on "Making it…" for good. After 15 s Pray says "Your
  circles didn't load. Try again." and New circle "iCloud didn't answer. Try again." Checked.
- Fixed: Pray's circle list never loaded. Timed on the simulator: allRecordZones took 15 s, and the three circles'
  shares fetched at once took 97 s in all. The list now reads zones from the database's change feed (0.2 s) and each
  database's shares in one request. Whole list: 0.48 s. Checked: QA circle, QA three and QA two show on Pray.
- Test circles left in John's iCloud: "QA circle", "QA three", and perhaps "QA two". Each opens from its page's ⋯ ›
  Delete circle.
- Not tried: a public Ask (every Yada user would see it), and Undo on the list (John's real list synced in).

## 24 Oct 2026, small fixes

| Item | State | Checked |
|---|---|---|
| BR-07 Breathe the verse: the halves cross-fade, a line under the half being breathed fills and draws back | built | simulator, Light |
| Sit with this at AX5: step numbers clipped; Silence's verse ran under its caption | fixed | simulator, AX5: numbers fit; the verse capped and the screen scrolls |
| Today after John is read to the end | built | code and tests; not seen on screen (needs all 46 passages read) |
| Undo on your list | not checked | the simulator's late taps landed the next tap on John's real item (left untouched); check on the phone |
| A public Ask | not tried | every Yada user would see it; check on the phone with a real request |

## John's yes to two departures (24 Oct 2026)

- The reader uses the BSB's paragraph breaks for every translation, NIV, NKJV and NLT included.
- Understand's header keeps the passage name above the reference ("The Word became flesh" over "John 1:1–18"), the
  reverse of RU-03.

## Outside the frames, found in QA and fixed

- The lock-screen player drew white text on its white card in dark mode (John's screenshot).
- The watch sat on "Open Yada on your iPhone." (John's photo): the phone now keeps and resends its data.
- Glass buttons over pictures were white on near-white (‹ Today on Pray; the circle page; Joining).
- Ask was black in both themes, unreadable on the dark card.
- The toast restarted its timer on every re-render.
- Pray and the circle page now use a light status bar over the picture.

## Replaced with John's yes

- SX-17 to SX-23, the listening Live Activity (Build 6/10 frames): removed 19 Oct 2026. It showed a second player under
  iOS's own Now Playing on the lock screen. Apple Music and Spotify show only Now Playing, and so does Yada now: the
  passage's name over "Psalm 94:1 · BSB", Previous and Next a verse, and real elapsed and remaining time when a
  recording plays. Lost: the verse text on the lock screen, StandBy's large verse and the Dynamic Island ring.
  Checked: builds and plays on the simulator, with no Live Activity on its lock screen; the simulator draws no Now
  Playing card, so the card itself is a device check.

## Design system pass

Added: `Toggle`, `Toast`, `components/pray/` (Avatar, CircleCover, Places and Ring, Fact), `AboutHandle`, the
GlassButton `onPicture` variant, palette tokens `ON_PICTURE`, `AVATAR_HUES`, `AVATAR_INK`, `AVATAR_SLOT`,
`CIRCLE_TONES`, `SYSTEM`. Each is used in more than one place, except the avatar and circle palettes, which are the
one source of those colours. Folded back into their page: `PrayHero`, `WaitingCard`. Removed: `BookIntro`.

## John's steps before the archive

- Group Activities and Push Notifications ticked on the App ID studio.yada.reader: done (John, 19 Oct 2026).
- CloudKit schema (Gathering, Coming, Together) deployed to Production: done (John, 19 Oct 2026).

## Moved in from Build 10

| Item | State | Checked |
|---|---|---|
| The collects | built | 1979 Prayer Book, traditional (John, 22 Oct 2026): 76 collects of the seasons, extracted word for word from the Episcopal Church's PDF (sha256 pinned, content/raw/bcp-1979); a step before the Lord's Prayer, morning and evening; a collect for every day of the year (lib/collects.test.ts). Holy days on weekdays keep the Sunday's collect. Licence: no notice in the book; the Church's canons hold it public domain (2024-D038) |
| Readers differ follow-ups | nothing to build | decision 6, 22 Oct: John reviews the 15 drafts in the queue |

## Side-by-side with the frames (23 Oct 2026)

Each screen beside its frame (the canvas's own pages, served locally), on the simulator:
- VM-01 tiles, VM-02 a moment, VM-04 Tired (no helpline), VM-09 the last passage and ‹ Search, VM-11 Open in Bible and back:
  match after fixes in 80e1b60. Light, Dark and AX5 checked; at AX5 a long passage now fits its page.
- PC-12 Pray with nothing: matches after 80e1b60 (the "up to 12" line, the + disc). Light and AX5.
- SC-08 Sources' book introductions: word for word as the frame. Light.
- Daily prayer: the collect step shows Proper 24 for the week of 18 Oct, before the Lord's Prayer.
- Still to compare: PC-01, PC-05, PC-09 to PC-11 (need list items, seen earlier), SC-09, OR-08/09; the device-only frames stay device checks.

## Pray tab (PT-40, PT-42 to PT-46, FL-01 to FL-06, TD-20 to TD-22; John, 24 Oct 2026)

Release build on the QA simulator (iCloud signed in), Light unless said.

| Item | State | Checked |
|---|---|---|
| PT-46 Pray as a tab | built | Tab bar Today · Bible · Pray (heart-hand); office card on the picture; four ways in one line each (Literata 19); When you're chips; People |
| PT-40 Add or ask (+) | built | Sheet: Add to your list, Ask each circle, Everyone on Yada, New circle; each row replaces the sheet |
| PT-42, PT-45 Bible prayers | built | Lord's Prayer card with Pray; six need tiles, centred, filter on and off; All 39 |
| PT-43, PT-44 A prayer, Pray it slowly | built | Whole BSB text centred; verse by verse with dots to Amen and Done; light status bar on the night ground (fixed in QA) |
| FL-01 Sit with a verse | built | Tile opens Sit with the day's verse |
| FL-02 Bible prayer | built | Row → prayer → Amen counts the day |
| FL-03 Pray for others | built | List, circle requests not yet prayed, one public request; "You prayed for N" |
| FL-04 Silence | built | 3/5/10/20, rain, ring runs down with minutes left; chips fit one row (fixed in QA) |
| FL-05 Your list, Everyone on Yada | built | Pages under People |
| FL-06 New-request notice | built | CloudKit database subscription, fixed text, no request text; Circle requests switch in Reminders. Delivery is a device check |
| TD-20 Today verse opens Sit; Done gone | built | |
| TD-21 Devotional without the author's name; compact bar on scroll | built | |
| TD-22 The whole Bible | built | Plans, the plan page, reader overline, reminder title |

Fixed in QA: the prayer view's clock was dark on dark; Silence's chips wrapped 3 + 1; the Pray for others tile had the
tab's own icon (now the people icon).
Today's Later row still named Spurgeon; it now says "and the evening devotional" (TD-21).

Code review (24 Oct): Pray for others now asks every circle at once with iCloud's time limit, so a stalled circle no
longer leaves an empty screen; the new-request notice saves each database on its own and is only re-saved when its
switch changes; the Read button's VoiceOver label says "Psalm", as the button does. Left as is: the prayer and Pray for
others text sizes (28 to 30 pt Literata, as the frames draw them, capped at 1.6× for AX5).

## Design system pass (Pray tab)

Added: icons target, book-open, heart-hand, hourglass, globe (each used on Pray and, for globe, Add or ask). No new
components or tokens: the new screens use PageScreen, ListRow, SheetScreen, Chrome, Prose and the BRAND and ON_PICTURE
tokens. Removed: Today's Done and its markDone, the Spurgeon portrait asset, the today/pray stack folder.

Device checks left: haptics at Silence's end, the circle-request notice arriving, praying with others in a circle,
VoiceOver order on the new screens.
