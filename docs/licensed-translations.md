# Licensed translations via API.Bible

Set up 10 Oct 2026. Key and base URL in `.env.local` (`API_BIBLE_KEY`, `API_BIBLE_URL`); never print,
log or commit them. Plan: **Starter (free, non-commercial)**, three copyrighted Bibles.

| Code | Name | API.Bible id | Rights holder |
|---|---|---|---|
| NKJV | New King James Version | `63097d2a0a2f7db3-01` | Thomas Nelson |
| NLT | New Living Translation | `d6e14a625393b4da-01` | Tyndale House Foundation |
| MSG | The Message | `6f11a7de016f942e-01` | NavPress (represented by Tyndale House) |

**NIV removed from the account, 12 Oct 2026.** John swapped NIV (New International Version 2011,
`78a9f6124f344018-01`, Biblica, Inc.) for MSG. Biblica's express licence through api.bible excludes
products with AI/ML features, and Yada's explanations are AI-generated (never from the NIV), so Yada
could not use it on these terms. The id stays mapped in the proxy and the app, outside the served set.
Switching NIV back needs a direct licence from Biblica first, then the version re-added on the API.Bible
account, then `SERVED`.

Not available on this account: ESV (Crossway runs its own API, api.esv.org: free non-commercial, at most
500 verses stored, so effectively online-only) and CSB.

## Terms that bind the build (read from https://api.bible/terms-and-conditions, 10 Oct 2026)

- **Non-commercial only (§9.3).** No ads, in-app purchases, freemium, subscriptions, paid access or
  fundraising while on Starter. Any of those requires the Pro plan first.
- **Never alter the text (§4.1).**
- **No generative-AI training on the content (§9.2).** Yada's rule, stricter: licensed texts never enter
  the content pipeline at all: not prompts, not grounding, not adversary or regression inputs. They are
  display-only in the app. Explanations stay built from Greek, Hebrew, BSB, WEB, KJV and LSV.
- **Offline cache (§11):** allowed; refresh at least every 30 days; delete within 24 hours on request or at
  termination (§18.8: they may terminate at any time).
- **Attribution (§7):** a copyright page listing each translation's full notice (the API returns it with
  every passage), plus the abbreviation after quoted text.
- **FUMS (§14):** stated for web apps; confirm with support@api.bible whether a native iOS app must report.

## Tester builds: through Yada's proxy (12 Oct 2026)

**Scope:** NKJV, NLT and MSG (MSG from 12 Oct 2026). NIV is not served and is off the account (above).
The served set is a server-side allowlist, so a version is switched on or off with a Worker deploy and
no app update.

**The proxy** is a Cloudflare Worker, `services/licensed-proxy` (`@yada/licensed-proxy`). It holds
`API_BIBLE_KEY` as a Worker secret and exposes one route and nothing else:

    GET /v1/chapter/{translation}/{BOOK}.{chapter}     e.g. /v1/chapter/NKJV/JHN.3

- It serves only the codes in the `SERVED` var (`wrangler.toml`: `"NKJV,NLT,MSG"`). Anything else is 404
  `{"error":"not-served","served":[…]}`, and API.Bible is not called. Book codes and chapter numbers are
  checked against `@yada/schema`'s book table before any upstream call; a query string is refused.
- It asks API.Bible for `content-type=text` (the request the dev path makes) and returns
  `{ translation, chapter, content, copyright }`, with `content` and `copyright` exactly as API.Bible
  sent them (§4.1, §7). Nothing else from the upstream body is forwarded (no FUMS ids, no metadata), and
  an upstream error body is never forwarded either.
- **One shared copy (John, 18 Oct 2026):** each chapter read is kept once in the private R2 bucket
  `yada-licensed-cache`, Bible text only, and served to every reader for 30 days after API.Bible sent it;
  a daily cron deletes expired copies and any version no longer in `SERVED`. The response carries
  `fetchedAt`, and the app counts its own 30 days from it. `Cache-Control: private, max-age=<seconds left>`;
  errors are `no-store`. Nothing about what anyone reads is stored. Plan and stress test: `docs/licensed-online-plan.md`.
- **App Attest (John, 18 Nov 2026, before the source went public):** the proxy serves only genuine Yada on
  a real Apple device (`src/attest/`, `modules/yada-attest`, `src/data/attest.ts`). Each install proves a
  random Secure Enclave key once with Apple's attestation; every GET then carries an assertion over its
  path in `Yada-Key-Id` and `Yada-Assertion`. One Durable Object per key keeps its public key and a
  counter, nothing else: no account, no device name, nothing read. `ATTEST_REQUIRED = "off"` until a build
  that attests is the one testers have; then set it `"on"` and deploy, and older builds fall back to the
  BSB. The simulator has no App Attest, so simulator QA of licensed text needs `wrangler dev` with it off.
  The App ID `studio.yada.reader` needs the App Attest capability before the next archive.
- **Call budget:** every API.Bible call goes through one Durable Object (`src/gate.ts`), which fetches a
  chapter once however many readers ask together, and counts calls per plan month (`PLAN_MONTH_DAY`).
  Reading stops at 4,900 calls; search has its own 800. Past either, the route answers 503
  `{"error":"budget"}` and the app says the chapter "isn't available until next month" or searches the BSB.
- Every response carries `Yada-Served: NKJV,NLT,MSG`. The app keeps the last set it heard in `user.db`
  (`licensed_served`) and offers only those in the Online group; before it has heard anything it assumes
  NKJV, NLT and MSG (`DEFAULT_SERVED`). A code added to `SERVED` appears in the app after the next chapter response;
  removing a version hides it and deletes its cached chapters at the next launch (§18.8).
- **Rate limit:** 60 requests a minute per client, on Cloudflare's rate-limit binding, keyed on a
  SHA-256 of the client IP (never the IP itself). Over the limit: 429 with `Retry-After: 60`. Counters
  are per Cloudflare location and approximate, which is enough to protect the key.
- **No logs.** The Worker has no `console` calls (a test enforces it), and `wrangler.toml` turns off
  Workers Logs and invocation logs (`[observability] enabled = false`), which Cloudflare otherwise turns
  on by default for new Workers (kept 3 days on Free, 7 on Paid).

**What Cloudflare itself records by default** (developers.cloudflare.com, read 12 Oct 2026; check the
dashboard after the first deploy):
- **Workers Logs:** off here, as above. No Logpush, Tail Worker or analytics binding is configured.
- **Real-time logs (`wrangler tail`, dashboard "Live"):** not stored. They stream only while someone is
  attached, and show each request's URL, method, headers and `cf` object. John should not leave a tail
  running.
- **Workers metrics:** aggregate request, error, CPU and duration counts per Worker. No per-request
  records.
- **Cloudflare's network** sees the client IP to deliver every request (as it does for R2 downloads
  today) and may record it in its security systems if a DDoS or WAF rule fires. That is Cloudflare acting
  as Yada's host, under its own privacy policy; Yada never receives or stores it.

**In the app:** release builds read through the proxy URL, baked in at build time from
`EXPO_PUBLIC_LICENSED_PROXY_URL` into `extra.licensedProxy.url` (`app.config.ts`). It is a URL, not a
secret. `app.config.ts` refuses one that is not https (plain http only for `localhost` outside Release,
for `wrangler dev`), that carries credentials, a query or a fragment, or that is API.Bible itself. The
request carries the translation, book and chapter in the path, an `Accept` header and, from the build after
12, its App Attest proof (a random per-install key id and a signature), nothing about the reader. Unset, the build offers no licensed versions, as before.

Unchanged: the 30-day cache and its launch-time deletion, the Online group, the needs-connection line,
the verbatim notice under each chapter, never read aloud (`canSpeak`), never in AI
(`packages/pipeline/src/ai-boundary.test.ts` now also holds the proxy and its client out of every module
that talks to a model).

**System surfaces and Writing Tools (rule 9 policy, 12 Oct 2026):**
- Siri, Spotlight, App Intents, on-screen entity data, widgets and Live Activities carry only references
  and BSB, WEB, KJV or LSV text: `src/lib/systemSurfaces.ts` `maySurfaceText()` is the gate for each one
  when it is built. None exists yet. Now Playing shows a reference only, and licensed text is never
  spoken, so it never gets there. `src/lib/licensedSurfaces.test.ts` fails if any module beyond the
  reader, the launch and `user.db` imports the licensed client.
- **Writing Tools:** React Native 0.86 has no per-view switch (no `writingToolsBehavior` or similar on
  `Text` or `TextInput`; the test checks RN's sources so an added one is noticed). iOS offers Writing Tools
  only on selectable or editable text, and React Native `Text` is not selectable unless `selectable` is
  set. The reader, `Verse` and `Type` never set it (the same test enforces it), so licensed text is not
  selectable and Writing Tools cannot reach it. A native wrapper setting `UITextView.writingToolsBehavior
  = .none` would be the route if licensed text ever has to be selectable. The verse Copy and Share actions
  remain: they are the reader's own act, like quoting from a printed page.

### Deploying the proxy (John)

From `services/licensed-proxy`, with Node on PATH. Nothing here prints the key.

1. `npx wrangler login` (opens the browser; choose the Cloudflare account that holds R2). If the account
   has several, put its id in `account_id` in `wrangler.toml`.
2. `npx wrangler secret put API_BIBLE_KEY`, and paste the key at the prompt. It is stored encrypted on
   Cloudflare and never appears in `wrangler.toml`, the repo or a build. To pipe it from `.env.local`
   without showing it: `grep -m1 '^API_BIBLE_KEY=' ../../.env.local | cut -d= -f2- | npx wrangler secret put API_BIBLE_KEY`
   (then check `npx wrangler secret list` names it; the value is never shown).
3. Once, for the shared copy: `npx wrangler r2 bucket create yada-licensed-cache` (leave public access
   off: a public bucket would mirror the API, §8(e)). Check `PLAN_MONTH_DAY` in `wrangler.toml` against the
   day the Starter plan took effect in the API.Bible dashboard.
   Then `npx wrangler deploy`. It prints the URL, `https://yada-licensed-proxy.<subdomain>.workers.dev`.
4. Check it: `curl -sI https://yada-licensed-proxy.<subdomain>.workers.dev/v1/chapter/NKJV/JHN.3` shows
   200, `Cache-Control: private, max-age=…` and `Yada-Served: NKJV,NLT,MSG`; `/v1/chapter/NIV/JHN.3`
   is 404. In the dashboard, Workers → yada-licensed-proxy → Settings → Observability shows logs off.
5. Build for TestFlight with the URL in the environment:
   `EXPO_PUBLIC_LICENSED_PROXY_URL=https://yada-licensed-proxy.<subdomain>.workers.dev apps/mobile/scripts/release-ios.sh`.
   The script prints which URL the build carries.
6. Before external testers: the privacy page line (draft in `docs/outreach/privacy-licensed-proxy.md`).

To serve a version the account holds: add it to `SERVED` in `wrangler.toml` and `npx wrangler deploy`.
After changing `SERVED` (as on 12 Oct 2026, adding MSG), the deployed Worker serves the old set until
that deploy is run.
To stop serving everything at once (termination, §18.8): `SERVED = ""` and deploy; each app deletes its
cached chapters at its next launch after it hears the new set.

Local run: `npx wrangler dev` with a gitignored `services/licensed-proxy/.dev.vars` holding
`API_BIBLE_KEY=…`, then a dev build with `EXPO_PUBLIC_LICENSED_PROXY_URL=http://localhost:8787`.

## In the app (dev flag only)

`apps/mobile/app.config.ts` puts `extra.apiBible = { url, key, enabled }` into the build from
`API_BIBLE_URL`, `API_BIBLE_KEY` and `YADA_DEV_LICENSED=1`; without the flag the key is not read and the
build carries an empty one. Expo does not load the repo-root `.env.local`, so a dev build reads the two
values into that one command's environment (rule 1), with the flag set.

**Expo does load `apps/mobile/.env*` at build time.** expo-constants' Xcode build phase evaluates
`app.config.ts` during `xcodebuild archive`, with the shell's inherited environment, after `@expo/env`
has loaded `apps/mobile/.env`, `.env.local` and `.env.production` (and its node wrapper sources
`ios/.xcode.env` and `.xcode.env.local`). Never put the three names in any of those files.

**Expo `extra` is embedded in the app binary.** Anyone holding a build made with the flag can extract
the key. Flagged builds are for John's internal dev testing only: never TestFlight, never the App Store.
Tester builds use the proxy above instead. The dev path offers what the account holds (`ON_ACCOUNT` in
`licensed.ts`: NKJV, NLT, MSG), not NIV.

Release guards (code review, 10 Oct 2026, which found a release build could carry the key):
- `scripts/release-ios.sh` refuses to run when `YADA_DEV_LICENSED`, `API_BIBLE_KEY` or `API_BIBLE_URL`
  is non-empty in the environment, or defined in `apps/mobile/.env*` or `ios/.xcode.env*` (names only
  are checked and reported, never values; `scripts/licensed-guard.sh`).
- The archive step runs under `env -u` for all three.
- After the archive it checks `Yada.app/EXConstants.bundle/app.config`: `extra.apiBible.enabled` must
  not be true and `key` must be empty, or it stops before export. It fails closed if the file is missing.
- 12 Oct 2026, with the proxy: any name containing `API_BIBLE` (an `EXPO_PUBLIC_API_BIBLE_KEY` would be
  inlined into the JS) is refused like the three above, while `EXPO_PUBLIC_LICENSED_PROXY_URL` is allowed.
  The archived `licensedProxy.url`, if any, must be https with no credentials or query and not API.Bible.
  Then the key's value from `.env.local` (this checkout's and the main checkout's) is searched for in the
  whole `.app`; the script stops if it is found. The value stays inside the guard function and reaches
  `grep` on a pipe, never on its command line, and is never printed.
- `app.config.ts` throws when the flag is set and Xcode's `CONFIGURATION` is `Release` (Xcode sets it for
  every script phase, which is where expo-constants evaluates the config).
- In the app, the keyed API.Bible path in `licensedConfig()` is taken only when `__DEV__`, so a release
  build never calls API.Bible, whatever its config carries; it reads through the proxy or not at all.
- Each launch deletes cached chapters 30 days old or more, and the whole cache when licensed text is not
  enabled (§11, §18.8).

Code: `src/data/licensed.ts` (fetch, parse, cache in `user.db` table `licensed_chapters`, typed
`needs-connection` result), `src/data/useLicensedChapter.ts` (flag accessor, hook). Book ids: API.Bible
uses USFM ids, the same codes as `@yada/schema`, so `JHN.3`, `1CO.13`, `SNG.2` go through unchanged.
Verses are sliced at the `[n]` markers of `content-type=text`; only whitespace at a verse's ends is
dropped, line breaks inside it (NLT poetry) are kept. A cached chapter older than 30 days is deleted and
refetched, never shown, even offline. A bridged verse (`[1-2]`) is one reader row numbered "1–2";
selecting it selects its first verse.

## Confirmed 18 Oct 2026 (api.bible terms dated 3 Sep 2026)

- Starter: **5,000 calls a month**, no rollover; overage is off by default, so going over stops calls.
- **NKJV only while Yada has 5,000 or fewer monthly end users**, and only if the end-user range chosen in
  the dashboard is at most 5,000. John checks monthly active devices in App Store Connect (decided 18 Oct
  2026: no tracking added). NLT and MSG carry no user cap in API.Bible's terms; each version's own licence
  in the dashboard may add terms, as Biblica's did for NIV.
- **No audio from licensed text:** "Text may not be used to create audio content." Text-to-speech is
  allowed only for public-domain texts and American Bible Society's GNT and CEV.
- Starter apps must show a **visible citation and link to https://api.bible**: the Read online row on
  Sources opens it.

## Open
- Confirm FUMS for native apps.
- Before any monetisation: Pro plan or direct publisher licences (HarperCollins/Thomas Nelson,
  Tyndale, and NavPress through Tyndale for MSG), and Crossway for ESV. NIV needs Biblica's in any case.
