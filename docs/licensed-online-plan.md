# Licensed translations online: plan and stress test

Approved by John 18 Oct 2026 and built on branch `licensed-budget`. Covers NKJV, NLT and MSG through
API.Bible on the free Starter plan (NIV is off the account, see `docs/licensed-translations.md`).

## Decisions (John, 18 Oct 2026)

- **Shared copy:** the Worker keeps one copy of each chapter read in R2, Bible text only, 30 days.
- **Search:** results are still never kept (ruling of 12 Oct). A licensed search runs only when the
  reader presses Search, never while typing; references and BSB search stay on the phone. 800 licensed
  searches a month in total, 10 per phone, then search falls back to the BSB.
- **User count for NKJV's 5,000 cap:** App Store Connect's monthly active devices, checked by John. No
  device id is added.

## Budget: 5,000 calls a month

Reading is capped by the size of the Bible, not by the number of readers: about 1,189 chapters × 3
versions ≈ 3,567 calls a month at most. Search is not: unusual queries are rarely shared, so it has its
own cap.

### Stress test (simulated 18 Oct 2026)

Half of readers follow a plan (consecutive chapters), half read popular chapters; about 200 common
queries shared, the rest unique. Before the changes below, each search also cost two calls and ran as
the reader typed, which made search far worse than shown here.

| Users | Case | Reading a licensed version | Chapters a month each | Searches each | Calls | Under 5,000? |
|---|---|---|---|---|---|---|
| 100 | typical | 30% | 20 | 2 | ~530 | yes |
| 100 | heavy | 60% | 40 | 4 | ~1,600 | yes |
| 100 | worst | 100% | 60 | 6 | ~3,060 | yes |
| 1,000 | typical | 30% | 20 | 2 | ~2,930 | yes |
| 1,000 | heavy | 60% | 40 | 4 | ~5,380 | **no**: search 1,909 |
| 1,000 | worst | 100% | 60 | 6 | ~8,320 | **no**: search 4,754 |

At 1,000 users chapter calls level off near the ceiling (3,457 heavy, 3,560 worst). Every failure was search.

### What was built

| Problem | Fix | Where |
|---|---|---|
| Search unbounded | On submit only; 800 a month on the server, 10 per phone; one call per search (the copyright line is kept in R2) | `gate.ts`, `budget.ts`, `search.tsx`, `licensed.ts` |
| Many readers, one chapter | One shared R2 copy; one fetch in flight per chapter in a single Durable Object | `gate.ts`, `index.ts` |
| Running out | Reading stops at 4,900, search at 800; stored copies keep serving; the reader says the chapter "isn't available until next month", search uses the BSB | `budget.ts`, `[chapter].tsx`, `search.tsx` |
| Phone keeping a copy past 30 days | The phone counts 30 days from `fetchedAt`, when API.Bible sent it | `licensed.ts` |
| Removal within 24/72 hours | Daily cron deletes expired copies and versions not in `SERVED` | `index.ts` |
| Starter attribution | Sources' Read online row links to https://api.bible | `sources.tsx` |

Worst 1,000-user month after the fixes: ~3,567 + 800 + ~10 ≈ 4,380 calls. A chapter read on the first and
last day of a 31-day plan month is fetched twice; §11 allows nothing else, and the ~500 spare calls
under the 4,900 stop cover it. (This plan first proposed ending copies at the plan month's end to avoid
that; a test showed it saves nothing, so copies simply last 30 days.)

## What John must do

1. ~~API.Bible dashboard~~ (read 18 Oct 2026): 45 of 5,000 calls used; resets on the 9th, so
   `PLAN_MONTH_DAY = "9"`; end-user range **0–1K**. Past 1,000 monthly users, raise the range by the end
   of the next plan month (§17.3.b); it must stay at 5,000 or fewer for NKJV.
2. Check NLT's and MSG's licence terms in the dashboard for anything beyond API.Bible's own.
3. `npx wrangler r2 bucket create yada-licensed-cache`, then `npx wrangler deploy` (steps in
   `docs/licensed-translations.md`, "Deploying the proxy").
4. Monthly: App Store Connect active devices under 5,000, or NKJV comes off `SERVED`.
5. Optional: ask support@api.bible to confirm the shared server copy and FUMS for a native app.
