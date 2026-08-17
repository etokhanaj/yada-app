# Cost model

What one whole-Bible generation run costs, and which number decides it.

Produced by `yada generate --dry-run JHN`. **No generation API has been called
and no API key exists in this repo.** Everything below is arithmetic over
request bodies that were built and written to `content/requests/`, never sent.

## The headline

A whole-Bible run fits inside the PRD §11.10 ceiling of £1–2k on every model
tier — but the margin is entirely at the mercy of one unmeasured number.

| Model | input | output | total | £ | £ with adversarial pass |
|---|---|---|---|---|---|
| `claude-opus-5` | $32 | $583 | $615 | £484 | £647 |
| `claude-sonnet-5` | $13 | $233 | $246 | £194 | £259 |
| `claude-haiku-4-5` | $6 | $117 | $123 | £97 | £129 |

Message Batches pricing (50% off input and output) is applied throughout; the
whole corpus is a batch workload, with no latency requirement whatsoever.

**Output is 95% of the cost.** Input is a rounding error. Any effort spent
trimming the prompt or the morphology block is effort spent on 5% of the bill.

## What was actually measured

Only the request side. For John:

| | |
|---|---|
| requests built | 45 (one per pericope) |
| verses covered | 866 |
| total characters | 1,059,413 |
| per request | 14,687 min / 24,186 median / 34,292 max |
| **characters per verse** | **1,223** |

Extrapolated across 31,102 verses: **38.0M characters** of request text.

The per-verse figure is high because a request carries its whole chapter as
aligned context, so verses in multi-pericope chapters are sent more than once.
That is deliberate — see "Why pericopes" below — and it is already priced in.

## What was assumed, and why the assumptions are stated rather than hidden

Two numbers are guesses. Both are called out at the top of the dry-run output.

**1. 3.0 characters per token (input).** No offline tokeniser is correct for
Claude. `tiktoken` is OpenAI's, undercounts Claude by roughly 15–20% on English,
and is worse on Greek and Hebrew, where a single character can cost several
tokens. The only accurate count is `POST /v1/messages/count_tokens`, which needs
credentials this prompt is not permitted to add. Being wrong here moves 5% of
the bill, so it is not urgent.

**2. 1,500 output tokens per verse entry.** This one *is* the bill. It has never
been observed — no entry has ever been generated. If the true figure is 3,000,
every number above doubles, and Opus with an adversarial pass reaches ~£1,250,
still inside the ceiling but no longer comfortably. At 6,000 it breaks it.

**This is the number Milestone 0 exists to measure.** The build plan's rule —
nothing scales until the real per-verse cost exists — is a rule about exactly
this figure.

## Sensitivity

Because output dominates, the model is effectively one-dimensional:

| output tokens/verse | Opus £ | Sonnet £ | Haiku £ |
|---|---|---|---|
| 1,000 | £330 | £132 | £66 |
| 1,500 (assumed) | £484 | £194 | £97 |
| 3,000 | £943 | £377 | £189 |
| 6,000 | £1,861 | £744 | £373 |

Read this as: the model choice is worth less than a factor of five, and the
verbosity of the entries is worth a factor of six. Constraining entry length in
the prompt is the highest-leverage cost control available, and it is a content
decision before it is a budget one.

## Why pericopes, not verses

Request granularity is the pericope (build plan §3). A per-verse request would
carry its chapter's aligned morphology once *per verse* rather than once per
pericope — roughly a 6× multiplier on input for John, and it would also lose the
cross-verse context that makes a pericope entry coherent. Pericope granularity
is a content decision that happens to be the cheaper one.

## What this run does not cover

- **The corpus is 7 books, not 66.** The 1,223 chars/verse comes from John.
  Hebrew verses run denser in the ingested books (106–108 characters of surface
  text per verse against John's 81) and carry morpheme decomposition, so the OT
  per-verse input is likely higher. The extrapolation applies a Greek measurement
  to a mostly-Hebrew canon.
- **No review cost.** PRD review is human, and human time is the real budget.
- **No retry or failure cost.** Batch jobs fail, and refusals and malformed JSON
  both cost output tokens for nothing.
- **`claude-sonnet-5` is on an introductory rate** ($2/$10) that expires
  2026-08-31, after which it reverts to $3/$15 and its column rises by ~50%.
  Rates were cached 2026-06-24; verify before quoting any of this.

## One content gap this run surfaced

`generate --dry-run JHN` skipped one pericope:

```
SKIP JHN.7.53-8.11 (no tokens in staging.db)
```

SBLGNT omits John 7:53–8:11 — the *pericope adulterae* — entirely. In the
ingested text John 7 ends at verse 52 and John 8 opens at verse 12. This is not
a pipeline bug; it is an editorial decision by the base text, and it is the most
widely known textual dispute in the gospel.

It needs a deliberate answer before the reader ships, because a Bible that
silently jumps 7:52 → 8:12 reads as broken, and the passage is precisely the
kind of `debated` content Yada exists to explain. The same question governs Mark
16:9–20 and the Comma Johanneum. Recorded as open; not resolved here.
