# Cost model

What one whole-Bible generation run costs, measured rather than assumed.

Measured at Milestone 0 on 2026-10-09 from `content/usage.jsonl` (14 logged
requests) and the six final responses in `content/responses/`. Rates are the
standard ones: Opus 5 $5/$25 and Sonnet 5 $3/$15 per million input/output
tokens. The Sonnet introductory rate ended 2026-08-31 and is not used anywhere
below. Pounds use the repo's `USD_PER_GBP = 1.27`.

**The batch discount is assumed, not exercised.** The sample was sent
synchronously over streaming, at full price. Every whole-Bible figure below
applies the Message Batches 50% discount. If batch is not used, double them.

## The headline

The old estimate was off by a factor of three on output and a factor of three on
input. The model choice matters less than assumed, and the length of the entries
matters more.

| | Assumed (Aug 2026) | Measured, Opus 5 | Measured, Sonnet 5 |
|---|---|---|---|
| output tokens per verse | 1,500 | **4,259** | **4,902** |
| of which thinking | not modelled | 1,058 (25%) | 2,559 (52%) |
| input tokens per verse | ~408 (1,223 chars at 3.0) | 1,380 | 1,380 |
| whole Bible, one pass, batch | £484 / £194 | **£1,388** | **£951** |
| with the old +34% adversarial allowance | £647 / £259 | £1,856 | £1,272 |

The thinking split is from `usage.output_tokens_details.thinking_tokens`, which
is a subset of `output_tokens`, not an addition to it, so it is priced once.

Two things change the decision:

1. **Sonnet is not 2.5× cheaper. It is 1.46× cheaper.** Sonnet thinks more than
   twice as much as Opus per verse, and thinking is billed as output. On the
   matched sample Sonnet produced 15% *more* output tokens than Opus, and its
   per-verse cost was 69% of Opus's, not 40%.
2. **One pass fits the ceiling. The PRD's full budget does not.** PRD §11.10 asks
   the £1–2k to cover initial generation, the adversarial pass, and a reserve of
   at least one full regeneration. At the measured rates that comes to about
   £3,700 on Opus and £2,500 on Sonnet. See "Against the PRD ceiling".

## What was measured

Prompt `pericope@1.1.0`, adaptive thinking, one request per pericope per model.
These are the final-run numbers. Retries and failures are covered separately.

| Pericope | verses | Model | input | output | thinking | visible | output/verse | cost (sync) | $/verse |
|---|---|---|---|---|---|---|---|---|---|
| GEN.1.1-1.5 | 5 | Opus | 15,144 | 33,483 | 8,572 | 24,911 | 6,697 | $0.913 | $0.183 |
| GEN.1.1-1.5 | 5 | Sonnet | 15,144 | 31,211 | 16,696 | 14,515 | 6,242 | $0.514 | $0.103 |
| PSA.23.0-23.6 | 7 | Opus | 5,867 | 33,191 | 8,432 | 24,759 | 4,742 | $0.859 | $0.123 |
| PSA.23.0-23.6 | 7 | Sonnet | 5,867 | 43,781 | 25,063 | 18,718 | 6,254 | $0.674 | $0.096 |
| 1CO.14.26-14.40 | 15 | Opus | 16,244 | 48,314 | 11,559 | 36,755 | 3,221 | $1.289 | $0.086 |
| 1CO.14.26-14.40 | 15 | Sonnet | 16,244 | 57,353 | 27,345 | 30,008 | 3,824 | $0.909 | $0.061 |

Pooled over the 27 verses:

| Model | output/verse | thinking/verse | visible/verse | thinking share | sync $/verse |
|---|---|---|---|---|---|
| Opus 5 | 4,259 | 1,058 | 3,201 | 24.8% | $0.113 |
| Sonnet 5 | 4,902 | 2,559 | 2,342 | 52.2% | $0.078 |

**Per-verse output falls as pericopes get longer.** A pericope carries a fixed
cost: its own pericope entry (4,300–6,700 visible tokens) plus a thinking floor
of about 8k tokens on Opus. Opus went from 6,697 per verse on 5 verses to 3,221
on 15. A straight-line fit through the three points gives roughly 24k tokens per
pericope plus 1,600 per verse on Opus, and 23k plus 2,350 on Sonnet. Three points
is too few to trust that fit, and genre and chapter length are confounded with
pericope length. It is used below only as the optimistic bound.

**Where the visible output goes.** Verse entries averaged 2.0k tokens (1 Cor),
2.8k (Ps 23) and 4.1k (Gen 1) on Opus, and 1.6k–2.1k on Sonnet. Opus writes more
claims: 4.5–7.8 per verse entry against Sonnet's 4.1–5.0. All six responses came
back as pretty-printed JSON in a code fence. Indentation and newlines are about
4–8% of visible tokens. That figure is estimated from line counts, not measured.

**Run-to-run variance is large on Sonnet.** Psalm 23 was generated twice under
two drafts of prompt 1.1 (`responses-run2/`, then `responses/`). Opus went from
29,583 to 33,191 output tokens (+12%). Sonnet went from 27,981 to 43,781 (+56%),
nearly all of it thinking (14,577 to 25,063). The prompt changed slightly between
the two runs, so this is not pure variance, but a single sample per pericope
cannot pin Sonnet's number down.

## Characters per token

The 3.0 guess was right for English prose and wrong for what these requests
actually contain, which is mostly morphology lines.

**Whole requests**, from `count_tokens` against the request bodies rebuilt with
`buildRequest`:

| Request | characters | tokens | chars/token | tokens vs the 3.0 estimate |
|---|---|---|---|---|
| GEN.1.1-1.5 | 21,881 | 15,144 | 1.44 | 2.08× |
| PSA.23.0-23.6 | 13,044 | 5,867 | 2.22 | 1.35× |
| 1CO.14.26-14.40 | 26,609 | 16,244 | 1.64 | 1.83× |

**By component.** This split is derived, not measured directly. Six counts
(three run-1 requests with no schema and three final ones) give a linear system
in the characters of each kind. Solved on Genesis and Psalms and checked against
1 Corinthians:

| Component | chars/token |
|---|---|
| English prompt prose | 3.00 |
| JSON Schema block | 2.41 |
| Hebrew `surface\|morph\|strongs` lines (pointed, cantillated) | 0.96 |
| Greek `surface\|morph\|strongs` lines | 1.26 |

Adding the schema cost exactly 2,895 tokens on all three requests, which fits an
additive split. Hebrew costs more than a token per character because every vowel
point and accent is its own code point.

**Output** came to 2.37–2.88 characters per visible token: English prose inside
JSON, with Hebrew or Greek embedded.

**Input is still small.** At 1,380 tokens per verse (the sample's pooled figure,
inflated by Genesis 1:1–5 carrying all 31 verses of its chapter) whole-Bible input
is ~42.9M tokens. That is 3.4× the old 12.7M, but still only 6% of the Opus bill.
Rebuilt under prompt 1.1, John's 45 requests come to an estimated 1,018 tokens
per verse, so 1,380 is the conservative choice.

## Retries and failures

The old model assumed zero. The whole of Milestone 0 took 16 attempts to produce
6 usable responses.

| Run | Prompt / settings | Attempts | Failed | How | Logged spend |
|---|---|---|---|---|---|
| 1 | 1.0, no schema in prompt, `max_tokens` 2,500/verse + 8k | 6 | 6 | 3 hit `max_tokens` (one Sonnet run spent all 20,500 on thinking and wrote nothing). The other 3 returned 40 entries, all failing Zod: field names were invented without a schema | $3.643 |
| 2 | draft 1.1, Psalm 23 only | 2 | 0 | 16/16 entries schema-valid; superseded by the final prompt | $1.206 |
| final | 1.1, 4,000/verse + 24k | 8 | 2 | Opus on 1 Cor 14:26–40 was cut off twice by the SDK's 10-minute client timeout. Neither attempt is in `usage.jsonl` | $5.158 |
| **total** | | **16** | **8** | | **$10.007 logged** |

- **Under the final configuration** 2 of 8 attempts failed (25%), both from the
  one cause, and it has been fixed (timeout raised to 30 minutes in `ed2db74`).
  Of the 6 completed responses, 6 parsed and 60 of 60 entries passed the schema:
  no malformed output and no `max_tokens` stops.
- **The two timed-out attempts are unaccounted spend.** `usage.jsonl` has no
  record of them, because worst-case logging (`estimated: true`) arrived in the
  same commit as the fix. The code's own worst case for each is $2.18 (16,244 in,
  84,000 out at the then-current cap), so $4.36 for both. If each was billed only
  for what streamed before the cut-off, the cost is lower but unknown, because
  elapsed time is not logged. **Total Milestone 0 spend is $10.01 logged, and at
  most $14.37.** Either way it is inside the $25 session ceiling. The console
  invoice settles it.
- Structured outputs (`output_config.format`) refused the schema three times as
  too large a grammar, so the contract travels in the prompt and is enforced by
  `assemble` and Zod. Every response still arrived wrapped in a code fence,
  despite "JSON only". `extractJson` recovers it, so this costs a few tokens and
  is not a failure.
- **For projection:** 0% retry is the measured steady state under 1.1. 10% and
  25% are shown as sensitivity, since one sample cannot rule out batch failures.

## Whole-Bible projection

31,102 verses at the batch-discounted rate (assumed). Input is taken at 1,380
tokens per verse throughout.

| Basis | Opus output/verse | Opus £ | Sonnet output/verse | Sonnet £ |
|---|---|---|---|---|
| Old assumption | 1,500 | 484 | 1,500 | 194 (intro rate) |
| Fixed + per-verse fit at ~26 verses per pericope (build plan's ~1,200 pericopes), optimistic | 2,523 | 857 | 3,238 | 645 |
| **Measured, pooled (central)** | **4,259** | **1,388** | **4,902** | **951** |
| Central + 10% retries | | 1,527 | | 1,046 |
| Central + 25% retries | | 1,735 | | 1,189 |
| Worst observed pericope (pessimistic) | 6,697 | 2,135 | 6,254 | 1,199 |
| Central, without the batch discount | | 2,777 | | 1,902 |

The central Opus figure breaks down as $107 input and $1,656 output. Output is
94% of the bill, as before.

## Sensitivity

Output tokens per verse is still the one number that decides the bill. Input is
held at 1,380 tokens per verse. "+adv" applies the old model's +34% allowance for
the adversarial pass, which has not been measured.

| output tokens/verse | Opus £ | Opus + adv £ | Sonnet £ | Sonnet + adv £ |
|---|---|---|---|---|
| 1,500 (old assumption) | 544 | 727 | 326 | 436 |
| 2,000 | 697 | 932 | 418 | 559 |
| 3,000 | 1,003 | 1,341 | 602 | 804 |
| **4,259 (Opus measured)** | **1,388** | **1,856** | 833 | 1,114 |
| **4,902 (Sonnet measured)** | 1,585 | 2,119 | **951** | **1,272** |
| 6,000 | 1,921 | 2,569 | 1,153 | 1,541 |
| 6,700 (worst observed) | 2,136 | 2,855 | 1,281 | 1,713 |
| 8,000 | 2,533 | 3,387 | 1,520 | 2,032 |

Each row prices both models at the same per-verse output. Read across the two
bold rows, not down one column: the models do not produce the same output.

Where each model crosses the ceiling:

| | one pass | one pass + adversary |
|---|---|---|
| Opus at £2,000 | 6,257 tokens/verse | 4,611 tokens/verse |
| Opus at £1,000 | 2,991 | 2,167 |
| Sonnet at £2,000 | 10,613 | 7,868 |
| Sonnet at £1,000 | 5,168 | 3,796 |

Opus with the adversarial pass has an 8% margin under £2,000 at the measured
rate (4,259 against 4,611).

## Against the PRD ceiling

PRD §11.10 sets £1–2k for Milestones 0–3. It lists the line items as initial
generation, adversarial pass, a regeneration reserve of at least one full
corpus, human review and storage. Pricing generation plus adversary, twice:

| Basis | Opus (gen + adv) × 2 | Sonnet (gen + adv) × 2 |
|---|---|---|
| central | £3,712 | £2,544 |
| optimistic fit | £2,292 | £1,725 |

**Neither model fits the PRD's full line items at the central measured rate.**
For generation, adversary and one regeneration to fit in £2,000, output must fall
to about 2,170 tokens per verse on Opus (−49%) or 3,800 on Sonnet (−23%). The
alternatives are to accept a partial regeneration reserve, to use the build
plan's own option of a mid-tier model with the top tier kept for hard books, or
to revisit the ceiling, which the PRD allows "unless model testing shows
otherwise". That choice is John's.

## Cost levers, in order of size

1. **Entry length.** Opus writes 4.5–7.8 claims per verse entry, and its pericope
   entries are 4.6–6.7k tokens each. Visible output is about 70% of the Opus
   bill, and a claim cap per verse plus a shorter pericope entry act on it
   directly.
2. **Pericope length.** About 24k tokens are fixed per pericope. Longer pericopes
   amortise them, until a pericope's output nears the 128k cap (see below).
3. **Thinking on Sonnet.** 52% of Sonnet's output is thinking. Adaptive thinking
   gives no budget control, as `budget_tokens` is rejected on these models.
4. **Compact JSON with no code fence.** Roughly 4–8% of visible output.
5. **Input.** About 6% of the bill. Not worth optimising.

## Limits of this extrapolation

- **27 verses, three pericopes, one sample each.** The per-verse figure comes
  from a creation narrative, a short psalm and an epistle. There is no law,
  prophecy, long narrative, genealogy, gospel narrative or apocalyptic.
- **Largest pericope was 15 verses.** The build plan's ~1,200 pericopes average
  ~26 verses. That is outside the sample, and it is where the fixed-plus-per-verse
  fit is least reliable.
- **The 128k output cap.** `maxTokensFor` is 7,000 × verses + 24,000, capped at
  128,000. At Sonnet's 1 Cor average (3,824 per verse) a pericope of about 33
  verses reaches the cap, so long pericopes need splitting or measuring before
  batch submission.
- **Batch discount assumed.** Batch latency with 20-minute outputs is also
  unobserved.
- **Adversarial pass unmeasured.** The +34% is carried over from the old model.
- **Human review is not priced.** It is the real budget, and Opus's more
  traceable evidence makes it cheaper per entry (see `docs/milestone-0.md`).
- **Chars-per-token split is derived** from six request counts, not counted per
  component.

## Why pericopes, not verses

Request granularity is the pericope (build plan §3). Per-verse requests would
send each chapter's aligned morphology once per verse, not once per pericope. The
Milestone 0 numbers strengthen the case: each request carries about 4,300 tokens
of prompt and schema, and each response about 24k fixed output tokens. Both are
paid once per request.

## Open content gap (unchanged)

`generate --dry-run JHN` skips `JHN.7.53-8.11`: SBLGNT omits the *pericope
adulterae*, so John 7 ends at verse 52 and John 8 opens at verse 12. The reader
needs a deliberate answer to this before it ships. The same question governs
Mark 16:9–20 and the Comma Johanneum. It is still open and not resolved here.
