# Build 10: release gate list (18 Oct 2026)

Branch `claude/loving-cori-d57938`. The gates (CLAUDE.md): every plan item and assigned frame marked built or moved,
each built screen checked against its frame, a design-system pass, then deslop, review-code and security-check.
Frame-by-frame detail: `docs/qa/design-qa-2026-10-18/frame-inventory.md` (written before the six workstreams below
were merged; the rows they built are listed here). How every build is checked from now on: `docs/build-qa-lessons.md`.

## Plan items

| Item | Status | Where |
|---|---|---|
| 10a Return (RT-01–RT-08, BH-01) | built | app/return.tsx, start-small, remind-ask, rhythm, ChapterClose, EndOfBook |
| 10b Orientation and video (OR) | moved to Build 11 (11g), John 18 Oct | docs/build-11-plan.md |
| 10c Verses for a moment (VM) | moved to Build 11 (11h); handout and learn by heart (HO, LH) to Build 12 | docs/build-11-plan.md |
| 10d Book introduction (SC-01, SC-05, SC-06) | moved to Build 11 (11f) | docs/build-11-plan.md |
| The day's verse full screen, Earlier days, About this picture (DR-14, DR-16, DR-17, DR-19) | built | app/verse.tsx, earlier.tsx, picture.tsx |
| Your space: highlights, notes, Saved, share image (PS-01–PS-05, HM-02) | built | ActionBar, Verse, note.tsx, saved.tsx, share-image.tsx |
| Your reading | built as Saved's Your reading row (PS-04), opening Your rhythm | app/saved.tsx |
| Evening pictures (30) and seven morning swaps | built, approved by John 18 Oct | content/pictures, data/pictures.ts |
| iPad (TB-01–TB-03) and Duo (DU-01, DU-02) | built; Understand beside the text (TB-02/DU-02) not built | design/wide.ts, TabBar, Today, Page, Sheet, reader |
| Apple Watch (AW-01, AW-03) | built; compiles, not run on a watch | targets/watch, targets/watch-widget |
| Prayers of the Bible (PR-08), 39 approved | built | data/prayersOfTheBible.ts, today/pray/bible.tsx |
| Evening Daily prayer | built (BSB; 1979 lectionary, MIT) | data/office.ts, office.generated.ts |
| The collects | moved to Build 11 with John's yes (18 Oct 2026): no permitted source on disk (1662 BCP is Crown copyright) | Build 11 |
| Henry's 66 summaries | code and measurement done (exactly the 66 change); publish is John's step | packages/pipeline summaries.ts |
| Readers differ follow-ups | moved to Build 11 with John's yes (18 Oct 2026); to be defined there | Build 11 |
| IA v4: tabs, Search tab, mini player (IA-15–IA-17, DR-01) | built; our own tab bar (the native one took no taps) | components/TabBar.tsx |
| Understand, guide, Compare (W5: ON-04, VS, CP, UL, UX, PD) | built, see the W5 merge commit | 4d8c0a0 |
| Search and Contents (DI-03, DI-04, IA-06, PD-04, CT-01–CT-03) | built; VM-01's six moments need data (11h) | 3584bf2 |
| System surfaces (DR-07, DR-08, SX-10/12/17/22/23, X1, X2, BA-04, LB-10) | built | fb4875c |
| Pray and Today gaps (PR-07, XT-02/03, EB-01, DR-04, DR-11/12/15, IC-02, Pray keeps the tab bar) | built | cd569bb |

## Checked on the simulator (iPhone 17 Pro, iPad Pro 11)

Tabs (Today, Bible, Search) and the mini player; Today with Read and Listen, the day's verse, Earlier days with
morning and evening photos, About this picture; highlights, notes, Saved (all four lists), Share as an image with the
evening ground; Pray keeping the tab bar; Prayers of the Bible; evening prayer over the evening picture; Search's
Dictionary and Guides groups and a term page; Compare's marks; the guide's Next row; iPad portrait (top tabs, Today).

Not checked yet: iPad landscape sidebar (the simulator could not be rotated here); the watch on a device; widgets
turning at 17:00; Spotlight's Read and Listen on iOS 18; AX5 on the new screens; VoiceOver order on the new screens.

## Design-system pass

Added: `Pill`, `Segmented`, `FillPicture` (with a test keeping `absoluteFill` off pictures), `VerseImage`, `TabBar`,
`TextCapsule`, `design/wide.ts`, palette `highlights`, `swatches`, `BRAND` (the brand greens and chartreuse that were
hard-coded in seven files). Removed: `GlassText`, `AnchorIcon` (folded into its one screen), `palette.scrim`,
`FOREST`/`FOREST_DARK` aliases, the duplicate PD-05 line, `Bookmarks` (Saved replaced it).

## Gates

typecheck and tests: green (mobile 810). Security check: pass (no secrets, no new network calls, add-only Photos,
open texts only on the watch and share image). Review findings: fixed in e048a82, 9d87b3b, c6ca98a, 8be85cc.

## Signing

The two watch App IDs (`studio.yada.reader.watchkitapp`, `.watchkitapp.widget`) with App Groups
(`group.studio.yada.reader`) are registered by John in the developer portal; the App Store Connect key could not create
them (local archive, 18 Oct 2026).

## Decisions for John

1. The Live Activity at a stop now stays paused on "Stopped after 1:18" (SX-23), against build 6 decision 7.
2. With Daily psalms Off or Daily prayer, the Today widget shows the day's verse.
3. Two Daily psalms lines differ from DR-04 (Off; Daily prayer's description).
4. Henry: does "use new" approve the 66 texts? And when to publish.
5. (Moved to Build 11: a source for the collects, and what "Readers differ follow-ups" are.)
6. App Store review (not TestFlight) will need iPad screenshots.
