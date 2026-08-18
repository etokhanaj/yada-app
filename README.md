# Yada

A Bible reader whose content is produced by an AI-built, human-reviewed pipeline and shipped as
static per-book SQLite bundles. No runtime AI, no backend in v1.

This repo is at step 4 of the engineering sequence: **the schema and the deterministic pipeline**,
from raw sources up to a costed, inspectable request. Generation, the review tool and the app are
deliberate stubs, each behind a stated gate.

## What exists

### `packages/schema` — the single source of truth

Zod schemas plus inferred types, shared by three consumers that must not drift apart: the pipeline's
generation validator, the review tool, and the app's typed reads.

| File | Contents |
|---|---|
| `src/refs.ts` | All 66 books (3-character USFM codes, canonical order, testament, chapter count), the `BOOK.chapter.verse` verse-id convention, verse ranges, and a forgiving `parseReference` for human input |
| `src/claims.ts` | `Claim`, the four categories, evidence strength, grounding, typed evidence refs (verse / lexical / apparatus), and debated `positions` — which have no winner field, by design |
| `src/entries.ts` | `VerseEntry`, `PericopeEntry`, `BookEntry`, and `SCHEMA_VERSION` |
| `src/manifest.ts` | Per-dataset source manifest and `isCommercialSafe` (excludes BY-NC-ND) |
| `src/validate.ts` | The deterministic quality contract as pure functions returning findings |

Two structural rules live in Zod itself, because an entry that breaks them should never parse:
`positions` may only appear on a `debated` claim, and `grounding: "model_knowledge"` caps
`evidence_strength` at `supported`.

Everything semantic lives in `validate.ts` instead, so the CI regression tier can *report* rather
than throw:

- every verse evidence ref resolves to a real verse or range
- every claim is one independently testable assertion (no unbracketed semicolon, at most one
  sentence terminator — abbreviations like `v. 35` do not count)
- `text` claims must be grounded in `source_data`
- `debated` claims carry at least two positions, unless the entry is explicitly marked
  `no_significant_dispute` (then it downgrades to a warning)
- `display_rank` is unique **within a display group** — "What we can see" spans text and context,
  "Where interpretation differs" spans interpretation and debated — because the group is what the
  reader actually sees
- an entry's verse falls inside its own pericope, and related passages resolve

### `packages/pipeline` — raw sources to a costed request

Deterministic, and it stops before money is spent. `ingest` fetches and pins sources, regenerating
`sources.manifest.json`; `normalize` builds `content/staging.db`, resolving Hebrew versification
into English once; `derive` produces mechanical glosses and morpheme decomposition; `generate
--dry-run` builds and prices the exact requests that *would* be sent, and submits nothing.

**No API call is made anywhere in this package, and there is no API key in this repo.**

### `golden/` — seven fixtures, and the oracle that uses them

The permanent regression suite. 1 Corinthians 14:34 is the canonical test verse: if the system
handles this verse honestly, it is credible on ordinary ones. Six more cover the other genres.

`yada oracle` — and `derive.test.ts`, so it runs in CI — checks derived output against every
fixture: same surfaces, same morpheme decomposition, same Strong's numbers. On its first run it
reproduced two of seven. Of the five failures, **four were errors in the fixtures** and one was a
bug in the derivation. Assume the oracle is right and the fixture is suspect until you have
checked which.

`docs/derive-findings.md` records what those failures were and how each was resolved. Read it
before changing `normalize` or the lexicon matching — two of the bugs it describes produced
confident, well-formed, wrong data that no amount of reading the output would have caught.

## Deliberately a stub

| Path | Status |
|---|---|
| `packages/review` | Queue names only. The review web app comes later. |
| `apps/mobile` | Type placeholders only. No app code until the Milestone 0 proof passes. |
| `content/` | Gitignored working data: raw sources, `staging.db`, request bodies. |

Not built at all yet, and each has a scheduled arrival gate: generation, adversarial pass, bundle
packaging, publishing, the review UI, and every screen of the app.

## Commands

```bash
pnpm install
pnpm -r typecheck     # tsc --noEmit per package
pnpm -r test          # vitest per package
pnpm test             # same tests via the root runner
```

The pipeline, from `packages/pipeline` (stages are ordered; each needs the one before it):

```bash
npx tsx src/cli.ts ingest                  # fetch + pin sources, regenerate the manifest
npx tsx src/cli.ts normalize               # build content/staging.db
npx tsx src/cli.ts derive JHN              # mechanical glosses + coverage
npx tsx src/cli.ts oracle                  # derived output vs the golden fixtures
npx tsx src/cli.ts generate --dry-run JHN  # build + price requests. Submits nothing.
```

Requires Node 22+ and pnpm 10.

## Conventions worth knowing before adding code

- **Verse ids are `JHN.1.1`** — book code, chapter, verse — identical in the pipeline, in bundles,
  and in the app. Pericope ids are explicit ranges: `1CO.14.26-14.40`.
- **Derived is not generated.** `gloss` is mechanical, from alignment data. `close_rendering` is
  composed and reviewed. Nothing composed is ever labelled literal.
- **`confidence` is internal** and must never reach the UI as a score. `evidence_strength` is the
  only user-facing signal.
- **Schema changes are versioned.** Bump `SCHEMA_VERSION`; bundles and the app negotiate on it.
- **Strong's numbers are zero-padded to four digits** — `G0746`, `H0430`. The lexicons write the
  padded form and OSHB does not; a corpus mixing them joins for some words and silently misses for
  others. Use `canonicalStrongs` rather than string-building one.
- **Verse ids are English versification** (`CANONICAL_VERSIFICATION`), resolved once in `normalize`
  and never again. Hebrew numbering diverges two different ways — a title inside verse 1 (Ps 23,
  split) and a title *as* verse 1 (Ps 3, everything shifts) — plus cross-chapter shifts such as
  Hebrew Gen 32:1 being English Gen 31:55. Superscriptions live at verse 0.
- **Read licences from the source file, never from a repo badge.** This has caught three real
  problems: SBLGNT is under its own EULA rather than the CC BY the PRD claims, TBESH's definitions
  need Online Bible's permission, and morphhb carries a public-domain text and CC BY annotations
  that must stay separate manifest entries.
- **Never state a parse or a Strong's number the source data does not contain.** This binds the
  pipeline as much as the generation prompt; the Greek fixtures failed it before the oracle caught
  them.
