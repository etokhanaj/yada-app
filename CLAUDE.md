# Yada — rules for every session

Start from `docs/handoff-2026-09-13.md` for current state. Governing docs (frozen) are in
`~/Downloads/Yada/`. Node: `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`.

## Gates

- **Deslop before any upload or PR.** Run `/deslop` over the diff before a TestFlight upload,
  `git push` of a release, or `gh pr create`. Then `/review-code` and `/security-check`.
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

- Design decisions come from the Mobbin MCP, cited in a code comment. Use `/design` to
  draft before building screens.
- Typography carries hierarchy: no cards, no coloured category labels, no AI visual
  language, no "coming later", no skeleton loaders in reading.
- Accessibility is a requirement, not a pass: VoiceOver labels and order, Dynamic Type to
  AX5, contrast in both themes, reduce-motion respected, 44pt targets.
- Every word on screen earns its place. Cut subtitles, helper text and labels that restate
  what the layout already says.

## Skills in this repo

`deslop`, `fix-types`, `review-code`, `security-check`, `ai-prompt`, `add-tests`.
