# Yada — rules for every session

Start from `docs/handoff-2026-09-13.md` for current state. Governing docs (frozen) are in
`~/Downloads/Yada/`. Node: `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Gates

- **Deslop before any upload or PR.** Run `/deslop` over the diff before a TestFlight upload,
  `git push` of a release, or `gh pr create`. Then `/review-code` and `/security-check`.
- **QA against the plan and the frames before any upload or PR** (from Build 10 on; John, 18 Oct 2026, after
  build 7's planned screens were left unbuilt through builds 8 and 9 without anyone saying so). List every item in
  that build's plan and every canvas frame assigned to it, and mark each one built, or moved with John's yes and
  where to. Then check each built screen against its frame in Light, Dark and AX5 (layout, copy, states,
  VoiceOver order). Put the list in the PR or upload notes. Anything not built and not moved blocks the upload.
- **Design system pass before any upload or PR** (from Build 10 on; John, 18 Oct 2026). Compare what the diff adds
  with what already exists in `apps/mobile/src/design/` and `apps/mobile/src/components/`. A new screen uses
  the existing tokens, type steps and components (`PageScreen`, `ListRow`, `Prose`, `Chrome`). It has no literal
  colours, sizes or one-off buttons when a token or component already covers them. Each new token or component
  says why in a comment and is used in more than one place, or is folded back into an existing one. Tokens and
  components the build leaves unused are removed. Note the additions and removals in the PR or upload notes.
- **No polling** (John, 18 Oct 2026). Never ask a server or a store for changes on a timer. Subscribe: CloudKit
  subscriptions and pushes, Zustand `subscribe`, AppState and focus events. A timer is allowed only for a countdown
  on screen, and it stops when that screen closes.
- **Replace, don't layer** (John, 18 Oct 2026). A changed feature replaces the old one in the same commit: no
  "v2" beside a v1, no fallback to the old path, no compatibility shim for code nobody calls. The one exception is
  data already on readers' phones or in their iCloud: read it once through a tested migration, then delete the old
  reader in a later build. A product fallback the design calls for (BSB where a licensed text can't load) is not
  this.
- Ask John before `git push` and before `gh pr create`. Commit locally freely.
- `pnpm -r typecheck` and `pnpm -r test` green before any commit that touches code.

## Non-negotiables (each one earned by a real incident)

1. Keys live only in the gitignored `.env.local` (and `~/.appstoreconnect/private_keys/`).
   Read them into a single command's environment; never print, log or commit them.
2. Never fabricate a review. Only John approves entries. Generated content is `flagged`.
3. Read licences from the source file, never from a repo badge.
4. Never state a parse or Strong's number the source data does not contain.
5. Assume the oracle is right and the fixture suspect until checked.
6. `unreviewed-dev` bundles are for local builds only; `publish` refuses them.
7. Never trust an exit code that came through a pipe.
8. Comments explain *why*, citing the incident or rule.
9. Licensed translations (NIV, NKJV, NLT via API.Bible; any future ESV, CSB) are display-only. They
   never enter the content pipeline or any AI call: not prompts, grounding, adversary, regression or
   evaluation. API.Bible §9.2 forbids AI training on its content; Yada's rule is stricter. Explanations
   are built only from the Greek, Hebrew, BSB, WEB, KJV and LSV. See `docs/licensed-translations.md`.

## Design

- The design system is `docs/design-system.md`: which component, type step and colour for what. Its rules are
  tested (`apps/mobile/src/design/system.test.ts`); read it before building or changing a screen.
- Design decisions come from the Mobbin MCP, cited in a code comment. Use `/design` to
  draft before building screens.
- Typography carries hierarchy: no coloured category labels, no AI visual language, no
  "coming later", no skeleton loaders in reading.
- Cards only as John allowed them (15 Oct 2026, `docs/redesign/polish-2026-10-15.md`): one
  card per self-contained thing you tap (the day's picture, the reading to do now, a plan),
  never a box around text or a list, never nested, one 24 pt radius, a soft fill, no shadow.
- Accessibility is a requirement, not a pass: VoiceOver labels and order, Dynamic Type to
  AX5, contrast in both themes, reduce-motion respected, 44pt targets.
- Every word on screen earns its place. Cut subtitles, helper text and labels that restate
  what the layout already says.

## Skills in this repo

`deslop`, `fix-types`, `review-code`, `security-check`, `ai-prompt`, `add-tests`.
