# Ask for prayer: what works today, and the gap

John, 18 Oct 2026. Plan only; nothing built. Read from the code on `origin/master` (Build 9) and the 10a branch.

## Does asking for prayer work on Build 10?

**Not on TestFlight build 9. It does on the Build 10 branch.** On build 9, Ask for prayer opened as a full page inside a
form sheet whose scroll view collapsed: only the back pill showed and a request could not be typed (found in the 18 Oct
design QA). The Build 10 branch `claude/loving-cori-d57938` fixes it in 037ff10 and 3a4a96d: Ask now draws as a sheet
(PR-10), with the first-name pill, "Live for 7 days", and the count and Post on a bar over the keyboard. The circle's
iCloud sheet had the same fault and the same fix. So asking works once Build 10 ships, if the schema is in Production
(below). I have not seen it on a device.

What is built (`apps/mobile/src/app/pray/`):
- **Pray** opens from its card on Today: your private list, then For each other, then Circles (PR-07, CI-01).
- **Ask for prayer** (PR-10): the words, 280 at most, an optional first name, Post. A request that mentions self-harm
  shows the region's helpline first (PR-12). Signed out of iCloud, one line and Open Settings (XT-05).
- **Your requests** (PR-11): how many prayed, seen only by you, never "0 prayed"; Mark answered, Renew, Delete. A
  request lives 7 days.
- **Pray for someone** (PR-09, XT-03): one request at a time; hold about 20 s or use a timer; Report and Block.
- **Circles** (CI-01–03, commit 1b3d129): name a circle, invite up to 12, Ask this circle, how many prayed but never
  who, Report and Block, Leave or Delete. Text is in CloudKit's encrypted fields.

**What can stop it:** TestFlight uses CloudKit's Production environment. The schema
(`apps/mobile/cloudkit/schema.ckdb`) had to be deployed to Production, and nothing in the repo records that it was.
If it wasn't, Post fails and Pray for someone stays empty. John, check once in CloudKit Console
(iCloud.studio.yada.reader → Schema → Production has `PrayerRequest`), or on Build 9: ask, then open Your requests.

The rest of Pray and Circles is rebuilt in Build 11 from `docs/build-11-pray-and-circles.md` (on the Build 10 branch):
John found Circles explain nothing to the person joining.

## The gap: Pray v2, never built

The build 8 plan's three Pray v2 pieces are not in the code (no CloudKit subscriptions, no push entitlement, nothing
in `packages/review`).

| # | Piece | Plan | Needs John |
|---|---|---|---|
| 1 | **Reports queue** in the review tool | A queue beside Readers differ: reported public requests, the reason, Keep or Remove. Reads and deletes through CloudKit's server-to-server API from `packages/review`; the key is read from `.env.local` for that process only. Three reports already hide a public request until John looks. Circle requests live in members' private iCloud, which a server key cannot read, so two reports hiding one from the circle (built) stays the only moderation there; the build 8 plan's "reports reach John" cannot hold for circles. | create the server-to-server key in CloudKit Console |
| 2 | **"A prayer you prayed for was answered"** | When you pray, the app subscribes to that request; Mark answered fires a silent push, and the app shows one local notification with no prayer text. One per request, then the subscription is removed. Off in Settings with the other notifications. | push (`aps-environment`) on the App ID; a design sign-off |
| 3 | **Pray again** | After "Prayed", one quiet "Pray again tomorrow" link; a local notification next morning with no text, opening that request. Never more than one a day. | design sign-off |

Order: 1, then 3 (local only, cheap), then 2 (needs a native build with push). Each push of code waits for John's yes.

**Frames to draft before 2 and 3** (none exist; `/design`, Light, Dark, AX5, Mobbin first):
- PA-01: PR-09's prayed state with "Pray again tomorrow".
- PA-02: the two notifications on the Lock Screen, no prayer text.
- PA-03: the Notifications rows in Settings with the two new switches.

The Reports queue is a page in the review tool, not the app, so it follows that tool's existing queue layout and needs
no canvas frame.
