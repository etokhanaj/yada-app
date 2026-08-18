# Derive findings — what the oracle caught

Date: 17 Aug 2026. Schema at `1.3.0`. Seven fixtures, `yada oracle` reproducing 7/7.

The oracle compares derived output against the hand-authored fixtures in `golden/`: same
surfaces, same morpheme decomposition, same Strong's numbers. On its first run it reproduced
**two of seven**. This records what the other five were, because in two cases the fixture was
wrong rather than the code, and that ratio is the reason the oracle exists.

## The five failures

| Fixture | Symptom | Verdict |
|---|---|---|
| `jhn.1.1`, `1co.14.34`, `rev.13.18` | No Strong's number derived for any Greek word | **Fixtures wrong** |
| `1co.14.34` | Derived `Αἱ`, fixture `αἱ` | **Fixture wrong** |
| `gen.1.1` | Derived morphemes, fixture had none | **Fixture stale** |
| `psa.23.1` | Derived 6 words against the fixture's 4 | **Derivation wrong** |
| `lev.19.18`, `isa.53.5` | — | Passed on the first run |

### The Greek Strong's numbers were invented

MorphGNT carries lemma and morphology and **no Strong's numbers at all**. The `G3588`,
`G1135`, `G1722` in the Greek fixtures were written from recall when those fixtures were
authored by hand.

This is precisely what the generation prompt forbids — *"explain the parsing you are given;
never recall parsing from memory"* — committed to the repository as ground truth, in the
files used to verify everything else. It is the most dangerous class of error in the project
because a wrong Strong's number is indistinguishable from a right one downstream, and it
survived exactly as long as nothing mechanical checked it.

The rule binds the pipeline as much as the prompt. Strong's numbers now come from **TBESG**,
mapped by lemma, and the fixtures were corrected to match.

### The Psalms superscription was the derivation's fault

The fixture held English verse 1 (four words); the derivation emitted the Masoretic verse 1,
which includes the superscription (six). Schema 1.2 had given superscriptions an address —
`TITLE_VERSE` — and TVTMS flagged which chapters carry one, but `normalize` had never acted
on either. See below.

## Versification: Hebrew and English diverge in three ways, not one

`CANONICAL_VERSIFICATION` is English. Resolving it is `normalize`'s job, once. The first
implementation handled one pattern and silently mis-numbered 63 psalms.

| Pattern | Example | Treatment |
|---|---|---|
| Title *inside* Hebrew verse 1, alongside English verse 1's text | Ps 23 | **Split** — title to verse 0, remainder to verse 1 |
| Title *is* Hebrew verse 1; everything after shifts by one | Ps 3 | **Renumber** — nothing is split |
| Shift crosses a chapter boundary | Hebrew Gen 32:1 = English Gen 31:55 | **Move** into the previous chapter |

All three fall out of one rule: an OSHB `<note>KJV:…</note>` gives the English reference for
the text that follows it. Track a running English position, let the notes reset it, advance it
across verse elements that carry no note.

Two traps worth keeping:

- **A note naming verse 1 does not imply a superscription.** Genesis 32 contains one, because
  Hebrew 32:1 is English 31:55 — and Genesis has no superscriptions. The title test is that
  the chapter's *first* note names verse 1.
- **Counters are not verification.** 116 psalms carry a verse-1 note; the first implementation
  produced 53 verse-0 rows and reported success. The check that mattered was reading Ps 3,
  Ps 23, Ps 51 and Gen 1 out of the database and against the English numbering.

Result: 116 verse-0 rows, matching the 116 verse-1 notes in the source exactly; 1,074 verses
renumbered; 10 moved across a chapter boundary.

`normalize` reports 120 rather than 116 because it counts title *segments* and four psalms
carry a title spanning two Hebrew verse elements — Ps 51, 52, 54 and 60 — which merge into a
single verse 0 each. Segments and verses are different quantities and the
report says segments; the figure to check against the source is the row count.

## Strong's numbers are zero-padded to four digits

The lexicons write `H0430` and `G0746`; OSHB writes `430`. The schema regex accepted both, so
two spellings of one number could coexist and joins would succeed for some words and silently
miss for others. Canonical form is now `G0746` / `H0430` / `H7462b`, produced by
`canonicalStrongs` and enforced by the schema. This is what the 1.3.0 bump is.

## Greek lemma matching: four disagreements between MorphGNT and TBESG

Direct lookup left 579 tokens (134 lemma forms) unmatched — including ἀποκρίνομαι, one of the
commonest verbs in the gospels. None of it was missing data:

| Cause | Example | Route |
|---|---|---|
| Polytonic oxia vs monotonic tonos | `λόγος` U+1F79 vs U+03CC | NFC on both sides |
| Several spellings in one cell | `Μωϋσῆς, Μωσῆς` | `variant` |
| Parenthesised optional ending | `οὕτω(ς)` vs `οὕτως` | `optional-segment` |
| Iota subscript | `ἀποθνῄσκω` vs `ἀποθνήσκω` | `iota-subscript` |
| Deponent vs active headword | `ἀποκρίνομαι` vs `ἀποκρίνω` | `deponent` |

The first four are spelling reconciliations and are safe. **The deponent route is a rule, not
an observation**, so it fires only after every other route misses and only on an unambiguous
match, and `normalize` reports its contribution separately (178 tokens) so it can be withdrawn.

Coverage in John went 98.1% → 99.4%. The remaining tail is genuine and is left alone:

- **Ambiguity, correctly refused.** `Βηθανία` is both G0962 and G0963 — Bethany beyond Jordan
  and Bethany near Jerusalem. No number is better than a coin toss between two real places.
- **Manuscript spelling variation.** `Ναζαρέτ` against TBESG's `Ναζαρέθ, Ναζαρά`.
- **Genuine gaps in TBESG.** `Ἠλίας`, `Ἠσαΐας`, `Λευίτης` — it is LSJ-based, and LSJ is thin on
  biblical proper names.

## The method, restated

Both of this session's worst bugs — invented Strong's numbers and 63 mis-numbered psalms —
were invisible in the output and produced confident, well-formed, wrong data. Both were caught
by mechanical comparison against something independent, and neither would have been caught by
reading the output and finding it plausible.

Diagnostics get the same treatment. One probe here searched a polytonic file with monotonic
search strings and returned "no such lemma" for words that were present — the same
normalisation bug, in the tool being used to investigate it.

**Assume the oracle is right and the fixture is suspect until you have checked which.**
