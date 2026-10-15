# Handoff, 12 Oct 2026 (evening): the next build

This page is where to start. It narrows the scope in `docs/handoff-2026-10-12.md`, whose other sections still hold. CLAUDE.md's rules have not changed.

**Branch:** work from local `next-release`. It is not pushed and is checked out in `.claude/worktrees/next-release`, so branch from it, for example `git checkout -b build-next-release next-release`, in your own worktree.

**Content:** the content is gitignored and lives at `/Users/johnetokhana/yada/content/{raw,bundles}`. Point your worktree at it.

**Plan:** the frame-by-frame plan is `docs/redesign/build-plan-next-release.md`. Its phases and frame tables still apply, but only to the scope below.

## Order of work

1. **The 66-book run** (§2). Pipeline only: no AI, nothing published.
2. **The sample review view** (§3). Build it while the run goes, and fill it only when the run is done.
3. **John's design review** (§4). The app build waits for it.
4. **The app build**, for the scope in §1 only, using the plan's phases.
5. **QA against the mockups** (the plan's Phase 8).

## 1. Scope (John, 12 Oct)

> **Superseded in the build session (John, 12 Oct):** John chose the full build plan, Phases 0–8, over the narrower
> order below. Build from `docs/redesign/build-plan-next-release.md`. The 66-book run and the sample view (§2, §3)
> still stand as pipeline work.

**In:**
- **The no-AI Understand and passage guides, wired into the app for all 66 books.** This is the main build step. The app still renders the old AI entries and reads no `understand-*.db`. Use plan Phases 0–2, VS, NA, JR and DN, plus the US and EG states that touch Understand (US-08, US-09, EG-01, EG-02).
- **Swipe between chapters.** Use SW-01–04, MM-01 (passage boundary), MM-07 (next chapter name), MM-08 (end of book) and EG-04.
- **Tyndale, three items:**
  - **Profiles** show in every book they cite, not only where they first appear, so Peter, Pilate, Mary, Martha and Lazarus show under People in John. Frames: TY-01, TY-02. Code: `packages/pipeline/src/study.ts`, `apps/mobile/src/lib/study.ts`.
  - **The book intro summary** (Purpose, Author, Date, Setting) shows at a book's first chapter. `intro_summary` is already in each study bundle (`packages/schema/src/study.ts`), but nothing in the app reads it. Frames: TY-03, TY-04.
  - **Verse notes** stay as they are, behind Study notes.
- **The study-bundle manifest merge**, so every book's study bundle can download. Follow `docs/research/manifest-merge-plan.md`. Downloads list Understand per book (DN-05).

**Moved to the build after this one** (don't build them; the frames stay on the canvas):
- human BSB, WEB and KJV audio (BA, WA, US-01–04, MM-09). Its first task is the printing check by forced alignment
  (`docs/plan-additions-2026-10-12.md` §D): one or two chapters per narrator (Souer, Gilbert, Hays; not "David")
  against our 3rd-printing `bsb.txt`, picking the narrator who matches;
- the Home Screen widget and Live Activity (WL, EG-05);
- reading plans (RP, DN-03, MM-12);
- maps (PD-02's map);
- Siri and Spotlight (MS);
- the timeline;
- themes;
- MACULA evidence marks (MM-03 as drawn, and the Original rows' marks);
- JPS 1917 publishing, until the app handles Old-Testament-only texts (`OT_ONLY_TEXTS_READY` stays false).

**Not settled by this scope.** The plan's other rows (IA v3, Settings, Compare, licensed versions and search, notifications, the other magic moments, the haptics fixes) were neither moved nor confirmed. Ask John before starting any of them.

## 2. The 66-book run (first pipeline task)

18 books are run and checked:

| Testament | Books |
|---|---|
| Old Testament | GEN, EXO, LEV, RUT, JOB, PSA, PRO, ECC, SNG, ISA |
| New Testament | MAT, MRK, LUK, JHN, ACT, ROM, 1CO, REV |

The other 48 have not been run.

**Per book** (method in `docs/no-ai-understand.md`, "Rolling out to every book"):
1. Run the passage summaries and the Understand assembler, either with `prototypes/passage_summary.py <BOOK>` and `prototypes/assemble.py report <BOOK>`, or with the TypeScript port in `packages/pipeline/src/understand/*` (identical on every checked verse).
2. Keep the **15% flag stop** for each book. If more than 15% of a book is flagged, stop that book and report it. A source gap means the rules need fixing; never hand-edit the output.
3. Report:
   - the pass count, the flag count and the reasons;
   - source coverage: UST, tQ, outline lines, OBS and Glyssen;
   - the seeded sample IDs;
   - any book whose kind of writing needs a mode it doesn't have. Modes exist for gospel, letters, law, plans, Psalms, debate, the Teacher, sayings, love poetry, visions and speech. Check, for example, history (Samuel to Chronicles), genealogies, lament (Lamentations), apocalyptic Daniel and the minor prophets.
4. Build `understand-<book>.v1.db` for each book that passes, with `npx tsx src/cli.ts understand <BOOK>` in `packages/pipeline`.
5. Add each book's row to the rollout table in `docs/no-ai-understand.md`.

**Rules for the run:**
- No AI anywhere in the run.
- Nothing is published: R2 is John's step, run when he says.
- Fixes are rules and a rerun, never one-off edits.

## 3. John's sample of 5 per book (rule 7 in `docs/no-ai-understand.md`)

Add this as a review-queue view in `packages/review`, built the way Debate positions is (`#/debates`, `DebatesView.tsx`, `server/debates.ts`):
- one card per sampled summary, showing the passage, its headline, its sentences with their credits, and the flags;
- Approve and Reject on each card, with a log line for each decision;
- no bulk action;
- tests that run on copies, never on the live file. The debates tests broke on 12 Oct because they read the live `debates.json`; they now read a frozen fixture, `src/server/fixtures/debates.pre-review.json`.

Plan and build the view, but fill it only after the 66-book run is done. A pattern John finds in the sample becomes a rule fix and a rerun.

## 4. The design gate: frames John reviews before the app build

> **Approved (John, 12 Oct):** "I approve the IA and all the other designs, e.g. Compare." The gate is clear for every
> frame on the next page, including IA-11–14 and Compare (CP). The open decisions below are still open, and approving
> a design does not change the scope in §1.

Every frame is on the canvas, https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc, on the **Next release · new flows** page unless marked. Each frame is drawn in Light, Dark and AX5. To render any frame to a PNG:
```
YADA_ROOT=/Users/johnetokhana/yada python3 .claude/skills/design/scripts/render_frames.py <out> [GROUPS=…] [ONLY=…]
```

**For this build's scope:**

| Area | Frames |
|---|---|
| Verse sheet | VS-01–07 |
| No-AI Understand | NA-01–08 |
| Passage guide, Psalms, prophets | JR-01–05, JR-07; GD-02–04 |
| Ranges | UX-06, UX-07, UX-09, UX-10 |
| Key words, depth, Elsewhere | DI-01–04; DN-01, DN-02, DN-06 |
| Downloads and Sources | DN-05, ST-02, ST-04 |
| Tyndale | TY-01–04 |
| Swipe | SW-01–04; EG-04 |
| States | EG-01, EG-02; US-08, US-09, US-10 |
| Magic moments in scope | MM-01, MM-07, MM-08 |
| Structure | IA-11–14 (Home and the reader, for where things live) |

Review them later, with the moved features: BA, WA, WL, RP, MS, MM-02–06, MM-09–12, US-01–07, US-11, CP, LT, NT, ST-01, ST-03, ST-05, DN-03, DN-04 and EG-03, EG-05–07.

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

The licensed-audio, search-route and dates questions belong to the moved features.

## 5. Carried over: don't lose these

- **Debate review complete** (3eba9f3): 43 approved, 49 rejected, 0 drafts.
  - All 18 "positions" passages show. MIC 5:2 is held.
  - `relation: "together"` is on PSA 2:7, ISA 14, JER 31 and JAS 2.
  - The half view caps readings at 3 (`readers_half`).
  - Don't change any status.
- **Sources and licences** are recorded in `sources.manifest.json` and `apps/mobile/src/lib/sources.ts`.
  - The four public-domain commentaries are Keil & Delitzsch, Ellicott, Driver and Neubauer, and Clarke. Their death-date notes, and the CDPA s.57 notes for the translators with no death date found (James Martin, Francis Bolton, E. G. Punchard), are in the manifest and `docs/research/debate-sources.md`.
  - Licences are read from source files, never from badges (rule 3).
- **Open external items:**
  - BSB audio printing: settled by the alignment check in `docs/plan-additions-2026-10-12.md` §D (John approved). The
    Berean email is optional confirmation and no longer blocks anything.
  - Get eBible.org's confirmation for the WEB audio.
  - John submits the HarperCollins NKJV form in his own browser, because their site blocks the built-in one.
  - Cambridge has to answer on the KJV in the UK before the App Store launch.
  - John's device check on build 4: a premium voice, pauses, the lock screen and Dynamic Island, Personal Voice, VoiceOver on the speed rows, and the hint behind the open guide.
- **Rules:**
  - Never cite John as a source.
  - Every debate line is a source's own sentence, unchanged.
  - Rule 9: NIV, NKJV, NLT, MSG and any other licensed text are display-only. They never enter the pipeline, Understand or any AI call.
  - Ask John before `git push` or `gh pr create`, and run `/deslop`, `/review-code` and `/security-check` first.
  - `pnpm -r typecheck` and `pnpm -r test` must pass before code commits. Check the exit code directly, never through a pipe.
  - No in-app privacy or support links until the website is live.

## Supporting documents

- `docs/redesign/build-plan-next-release.md` (phases and frames);
- `docs/redesign/review-2026-10-12.md` (slop, wireframe, states, haptics, magic moments);
- `docs/no-ai-understand.md` (decision record and rollout method);
- `docs/research/manifest-merge-plan.md`;
- `docs/research/tyndale-review.md`;
- `docs/research/debate-positions.md` and `debate-sources.md`;
- `docs/licensed-translations.md`.
