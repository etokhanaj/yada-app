# Build 8 content plan: what is not approved, summaries, Readers differ (draft, 15 Oct 2026)

A proposal for each item in `docs/build-8-plan.md` §4, §4b, §5 and §7. Nothing here is built yet. Rules:
CLAUDE.md. John writes nothing and is never cited, and only John approves (rule 2). Every sentence shown is a
source's own words, verbatim. Licences are read from the source (rule 3). Nothing is guessed (rule 4).
Licensed text stays out (rule 9), and a Tyndale sentence with a Bible quotation in it is skipped, since
Tyndale quotes the NLT.

Measured on 15 Oct 2026 from `origin/master` (3cee5a2), `build-next-release` (7e41cd3) and
`content/bundles/core.v5.db`.

## A. John's Extracts queue (needs only John)

**What is waiting:** 28 drafts, not 29.
- **16 book introductions:** Genesis, plus Tyndale's opening for 15 of the 16 John rejected.
- **The 17th, Zephaniah,** is still empty (see C1).
- **12 grammar terms:**
  - From Machen: accusative, genitive, dative, middle, perfect, optative.
  - With a spelling slip corrected and noted: passive, imperative, pluperfect, Qal, Pulal, Peal.

**Proposal**
1. John reviews all 28 in the Extracts queue. The queue is ready and needs no build. Order:
   - Galatians first. Decision #22 asked that its "salvation is through faith alone" be checked at review.
   - Then 1 Thessalonians. It is one sentence of 19 words and the shortest draft.
2. After his decisions:
   - `yada grammar --write`.
   - `yada intros --write`. This keeps every approval, because each approval holds only while its text is
     unchanged.
   - An Understand rebuild of the books whose introduction changed status.
   - A dry-run report, then publish through the manifest.
   - No app build is needed: an approved item shows at the next launch.
3. Anything John rejects moves to C with its reason, and is never re-offered as a draft (decision #24).

## B. The gloss bug found while checking the Aramaic gaps (fix first, affects what ships today)

**4,975 Hebrew and Aramaic words in core v5 have no English gloss.** 3,103 of them are the last word of a
verse, including Genesis 1:5's.

The cause: TAHOT writes a verse-final word as `מַלְכִֽין\׃\ \ס`. `normalizeHebrew`
(`packages/schema/src/search.ts:29`) keeps every Hebrew letter, so the paragraph mark ס or פ stays on the end
and the word never matches OSHB's.

**Done, 15 Oct 2026** (`tahotSurface` in `glosses.ts`):
- **The fix:** a trailing paragraph mark is dropped before normalising. Cutting at the first `\` would have
  lost letters in three rows where a maqaf or paseq joins a second word (Kedorlaomer, Genesis 14:17).
- **Measured against core v5:**
  - Unglossed Old Testament words go from 4,975 to 1,816.
  - 3,159 words gain TAHOT's own gloss.
  - None loses or changes one.
  - Biblical Aramaic goes from 173 to 128.
- **Dry run, 15 Oct 2026:** built in this worktree against a snapshot of `staging.db`, with private bundle
  links and manifest. Nothing shared was written.
  - Core v6 against v5: words, verses, texts, counts and search forms are identical.
  - 3,159 words gain a gloss, and their morpheme glosses with them. No existing gloss changes.
  - 94 words' headline gloss shifts with the new counts.
  - The credits table now carries `sources.manifest.json` in full: 22 rows added. The bible-api WEB excerpt
    row is dropped and the LSV attribution updated. Henry and Easton are listed, but the app hides them.
  - `publish --dry-run`: 4,473 bundles verified by sha256 and size; core.v6.db is the only new one.
- **To publish, John's step.** The fix is on a branch from master, where build 6 already is (3cee5a2), so
  build-6 is not needed.
  - **The hazard:** `content/audio-work/run/publish-loop.sh` runs `publish --confirm` on the shared
    `content/bundles` every two hours (next about 21:32 on 15 Oct). Anything placed there goes live at its
    next run, so nothing goes into the shared bundles before John says publish.
  - **The steps:**
    1. Tell the build-next-release session.
    2. Copy the dry-run core.v6.db (sha256 `ff0e41a6…`) into the shared bundles. `package` writes through
       `core.building.db` and a rename, so a reader never sees a half-written file.
    3. Set the core entry in the current shared manifest.
    4. Run `publish --dry-run`, then `publish --confirm`.
  - **Before the next real normalize:** check that nothing is reading the shared `staging.db`.

This uses no new source and invents nothing: the gloss is TAHOT's own (CC BY 4.0). It should run as its own
session, since it touches the core bundle every book uses.

## C. What build 6 left empty (§7)

### C1. Zephaniah's introduction

Tyndale's opening paragraph ends on a sentence with no quotation and no reference:

> "Zephaniah's prophecy portrays the coming judgment, but it also presents God's promise that his faithful
> people will one day enjoy a world of everlasting righteousness and joy."

`cut()` stops at the question before it, which leaves an 8-word fragment.

**Proposal:** one rule in `intro.ts`. When a paragraph's opening is a quotation, a question or a fragment,
skip to the first sentence after the last question, and take it if it passes the length and quotation
checks. Test it on Zephaniah, and run it across all 66 books to confirm it changes no approved introduction.

The result goes to John's queue as a draft. Two fallbacks if he rejects it:
- Tyndale's Summary paragraph 2, sentences 1–3. They carry verse references, and stripping those would be an
  adaptation that has to be credited.
- Leave Zephaniah empty.

The plan's suggestion, Tyndale's Setting paragraph, is history and does not say what the book is about, so it
is not proposed.

### C2. Greek aorist

There is no clean public-domain text that says it well. The candidates:

| Source | Sentence | Text quality | Licence |
|---|---|---|---|
| **Burton, *Moods and Tenses* §35 (1898; Burton d. 1925)** | "The constant characteristic of the Aorist tense in all of its moods, including the participle, is that it represents the action denoted by it indefinitely; i.e. simply as an event, neither on the one hand picturing it in progress, nor on the other affirming the existence of its result." | archive.org OCR only. Four copies agree; "i.e." is mangled | public domain |
| Robertson, *Grammar* p. 832 (1914; d. 1934) | "The “constative” aorist just treats the act as a single whole entirely irrespective of the parts or time involved." | OCR only | public domain |
| Smyth §1923 (1920; d. 1937) | "The aorist expresses the mere occurrence of an action in the past. The action is regarded as an event or single fact without reference to the length of time it occupied." | clean (Perseus) | Perseus's file states no licence; Smyth's own text is public domain |

**Proposal:** Burton §35, checked word for word against the page scan, as Machen's sentences were. It is the
only one that names the whole-event view without jargon. It is 49 words, long for a grammar line (choice J3).

### C3. Hebrew absolute, construct and cohortative

Use Gesenius from **English Wikisource**. The transcription is clean, the Hebrew is in Unicode, one page per
section. The footer says CC BY-SA, the same as Tyndale's licence; the 1910 text itself is public domain.
Credit the line as "Gesenius' Hebrew Grammar (Kautzsch–Cowley, 1910), Wikisource transcription, CC BY-SA".

- **Absolute and construct, §89a:** one sentence defines both. "Thus in Hebrew only the noun which stands
  before a genitive suffers a change, and in grammatical language is said to be dependent, or in the construct
  state, while a noun which has not a genitive after it is said to be in the absolute state."
  - "Thus" points back to text the reader won't see, and decision #24 forbids a cut that leaves a sentence
    setting up another.
  - Offer it to John for both terms as is. The words cannot be changed.
- **Cohortative, §48e:** "The cohortative expresses the direction of the will to an action and thus denotes
  especially self-encouragement (in the 1st plur. an exhortation to others at the same time), a resolution or
  a wish, as an optative, &c., see § 108."
  - The trailing "see § 108" and the "&c." are the source's own, so they stay. The sentence is a draft for
    John.
- **Pinning:** pin the Wikisource revision ids, and save the fetched HTML with a sha256, as the other raw
  sources are.

### C4. The rare stems (Hebrew Hishtaphel and Tiphil; Aramaic Hishtaphel and Ishtaphel)

Nothing open states the reflexive reading.
- Gesenius §55h lists Tiphel only as "more or less doubtful", with one example and no meaning.
- Gesenius analyses הִשְׁתַּחֲוָה as Hithpalel (§75kk), not Hishtaphel, which contradicts STEPBible's label.
- en_uag is unchanged since Oct 2023. Its stubs repeat "active voice".

**Proposal:** these stay empty for good (rule 4), unless a source turns up later. They are rare (השתחוה is the
only common verb), so the word screen shows the parse with no explanation line, as today (choice J4).

### C5. Aramaic grammar terms

- **en_uag:** unchanged since 6 Oct 2023.
  - `state_determined.rst` is still a copy of the absolute-state article.
  - There are no articles for ithpeel, polel, hithpolel, hithpoel, directional he or the object marker.
- **Older English grammars exist only as OCR:**
  - Winer, translated by Hackett (1845).
  - Riggs (1866).
  - Their Hebrew script is unreadable, but some definition sentences have no Hebrew in them.

**Proposal**
- **Determined (emphatic):** use a definition sentence from Winer or Riggs that contains no Hebrew script.
  Check it against the page scan, as Machen's were, and hold any OCR doubt for review.
  - Winer: "In addition to the absolute and construct state, we have here also the status emphaticus, or
    emphatic state, as it is termed, and which was designed originally to express the noun with the definite
    article."
- **Absolute, construct, Hithpeel, Hithpaal and Ithpaal:**
  - Search Riggs and Winer for a definition sentence. Riggs uses the names Ithpeel and Ithpaal, and
    STEPBible's own codes decide which term each one fits.
  - Where neither defines a term in a plain sentence, it stays empty.
- **Hithpolel, Hithpoel, directional he, the object marker, Hishtaphel:** nothing exists, so they stay empty.

### C6. Aramaic glosses and Strong's numbers

The §7 counts were inflated: the query matched every morph code starting with `A`, which includes MorphGNT's
Greek adjectives. Biblical Aramaic alone is 4,948 tokens: **173 with no gloss and 116 with no Strong's.**

**Proposal:** pipeline fixes using sources already pinned. Nothing is guessed.

1. **43 glosses:** the paragraph-mark bug (B).
2. **119 glosses:** ketiv tokens. Pair each with its qere through OSHB's own `<note><rdg>`, or TAHOT's `K=`
   column (72 match uniquely), and take that gloss. Mark it as the qere's gloss.
3. **The rest:** a gloss from TBESH's Gloss column, matched by the token's own Strong's (CC BY 4.0, already
   pinned; this column, not the BDB "Meaning" column, which needs Online Bible's permission). That fills 171
   of the 173.
4. **18 Strong's:** the compound names `5665+` and `8370+` (Abed-nego, Shethar-boznai).
   - OSHB's `+` marks the first word of a two-word name. Across the Old Testament, 801 words carry it.
   - Giving those words the name's number would make the word screen count and list each name twice, since
     occurrences are counted per token.
   - Needs a packaging rule first: the `+` word takes the number but is not counted. Held as a follow-up.
5. **1 Strong's:** Daniel 3:29's `c/m/4481`. Not fixable safely.
   - A "sole numbered lemma part" fallback would touch 78 words.
   - In many of those, OSHB's lemma and morph disagree. Amos 6:14's `m/l/935` against `HR/Np` would make
     "Lebo" the verb "come".
   - Choosing a number there states a parse the data contradicts (rule 4). Left empty.
6. **97 Strong's:** these are a preposition with a suffix (לַנָא, בַּהּ). Strong's has no number for them,
   and Hebrew is handled the same way. Reclassify them as "no Strong's exists", not as a gap.
   - Never use TAHOT's H9003/H9005 or MACULA's `3807b`. They are those projects' own codes, and in
     HebrewStrong.xml H3807 is a different word.

Result: about 2 tokens without a gloss, and no Strong's gap that can be filled. Every gloss is a source's own.

## D. Passage summaries (§4)

**Ownership:** `summaries.ts` and John's summary review belong to the build-next-release session (*Build the
next release from the build plan*, idle since 18:20). Nothing below is edited until it hands over or does the
work itself (choice J1).

**What was measured:** Henry's outline lines against John's 72 "needs a fix" notes.

| Henry match | Passages | |
|---|---|---|
| Same start, at most a third longer | 28 | about 11 are statements ("Herod causes the infants of Bethlehem to be massacred"; "Abimelech destroys Shechem"); the rest are labels ("The plague of frogs.", "The Preface.", "Christian salutations.") |
| A wider section covers it | 22 | e.g. Genesis 46:16–18 inside 46:5–27 |
| No section | 22 | Daniel 6:10–24 among them |

Parser faults to fix first:
- A "Chapter Outline " prefix leaks into the line (Galatians 1, Philippians 2).
- A clause fragment appears as a line ("and to practise the duties…", Colossians 3).

**So Henry as lead sentence alone fixes about a sixth.** The larger gain is using Henry's line and the BSB
heading to **choose** which UST sentences appear, without showing Henry's words. Daniel 6 then gets the verse
with the lions; Mark 12 gets the coin; 1 Timothy 3 gets the qualifications.

**Proposal, in this order, each measured across all books and every newly shown summary read:**
1. **Henry parser fixes and a statement test.**
   - Strip the prefix and drop fragments.
   - Count a line as a statement only if it has a subject and a finite verb. Label lines never lead.
2. **Main-event selector:**
   - Take the content words of the matching Henry line, the BSB headings inside the passage, and tN's
     chapter-introduction part for it.
   - Score each UST sentence by its overlap with them.
   - A summary must include the best-scoring sentence when it scores above a threshold set on John's 72 notes.
   - Henry's words are never shown by this step.
3. **Henry lead line:** only for a statement whose range matches (rule above), placed before the UST
   sentences and credited "Matthew Henry, Concise Commentary". Rule 9 is clear: Henry quotes the KJV.
4. **Length by passage size:**
   - 2 sentences up to 12 verses, 3 up to 24, 4 beyond (Deuteronomy 20, Hebrews 10:19–39).
   - A list passage (Ezra 2, Nehemiah 10) gets its heading, one sentence and the source's own total verse
     (Ezra 2:64), in the genealogy layout that exists already.
5. **BSB in place of a drifting UST sentence (Jeremiah 13:14, Isaiah 53):** a drift cannot be detected
   reliably. Add a review-tool action, "Use the BSB for this verse", on a summary sentence. John chooses a
   source's words; he writes none.
**Built and measured, 16 Oct 2026:**
- **D1 is done:** the parser fixes, and `isStatement` to tell a statement from a label.
- **D2 is built but not switched on.** `summarise` takes `steer` lines, Henry's outline for a closely matching
  section; their words only lift sentences and are never shown.
  - On all 66 books it changed 284 of 2,923 summaries, and only 6 of the 72 fix notes. Daniel 6 regains the
    lions, Acts 9:23–25 names Saul and the basket, Ezra 2 is less of a raw list. But Judges 2:6–9 becomes too
    thin and Hebrews 11 loses Jacob.
  - The flagged count is unchanged (52).
  - Every change is in `docs/research/henry-steer-2026-10-16.txt`.
  - **To switch it on,** `loadBook` would pass `henry: mhcSections(book)`. That waits for John to read the
    changes, and the golden pass counts would need updating.
- **D3 to D6 are not started.** The measurement says steering alone does not answer most fix notes. They need
  the larger budget (D4) and the per-verse BSB action (D5).

6. **More Tyndale sentences (5a):** stays held. When a commentary sentence and a Henry statement both
   qualify, Henry's statement leads and Tyndale's stays out, since Tyndale tends to comment rather than name
   the event (Exodus 2).

**The four summaries John wrote** (Exodus 35:4–9 and 35:10–19, Proverbs 24:21–34, Jeremiah 25:34–38):
- Showing them would put Yada's own words in the app.
- Proposal: use each only as a brief for choosing source sentences, as decision #22 did with John's Genesis
  draft. The passage stays held until the selector produces a summary that matches the brief, and John
  approves it (choice J2).

## E. Readers differ (§4b, §5)

**State on `build-next-release`:**
- 28 passages show.
- The 14 round-2 passages are already loaded (Hosea 1:2, 1 Peter 3:18–20, 1 Corinthians 7:36 and the
  others).
- 16 draft positions await John.
- 11 passages have only one side approved.
- The harvester's batch 1 holds 131 candidates over 180 passages.

**Proposal**
1. **John's next sitting: the 16 drafts.** Nine of them can complete a passage on their own: Genesis 1:26,
   Job 19, Proverbs 8, Jeremiah 31, Romans 13, James 2, Ezekiel 38–39, Romans 11:26 and 1 Timothy 3:11. The
   review tool already asks for a side and an axis on approval.
2. **Close a hole in the harvester before John reads batch 1.**
   - Rule 9 is enforced only by translation names (`NAMES_LICENSED_TRANSLATION`). Nothing catches quoted
     Bible wording in a Tyndale sentence, and the verse-reference check ignores references in parentheses.
   - Add a check: a Tyndale sentence with a quoted span longer than two words is refused unless that span is
     the BSB's, WEB's, KJV's or LSV's wording for the cited verse.
   - Then re-check the approved positions. One approved Ezekiel 28 line quotes "the prince of demons"
     (Matthew 12:24). It matches the BSB word for word as well as the NLT, so it passes the check. It is
     listed for John (choice J5).
3. **Genesis 1:1–2:3** has two approved "ordinary days" sentences and no second side. Search the
   public-domain commentaries already pinned, then a named 19th-century day-age source if needed. Every
   sentence is checked against its scan before it becomes a draft.
4. **Micah 5:2** stays `held` (three rejections, no second reading in the sources).
5. **Harvester batch 1:** about 100 at a time, after step 2, as §4b planned.

## F. Order of work

| Step | What | Needs |
|---|---|---|
| 1 | John: the 28 Extracts drafts, the 16 debate drafts | John only |
| 2 | B: the paragraph-mark gloss fix, core rebuild, publish | separate session |
| 3 | C6: ketiv pairing, TBESH gloss fallback, Strong's regex | after B |
| 4 | C1 Zephaniah rule; C2, C3 and C5 sentences pinned and checked against scans, as drafts | J3 |
| 5 | E2 harvester quotation check, then batch 1 for John | J5 |
| 6 | D1–D6 summaries | J1, J2 |
| 7 | After John's decisions: `yada grammar --write`, intros, Understand rebuild, dry run, publish | John's approvals |

**Rebuilds and publishes:**
- **Where they run:** from the build-6 worktree, which carries the intros, word links and places.
- **Who to tell first:** the build-6 session and the build-next-release session, so two runs never write the
  manifest at once.
- **Watch for the audio loop:** `content/audio-work/run/publish-loop.sh` also writes the manifest every two
  hours.
- **The summaries golden test:** it calls `summariseBook` with `reviews: new Map()`, so it measures the rules
  alone. Keep it that way.

Gates for each push: typecheck, test, the secrets hook, then `/deslop`, `/review-code` and `/security-check`
before any PR. John is asked before every `git push` and every `gh pr create`.

## G. App items for the next build (John, 16 Oct 2026)

1. **Website links:** yadabible.com is live (16 Oct 2026), so Settings links to Privacy, Terms and Support there.
   Ships with the next TestFlight build, not on its own. In App Store Connect, the Privacy Policy and Support
   URLs are John's to fill in now, with no build needed.
3. **A reminder prompt when reminders are off (John, 16 Oct 2026).** iOS shows its permission dialog only once, so
   this is Yada's own quiet prompt, not the system one.
   - **When it shows:** after a reading, and only when no reminder is set.
   - **How often:** at most once every 14 days, and three times in all. After that, only Settings offers it.
   - **What it says:** one line and two buttons, "Set a reminder" and "Not now", in keeping with the no-guilt
     rule (never "you missed").
   - **When iOS has already said no:** "Set a reminder" opens iOS Settings.
   - **Before building:** draft it with `/design` from Mobbin references, with the cadence for John to confirm.
4. **Search, a Greek or Hebrew word:** search is a full-height sheet, and a word result opens the word page
   (`evidence`) as a second sheet on top of it. Not what John meant: the shadows he saw were on the website's
   mock-up, where the canvas drew each gloss as a widget card (class clash, fixed 16 Oct 2026; images handed to
   the website session). The stacked sheets remain a smaller question for later.

## H. Notifications (John, 17 Oct 2026: "a notification system, e.g. verse of the day with a streak message, as YouVersion")

**What Yada sends today (build 7):**
- One morning reminder: the next passage, or "A passage for today".
- The evening psalms, if chosen.
- The rich content extension shows the passage itself.
- One reminder replaces the last (decision #4).
- The ask to turn reminders on: 3 days after a Not now, then every 14 days, four asks in all (built 16 Oct 2026).

**Proposed, under the no-guilt rule:**

| Notification | When | Note |
|---|---|---|
| Streak line on the morning reminder ("4 days in a row") | only on the reminder scheduled at the last open, and only when that open kept the streak | the following days' reminders, scheduled ahead, carry no count, since it could be false by then; never "don't lose your streak" |
| Week in review, Sunday evening ("You read on 5 days this week") | optional, off by default | counts only, never a missed day |
| A prayer you prayed for was answered | Pray v2 | needs CloudKit (below) |
| Pray again on a request you held | Pray v2 | local only, no text |

**John to decide:**
- (a) The streak line: yes or no.
- (b) The weekly review: yes or no.
- (c) At most one notification a day besides the evening psalms: yes or no.

Then draft the screens with `/design`: Settings, Notifications, one row per kind.

## I. Pray v2 is blocked (build 7 session, 17 Oct 2026)

Build 7 shipped without the CloudKit entitlement: the archive failed, so the iCloud lines came out of
`app.config.ts`. There is no CloudKit server-to-server key. John's steps, both in Apple's consoles:
1. In the developer portal, assign `iCloud.studio.yada.reader` to the App ID `studio.yada.reader`.
2. In CloudKit Console, create a server-to-server key. It goes in `.env.local`, never committed.

Then: re-add the entitlement, deploy the schema to Production, build moderation in the review tool, then the
answered-prayer push, then Pray again.

**Circles, decided (John, 17 Oct 2026: "build it all and make sensible decisions").** From how CloudKit sharing
works (Apple, "Shared records" and UICloudSharingController) and how invite-only lists are built. No source gave
prayer-specific guidance, so the product calls are ours.

1. **Mechanism:**
   - One circle is one custom zone in the creator's private CloudKit database, shared whole with a private
     `CKShare` (no public link permission).
   - Its requests are records in that zone.
   - Members join through the iOS share sheet (UICloudSharingController) or an invite sent in Messages.
2. **iCloud required:** CloudKit checks every member's iCloud identity. Anyone not signed in is told, in one
   line, that a circle needs iCloud.
3. **Who sees what:** members see each request and its "N prayed". Who prayed stays private: no names, no
   pressure, as in public.
4. **Invites:** only the circle's creator invites and removes members.
5. **Size:** at most 12 people, so a circle stays people you know.
6. **One place per request:** a request lives in one circle or in public, never both (a record joins only one
   share).
7. **Lifetime:** a request lives 7 days and can be renewed, as in public. A circle lasts until its creator
   deletes it. Leaving removes it for that member only.
8. **Safety:** Report and Block work inside circles too (App Store guideline 1.2).
   - A report first hides the request from the reporter.
   - Two reports hide it from the circle.
   - Reports also reach John's moderation view.
9. **Privacy:**
   - Request text is stored in CloudKit's encrypted fields (`encryptedValues`).
   - Notifications never carry it.
   - An answered prayer sends one quiet "A prayer you prayed for was answered".

**Order of build:** Pray v1 is not in the app (build 7a shipped the daily rhythm only), and none of it can run
until John's two Apple steps above are done.
- Then build Pray v1 and Circles together: one native CloudKit module, the Pray tab (PT-01) and moderation in
  the review tool.
- Until then nothing is built for Circles, since code that cannot run is not shipped.

## J. John's choices

**Decided by John, 15 Oct 2026:**
- **J1:** this session does D; the build-next-release session was told.
- **J2:** the four written summaries are briefs only.
- **J3:** Burton §35, checked against the scan.
- **J5:** keep the Ezekiel 28 line.

**Not yet asked:** J4 stands as proposed until John says otherwise.

The questions as put:

- **J1.** Summaries: does the build-next-release session do D, or does it hand `summaries.ts` to this one?
- **J2.** Your four written summaries: used as briefs only (proposed), or shown as written (a change to the
  extractive rule)?
- **J3.** Aorist: Burton's 49-word sentence (proposed), Robertson's shorter one with "constative", or leave
  it empty?
- **J4.** Rare stems with no open source: stay empty for good (proposed)?
- **J5.** The approved Ezekiel 28 line that quotes "the prince of demons": keep it (it matches the BSB), or
  withdraw it as a Tyndale quotation?
