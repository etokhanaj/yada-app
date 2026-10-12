# One-time approval of the seven golden entries (11 Oct 2026)

John wrote in chat on 11 Oct 2026: "ship the seven reworded entries just this one time without my approval".
These seven entries had been reworded in plain words, a rewrite John had already accepted, so they went back to
`flagged`. For build 3 they were approved through the review tool's own `approve()` path rather than by hand.

| Entry | Decision | Status | Rating | Reason |
|---|---|---|---|---|
| GEN.1.1, LEV.19.18, PSA.23.1, ISA.53.5, JHN.1.1, 1CO.14.34, REV.13.18 | approved | human_reviewed | none | "Approved by John in chat on 11 Oct 2026 for build 3, as a one-time approval without per-entry review in the tool." |

The approval first recorded a rating of 5 for each entry, a score nobody gave, because `approve()` requires one.
That rating was cleared to none the same day in `review/decisions.jsonl`, `review/review_state.jsonl` and
`content/staging.db`. A rating is John's judgement of an entry, and he did not rate these wordings.

This does not set a precedent. From the next build, every entry is approved by John in the review tool, one entry at
a time (CLAUDE.md rule 2).

The shipped payloads still carry their `review.flags` notes from authoring, such as "hand-authored spike fixture,
not reviewed corpus". These are history, not status: the packager writes `review.status` from `review_state`. They
should be cleared at the next real review.
