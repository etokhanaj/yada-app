---
name: review-code
description: Review a Yada diff for correctness and for the project's earned rules (no invented parses, honest provenance, licences, review status). Use before a PR, a TestFlight upload, or after significant changes.
---

# Review code (Yada)

Review the current diff (`git diff master...HEAD`, or staged changes). Report findings ranked
most severe first, each with file:line, the failure scenario, and a fix. Do not restyle.

## Correctness
- Types: no `any`, no unchecked `as`, `noUncheckedIndexedAccess` respected.
- Errors are reported, not swallowed. Pipeline stages exit non-zero on failure.
- SQLite: parameters bound, never interpolated. Mobile never closes a database.
- Verse ids are English versification; `verseOrd` used for ranges.

## Yada rules (block the PR if broken)
- Nothing writes a parse, Strong's number or gloss that the source data does not contain.
- Generated content is `flagged`; nothing promotes a review status except the review tool.
- `INSERT OR REPLACE` that could silently drop rows or columns — check it twice.
- New source data: licence read from the file itself and recorded in `sources.ts`.
- `unreviewed-dev` bundles cannot reach `publish`.
- Hebrew uses per-Text `writingDirection`; English prose with original-language words uses
  `LTR_PROSE`; `leading()` is ratio-only.

## Tests
- New logic has a vitest test, including the failure case that motivated it.
- Tests needing `content/raw` skip cleanly when it is absent (CI has none).

Finish with: blockers, should-fix, nits — and say plainly if there are none.
