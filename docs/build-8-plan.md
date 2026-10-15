# Build 8 plan (draft)

Started 15 Oct 2026 from the build-next-release session. These are the pieces deliberately left out of builds 6
and 7, and the questions waiting on replies. Draft each with `/design` before building. Rules: CLAUDE.md;
rule 9 holds everywhere (licensed text never reaches AI, the pipeline, voices, notifications, widgets, Siri or
share images).

## 1. Pray for each other, the full version

Build 7 ships a lean v1 inside Today: requests live for 7 days, press and hold about 20 s to pray, counts shown
only to the person who asked, Report (3 reports hide a request), Block, the Samaritans line, and CloudKit's
public database. Build 8 completes it.

| # | Piece | What it needs |
|---|---|---|
| 1 | **"A prayer you prayed for was answered":** one quiet push to everyone who prayed | CloudKit query subscriptions on the requests a person prayed for; silent push, then a local notification with no prayer text (privacy) |
| 2 | **Moderation in the review tool:** reported requests, with keep or remove and the reason | CloudKit server-to-server key, held like the other keys in `.env.local` and never committed; a Reports queue in `packages/review` beside Readers differ and Passage summaries |
| 3 | **Prayer reminders for others:** "pray again" on a request you held | local notifications only, no text |
| 4 | **Circles (decide first):** share one request with people you know through a link, not the public pool | a CloudKit share; the hardest privacy piece, so only if build 7's v1 shows people want it |

Measure before building: how many requests, prayers and reports v1 sees each week (counted in CloudKit, no
analytics SDK), and how long John's moderation actually takes.

## 2. Waiting on replies (each could become build 8 work)

| From | Asked | If yes |
|---|---|---|
| **Tyndale** (permission@tyndale.com, sent 15 Oct) | the iPhone voice reading the NLT and The Message aloud; recorded audio | read-aloud for those versions, within their terms; rule 9 updated to match the written consent |
| **HarperCollins** (HCCPpermissions@HarperCollins.com, sent 15 Oct) | the same for the NKJV | the same |
| **Bible Brain** (key requested 15 Oct) | which English recordings, and with which verse timings | licensed recordings streamed with verse highlighting (no word highlighting: that would put licensed text into a speech model) |
| **API.Bible** | Pro plan, or a higher limit than Starter's 5,000 calls a month | the licensed **Download** (per book, kept 30 days, refreshed), on hold since 15 Oct |
| **Cambridge University Press** | the KJV and the 1662 Book of Common Prayer in the UK (Crown letters patent) | the 1662 collects and Prayer Book text |
| **Our Daily Bread** | a devotional licence (build 7) | on hold until they reply |

## 3. Prayer and liturgy, after build 7

- **Morning and Evening Prayer (the Daily Office):** the 1979 US Daily Office lectionary (MIT-licensed JSON,
  references only) with all Scripture in the BSB. Needs a church calendar engine and a liturgy reader. The 1979
  book's own Bible quotations are RSV (in copyright), so none of its Scripture text is used.
- **Historic collects** on Sundays and in plans: the 1979 collects (copyright relinquished), or the 1662 ones once
  Cambridge answers.
- Check the ecumenical texts (the contemporary Lord's Prayer, canticles) before using any of them.
- **An ambient sound for Sit with this** (John, 15 Oct 2026), optional: one sound such as rain or a quiet room,
  from a CC0 or public-domain recording with its licence read from the source and pinned. Only if build 7's
  testers ask for it. No music (licensing).

## 4. Summaries that say what the passage is about (John, 15 Oct 2026)

Items 1–4 and 5a stay with the build-next-release session, which owns `summaries.ts` and John's summary review.

John reviewed all 76 undecided passage summaries. About 40 of the 62 "needs a fix" notes say the same thing:
the summary is accurate but misses the passage's main point (Daniel 6 without the lions, Matthew 22:15–22
without the coin, 1 Timothy 3 without the qualifications). Extractive picks from the UST's verse sentences
cannot see "the main point", and a quality check cannot tell that one is missing.

**Sources in hand** (pinned, licence read from each module's conf, parsers and tests committed; not used yet):
- **Matthew Henry's Concise Commentary** (1706–1721, CrossWire SWORD module MHCC, "Public Domain"): 4,046
  sections over all 66 books, 3,218 with an outline line. `packages/pipeline/src/understand/matthewHenry.ts`.
- **Easton's Bible Dictionary** (1897, CrossWire module, "Public Domain"): 3,963 entries.
  `packages/pipeline/src/understand/easton.ts`.

**What the first look showed** (the comparison page John read, 15 Oct 2026):
- Henry's **outline lines** are short, factual and name who and what ("Jacob comes to Succoth and Shalem, He
  builds an altar"; "God promises to remember those that repent"). Strong candidates for a lead sentence.
- Henry's **sentences** are sermons in 18th-century voice ("It is no new thing for what is done faithfully…").
  Not summary material.
- His **sections** often do not match the BSB's passages: Genesis 46:16–18 sits inside his 46:5–27. A line used
  for a passage must cover the passage and not mostly other verses.
- Easton's first sentence for a person is usually the name's meaning ("Servant."); for places and peoples it
  identifies them. Use it only where a summary needs to say who or where (Theophilus, Anathoth).

**To plan:**
1. Henry outline line as the **lead sentence** where its range matches the passage closely (same start, at most
   a third longer), with the UST sentences after it. Measure across all books and read every change.
2. A "main event" signal: tN chapter-introduction parts and Henry outline lines both mark it; prefer a summary
   that contains a sentence from that event's verses.
3. Longer passages (Deuteronomy 20's war laws, Ezra 2's list) get a larger budget or a "list" layout.
4. The BSB key verse where the UST paraphrase drifts from the Hebrew or Greek (Jeremiah 13:14, Isaiah 53).
5. Easton identifications as a separate "who's who" line, never inside a summary sentence. Taken by the Build 6 session (John, 15 Oct
   2026): beside the places map and word screen, each line through John's review queue.
5a. More of the Tyndale Open Study Notes: the opening sentence of up to three notes in a passage, not only the
    first. Tried on 15 Oct 2026 and held back: across all books it changed 49 summaries, often adding commentary
    ("God not only saved Moses' life for his future…", Exodus 2) in place of the event, and hid four good ones
    whose new sentences carried verse references (Leviticus 8, Luke 20:41, Ephesians 1:15 and 3:1). Plan it with
    Henry's outline lines: which commentary sentence may lead, and when.
6. John's review loop stays: every change measured, every newly shown summary read, fixes list cleared.

Not doable this way: the four passages John wrote suggested summaries for (Exodus 35:10–19, Proverbs 24:21–34,
Jeremiah 25:34–38, and Exodus 35:4–9 before the quotation rule). Written summaries would be Yada's own words,
against the extractive rule; that would be a policy decision for John.

## 4b. Readers differ, after the first 28 (John, 15 Oct 2026)

Shipped: 28 passages with two distinct approved positions on one question (sides and axes, "context" and
"lists…" not counting). Moved here, to finish without holding that up:
- **The 10 debated passages that don't show yet**, each missing a second position: Genesis 1:26, Job 19:25–27,
  Jeremiah 31:31–34, James 2, Ezekiel 38–39 and the round-2 passages still at one position.
- **Round 3:** John's list of missing majority or historic views (framework and day-age, Wisdom as Christ in
  Proverbs 8, ethnic Israel in Romans 11:26, the engaged couple in 1 Corinthians 7:36, deacons' wives in 1 Timothy
  3:11, the witnessing church in Revelation 11, and others). Drafts land in debates.json as they are found.
- **The harvester** (`yada debates harvest`): finds debated passages across all 66 books from the sources' own
  contrast phrasing, splits them into positions, applies John's rejection rules (calibrated on his ~200
  decisions), carries his past approvals through, drops his rejections, and offers two-sentence quotes where his
  only objection was a leaning opener. Reviewed in numbered batches of about 100.

## 5. Content that needs no build (publish through the manifest any time)

- **Readers differ, round 2:** 14 more debated passages, verified and ready to load (Junia, 1 Peter 3:19,
  Hosea 1:2 and others), after John's current 34 decisions. A new entry hides its verses' plain line until two
  positions are approved, so load them only after the current round.
- **Audio:** the BSB in Heart and George, then the chapter names, then WEB (Heart), KJV (George) and LSV (Heart),
  published and pruned every two hours. A rented cloud machine (Hetzner) would finish it in hours; the SSH key
  is ready at `~/.ssh/yada_hetzner`.

## 6. Carried from earlier QA, still open

- UST as a plain-English translation (MS-04, MS-05): an ingest task; read its licence from the source. Taken by the Build 6
  session (John, 15 Oct 2026), alongside its WEB, KJV and LSV readings.
- Downloads that finish while Yada is closed (NT-08): background URLSession.
- Widget typeface: Literata in the extension instead of New York.

## 7. What build 6 left empty (John, 15 Oct 2026: "anything empty and doesn't pass today, move it to build 8")

Each shows nothing in build 6, which is honest (rule 4). Build 8 looks for an openly licensed source that
says it well, chosen verbatim and reviewed by John like the rest. Owned by the Build 6 session.

| What | Why it is empty | Where to look |
|---|---|---|
| **Zephaniah's introduction** | John rejected tN's; Tyndale's opening is a quotation, a question and an 8-word fragment | Tyndale's Setting paragraph, or another paragraph of tN's front:intro |
| **Greek aorist** | unfoldingWord's sentence leaves out the whole-event view; Machen's "simple past tense" is a simplification | a later public-domain grammar (Robertson 1914, Dana & Mantey's sources) |
| **Hebrew absolute, construct, cohortative** | John found unfoldingWord's wrong; Gesenius (1910) is accurate but its scan is OCR noise with garbled Hebrew, and too technical | a clean Gesenius transcription (Wikisource, CC BY-SA), cut to its plain clause, or another open Hebrew grammar |
| **Hebrew hishtaphel, tiphil; Aramaic hishtaphel, ishtaphel** | the sources call them "similar to the Hiphil/Haphel … active voice", which STEPBible's own codes contradict (reflexive) | an open grammar that treats the rare stems; STEPBible's codes only to check |
| **Aramaic absolute, construct, hithpeel, hithpaal, ithpaal** | en_uag repeats the Hebrew grammar's wording or John found it wrong | as above |
| **Aramaic gaps with no article** (determined, infinitive construct, direct object marker, ithpeel, polel, directional he, hithpolel, hithpoel) | en_uag has no article, or its determined article is a copy of absolute | the same Aramaic source |
| **Aramaic glosses and Strong's numbers** (176 tokens with no gloss, 290 with no Strong's) | no source fills them yet; never guessed (rule 4) | an openly licensed Hebrew/Aramaic lexicon, read verbatim, licence from its own file |

**Review waiting for John (moved here 15 Oct 2026):** 29 drafts in the review tool's Extracts queue, built in
build 6 and hidden until approved (rule 2): 17 book introductions (Tyndale's opening for the 16 he rejected,
and Genesis) and 12 grammar terms (six from Machen, six with a spelling slip corrected and noted). Once
approved: `yada grammar --write` for the app, and an Understand rebuild and publish of the 17 books.
