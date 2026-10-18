# Content rebuild: John's Henry choices, 18 Oct 2026

Plan only; nothing built or published. Decisions: `docs/review-2026-10-18-henry-prayers.md`. No app build is needed;
this ships through the manifest.

## What changes

- `packages/pipeline/src/understand/summaries.ts` `STEERED`: from Acts 9:23–25 alone to the 66 passages John chose
  (Acts 9:23–25 is one of them). Nothing else in the rules changes.
- Understand rebuilt for the 31 books those passages are in: GEN EXO NUM DEU JDG 2SA 1KI 2KI 1CH 2CH NEH EST JOB ISA
  JER EZK OBA MIC NAM ZEC MAT ACT ROM GAL EPH PHP 2TH 2TI 1JN 3JN REV.

## Steps

1. **Code:** add the 66 ids, with John's date in the comment. The summaries golden test measures the rules alone
   (`reviews: new Map()`), so its fixture moves for exactly these 66; update it on purpose, never wholesale.
2. **Measure before writing anything shared:** rebuild all 66 books into a scratch folder and diff every summary against
   the live bundles. Pass only if exactly the 66 change, and each now reads as the "now" line in
   `docs/research/henry-steer-2026-10-16.txt`. Anything else changing stops the run (rule 5: the fixture is suspect
   first, then the rule).
3. **Review status:** an approval is tied to the sha256 of the text shown, so the 66 new texts lose any earlier approval
   and show as flagged. John's "use new" chose the text; whether it also approves it is his call (question 1). If he says
   yes, the 66 go into `passage_reviews.json` as approved with the new text's sha256, recorded as his decision in chat
   on 18 Oct.
4. **Publish, John's step:** the audio loop (`content/audio-work/run/publish-loop.sh`) is running and publishes whatever
   sits in the shared `content/bundles` every two hours. So the new `understand-<book>` files go in only after John says
   publish: copy in, set the 31 manifest entries, `publish --dry-run`, then `publish --confirm`. Tell the Build 10 session
   first, so two runs never write the manifest at once.
5. **Check in the app:** open five of the 66 (Genesis 22, Exodus 14, Job 38, Acts 9:23–25, Revelation 5) on a phone
   and confirm the new summary shows.

Gates: typecheck and tests before the commit; deslop, review-code and security-check before any push; John's yes
before push and before publish.

## Not in this rebuild (separate fixes)

- **2 Kings 15:1–7 is wrong in the app now:** "Ahaziah's son Jotham"; BSB 15:7 makes him Azariah's son. Find which
  step writes "Ahaziah" (the UST sentence, or a name substitution) and fix the rule, never the output.
- Daniel 6, Ezra 2, Acts 2: summaries that miss the main point, from John's fix notes; the rules work in
  `docs/build-8-content-plan.md` §D.
- Jeremiah 52 and Ezekiel 33 stay as they are (old kept); nothing to fix in the live text.

## For John

1. Does "use new" approve the 66 new texts, or should they go through the summary review queue first?
   (Recommended: approve now; you read each one on the review page.)
2. Go-ahead for steps 1–2 (code and measurement, nothing shared written)?
