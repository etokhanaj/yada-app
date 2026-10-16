# Build 7 IA stress test (15 Oct 2026)

John asked for build 7's additions to be run against the IA, and asked "why not a menu tab?". This tests the
canvas's Build 7 page (DR-01–15) together with the build-7 carry-overs (mini player, Search from the reader, audio
download, Live Activity tap) against IA v3 (IA-11–14) and build 6's IA fixes (`docs/build-6-decisions.md`).

## Findings

| # | Walk | What breaks | Severity |
|---|---|---|---|
| 1 | Open Yada in the morning to do the day's reading | Today is the fourth row on Home, under Continue, the progress line and Your plan. At AX5 it is off the first screen (DR-01's AX5 frame had to be drawn scrolled). The habit's door is the hardest one to find. | high |
| 2 | Today shows "The first disciples · Your plan" while Home's Continue says John 1:39 | Two doors to the same reading, landing in different places (the guide versus the verse), on two screens. IA v3's rule is one door per job. | high |
| 3 | The evening notification says "Psalms 6–8"; the widget says "This morning · Psalms 1–5" | DR's notes send both to Today, but IA-13's rule is "every door lands where it says", and NT sends the reminder straight to the passage. A tap on "Psalms 6–8" that lands on a page of rows is one tap too many. | medium |
| 4 | Start the evening psalms playing, then go to Today or Settings | No player off the reader until item B (a root overlay) is built. The evening-listening idea (DR-08) depends on it. | high |
| 5 | Search from Today or the reader | Search is only on Home's header (stress test #11). Today adds another place without it. | medium |
| 6 | Psalm 1 › Psalm 2 › … › Psalm 5, opened from Today | The return chip must say "‹ Today" through the whole set (build 6 fix #1 keeps the origin across chapter moves). It holds if the set counts as one trip. | low; a rule to write down |
| 7 | Today › Morning (Spurgeon) › tap his verse › its Understand | Page › page › reader › sheet. Depth is legal (pages push, one sheet), but the reader opened from a devotional needs "‹ Morning", not "‹ Today". | low |
| 8 | Reminder times on Today, and the Reminder in Settings | Two doors to one setting. That is allowed (as with Aa and Settings › Text) if both open the same page and write the same value. | low |
| 9 | Home › ⋯ holds Recent, Reading plans, Settings; Today is a row; Bookmarks and Search are icons | Five secondary destinations reached three different ways (a row, a menu, header icons). The menu has become the place where new things go. | medium |
| 10 | The widget gallery still says "A passage for today" | It now shows the day's psalms; its name should be "Today", or the two names will drift. | low |
| 11 | Today left open across 5 pm or midnight | The page must re-order or refresh on its own (on foreground and on a timer), as the widget timeline does. | low |
| 12 | A reader on the NKJV opens the morning psalms from Today | The reader shows the NKJV (display only). Today's rows, the widget and notifications stay BSB (rule 9). This holds. | ok |
| 13 | Back after three weeks (DR-09) | "Where you stopped" plus Today: two leads on one screen, but they are different jobs (my place, and the day). This holds if Today stops being a Home row (see the tab bar below). | ok |

## Why not a tab bar?

IA v3 (12 Oct) chose "one root, Home; no tab bar (the app has one job, reading)". That was right then. Build 7
changes the premise: Yada now has two daily jobs, **my place in the Bible** and **the day**. Findings 1, 4, 5 and 9
are all symptoms of squeezing a second job into one root.

**Recommended: three tabs, with Search on its own.** iOS 26 places a search button beside the tab bar.

| Tab | Holds |
|---|---|
| **Today** | the photo, the devotional, the day's psalms, your plan's next reading, the reminder times (DR-11) |
| **Bible** | today's Home: Continue (the one lead), Your plan, the books, and Bookmarks in its header |
| **Search** | the existing Search, now reachable from everywhere (fixes stress test #11) |

Settings and Recent stay in ⋯ on Bible (Reading plans goes with them). The ⋯ menu stops growing.

**How the rest follows:**
- **The reader opens full screen over the tabs**, as in Apple Books (mobbin.com/screens/d0fe94af-934c-4966-8935-ca0bcbbdc34b),
  so the reader keeps every pixel and no tab bar shows while reading. Its return chip names the tab it came from:
  "‹ Today" or "‹ Bible". This keeps build 6 fix #1.
- **The mini player sits above the tab bar** on every tab (iOS 26's bottom accessory), as in Brink's player under its
  tabs (mobbin.com/screens/96c7725e-7e81-4c8e-aa2a-6fc7b701d619) and Calm's (mobbin.com/screens/2deebcbc-5868-46ca-9142-39b5a38bfd28).
  That is item B, without a custom root overlay. In the reader, its own bar keeps Listen.
- **Doors from outside** (finding 3): content lands on the content, and "the day" lands on Today. The evening
  notification opens Psalm 6, with "Next this evening" leading. The morning widget opens Psalm 1. Siri's "Today in
  Yada" and Home's old row go to the Today tab.
- **Launch:** Yada opens on the tab the reader last used. The first launch opens Bible (Start with John). After a
  gap, Bible shows "Where you stopped" (MM-05).
- **Finding 2:** Today's plan row and Continue land in the same place (Continue's target) and use the same words.
- **AX5:** the tab bar has three items with labels, and iOS's large-content viewer covers long-press.
- **Reduce Motion and VoiceOver:** native tabs give the tab-bar trait and "Tab, 1 of 3" for free.

**Against, and why it's still recommended:**
- It reverses an approved IA decision, so it's John's call.
- A tab bar is more chrome on Home and Today. It hides in the reader, which is where chrome costs most.
- Each tab is a separate navigation stack, so Expo Router's route tree moves into `(tabs)`. The native-tabs API in
  Expo Router (SDK 57) must be checked for the bottom accessory before the frames are final.
- "Two jobs" could grow into five tabs. The rule to adopt: a tab only for a daily job; everything else goes in ⋯ or Settings.

**Rejected:** Apple Books' "Today's Reading 0:00 of your 5-minute goal" on its Home tab
(mobbin.com/screens/211bc94b-4f3a-4604-8e8d-9d47e1c41c3c), the same counter-example as the Fitness rings. A Library
tab: Bookmarks and Recent are too small to be a daily job.

**If John says no to tabs:** Today becomes Home's second lead, directly under Continue (above the progress line),
so finding 1 is fixed at AX5. Item B is built as a root overlay, and Search gets a door in the reader's header.
Findings 3, 6–8, 10 and 11 are fixed either way.

## Decisions for John

1. **Tabs:** Today · Bible · Search (recommended), or keep one root with Today as Home's second lead.
2. **Doors from outside:** a notification or widget that names psalms opens those psalms, and only "Today" opens
   Today (recommended).
3. **The widget's name:** "Today" (recommended), replacing "A passage for today".

Once John decides, the frames to draw are IA-15 (the tab bar on Today and Bible, Light, Dark and AX5), IA-16 (the
reader over the tabs, with the return chip naming the tab) and IA-17 (the mini player above the tab bar). DR-01 and
DR-09 change, and IA-11–13 are redrawn for v4.
