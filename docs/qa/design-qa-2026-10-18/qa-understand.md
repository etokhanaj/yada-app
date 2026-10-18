# Design QA: Understand area (18 Oct 2026)

Read-only review of the Understand sheet, passage guide, evidence/word card, study notes, See also, people, places, maps,
dictionary, themes, timeline, Tyndale, Glyssen, MACULA, book intros, grammar terms and start-here, against the canvas frames
and the decision docs (polish-2026-10-15, build-6/7/8/10 plans, no-ai-understand, qa-next-release). About 170 frames.
Done in four parts; each part's table follows. App paths are relative to apps/mobile/src.

## Counts (approximate; a few rows carry two statuses)
| Part | MATCHES | DIFFERS | NOT BUILT | SUPERSEDED | DEFERRED |
|---|---|---|---|---|---|
| 1 Verse Understand sheet | 9 | 19 (3 of them are unbuilt features: UX-03, UX-08, UX-09) | 0 (+NA-02 by decision) | 26 | 0 |
| 2 Passage guide, start here | 8 | 7 | 5 | 24 | 7 |
| 3 Notes, people, places, dictionary | 9 | 9 | 11 | 2 | 0 |
| 4 Words, grammar, book intros | 13 | 9 | 7 | 3 | 0 |

## Cross-cutting (affects every sheet in this area)
- Section titles inside every Understand, guide, word and study sheet are 13 pt grey `Label`s
  (components/Sheet.tsx:303, `Section`); the polish asks for 20 pt bold ink in sheets. `SectionTitle` exists
  (components/Type.tsx:222) and is not used here. HIGH: this is most of the "doesn't look like the UI".
- Sheet × and ‹ are grey-fill discs (Sheet.tsx:164, `palette.fill`), not white circles with a hairline ring. Rows are 52 pt, not 56. Sheet top radius is 38, not 36.
- ‹ inside the sheet never names where it goes back to (Sheet.tsx:188); DN-06 draws "‹ 14:34".

Frame files for OR-02..OR-06 and HM-01 are missing from the canvas export, so those were judged from their titles and docs/build-10-plan.md.


---

# Design QA · group 1 · the verse Understand sheet

App root: `apps/mobile/src` (paths below are relative to it). Frame CSS read from `VS-02.dc.html` (the polish block at the end of style-v2.css wins).

Decisions applied before judging:
- `docs/handoff-2026-10-12-build.md:117`: header is the plain reference ("John 3:16", no "· Understand"); source codes (UST, tN, Tyndale, Translation Words) appear only in Sources. So the VS frames' "· Understand" and "· UST" headings are **not** reported as differences.
- `docs/redesign/qa-next-release.md:58-67`: already lists, for John to decide, the VS-04 Manuscripts row, the VS-02 "evidence marks (MACULA)" line, and the NA Notice-row layout. It also records U-01–U-04 and UX-01/06/07/09 as v2 AI-era layouts that IA-11 replaced.
- `docs/no-ai-understand.md`: AI entries are retired, so every "What's happening / What we can see / Where readers differ / Three things to notice / Why we say this / In the Greek" frame is superseded.
- `docs/build-plan-new-flows.md:16` and SN-09: Original opens in place with a bare chevron, and × is the one way out (no Back to reading capsule).
- Frame order: page "next" is newer than "guide", and inside "next" the VS rows (VS-01–07, 12 Oct, John's approved spec) come after the UX and NA rows. So VS supersedes UX-01/02 and NA-01/02/05/06 for the sheet's layout.

## Issues that cut across the whole sheet

| Frame | Status | Differences (file:line: frame vs app) | Severity |
|---|---|---|---|
| All VS/NA/UX/DI sheets | DIFFERS | `components/Sheet.tsx:303`: `Section` renders its title with `Label` (13 pt, semibold, muted grey; `design/type.ts:48`). The frame CSS (`.sheet .sec > .lbl`) and polish-2026-10-15.md:14 call for **20 pt bold sans in ink, tracking −0.4**. A `sectionTitle` token (22 pt) and a `SectionTitle` component exist (`Type.tsx:222`), but Understand never uses them. Every heading in the sheet is affected: In plain words, Readers differ · 2, Notice, Go deeper, Read it alongside, Manuscripts, Study notes, See also, People and places, Your verses, In short. | high |
| All sheets | DIFFERS | `components/Sheet.tsx:164`: the round × and ‹ buttons use `palette.fill` (grey translucent) with no ring. The frame (`.sh-x,.sh-back`) and polish ("white circles with a hairline ring") want a `--paper` white fill with a 1 px `--div` ring. | medium |
| All sheets | DIFFERS (unverified on device) | `app/_layout.tsx:262`: `sheetCornerRadius: 38`. Polish asks for a 36 pt top radius on a full-width sheet. | low |
| DN-06 (and every push inside the sheet) | DIFFERS | `components/Sheet.tsx:188`: ‹ is an icon-only circle; its destination is only in the VoiceOver label. DN-06 draws a **named pill**, "‹ 14:34" (`.sh-back.named`: auto width, min 44, padding 0 14 0 8). `TermPage` passes `backLabel={shortRef}` (`UnderstandPages.tsx:99-101`), but `backLabel` only feeds the Back to reading footer, which `UNDERSTAND_EXIT` hides, so "14:34" never appears on screen. | medium |

## Verse sheet: VS (newest; John's spec, 12 Oct)

| Frame | Status | Differences (file:line: frame vs app) | Severity |
|---|---|---|---|
| VS-01 | DIFFERS (minor) | Order matches: a plain line over 30 words stands alone, then More on this verse (`lib/understand.ts:114-124`). Header is plain by decision. Differences: (1) "More on this verse" is weight 500 with a ⌄ icon (`UnderstandViews.tsx:287-290`); the frame has `.morev .claim` at **600** with a › chevron. The ⌄ was a deliberate 15 Oct UX-pass change (comment at :285), so only the weight is a true miss. (2) The app adds "Hear this passage" above More (`:279-283`). That is UL-01 (15 Oct), a later decision, so it is not a defect. | low |
| VS-02 | DIFFERS | (1) `UnderstandViews.tsx:168-174`: the full view repeats the verse at reading size at the top whenever the sheet is large. VS-02 does **not** repeat it; only VS-07 (AX5) does. (2) The Go deeper "Manuscripts" row is missing (`GoDeeper`, `:511-545`; VS-04 draws it). Manuscripts render as a body section (`:400-408`), recorded in qa-next-release.md:59 for John. (3) The Original row's line drops "· evidence marks (MACULA)" (`:559`, `lib/goFurther.ts:7-11`), also recorded. (4) The added-word tip is a muted line (`:352-358`), not the frame's grey-fill `.addtip` box (padding 8/10, radius 10), a deliberate QA fix (qa-next-release.md:31). (5) Read it alongside rows use `Row` at 44 pt min with 12 pt padding (`:422-427`); the frame's `.lrow` is 56 pt min with 15 pt padding and a hairline. | medium |
| VS-03 | MATCHES (structure) | Readers differ · N first, then One way to read it at body size with the voice line, then Manuscripts, then More (`UnderstandViews.tsx:258-277`, `lib/understand.ts:97-112`). One small difference: half-view readings have no `.rdq` hairline under each (`:246-250`, marginBottom only). | low |
| VS-04 | DIFFERS | Order matches (readings, plain line, Manuscripts, Go deeper, Notice, Read it alongside; `:398-430`). Still missing: the Go deeper **Manuscripts** row ("What the manuscripts differ on"). "Read the full note" exists as an accent TextLink (`:465`). The repeated verse at the top is extra, as in VS-02. | medium |
| VS-05 | MATCHES | Readers differ first with the JPS line (`lib/understand.ts:68-77`). Whether a plain line shows depends on the data. | — |
| VS-06 | DIFFERS | Its title calls for "Compare with JPS 1917". The Compare row's line (`UnderstandViews.tsx:507,521`) lists only on-phone versions; **JPS 1917 is not a Compare version anywhere in the app** (grep finds JPS only in `lib/sources.ts` and tests). Both readings, Go deeper and Notice otherwise match. | medium |
| VS-07 | DIFFERS | At AX sizes `full = … \|\| ax` (`UnderstandViews.tsx:122`), so the sheet opens straight into the **full view** with no "More on this verse". VS-07 draws the half-view content (repeated verse, In plain words, More on this verse) at a large detent. The verse repeat itself matches (`:168-173`). | low |
| MM-06 | MATCHES | "Kept 12 Oct" in the subtitle (`UnderstandViews.tsx:129-133`). The app joins it after the passage line ("Nicodemus by night · 3:1–21 · Kept 12 Oct"); the frame shows "Kept …" alone because its title still carried "· Understand". | low |
| US-08 | DIFFERS | Copy matches: "This verse’s explanation couldn’t be opened." (`UnderstandViews.tsx:140-142`). Differences: (1) **Try again** is accent text in a full-width `Row` (`:143-147`); the frame's `.tbtn2` is a grey-fill capsule, min 44 pt high, 18 pt side padding, ink 600 at chrome size (the same pattern as `StudyLayer.tsx:151-161`). (2) The title is "John 1:5" with a separate muted "Understand" subtitle (`:139`); the frame puts it on one line, and the header decision drops "Understand" entirely. | medium |
| EG-02 | DIFFERS | Offline, before the book's bundle is saved, `useUnderstandFile` returns `"none"` (`data/understand.ts:70-71`), so `NoUnderstand` shows no Understand line; "Getting Understand for Luke." appears only while fetching (`UnderstandViews.tsx:639-643`). The frame's line, **"Understand for Luke downloads when you’re online."**, appears nowhere (grep finds only the study notes' `OFFLINE_LINE`, `lib/study.ts:546`). When nothing leads, the rows also have **no "Go deeper" heading** and Original opens already expanded (`:628, 652`). The frame draws "Go deeper" with Original and Compare collapsed. | medium |
| UX-12 | DIFFERS (minor) | The same Understand on NKJV is honoured, since the bundle is translation-independent. On a licensed version the app adds a muted line, "Explanation based on BSB" (`UnderstandViews.tsx:161-165`, `lib/translations.ts:163`), which UX-12 does not draw. Other differences are the older NA/UX layout, superseded by VS. | low |
| UX-11 | DIFFERS | On KJV, UX-11 says BSB-bound lines either say "In the BSB, …" or step aside: BSB footnotes hide, and translation differences use the reader's version as the base ("your KJV against the others"). The app shows `translatorNotes` and `verse.facts` regardless of `translation` (`UnderstandViews.tsx:382, 411-419`; `lib/understand.ts:141-146`). Word-count facts are not prefixed "In the BSB", and "Translations differ" stays BSB-first. Footnotes are at least labelled "The BSB’s own footnote:". | medium |
| DN-02 | SUPERSEDED by VS-02/VS-04 | VS draws Read it alongside as reference-only rows, which the app follows (`UnderstandViews.tsx:420-429`), so the "· BSB" label on verse text has nothing to attach to. Not checked: whether `/evidence/peek` labels BSB text under a licensed version. | — |
| DI-01 | DIFFERS (minor) | `UnderstandPages.tsx:58-71`: the title is "Key words" with the verse as subtitle. The frame keeps the verse ("1 Corinthians 14:34" over the passage line) as the title, with **Key words** as a 20 pt section heading. Each row's definition is `Prose claim` at 16 pt (`:64`); the frame has `.note muted` at 13 pt. The credit matches. | low |
| DN-06 | DIFFERS | See the cross-cutting table: the named "‹ 14:34" pill is missing. Subtitle "Dictionary" against the frame's "Key word" follows DI-02 (qa-next-release.md:20), so that is fine. | medium |

## No-AI Understand: NA (older than VS on the same page)

| Frame | Status | Differences | Severity |
|---|---|---|---|
| NA-01 | SUPERSEDED by VS-03/VS-04 | The Notice facts as rows with a "Compare"/"Word counts" caption and chevron, and a "More" group (Key words, Compare translations), were replaced by VS's Go deeper. Recorded in qa-next-release.md:63. The header (reference over "Order in the assembly · 14:26–40") is what the app builds (`UnderstandViews.tsx:131, 237-239`). | — |
| NA-02 | SUPERSEDED / NOT BUILT by decision | "John’s note … Written by John · reviewed" is not built: John is never cited (qa-next-release.md:47; memory "John never cited"). The remaining layout is as NA-01. | — |
| NA-03 | DIFFERS | Range 14:34–35 opens the guide with "Your verses" first, which matches (`PassageGuide.tsx:95-100`). Differences: (1) the heading is "Your verses · 14:34–35", without "in plain words"; (2) each verse is a chevron row with a 12 pt verse number (`:117-139`), not continuous plain paragraphs with the "One plain reading · words in grey…" credit; (3) the frame's verse-level **Readers differ** for the selected verses and their **Notice** facts are missing: the guide shows only `passage.debates` (`:172-180`) and no Notice. "Where we are" (Tyndale) and "The passage" text are superseded by NA-04. | medium |
| NA-05 | SUPERSEDED by VS layout | Behaviour matches: order is driven by `beginner.order`, with readers first where the data says so. | — |
| NA-06 | SUPERSEDED by VS-05/VS-06 | — | — |
| NA-07 | MATCHES | The voice line "Bildad the Shuhite says:" sits above the plain line at 13 pt semibold ink (`UnderstandViews.tsx:312-316`; frame `.voice` is note size, 600, ink, 4 pt below). | — |
| NA-08 | MATCHES (behaviour) | "In John’s vision:" voice line, then Readers differ first. The layout follows VS. | — |

## UX pass (12 Oct): beginner, Go deeper groups, ranges

| Frame | Status | Differences | Severity |
|---|---|---|---|
| UX-01 | SUPERSEDED by VS-01 (+ IA-11) | AI "Where we are", Notice and "Readers differ on 2 questions here" are gone; qa-next-release.md:67. | — |
| UX-02 | SUPERSEDED by VS-02 | The five question-named groups (In the original · In other translations · Who and where · Around this verse · What others say) are replaced by VS's one fixed-order Go deeper list. A consequence: **See also, Themes and the passage-guide row have no place** on a verse that has an entry (`GoDeeper`, `UnderstandViews.tsx:502-547`). That follows VS, but it is worth John knowing. | low |
| UX-03 | DIFFERS | Verse with no entry (`NoUnderstand`, `UnderstandViews.tsx:613-655`). (1) People are one row each (`StudyLayer.tsx:314-341`), not the frame's single line of 44 pt names "Lazarus · Bethany · Mary · Martha" (also PD-01). (2) The frame's **"In this passage"** section with a "Raising Lazarus · the guide" row is missing, so there is no way to the guide from here. (3) The Go deeper groups are superseded by VS. Study notes inline with "Read the whole note" and the Tyndale credit match (`StudyLayer.tsx:241-263`). This state is now rare: bundles cover all 66 books. | medium |
| UX-04 | MATCHES | Range selected: the bar reads "Understand 1:1–18" (`app/read/[book]/[chapter].tsx:620`, `ActionBar.tsx:124`). The ▶ shows a glyph alone, not "1:1" (a deliberate 15 Oct UX-pass change, `ActionBar.tsx:95-96`). | — |
| UX-05 | SUPERSEDED by NA-04 | Guide slots are In short → Readers differ → Read it alongside → Go deeper → Sources (`PassageGuide.tsx:143-216`). The AI "Three things to notice" and the passage text are retired. | — |
| UX-06 | DIFFERS (minor) / mostly SUPERSEDED by NA-03 | "Your verses · 1:3–5" first matches. The frame's rows ("1:3 / Study notes · 2") are now plain-line rows. "Marked in the text" no longer applies, because the guide has no passage text (NA-04). | low |
| UX-07 | MATCHES | "Your selection continues" with one row, "<next label> / John 1:19–34 · its guide" (`PassageGuide.tsx:103-111`). | — |
| UX-08 | DIFFERS (built differently) | Book with no guides, range selected. The frame wants "Mark 1:1–4" with **verse by verse**: a 1:1 heading, two lines of that verse's study note, a "More on 1:1" row, "No study note on this verse." where empty, and one Tyndale credit. The app shows a single Tyndale passage note in a "Study notes" section (`PassageGuide.tsx:54-87`). review-2026-10-12.md:91 and notes ("Already drawn, to build: UX-03/08") list it as to build. Rare now that all books have bundles; it still applies offline. | medium |
| UX-09 | DIFFERS | The frame puts "Verse by verse" **inline in the guide**, after the overview: each row has the verse number, the **BSB verse text** and a muted line of what lies behind it ("Explained · Study note", "Speaking: John the Baptist"). The app puts Verse by verse as a Go deeper row (`lib/passageGuide.ts:104`) that pushes a page (`UnderstandPages.tsx:192-233`). That page shows each verse's **UST plain line**, not the BSB text, and has **no "what’s behind it" line**. | medium |
| UX-10 | SUPERSEDED by NA-04 slots | Residual: no passage-level Original (verse by verse) or Compare (verse by verse) from the guide (`lib/passageGuide.ts:98-109`), and no "Who and where" (speaker/named). | low |
| UX-11 | DIFFERS | See the VS table above. | medium |
| UX-12 | DIFFERS (minor) | See the VS table above. | low |

## Guide page and IA frames

| Frame | Status | Differences | Severity |
|---|---|---|---|
| SN-01 | SUPERSEDED by VS-02 | "Go further" with Study notes / See also / Compare / passage guide rows becomes VS's Go deeper. The AI "Where readers differ" is retired. | — |
| SN-09 | MATCHES (behaviour) | Original expands in place, with ⌄ swapped to ⌃ (`UnderstandViews.tsx:549-607`). It shows the word grid and "Glosses: STEPBible (…)" (`OriginalWords.tsx:158-161`). The AI "In the Greek" grammar notes are retired. The rest of its list is superseded by VS-02. | — |
| IA-05 | MATCHES | Verse selected: ▶, "Understand 1:1" (primary, ink), Compare glyph, ⋯; no Original when the verse has an entry (`ActionBar.tsx:110-160`, `lib/reader.ts:131-134`). The ▶ is a glyph without "1:1", a deliberate change. | — |
| IA-07 | SUPERSEDED by NA-04 / no-ai-understand.md | It was a word-budget annotation for the AI guide ("What’s happening", "Three things to notice"). | — |

## Older v2 Understand frames: what supersedes each

| Frame | Status | Superseded by | Severity |
|---|---|---|---|
| U-01-v2 | SUPERSEDED | VS-01 (half view), and the "Simpler Understand" variant was never chosen; AI entries retired (no-ai-understand.md) | — |
| U-02-v2 | SUPERSEDED | VS-02 (full view; Go deeper fixed order) | — |
| U-03-v2 | SUPERSEDED | SN-09 (Original in place); AI "In the Greek" notes retired | — |
| U-04-v2 | SUPERSEDED | VS-01/VS-02 (John 1:1 same pattern) | — |
| JN-03-v2 | SUPERSEDED | VS-01 (first-time hint and AI sections gone) | — |
| JN-04-v2 | SUPERSEDED | SN-09 (Original Greek expanded in place) | — |
| J01-03-v2 | SUPERSEDED | VS-03 (1 Cor 14:34 half view) | — |
| J01-04-v2 | SUPERSEDED | VS-04 (1 Cor 14:34 full view) | — |
| J01-05-v2 | SUPERSEDED | Retired with the AI entries (no-ai-understand.md: "Why we say this" evidence for AI claims); VS-04 Notice and Sources replace it | — |
| J01-06-v2 | SUPERSEDED | SN-09 (Original in place) | — |
| J01-12-v2 | SUPERSEDED | UX-06 / NA-03: range opens the passage guide; "the separate passage-Understand screen goes" (notes, UX pass). A stale comment still cites it: `app/read/[book]/[chapter].tsx:534` | — |
| GN-02-v2 | SUPERSEDED | VS-02 (AI claims retired; Hebrew in English claims n/a) | — |
| GN-03-v2 | SUPERSEDED | SN-09. Hebrew right to left in place is kept (`OriginalWords.tsx`) | — |
| N-01-v2 | SUPERSEDED (copy carried over) | VS-02/SN-09 layout. The pericope-adulterae sentence is word for word (`lib/omissions.ts:60`). Its Back to reading footer was dropped by SN-09's × rule. One copy issue nearby: `lib/omissions.ts:66` says "There is no Greek for this verse **in Yada yet**", and "yet" is banned (review-2026-10-12.md:91; CLAUDE.md "no coming later") | low |
| P-02-v2 | SUPERSEDED | SN-09 (Original Hebrew in place); VS-02 for the rest | — |

## Top differences in my group

1. **Section titles in every sheet are 13 pt grey labels, not 20 pt bold ink** (`components/Sheet.tsx:303` uses `Label`; polish-2026-10-15.md:14 and the frame CSS `.sheet .sec > .lbl`). This alone makes Understand "not look like the UI". High.
2. **× and ‹ are grey-fill circles without the white fill and hairline ring** (`Sheet.tsx:164`; polish "white circles with a hairline ring"). Medium.
3. **‹ inside the sheet never shows where it goes** ("‹ 14:34" pill, DN-06); it is icon-only (`Sheet.tsx:188`). Medium.
4. **The full view repeats the verse at the top at every large detent** (`UnderstandViews.tsx:168-174`); VS-02/VS-04 don't, only AX5 (VS-07) does. Conversely, at AX5 the sheet skips the half view and More on this verse (`:122`). Medium/low.
5. **Go deeper lacks the Manuscripts row** (VS-04) and **JPS 1917 in Compare** (VS-06) (`UnderstandViews.tsx:502-547`). Medium.
6. **EG-02 offline line missing**: no "Understand for <Book> downloads when you’re online."; with nothing leading, no "Go deeper" heading and Original opens expanded (`UnderstandViews.tsx:613-655`, `data/understand.ts:70`). Medium.
7. **US-08 Try again is accent text in a row, not the grey capsule** (`UnderstandViews.tsx:143-147`), and the title carries a stray "Understand" subtitle. Medium.
8. **UX-11 BSB-bound lines aren't adapted on KJV/WEB/LSV** (no "In the BSB, …", footnotes don't step aside, diffs stay BSB-based) (`UnderstandViews.tsx:382,411-419`). Medium.

## NOT BUILT in my group

- **UX-08**: verse-by-verse study notes for a range in a book with no guides. The app shows one Tyndale passage note instead (`PassageGuide.tsx:54-87`).
- **UX-09 inline "Verse by verse"** with BSB text and a "what's behind it" line. Only a pushed page of UST lines exists (`UnderstandPages.tsx:192-233`).
- **UX-03 "In this passage"** guide row for a verse with no entry, and the one-line People list.
- **EG-02's offline Understand line.**
- **VS-04's Go deeper "Manuscripts" row** (recorded for John in qa-next-release.md:59).
- **VS-06's JPS 1917 as a Compare version.**
- **DN-06's named back pill.**
- **NA-02's "John's note"**: not built, by decision (John is never cited).

---

# Design QA, group 2: passage guide and start-here onboarding

App root: `apps/mobile/src` (paths below are relative to it). REPO = the loving-cori worktree.

Supersession record used throughout:
- `docs/redesign/build-plan-next-release.md:234-240` ("Superseded frames: don't build from these"): PG-03, ON-04 → NA-04/JR-05 with MM-01 for Next; PG-04 "What's happening" → VS/NA; ON-07 "All passages in John" → IA-14; JN-01 → ON-01/IA-14; v2 U-01–04 and J01 → VS/NA.
- `docs/redesign/qa-next-release.md:49` (PG-03: In short leads), `:63` (NA-01–08, JR-05, JR-07, EG-01: build follows the later VS/GD frames), `:67` (U-01–04, PG-03/04, UX-*: v2 AI layouts, "can be archived").
- `docs/no-ai-understand.md` + notes `refs_na` (12 Oct): Yada's own "Where we are", "Three things to notice", "Where readers differ" and the AI entries are gone. Every AI-era guide frame (PG-02..PG-10, GD-02, GD-03, IA-08) is drawn on that removed structure.
- `docs/handoff-2026-10-12-build.md:34-45` and `docs/build-7-plan.md:121`: the timeline, themes and MACULA marks were moved out ("don't build them; the frames stay on the canvas"). Not in build 7 either.
- BH-01 (b9, approved 18 Oct in `build-10-plan.md` on branch funny-brahmagupta) supersedes every older Home lead frame (ON-01/05/07, IA-03, IA-14, DP-01): one serif "Continue" heading over one card, the plan on Today only, no passage count.

Newest guide frames: **UL-02 / UL-04** (b6, 15 Oct): In short → Hear this passage → Go deeper (Verse by verse · Study notes · Key words) → Sources ("Every source and licence"). The app's `components/PassageGuide.tsx` is built to this shape.

Shared sheet findings (apply to every guide, Understand and guide sub-page in this group; the polish doc applies even where a frame predates it):
- S1. Section titles in sheets are 13 pt semibold grey labels: `components/Sheet.tsx:303` uses `Label` = `design/type.ts:49` (13 pt, weight 600, tone muted). Polish (`docs/redesign/polish-2026-10-15.md:14`, and NA-04's CSS `.sheet .sec > .lbl{font-size:20px;font-weight:700;color:var(--ink)}`) says 20 pt bold sans in ink inside sheets. A `sectionTitle` step exists (`type.ts:45`, 22 pt bold) but sheets never use it. **High**: "In short", "Readers differ", "Go deeper", "Read it alongside" all read as the old grey labels.
- S2. × and ‹ are grey-fill circles (`components/Sheet.tsx:164`, `backgroundColor: palette.fill`). Polish: white circle with a hairline ring (`.sh-x,.sh-back{background:var(--paper);box-shadow:0 0 0 1px var(--div)}`). Medium.
- S3. Page list rows (Bible tab books, Start here list) are 52 pt min height, 12 pt padding, 1 px rule (`components/Page.tsx:232, 289, 307-308`). Polish: 56 pt, 15 pt padding, 0.5 px hairline (`.lrow{min-height:56px;padding:15px 0}`, `.lrow + .lrow{box-shadow:0 -0.5px 0 var(--div)}`). Low.

## A. Bible tab / start here (Home)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| BH-01 | DIFFERS (small) | Built to BH-01: serif wordmark, "Continue" serif 24 pt heading over one 24 pt-radius soft-fill card (title Literata 26 semibold, subtitle muted), books under serif "Old Testament"/"New Testament" headings, no plan row, no count (`app/(tabs)/index.tsx:223-282, 337-360, 445-447`). Differences: (1) no Search button beside the tab bar. BH-01 and IA-15 draw `Today · Bible` plus a separate Search circle (`.tbs`), and `docs/build-7-plan.md:29,101,130` says "Search beside them"; the app's `app/(tabs)/_layout.tsx:3-5,17-28` has two tabs only, with a code comment that defers it to after build 7a. (2) "Old Testament" heading has 6 pt below it (`index.tsx:342` overrides the heading's 10) vs `.bhh` margin `26px 0 10px`. (3) For the "next" lead the card title is the range "John 1:19–34" (`index.tsx:246`) where BH-01's card names the chapter ("Psalm 79"). (4) The card's VoiceOver label is "Continue reading, <passage>, <ref>. <excerpt>" (`index.tsx:266`). BH-01's is "Continue, Psalm 79. A Prayer for Deliverance", with no excerpt. (5) Book rows: S3. | Medium for (1); low otherwise |
| ON-01 | SUPERSEDED by BH-01 (layout); copy kept | First launch shows the BH-01 card shape with heading "Start here", title "The Gospel of John" and subtitle "One passage at a time, explained." (`index.tsx:227-237`). ON-01's label text is kept exactly. ON-01 drew a cover lead, not a card. | — |
| ON-02 | MATCHES | Start here opens John 1:1–18's text, then raises the guide over it (`index.tsx:185-188`; `app/read/[book]/[chapter].tsx:401-412`). The guide it shows is the NA-04/UL-02 guide, not ON-02's AI body (see section B). | — |
| ON-03 | MATCHES | × closes onto the text. The hint "Tap a verse to see what it meant." sits under the passage title, shown once (`[chapter].tsx:134-139, 427-435, 854-859`). | — |
| ON-04 | SUPERSEDED | `build-plan-next-release.md:236`: Next at the end of the guide becomes MM-01's "Next passage" line in the reader (`[chapter].tsx:1078-1107`). The guide has no Next row (`PassageGuide.tsx` has none). Stale comment: `components/Sheet.tsx:86-88` still says the guide counts a passage read when "its Next row comes into view (ON-04)". | — |
| ON-05 | SUPERSEDED by BH-01 | ON-05 drew "Continue · John 1:39" with the excerpt, tick progress and a count. BH-01 drops the count and ticks. The app follows BH-01 (`index.tsx:254-281`). | — |
| ON-06 | MATCHES (order) | VO order is header icons, wordmark, lead, books (`index.tsx:190-215, 285`), checked in `docs/app-v1/qa/guide-audio/qa-report.md:47`. Label wording: see BH-01 (4). | Low |
| ON-07 | SUPERSEDED by BH-01 | "Next · John 1:19–34" lead, "1 of 46 passages read", "Your plan" row. BH-01 keeps one "Continue" card with the plan on Today. The app's next lead is "Continue" + range + label (`index.tsx:239-252`). | — |
| IA-03 | SUPERSEDED by BH-01 | Tick progress strip and Next row: removed by BH-01. | — |
| IA-14 | SUPERSEDED by BH-01 | The "Your plan" line moved to Today (`app/(tabs)/today.tsx:205-238`); no count on the Bible tab. | — |
| DP-01-v2 | SUPERSEDED (ON-01 → BH-01) | "Start with John" with the λόγος cover lead. Not in the app. | — |

## B. The passage guide sheet

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| UL-02 | DIFFERS (small) | Shape matches: title/subtitle header, × only, In short (bold headline, Literata line), Hear this passage with ▶ trailing, Go deeper rows, Sources "Every source and licence" (`PassageGuide.tsx:94, 143-215`; `HearPassage.tsx:22-43`; `lib/passageGuide.ts:106-123`). Differences: (1) S1 section titles. (2) The app always adds "Check what you read" (and "About this psalm" for psalms) to Go deeper (`lib/passageGuide.ts:115`). UL-02 has three rows. (3) Hear this passage is a 44 pt `Row` after a 20 pt gap (`PassageGuide.tsx:169-171`; `Sheet.tsx:473`). The frame sets it as its own section (`.lrow`, 52–56 pt, section gap 40). (4) The Sources row sits 20 pt below Go deeper (`PassageGuide.tsx:206`) vs one section gap (40). (5) The headline is Chrome 17 pt/600 (`PassageGuide.tsx:152`) and the lines Literata 17 (`:157`). The frame has `.claim b` 16 pt bold and `.snote` Literata 16 pt, line height 1.6. | Medium (S1); low otherwise |
| UL-04 | DIFFERS | "Nothing empty, nothing promised": Proverbs shows only Verse by verse and Study notes. `guideRows()` (`lib/passageGuide.ts:106-117`) pushes Study notes, Key words and Check what you read for every passage, whatever the data. A passage with no key words opens a Key words page holding only its credit line (`UnderstandPages.tsx:51-73`). A passage with no tQ opens an empty Check page (`UnderstandPages.tsx:124-164`). | Medium |
| NA-04 | SUPERSEDED by UL-02 (slot names), else MATCHES | NA-04's "More" became "Go deeper" (UL-02; code comment `PassageGuide.tsx:195`, IA stress test 15 Oct). "15 verses, each with its Understand" became "15 verses" (`lib/passageGuide.ts:111-113`, UX pass 15 Oct). NA-04 listed the source credits in the Sources row. The app says "Every source and licence", as UL-02 does. In short with Before/After line and fact matches (`lib/passageGuide.ts:51-74`). | — |
| JR-05 | SUPERSEDED by UL-02 (rows/sources) | JR-05 has Key words note "comfort · glory · the LORD", a Sources block of credit text plus a "Licences" button, and "More". The app has "What its main words mean", one Sources row, and "Go deeper", all per UL-02. "Read it alongside" exists, but its rows are inert: `PassageGuide.tsx:183-193` draws them as rows (`Row`, hairlines) with no `onPress` and no chevron, and "Also told in" sits under the first row only. In the verse sheet the same slot opens a peek (`UnderstandViews.tsx:420-429`). | Medium (inert rows that look tappable) |
| JR-07 | SUPERSEDED | "Written by John · reviewed" note: never built, because John is never cited (`qa-next-release.md` row NA-02; memory "John never cited"). The "Compare translations" row in More is not a guide row now; UL-02's Go deeper replaces it. Readers differ shows approved source sentences (`PassageGuide.tsx:172-180`). | — |
| EG-01 | SUPERSEDED (recorded for John) | EG-01 draws "Where we are" with a BSB footnote credit and inline "Verse by verse" rows with full verse text. The app keeps the facts in In short (`PassageGuide.tsx:161-165`) and Verse by verse as a pushed row. `qa-next-release.md:63` records that the build follows the later frames. | — |
| JR-04 | MATCHES (by decision) | Section name (13 pt semibold muted) and setting line (note muted) above the Literata 19 semibold passage title with chevron (`components/ReaderLeads.tsx:25-40`; `[chapter].tsx:847-850, 1078-1107, 1184-1187`). The setting line is dropped when it repeats the section name (`lib/passageGuide.ts:136-156`, John 12 Oct; `build-plan-next-release.md:212`). JR-04 itself shows both lines, so on Isaiah 40 the app shows one line where the frame shows two. | — |
| GD-02 | SUPERSEDED (no-AI; NA-04/UL-02) | The four AI parts: Where we are, Three things, Where readers differ, The passage. | — |
| GD-03 | SUPERSEDED | The guide no longer carries passage text (`review-2026-10-12.md:53`; NA-04). The verse-4 manuscript line lives in the reader and in Verse by verse (`UnderstandPages.tsx:212-215`). | — |
| GD-04 | MATCHES (changed shape) | Rest bar with Listen alone when there is no passage (`[chapter].tsx:1032-1059`, `alone={restPassage === null}`). When a book's Understand file is missing, the guide opens on Tyndale's note (`PassageGuide.tsx:44-45, 78-85`). | — |
| PG-01 | MATCHES | The passage title above verse 1 opens the guide; VoiceOver label "…Opens the passage guide" (`[chapter].tsx:849, 1078-1107`). | — |
| PG-02 | SUPERSEDED (no-AI) | "Where we are", "Three things to notice", "Where readers differ", "The passage": none exist (`PassageGuide.tsx`). The `qa-report.md:47-51` "matching" verdict from the AI build no longer applies. | — |
| PG-03 | SUPERSEDED | `build-plan-next-release.md:236`, `qa-next-release.md:49`. | — |
| PG-04 | SUPERSEDED | `build-plan-next-release.md:235`. The push mechanism survives: a verse opens inside the guide stack (`app/guide/_layout.tsx`, `app/guide/verse.tsx`; `PassageGuide.tsx:117-141`). | — |
| PG-05 | SUPERSEDED (no-AI) | "Closer to the Greek · λόγος" expanding line: not built. The nearest is Key words / Original in the verse sheet. | — |
| PG-07 | SUPERSEDED (NA-04 redraws this passage) | — | — |
| PG-08 | SUPERSEDED | σιγάω evidence inside "Three things": gone with the claims. | — |
| PG-09 | SUPERSEDED | — | — |
| PG-10 | SUPERSEDED | Claim evidence underlined in "The passage": no claims and no passage text in the guide. | — |
| IA-08 | SUPERSEDED (no-AI) | "Agreed first, equal parts, no winner" readings structure. The app lists approved source sentences under "Readers differ" (`PassageGuide.tsx:172-180`). | — |
| UL-01 | DIFFERS (small, mostly by decision) | Verse half view: plain line, then Hear this passage (range "Nicodemus by night · 3:1–21"), then More on this verse (`UnderstandViews.tsx:278-292`). By decision: header "John 3:16" + passage subtitle, not "John 3:16 · Understand"; label without "· UST" (`qa-next-release.md` VS rows); More uses ⌄ not › (`UnderstandViews.tsx:285-287`, review §2.3). Real differences: Hear and More are 44 pt rows under one 20 pt gap (`UnderstandViews.tsx:279-291`). The frame gives each its own section with the section gap. S1. | Low |
| JN-07-v2 | SUPERSEDED | AI range Understand with "Unreviewed" and "Back to reading" (`build-plan-next-release.md:240`). A range now opens the guide with "Your verses · 1:1–5" first (`UnderstandViews.tsx:68-74`, `PassageGuide.tsx:95-101`). | — |

## C. Start here list (thread)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| GD-01 | DIFFERS | The list matches: numbered Literata rows, done rows muted with an accent check, "Next · 5:1–15" in accent above a semibold title, orientation beneath (`app/thread.tsx:76-140`). GD-01's subtitle is "9 of 46 passages read". The app's is the DP-03 cover line "λόγος logos · “word” · 46 passages, in order" (`thread.tsx:63-72`), so this page shows no read count. `lib/startHere.ts:133-135` `progressLine()` exists but nothing in the app calls it. Rows: S3. | Medium |
| PG-06 | MATCHES (older) | Cover line plus Next row as drawn. GD-01 supersedes the subtitle. | — |
| DP-03-v2 | SUPERSEDED by PG-06 / GD-01 | "Next" at the trailing edge became Next marked in type. | — |

## D. Guide sub-pages and later additions

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| UW-01 | DIFFERS | The term page pushes inside the sheet with ‹ (`UnderstandPages.tsx:80-122`). Frame: subtitle is the passage ("John 10:1–21"), then a section "In John" with one row "Passages that use the term" from the article's own list. App: subtitle "Dictionary" (`:101`), then a section "In John · N places" listing up to 50 verses with BSB text (`:103-115`). It is reached through the Key words list (`:51-73`), not from a term in the guide's text: the guide has no running text. | Low |
| UW-02 | DIFFERS | Placement is superseded: the check is a Go deeper row that pushes a page (NA-04/UL-02), not inline at the guide's end before Next. The disclosure is missing: the frame has a visible "Show the answer" / "Hide the answer" button under each question (`.evx`). The app reveals the answer when the whole row is tapped, with no visible control (`UnderstandPages.tsx:139-156`; same in `UnderstandViews.tsx:473-495`); only VoiceOver gets the hint "Shows the answer". | Medium |
| TL-01 | DEFERRED BY DECISION | `docs/handoff-2026-10-12-build.md:41` ("the timeline", moved; "don't build them"), `docs/build-7-plan.md:121` ("Not in build 7: the timeline, themes"). Its host section "Where we are" is also gone. build-10-plan 10b moves time to book orientation, "order only, no dates". | — |
| TL-02 | DEFERRED BY DECISION | As TL-01. | — |
| TH-01 | DEFERRED BY DECISION | `handoff-2026-10-12-build.md:42` ("themes"); `build-7-plan.md:121`. `lib/passageGuide.ts:67` folds a passage's `themes` into In short as "Themes: a · b", plain text. TH-01's "Themes in this passage" is a list of up to three tappable rows near the end. | Low (In short line not in any frame) |
| TH-02 | DEFERRED BY DECISION | No theme page (grep: none). | — |
| GS-01 | NOT BUILT | No "Speaking" line anywhere (grep `Speaking`, `Glyssen` in app: only `lib/sources.ts`). Glyssen enters only through the pipeline's "<Speaker> says:" sentence framing (`docs/no-ai-understand.md:353-357`). The host section "Where we are" was removed by the no-AI decision. GS is not in the moved list (`handoff-2026-10-12-build.md:34-45`), so it is neither deferred nor redrawn. | Low |
| GS-02 | NOT BUILT | The "3:14–21: possibly still Jesus speaking…" muted line does not exist. | Low |
| GS-03 | NOT BUILT | No "and 5 more" speaker list. | Low |
| MC-01 | DEFERRED BY DECISION | `handoff-2026-10-12-build.md:44` ("MACULA evidence marks"); MM-03 "Not built, with the reason" (`qa-next-release.md`). The claims MC marks no longer exist (no-AI). | — |
| MC-02 | DEFERRED BY DECISION | As MC-01. | — |
| MC-03 | DEFERRED BY DECISION | As MC-01. | — |
| HM-01 | NOT BUILT (build 10) | No ⋯ in the guide header and no "Share handout" (grep: none). The guide's `SheetScreen` header has ‹/× only (`components/Sheet.tsx:184-195`). Approved 18 Oct in build-10-plan (branch funny-brahmagupta, "Design approved"); 10a not built yet. No extracted frame file on disk (`frames/HM-01.txt` and `HM-01.dc.html` missing), so only the title was checked. | Medium (new approved work) |
| IA-04 | MATCHES | Rest bar "Understand 1:1–18" (label "Understand the passage, …") and Listen (`[chapter].tsx:1032-1059`; `components/ActionBar.tsx:224-246`). The reader's back chip names the tab, "Bible" (`components/ReaderHeader.tsx:45, 83, 92`), per IA v4. | — |
| IA-06 | NOT BUILT | Search has no "Guides" group. A passage title does not find its guide. `app/search.tsx` groups Go to, People, Words, Verses and Also (`:190-316`); there is no pericope or `/guide` reference in the file. No doc defers it. | Medium |

## Top differences in my group

1. **Sheet section titles are still 13 pt grey labels** (`components/Sheet.tsx:303`, `design/type.ts:49`). The polish calls for 20 pt bold ink in sheets. Every guide and Understand sheet looks pre-polish. High.
2. **The guide offers rows with nothing behind them** (UL-04): Study notes, Key words and Check what you read are always listed (`lib/passageGuide.ts:106-117`) and can open empty pages. Medium.
3. **Search beside the tabs is missing** (BH-01, IA-15, build-7-plan §1): two native tabs only, with Search kept in the Bible header (`app/(tabs)/_layout.tsx:3-5`). Medium.
4. **Search does not find guides** (IA-06): no "Guides" group (`app/search.tsx`). Medium.
5. **Check what you read has no visible "Show the answer" control** (UW-02): answers appear on a row tap (`UnderstandPages.tsx:139-156`, `UnderstandViews.tsx:473-495`). Medium.
6. **"Read it alongside" in the guide is inert rows** (`PassageGuide.tsx:183-193`). In the verse sheet the same slot opens a peek. Medium.
7. **The Start here list shows no read count** (GD-01 "9 of 46 passages read"). The app shows the cover line "46 passages, in order" (`app/thread.tsx:63-72`). Medium.
8. **The sheet × is a grey circle, not white with a hairline ring** (polish; `components/Sheet.tsx:164`). Hear this passage and Sources sit 20 pt apart, not one 40 pt section gap (`PassageGuide.tsx:169, 206`). Low–medium.

## NOT BUILT in my group

- IA-06: the "Guides" result group in Search.
- GS-01, GS-02, GS-03: the Glyssen speaker line ("Speaking …"). Never deferred in writing; its host "Where we are" was removed by the no-AI decision.
- HM-01: Share handout in the guide's ⋯. Build 10, approved 18 Oct, not started; there is no ⋯ in the guide.
- Deferred by decision, not counted above: TL-01/02 and TH-01/02 (handoff-2026-10-12-build.md:41-42; build-7-plan.md:121), MC-01..03 (handoff-2026-10-12-build.md:44).
- Superseded rather than unbuilt: PG-02..PG-10, GD-02/03, IA-08 (AI guide structure, no-AI decision); ON-04 (Next moved to the reader); ON-05/07, IA-03, IA-14, DP-01 (BH-01); JN-07-v2.

---

# Design QA group 3: study notes, See also, people, places, maps, dictionary

Paths are relative to `apps/mobile/src/` unless they start with `docs/`. Frame pages: SN/TD = guide; PD/DI/DN/TY/MS = next; WM = b6; OR = b9 (build 10).
One context point applies to most rows. John, and every other book with an Understand bundle (about 54), takes the `FullView` path (`components/UnderstandViews.tsx:364`). The SN-03..06 / TD-01 layout (People, then Study notes inline, then See also, then Go further) renders only in `NoUnderstand` (`UnderstandViews.tsx:613`), which runs only for a book with no Understand file or a verse it has no entry for. So on the main path, readers see the older VS-02 full view instead of these frames.

## Study notes and See also (SN)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| SN-02 | MATCHES | `StudyLayer.tsx:266-311`: title "Study notes", subtitle "John 1:1", every paragraph, then the "On 1:1–18" muted 600 line (`.nov`), then `TYNDALE_LINE`, all as drawn. One gap: you reach this page from the Go deeper row only when the Understand bundle carries `deeper.study_note` (`UnderstandViews.tsx:523`). A Tyndale note the bundle did not copy cannot be reached on a John verse. | low |
| SN-03 | DIFFERS | Built only in `NoUnderstand` (`UnderstandViews.tsx:644-652`). Study notes inline (4-line clamp, "Read the whole note", short credit) and See also (3 rows, "Show all N", OpenBible credit) match (`StudyLayer.tsx:241-263, 477-502`). (1) The last group is "Go deeper" with Original and "Compare" (`UnderstandViews.tsx:626-652`); the frame's "Go further" has Original Greek, Compare translations and a **passage guide row** ("The Word became flesh / Passage guide · 1:1–18"). No passage-guide row exists anywhere in Understand (grep "Passage guide": none). The Go deeper/Compare naming follows the later VS/WM-07 frames; the missing guide row does not. (2) Header adds the passage subtitle (NA-02 decision, fine). (3) On John and every other bundled book this screen never appears (see context). | medium |
| SN-04 | MATCHES (NoUnderstand only) | `StudyLayer.tsx:136-142`, `lib/study.ts:538`: "Getting the study notes for John." after 1 s, nothing to tap. The Go deeper rows lack the passage-guide row, as in SN-03. | low |
| SN-05 | MATCHES (NoUnderstand only) | `StudyLayer.tsx:143-163`: line plus filled "Try again" capsule (`.tbtn2`: fill, 999 radius, 15/600, 44 pt), stacking at AX. The passage-guide row is missing, as in SN-03. | low |
| SN-06 | MATCHES (NoUnderstand only) | `StudyLayer.tsx:165-170`, `lib/study.ts:546`: "Study notes download when you’re online." The passage-guide row is missing, as in SN-03. | low |
| SN-07 | MATCHES (by code and the earlier QA; not re-run on device) | `StudyLayer.tsx:460-462`: `jumpTo({... to, from, select:true})` selects the whole range. Fixed per `docs/app-v1/qa/study-icloud/qa-report.md:41-46`. | — |
| SN-08 | DIFFERS | `UnderstandPages.tsx:237-257`: (1) **Unreachable on the main path.** Its only door is "Show all N" in `SeeAlsoSection`, which renders only in `NoUnderstand`. `GoDeeper` (`UnderstandViews.tsx:502-547`) has no See also row, and the `passagesLine` helper for that row is imported but unused (`StudyLayer.tsx:57`, `lib/study.ts:552`; dropped in 3cee5a2, build 6). OpenBible cross-references are therefore invisible on every John verse. refs_sn ("Go further, where Study notes and See also are rows") and notes UX-02 ("See also … Around this verse") want it there; the VS-02 fixed order omits it, so the frames disagree and John should decide. (2) Yada's own related passages with their "why" line (first 4 rows in the frame) never appear, because `mergeSeeAlso([], …)` always receives an empty first list (`UnderstandPages.tsx:242`, `UnderstandViews.tsx:622`). Their nearest equivalent is "Read it alongside" in the full view. | high |

## People and profiles (TD, TY)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| TD-01 | DIFFERS | (1) On John 3:1 (bundled book) people appear as "People and places" at the **end** of the full view, after Go deeper, Readers differ, Notice, Read it alongside and Explained (`UnderstandViews.tsx:440-444`). The frame puts the person row first, "above Study notes, since who someone is comes before what a note says" (refs_td). The People-first order exists only in `NoUnderstand` (`UnderstandViews.tsx:644-648`). VS-02 also puts People last, so the frames conflict. (2) In the full view, Study notes is a Go deeper row, not the inline excerpt, and See also is absent (see SN-08). (3) Section label is "People and places", not "People" (later b6 naming, fine). Row "Nicodemus / Who he was" matches (`StudyLayer.tsx:314-341`). | high |
| TD-02 | MATCHES (partly superseded by TY-02) | `StudyLayer.tsx:348-404`: name title, verse subtitle, all paragraphs, "Read about him" rows, then the credit. | — |
| TD-03 | MATCHES | `app/search.tsx:210-238`: "People" group first, then "Nicodemus / Who he was · Tyndale". Verses are labelled "Verses · N". A Words group sits between People and Verses (accepted in `docs/app-v1/qa/study-icloud/qa-report.md:55-58`). Profiles are found only in books whose study notes are downloaded (`data/study.ts:109-122`). | low |
| TY-01 | NOT BUILT | Profiles are read only from the verse's own book bundle (`data/study.ts:60-65` → `getProfiles(own db)`), and the pipeline writes each profile only into the book its anchor verse is in (`packages/pipeline/src/study.ts:388-393`, `bookOf(n.start)`). Peter (Matthew) never shows on John 1:42; Martha, Mary and Lazarus (Luke) never show on John 11:1. The frame's section is "Profiles" with the row line "Tyndale profile"; the app uses "People and places" with "Who he was". Listed as to-build in `docs/handoff-2026-10-12-build.md:29`. | high |
| TY-02 | NOT BUILT | `StudyLayer.tsx:368-396` shows every paragraph (no clamp and no "Read the whole profile"), then one flat "Read about him" list, one row per span from every book. The frame has two paragraphs plus "Read the whole profile", then "In John" with spans grouped per chapter ("John 1:40–42, 44"), then an "Elsewhere / 7 more books" row. | medium |

## People and places, manuscripts, places (PD, WM, MS)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| PD-01 | DIFFERS | No one-line "Lazarus · Bethany · Mary · Martha" (`.ppl`/`.ppn`, accent 600 names, 44 pt each, rows only at AX). The app always uses rows (`StudyLayer.tsx:314-341`) and lists only Tyndale profiles; places are not in this section (they appear as accent links in the verse, WM-07). The section sits at the end of the full view, not at the top (`UnderstandViews.tsx:440`). The frame's separate "Profiles" section and its "Person/Place" lines are not built. The TIPNR data gap is recorded in notes refs_pd. | medium |
| PD-02 | SUPERSEDED by WM-06 | Place page rebuilt per WM-06 (b6). | — |
| PD-03 | NOT BUILT | No term page from a People-and-places name and no Aquifer dictionary (not on disk, notes refs_pd "Gaps"). The nearest equivalent is the Translation Words `TermPage` reached via Key words (`UnderstandPages.tsx:80-122`), which has no "In John · 19 verses" row and no "94 verses in the Bible (BSB)" line. | medium |
| PD-04 | NOT BUILT | Search has no "Dictionary" group (`app/search.tsx:95-106` queries people, passages and words only). Recorded as "for John to decide" in `docs/redesign/qa-next-release.md:61`. | medium |
| PD-05 | NOT BUILT | The reader drops empty verses (`data/queries.ts:173` `AND text <> ''`), so John 5 goes 3 → 5 with no "4 · Not in the oldest manuscripts" line (`.msl`). There is no such copy anywhere (grep "oldest manuscripts": none in app). | high |
| PD-06 | NOT BUILT | No tappable missing-verse line, hence no sheet with the plain explanation and the KJV verse plus "KJV, 1769". `MissingVerseBody` (`UnderstandViews.tsx:202-234`) shows a "Manuscripts" section and the UST line, but only if a missing verse's sheet can be opened, and the reader gives no way to open one. | medium |
| WM-05 | DIFFERS (minor) | `PassageGuide.tsx:143-210`, `PlacesInPassage.tsx`: "Places in this passage" rows with "Identified with Al Eizariya" and "Settlement" match. The order adds Hear this passage (UL-02, later) and Readers differ / Read it alongside before Go deeper. Go deeper's "Study notes / Tyndale on 11:1–44" opens `understand/notes` with the range, but `notes.tsx:11` passes only `span.startOrd`, so the page shows notes for **11:1** with subtitle "John 11:1", not the passage. | medium |
| WM-06 | DIFFERS | `PlaceScreen.tsx`: map, then place line, "In John" rows, Open in Maps, credit; order and copy match. (1) Subtitle: frame shows the passage name ("Raising Lazarus") when opened from the guide; app shows `formatDisplayRef(from)` → "John 11:1" (`PlaceScreen.tsx:37,43`). (2) Verse rows: frame shows a one-line Literata muted excerpt ending "…" (`.note.muted.xt`); app shows the full verse in sans `RowNote` (`PlaceScreen.tsx:60`). (3) "Open in Maps" shows a visible "Needs a connection" line (`:70`); the frame keeps that only in the VoiceOver label. Map styling (sage sea, paper land, accent ring, other places dotted) matches `PlaceMap.tsx`. | low |
| WM-07 | MATCHES | `BsbPartner.tsx:62-77`: the place name in accent 600, which opens its map; shown in the verse at the top of the large view (`UnderstandViews.tsx:168-172`). The app prefixes the verse number at 12 pt; the frame has none. | low |
| MS-01 | SUPERSEDED by WM-06 | WM-06 (b6) is the built version (notes refs_wm "MS-01 (WM-05–07)"). MS-01's "Show on a larger map" and its region labels (Great Sea, Salt Sea, Jordan) are replaced by "Open in Maps" and the data's own place names (`PlaceMap.tsx:8`, rule 4). | — |

## Dictionary (DI, DN-01)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| DI-02 | DIFFERS | `UnderstandPages.tsx:80-122`: title, subtitle "Dictionary", definition and "In 1 Corinthians · 22 places" match. (1) No **Related** section (assembly, believe, Christian). (2) No "Show all 22": the app lists up to 50 rows inline (`:105`). (3) Row verse in ink `Scripture` clamped to 2 lines (`:110`); frame `.xt` is muted Literata, full. (4) Frame splits the definition (first paragraph `.expl`, the rest `.snote` claim size); the app sets one `explanation` block (`:102`). Recorded in `docs/redesign/qa-next-release.md:61` as for John. | medium |
| DI-03 | NOT BUILT | No "Dictionary" group above Verses in Search (`app/search.tsx`). | medium |
| DI-04 | NOT BUILT | No dictionary browse page (Key words · 190 / People and places · 355 / Other words · 408) and no entry from Search's empty state. Search before typing shows nothing (`app/search.tsx:186-348`). | medium |
| DN-01 | NOT BUILT | A term with no uses in the book shows only its definition. `TermPage` renders nothing when `uses.length === 0` (`UnderstandPages.tsx:103`), and there is no "Elsewhere in the Bible · N" with first verses and no Sources/Licences block. | low |

## Plans, data, downloads (DN-03..05)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| DN-03 | DIFFERS (partly superseded by MM-12) | `app/mcheyne.tsx:53-75`: "You’ve read all 365 readings." and "Start again from reading 1" match. The frame's ticked row for reading 365 above the line is absent. MM-12 adds the span, begun date and preface. | low |
| DN-04 | MATCHES | `app/settings.tsx:91-101`: "Remove your data?" / "The download stops, then … are removed from this iPhone and iCloud. This can’t be undone." / Cancel, Remove. The list adds "your rhythm" (later feature). | — |
| DN-05 | DIFFERS (minor) | `app/downloads.tsx:62-114`: Understand per book with size, plus the built-in line, as drawn. (1) Size sits as a subtitle under the name with a ⋯ menu (`:48`); the frame has a trailing value (`.valr`) and no menu. ST-02 may govern the menu. (2) "Readings" vs "Recorded readings" (computer voices, John 13 Oct). (3) Adds Translations, Study notes and "Remove all downloads". | low |

## Book orientation (OR)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| OR-02 | NOT BUILT | Build 10b: the book's places on a phone-drawn map in "About John". `BookIntro.tsx` has only the "About John" label, paragraph and credit; there is no places map. The frame file is missing from the export (`artifact-files/.../project/` has OR-01 only), so it could not be compared line by line. Approved 18 Oct 2026 (`build-10-plan.md` on claude/funny-brahmagupta-a36845, l.190, l.228). | medium (planned) |
| OR-04 | NOT BUILT | All places in order of first appearance, each with its verse, pushed inside the sheet: no such page (no book-wide places loader in `data/wordsAndPlaces.ts`, which has `loadVersePlaces`, `loadPlacesInRange` and `loadPlace` only). The frame file is missing from the export. Planned for 10b. | medium (planned) |

## Top differences in my group

1. **See also is invisible on every verse with an Understand entry (all of John).** Go deeper has no See also row and `passagesLine` is unused (`UnderstandViews.tsx:502-547`). SN-08's page is reachable only from the no-entry layout, and Yada's own related rows are never passed in (`mergeSeeAlso([], …)`). The frames conflict (refs_sn and UX-02 vs VS-02), so John should decide.
2. **People sit at the bottom of the full view** (`UnderstandViews.tsx:440`), not first as in TD-01 and PD-01. They are rows only, with no one-line people-and-places links.
3. **Cross-book profiles (TY-01) are not built.** Profiles come only from the verse's own book bundle, so Peter on John 1:42 and Martha, Mary and Lazarus on John 11:1 never appear.
4. **The missing-verse line (PD-05/06) is not built.** `text <> ''` drops John 5:4 and Acts 8:37 silently, with no "Not in the oldest manuscripts" line and no KJV note.
5. **SN-03..06's Go further lost its passage-guide row**, and the whole SN-03..06 layout appears only for books without an Understand bundle.
6. **The dictionary is half built.** DI-02 has no Related section and no Show all; DI-03, PD-04 (Search Dictionary group), DI-04 (browse), DN-01 (Elsewhere) and PD-03 (Aquifer term) are not built.
7. **TY-02's profile page** lacks the clamp, "Read the whole profile", the "In John" grouping and the "Elsewhere · N more books" row.
8. **The guide's "Study notes · Tyndale on 11:1–44" opens notes for 11:1 only** (`app/understand/notes.tsx:11`). Smaller WM-06 differences: subtitle, excerpt style, the visible "Needs a connection" line.

## NOT BUILT in my group

- TY-01 (profiles from other books' bundles), TY-02 (In John / Elsewhere profile layout)
- PD-03 (term from a People-and-places name, Aquifer), PD-04 and DI-03 (Dictionary group in Search), DI-04 (browse the dictionary)
- PD-05, PD-06 (missing-verse line in the reader and its KJV note)
- DN-01 ("Elsewhere in the Bible · N")
- OR-02, OR-04 (build 10b book orientation: places map, all places list; frame files missing from the export)
- Pieces within built frames: the SN-01/SN-03 See also and passage-guide rows in Go further/Go deeper; DI-02's Related section; PD-01's one-line links and Profiles section.

---

# QA group 4: original words, the word card, evidence, grammar terms, book introductions

App root: `apps/mobile/src` (paths below are relative to it). Frames read from `qau/frames/*.txt` and the CSS in
`artifact-files/.../project/*.dc.html`. Canvas page order used: v2 → next → b6 → b9.

Note on the frame files: OR-03, OR-05 and OR-06 are listed in `canvas.json` (page b9) but have no `.dc.html` or `.txt`
in the local extract. I judged them from their canvas titles and `docs/build-10-plan.md` on
`claude/funny-brahmagupta-a36845`.

Note on the polish: the v2 frames (D-, JN-, J01-, GN-, DP-, S-) carry the 15 Oct "System polish" CSS block. The b6
frames (WM, IG) and next frames (MM, TY) do not. The polish block sets `.sheet .sec > .lbl{font-size:20px}` with 700
weight in ink, `.sh-x,.sh-back{background:var(--paper);box-shadow:0 0 0 1px var(--div)}`, `.lrow{min-height:56px}` and
`.light .lmain{font-size:17px}`. `polish-2026-10-15.md` lines 14–16 say the same. Where the app misses these rules, I
report it against the polished frames.

## Systemic (applies to every sheet in this group)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| all sheet frames (JN-05-v2, J01-07/08-v2, GN-04/05-v2, DP-06-v2, IG-03–05, WM-02–04) | DIFFERS | `components/Sheet.tsx:303` `Section` renders its title with `Label`, which is 13 pt, semibold, muted (`design/type.ts:49`). The polish and the polished v2 frames want sheet section titles at 20 pt, bold, in ink (`.sheet .sec > .lbl`). Affected titles on the word card: "Form", "Dictionary form", "Parts" and "In the BSB". `SectionTitle` (`components/Type.tsx:221`, 22 pt) exists, but only Today and Rhythm use it, and the app has no 20 pt sheet variant. | high |
| all sheet frames | DIFFERS | `components/Sheet.tsx:164`: the round ‹ and × buttons sit on a `palette.fill` grey disc with no ring. The polish wants white circles with a 1 px hairline ring (`.sh-x,.sh-back{background:var(--paper);box-shadow:0 0 0 1px var(--div)}`). | medium |
| rows (IG-03/04/05 grammar rows, S-04 book rows) | DIFFERS | Rows have `minHeight: 52` and a 1 px divider (`components/GrammarTerms.tsx:46`, `components/Page.tsx:289,307`). The polish wants 56 pt rows with a 0.5 px hairline (`.lrow{min-height:56px;padding:15px 0}`, `.lrow + .lrow{box-shadow:0 -0.5px 0}`). | low |
| all sheets | DIFFERS | `app/_layout.tsx:262` sets `sheetCornerRadius: 38`. The polish wants a 36 pt top radius. Muted ink is `#686B69` in `design/palette.ts:53`; the polish wants `#6B6E6C`. | low |

## Delight and reading (D-01–D-05)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| D-01-v2 Word lifts into its card | DIFFERS | The frame and its motion note (notes.txt:38) have the tapped word lift and travel into the card's headword, a shared transition of about 0.35 s. The app plays only a light haptic and a 0.96 press scale (`components/OriginalWords.tsx:120–132`). The code comment gives the reason: "the matched flight … cannot cross two native sheets". No doc records the flight as deferred; `docs/redesign/build-plan.md:92` still lists it. | medium |
| D-02-v2 Hebrew arrives right to left | MATCHES | Glosses arrive in reading order, 40 ms stagger, 160 ms fade with a 5 pt rise (`components/OriginalWords.tsx:72`). Hebrew runs row-reverse, so index 0 is at the right. Reduce Motion is respected. | — |
| D-03-v2 Same first words | MATCHES | Peek shows "Same first words" with the two openings paired, then the passage (`app/evidence/peek.tsx:41,68`). | — |
| D-04-v2 Chapter opening | MATCHES / partly SUPERSEDED | The drop numeral on verse 1 is built (`components/Verse.tsx:311–372`). D-04 draws no passage title above verse 1; the later IG-01, SC-01 and OR-01 all draw it, and the app shows it. | — |
| D-05-v2 Header steps back | MATCHES | One muted line, "1 Corinthians 14 · BSB", tap to restore (`components/ReaderHeader.tsx:193–203`). | — |

## Word card and evidence (JN-05, J01-07/08, GN-04/05, DP-06, S-04, MM-03/04, WM-01–04)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| JN-05-v2 Word: λόγος | DIFFERS (mostly superseded) | 1. The frame's "In this verse" section (the entry's own word note) is not built; `app/evidence/word.tsx` has no such section, although its header comment (line 7) still names it. The newer b6 word-card frames (IG-03–05, WM-02–04) also omit it, so treat it as superseded. 2. The frame has "330 in the Bible" as a muted note; the app has a tappable row (`word.tsx:177`), which follows the newer IG-03. 3. Section titles are 13 pt grey, not 20 pt bold (systemic). | low |
| J01-07-v2 Word: σιγάτωσαν | DIFFERS (as JN-05) | No "In this verse" (superseded by IG-03). Sheet section titles as in the systemic row. | low |
| DP-06-v2 Hebrew headword at cover scale | MATCHES | The headword is 60 pt, 1.5× the token, at default size (`word.tsx:88`). The Parts rows are built (`word.tsx:115–148`). "Preposition + common noun" against "Preposition with noun" is a morph-data nit already logged in `docs/app-v1/qa/study-icloud/qa-report.md:80`. | — |
| GN-04-v2 Word: בְּרֵאשִׁית with parts | MATCHES (plus the systemic differences) | Parts rows give the gloss · role with the Hebrew at the trailing edge, as the frame's `.mrow` does. "In this verse" is absent, as for JN-05. | low |
| J01-08-v2 Occurrences: σιγάω in 1 Corinthians | DIFFERS | The frame bolds the English partner in each verse (`.otext b{font-weight:600}`: "should **remain silent**"). The app sets the verse plain (`app/evidence/occurrences.tsx:140`). Its comment (lines 8–10) says no word alignment exists, but MM-03 now ships BSB word links (`lib/wordsAndPlaces.ts` `partnerIn`, `data/wordsAndPlaces.ts` `loadWordLinks`), so the stated reason no longer holds under the BSB. Ref, Here and Form lines, the wash and the bar all match. | medium |
| GN-05-v2 Occurrences: רֵאשִׁית in Genesis | DIFFERS | Same as J01-08: the frame bolds "**beginning**", "**began**"; the app sets the verse plain (`occurrences.tsx:140`). | medium |
| S-04-v2 λόγος in the Bible | DIFFERS | 1. The frame puts "330 times in 318 verses" in the header as the subtitle (`.ssub`). The app puts it as a muted body line above the list (`app/evidence/in-bible.tsx:42–44`) and uses the verse reference as the subtitle (`:33`). 2. The frame has no footer (‹ "Back to search" plus ×). The app's `SheetScreen` defaults to `footer = true` and adds a "Back to reading" or "Back to search" capsule. 3. The frame's book rows are plain `.lrow` (SF 17 after the polish); the app sets them in Literata 20 (`components/Page.tsx` `ListRow book`). The polish keeps serif for book names, so this one is arguable. | low |
| MM-03 First Greek word tapped | SUPERSEDED by WM-01 | Decision 20 (`docs/build-6-decisions.md:76`) and notes.txt:841: only "Word" is underlined, not "the Word". | — |
| MM-04 A word's footprints | DIFFERS | 1. The frame lists uses as compact reference rows (`.lrow` with the ref, plus a muted "Here" second line) in a medium sheet. The app keeps J01-08's full-verse rows with a Form line and the selection wash (`occurrences.tsx:104–152`). 2. The frame has only × ("Close, back to reading"), with no ‹ and no footer. The app shows ‹ "Back to Understand" and the "Back to reading" footer. 3. The frame ticks only the other uses (14:28, 14:30), and 14:34 keeps its bar. The app ticks every use in the chapter, including the verse it came from (`occurrences.tsx:56–57` does not filter out `fromRef.verse`). 4. For VoiceOver the frame says "Also in this chapter: verses 28 and 30." once; the app adds "uses this word" to each ticked verse (`components/Verse.tsx:219`). The subtitle "3 times, all in chapter 14" matches (`occurrences.tsx:66–73`). | low |
| WM-01 λόγος tapped: "Word" takes the evidence underline | MATCHES | Verse-top marks, the dotted accent underline and the 0.5 s hairline (once per phone, never under Reduce Motion) are built (`components/BsbPartner.tsx:46–110`, `components/UnderstandViews.tsx:135,168–174`). The "Original Greek" row reads "17 words, each with its English" (`lib/goFurther.ts:9`). Small difference: the app prefixes the repeated verse with a 12 pt verse number (`UnderstandViews.tsx:170`); the frame's sheet verse has none. | low |
| WM-02 The word card: In the BSB | DIFFERS (chrome only) | The "In the BSB" section between the translit line and Form, with the partner underlined, is built (`word.tsx:100`, `BsbPartner.tsx:116–139`). Chrome differences: 1. The frame has ‹ plus × labelled "Close, back to reading", and no footer. The app adds the "Back to reading" footer (`word.tsx:61–71`, footer defaults to true) and labels × "Back to Understand" (`word.tsx:67`). The IG-03/04 frames on the same b6 page do draw the footer, so the canvas contradicts itself. 2. Section titles as in the systemic row. | low |
| WM-03 Genesis 1:1, בָּרָא | DIFFERS (frame ambiguous) | The frame's card has no "In the BSB" section, yet its title says the partner "created" is underlined. The app shows "In the BSB" for a Hebrew word whenever a link exists (`BsbPartner.tsx:116`), which follows notes.txt:843. The Hebrew translit is right-aligned in both. John should confirm which is meant. | low |
| WM-04 Untranslated word (τὸν) or WEB | MATCHES | `InTheBsb` returns null when the reader is not on the BSB or the word has no partner (`BsbPartner.tsx:118–122`, `word.tsx:41`). | — |

## Grammar terms (IG-03–05)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| IG-03 Under Form, each term a row | MATCHES (plus the systemic differences) | Rows sit under the Form line with `marginTop: 8`, are labelled "Present, what it means" and use `aria-expanded` (`components/GrammarTerms.tsx:34–55`). Row height is 52; the polish asks for 56. The rows keep the 13 pt grey "Form" title (systemic). | low |
| IG-04 A term opened | MATCHES | One sentence in claim size, then the credit as a muted note 6 pt below, `paddingBottom: 14` (`GrammarTerms.tsx:56–62`), as in `.gdef`. | — |
| IG-05 Hebrew perfect | MATCHES | Separate `hebrew:` keys through `grammarKey` (`GrammarTerms.tsx:28–31`). The frame's "11 times in Genesis" and "53 in the Bible" rows are built (`word.tsx:167–184`). | — |

## Book introductions (TY-03/04, IG-01/02, SC-01/05/06, OR-01/03/05/06)

| Frame | Status | Differences (file:line — frame vs app) | Severity |
|---|---|---|---|
| TY-03 One line, "About the Gospel of John", above the first passage | SUPERSEDED | Build 6 item G replaced it with the tN paragraph (IG-01; notes.txt:316). The b9 decision then moved the introduction into a handle and a sheet (SC-01/05). `intro_summary` (Purpose, Author, Date, Setting) is still unread by the app. | — |
| TY-04 About the Gospel of John: Purpose, Author, Date, Setting | SUPERSEDED / NOT BUILT | Superseded by IG-01, then SC-05 and OR-01. No screen exists (grep for `intro_summary` or "About the book" finds nothing in `apps/mobile/src`). | — |
| IG-01 One paragraph above the first passage | MATCHES as built, but SUPERSEDED by SC-01 | `components/BookIntro.tsx:24–31`: an "About John" label, the paragraph in muted claim size and the credit, with margins 2/26 as in the frame, inserted at `app/read/[book]/[chapter].tsx:824`. Build-10 plan (funny-brahmagupta, §10d): "The large 'John' opener and the paragraph above the verses were too much. Chosen (John, 17 Oct): … nothing ever above the verses." SC-01 was approved 18 Oct ("Design approved", build-10-plan). The app still puts the paragraph above the verses wherever a book's intro is `approved` (`lib/bookIntro.ts:23`). | medium |
| IG-02 Genesis has no intro | MATCHES | `BookIntro` returns null (`BookIntro.tsx:21`). | — |
| SC-01 Opening John: nothing above the verses; an "About John" handle at the bottom edge | NOT BUILT | No `.peek` handle or "About John" button over the home indicator; the intro sits above the verses instead (see IG-01). This is phase 10d ("design sign-off", build-10-plan table). | medium |
| SC-05 Drag the handle up: the paragraph in a sheet | NOT BUILT | No "About John" sheet: no route under `app/understand` or `app/read`; `app/understand/about.tsx` is About this psalm (JR-03). The short credit "unfoldingWord · CC BY-SA 4.0" is also gated: the full credit must reach Sources first (build-10-plan, rule 3). | medium |
| SC-06 Arriving from Matthew: one pause, "Start Mark 1" | NOT BUILT | No between-books pause. `components/ChapterClose.tsx` (RT-03/RT-04) offers the next book as a card; nothing shows the next book's name in 44 pt Literata (`.scn`) with its paragraph and a "Start Mark 1" button. | medium |
| OR-01 About John pulled up: paragraph, then the shape | NOT BUILT | No "The shape" list (first six sections with ranges) and no "All 46 sections" row opening Contents. This is phase 10b. | medium |
| OR-03 Who: the seven Tyndale profiles; the BibleProject card | NOT BUILT; the video card is held by decision | No "Who" section in a book introduction. The video card "Ships only on BibleProject's written yes" (build-10-plan, decisions of 18 Oct). There is no frame file locally. | low |
| OR-05 A book with no places or profiles (1 John) | NOT BUILT | Depends on OR-01–04. No frame file locally. | low |
| OR-06 The video card offline | NOT BUILT; held as for OR-03 | No frame file locally. | low |

## Top differences in my group

1. Sheet section titles ("Form", "Dictionary form", "Parts", "In the BSB") are 13 pt grey labels, not the polish's
   20 pt bold ink (`components/Sheet.tsx:303` → `Label`, `design/type.ts:49`). This affects every evidence sheet.
2. The book introduction still sits above John 1's verses (`components/BookIntro.tsx`, `[chapter].tsx:824`). John's
   17–18 Oct decision (SC-01) says nothing goes above the verses; it belongs in an "About John" handle and sheet.
3. Sheet ‹ and × are grey `fill` discs, not white circles with a hairline ring (`components/Sheet.tsx:164`).
4. Occurrences (J01-08, GN-05) do not bold the English partner. The code says no alignment exists, but MM-03's BSB word
   links now do (`app/evidence/occurrences.tsx:8–10,140`).
5. D-01's word lift into the headword is replaced by a haptic only (`components/OriginalWords.tsx:120`), and no doc
   records the flight as deferred.
6. MM-04 footprints: the from-verse is ticked as well as the other uses (`occurrences.tsx:56`), the rows are full verses
   rather than reference rows, and VoiceOver reads per verse instead of one summary.
7. S-04: the count sits in the body, not as the header subtitle, and the footer capsule appears where the frame has none
   (`app/evidence/in-bible.tsx:33,42`).
8. The word card's exits: the app has a "Back to reading" footer and labels × "Back to Understand"
   (`app/evidence/word.tsx:61–71`). WM-02–04 have no footer and label × "Close, back to reading", while IG-03–05 do have
   the footer, so the canvas disagrees with itself and John should pick one.

## NOT BUILT in my group

- SC-01: the "About John" handle at the bottom edge (10d).
- SC-05: the About sheet with its one-line source (10d).
- SC-06: the pause between books with "Start Mark 1" (10d).
- OR-01: the shape of the book, with "All 46 sections" (10b).
- OR-03: Who (Tyndale profiles) and the BibleProject card. The card is held for BibleProject's written yes.
- OR-05: the no-places, no-profiles case (10b).
- OR-06: the video card offline (held as for OR-03).
- TY-04's Purpose/Author/Date/Setting summary was never built and is superseded.
- "In this verse" on the word card (JN-05, J01-07, GN-04, DP-06 v2) was never built; the newer b6 word-card frames
  omit it.
