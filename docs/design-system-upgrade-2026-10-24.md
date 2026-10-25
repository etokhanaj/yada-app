# Design system upgrade: what to take from the YouVersion screens (adopted, 24 Oct 2026)

**Adopted by John on 24 Oct 2026**, items 1 to 8 and more: "adopt the new ds proposals and adopt new youversion patterns
even if they change our rules and they are good". Of the "Don't adopt" list, card shadows (for things people wrote) and
colour behind a category (photographs and tints, never coloured words) are now adopted; counts, ratings, badges, red and
all-caps stay out on merit. Drawn on the Build 12 canvas: https://claude.ai/artifact/K7W4ov2ti3cY2csqgXCb1h. The rules
moved into `CLAUDE.md` § Design and `docs/design-system.md` § Build 12 additions.

John shared 15 YouVersion Bible App screens (Home, Community, Friends, Add friends, My code, Moment, reader, Plans,
Discover, a plan list, You) and asked to "use this to upgrade our UI and design system". This is the proposal. Nothing
in `docs/design-system.md` changes until John says yes to each numbered item. Patterns are taken, never their brand:
no red, no YouVersion layouts copied whole.

## Adopt: fits Yada's rules as they stand

1. **One primary, docked at the foot of a task page.** YouVersion: Add friends' "Share my profile", the empty Plans
   page's "Find a Plan". Yada's rule already says "one primary pill at the foot" for full-screen moments; this widens
   it to any pushed page whose job is one action. **Built in Build 11 (24 Oct):** `PageScreen footer`, using the
   reader's docked bar (`BarFrame`), first on Sit with a verse. Next candidates: Ask for prayer, New circle, Plans.
2. **A trailing action pill on a row.** YouVersion: "Start" on a plan row, "Add" on a person, "Encourage" on a friend.
   Yada draws these by hand in Pray's rows. Proposal: `ListRow action={{ title, onPress }}`, a `card`-filled pill
   36 pt tall inside a 44 pt target, no chevron when it has one. One component instead of each screen's own.
3. **"See all ›" on a section.** YouVersion: Topics, Trending Plans, friend requests. Proposal: `SectionTitle link`,
   accent text, 44 pt target. First use: Saved on SV-01, People on Pray.
4. **An empty state with one way forward.** YouVersion's empty Plans: a glyph in a disc, a title, one line, one pill.
   Yada's empty states vary screen by screen. Proposal: `EmptyState icon title line action`, used by Your list,
   Saved, circles and Plans. The line stays one sentence (no "!").
5. **A row with a square picture.** YouVersion's plan rows: a 96 pt square, radius 12, a muted overline (5 days), a
   title, a trailing Start. Fits Reading plans and Bible prayers once they have pictures; the overline is a fact,
   never a rating.

## Adapt: the idea fits, the YouVersion form doesn't

6. **Actions under the day's verse.** YouVersion's verse card ends in a row of icon-plus-label actions (like, comment,
   share, More). Yada's version: Sit with this, Listen, Share, as glass capsules on the picture, no counts. Build 11
   took the first step: "Sit with this" is now a capsule, not underlined note text.
7. **Pill filters.** YouVersion: My plans · Find plans · Saved · Completed, the chosen one in ink. Yada has
   `Segmented` (a grey track, the chosen one raised). Keep `Segmented` for two to four equal choices (Build 11 uses it
   for Old and New Testament on the Bible tab). Use ink-filled pills only for filters that scroll sideways, and only
   when a screen has more than four.
8. **Two stat tiles.** YouVersion's You page: App Streak and Days this year side by side. Yada's Your rhythm sheet
   already leads with days this year; it could set "days in a row" beside it as a second tile. Never a "Best".

## Don't adopt: each breaks a rule John set

- Coloured topic tiles (Love, Anger, Anxiety, each its own colour): CLAUDE.md, "no coloured category labels". Pray's
  moments stay as Literata chips.
- Like, comment and share counts (886.6k), star ratings on plans: design-system.md, "no counts that shame"; John,
  18 Oct, "no rank, score or count".
- Cards with drop shadows (Friend requests, Moment): CLAUDE.md, cards have "a soft fill, no shadow".
- Badges and "Best: 3": gamification Yada has kept out. John's call if it ever changes.
- A red primary (Share my profile) and red tab underline: Yada's primary is ink, forest on full-screen moments.
- ALL-CAPS labels and exclamation copy ("a topic that interests you!").

## Questions for John

1. Yes or no to each of items 1 to 8.
2. Pray says "Morning prayer" and Today "Morning devotional" until the evening part starts, so at 2:45 pm Today says
   "Good afternoon" over a "Morning devotional". Keep the two-part day, or label it "Midday" from noon?
3. The Bible tab's title was the wordmark; Build 11 makes it "Bible", like Today and Pray. Is the wordmark wanted
   anywhere else (launch, Settings › About)?
