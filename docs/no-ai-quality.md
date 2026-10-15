# No-AI Understand: quality report (12 Oct 2026)

Produced by `python3 -I packages/pipeline/prototypes/assemble.py report` (assembler v3) over all 66 books, 31,105 verses.
`… assemble.py checks` runs the golden checks and the rule-9 guard. Both pass.

## Summary

- **In plain words** (Simplified Text): at least 99% of verses in every book, 100% in most. Median reading grade is
  about 5–7.5. Tyndale's notes read at 10–11.
- **Readers differ** (Translation Notes readings): 2,015 verses.
- **Translators' notes** (BSB "Or …" / "Literally …" footnotes): 1,643 verses.
- **Facts** (translation differences, rare-word patterns, speakers, citations): 88–100% of verses per book.
- **Key words** (Translation Words via Translation Word Links): 75–100% of verses per book.
- **Check what you read** (Translation Questions): 16–98% of verses per book, median 48%.
- **Sections** (BSB headings; a chapter where a book has none, as in Psalms): 3,110.
  - 112 of them are told by an Open Bible Story.
- **Manuscript notes** (BSB footnotes, attached to every verse they name): John 5:4, 7:53–8:11, Mark 16:9–20,
  Acts 8:37, Matt 17:21, 1 Cor 14:34–35 and the rest.
- **Leaks** (markup, translator instructions, "(See: …)"): 0.
- **Rule 9:** no NLT wording anywhere in the beginner layer. Tyndale's NLT words stay marked "(NLT)" inside Study
  notes only.
- **Over the 150-word beginner budget:** 120 verses. These have several long readings; the screen cuts each to two
  lines and opens the rest on tap.

## Fixed in this pass

- **Poetry.** The Simplified Text parser now splits on verse markers anywhere in a line. Psalms, Proverbs, Job and
  most prophets went from 0–17% to 100% plain coverage.
- **Psalms.** The Berean tables say "Psalm", the core says "Psalms". Names are now matched both ways, so footnotes,
  headings and word facts load. Psalm titles (the core's verse 0) are no longer counted as missing verses.
- **Manuscript notes** sit on a neighbouring verse in the BSB. They are now attached to every verse they name.
  Edition abbreviations read in plain words ("BYZ and TR include" → "Later manuscripts include").
- **Translation differences.**
  - Clause-bounded, short and of similar length, so reordered sentences no longer pair unrelated phrases.
  - Helper verbs and contractions are ignored.
  - Ranked by how many versions differ.
- **Word facts** quote the BSB's own rendering from the tables ("Are to be silent" translates a word used 3 times…),
  not a lexicon gloss.
- **Translation Notes.** "Here, …" openings are kept (they explain); "(See: …)" and every sentence addressed to a
  translator are removed.
- **"Read it alongside"** never lists the verse or passage being read.

## Known limits

- **The plain line takes sides.** It is labelled "One plain reading" wherever readings or BSB alternatives exist, and
  shown next to them.
- **Coverage varies by source.** Translation Questions and Open Bible Stories are uneven: stories cover narratives
  only.
- **Tyndale extracts** still carry some parentheses and NLT marks. They now sit under Study notes, not in the
  beginner layer.
- **The FRAME table** (who wrote each book, to whom) has 2 of 66 books filled. It needs one reviewed line per book.
- **Berean tables licence.** berean.bible states the Berean texts are public domain (since 30 Apr 2023) and that
  "licensing is not required for any use". The table file carries no notice of its own. Ask the Berean team to
  confirm in the email already planned about the audio.

## Per book

```
GEN   1533 verses · plain 100% (grade 7.8) · translators' notes   65 · readers differ   51 · facts  96% · key words  95% · questions  33% · sections 148 · stories 8 · over budget 1 · leaks 0 · NLT-marked notes 347 · missing verses 0
EXO   1213 verses · plain 100% (grade 6.4) · translators' notes   49 · readers differ   25 · facts  98% · key words  94% · questions  30% · sections 123 · stories 6 · over budget 1 · leaks 0 · NLT-marked notes 445 · missing verses 0
LEV    859 verses · plain 100% (grade 8.8) · translators' notes   39 · readers differ   10 · facts  99% · key words  82% · questions  19% · sections 70 · stories 0 · over budget 2 · leaks 0 · NLT-marked notes 234 · missing verses 0
NUM   1288 verses · plain 100% (grade 6.7) · translators' notes   31 · readers differ  119 · facts  97% · key words  90% · questions  42% · sections 113 · stories 1 · over budget 6 · leaks 0 · NLT-marked notes 410 · missing verses 0
DEU    959 verses · plain 100% (grade 6.8) · translators' notes   35 · readers differ   20 · facts  99% · key words  94% · questions  30% · sections 91 · stories 2 · over budget 0 · leaks 0 · NLT-marked notes 93 · missing verses 0
JOS    658 verses · plain 100% (grade 7.3) · translators' notes   24 · readers differ    7 · facts  90% · key words  90% · questions  24% · sections 51 · stories 1 · over budget 1 · leaks 0 · NLT-marked notes 162 · missing verses 0
JDG    618 verses · plain 100% (grade 6.1) · translators' notes   24 · readers differ   20 · facts  98% · key words  97% · questions  35% · sections 52 · stories 1 · over budget 2 · leaks 0 · NLT-marked notes 141 · missing verses 0
RUT     85 verses · plain 100% (grade 5.8) · translators' notes    1 · readers differ    3 · facts 100% · key words  89% · questions  61% · sections 8 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 3 · missing verses 0
1SA    810 verses · plain 100% (grade 6.3) · translators' notes   35 · readers differ   19 · facts  98% · key words  98% · questions  31% · sections 70 · stories 1 · over budget 5 · leaks 0 · NLT-marked notes 63 · missing verses 0
2SA    695 verses · plain 100% (grade 6.7) · translators' notes   40 · readers differ   19 · facts  97% · key words  97% · questions  35% · sections 64 · stories 2 · over budget 5 · leaks 0 · NLT-marked notes 111 · missing verses 0
1KI    816 verses · plain 100% (grade 7.4) · translators' notes   34 · readers differ   14 · facts  98% · key words  98% · questions  48% · sections 94 · stories 2 · over budget 3 · leaks 0 · NLT-marked notes 306 · missing verses 0
2KI    719 verses · plain 100% (grade 7.0) · translators' notes   38 · readers differ   12 · facts  99% · key words  99% · questions  29% · sections 93 · stories 2 · over budget 6 · leaks 0 · NLT-marked notes 235 · missing verses 0
1CH    942 verses · plain 100% (grade 7.0) · translators' notes   44 · readers differ    8 · facts  88% · key words  75% · questions  44% · sections 84 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 408 · missing verses 0
2CH    822 verses · plain 100% (grade 7.6) · translators' notes   52 · readers differ   35 · facts  97% · key words  96% · questions  34% · sections 106 · stories 1 · over budget 2 · leaks 0 · NLT-marked notes 178 · missing verses 0
EZR    280 verses · plain 100% (grade 9.2) · translators' notes   17 · readers differ    1 · facts  97% · key words  77% · questions  25% · sections 28 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 60 · missing verses 0
NEH    406 verses · plain 100% (grade 7.1) · translators' notes   29 · readers differ    3 · facts  91% · key words  81% · questions  19% · sections 28 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 132 · missing verses 0
EST    167 verses · plain 100% (grade 7.3) · translators' notes    7 · readers differ   10 · facts  98% · key words  98% · questions  49% · sections 20 · stories 0 · over budget 4 · leaks 0 · NLT-marked notes 18 · missing verses 0
JOB   1070 verses · plain 100% (grade 5.0) · translators' notes   49 · readers differ   74 · facts  98% · key words  83% · questions  39% · sections 50 · stories 0 · over budget 1 · leaks 0 · NLT-marked notes 165 · missing verses 0
PSA   2461 verses · plain 100% (grade 6.3) · translators' notes  133 · readers differ   78 · facts  96% · key words  95% · questions  57% · sections 171 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 562 · missing verses 0
PRO    915 verses · plain 100% (grade 7.5) · translators' notes   54 · readers differ   71 · facts  97% · key words  94% · questions  40% · sections 66 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 229 · missing verses 0
ECC    222 verses · plain 100% (grade 9.0) · translators' notes   11 · readers differ   21 · facts  97% · key words  86% · questions  91% · sections 26 · stories 0 · over budget 2 · leaks 0 · NLT-marked notes 62 · missing verses 0
SNG    117 verses · plain 100% (grade 6.5) · translators' notes    8 · readers differ   25 · facts  97% · key words  94% · questions  94% · sections 42 · stories 0 · over budget 4 · leaks 0 · NLT-marked notes 22 · missing verses 0
ISA   1292 verses · plain 100% (grade 6.3) · translators' notes   90 · readers differ    9 · facts  99% · key words  96% · questions  70% · sections 120 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 254 · missing verses 0
JER   1364 verses · plain 100% (grade 8.3) · translators' notes   68 · readers differ   35 · facts  99% · key words  97% · questions  49% · sections 122 · stories 2 · over budget 1 · leaks 0 · NLT-marked notes 546 · missing verses 0
LAM    154 verses · plain 100% (grade 5.4) · translators' notes    9 · readers differ    2 · facts  99% · key words  88% · questions  45% · sections 7 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 33 · missing verses 0
EZK   1273 verses · plain 100% (grade 7.6) · translators' notes   57 · readers differ   88 · facts  99% · key words  85% · questions  47% · sections 114 · stories 0 · over budget 7 · leaks 0 · NLT-marked notes 583 · missing verses 0
DAN    357 verses · plain 100% (grade 5.8) · translators' notes   26 · readers differ    5 · facts  99% · key words  98% · questions  79% · sections 33 · stories 1 · over budget 2 · leaks 0 · NLT-marked notes 98 · missing verses 0
HOS    197 verses · plain 100% (grade 7.2) · translators' notes   24 · readers differ    7 · facts  99% · key words  98% · questions  96% · sections 19 · stories 0 · over budget 1 · leaks 0 · NLT-marked notes 64 · missing verses 0
JOL     73 verses · plain 100% (grade 7.2) · translators' notes    8 · readers differ    1 · facts 100% · key words  95% · questions  53% · sections 9 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 24 · missing verses 0
AMO    146 verses · plain 100% (grade 7.7) · translators' notes   18 · readers differ    7 · facts 100% · key words  97% · questions  91% · sections 14 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 29 · missing verses 0
OBA     21 verses · plain 100% (grade 7.6) · translators' notes    2 · readers differ    2 · facts 100% · key words 100% · questions  57% · sections 2 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 4 · missing verses 0
JON     48 verses · plain 100% (grade 6.6) · translators' notes    2 · readers differ    6 · facts 100% · key words  95% · questions  66% · sections 6 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 9 · missing verses 0
MIC    105 verses · plain 100% (grade 7.9) · translators' notes   10 · readers differ    2 · facts  98% · key words  97% · questions  98% · sections 15 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 20 · missing verses 0
NAM     47 verses · plain 100% (grade 7.8) · translators' notes    2 · readers differ    1 · facts 100% · key words  97% · questions  53% · sections 3 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 16 · missing verses 0
HAB     56 verses · plain 100% (grade 6.6) · translators' notes    4 · readers differ    3 · facts 100% · key words  96% · questions  57% · sections 7 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 17 · missing verses 0
ZEP     53 verses · plain 100% (grade 5.8) · translators' notes   11 · readers differ   10 · facts 100% · key words 100% · questions  45% · sections 10 · stories 0 · over budget 3 · leaks 0 · NLT-marked notes 23 · missing verses 0
HAG     38 verses · plain 100% (grade 7.3) · translators' notes    2 · readers differ    2 · facts 100% · key words  97% · questions  42% · sections 5 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 17 · missing verses 0
ZEC    211 verses · plain 100% (grade 7.8) · translators' notes   25 · readers differ   13 · facts  99% · key words  94% · questions  75% · sections 25 · stories 1 · over budget 1 · leaks 0 · NLT-marked notes 35 · missing verses 0
MAL     55 verses · plain 100% (grade 5.6) · translators' notes    6 · readers differ    3 · facts 100% · key words 100% · questions  21% · sections 8 · stories 1 · over budget 0 · leaks 0 · NLT-marked notes 6 · missing verses 0
MAT   1071 verses · plain 100% (grade 5.5) · translators' notes   51 · readers differ  171 · facts  99% · key words  90% · questions  32% · sections 153 · stories 18 · over budget 2 · leaks 0 · NLT-marked notes 159 · missing verses 3
MRK    678 verses · plain 100% (grade 5.6) · translators' notes   40 · readers differ   88 · facts  98% · key words  86% · questions  34% · sections 96 · stories 14 · over budget 1 · leaks 0 · NLT-marked notes 207 · missing verses 5
LUK   1151 verses · plain 100% (grade 6.0) · translators' notes   42 · readers differ   39 · facts  98% · key words  88% · questions  34% · sections 154 · stories 18 · over budget 3 · leaks 0 · NLT-marked notes 114 · missing verses 2
JHN    879 verses · plain 100% (grade 6.5) · translators' notes   40 · readers differ  101 · facts  98% · key words  92% · questions  40% · sections 84 · stories 11 · over budget 2 · leaks 0 · NLT-marked notes 174 · missing verses 1
ACT   1007 verses · plain 100% (grade 6.4) · translators' notes   77 · readers differ   43 · facts  97% · key words  93% · questions  34% · sections 110 · stories 5 · over budget 4 · leaks 0 · NLT-marked notes 390 · missing verses 4
ROM    436 verses · plain 100% (grade 7.7) · translators' notes   28 · readers differ   79 · facts  94% · key words  96% · questions  41% · sections 47 · stories 1 · over budget 2 · leaks 0 · NLT-marked notes 49 · missing verses 4
1CO    437 verses · plain 100% (grade 7.2) · translators' notes   26 · readers differ  101 · facts  94% · key words  93% · questions  45% · sections 45 · stories 0 · over budget 8 · leaks 0 · NLT-marked notes 184 · missing verses 0
2CO    257 verses · plain  99% (grade 6.4) · translators' notes   12 · readers differ  130 · facts  96% · key words  88% · questions  43% · sections 25 · stories 1 · over budget 5 · leaks 0 · NLT-marked notes 119 · missing verses 0
GAL    149 verses · plain 100% (grade 8.4) · translators' notes    5 · readers differ   24 · facts  96% · key words  95% · questions  43% · sections 16 · stories 0 · over budget 4 · leaks 0 · NLT-marked notes 55 · missing verses 0
EPH    155 verses · plain 100% (grade 9.0) · translators' notes    5 · readers differ   18 · facts  90% · key words  95% · questions  58% · sections 17 · stories 0 · over budget 1 · leaks 0 · NLT-marked notes 48 · missing verses 0
PHP    104 verses · plain 100% (grade 7.8) · translators' notes    6 · readers differ   21 · facts  97% · key words  89% · questions  50% · sections 15 · stories 0 · over budget 4 · leaks 0 · NLT-marked notes 35 · missing verses 0
COL     95 verses · plain 100% (grade 8.0) · translators' notes    5 · readers differ   19 · facts  94% · key words  92% · questions  65% · sections 12 · stories 1 · over budget 1 · leaks 0 · NLT-marked notes 22 · missing verses 0
1TH     89 verses · plain 100% (grade 6.7) · translators' notes    7 · readers differ   31 · facts  98% · key words  95% · questions  39% · sections 10 · stories 1 · over budget 3 · leaks 0 · NLT-marked notes 26 · missing verses 0
2TH     47 verses · plain 100% (grade 7.6) · translators' notes    4 · readers differ    6 · facts 100% · key words  95% · questions  53% · sections 7 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 9 · missing verses 0
1TI    113 verses · plain 100% (grade 5.8) · translators' notes    9 · readers differ   56 · facts  97% · key words  94% · questions  55% · sections 20 · stories 0 · over budget 4 · leaks 0 · NLT-marked notes 22 · missing verses 0
2TI     83 verses · plain 100% (grade 5.2) · translators' notes    7 · readers differ   34 · facts  97% · key words  91% · questions  60% · sections 11 · stories 0 · over budget 1 · leaks 0 · NLT-marked notes 26 · missing verses 0
TIT     46 verses · plain 100% (grade 7.4) · translators' notes    3 · readers differ    3 · facts 100% · key words 100% · questions  69% · sections 8 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 9 · missing verses 0
PHM     25 verses · plain 100% (grade 7.6) · translators' notes    0 · readers differ    3 · facts 100% · key words  92% · questions  52% · sections 4 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 2 · missing verses 0
HEB    303 verses · plain 100% (grade 7.5) · translators' notes   27 · readers differ   89 · facts  97% · key words  95% · questions  51% · sections 34 · stories 1 · over budget 5 · leaks 0 · NLT-marked notes 96 · missing verses 0
JAS    108 verses · plain 100% (grade 5.7) · translators' notes   14 · readers differ    8 · facts  99% · key words  93% · questions  62% · sections 15 · stories 1 · over budget 3 · leaks 0 · NLT-marked notes 16 · missing verses 0
1PE    105 verses · plain 100% (grade 7.8) · translators' notes   11 · readers differ   30 · facts  99% · key words  98% · questions  38% · sections 15 · stories 0 · over budget 2 · leaks 0 · NLT-marked notes 32 · missing verses 0
2PE     61 verses · plain 100% (grade 8.3) · translators' notes    7 · readers differ   28 · facts 100% · key words  98% · questions  16% · sections 7 · stories 0 · over budget 2 · leaks 0 · NLT-marked notes 13 · missing verses 0
1JN    105 verses · plain 100% (grade 6.7) · translators' notes   12 · readers differ   15 · facts  95% · key words  94% · questions  61% · sections 15 · stories 1 · over budget 1 · leaks 0 · NLT-marked notes 38 · missing verses 0
2JN     13 verses · plain 100% (grade 6.5) · translators' notes    1 · readers differ    2 · facts 100% · key words  92% · questions  76% · sections 4 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 2 · missing verses 0
3JN     14 verses · plain 100% (grade 7.6) · translators' notes    2 · readers differ    3 · facts 100% · key words  92% · questions  78% · sections 4 · stories 0 · over budget 0 · leaks 0 · NLT-marked notes 5 · missing verses 0
JUD     25 verses · plain 100% (grade 7.4) · translators' notes    1 · readers differ   10 · facts 100% · key words 100% · questions  72% · sections 4 · stories 0 · over budget 1 · leaks 0 · NLT-marked notes 2 · missing verses 0
REV    404 verses · plain 100% (grade 5.6) · translators' notes   18 · readers differ   22 · facts  98% · key words  95% · questions  59% · sections 61 · stories 2 · over budget 1 · leaks 0 · NLT-marked notes 163 · missing verses 0
```
