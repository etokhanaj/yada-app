---
name: add-tests
description: Add vitest tests to a Yada package following its patterns — temp SQLite databases, golden fixtures, the oracle, and fake API clients. Use for any new logic or bug fix.
---

# Add tests (Yada)

Vitest in every package (`pnpm --filter <pkg> test`). Pipeline tests run serially because some
read the real `content/staging.db`.

## Patterns
- **Regression first:** a bug fix gets a test that fails on the old code and names the incident
  in a comment (e.g. the Ps 51 position collision, the `scriptFor` four-book set).
- **Source-dependent tests** use `describeIfIngested` and skip when `content/raw` is absent — CI
  has none. Never let a skipped suite's body run work at collection time.
- **Databases:** temp dirs with `mkdtempSync`, `DDL` from `db.ts`, seeded from `golden/*.json`.
  Never write to the real staging.db in a test.
- **Paid or remote calls:** inject a fake client. A client that throws if `stream()` is reached
  proves a gate held; a passing test that never reached the gate proves nothing.
- **Unicode:** compare Hebrew as consonants (`normalizeHebrew`) and Greek with `normalizeGreek`;
  typed literals can order combining marks differently.
- **Mobile:** pure logic (selection, ranges, diffing, search parsing) in plain TS modules with
  tests; screens are verified on the simulator.

## Done
`pnpm -r typecheck` and `pnpm -r test` green; report the new test count.
