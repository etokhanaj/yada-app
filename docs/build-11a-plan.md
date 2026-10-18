# 11a Pray safety: the steps

John approved the Build 11 canvas on 18 Oct 2026 and said to start with 11a once he has made the CloudKit key. Nothing
is built until then. Rules: CLAUDE.md (keys only in `.env.local`, never printed or committed).

## The key: already made (17 Oct 2026)

`.env.local` already holds `CLOUDKIT_KEY_ID`, `CLOUDKIT_KEY_PATH` (a file named `yada-cloudkit-key.pem`, outside the repo),
`CLOUDKIT_CONTAINER` and `CLOUDKIT_ENVIRONMENT` (`development`). TestFlight's reports are in **production**, so the
Reports queue reads production whatever `CLOUDKIT_ENVIRONMENT` says. A second key pair made by mistake on 18 Oct
(`cloudkit-s2s.pem`) was never registered with Apple.

Still John's: CloudKit Console → Schema → Production lists `PrayerRequest`, `Prayed` and `Report` (Deploy Schema
Changes if not).

## Built (18 Oct 2026, branch claude/build-11a)

| Step | What | Where |
|---|---|---|
| 1 | CloudKit Web Services, signed with the server-to-server key (ECDSA P-256 over date:body hash:subpath); only the CloudKit lines of `.env.local` are read, into the review server's process | `packages/review/src/server/cloudkit.ts` |
| 2 | The **Reports** queue: each reported public request once, its report count and reasons, newest report first | `packages/review/src/server/reports.ts`, `src/client/ReportsView.tsx`, a Reports tab |
| 3 | **Keep** deletes the request's reports, so the app's three-report filter shows it again. **Remove** sets `hidden` = 1, which the app's query already excludes (`YadaPrayModule.swift` `open`). No schema change and no app change | `reports.ts` |
| 4 | The log (`review/reports.jsonl`) keeps record names and decisions, never a request's words | `reports.ts` |
| 5 | Tests: signing verified with the public key, the key never sent, a refused record throws and logs nothing, Keep, Remove, the queue's order, the HTTP route | `cloudkit.test.ts`, `reports.test.ts`, `http.test.ts` |

Tested live against **Development**: created two requests with three reports each, the queue listed both, Keep
cleared one's reports, Remove hid the other, the log had two lines and no request text, then every test record was
deleted.

## Still John's: a Production key

The key made on 17 Oct is a **Development** key; Production refused it (AUTHENTICATION_FAILED). A server-to-server key
belongs to one environment. Until there is a Production key the queue says "No Production server-to-server key yet".

1. Print the public half of the key you already have (the path is `CLOUDKIT_KEY_PATH` in `.env.local`):
   `openssl ec -in <that path> -pubout`
2. CloudKit Console → iCloud.studio.yada.reader → switch to **Production** → Tokens & Keys → Server-to-Server Keys
   → Add; paste it; copy the Key ID.
3. Add `CLOUDKIT_PRODUCTION_KEY_ID=<key ID>` to `.env.local`.

Run the tool with `pnpm --filter @yada/review start` and open Reports.
