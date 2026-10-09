---
name: ai-prompt
description: Create or revise Yada's generation and adversary prompts (packages/pipeline/prompts) and their output contract. Use when changing what the model is asked to write or how its output is parsed.
---

# AI prompt (Yada)

Prompts live in `packages/pipeline/prompts/`; the output contract is `GENERATION_SCHEMA` in
`packages/pipeline/src/assemble.ts`. Generation happens at authoring time only — never in the app.

## Before editing
- Read the prompt, `assemble.ts`, and the last `yada inspect` output. Change for a measured
  finding, not a hunch, and name the finding in the commit.

## Rules the prompt must keep
- The model explains the parsing it is given; it never recalls parsing from memory.
- One independently testable assertion per claim; fact and explanation never share one.
- Categories per the PRD: `text` must be recoverable from the supplied data.
- `debated` claims name traditions and carry positions with no winner.
- `source_data` claims cite evidence; `model_knowledge` claims are hedged, capped at `supported`.
- OT `text` claims citing lexical evidence set `analysis_tradition`.

## Contract
- The model writes composed fields only. Ids, versions, review status and the derived gloss are
  stamped by `assemble.ts`. Never ask the model to copy data the pipeline already has.
- Structured outputs refused this schema (too many optionals, unions, grammar size). The schema
  travels in the prompt and is enforced by assemble + Zod, which reject rather than repair.

## Versioning and spend
- Bump `PROMPT_VERSION` in `assemble.ts` and the version line in the prompt together.
- Test on the smallest pericope first (`generate --confirm PSA`, ~$1). A 400 costs nothing.
- Then `yada inspect` and compare per-rule violation counts against the previous run.
