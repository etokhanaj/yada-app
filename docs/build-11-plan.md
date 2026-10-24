# Build 11 plan

John, 18 Oct 2026. Plan only; nothing built. **Build 10** is 10a (Return) plus the items John moved into it, going out
from `claude/loving-cori-d57938`. Build 11 holds the rest of `docs/build-10-plan.md` (on
`claude/funny-brahmagupta-a36845`), Pray v2, and the Pray and Circles rebuild John asked for on 18 Oct.

- Every screen, mapped to code: `docs/build-11-screens.md`
- Colour: `docs/colour-rules.md`
- Frames: https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ (Build 11 canvas, 37 frames, **approved by John on 18 Oct 2026**; audit: `docs/build-11-ux-audit.md`), plus the
  approved Build 10 frames (SC, OR, VM) on https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc
- Rules: CLAUDE.md (gates: plan-and-frames QA, design system pass, no polling, replace don't layer)

## Phases, in build order

| Phase | Contents | Needs John first |
|---|---|---|
| **11a** Pray safety | Reports queue in the review tool; schema in Production (`docs/pray-ask-plan.md`) | CloudKit server-to-server key |
| **11b** Colour pass | C1 to C7 in `docs/build-11-screens.md`: one forest, tokens for text on pictures, destructive in ink, switches in accent, circle and avatar tones, a test against stray colours | this plan |
| **11c** Pray and Circles | PC-01 to PC-13, PC-23, PC-24: Pray as a place, new circle in three steps, a circle's page, joining, people, your list, empty states | canvas approval |
| **11d** Prayer notifications | PA-01 to PA-03 | push on the App ID |
| **11e** Pray together | PC-14 to PC-22: SharePlay over FaceTime, planned times, calendar | the Apple group-session entitlement |
| **11f** Book introduction | SC-01, SC-05, SC-06, SC-07 to SC-09 | unfoldingWord credit wording |
| **11g** Orientation | OR-01 to OR-09 | each book's data; BibleProject's reply |
| **11h** Verses for a moment | VM-01 to VM-04, VM-08 to VM-11 | topics and references in the queue |
| **11i** Web passage pages | approved passages on yadabible.com | which passages |
| **11j** Reading and understanding | RU-1 to 8, 10 to 12, 14, 17, 18 built; RU-9, 13, 15, 16 no change; RU-19 at upload (below) | frames approved by John 23 Oct 2026; QA on screen (Light, Dark, AX5, VoiceOver) before upload |

If credits run short, cut from the bottom: 11i, 11h, 11e. Never 11a or 11b. One push per phase.

## 11j Reading and understanding (fresh-eyes review of John 1, 23 Oct 2026)

A first-time reader's walk through John 1:1–18 in Build 11 on the simulator. The verse page (plain words, the Greek
word by word, the Genesis echo) is the strongest screen; the first explanation a reader meets is the weakest, and the
best one (Tyndale on what "the Word" means) sits three taps down.

| ID | Item | State |
|---|---|---|
| RU-1 | Key words from a passage showed its raw ref ("JHN.1.1-1.18") as the subtitle; it now reads "John 1:1–18" | built (`UnderstandPages.tsx`) |
| RU-2 | A key word's line fits the verse. Translation Words keeps the whole Definition section, and each verse's key word carries the article's own sentence that quotes the verse's words (John 1:1: "In the New Testament, Jesus is called “the Word”…", not "anything God has communicated"). Sentences that lean on another, end in a colon or say nothing are passed over. Every book's Understand bundle rebuilt; publishing is John's step | built; all 66 bundles published 24 Oct 2026 (live manifest f98713f5) |
| RU-3 | Understand opens with the plain words, then the one question the passage raises answered by the study note's own sentence (John 1: "Who is “the Word”?"), then Go deeper | built (b28224c, f2f2729) from approved frame RU-03; not yet checked on screen |
| RU-4 | "In short" for John 1:1–18 reads as stitched sentences ("But Jesus, the Unique One, is God." with no contrast; an unexplained grey italic phrase). Review the summary rule on the passages John reads first | built: In short is a Go deeper row and page (b28224c); JHN.1.1-1.18's summary is in docs/held-summaries-2026-10-23.md for John |
| RU-5 | The verse page in reading order: Explained before Go deeper, Sources last | built (b28224c, f2f2729) from approved frame RU-05; not yet checked on screen |
| RU-6 | The reader in paragraphs (the BSB's own breaks), verse numbers inline, instead of a line per verse | built (b20824e): BSB paragraph starts in data/paragraphs.generated.ts (scripts/sync-paragraphs.mjs); not yet checked on screen |
| RU-7 | Highlights as a tint on the words, not a rounded box per verse; the selected verse distinct from a green highlight | built (b20824e): tint behind the words; selection = wash + 3 pt accent bar |
| RU-8 | Say what the speech-bubble mark is (Readers differ); the "About John" handle no longer catches a scroll near the foot of the page | built (b20824e): the mark is a 48×44 button opening the verse’s Understand at Readers differ (b115996). The handle: no change |
| RU-9 | One play control on the reader (not ▶ and "Hear this passage"); one way into search on the home screen | no change: the reader's ▶ plays from where you are, Hear this passage (in Understand) from the passage's start; on iPhone search is only the tab button |
| RU-10 | The Bible tab: a quick way to a chapter (a book's chapter grid, or typing "Rom 8") instead of scrolling 66 names | built (fc08017): a book opens its chapter grid in place; approved with the numbers centred |

Decided 24 Oct 2026 (John: "suggest for these and do"):
- The heading "From the study notes" stays. It says the sentence under it is Tyndale's, not Yada's; a question as the
  heading would read as Yada speaking.
- "In short" stays a Go deeper row. Its summaries still read as stitched sentences in places (RU-4); it can lead again
  once they are reworked.
- Plans on Today: already there. Today's plan card leads with the plan's next reading, and with no plan it offers
  Reading plans; nothing to add.
- After the John plan: Today used to offer "A place to start: The Gospel of John" again once all of John was read. It
  now says "You've read John" with Choose what's next, opening Reading plans (M'Cheyne). A second book explained
  passage by passage waits until its entries are approved.

### The other main flows (same review, 23 Oct 2026)

Today, listening, search, plans, Pray, settings, then dark mode at AX5. Strongest: Today's evening page (the day's
verse on the picture, the psalms with Read and Listen, Spurgeon, Continue, Pray), the player (word-by-word highlight
as it reads), and search (a reference jumps straight there; a word finds the dictionary, guides, Greek and Hebrew,
then verses).

| ID | Item | State |
|---|---|---|
| RU-11 | AX5: Settings rows break words mid-word ("Daily psalm / s") and clip values ("1662 Prayer Bo", "Hea…"); stack label over value at accessibility sizes | built (`ListRow`) |
| RU-12 | AX5: the mini player covers the reading card's buttons on Today; content needs bottom padding for the player and tab bar on every screen (also covers Search's Dictionary row at default size) | built (`useTabBarClearance` measures the bar) |
| RU-13 | The daily reminder is off by default and sits four taps deep (Bible → … → Settings → Reminder). Ask once after the first reading is finished (`remind-ask` exists), and give Today a way in | already built in 10a (`remind-ask`, asked once the first passage is read); not seen in the review because no passage was finished |
| RU-14 | Reading plans and Settings live in the Bible tab's "…" menu; a new reader won't find them. Plans belong on Today or Bible's first screen | built (fc08017): Reading plans row under Continue; left the More menu |
| RU-15 | Two plans only (John; M'Cheyne, four chapters a day). A gentler whole-Bible or New Testament plan for a beginner | no change: John passage by passage is the gentle plan; what comes after John is John's call |
| RU-16 | Search verse results run Genesis first by design; for a word like "forgive" a reader wants the best-known verses first. Offer "Most relevant" beside Bible order | no change: one-word relevance would rank short verses first and Yada has no data on best-known verses; Bible order stays |
| RU-17 | Today's lamp pill ("0") says nothing to a new reader | built: the unlit lamp alone, no number |
| RU-18 | Pray shows today's line from your list twice (in the picture and in Your list), and "New circle" is said twice (card and caption) | built: hero line only with more than one item; caption "Up to 12 people in a circle." |
| RU-19 | The simulator build says 1.0.0 (10) in Settings; check the build number is raised for 11 | not raised: build.json and Info.plist say 10; raise at upload |

RU-2 note: the rebuilt bundles are on disk only. The manifest (`yada manifest`), the app's dictionary
(`sync-dictionary.mjs` reads the manifest's bundles) and publishing to R2 are John's steps. Romans 8:1 "Jesus" now
leads with the article's sentence on "Christ" (the verse says "Christ Jesus"): source words, but worth John's eye.

QA before upload (none of 11j has been seen on a screen: the simulator build fails on the Watch widget,
`containerBackground` needs iOS 17): each RU frame in Light, Dark, AX5; VoiceOver through a paragraph (each verse
is a transparent element over its lines, overlapping where two verses share a line); Maestro flows that tap a verse
by testID (01, 07, 08, 09, 11) may land on a neighbour on a shared line; the spoken-word pill can shift verse
elements by up to a word while audio plays. Not yet looked at: Check what you read, Circles with members.

## Decided on 18 Oct 2026 (carried across every Build 11 frame)

| Decision | Applies to |
|---|---|
| Pray is a place: the day's picture, a line from your list, then the people waiting | PC-01, PC-12, PC-13 |
| The forest card is only for the next action; empty states use the quiet `card` surface; never "0 waiting" | PC-01, PC-12, PC-13, every future empty state |
| On forest or dark: chartreuse on the one action and at most one mark; kickers and meta in muted white, sentence case | all forest screens |
| Each person has one avatar tone, from their id, on every screen; the inviter or speaker gets a chartreuse ring, never a new colour | PC-01, PC-04, PC-05, PC-07, PC-08, PC-14, PC-16, PC-18 |
| A circle shows its twelve places | PC-02, PC-05, PC-07 |
| Destructive words in ink; red only on a final confirm button | PC-06, PC-10, PC-11 |
| Your list: Add is a sheet like Ask; items have Mark answered, Edit, Remove with Undo | PC-09 to PC-11 |
| Pray together uses SharePlay over FaceTime; Yada shares only the request on screen; nothing recorded; the one who planned a time rings those coming | PC-14 to PC-19 |
| Planned times: one per circle, once or weekly; I'll be there; Add to calendar; reminders carry no request text | PC-17 to PC-19 |

## QA steps for every phase (lessons from Build 10)

From the Build 10 session (`docs/build-qa-lessons.md` on its branch). In Build 10, screens were counted as built because
a comment named their frame: tapping Today's picture opened the reader where DR-16 says the day's verse, and highlights,
notes, Saved and Share as an image (PS-01 to PS-05) were never built. QA was screenshots only, so the native tab bar
(`unstable-native-tabs`) passed while it took no taps, drew no glass and showed a stray strip of picture.

1. **Start:** list every plan item and every canvas frame assigned to the phase. The newest frame of a screen wins.
2. **Built means behaviour:** a frame counts only when its copy, its controls and where each tap goes match, cited
   file:line. A comment that names a frame proves nothing.
3. **Tap-test** every changed screen on the simulator: every control, tabs and back included. Then Light, Dark, AX5,
   Reduce Transparency on and off, and VoiceOver order.
4. **Beta components:** before building on a beta or `unstable_` component, prove taps, rendering and both themes. If
   any fail, draw it ourselves. For 11e, prove SharePlay on two devices before drawing PC-16 in code.
5. **End:** each row marked built (file:line) or moved, with John's yes and where to. Anything else blocks the upload.
   The list goes in the upload or PR notes, with the design system pass and the colour rules.
6. **Earlier QA reports are leads, not truth:** re-check each against its frame.

PS-01 to PS-05, DR-14, DR-16, DR-17 and DR-19 are built and tap-tested on the Build 10 branch (7ead8a9, per its session). If Build 10 ships without that commit, they join 11c's list before anything new. Still open in Build 10: the 30 evening pictures (John deciding whether to source them) and W5 (Understand, guide and Compare, with ON-04's Next passage); whatever Build 10 doesn't ship moves here with John's yes.

## Moved in from Build 10 (John, 18 Oct 2026)

| Item | State | Next |
|---|---|---|
| **The collects** | no permitted source on disk: the 1662 Book of Common Prayer is Crown copyright in the UK | find an openly licensed or public-domain source (the 1979 US collects, copyright relinquished, per `docs/build-8-plan.md` §3), read its licence from the file (rule 3), then John chooses |
| **Readers differ follow-ups** | not defined yet | John says what they are; until then nothing is built |

Build 10 shipped to TestFlight as 1.0.0 (10) from `claude/loving-cori-d57938` (8ebb8ba); PR #16 is open and not merged.
Henry's 66 summaries are steered in #16's pipeline (exactly the 66 change); approving the texts and publishing stay
John's steps.

## Moved to Build 12

- The handout (HO-01) and learn by heart (LH-01 to LH-03).
- Other languages: a spike only, blocked until John names a reviewer for that language (rule 2).

## Moved into Build 10 (John, 18 Oct 2026)

Prayers of the Bible (39 approved, `docs/review-2026-10-18-henry-prayers.md`); Henry's 66 summaries (the content
rebuild, `docs/content-rebuild-plan.md`); evening Daily prayer and the collects; Readers differ follow-ups; from build 7
the day's verse full screen, Your reading, iPad, Apple Watch, evening pictures. Out until there is evidence: hosted
video, Android.

## What John decides first

1. ~~Approve the Build 11 canvas~~: approved 18 Oct 2026. Next: 11a, steps in `docs/build-11a-plan.md`.
2. Create the CloudKit server-to-server key; check the schema is in Production.
3. Open questions: members' names (drawn: first names they choose), a circle description (not drawn), Pray as its own
   tab (PT-01).
