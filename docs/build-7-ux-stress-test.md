# Build 7 UX and UI stress test (15 Oct 2026)

John asked for a UX stress test of build 7, then a UI one that removes anything that looks like a wireframe or
visual slop. The UX test walks real days through every build 7 frame, as different people would live them. New frames
are XT-01 to XT-05 on the Build 7 page. Fixes are folded into the existing frames, and the build plan's rules.

## UX findings

| # | Walk | What breaks | Fix |
|---|---|---|---|
| 1 | A first-time reader opens Today | A streak chip reading 0, "Your plan" with no plan, a Pray card for a list they haven't started: three things that don't apply yet | XT-01: no lamp until a day counts; "A place to start · The Gospel of John"; no Pray card on the first day (it appears from the second, or once the list has anything) |
| 2 | "Have I read today?" | We refused ticks, so nothing on Today answers it | XT-02: the lamp is outlined until today counts, then filled. No tick, no message |
| 3 | Someone reads at 1 am | "Good morning" and a new day's psalms, though they never read the evening's | The day turns at 03:00 for Today, the streak and the widget, as the iPhone's sleep schedule does. "Good evening" until then |
| 4 | Today carries a lot | Picture, reading, devotional, plan, Pray, Later, Reminders: seven blocks | The Reminders row leaves Today (it restates Settings). Settings › Today can hide the devotional and Pray cards. Order: verse, reading, devotional, plan, Pray, Later |
| 5 | No plan, the morning reminder | NT says it names "the next passage", but there is none | With no plan, the morning reminder names this morning's psalms |
| 6 | A reader on the NKJV | Plan said both "the reader's translation" and "BSB" for Today | On screen, Today's verse and reading show the reader's translation (display only). The widget, notifications, share images and Sit with this's spoken words stay BSB (rule 9) |
| 7 | Asking for prayer in a small community | "0 people prayed" for days is discouraging | XT-04: no count until the first person prays; "Live · 7 days left" |
| 8 | Praying through all requests | "Next request" with nothing left | XT-03: "That's everyone for now." A request you prayed for isn't shown to you again unless it's renewed |
| 9 | A request names a third party ("my sister Jane has cancer") | Someone else's health data, posted publicly | The composer says "Leave out other people's names and details" (PR-10). The word filter flags full names and phone numbers |
| 10 | Signed out of iCloud | CloudKit has no identity, so Ask fails | XT-05: one sentence and Open Settings. The private list still works on this iPhone |
| 11 | Hold to pray is interrupted (a call, the screen locks) | Lost progress feels like failure | Releasing stops the count quietly. It counts only at about 20 s; nothing is said about a partial hold |
| 12 | Begin in Sit with this | No idea how long the four steps take | Begin says "about 9 min" (Settle 2, Breathe 1, Sit with it 1, Silence 5). If Breathe the verse has no clean split, its row disappears |
| 13 | Highlighting in the KJV, then switching to the BSB | Is the highlight lost? | Highlights and notes belong to the verse reference and show in every translation |
| 14 | Exporting notes from an NKJV reader | Licensed text would leave the app | The export carries the reference and the BSB text, never licensed text |
| 15 | A notification arrives during Silence | `openFromOutside` would tear down the meditation | Silence and Pray for someone hold outside doors until they end; the notification waits in Notification Center |
| 16 | Remove my data while offline | The CloudKit public deletes can't run | Local data clears at once; your requests are deleted on the next connection, and the alert says so |
| 17 | Apple Watch complications | watchOS widgets and complications need a watch app target; the iPhone's widget does not appear on the watch | Correction to the Apple Watch pass: build 7 ships the mirrored reminders and the Live Activity only. The Smart Stack widget and complications move to build 8, with the small watch app |
| 18 | Psalm headings in excerpts | "For the choirmaster. With stringed instruments…" leads the evening card and its notification | Known data gap (sources ledger): mark headings apart from verse 1 in the pipeline. Never trimmed by hand |
| 19 | The day's devotional vs the day's verse | Two quotations on one screen (the picture's verse, Spurgeon's verse) | Kept: they differ in kind. The picture is the day's verse; Spurgeon's line is the devotional's heading, labelled "Devotional" with its author |

## UI fixes (wireframe look and slop removed)

- **Grey italic placeholders replaced with real content:**
  - Spurgeon's 1 November headings: "The church in thy house." (Philemon 2) and the evening's Matthew 24:39. Read from
    CCEL; re-check against the pinned copy before release.
  - The real day-1 pictures in Earlier days.
  - Realistic sample user text in the prayer frames. These are illustrative, not data.
- **The plan card's 4% progress bar is gone:** it read as a stray mark. The card says "passage 3 of 46".
- **The Pray card says what's waiting** ("3 on your list · and someone to pray for"), not a list of features.
- **"Pray for someone"** no longer repeats its own label.
- **The lamp has two distinct states:** outlined and muted, or filled on a soft wash.
- **The composer's keyboard is drawn as a keyboard,** not a grid of boxes.
- **The devotional page leads with the entry's heading in Literata,** then Spurgeon's first line, then the credit once.
