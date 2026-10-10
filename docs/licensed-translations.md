# Licensed translations via API.Bible

Set up 10 Oct 2026. Key and base URL in `.env.local` (`API_BIBLE_KEY`, `API_BIBLE_URL`); never print,
log or commit them. Plan: **Starter (free, non-commercial)**, three copyrighted Bibles.

| Code | Name | API.Bible id | Rights holder |
|---|---|---|---|
| NIV | New International Version 2011 | `78a9f6124f344018-01` | Biblica, Inc. |
| NKJV | New King James Version | `63097d2a0a2f7db3-01` | Thomas Nelson |
| NLT | New Living Translation | `d6e14a625393b4da-01` | Tyndale House Foundation |

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
Shipping licensed text needs a proxy that holds the key server-side.

Release guards (code review, 10 Oct 2026, which found a release build could carry the key):
- `scripts/release-ios.sh` refuses to run when `YADA_DEV_LICENSED`, `API_BIBLE_KEY` or `API_BIBLE_URL`
  is non-empty in the environment, or defined in `apps/mobile/.env*` or `ios/.xcode.env*` (names only
  are checked and reported, never values; `scripts/licensed-guard.sh`).
- The archive step runs under `env -u` for all three.
- After the archive it checks `Yada.app/EXConstants.bundle/app.config`: `extra.apiBible.enabled` must
  not be true and `key` must be empty, or it stops before export. It fails closed if the file is missing.
- `app.config.ts` throws when the flag is set and Xcode's `CONFIGURATION` is `Release` (Xcode sets it for
  every script phase, which is where expo-constants evaluates the config).
- In the app, `licensedEnabled()` and `licensedConfig()` are off unless `__DEV__`, so a release build
  never shows the Online group or calls API.Bible, whatever its config carries.
- Each launch deletes cached chapters 30 days old or more, and the whole cache when licensed text is not
  enabled (§11, §18.8).

Code: `src/data/licensed.ts` (fetch, parse, cache in `user.db` table `licensed_chapters`, typed
`needs-connection` result), `src/data/useLicensedChapter.ts` (flag accessor, hook). Book ids: API.Bible
uses USFM ids, the same codes as `@yada/schema`, so `JHN.3`, `1CO.13`, `SNG.2` go through unchanged.
Verses are sliced at the `[n]` markers of `content-type=text`; only whitespace at a verse's ends is
dropped, line breaks inside it (NLT poetry) are kept. A cached chapter older than 30 days is deleted and
refetched, never shown, even offline. A bridged verse (`[1-2]`) is one reader row numbered "1–2";
selecting it selects its first verse.

## Open
- Confirm FUMS for native apps.
- Before any monetisation: Pro plan or direct publisher licences (Biblica, HarperCollins/Thomas Nelson,
  Tyndale), and Crossway for ESV.
