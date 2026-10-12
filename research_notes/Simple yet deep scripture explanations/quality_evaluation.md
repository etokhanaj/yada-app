# Quality evaluation and assurance for AI-generated scripture explanations

Scope: a practical quality framework for a pipeline in which a language model writes an explanation, an adversary model checks it, and one human reviewer approves it. Research done 2026-10-10. AI sources are 2023–2026; rubric sources include classic work.

## 1. What rubrics exist for judging explanation quality, and which dimensions matter for a layperson?

### Takeaway
No single rubric fits. A workable layperson rubric takes **attribution** (is every claim supported by a named source?) from AIS, FActScore and RAGAS, **relevance and economy** from Grice, and **learner activity and misconception targeting** from educational research. Score accuracy claim by claim and as a binary gate. Score simplicity and depth on anchored scales.

### Cited Findings
- **AIS (Attributable to Identified Sources)**, Rashkin et al. 2021 (Google): a binary human-evaluation framework. A response is attributable if the rater would accept the statement "According to [source], [response]". — [RARR paper describing AIS](https://arxiv.org/pdf/2210.08726); [Cross-lingual attribution paper](https://arxiv.org/pdf/2305.14332)
- AIS annotation has two steps. Raters first judge whether the answer is interpretable, then whether it is attributable to the shown passage, each Yes/No with a flag option. Because interpretability is checked before attribution, an unclear explanation fails before its sourcing is even judged. — [Cross-lingual attribution paper](https://arxiv.org/pdf/2305.14332)
- **FActScore** (Min et al., EMNLP 2023) breaks long-form text into atomic facts, each a short sentence carrying one piece of information. It scores the percentage supported by a reliable knowledge source. ChatGPT scored only 58% on biographies. An automated estimator came within under 2% error. — [FActScore, arXiv 2305.14251](https://arxiv.org/pdf/2305.14251)
- **RAGAS** (Es et al., 2023) defines reference-free metrics: faithfulness (claims supported by retrieved context), answer relevance, context precision and context recall. It uses an LLM to judge these properties without a gold answer. — [RAGAS docs](https://docs.ragas.io/en/v0.1.21/concepts/metrics/); arXiv:2309.15217
- **ALCE** (Gao et al., EMNLP 2023) scores generated text with citations on fluency, correctness and citation quality (citation recall and precision). On ELI5, even the best models lacked complete citation support about 50% of the time. — [ALCE, arXiv 2305.14627](https://arxiv.org/abs/2305.14627v2)
- **Grice's Cooperative Principle** gives four maxims: Quantity (as informative as required, no more), Quality (do not say what you believe false or lack evidence for), Relation (be relevant) and Manner (avoid obscurity and ambiguity, be brief and orderly). — [Stanford Encyclopedia of Philosophy, Implicature](https://plato.stanford.edu/entries/implicature/)
- **Educational explanation research**: Wittwer & Renkl (2008, *Educational Psychologist* 43:49–64) found instructional explanations are often ineffective, partly because learners stay mentally passive and explanations do not target specific misunderstandings. Explanations work better when they address the limits of the learner's current understanding and are built into learning activity. — [Springer follow-up](https://link.springer.com/doi/10.1007/s10212-010-0049-y); [summary](https://theelearningcoach.com/elearning_design/instructional-explanations/)

### Inferences
- Proposed layperson rubric, mapping each dimension to its source:
  1. **Grounded accuracy** (gate, binary per claim): every atomic claim is AIS-attributable to the source text, a named translation or lexicon entry, or a named tradition (from AIS, FActScore and RAGAS faithfulness).
  2. **Quote fidelity** (gate, exact match): every quoted verse matches the named translation word for word, punctuation included. This is checked by code, not by a model.
  3. **Relevance** (Grice Relation, RAGAS answer relevance): it answers what this passage means, not adjacent topics.
  4. **Economy** (Grice Quantity and Manner): no padding, no restating, one idea per sentence.
  5. **Honest certainty** (Grice Quality): confidence matches the evidence, and disagreement is flagged where it exists.
  6. **Depth** (Wittwer & Renkl): it names what a reader is likely to misread and why. It connects to context such as the literary unit, the historical setting or a cross-reference, not just a paraphrase.
  7. **Readability**: a target grade level, checked by formula as a guardrail only.
- Accuracy dimensions (1, 2 and 5) should be pass/fail gates. Rubric averaging can hide one fabricated claim behind a high overall score.

### Gaps
- I found no published rubric built specifically for AI explanations of sacred texts.
- I did not locate a validated "explanation depth" scale for lay adults. The depth anchors above are inferred from educational research, not taken from a tested instrument.

## 2. Known failure modes of LLM explanations of scripture

### Takeaway
The documented failures are misquotation (15–60% by YouVersion's account), tradition bias toward US conservative evangelicalism (Bible Society/Cambridge, Jan 2026), overconfident tone, and unsupported claims in long-form text in general. False precision about Greek and Hebrew words is a known risk, but I found no 2022–2026 empirical study measuring it.

### Cited Findings
- **Misquotation**: YouVersion CEO Bobby Gruenewald told Christian Daily International (Nairobi, 17 March 2026) that the best model misquotes Scripture at least 15% of the time and some models as much as 60%. That holds even for the most-indexed translations. He counts any word or punctuation change, saying every word and punctuation mark is meaningful. YouVersion deliberately avoids public chatbots that answer theological questions. Methodology was not published. — [Christian Post](https://www.christianpost.com/news/ais-bible-misquotes-range-from-15-to-60-youversion-ceo.html)
- **Users cannot spot misquotes**: the same report notes users often cannot recognise altered verses and may accept flawed explanations as authoritative. — [Christian Post](https://www.christianpost.com/news/ais-bible-misquotes-range-from-15-to-60-youversion-ceo.html)
- **Tradition bias**: *AI, Bible Apps and Theological Bias* (Kurlberg, Schwáb, Xu, Washbrook; Bible Society with the Cambridge Centre for Chinese Theology, Jan 2026) was a pilot study. It tested how four Bible apps answer questions on which churches disagree, and found a marked lean toward US conservative evangelical interpretation. — [Scripture Engagement summary](https://scripture-engagement.org/content/ai-bible-apps-and-theological-bias/); [FSSPX News report](https://fsspx.news/fr/news/bible-et-ia-le-biais-evangelique-americain-57051)
- The study asked six questions, three on biblical theology and three asking for explanations of specific verses. The apps showed a broadly conservative evangelical bias while also giving pastoral responses. It was presented at the "AI, Bible Apps and Hermeneutics" workshop in Cambridge, 19–20 Jan 2026. — [Church Times, via search snippet](https://www.churchtimes.co.uk/articles/2026/23-january/news/uk/bible-society-backs-testing-of-chatbots-on-scripture)
- The stated cause is training data: the English-language web is saturated with content from American evangelical organisations, and Catholic sources are underrepresented. The Bible Society called for more diverse sources and for AI to support, not replace, human discernment. — [FSSPX News](https://fsspx.news/fr/news/bible-et-ia-le-biais-evangelique-americain-57051)
- **Overconfidence**: when asked to state confidence, LLMs tend to be overconfident, possibly imitating human patterns. Calibration improves with scale but stays far from ideal. Consistency across multiple samples helps. — [Xiong et al., ICLR 2024](https://arxiv.org/abs/2306.13063v2)
- **Unsupported long-form claims**: 58% FActScore for ChatGPT biographies — [FActScore](https://arxiv.org/pdf/2305.14251). About 50% of answers lacked full citation support even for the best ALCE systems — [ALCE](https://arxiv.org/abs/2305.14627v2).
- **High stakes from user trust**: Barna/Gloo (released 19 Feb 2026 at the NRB convention) found nearly 1 in 3 US adults consider AI spiritual advice as trustworthy as a pastor's. The figure is 2 in 5 among Gen Z and Millennials. 40% of practicing Christians say AI has helped their prayer, Bible study or spiritual growth. — [Gloo press release](https://gloo.com/press/releases/ai-is-becoming-a-spiritual-authority-in-americans-lives-new-research-reveals). A May 2026 release puts it at 34% of practicing Christians, with 65% concerned about AI acting as a substitute for God. — [Business Wire](https://www.businesswire.com/news/home/20260520817879/en/AI-is-Becoming-a-Spiritual-Authority-Even-Among-Practicing-Christians). The figures differ slightly between releases; the February press release gives no methodology.

### Inferences
- **Flattening disagreement** follows from the bias finding. A model that defaults to one tradition presents a contested reading as settled. The rubric should require naming the main alternative reading wherever major traditions differ.
- **False precision about Greek and Hebrew** (the "root fallacy", treating one gloss as the meaning, or claiming a word "literally means" something) is a well-known exegetical hazard in biblical studies. It is not documented in the AI sources found here. Safeguard: allow only lexical claims that trace to a specific lexicon or morphology record, which matches Yada's rule 4.
- Hallucinated verse references (non-existent chapter:verse) are a sub-case of misquotation. Checking references against canonical verse tables in code removes them entirely.

### Gaps
- The full Bible Society report (question list, app names, scoring) was not accessible; the Church Times page returned 403. Exact findings beyond the summary could not be checked.
- The YouVersion 15–60% figure is an interview claim with no published method, sample or model list. Treat it as indicative.
- I found no peer-reviewed 2022–2026 study measuring LLM errors on Greek or Hebrew lexical claims.

## 3. Making explanations simpler without losing accuracy: what works?

### Takeaway
Simplification and factuality trade off: LLMs that simplify by rephrasing add hallucinations. The most reliable checks are external, such as retrieval, independent claim verification and code-level quote checks. Asking the model to critique itself with no new evidence is unreliable. Adversarial debate measurably helps a weaker judge reach the truth.

### Cited Findings
- **Simplicity vs factuality trade-off**: FactPICO (2024) tested 345 plain-language summaries of medical RCTs from GPT-4, Llama-2 and Alpaca, with expert evaluation. It found a clear trade-off between simplicity and factuality. Models overgeneralised, losing important information. GPT-4 and Llama-2 simplified by rephrasing and produced significantly more hallucinations. The most extractive model was the most factual but read at an advanced level. — [FactPICO, arXiv 2402.11456](https://arxiv.org/pdf/2402.11456)
- **Self-correction without external feedback** is unreliable: LLMs struggle to self-correct reasoning without outside feedback and sometimes get worse. Gains credited to multi-agent debate come mainly from self-consistency (aggregating several generations). — [Huang et al., ICLR 2024](https://arxiv.org/abs/2310.01798v2)
- **Chain-of-Verification (CoVe)** works in four steps: draft, plan verification questions, answer them independently so answers are not biased by the draft, then revise. It reduced hallucinations on list questions, closed-book QA and long-form generation. — [Dhuliawala et al., arXiv 2309.11495](https://arxiv.org/pdf/2309.11495)
- **Research-and-revise with retrieval**: RARR finds evidence for a draft's claims and edits unsupported content, scored with AIS. — [RARR, arXiv 2210.08726](https://arxiv.org/pdf/2210.08726)
- **Citation forcing helps but is not enough**: ALCE showed citation generation is measurable, yet about half of answers still lacked full support. — [ALCE](https://arxiv.org/abs/2305.14627v2)
- **Adversarial debate helps a non-expert judge**: on QuALITY, debate between two LLM experts raised non-expert accuracy to 76% (model judges) and 88% (human judges), against naive baselines of 48% and 60%. Training debaters to be more persuasive improved truth-finding. — [Khan et al., ICML 2024](https://proceedings.mlr.press/v235/khan24a.html)
- **LLM judges have biases**: GPT-4 as judge agreed with humans over 80% of the time, the same as human–human agreement. It still showed position, verbosity and self-enhancement biases. — [Zheng et al., NeurIPS 2023](https://arxiv.org/html/2306.05685v4)
- **Verbalised confidence is overconfident**, but sampling multiple responses and measuring consistency helps. — [Xiong et al., ICLR 2024](https://arxiv.org/abs/2306.13063v2)

### Inferences
- Pipeline implications:
  - (a) Generate from retrieved source text (original language, open translations and lexicon records) and force a claim-to-source link per sentence.
  - (b) Break the output into atomic claims and verify each one independently, CoVe/FActScore style. The adversary sees the source but not the generator's reasoning.
  - (c) Check quotes and references deterministically in code.
  - (d) Use a different model family, or at least a different prompt and role, for the adversary to reduce self-enhancement bias.
  - (e) Have the adversary also check *omission*, not only false additions, because FactPICO found overgeneralisation and information loss.
- Readability formulas (e.g. Flesch-Kincaid) should be guardrails, not targets. Pushing the grade level down is exactly what drives the FactPICO trade-off.
- Simplify in two passes: first an accurate, possibly dense draft, then a simplification pass whose output must keep the same verified claim set (claim-set equivalence check). This is an inference, not a tested method in the sources.
- Self-consistency (sample several explanations and flag claims that appear in only one) is a cheap signal for uncertain content.

### Gaps
- I found no study measuring adversary-critic pipelines specifically on religious or humanities interpretation, where "truth" is often contested readings rather than facts.
- I found no direct evidence on whether citation forcing reduces readability for lay readers.

## 4. Human evaluation protocols, especially for a single reviewer

### Takeaway
The reviewer's job should be narrowed to what models cannot check: interpretive fairness and pastoral tone. Use binary or anchored judgements on atomic items, and expect the criteria to evolve as outputs are reviewed ("criteria drift"). Validate the automated adversary against the human's decisions on a sample.

### Cited Findings
- **Criteria drift**: reviewers need criteria to grade outputs, but grading outputs helps them define the criteria. Some criteria only emerge after seeing outputs. — [Shankar et al., UIST 2024](https://arxiv.org/pdf/2404.12272)
- **Validate the validators**: LLM evaluators inherit the problems of the LLMs they judge and need human validation. EvalGen asks humans to grade a subset of outputs and keeps the automated checks that agree best with human grades. — [Shankar et al.](https://arxiv.org/pdf/2404.12272)
- **AIS-style binary judgements**: the AIS protocol uses Yes/No per step (interpretable? attributable?) with a flag option, rather than a Likert scale. — [Cross-lingual attribution paper](https://arxiv.org/pdf/2305.14332)
- **LLM–human agreement benchmark**: GPT-4 judges reach over 80% agreement with humans, the human–human level. That makes LLM pre-screening plausible but not a replacement. — [Zheng et al.](https://arxiv.org/html/2306.05685v4)

### Inferences
- **For one reviewer approving many entries**:
  - Show the reviewer only the adversary's flagged claims plus a random sample of unflagged ones, not every sentence cold.
  - Present each claim next to its source, so each check is one AIS-style yes/no decision.
  - Use binary gates for accuracy and attribution. Use 1–5 anchored scales only for simplicity, depth and fairness, with written anchors (e.g. Depth 1 = paraphrase only; 3 = adds one context point; 5 = names a likely misreading and resolves it from the text).
  - Keep a written decision log. Re-read the anchors when criteria drift, and re-grade earlier approvals against changed criteria.
- **Single-reviewer reliability**: inter-rater kappa needs at least two raters. A lone reviewer can measure *intra*-rater consistency by re-reviewing a blind 5–10% sample after a gap. Periodically bringing in a second, theologically different reviewer for a small sample would measure tradition bias in the reviewer, not only the model. Standard practice; not sourced above.
- **Adversary–human agreement as a KPI**: track how often the adversary's pass/fail matches John's decisions. Low agreement on a category means that category's prompt or check needs work (EvalGen principle).
- **Fatigue controls** (inferred, not sourced): cap review batches, randomise order to avoid position effects, mix in seeded known-bad items ("canaries") to test vigilance, and record time per item.

### Gaps
- I found no source on reviewer fatigue specific to LLM output review with quantified batch-size limits.
- I did not retrieve a source for standard kappa thresholds (e.g. Landis & Koch 1977). Cite them separately if used.

## 5. Testing with users whether an explanation helped

### Takeaway
Measure understanding, not satisfaction. Use comprehension and retell tasks against a no-explanation or alternative-explanation control. Measure trust *calibration* (do users rely on the explanation more when it is right than when it is wrong?) rather than raw trust, because how uncertainty is worded changes reliance.

### Cited Findings
- **Uncertainty wording changes reliance**: in a pre-registered experiment (N=404, medical questions, fictional LLM search engine), natural-language uncertainty expressions reduced overreliance. The exact phrasing mattered, and the authors stress user testing before deployment. — [Kim et al., FAccT 2024](https://arxiv.org/abs/2405.00623)
- **Explanations often fail without learner activity**: passive reading of explanations is often ineffective. Prompting active processing and targeting misconceptions helps. This supports comprehension and retell tasks over "was this helpful?" ratings. — [Wittwer & Renkl, via summary](https://theelearningcoach.com/elearning_design/instructional-explanations/)
- **Users may over-trust spiritual AI**: about 1 in 3 US adults rate AI spiritual guidance as trustworthy as a pastor's. That makes calibration, not raw trust, the right target. — [Gloo/Barna](https://gloo.com/press/releases/ai-is-becoming-a-spiritual-authority-in-americans-lives-new-research-reveals)
- **Users cannot detect misquotes** without help. — [Christian Post](https://www.christianpost.com/news/ais-bible-misquotes-range-from-15-to-60-youversion-ceo.html)

### Inferences
- Proposed user-test battery:
  1. **Comprehension check**: 2–3 multiple-choice items per passage, written from the source rather than the explanation. Include a distractor that matches a common misreading.
  2. **Retell**: "In one or two sentences, what is this passage saying?" Score against a key-idea list (idea-unit scoring).
  3. **A/B tests**: compare explanation variants (e.g. with vs without a named alternative reading, or grade 6 vs grade 9) on comprehension and retell, not on clicks or ratings.
  4. **Trust calibration**: seed a small number of deliberately weaker or contested explanations in a lab setting only, never in production, which matches Yada rule 2. Measure whether users' agreement or confidence drops for those.
  5. **Delayed recall** (days later) to separate real understanding from an illusion of fluency.
- Do not ship deliberately wrong content to real users. Calibration tests belong in moderated sessions with debriefing.

### Gaps
- I found no published study testing comprehension outcomes of AI Bible explanations with lay readers.
- I found no validated trust-calibration instrument specific to religious content.
