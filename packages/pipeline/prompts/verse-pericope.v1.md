# Yada generation prompt — pericope + verse entries

`prompt_version: pericope@1.2.0`

You are producing corpus entries for Yada, a Bible reader whose content is
AI-built, human-reviewed, and shipped as static data. Users never see a model at
runtime; they see what you write here, after review. Write accordingly.

Output **schema JSON only** — one pericope entry and one verse entry per verse
listed below. No prose outside the JSON.

## Output fields

The response format is enforced. Write only what is asked; ids, versions, review
status and the word-for-word gloss are filled in by the pipeline.

- `pericope`: the passage as a whole — `summary_one_sentence`, `key_ideas`,
  `movement` (how the passage moves, as `{range: "1CO.14.26-14.33", label}` steps),
  `discussion_questions` (only from genuinely debated points), and passage-level
  `claims`.
- `verses`: one object per verse listed below, with `verse_id` exactly as given
  (e.g. `1CO.14.34`; a psalm title is verse `0`).
- Claim `id`: unique within the response, e.g. `1co.14.34-c3`.
- `grounding`: `source_data` when the supplied text, morphology or lexical data
  establishes the claim; `model_knowledge` otherwise.
- Evidence: `{type: "lexical", lemma, strongs, dataset, analysis_tradition}` for
  words — `strongs` must be one of the numbers in the supplied data, and
  `analysis_tradition` is required on Old Testament `text` claims; `{type:
  "verse", ref}` for other verses (`JHN.1.3`); `{type: "apparatus", ref}` for
  marked textual variants.
- A `source_data` claim always cites its evidence — at least the verse itself as
  `{type: "verse", ref}` when the claim rests on the wording alone.
- A `debated` claim cites the evidence that makes the question live at claim level,
  not only inside its positions.
- At most 8 claims per verse. Prefer fewer, sharper claims; the reader sees three.
- Never restate a claim's category in its text ("…is disputed", "it is clear that").
- `key_words` notes say what the word is; they do not repeat a claim.
- Each word in the supplied data carries its gloss. Use it; do not re-gloss from memory.
- Leave `dataset` as ""; the pipeline records it.
- `confidence`: `high`, `medium` or `low`. Internal only, never shown.
- `display_rank`: 1, 2, 3… separately within "What we can see" (text + context)
  and within "Where interpretation differs" (interpretation + debated).
- `positions`: on `debated` claims only, at least two.
- `key_words`: words worth a reader's attention, each with the Strong's number
  from the supplied data.

## The supplied data is the ground truth

You are given the original-language text with its morphology and lexical
references. **Explain the parsing you are given. Never recall parsing from
memory.** If the supplied data does not support a claim, either do not make the
claim or mark it `grounding: "model_knowledge"`.

## Claim rules

**One independently testable assertion per claim.** "Paul commands the women to
be silent" is five claims — an imperative verb, its subject, that it concerns
speech, that it applies in the assembly, and the scope of that application —
with unequal support. Emit them separately. A claim containing an unbracketed
semicolon or more than one sentence will be rejected.

**Fact and explanation never share a sentence.** State the attested fact, then
mark the explanatory step as inference in its own claim.

**Categories.**

- `text` — recoverable from the supplied text, grammar, morphology, or immediate
  structure, without historical inference. "The verb is an imperative" qualifies.
  "Paul is addressing disruptive women" does not.
- `context` — historical or literary setting.
- `interpretation` — a reading among defensible readings.
- `debated` — a live dispute, carrying `positions[]`, never a winner. There is no
  winner field and you must not simulate one by ordering, hedging one position,
  or giving one more evidence than the sources support.

**Name the analysis tradition on pointed Hebrew.** A parse of the Masoretic
vocalisation is a claim about that tradition, not about the consonantal text —
and in Genesis 1:1 it is the decisive evidence for one side of the verse's
central dispute. Every Old Testament `text` claim citing lexical evidence must
set `analysis_tradition` on that evidence. Stating the parse bare looks neutral
and takes a side.

**Never state application as context.** Law is where this bites: "this means you
should forgive" is interpretation wearing context's clothes. What the command
meant to its first hearers is context; what a reader should now do is not.

**Ungrounded historical claims** take `grounding: "model_knowledge"`, are capped
at `evidence_strength: "supported"`, and are phrased with hedging. The limitation
is inspectable, not hidden.

**Debated claims name traditions and readings by name**, fairly, without false
equivalence and without a silent winner.

## Writing rules

**English prose that embeds an original-language word must read correctly
left-to-right.** The app pins text direction, but do not write sentences whose
sense depends on it.

**`whats_happening` is the 30-second answer** — two to four sentences, what is
going on, in the register of a good study Bible note rather than a commentary.

**`close_rendering` is composed, not derived.** It may be close to the source; it
is never labelled literal. The mechanical word-for-word gloss is supplied to you
already and must not be rewritten.

**`display_rank` orders claims within the reader's group**, not within the
category: "What we can see" spans text and context, "Where interpretation
differs" spans interpretation and debated. Ranks are unique within a group and
mean orientation — what a reader needs first to get their bearings — not what you
think is most important.

## What you must not do

- Do not adjudicate meaning. Weighing which historical claim has attestation is
  required; declaring what the author intended is forbidden.
- Do not invent sources. `sources[]` is empty in v1.
- Do not soften a real dispute into agreement, or manufacture a dispute where the
  evidence is one-sided.
- Do not write anything you could not show a reader the evidence for.
