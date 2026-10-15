# Understand without AI

Decided by John on 12 Oct 2026. Example on the canvas: frames NA-01–04 (1 Corinthians 14:34–35),
"Next release · new flows" page, https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc.

## The decision

- Understand and the passage guides are assembled from sources and data. No AI writes any text the reader sees.
- The 46-guide Opus batch (handoff item 1) does not run. `CEILING_USD` can go back to its value before 8bf10da.
- The 7 reviewed golden entries are retired from the app. They stay in `golden/` as test fixtures and as a record of
  what John approved. Bundles stop shipping `entries`.

## Sources added the same day (v2)

Both were downloaded on 12 Oct 2026 from git.door43.org/unfoldingWord and pinned in `content/raw/uw.sha256`.
Licences were read from each LICENSE.md (rule 3).

- **unfoldingWord Simplified Text** (`en_ust`, CC BY-SA 4.0): the "In plain words" line. It covers every verse in
  John and 1 Corinthians but one, at a median reading grade of 6.7 and 7.3 (Tyndale's notes are 10–11).
  - Words the UST adds to make the meaning explicit, marked `{…}` in the source, show in grey.
  - Where the Translation Notes list readings for the verse, the line is labelled "One plain reading", because the
    UST picks one. On 1 Cor 14:34 it says "wives … when their husbands are speaking".
- **unfoldingWord Translation Notes** (`en_tn`, CC BY-SA 4.0): "Readers differ" and "Explained".
  - Readers differ: notes that set out "(1) … (2) …". This covers 113 verses in John and 107 in 1 Corinthians,
    including both questions on 14:34 ("women": married women or women in general; "be silent": three readings).
  - Explained: figure-of-speech and implied-information notes.
  - Every sentence addressed to a translator is removed ("If it would be helpful in your language…",
    "Alternate translation: […]").
  - The chapter introductions' outlines give passage divisions for books without them (55 in 1 Corinthians).
- **Licence obligations for both:** adapted copies drop the unfoldingWord® mark and say what changed (alignment
  markup removed; translator guidance removed). Credit "The original work by unfoldingWord is available from
  unfoldingword.org/ust" (or `/utn`), and publish the adapted data under CC BY-SA.
- **The UST stops being display-only.** The 12 Oct ruling made it display-only to keep it out of AI. There is no
  AI now, so it is shown as a credited source.

The Understand layers, top to bottom: In plain words (UST) → Readers differ (Translation Notes) → Notice (data
facts) → Read it alongside (references) → Go deeper, where Tyndale's note now sits under Study notes.

Reference implementation of every rule: `packages/pipeline/prototypes/assemble.py` with its quality report. Run
`python3 -I packages/pipeline/prototypes/assemble.py 1CO 1CO.14.34`. The pipeline stage ports it to TypeScript.

## Sources added in v3 (12 Oct 2026)

Downloaded with John's go-ahead and pinned in `content/raw/sources-12oct.sha256`. Licences were read from each
LICENSE.md (rule 3).

- **unfoldingWord Translation Questions** (CC BY-SA 4.0): "Check what you read", and the plain answers that sum up
  what happens.
- **unfoldingWord Open Bible Stories** (CC BY-SA 4.0): a plain retelling at passage level for 112 BSB sections.
- **unfoldingWord Translation Words** and **Translation Word Links** (CC BY-SA 4.0): Key words. Only the
  Definition/Facts section is used; translation suggestions are dropped.
- **Berean BSB translation tables:**
  - Public domain per berean.bible/licensing ("licensing is not required for any use"); the file has no notice of
    its own, to be confirmed with the Berean team.
  - Supplies:
    - word alignment from the original to the BSB (MACULA marks on BSB words; facts in the BSB's own words);
    - BSB headings (sections for every book);
    - BSB footnotes ("Or …", "Literally …", manuscripts, citations).

The beginner layer in v3, in order:
1. In plain words (UST).
2. The translators' own notes (BSB "Or" / "Literally").
3. Readers differ (Translation Notes).
4. Manuscripts (BSB footnotes).
5. Notice: facts.
6. Read it alongside.

Go deeper adds Key words, Explained, Study notes (Tyndale) and Check what you read. Results:
`docs/no-ai-quality.md`.

## Three kinds of line, and nothing else

1. **A published source, adapted only by rule and credited with what changed.** (Build session, 12 Oct: trimming
   reverses "shown as published", so each credit says "adapted" and names the change, and Sources lists every
   change, as CC BY-SA requires. The unfoldingWord® mark is dropped from every adapted copy.)
   - Use the Tyndale Open Study Note (CC BY-SA 4.0) that covers the verse most tightly: its first paragraph, then
     "Read the whole note".
   - NLT words inside it stay marked "(NLT)", as on Study notes.
   - Skip a note that opens on an NLT lemma for the next-tightest note. The lemma explains the NLT's wording, not
     the reader's.
2. **A fact from the data, in a fixed sentence.**
   - The sentence is a template that John reviews once, and the data fills it. Facts and their sources:
     - translations that word the verse differently (Compare's word diff);
     - a word's count and where else it appears (SBLGNT tokens, STEPBible glosses);
     - who speaks (Glyssen);
     - people and places (TIPNR);
     - a verse missing from the oldest manuscripts (no SBLGNT tokens).
   - Each template is tested. A fact is shown only when its data is present.
3. **Verses to read beside it.**
   - Show the references the Tyndale note itself names (for example 1 Cor 11:5 and 1 Tim 2:11–15 on 14:34–35),
     each with its BSB text.
   - This replaces "Where readers differ": the reader weighs the texts directly.

## What goes, and why

- **Yada's "What's happening".** It was written by AI.
- **"Where readers differ".** No open source sets out the readings fairly, so it is not shown rather than shown
  one-sidedly.
- **Anything the data doesn't hold** is not stated (rule 4). Correction, 12 Oct: that some manuscripts place 14:34–35
  after 14:40 *is* in the data, as a BSB footnote (public domain). The SBLGNT apparatus (CC BY 4.0) and TAGNT's
  edition flags could add more, if pinned later.

## Rules that still apply

- **Rule 9.** Tyndale notes quote the NLT. They are displayed as published, as Study notes already are, and never
  go into any AI call (there are none now).
- **Licence.** Every Tyndale line carries its CC BY-SA credit. Yada's adapted data files are published as BY-SA
  requires (John's 12 Oct decision; where they are published is still open).
- **Rule 2.** No generated prose remains to review. John reviews each sentence template once.
- **Passage summaries are trusted by default (John, 12 Oct 2026).** They are extractive from credited sources, so
  per-entry approval doesn't apply. `passage_summary.py` gates every summary with six checks:
  - (a) a "What happens:" headline;
  - (b) no sentence that leans on missing context (an opening this/that/he/she/they/it/so/I/we/you, or "said
    this");
  - (c) within the word budget;
  - (d) no sentence from a writing-background or figs-events verse except as the setting;
  - (e) Open Bible Stories sentences pass the John-match check;
  - (f) at least 3 distinct sentences after dedupe.

  A summary that passes ships. One that fails is flagged, naming the check, for John to fix in the review tool. John
  also reads a fixed, seeded sample of 5 per book once. A pattern found there is fixed in the rule and rerun, never
  by hand-editing one summary. Gaps closed by rule (12 Oct): BSB headings head a passage the tN outline doesn't cover; an outline section that
  ends inside the passage counts; UST sentences always back up the tQ answers; the turning point is chosen to fit the
  budget. With the fallback chains below: John 46/46 pass, 1 Corinthians 45/45. Samples: John 1:1–18, 9:1–41, 11:1–44,
  11:45–57, 19:31–42; 1 Corinthians 6:1–8, 6:18–20, 8:1–13, 11:17–34, 15:20–34.
- **No images.** The Open Bible Stories illustrations stay out entirely, including on "Read the whole story" pages
  (John, 12 Oct).

## Build (pipeline first, then app)

1. `packages/pipeline`: an `assemble` stage per verse and per pericope that writes:
   - the chosen Tyndale note id;
   - the template facts, with their data;
   - the "read alongside" references.

   It writes ids and numbers, not prose. The app renders the templates, so a wording fix needs no rebuild.
2. Tests: the 1 Cor 14:34 facts as golden output:
   - "be silent" 3× in 1 Cor (14:28, 14:30, 14:34);
   - "submission" also in 14:32;
   - the BSB/WEB/KJV/LSV wording split on "women"/"wives".
3. App: Understand and the guide read the assembled data (canvas UX, NA and CP frames). Remove the entry path and
   the "Unreviewed" label code once nothing generated remains.

## Fixes from the build session's review (12 Oct)

1. **Readers differ is one fixed sentence.** "Some read “X” as A. Others read it as B. Still others, as C."
   - Each reading is cut at its first sentence and 18 words. Past that cap, "Read the full note".
   - X is the note's own short name for the phrase when every content word of it is in the verse ("women", "so");
     otherwise the BSB's own words for the Greek or Hebrew phrase, through the translation tables; otherwise "this".
     No translator framing survives.
2. **Translation differences are one or two words a side.** Anything that spills into neighbouring words is dropped
   ("churches" → "assemblies", never "assemblies for it has").
3. **Credits.**
   - Simplified Text: adapted, alignment markup removed.
   - Translation Notes: adapted, translator guidance removed, readings set in a fixed sentence.
   - Translation Words: adapted, definition only.
   - Open Bible Stories: adapted, images removed.
   - Tyndale: "Adapted from Tyndale Open Study Notes: references and some quotations removed".
   - BSB footnotes: public domain.
4. **Passage summaries ("Where we are")** belong to `packages/pipeline/prototypes/passage_summary.py` (the build
   session's prototype; drafts for John's edit, reviewed like golden entries). The verse assembler only names the BSB
   section.

## Default translation (John, 12 Oct 2026)

- The BSB is the default. Understand, word marks, facts, footnotes, audio and widgets are built on it.
- Whatever translation a reader picks becomes their default from then on: `state/settings.ts` saves it and restores
  it on launch.
- The BSB stands in only when the saved one can't be read: a removed download, or a licensed version while offline.
  The screen says so, and the reader's choice is kept for when it can be read again.

## Rolling out to every book (John approved the method, 12 Oct 2026)

Every book runs the same way: `passage_summary.py <BOOK>` and `assemble.py report <BOOK>`, then the pipeline port.

1. **Sources, pinned, licences read from their files** (`content/raw/sources-12oct.sha256`, `uw.sha256`):
   - UST: the plain line.
   - unfoldingWord Translation Notes: readers differ, explained, chapter and book outlines, aside tags.
   - Translation Questions: summary sentences, Check what you read.
   - Open Bible Stories: matched to the book sentence by sentence.
   - Berean tables: BSB headings, alignment, footnotes.
   - Tyndale notes: adapted, credited.
   - Glyssen: speakers.
   - MACULA: evidence marks.
2. **Passages.** A book's own pericopes when it has them, otherwise the BSB's sections (heading to heading). In
   1 Corinthians, the bundle had one pericope; the BSB gives 45.
3. **Headline chain:**
   - Narrative books ("What happens:"):
     1. a chapter-outline section starting in the passage's first half, or ending inside it;
     2. the book-outline section that contains it, at most 3× its length;
     3. the BSB heading, never one that repeats the passage title;
     4. none (flag a).
   - Letters, Romans to Jude ("Part of:"): the narrowest outline section that contains the passage, any length. A
     letter argues rather than narrates. The rule came from 1 Corinthians: 22 of 45 were flagged under the
     narrative rule, which was over 15%, so the stop rule fired, and the rule was fixed, not the summaries.
4. **Body chain:** tQ answers → UST → Tyndale's first sentence on the range → Open Bible Stories sentences that match
   the book (strict stem and number match; no speech). Never a sentence that leans on missing context (an opening
   pronoun, "If/When/Because he…", "said this"). The turning point is chosen to fit the budget.
5. **Data facts:** a BSB manuscript footnote that names the passage's verses is shown as a fact ("Some early
   manuscripts do not include John 7:53 through John 8:11."), never as summary prose.
6. **Gate:** the six checks. A passage of 12 verses or fewer needs 2 distinct sentences; longer ones need 3.
   Passing summaries ship. Failing ones are flagged, naming the check, for John to fix by hand in the review tool.
7. **John reads a seeded sample of 5 per book once.** A pattern he finds becomes a rule fix and a rerun, never
   one-off edits.
8. **Per-book report:**
   - source coverage: UST, tQ, outline lines, OBS, Glyssen;
   - pass and flag counts with reasons;
   - the sample IDs.

   **Stop and tell John if more than 15% of a book is flagged:** that means a source gap, and the rules need work
   before the book can go out.
9. **Package the per-book bundle.** Publishing to R2 is John's step, run when he says.

**Credits** for every source, with its "adapted" wording, go on Sources (ST-04). Yada's adapted data is published
under CC BY-SA; where is still to decide.

**Order:**
1. John and 1 Corinthians (done).
2. Mark, Luke, Matthew and Acts, where tQ and OBS are richest.
3. The rest of the New Testament.
4. The Old Testament narrative books: Genesis, Exodus, Samuel–Kings, Ruth, Esther, Jonah, Daniel.
5. Psalms, the Wisdom books and the Prophets.

**Expected differences:**
- **Old Testament.**
  - Hebrew comes from MACULA Hebrew, and Glyssen's IDs differ.
  - Psalm titles are the core's verse 0.
  - Poetry needs its own headline logic, since the outlines name sections, not events. Treat the Psalms and the
    Wisdom books like letters ("Part of:"), and the Prophets like letters, unless a section narrates.
  - Text-variant facts come from the BSB footnotes only.
- **Books with sparse tQ.** The UST and Tyndale carry more of the body; check the reading level in the report.

### Rollout progress (12 Oct 2026)

| Book | Passages | Pass | Flagged | Notes |
|---|---|---|---|---|
| John | 46 | 46 | 0 | gospel mode; the writer's own "I" (20:31, 21:25) framed as the writer's |
| 1 Corinthians | 45 | 45 | 0 | letters rule ("Part of:"); letter mode |
| Mark | 90 | 89 | 1 | 16:9–11, the longer ending: no notes by design; gospel mode |
| Matthew | 141 | 139 | 2 | 26:17–19 newly flagged: a line that leans ("They went…") now chosen in the middle |
| Luke | 146 | 144 | 2 | short sayings whose sentences lean |
| Acts | 110 | 107 | 3 | "Part of:" carries the headline; "we" passages framed as the writer's |
| Genesis | 142 | 132 | 10 | 7 with no outline or heading; 33:18–20 newly flagged ("Then they…" now leans) |
| Ruth | 8 | 8 | 0 | |
| Psalms | 171 | 171 | 0 | Psalms mode; two lines before the psalm (John’s round) |
| Isaiah | 117 | 114 | 3 | speech framing; 32:9–20 newly flagged for a UST capital after a comma ("homes, We will") |
| Romans | 47 | 47 | 0 | letter mode (John, 12 Oct) |
| Leviticus | 70 | 69 | 1 | law mode; 26:40–46 has one 84-word sentence |
| Exodus | 116 | 108 | 8 | law (21–23) and plans (25–31, 35–40) modes; 4 building lines lean ("He made…") |
| Job | 50 | 50 | 0 | debate mode |
| Ecclesiastes | 26 | 25 | 1 | the Teacher; 12:1–8 straddles two outline sections |
| Proverbs | 53 | 52 | 1 | sayings mode: no body; the BSB section 24:21–34 straddles two tN collections (22:17–24:22, 24:23–34) |
| Song of Songs | 8 | 8 | 0 | love poetry: speakers from the UST's headings (was 1/8, a STOP) |
| Revelation | 59 | 53 | 6 | visions mode; 12:1–6, 13:11–18 (2), 18 (3) have no outline item the chapter names |
| Numbers | 109 | 105 | 4 | 66-book run (12 Oct): law 21 / narrative |
| Deuteronomy | 88 | 83 | 5 | law headline often only "Moses’ second speech." |
| Joshua | 51 | 48 | 3 | lists (15–21) need a list template |
| Judges | 50 | 49 | 1 | |
| 1 Samuel | 69 | 69 | 0 | Glyssen IDs as speakers ("Man of God says:") |
| 2 Samuel | 62 | 62 | 0 | |
| 1 Kings | 90 | 89 | 1 | annals need a mode: the citation formula fills a sentence slot |
| 2 Kings | 85 | 79 | 6 | annals; 15:23–26 headline names Shallum for Pekahiah's reign (passed) |
| 1 Chronicles | 81 | 81 | 0 | genealogy lines that lean passed ("David had him with his wife Eglah.") |
| 2 Chronicles | 98 | 96 | 2 | annals |
| Ezra | 27 | 24 | 3 | lists (2:1–67) |
| **Nehemiah** | 28 | 23 | 5 | **STOP** (17.9%): lists; 10:28–39 passed as a fragment |
| Esther | 20 | 20 | 0 | a Tyndale hedge ships as summary (1:9–12) |
| Lamentations | 7 | 7 | 0 | no lament mode; acrostic letter names leak ("YODH A person…") |
| Jeremiah | 122 | 114 | 8 | prophets run in narrative mode; 52:1–11 carries "him ]" |
| Ezekiel | 112 | 112 | 0 | 40–48: old commentaries' readings over the beginner budget |
| Daniel | 32 | 31 | 1 | 7–12 need the visions mode; lines that lean (11) |
| Hosea | 18 | 17 | 1 | |
| **Joel** | 9 | 0 | 9 | **STOP**: no book outline; the BSB heading always matches the label |
| Amos | 14 | 12 | 2 | 14.3% |
| **Obadiah** | 2 | 1 | 1 | **STOP**: one flag stops a book of 6 passages or fewer |
| Jonah | 6 | 6 | 0 | |
| Micah | 14 | 14 | 0 | |
| Nahum | 3 | 3 | 0 | |
| **Habakkuk** | 7 | 0 | 7 | **STOP**: no book outline |
| **Zephaniah** | 10 | 7 | 3 | **STOP** |
| Haggai | 5 | 5 | 0 | |
| Zechariah | 25 | 24 | 1 | |
| **Malachi** | 8 | 0 | 8 | **STOP**: no book outline; 3:13–18 puts the people's words inside "God says:" |
| 2 Corinthians | 24 | 24 | 0 | |
| Galatians | 16 | 15 | 1 | |
| Ephesians | 16 | 14 | 2 | |
| **Philippians** | 14 | 11 | 3 | **STOP** (21%) |
| Colossians | 11 | 10 | 1 | |
| 1 Thessalonians | 10 | 10 | 0 | |
| **2 Thessalonians** | 7 | 5 | 2 | **STOP** |
| 1 Timothy | 16 | 16 | 0 | |
| 2 Timothy | 10 | 10 | 0 | |
| Titus | 8 | 8 | 0 | |
| **Philemon** | 4 | 3 | 1 | **STOP** |
| Hebrews | 34 | 33 | 1 | "What happens" headlines on a letter; "!." double punctuation |
| James | 13 | 13 | 0 | |
| 1 Peter | 14 | 13 | 1 | |
| 2 Peter | 6 | 6 | 0 | |
| 1 John | 15 | 15 | 0 | 1:5–10 drops a condition and reverses the meaning |
| **2 John** | 3 | 2 | 1 | **STOP** |
| **3 John** | 3 | 1 | 2 | **STOP** |
| **Jude** | 2 | 1 | 1 | **STOP** |

The 66-book run (12 Oct 2026, no AI, nothing published): 36 more books pass and are listed in the local manifest by
`yada manifest`; the 12 stopped books write a file for the report but `yada manifest` leaves out any book over the
15% stop. Every stop but Nehemiah is check (a): the headline chain skips a BSB heading that matches the passage label,
and passages are cut from BSB sections, so with no tN outline nothing is left. Modes still missing: annals (Kings,
Chronicles), lists and censuses, lament, the Prophets as "Part of:", Daniel 7–12 as visions. Lines the gate missed are
listed per book above; each is a rule fix and a rerun for John to choose, never a hand edit.

Rule fixes from the rollout, all as rules, never hand edits:
- outline bullets read (Mark);
- "Part of:" for passages with no event (Acts);
- body fallbacks on leaning;
- check (g) and source cleanup (Genesis, Ruth);
- cross-verse UST sentences;
- footnote facts only as plain sentences;
- unquoted speech;
- tiny-section merge (never in Psalms);
- the genealogy template.

#### Psalms mode (John, 12 Oct)

A psalm needs context more than a summary. Each psalm gets up to four short lines, all from data:
1. **What kind:** tN's psalm type through a fixed plain-words table John approves once. tN's jargon is never shown.

   | tN's type | Shown as |
   |---|---|
   | penitential | A prayer asking God to forgive |
   | trust | A song of trust in God |
   | thanksgiving | A song of thanks |
   | lament, supplication | A prayer from someone in trouble |
   | royal, honoring the king | A psalm about the king |
   | wisdom | A psalm about how to live |
   | praise, hymn | A song of praise |
   | imprecatory | A prayer asking God to judge enemies |
   | deliverance | A psalm about God's rescue |
   | songs of ascents | A song for pilgrims going up to Jerusalem |
   | worship psalm | A song of worship |
   | prayer | A prayer |

   Otherwise: tN's own "a psalm about …" (about 12 words), or "What it's for" from tN's Purpose line. Psalms 9
   and 10: "were probably one psalm at first".
2. **Title:** the BSB superscription, split off verse 1, e.g. "A Psalm of David, when he fled from his son Absalom."
3. **The picture:** tN's metaphor paragraph or its first metaphor note, translator wording removed.
4. **How it moves:** tN's outline, at most 3 items of about 12 words, labelled by verses.

Never built from first-person UST lines. Psalm 119's 22 stanzas: the stanza by name ("א Aleph · 119:1–8"); the
type once, on the first stanza. Psalms never merge. Headings are cleaned: entities decoded, book divisions dropped.

#### Speech and readers (Isaiah test, 12 Oct)

- **Speech is always someone's.** A sentence from a verse where Glyssen has a speaker is framed through the fixed
  template "<Speaker> says: “…”" when it opens on I/We/You/My/Our, an imperative, a blessing or a vocative, or
  addresses "you". God, Yahweh and the LORD read as "God"; groups take "say".
- **Glyssen names lose their bracketed notes.** "voice of one calling (preparing way for Christ)" states one reading
  as fact. Cut-off tails are repaired ("seraph, one of the"). In Old Testament books, Glyssen's Jesus, Christ and
  Messiah speakers are dropped as one tradition's reading.
- **Known divides (superseded by the major-debates list, below):** Isaiah 7:14, Isaiah 52:13–53:12, Psalm 22:16.
  - No summary sentence comes from a disputed verse.
  - The passage carries one fixed line John approves, e.g. "One word in verse 14 is read as “virgin” or as “young
    woman”", "Jewish and Christian readers understand who the servant is differently".
- **tN gives no readings on these divides,** and its chapter introductions take the Christian reading (7:intro's
  "deeper fulfillment" in Matthew; 53:intro's "servant figure, the Messiah"). Summaries never use intro prose, only
  outline lines, but a fair open source for "Where readers differ" on these verses is still to be found.

#### John's round (12 Oct, after the Genesis, Psalms and Isaiah tests)

- **Genealogy line.** Under "Genealogy from Shem to Abram" the line said "runs from Shem to Haran": the last
  capitalised word in a list is often a brother, a place ("from Israel to Paddan") or another name for the same
  man. The line is now built only from the heading's own names, and only when the heading names two different
  people and both appear in the passage. Otherwise there is no line. A one-name heading ("The Descendants of
  Cain") is told by the heading and one sentence, which passes the gate. "Jacob Blesses His Sons" is no longer
  read as a list. Test: `passage_summary.py checks` (GEN 11:10–26 → "runs from Shem to Abram"). Genesis stays at
  133/142.
- **Psalms: at most two lines before the psalm.** The two lines are taken in this order:
  1. **Written when:** only where the superscription gives an occasion (11 psalms), with the pronoun named. For
     example, "Written when Nathan the prophet came to David after his adultery with Bathsheba."
  2. **The turn:** where tN states one (Psalm 77, "moves from intense distress and questioning to renewed
     confidence"). Otherwise **the picture**, when it fits on one line (22 words or fewer).
  3. **What kind.**

  The title, the outline ("How it moves"), and any longer picture or kind that didn't fit wait behind "About this
  psalm". There is never an "occasion unknown" line. Psalm 43 gets "Psalms 42 and 43 were probably one psalm at
  first". A picture must compare something ("as if", "like"), so background text isn't shown as a picture. Result:
  171/171 (127 psalms with two lines, 44 with one).
- **One-time tip (approved by John, 12 Oct).** Shown the first time a reader opens any psalm, above it: "Hebrew
  poetry often says one thing twice, in different words." Then both halves of Psalm 27:1 on their own lines, because
  the second half is the point, credited "Psalm 27:1, BSB". The verse is quoted exactly from core.v5, with the BSB's
  own dashes; John's note had semicolons, but the text is never altered.
- **Prophets: plain section names and a setting line.** Both live in `prototypes/data/prophets.json`; nothing shows
  until its status is "approved".
  - **Approved by John, 12 Oct, with five edits** (status "approved"). Isaiah 40–55 is now "Words of comfort for the
    exiles in Babylon" and 56–66 "Words for the people back in Judah after the exile": the lines say who the words
    are for, not when they were spoken, because the date of Isaiah 40–66 is disputed. Obadiah is now "Spoken against
    Edom, Judah's neighbour", for the same reason. "The LORD judges the nations and saves his people" uses the BSB's
    "the LORD" in Yada's own words. Zephaniah 3:8 is now "Judgment on the whole earth".
  - **Section names:** tN's outline names go through one table John approves, for example "Oracles About Judah" →
    "Messages to Judah" and "Announcement of the End of the Babylonian Exile" → "Comfort for the exiles in
    Babylon". There are 11 entries, across Isaiah, Haggai, Zephaniah and Zechariah.
  - **Setting line:** one line for each book section, saying when and to whom, drafted from each tN book
    introduction, with its source on every line. There are 19 lines: three for Isaiah and one each for the other
    prophets.
- **Major debates (replaces "known divides").** `prototypes/data/debates.json` holds 30 Old Testament candidates for
  John. Each has a reference and the question in neutral words; the question is never shown.
  - A note shows in Readers differ only once John, or a reviewer he trusts, has written it and approved it. Until
    then the reader sees nothing extra, and the report lists the passage under "major debates awaiting a note".
  - Three candidates carry a suggested note from the old divides list, but these are not approved.
  - No summary sentence comes from a disputed range of up to 3 verses.
- **Same slots for every genre:** In short → Readers differ → Read it alongside → More. A psalm's two lines and a
  prophet's setting line are its In short. "About this psalm", the outline, Notice, Manuscripts and Go deeper sit
  under More.
- **Credits grouped** in one block at the bottom of the screen, instead of after each line. Each source is named
  once and marked "adapted" where it was changed.
- **Readers-differ wording, three variants (drafts, John approves once):**
  - Some read "X" as A. Others read it as B. [Still others, as C.]
  - "X" can mean A, or B. / "X" can mean A, B, or C.
  - Readers take "X" two ways: A; or B. / Readers take "X" three ways: A; B; or C.

  The variant turns with the verse number and the reading's place in the verse, so neighbours differ and a rerun
  repeats exactly. The golden check on 1 Cor 14:34 now accepts any variant.
- **Five-reader test:** tasks 6 (Psalm 51) and 7 (Isaiah 40) are in `docs/redesign/five-reader-test.md`.

#### Modes by kind of writing (John, 12 Oct)

John tested Mark, Romans and seven more kinds of writing. Each kind now has its own mode, chosen by passage from
`prototypes/data/kinds.json` (draft): law, plans, debate, the Teacher, sayings, love poetry and visions; letters
and Gospels by book. Everything new a reader sees is draft data for John to approve once: `kinds.json` (modes,
setting and purpose lines, voices), `letters.json` (writer, readers and setting line for all 21 letters),
`plain_words.json` (UST word changes and tN plain words). The rollout table above has the results.

**The common rule.** Whenever the words belong to someone other than the narrator (a speaker, a letter writer, God
giving commands, the Teacher, a vision), the summary says whose words they are. Gate check (h) enforces it in every
mode: a first- or second-person word outside quotation marks fails unless the line is framed or reports the speech
itself ("Paul says the gospel is…"). tQ answers are paraphrase, so they are never quoted as anyone's words: one in
someone's first person is left out. First-person lines with no speaker are the writer's: framed "The writer says"
(Luke, Acts, John, whose tN intros say the writer is unnamed) or "Isaiah says"; in other books they are left out.

**Opening speech (approved).** A passage that opens with someone speaking starts with that speech, not a later
voice. Isaiah 40:1–5 opens: God says: “Comfort my people! Yes, comfort them!” (the UST's words; the BSB's "Comfort,
comfort my people" is not used). A speech that runs past the first verse is framed from that verse's own words, at
most 20 of them. 171 passages across 12 books changed; no book lost a pass (Exodus and Luke gained one each).

**Gospels.**
- UST word list (draft): apprentices → disciples, instructor → teacher, (12/11/his/the) representatives → apostles,
  ruling priests → chief priests, the ruling evil spirit → the devil. The UST credit names each change shown.
- Glyssen names read the English way round: "two angels in white", "some bystanders at Calvary".
- A footnote fact is its first sentence: "Some early manuscripts end the Gospel of Mark after verse 8." The rest
  waits behind "Read the note", with glued verse numbers ("9But") removed. The data says "Some early manuscripts",
  so the line does not say "the earliest" (rule 4).
- "Also told in: Matthew 8:23–27 · Luke 8:22–25" from the BSB's section parallels; Glyssen's parallel-passage column
  is the fallback for speech verses. 88 of Mark's 90 passages have one.

**Letters.** A tQ answer in inverted ULT order ("By the witnesses of the Law … has a righteousness … been made
known") gives way to the UST; in letters only, so does one whose sentences average 5 grades above the UST's.
First- and second-person lines are framed "Paul tells the believers in Rome: “…”". "Before this · After this" names
the outline sections either side, and each letter has one setting line.

**Law** (Leviticus 1–7, 11–27; Exodus 21–23; Numbers and Deuteronomy law sections). Topic (an outline item through
the plain-words table, never translator wording such as "Third-person: “If his offering”"), then a purpose sentence
from the tN chapter introduction's concept notes, then at most two lines of God's speech, framed "God tells Moses:
“…”" when the BSB says whom he speaks to. No rule-by-rule body. Two lines in all pass.

**Plans** (Exodus 25–31, 35–40; 32–34 stay narrative). Topic from outline items only (Exodus 26:1–6 is "Inner
covering"); purpose "The tent where God would live among his people." (draft, from tN's "a tent where Yahweh would
be among his people"); commands framed as God's; check (i) fails any measurement ("100 cubits", "50 loops").

**Debate** (Job 3–42:6). Fixed setting line: "Job’s friends argue that his suffering is punishment; at the end God
says they were wrong (42:7)." Every line from a speech is framed with its speaker, and neighbouring frames of one
speaker merge ("Job says: “… …”").

**The Teacher** (Ecclesiastes). A setting line on "under the sun", and every line names the Teacher ("The Teacher
says that…", or his words framed).

**Sayings** (Proverbs). "Part of:" the collection and "Themes:" from tN's concept headings and outline items. No
body. Chapters of single sayings (10–22) have no theme in tN and show their collection alone.

**Love poetry** (Song of Songs). The UST's own speaker headings ("The woman", "The man", "The women of Jerusalem")
name every speech; the headings no longer leak into verse text. Headline: the outline item covering most of the
chapter. 8/8, from 1/8.

**Visions** (Revelation 1:9–20, 4:1–22:5; chapters 2–3 are Jesus' words, framed with him). Every line is framed "In
John’s vision, …"; John's own "I saw" is his. An outline section heads a passage only when its chapter names it
("The seven trumpets" no longer heads 13:1–10); otherwise tN's chapter concept heading when every word of it is in
the passage ("What John sees: Two witnesses"). A sentence that says the same thing twice is gated and left out ("If
anyone’s enemies are going to kill him with a sword, they will kill him with a sword"). Disputed ranges (7:4–8, 13,
20:1–6) state no plain fact: every line there is framed as the vision.

**Other rule fixes found on the way:** a sentence closing one quotation before opening the next, or cutting a single
quotation, is not a sentence; a linking word before a pronoun leans ("Instead, they…"); "12, 000" and "flaws{this"
spacing; outline items with half verses (7:9b) and lists of references parse; a book name a preposition needs stays
("Introduction and purpose for Proverbs").

**Not fixable from the data:** Revelation 12:1–6, 13:11–15, 13:16–18 and 18 (three passages) have no outline item or
concept heading of their own; Exodus 36–37 building lines open "He made…" (tN says "he" is any craftsman, but the
text never names him); Proverbs 24:21–34 straddles two collections; Ecclesiastes 12:1–8 straddles two outline
sections. Glyssen names keep their missing articles ("angel or messenger says").

Test: `passage_summary.py checks` (55 cases, including Isaiah 40:1–5).
