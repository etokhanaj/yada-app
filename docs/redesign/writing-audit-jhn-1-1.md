# Writing audit: John 1:1 entry (golden/jhn.1.1.json)

Judged with the writing-quality standard for a lay reader of a Bible app, against the house style in
`reports/Simple yet deep scripture explanations.md`. These are **proposals**: the entry is approved,
and accepting any change sends it back to John's review queue (CLAUDE.md rule 2). No fact is added;
every revision keeps the claim and its evidence.

Severity: **high** = meaning lost or a claim may overreach; **medium** = a clean pattern match the
reader can still decode; **low** = a revision note, not a failure.

## Findings

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, sentence 3 | "The third clause is where the Greek repays close attention, because of what it does and does not put the article on." | Figurative ("repays close attention") and compressed; points at grammar without saying what it means. A teaser, not an explanation. | medium | "In the third clause, the Greek has no 'the' before 'God', and readers disagree about what that means." |
| 2 | key_words[2] (πρός) | "With the accusative this preposition normally carries motion or orientation toward something, not static position beside it." | Jargon ("accusative"), and the claim may overreach: πρός + accusative often means plain "with" in this period. This is the "word fun-fact" failure the research warns about. | **high** | Send to the adversary and John. If the sense is kept: "Here πρός means 'with', in the sense of being toward someone." If not, drop the note. |
| 3 | key_words[1] (ἦν) | "Imperfect: continuous existing state rather than a point of origin. Verse 3 switches to the aorist ἐγένετο…" | Grammar labels a lay reader can't use; label-colon fragment. | medium | "'Was' describes something already going on, not something that began. Verse 3 uses a different verb for created things: they 'came into being'." |
| 4 | key_words[0] (λόγος) | "…It carried weight in both Greek philosophy and Jewish wisdom writing before John used it." | "Carried weight" is vague: what weight? | low | "…Greek philosophers and Jewish wisdom writers had both used it before John." |
| 5 | key_words[3] (θεός) | "Appears twice in the verse: articular in the second clause, without the article in the third." | Jargon ("articular"). | medium | "Appears twice: with 'the' in the second clause, without it in the third." |
| 6 | claims c3 | "In the third clause θεός stands without the article while ὁ λόγος carries it." | Jargon ("article"). | medium | "In the third clause, 'the' comes before 'Word' but not before 'God'." |
| 7 | claims c4 | "In the third clause the predicate noun θεός stands before the verb." | Jargon ("predicate noun"). | medium | "In the third clause, 'God' comes first, before 'was'." |
| 8 | claims c7 | "Two verses later the same writer switches to the aorist ἐγένετο for things that came into being." | Jargon ("aorist"). | medium | "Two verses later John uses a different verb for created things: they 'came into being'. The Word simply 'was'." |
| 9 | claims c10 | "λόγος carried established senses in both Greek philosophical usage and Jewish wisdom writing before this Gospel was composed." | Nominal, wordy ("established senses", "usage", "was composed"). | medium | "Before John wrote, 'logos' already meant something to Greek philosophers and to Jewish wisdom writers." |
| 10 | claims c11 (claim line) | "What the missing article on θεός in the third clause signals is disputed." | Bare "is disputed" plus jargon. The research found a bare "experts disagree" framing lowers trust; the row should name the question. | medium | "Readers disagree about what it means that there is no 'the' before 'God' in the third clause." |
| 11 | c11 positions[0].case | One 60-word sentence chaining four clauses, with "predicate noun". | Overlong; jargon. | medium | "In Greek, a describing word placed before the verb usually drops 'the'. Read this way, the clause says what the Word is: the Word shares God's nature, without being the Father." |
| 12 | c11 positions[1].case | "The absence of the article carries no independent weight in this position, because pre-verbal predicate nouns commonly lack it…" | Figurative ("carries no independent weight") and jargon. | medium | "Words in this position often lack 'the' anyway, so its absence tells us nothing. 'God' here is as definite as 'the God' in the clause before." |
| 13 | c11 positions[2].case | One long sentence naming the New World Translation. | Long, but fair and sourced. | low | "Read as an ordinary noun without 'the', the clause says 'the Word was a god'. The New World Translation takes this view, arguing John contrasts 'the God' with 'god' on purpose." |
| 14 | Guide vs verse layer | The passage guide's "Where we are" reuses sentence 1 of whats_happening, so opening 1:1 inside the guide repeats it word for word. | A deeper layer must add, not repeat (house style: one claim, two layers). This is a structural gap, not a wording fault. | medium | Generate a passage-level orientation for John 1:1–18 (≤ 25 words) and keep sentence 1 for the verse. |

## Passed (and why)

- whats_happening, sentence 1, "not with a birth or a genealogy but before the world exists": a real contrast (Matthew and Luke open with a genealogy and a birth), so it's protected. It could name Matthew and Luke.
- whats_happening, sentence 2, "Three short clauses each use the same verb: the Word already was, …": the colon introduces a real list.
- translation_note: plain, and it tells the reader why English can't show the Greek order.
- claims c2, c9 and the related-passage notes: concrete and short.
- c12 (personal from v1, or at v14) and its two positions: clear, and both views have the same parts.

## Same pattern elsewhere

- 1 Corinthians 14:34's "differs" rows ("Who the instruction addresses is disputed.", "Where verses 34 and 35 stood in the earliest text is disputed.") use the same bare "is disputed" framing as #10.
- Grammar claims (c1, c5, c6: parse descriptions) belong in the Original evidence layer, never on the first screen. The simpler Understand already groups them under "In the Greek"; the passage guide should never surface them.

## For the generation prompt

1. Ban grammar labels in reader-facing text unless the term is defined in the same sentence (article, accusative, aorist, predicate noun, articular).
2. A "differs" claim names the question in plain words; never "X is disputed" alone.
3. One idea per sentence; no sentence over about 25 words.
4. Word notes give the sense in this verse. Lexical range and history belong in the evidence layer.
5. Add an adversary verdict for **lost qualifiers and dropped agreed facts** (see the explanations report).
