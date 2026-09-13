# @yada/review

John's daily review surface over `content/staging.db` (build plan §5). It is local only: a small
Node server using `node:sqlite` with no native dependencies, bound to `127.0.0.1`, plus a Vite and
React client.

## Run it

```bash
pnpm --filter @yada/review dev        # API on 127.0.0.1:4317, Vite on 127.0.0.1:5173 (proxies /api)
pnpm --filter @yada/review build      # client -> dist/client
pnpm --filter @yada/review start      # API + built client on 127.0.0.1:4317
pnpm --filter @yada/review export     # regenerate review/review_state.jsonl from the DB (read-only)
pnpm --filter @yada/review test
pnpm --filter @yada/review typecheck  # server and client tsconfigs
```

| Env | Default | |
|---|---|---|
| `YADA_STAGING_DB` | `<repo>/content/staging.db` | Database to review |
| `YADA_REVIEW_DIR` | `<repo>/review` | Where `decisions.jsonl` / `review_state.jsonl` are written |
| `YADA_REVIEW_PORT` | `4317` | API port (Vite's proxy reads it too) |
| `YADA_SAMPLE_SEED` | `yada-review-sample-1` | Seed for the per-book sample |
| `YADA_REVIEWER` | `john` | Written into every decision line |

**When you are testing, not reviewing**, point both `YADA_STAGING_DB` and `YADA_REVIEW_DIR` at
copies. An approval clicked against the real database, or appended to the committed log, is a
human review that never happened.

## Queues

| Queue | Membership | Order |
|---|---|---|
| Flagged | `review_state.status = 'flagged'`. A verse with no row counts as flagged, as bundle packaging treats it | Verse order |
| Adversary disagreements | Any `adversary_flags` row whose verdict is not `upheld` | Critical first, then more critical rows, then more disagreements, then verse order |
| Random sample per book | Within each book, verses ranked by `sha256(seed, verse_id)`, and the first `max(1, ceil(7% × n))` taken | Verse order |
| Targeted expert | Any debated claim, any `model_knowledge` claim, a `translation_note`, a related passage marked `quotation`/`allusion`/`fulfillment`, or any `critical` adversary flag. Each trigger is listed as a reason | Verse order |

The sample is a pure function of the seed and a book's own verse ids. It is the same on every load
and for every insertion order, and one book growing does not change another book's sample. Books
with fewer than 15 entries still get one sampled entry, which is above 10%. The seed is shown in
the UI and written into every decision taken from that queue.

The targeted-expert queue reads the raw payload, so an entry that no longer parses under the
current schema is still routed. A `critical` flag counts whatever its verdict: `upheld` with
`critical` severity is a contradiction, and a contradiction is worth an expert's time.

## Decisions

- **Approve** sets status to `human_reviewed` and decision to `approved`. It needs a rating from 1
  to 5, and is refused below 4 (the PRD 0C bar), with the reason shown. It is also refused when the
  payload fails to parse, when `validateVerseEntry` reports errors, and for an `expert_reviewed`
  entry, because approving would downgrade it.
- **Reject** keeps status `flagged` and sets decision to `rejected`. It needs a non-empty reason,
  since reasons feed prompt revision. A rating is optional.
- Keys: `j`/`k` next/previous, `1`–`5` rate, `a` approve, `r` reject (focuses the reason box when
  it is empty), `⌘↩` rejects from the reason box, and `Esc` leaves it.

The server enforces every rule. The client shows the server's refusal text verbatim.

### Durability (build plan §2)

Each decision is appended to `review/decisions.jsonl` inside the same SQLite transaction that
writes `review_state`. If the append fails, the database write rolls back, so a decision never
exists in the database without also being in the log. The reverse can happen in one rare case:
the append succeeds and then `COMMIT` fails. The log then holds a decision the database lacks, and
the log is the authority. Lines are never rewritten. `export` regenerates `review/review_state.jsonl`
from the database in verse order with fixed key order, so re-exporting unchanged state is
byte-identical.

## Schema changes (additive only)

- `review_state.decision TEXT` (`approved` | `rejected`), added behind a `PRAGMA table_info` guard.
- `adversary_flags` is created if missing, with exactly the adversary pass's contract:
  `(verse_id, claim_id, verdict, severity, note, model, created_at)`, primary key
  `(verse_id, claim_id, model)`.

Nothing else in staging.db is written. `ReviewStatus` is unchanged.

## Deviation: web-native components, not react-native-web

The build plan wants the claim row and entry layout shared with the mobile app through
react-native-web, so review sees exactly what readers see. That is not done yet.
`apps/mobile/src/components/Claims.tsx` and `Understand.tsx` depend on RN `Modal` (the "Why do we
say that?" sheet) and on `expo-font`-loaded families, and neither works cleanly in a plain Vite
page without pulling Expo's web toolchain into a local tool.

So `src/client/EntryView.tsx` is a web-native mirror built on the same `@yada/schema` types and
the same rules:

- groups: "What we can see" = text + context; "Where interpretation differs" = interpretation +
  debated; each sorted by `display_rank`
- first-screen caps of 3 and 2 (`FIRST_SCREEN_CAP` in `src/shared/api.ts`), marked inline
  where they fall
- a claim label of `category · evidence_strength` as tiny tracked uppercase; no cards and no
  colour per category
- prose containing Hebrew or Greek pins `dir="ltr"` (`src/client/Prose.tsx`, the web
  counterpart of `LTR_PROSE`)

The two can drift. The later refactor:

1. Move the pure parts, `groupClaims` and the caps, into `@yada/schema` or a small shared
   package, and have both apps import them. That is cheap and removes the rule-level drift.
2. Split the mobile claim row into a presentational `ClaimRow` (RN primitives only) and a
   container that owns the `Modal`. Take font loading out of the components and into the app
   shell.
3. Render that presentational row here through `react-native-web` (Vite alias
   `react-native` → `react-native-web`), keeping the review-only additions (evidence, positions,
   adversary notes, findings) as web wrappers around it.

## Fonts

`public/fonts` holds copies of `apps/mobile/assets/fonts`: Literata (scripture), Gentium Plus
(Greek) and Noto Serif Hebrew, each with its OFL licence file. The UI uses the system font.
