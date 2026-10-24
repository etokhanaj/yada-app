# 11i Web passage pages: what can ship, and what waits

18 Oct 2026. Plan only; nothing built. From `docs/build-10-plan.md` (Build 11, web passage pages) and the share-alike
decision of 18 Oct (Understand text adapted from CC BY-SA sources is published under CC BY-SA 4.0 with each source's
notice).

## The finding

The rule is "only passages John has approved" (a few hundred pages, not 1,189 chapters). On disk today
(`packages/pipeline/prototypes/data/passage_reviews.json`): **7 approved** (NUM 2, GEN, EXO, JOS, ISA, 1CO), 76 held.
The 2,923 summaries the app shows pass the automatic gate; John has not hand-approved them, so they don't qualify.
Henry's 66 (Build 10) become candidates once John approves their texts.

Seven pages is too few to be worth a launch. So 11i waits for approvals, and its design goes first.

## Steps

1. **Design first** (CLAUDE.md: no screen is built before it is drafted and John has reviewed it): a passage page
   and an index on the Build 11 canvas, with Mobbin references, in the website's existing look (`web/src/assets/site.css`).
   Each page: the passage in the BSB, its summary, Readers differ where approved, every source's credit, the CC BY-SA
   4.0 line, and a link to a data page.
2. **John approves passages** in the summary queue until there are enough to launch (his number).
3. **Build** `web/scripts/passage-pages.ts`, which reads only approved passages, refuses a bundle that is not
   `reviewed` (as `verse-data.ts` does), and fails the build if any licensed translation's text appears (rule 9:
   NIV, NKJV, NLT, MSG never on the site).
4. QA against the frames; the CLAUDE.md gates; John's yes; deploy by hand to Netlify as today.

## Needs John

- How many approved passages before the pages launch.
- Approving passages in the review tool (summaries queue).
