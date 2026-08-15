# Yada

A Bible reader whose content is produced by an AI-built, human-reviewed pipeline and shipped as
static per-book SQLite bundles. No runtime AI, no backend in v1.

This repo is at step 1 of the engineering sequence: **the monorepo skeleton and the schema package**.
Everything else is a deliberate stub.

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

### `golden/1co.14.34.json`

The seed of the permanent regression suite. 1 Corinthians 14:34 is the canonical test verse: if the
system handles this verse honestly, it is credible on ordinary ones. The fixture carries three text
claims, three context claims (one of them `model_knowledge`, capped at `supported`), and one debated
claim with two positions.

## Deliberately a stub

| Path | Status |
|---|---|
| `packages/pipeline` | Stage names only. No ingest, no derivation, **no API calls**. |
| `packages/review` | Queue names only. The review web app comes later. |
| `apps/mobile` | Type placeholders only. No app code until the Milestone 0 proof passes. |
| `content/` | Gitignored working data: raw sources, `staging.db`, batch files. |

Not built at all yet, and each has a scheduled arrival gate: generation, adversarial pass, bundle
packaging, publishing, the review UI, and every screen of the app.

## Commands

```bash
pnpm install
pnpm -r typecheck     # tsc --noEmit per package
pnpm -r test          # vitest per package
pnpm test             # same tests via the root runner
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
