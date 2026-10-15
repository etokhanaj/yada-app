# Build 6: book introductions and grammar terms (items G and H)

Built 15 Oct 2026 on `build-6-intros-grammar`. Canvas: frames IG-01–05, "Build 6" page,
https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc.

## G. Book introductions

- **Source:** the unfoldingWord Translation Notes (CC BY-SA 4.0, already pinned). The text comes from the front:intro
  note's "What is/are … about?" section ("What is the book of Psalms?" for Psalms).
- **Rule:** `packages/pipeline/src/understand/intro.ts`.
  - Take the section's first paragraph, cleaned with `md()`, with empty "( )" and ULT braces removed.
  - Keep whole sentences in order, up to 60 words.
  - Stop before any sentence that contains "translat", "ULT", "UST" or "you".
  - Drop a last sentence that only announces a list (HEB).
  - A book gets nothing when the section is missing or its first sentence alone is over 60 words.
- **Result:** 65 of 66 books. Genesis has no such section, so Genesis shows nothing. Every result is in
  `reports/book-intros-dry-run.txt`.
- **Read weakly, with a note for John in the review queue:**
  - 1CO and ROM say why Paul wrote, not what the letter says.
  - 2KI keeps the source's typo ("2 Kings of continues").
  - ECC has two sentences that run together where the source has no full stop after "(1:3)".
- **Review (rule 2):** `packages/pipeline/prototypes/data/book_intros.json`. Every entry starts as `draft`, and John
  approves or rejects each one in the review tool's **Extracts** queue (`#/extracts`).
- **Data:** each Understand bundle gets a new meta key, `book_intro`, holding JSON `{text, source: "tn", credit, status}`.
  - `status` is `approved` only when John approved that exact text; otherwise it is `flagged`.
  - Apps from before build 6 read only `format` and `book`, so `UNDERSTAND_FORMAT` stays 1.
- **App:** `components/BookIntro.tsx`, inserted once at the top of chapter 1 in the reader. It shows nothing unless the
  status is `approved` (`lib/bookIntro.ts`).

## H. Grammar terms in plain words

- **Sources:** the unfoldingWord Hebrew, Greek and Aramaic Grammars (`en_uhg`, `en_ugg`, `en_uag`), each CC BY-SA 4.0.
  - Each licence is read from the repo's own LICENSE.md on every run (rule 3).
  - Each repo is pinned to a commit, with the archive's sha256, in `packages/pipeline/src/grammar.ts` and
    `sources.manifest.json`.
  - The archives are kept in `content/raw/uw-grammar/`.
  - STEPBible morphology is never used.
- **Terms:** `morphTerms()` in `packages/schema/src/morph.ts` returns the same words `morphLine` prints.
  - Greek: tense, voice, mood, case and degree.
  - Hebrew and Aramaic: stem, conjugation and state, plus dual, common and both genders, suffixes and the object marker.
  - Greek "imperfect" and Hebrew "imperfect" are separate entries (`greek:imperfect`, `hebrew:imperfect`).
- **Rule:** each entry is the first sentence of the article's Summary, or of its Glossary where there is no Summary,
  word for word with the markup removed.
  - Result: 92 entries and 8 terms with nothing.
  - The Aramaic article for "determined" is a copy of the one for the absolute state, so "determined" shows nothing.
  - Rare stems with no article of their own also show nothing.
  - `en_ugg`'s optative article is marked "UNDER CONSTRUCTION" in the source, and its entry says so.
- **Review (rule 2):** `packages/pipeline/prototypes/data/grammar.json`, with the paragraph each sentence was cut from.
  It goes through the same Extracts queue.
- **Where the table ships:** the app bundle, in `apps/mobile/src/data/grammar.generated.ts`, written by
  `yada grammar --write`.
  - It holds approved entries only, so nothing unreviewed is in the binary.
  - At about 92 sentences it is too small to justify a download, and putting it in core would make every approval wait
    for a core rebuild.
  - After John approves entries, run `yada grammar --write` again and commit the regenerated file.
- **App:** `components/GrammarTerms.tsx`, under Form on the word screen. Each term is a row that opens its one sentence
  and credit in place.
- **Licence:** the credit says "adapted … (shortened to its first sentence) · CC BY-SA 4.0" and drops the ® mark.
  - Yada's table, `grammar.json`, is shared under CC BY-SA 4.0.
  - Sources lists the three grammars once core is packaged from the updated manifest.

## Commands

```bash
YADA_ROOT=/Users/johnetokhana/yada pnpm --filter @yada/pipeline exec tsx src/cli.ts intros            # dry run, 66 books
YADA_ROOT=/Users/johnetokhana/yada pnpm --filter @yada/pipeline exec tsx src/cli.ts intros --write    # refresh book_intros.json
YADA_ROOT=/Users/johnetokhana/yada pnpm --filter @yada/pipeline exec tsx src/cli.ts grammar --write   # refresh grammar.json + app table
```

## Still to do (pipeline session)

1. After John's approvals, run `yada understand <BOOK>` for each book so the bundles carry `book_intro`, then publish
   as usual.
2. Run `yada grammar --write` so the app ships the approved sentences.
3. Repackage core so Sources lists the three grammars.
