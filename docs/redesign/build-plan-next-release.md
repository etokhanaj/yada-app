# Next-release build plan: the canvas and the no-AI data, into `apps/mobile`

> **Scope:** John later chose the full plan below (Phases 0–8). This note is kept for history. It said: build only the no-AI Understand and guides (all 66 books), swipe, the three Tyndale
> items and the study-bundle merge. The rest moves to the build after. Start from `docs/handoff-2026-10-12-build.md`,
> which says which rows below are in.

Written 12 Oct 2026, at the end of the design and data session on branch `next-release` (102 local commits, none
pushed). This plan gathers everything that session decided and drew, so a build session can work from one page.

**Sources of truth, in order:**
1. John's decisions, recorded in `docs/no-ai-understand.md` and this plan.
2. The canvas's **Next release · new flows** page (https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc), plus IA v3
   (IA-11–14).
3. The guide page's frames, where the next page doesn't supersede them.
4. `brief.md` §8.

Older frames that the next page supersedes are listed in §8; don't build from them.

**Reference images:**
```
YADA_ROOT=/Users/johnetokhana/yada python3 .claude/skills/design/scripts/render_frames.py <out> [GROUPS=…] [ONLY=…]
```
This renders any frame to a PNG (Light, Dark and AX5 side by side), so it can be compared with the simulator.

**Every phase ends:**
- with `pnpm -r typecheck` and `pnpm -r test` both green (check `$?` directly, never through a pipe);
- with its Maestro flow updated;
- with simulator screenshots in Light, Dark and AX5 set beside the rendered frames named in its table;
- with a commit per phase.

Ask John before any `git push` or `gh pr create`. Before either, run `/deslop`, `/review-code` and
`/security-check`, as CLAUDE.md requires.

---

## What is already built (data and pipeline): use it, don't rebuild it

| Piece | Where | State |
|---|---|---|
| No-AI verse layer (`assemble.py` → TypeScript) | `packages/pipeline/src/understand/verse.ts` | Ported and identical to the prototype on every checked verse. Golden tests pass. |
| Passage summaries, modes by kind of writing | `src/understand/passage.ts`, `modes.ts`, `summaries.ts` | Ported. 18 books, all under the 15% stop. |
| Bundle writer | `yada understand BOOK` (`npx tsx src/cli.ts understand JHN`) | Writes `content/bundles/understand-<book>.vN.db` (tables meta, sources, verses, passages). |
| Debates | `packages/pipeline/prototypes/data/debates.json` | **John's review is complete:** 43 approved, 49 rejected, 0 drafts. All 18 "positions" passages show. MIC 5:2 is held. `relation: "together"` on PSA 2:7, ISA 14, JER 31 and JAS 2. |
| Approved data files | `prototypes/data/prophets.json`, `plain_words.json`, `letters.json`, `kinds.json` | All status "approved". |
| JPS 1917 | `translation-jps.v1.db` (built locally), `hebrew-numbering.ts` | Public domain, UK confirmed. **Held from the manifest** until the app handles Old-Testament-only texts (`OT_ONLY_TEXTS_READY = false` in `apps/mobile/src/lib/sources.ts`). |
| Sources record | `sources.manifest.json`, `apps/mobile/src/lib/sources.ts` | Complete: unfoldingWord, the Berean tables, MACULA, Glyssen, JPS, K&D, Ellicott, Driver and Neubauer, Clarke. |
| Review queue | `packages/review` (`#/debates`) | Done; John used it. |
| Study bundles merge | `manifest-merge-plan.md` (in the private repo) | A plan; not yet merged into `content/bundles/manifest.json`. |

---

## Phase 0 · Read the no-AI bundle (the main build step)

The app still renders the old AI entries. Replace that source with `understand-<book>.vN.db`.

| Change | Where | Canvas |
|---|---|---|
| Package `understand-*` bundles for the rolled-out books; add them to the manifest with sizes. Ship John's bundle in the app, the way study notes do. | pipeline `package`, `content/bundles/manifest.json` | ST-02, DN-05 |
| Data layer: a verse row (`beginner`: order, voice, plain + label, translators, readers_differ, readers_lead, readers_half, readers_more, manuscripts, debate.kind; facts; alongside; deeper; where) and a passage row (headline + kind, sentences with credits, speakers, facts, psalm lead and about, setting, flags) | `src/data/understand.ts` (new) | — |
| Remove the AI entry path from Understand, along with "Unreviewed" and the golden AI entries. They stay as test fixtures only. | `UnderstandViews.tsx` | — |
| A book not yet rolled out keeps study notes (SN-03) and GD-04 | — | SN-03, GD-04 |

## Phase 1 · The verse sheet (tapping a verse)

| Change | Canvas |
|---|---|
| **One sheet, half and full views.** Header "John 3:16 · Understand". The last height chosen is remembered. Settings has "Open Understand in full". | VS-01, VS-02 |
| **Half view:** the plain line at reading size (the only large text); at most one Notice fact that carries its own comparison; Readers differ with count and first reading; "More on this verse". If the plain line runs past 30 words, it stands alone. | VS-01, VS-03, VS-05 |
| **Disputed verses (`debate` set):** Readers differ first, then "One way to read it" at body size, then the manuscripts fact. An undecided "positions" or "held" verse shows neither. "data" entries show the JPS verse (OT) or the manuscripts fact. | VS-03–06, NA-01–08 |
| **Approved positions** are source sentences, unchanged, credited to their source (never John). The half view shows the first `readers_half` (3) with the full count in the lead-in; the remainder line reads "2 more in the full view". The full view shows all of them. | NA-02, VS-04 |
| **Lead-in:** "Readers differ", or "Readers explain this in more than one way" when the relation is "together". The slot keeps its name. | VS-03 |
| **Voice line** above the plain line ("Bildad the Shuhite says:", "In John’s vision:", "The Teacher says:", "Paul tells them:"), only when the data says so | NA-07, NA-08 |
| **Added words:** italic and grey. A tap says "Added to make the meaning clear. Not in the Greek." VoiceOver says "added for clarity" once per line. | VS-02 |
| **Full view:** the first view, then Go deeper rows in a fixed order (Original with MACULA marks · Compare · Study notes · Key words · Manuscripts · Sources), then every reading, every fact, Read it alongside, People | VS-02, VS-04, VS-06 |
| **One Sources row** at the bottom that opens credits, licences and changes. No credit under each line. | NA-01–08, JR-03 |
| **AX5:** opens large and repeats the verse at the top in reading size | VS-07 |
| **Key words / dictionary** (Translation Words) | DI-01–04, DN-01, DN-06 |
| **Rule 9:** no Understand text from NKJV, NLT, MSG or JPS. They appear only in Compare. | — |

## Phase 2 · The passage guide, no AI

| Change | Canvas |
|---|---|
| **Same slots for every genre:** In short → Readers differ → Read it alongside → More → Sources | JR-04–07, NA-04 |
| **In short** = headline (What happens / Part of) + gated summary. Tyndale moves to More › Study notes. A flagged summary is held back; facts and verses stay. | NA-04, EG-01 |
| **Psalms:** at most two lines before the psalm (Written when → the turn or picture → What kind), the rest behind "About this psalm". A one-time tip on Psalm 27:1, with John's approved wording. | JR-01–03 |
| **Prophets:** plain section names and one setting line (prophets.json, approved) | JR-04, JR-05 |
| **Letters:** "Part of", writer and readers framing (letters.json) | — |
| **Ranges:** Understand on a range opens the guide with your verses first | UX-06, UX-07, UX-09 |
| **A verse's section** is the guide passage that contains it (option A) | — |

## Phase 3 · Reader and translations

| Change | Canvas |
|---|---|
| **Swipe between chapters** (a third commits; springs back otherwise; End page) | SW-01–04 |
| **Passage boundary** after a passage's last verse: hairline plus a "Next" opener. This defines "passage finished" for Home, plans, the reminder ask and progress. | MM-01 |
| **Compare, redesigned** (yours plus up to 3; "Translations" picker inside Compare) | CP-01–09 |
| **Licensed versions** (NKJV, NLT, MSG through the proxy): notice under the text, share with copyright, offline sentence, a load that fails | LT-01–05, US-07 |
| **Search follows the translation** (a proxy search route is needed); offline searches the BSB, said once | EG-06, EG-07 |
| **Bookmarks and Recent on a licensed version** show BSB excerpts, labelled | US-11 |
| **JPS in Compare** for OT books, once `OT_ONLY_TEXTS_READY` ships (manifest `testament`) | — |

## Phase 4 · Audio

| Change | Canvas |
|---|---|
| **Recorded BSB:** voice sheet, download per book, sizes from the manifest | BA-01–08 |
| **AX5 player:** one-line title (two at most), voice kept, short offline line, clean fade, "Verse 5 of 51" as one phrase, Guide as a pill | BA-01, BA-05, BA-06 |
| **Audio under a licensed page:** "Audio is the BSB" plus "Read along in the BSB" | EG-03 |
| **Voice help** in the player menu as row subtitles. The under-title line is for the first listen only (AU-07). | US-01, AU-07 |
| **No-passage player** ("Mark 1" / "BSB"); paused across a chapter end ("John 2 · Verse 1"); end of book ("End of John", Next off) | US-02–04 |
| **WEB and KJV human audio** where licensed | WA-01, WA-02 |
| **Computer voices (John, 12 Oct 2026):** Kokoro-82M (Apache-2.0) "Heart" (af_heart) and "George" (bm_george) beside Barry Hays. Made on the Mac verse by verse from core's BSB (`yada audio JHN --narrator=heart`), 0.45 s between verses and 0.9 s at a passage start, AAC 48 kbps, word times by the same whisper.cpp alignment and printing check. Nothing runs on the phone. The generator refuses any text but the BSB, WEB, KJV and LSV (rule 9, tested). Voice sheet: "Heart" and "George", each with "Computer voice" under its name; the player's line names one as "Heart, computer voice". **13 Oct 2026, John: keep these two and remove the rest.** Barry Hays and the iPhone voice are no longer offered, nor Personal Voice or the clearer-voice lines; the speed menu is speeds only. The system voice still reads, unasked, where there is no reading (WEB, KJV and the other texts; a chapter not downloaded, offline). John first; the whole BSB overnight (about 14 h and 1.7 GB per voice) once John has heard it. | BA-01, BA-03 (rows differ from the frame: see QA) |

## Phase 5 · Home, Settings, plans, notifications, system surfaces

| Change | Canvas |
|---|---|
| **IA v3:** one root; Home with one "Your plan" line; ⋯ → Recent · Reading plans · Settings | IA-11–14 |
| **Settings:** eight choices with values; Downloads; Remove my data; Sources and licences | ST-01–05, DN-04, DN-05 |
| **Reading plans** with no dates (John, M'Cheyne), last reading | RP-01–04, DN-03 |
| **Notifications:** one reminder, asked once after a passage is finished | NT-01–11 |
| **Widgets and Live Activity;** Siri, Spotlight and App Shortcuts (BSB only) | WL-01–04, MS-01–05 |

## Phase 6 · States nobody drew before (from the code audit)

| State | Code | Canvas |
|---|---|---|
| Translation download failed / no room | `translations.tsx:200` | US-05, US-06 |
| Understand couldn't open | `UnderstandViews.tsx:187` | US-08 |
| Chapter couldn't open | `[chapter].tsx:121` | US-09 |
| Launch failure (no exception text) | `_layout.tsx:137` | US-10 |
| Copy and bookmark spoken to VoiceOver ("Copied", "Bookmarked") | `[chapter].tsx:419, 435` | — |
| A slow licensed load becomes US-07 after about 8 s; no skeleton | `[chapter].tsx:476` | US-07 |

**Haptics** (review §4):
- **Fix:**
  - the detent tick fires on a large open (`Sheet.tsx:111-115`); it should tick only after the reader drags;
  - the AX3+ word layout has no tick (`OriginalWords.tsx:81`).
- **Add:**
  - a light impact at the swipe's commit point;
  - success when a download the reader started finishes on the open sheet;
  - a warning only right after the reader's own failed action.
- **Leave out:** play and pause, auto-advance, passage finished.

## Phase 7 · Magic moments

Each one has a Reduce Motion form and a VoiceOver form; see the canvas note "Magic moments".

| Moment | Canvas | Size |
|---|---|---|
| Passage boundary (with Phase 3) | MM-01 | medium |
| Same first words (John 1:1 / Genesis 1:1, BSB) | MM-02 | medium |
| First tapped Greek or Hebrew word → its BSB partner underlined | MM-03 | medium |
| A word's footprints in the chapter | MM-04 | medium–large |
| Back after a gap: "Where you stopped" | MM-05 | small |
| A verse kept before: "Kept" + date | MM-06 | small |
| The next chapter's name in the swipe | MM-07 | small |
| End of a book: its last verse as a quotation | MM-08 | small |
| Audio catches up: "Following again" | MM-09 | medium |
| Translations agree (one block) | MM-10 | medium |
| LORD in small capitals, the first time | MM-11 | small |
| A plan's last reading | MM-12 | small |

## Phase 8 · QA against the mockups (last)

1. Render every frame named in Phases 0–7 with `render_frames.py`.
2. Capture the same state on the iPhone 17 Pro simulator, in Light, Dark and AX5. Use Maestro flows to reach each state.
3. Put each pair side by side and check:
   - **layout:** clipping, overlap, anything under the home indicator or Dynamic Island, wrapping;
   - **Yada's design rules (CLAUDE.md):** no cards, coloured labels, AI visual language or "coming later"; every word earns its place;
   - **accessibility:** 44 pt targets, contrast in both themes, VoiceOver order and labels, AX5 layouts, Reduce Motion;
   - **copy:** word for word against the frame.
4. List every difference, as frame ID · theme · difference · fix. Fix the ones that are the build's fault. Report any place where the frame itself is wrong, rather than changing the design silently.
5. Write the report to `docs/redesign/qa-next-release.md`.

---

## Decisions still open for John (don't build around them; ask)

**Settled by John (12 Oct, in the build session):**
1. Repeated lines (Psalm 51, Isaiah 40): hide a line where the text it repeats is already on screen.
2. Verse-sheet header: plain names ("John 3:16", no "· Understand"). The codes (UST, tN) appear only in Sources.
3. Names: "In plain words" for the UST; "Key words" for Greek and Hebrew words only; "Passage guide"; "More on this
   verse" for the lower half of Understand.

**Decided (12 Oct, after the build session's three):**
4. **Audio on a licensed page (John):** Listen plays the BSB, the human recording where the printing check (§D of
   `docs/plan-additions-2026-10-12.md`) passes for that chapter. Otherwise it plays the Apple-voice BSB, as today.
   EG-03's "Audio is the BSB" copy covers both. The licensed text itself is never spoken (`canSpeak`, rule 9; the
   NLT read-aloud request to Tyndale is still unanswered), so LT-02's "no Listen" is dropped.
5. **Search on licensed versions (John):** yes. Add a search route to the licensed proxy (API.Bible search). Results
   are display-only, never stored or cached past the 30-day rule, and never in the pipeline or AI. Offline, search
   falls back to the BSB and says so once (EG-06, EG-07).
6. **Study bundles in the download list:** done. `yada manifest` merges the study fragment, leaving out John, which
   ships (448ee8c). Publishing to R2 stays John's step.
7. **Placeholders:**
   - **The LORD line (MM-11):** a sentence from a translation's own preface, unchanged and credited. Take it from
     the BSB preface (CC0) if it explains LORD in small capitals, otherwise the WEB preface (public domain). It is
     entered as a draft for John to approve. John is never the writer or the source.
   - **The M'Cheyne sentence (MM-12):** one sentence from M'Cheyne's own 1842 preface to the Calendar (public
     domain), unchanged and credited, read from a pinned copy, as a draft for John.
   - **Dates:** the reader's own data: a bookmark's creation time, a plan's start. Format "12 Oct" in the current
     year, otherwise "12 Oct 2025". Never relative ("3 days ago").
   - **Narrator names and sizes:** the names the CC0 page credits (Bob Souer, Jordan Scott Gilbert, Barry Hays; not
     "David"). Sizes come from the encoded files in the manifest, never from the zip listings. The default voice is
     the narrator the printing check picks.

Items 1–3 below are settled by 1–3 above, items 4–7 by 4–7 above. Nothing below is still open.

1. Psalm 51's "Written when…" repeats the superscription right below it. Isaiah 40's section name and setting line repeat each other (JR-01, JR-02, JR-04). Proposed: show the line only where the repeated text isn't on screen.
2. The verse sheet's header ("· Understand") and its source codes in headings ("UST", "tN"). Proposed: plain names in the headings, codes in Sources.
3. One name each for:
   - UST / Simplified Text / Plain English;
   - "Key words" (English terms versus Greek words);
   - the passage guide;
   - the lower half of Understand.
4. Licensed versions and audio: LT-02 (no Listen) versus EG-03 (the BSB plays under the page). Pick one.
5. A search route on the licensed proxy (API.Bible search; display only, never stored).
6. Merging the study bundles into the manifest (`manifest-merge-plan.md`).
7. Placeholders that need data:
   - bookmark and plan dates;
   - the M'Cheyne preface sentence (MM-12);
   - the LORD small-capitals line (MM-11, needs John's wording);
   - narrator names and download sizes from the Berean audio manifest.

## Superseded frames: don't build from these

Use the current frames instead:

| Superseded | Current |
|---|---|
| JN-01 first launch | ON-01 / IA-14 |
| UX-01 and PG-04 "What's happening" (AI) | VS and NA |
| PG-03, ON-04, NT-01: guide with full passage text and Next at the end | NA-04 / JR-05, with MM-01 for Next |
| ON-07, ST-05 and NT-09 "All passages in John" | IA-14 "Your plan" (now redrawn in those frames) |
| NT-11 Reminder under ⋯ | ST-01 |
| The brief's action bar with Original | IA-05 |
| The v2 page's U-01–04 and J01 Understand screens | VS and NA |

**Supporting documents:**
- `docs/no-ai-understand.md` (decision record);
- `docs/redesign/review-2026-10-12.md` (slop, wireframe, states, haptics, magic moments);
- `debate-positions.md` (in the private repo);
- `docs/licences/jps-1917-licence.md`;
- `manifest-merge-plan.md` (in the private repo);
- `docs/redesign/five-reader-test.md` (tasks 6–7 added).
