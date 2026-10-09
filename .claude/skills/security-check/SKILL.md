---
name: security-check
description: Check Yada changes for leaked secrets, unsafe spending paths, and content that could ship unreviewed. Use before any commit that touches config, before a TestFlight upload, and before a PR.
---

# Security check (Yada)

Yada has no backend, accounts or auth. Its risks are secrets, money, and shipping the wrong
content. Check each and report pass/fail with evidence.

## Secrets
- `git diff --cached --name-only` and `git ls-files`: no `.env*` except `.env.example`, no `.p8`.
- Scan staged diff and history for `sk-ant-`, R2 secrets, `BEGIN PRIVATE KEY`:
  `git log --all -p | grep -cE "sk-ant-|BEGIN PRIVATE KEY"` must be 0.
- Keys read only from `.env.local` into one command's environment; never echoed or logged.
- Nothing in `apps/mobile` contains a key: the app never calls an API.

## Spending
- Every model or storage call goes through `budget.ts` / a `--confirm` gate with a ceiling.
- No code path loops on API calls without the ceiling check before each request.

## Shipping
- `publish` refuses `unreviewed-dev` bundles and sha mismatches.
- Release builds show the "Draft · not yet reviewed" label on any flagged entry.
- KJV/WEB/SBLGNT/TBESH/STEPBible encumbrances recorded in `sources.ts` are unchanged or
  deliberately updated.

## App
- No network calls except the bundle manifest and bundles. No analytics SDK.
- User data stays in `user.db` on device.

If a secret was ever committed, say so and that the key must be rotated — removing it is not enough.
