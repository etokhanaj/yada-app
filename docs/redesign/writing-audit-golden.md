# Writing audit: the golden entries, for everyday readers

Judged with the writing-quality standard (audit mode) against the house style in
`reports/Simple yet deep scripture explanations.md`, for a first-time reader with a reading age of
about 9–12. Same format as `writing-audit-jhn-1-1.md`, which John accepted. These are **proposals**:
the entries are approved, and accepting any change sends the entry back to John's review queue
(CLAUDE.md rule 2). No fact is added; every revision keeps the claim, its qualifiers and its proper
names. Parse labels and Strong's numbers are never restated beyond what the data holds (rule 4).

Severity: **high** = meaning lost, a claim may overreach, or two fields contradict each other;
**medium** = a clean pattern match the reader can still decode; **low** = a revision note.
**needs John** = plain wording might change the meaning, or the finding is about accuracy or
fairness rather than wording.

Two findings apply to every entry and are not repeated in each table:

- **Parse claims** (for example "בָּרָא is a Qal perfect, third person masculine singular") are the
  evidence, so their labels stay. They belong in the Original evidence layer ("In the Hebrew", "In
  the Greek"), never on the first screen. The plain sense they support is carried by the key-word
  notes. Listed per entry under "Evidence layer only".
- **Bare "X is disputed"** (existing rule 2) appears in 10 of the 11 debated claims audited here. Each
  is rewritten to name the question.

---

## Genesis 1:1 (`golden/gen.1.1.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s1 | "The Hebrew Bible opens with seven words that name a beginning, an act, an actor, and two objects, and says nothing about method, material, or duration." | 26 words, two ideas; abstract nouns ("method, material, or duration"). | medium | "The Bible opens with seven Hebrew words naming a beginning, an act, the one acting and two objects. They do not say how, from what, or how long." |
| 2 | whats_happening, s2 | "…almost every question a modern reader brings to it is left unanswered on purpose." | "On purpose" states the writer's intent as fact; no claim supports it. | medium, **needs John** | Keep intent if John holds it: "The sentence is so simple that it leaves most of a modern reader's questions unanswered, on purpose." Otherwise drop "on purpose". |
| 3 | whats_happening, s3 | "The one genuine grammatical question is whether the first word starts a complete sentence or introduces a clause that waits for its main verb." | Teaser built on grammar ("clause", "main verb"). Also contradicts the claims: c10 is a second debated grammar question, so "the one genuine" overreaches. | **high**, **needs John** | "One open question is about the first word. Does it start a full sentence ('In the beginning God created') or a 'when' phrase ('When God began to create')?" |
| 4 | key_words[0] (רֵאשִׁית) | "…prefixed with the preposition bə-. Whether it stands alone or is bound to what follows is the central question of the verse." | Jargon ("preposition", "bound to"). | medium | "A noun meaning first or chief part, with bə- ('in') joined to the front. The verse's central question is whether it stands alone or links to the words after it." |
| 5 | key_words[1] (בָּרָא) | "A Qal perfect. The verb is used in the Hebrew Bible with God as its subject and never takes a stated material." | Label-colon fragment; "takes a stated material" is opaque. The God-only pattern holds for this stem (Qal), not the verb in every form, so "Qal" is doing work. | medium, **needs John** | "In this form, the Hebrew Bible uses the verb with God as its subject. It never says what the thing was made from." John to confirm "in this form" carries the Qal limit he intends. |
| 6 | key_words[2] (אֱלֹהִים) | "Plural in form. Here it governs a singular verb…" | Jargon ("governs"). | low | "Plural in form, but here it takes a singular verb ('he created'). That is the usual pattern when it means the God of Israel." |
| 7 | key_words[3] (אֵת) | "An untranslatable particle marking a definite direct object. Its presence twice shows both nouns are objects of the one verb." | Jargon ("particle", "definite direct object"). Longer proposal because it defines. | medium | "A small word with no English equivalent that marks the specific thing a verb acts on. It appears twice, so 'the heavens' and 'the earth' are both what God created." |
| 8 | translation_note | "English needs a tense the Hebrew does not have. The perfect בָּרָא marks completed action, not a past tense, so In the beginning God created and When God began to create are both defensible renderings of the same consonants." | 30-word sentence; jargon ("perfect", "renderings", "consonants"). The "so" ties the two readings to the verb's tense, but c9 says they come from how the first word is read. | **high**, **needs John** | "Hebrew verbs show whether an action is complete, not whether it is past, so English must pick a tense. The two readings in c9 both fit the written letters, which had no vowels." John to decide whether the two readings belong here or only in c9. |
| 9 | claims c5 | "The Masoretic pointing of the Westminster Leningrad Codex parses רֵאשִׁית here as an absolute noun rather than a construct." | Five specialist terms in one sentence. | medium | "In the Westminster Leningrad Codex, the vowel marks added by Jewish scribes (the Masoretes) read רֵאשִׁית as standing alone, not linked to the next word." |
| 10 | claims c8 | "Other creation accounts from the ancient Near East characteristically open with a temporal clause of the form when such and such was not yet." | Jargon ("ancient Near East", "temporal clause", "characteristically"). | medium | "Other creation stories from the ancient Near East (the lands around Israel) usually open with a 'when' clause, such as 'when X did not yet exist'." |
| 11 | claims c9 | "Whether the first word opens an independent sentence or a temporal clause is disputed." | Bare "is disputed"; jargon. | medium | "Readers disagree whether the first word starts a full sentence or a 'when' clause." |
| 12 | c9 positions labels | "Absolute: In the beginning God created" / "Construct: When God began to create" | Grammar terms as position names. | medium | "Stands alone: In the beginning God created" / "Linked: When God began to create" |
| 13 | c9 positions[0].case | "The Masoretic pointing and the accent supplied by the tradition read the noun as absolute, which makes verse 1 a complete sentence and a summary statement standing over the account that follows." | 32 words; jargon. | medium | "The vowel and accent marks added by the Masoretes read the noun as standing alone. That makes verse 1 a complete sentence, summing up the account that follows." |
| 14 | c9 positions[1].case | One 36-word sentence ("characteristically stands in construct… unpointed consonants… temporal clause whose main verb arrives in verse 3…"). | Overlong; four jargon terms. | medium | "Elsewhere רֵאשִׁית usually links to the word after it. The letters alone, without vowel marks, allow verse 1 to be a 'when' clause completed in verse 3. Comparable ancient creation stories open this way." |
| 15 | c10 claim | "What the plural form of אֱלֹהִים with a singular verb signals is disputed." | Bare "is disputed". | medium | "Readers disagree about what it means that the plural word אֱלֹהִים takes a singular verb." |
| 16 | c10 positions labels | "Plural of majesty" / "Inherited divine title" | Specialist names. | low, **needs John** | "A plural of honour" / "An inherited title" |
| 17 | c10 positions[0].case | "Hebrew uses plural forms for intensity or honour with singular referents…" | Jargon ("singular referents"). | low | "Hebrew can use a plural form for one thing, to show intensity or honour. The singular verb shows the writer treats the word as singular throughout." |
| 18 | c10 positions[1].case | "The plural is a frozen form carried over from wider Semitic usage for deity, so it signals nothing about number and the singular verb is simply the grammar catching up with the meaning." | 33 words; jargon ("Semitic", "deity"); figurative ("grammar catching up"). | medium | "The plural is a fixed form, inherited from related languages' word for a god. So it says nothing about number, and the singular verb simply matches the meaning." |
| 19 | related_passages GEN.1.2 | "…where the construct reading places the main clause." | Jargon; and it contradicts c9 positions[1], which puts the main verb in verse 3. | **high**, **needs John** | Once John picks verse 2 or 3: "What the earth was like, and where the 'when' reading puts the main statement." |
| 20 | related_passages JHN.1.1 | "John's Gospel opens with the same two words and places the Word before the beginning." | "Before the beginning" goes past John's text ("In the beginning was the Word"). "Same two words" is true of the Greek Old Testament, not the one-word Hebrew. | **high**, **needs John** | "John's Gospel opens with the same words, 'In the beginning', and says the Word already was." |
| 21 | related_passages PSA.33.6 | "…stated as poetry rather than narrative." | "Narrative". | low | "Creation by speech, told as a poem rather than a story." |

**Evidence layer only:** c1 (Qal perfect), c2 (masculine plural), c3, c4 (definite direct object), c6 (definite article).

**Passed (and why)**

- close_rendering: the verse itself.
- claims c7: plain and short.
- related_passages ISA.45.18: concrete.

---

## Leviticus 19:18 (`golden/lev.19.18.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s1 | "This is the last item in a run of short commands about how Israelites are to treat one another, and it moves from two prohibitions to a single positive command." | 30 words, two ideas; "prohibitions". | medium | "This is the last of a run of short commands about how Israelites should treat one another. It moves from two things not to do to one thing to do." |
| 2 | whats_happening, s2 | "The famous second half is grammatically bound to the first: the love commanded here is stated as the opposite of vengeance and grudge-bearing, not as a feeling." | 27 words; "grammatically bound" is a teaser. "Not as a feeling" is an inference from the grammar, stated as fact (house style: fact, then inference). | medium, **needs John** | "In the Hebrew, the famous second half is joined to the first. So the love commanded here is set against revenge and grudges, not described as a feeling." |
| 3 | key_words[0] (אָהַב) | "A perfect with waw consecutive, which continues the force of the imperfect prohibitions before it rather than starting something new." | Three grammar labels; the plain point is hidden. The labels stay in c1 and c3. | medium | "This verb form carries on the two 'you shall not' commands before it, rather than starting something new." |
| 4 | key_words[1] (רֵעַ) | "One written word carrying three morphemes: preposition, noun in construct, and a second person suffix." | Jargon; and a word fact that does not change the reading (house style: word notes only when the sense matters). | medium | Drop the note, or: "One Hebrew word made of three parts: 'to', 'neighbour' and 'your'." |
| 5 | translation_note | "…render the command as love your neighbour, dropping the preposition. The Hebrew has the verb governing its object with לְ, which is unusual for this verb and is hard to carry into English without sounding odd." | Jargon ("render", "preposition", "governing its object"); 26-word sentence. | medium | "Most English versions say 'love your neighbour', leaving out a small word. The Hebrew says, in effect, 'love to your neighbour'. That is unusual for this verb, and sounds odd in English." |
| 6 | claims c2 | "The verb אהב governs its object here with the preposition לְ rather than taking a direct object." | Jargon. | low | "Here the verb אהב ('love') puts לְ ('to') before its object, instead of taking the object directly." |
| 7 | claims c4 | "לְרֵעֲךָ is one written word carrying three morphemes." | "Morphemes". | low | "לְרֵעֲךָ is one written word made of three parts." |
| 8 | claims c5 | "The verse ends with אֲנִי יְהוָה, a clause with no verb." | "Clause"; the reader can't see which words these are. | low | "The verse ends with אֲנִי יְהוָה, 'I am the LORD', which has no verb in Hebrew." |
| 9 | claims c6 | "The command closes a run of case laws about conduct toward others running from Leviticus 19:11." | "Case laws" is a specialist term, and verses 11–18 are short commands (as whats_happening says), not "if X, then Y" cases. | medium, **needs John** | "The command closes a run of laws about how to treat others, starting at Leviticus 19:11." |
| 10 | claims c7 | "…extends a command of the same form to the resident foreigner." | "Resident foreigner". | low | "Sixteen verses later, the same chapter gives a command of the same form about the foreigner living among them." |
| 11 | claims c8 | "Ancient Near Eastern law collections generally state case law without appending a motive clause." | Jargon ("Ancient Near Eastern", "case law", "motive clause"); teaser, since it does not say what follows for this verse. Many read "I am the LORD" as a motive clause, which cuts against whats_happening s3. | medium, **needs John** | "Law collections from the ancient Near East (the lands around Israel) usually state laws without giving a reason for them." John to decide what this context is for. |
| 12 | claims c9 | "How far רֵעֲךָ extends is disputed." | Bare "is disputed". | medium | "Readers disagree about who counts as 'your neighbour' (רֵעֲךָ) here." |
| 13 | c9 positions[0].case | "The first half of the same verse names בְּנֵי עַמֶּךָ, the sons of your people, which sets the frame for the neighbour in the second half and keeps the command inside the community." | 33 words; "sets the frame" is figurative. | medium | "The first half of the verse names בְּנֵי עַמֶּךָ, 'the sons of your people'. That defines the neighbour in the second half, and keeps the command inside the community." |
| 14 | c9 positions[1].case | "Verse 34 issues the same command in the same words about the resident foreigner, which shows the chapter itself does not treat the boundary of your people as the limit of the obligation." | 33 words; abstract ("boundary… limit of the obligation"). Also "in the same words" contradicts c7 ("of the same form"); verse 34 does not repeat לְרֵעֲךָ. | **high**, **needs John** | "Verse 34 gives the same command, in the same form, about the foreigner living among them. So the chapter itself does not limit the command to 'your people'." |
| 15 | related_passages LEV.19.34 | "The same command applied to the resident foreigner." | "Resident foreigner". | low | "The same command, about the foreigner living among them." |

**Evidence layer only:** c1 (Qal perfect with waw consecutive), c3 (Qal imperfects).

**Passed (and why)**

- whats_happening, s3, "The verse ends by naming the speaker rather than giving a reason": concrete. (See #11 for a possible conflict.)
- key_words[2]: no note.
- c9 labels "Fellow Israelite" / "Any neighbour": plain, neutral, matched.
- related_passages MAT.22.39, ROM.13.9: concrete.
- "vengeance" in close_rendering: the reader's own Bible word.

---

## Psalm 23:1 (`golden/psa.23.1.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s1 | "The psalm opens by naming a relation and then stating what follows from it, in four Hebrew words with no verb joining the first two." | Abstract ("naming a relation"); 26 words. | medium | "In four Hebrew words, the psalm says who the LORD is to the speaker, then what follows. No verb joins the first two words." |
| 2 | whats_happening, s2 | "…almost everything the psalm goes on to say is an unpacking of the first half." | Mildly figurative ("unpacking"). | low | "The line has two halves, and almost everything the rest of the psalm says spells out the first." |
| 3 | whats_happening, s3 | "The word rendered my shepherd is not a noun but a participle, so the claim is about something God is doing rather than a title God holds." | Jargon ("participle", "rendered"); 27 words. "Not a noun" may overreach: this participle is also the ordinary Hebrew word for a shepherd. Same risk as the John 1:1 πρός note. | **high**, **needs John** | "'My shepherd' is a verb form, closer to 'the one shepherding me'. So the line is about what God does, more than a title." Send to the adversary first. |
| 4 | key_words[0] (רָעָה) | "A participle in construct with a first person suffix, so closer to the one shepherding me than to a fixed title." | Three grammar labels. | medium | "A verb form with 'my' attached, so closer to 'the one shepherding me' than to a fixed title." |
| 5 | translation_note | "Older English versions render the second half I shall not want… The Hebrew verb concerns shortage, not appetite…" | "Render", "appetite". | low | "Older English versions say 'I shall not want', using 'want' in its old sense of 'lack'. The Hebrew verb is about running short, not desire, so modern versions avoid 'want'." |
| 6 | claims c4 | "The Masoretic text counts the superscription מִזְמוֹר לְדָוִד inside verse 1, where English versification places it before the numbered verse." | Three specialist terms ("Masoretic text", "superscription", "versification"). | medium | "The Masoretic text (the standard Hebrew text) counts the heading מִזְמוֹר לְדָוִד as part of verse 1. English Bibles print it above verse 1, unnumbered." |
| 7 | claims c6 | "Shepherd was a widely used image for a king or a deity in the ancient Near East." | "Deity", "ancient Near East". | low | "In the ancient Near East (the lands around Israel), 'shepherd' was a common picture of a king or a god." |
| 8 | claims c7 | "What time frame the imperfect אֶחְסָר carries is disputed." | Bare "is disputed"; "imperfect". | medium | "Readers disagree whether 'I shall not lack' (אֶחְסָר) speaks of the future or of how things generally are." |
| 9 | c7 positions labels | "Future" / "General present" | "General present" is a grammar label. | low | "Future" / "Generally true" |
| 10 | c7 positions[0].case | "The Hebrew imperfect commonly carries future reference, which makes the line a statement of confidence about what is to come rather than a report of present circumstances." | 27 words; jargon. | medium | "This Hebrew verb form commonly points to the future. Read that way, the line expresses confidence about what is to come, not a report on the present." |
| 11 | c7 positions[1].case | "The imperfect also expresses habitual or characteristic action, which makes the line a statement about how things stand generally, matching the settled tone of the psalm's remaining verses." | 28 words; jargon ("habitual or characteristic action"). | medium | "The same form also describes what usually or typically happens. Read that way, the line says how things generally stand, matching the settled tone of the rest of the psalm." |
| 12 | related_passages PSA.23.2-23.3 | "The shepherd image is unpacked into specific actions." | Mildly figurative. | low | "The shepherd picture is spelled out in specific actions." |

**Evidence layer only:** c1 (Qal active participle in construct), c2 (Qal imperfect).

**Passed (and why)**

- close_rendering: the verse.
- key_words[1]: "lacking or coming up short, not about desiring" is plain and says what matters.
- claims c3, c5: concrete. c3 could gloss the two words ('the LORD', 'my shepherd').
- related_passages EZK.34.11-34.16, JHN.10.11: short and concrete.

---

## Isaiah 53:5 (`golden/isa.53.5.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | close_rendering | "…pierced from our transgressions, crushed from our iniquities. The chastisement of our peace was upon him…" | "Transgressions", "iniquities", "chastisement" are the reader's Bible words, so they stay (house style: keep and define once). "The chastisement of our peace" is hard to parse at any age. | low, **needs John** | Keep the rendering. Define once, in a key-word or translation note: "transgressions and iniquities: wrongdoings; chastisement: punishment or discipline". |
| 2 | whats_happening, s1 | "A group speaking as we describe what happened to a single figure, and the whole verse turns on the contrast between the two." | "Speaking as we" reads as a typo without quote marks; "turns on" is figurative. "Figure" must stay neutral (c9 is whether it is one person or Israel). | medium | "A group speaking as 'we' describes what happened to someone they call 'him'. The whole verse rests on the contrast between them." |
| 3 | whats_happening, s2 | "Every noun of wrongdoing carries an our, and every verb of suffering is attached to a him." | Grammar framing ("noun", "verb"). | low | "Every wrongdoing is 'ours', and every suffering is 'his'." |
| 4 | whats_happening, s3 | "The Hebrew joins the two with a preposition that can mean either because of or away from, and that one preposition carries much of the weight of how the verse has been read." | 33 words; "preposition"; figurative ("carries much of the weight"). | medium | "The Hebrew links them with one small word, מִן, which can mean 'because of' or 'away from'. Much of how the verse has been read depends on that word." |
| 5 | key_words[0] (חָלַל) | "A passive participle. The root covers piercing and being fatally wounded." | Label fragment; "root". | medium | "Describes something done to him. The word covers both piercing and being fatally wounded." |
| 6 | key_words[1] (פֶּשַׁע) | "The prefixed מִן can mark cause, source, or separation, and the choice between them changes what the line asserts." | Abstract ("cause, source, or separation"). | medium | "מִן, joined to the front, can mean 'because of', 'coming from' or 'away from'. Which one is meant changes what the line says." |
| 7 | key_words[2] (רָפָא) | "A Niphal perfect, third person masculine singular, with the healing stated impersonally rather than of a named subject." | Four grammar labels; "impersonally". | medium | "Literally 'it was healed': the healing is stated without naming who is healed." |
| 8 | key_words[3] (חַבּוּרָה) | "One written word carrying four morphemes: conjunction, preposition, noun in construct, and a third person suffix." | Jargon; a word fact that does not change the reading. | medium | Drop the note, or: "One Hebrew word made of four parts: 'and', 'by', 'wound' and 'his'." |
| 9 | translation_note | "English versions differ on the preposition מִן: for our transgressions, because of our transgressions, and from our transgressions are all defensible renderings of the same consonants, and they do not assert the same thing." | 34 words; "renderings", "consonants". | medium | "English versions translate מִן differently: 'for', 'because of' or 'from' our transgressions. Each is a fair reading of the Hebrew, but they do not say the same thing." |
| 10 | claims c3 | "…one written word carrying four morphemes." | "Morphemes". | low | "…one written word made of four parts." |
| 11 | claims c4 | "The preposition מִן is prefixed to both פְּשָׁעֵנוּ and עֲוֺנֹתֵינוּ." | Jargon; the reader cannot tell which words. | low | "The small word מִן is joined to the front of both פְּשָׁעֵנוּ ('our transgressions') and עֲוֺנֹתֵינוּ ('our iniquities')." |
| 12 | claims c5 | "Every noun of wrongdoing in the verse carries a first person plural suffix while every reference to the sufferer is third person masculine singular." | Grammar labels for a plain observation. | medium | "Every word for wrongdoing in the verse has 'our' attached, while every reference to the sufferer is 'he' or 'him'." |
| 13 | claims c8 | "This passage has been read both collectively and individually since antiquity." | "Collectively", "antiquity". | low | "Since ancient times, this passage has been read both as about a people and as about one person." |
| 14 | claims c9 | "Who the sufferer of this passage is is disputed." | Bare "is disputed"; "is is". | medium | "Readers disagree about who the sufferer in this passage is." |
| 15 | c9 positions labels | "Israel collectively" / "An individual distinct from the people" | "Collectively". | low | "Israel as a people" / "One person, distinct from the people" |
| 16 | c9 positions[0].case | One 38-word sentence ("…reading the sufferer as the people among the nations keeps the term consistent… with the speaking we understood as the nations looking on."). | Overlong. | medium | "In the surrounding chapters, Isaiah names Israel as the servant. Reading the sufferer as Israel among the nations keeps that term consistent across the book. The 'we' are then the nations looking on." |
| 17 | c9 positions[1].case | "The sufferer is set over against the speaking we throughout the passage, bearing what belongs to them, which is difficult to sustain if the sufferer and the speakers are the same body." | 32 words; "same body". Fairness: position 0 says the "we" are the nations, not Israel, so this rebuts a reading no position holds (house style: matched structure, G7). | **high**, **needs John** | Wording: "Throughout the passage, the sufferer is set apart from the 'we' who speak, and bears what belongs to them. That is hard to explain if the sufferer and the speakers are the same group." The fairness point needs John. |
| 18 | claims c10 | "What relation the preposition מִן marks between the suffering and the transgressions is disputed." | Bare "is disputed"; abstract. | medium | "Readers disagree about how מִן links the suffering to the transgressions." |
| 19 | c10 positions[1].case | "מִן also marks movement away from something, giving a sense in which the suffering removes the speakers from their transgressions rather than being caused by them." | 26 words. Position 0 says "commonly", position 1 "also": a slight tilt (G7). | low, **needs John** on the tilt | "מִן can also mean 'away from'. Read that way, the suffering takes the speakers away from their transgressions, rather than being caused by them." |
| 20 | related_passages ACT.8.32-8.33 | "The passage read and asked about in Acts, with the identity question raised in the text itself." | Vague ("the identity question"). | low | "In Acts, someone reading this passage asks who it is about." |

**Evidence layer only:** c1 (passive participle), c2 (Niphal perfect).

**Passed (and why)**

- claims c6, c7: concrete, short.
- c10 positions[0].case: 24 words, plain once "marks cause" reads "often means 'because of'" (optional).
- related_passages ISA.52.13-52.15, ISA.49.3, 1PE.2.24: concrete.

---

## 1 Corinthians 14:34 (`golden/1co.14.34.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s1 | "Paul is closing a long section on how the Corinthian assembly should conduct its gatherings, where prophets and tongue-speakers have been talking over one another." | "Assembly", "conduct its gatherings"; "tongue-speakers" undefined. Defining tongues or prophecy is itself contested across traditions. | medium, **needs John** | "Paul is closing a long section on how the church in Corinth should run its meetings, where prophets and people speaking in tongues have been talking over one another." John to decide whether "speaking in tongues" gets a definition. |
| 2 | whats_happening, s3 | "This verse applies that same instruction to a third group, and the disagreement is over exactly which speech, and which women, are in view." | Two ideas. Consistency: no debated claim covers "which speech", and the manuscript question (c9) is not mentioned on the top layer (house style: the top layer says a question is open when the deep layer shows it). | medium, **needs John** | "This verse gives the same instruction to a third group. Readers disagree about which speech, and which women, are meant." Plus a c9 mention if John wants one. |
| 3 | key_words[0] (σιγάω) | "…in both cases as a situational instruction rather than a permanent ban." | "Situational instruction". Placing this in the word note leans toward one reading of verse 34. | low, **needs John** on the lean | "Paul uses the same verb for those speaking in tongues in verse 28 and prophets in verse 30. Both times it means 'be quiet in this situation', not 'never speak'." |
| 4 | translation_note | "BSB, WEB, and KJV agree closely here; the divergence between English versions in this passage is mainly punctuation and paragraphing, which affects where the sentence is felt to begin and end." | Unexplained abbreviations; "divergence"; 25 words after the semicolon. | medium | "The BSB, WEB and KJV translations agree closely here. English versions differ mainly in punctuation and paragraph breaks, which change where the sentence seems to begin and end." |
| 5 | claims c4 | "…a block of instructions about order in the gathered assembly (1 Cor 14:26-40)." | "Gathered assembly". | low | "…a block of instructions about order in church meetings (1 Cor 14:26-40)." |
| 6 | claims c6 | "Formal rhetorical and scriptural education was generally less available to women than to men in first-century Greco-Roman cities." | "Rhetorical", "Greco-Roman"; the reader is not told why it matters here. | medium | "In first-century Greek and Roman cities, women generally had less access than men to formal training in public speaking and the scriptures." |
| 7 | claims c7 | "Who the instruction addresses is disputed." | Bare "is disputed" (flagged in the John 1:1 audit). | medium | "Readers disagree whether this means women in general or wives in particular." |
| 8 | c7 positions[0].case | "The plural αἱ γυναῖκες is unqualified in v. 34…" | "Unqualified" reads as "not qualified" to a young reader. | medium | "In verse 34, 'the women' (αἱ γυναῖκες) is not narrowed down, and the appeal to the law and to the churches is general, not about a household relationship." |
| 9 | c7 positions[1].case | "Verse 35 tells them to ask their own husbands at home, and γυνή is the ordinary word for wife, so the following verse supplies the domestic frame the noun leaves open." | 31 words; "domestic frame". | medium | "Verse 35 tells them to ask their own husbands at home. γυνή is the ordinary word for wife, so verse 35 gives the household setting the noun leaves open." |
| 10 | claims c8 | "SBLGNT marks three points of textual variation inside this verse." | "SBLGNT", "textual variation". | medium | "The SBL Greek New Testament (SBLGNT) marks three places in this verse where manuscripts differ." |
| 11 | claims c9 | "Where verses 34 and 35 stood in the earliest text is disputed." | Bare "is disputed" (flagged in the John 1:1 audit). | medium | "Manuscripts place verses 34 and 35 in two different spots, and readers disagree about where they first stood." |
| 12 | c9 positions[0].case | "…carried by the bulk of the manuscript tradition." | "Bulk of the manuscript tradition". | low | "Standard editions print the verses here, and most manuscripts have them here." |
| 13 | c9 positions[1].case | "Part of the tradition places the two verses at the end of the chapter, which has been taken to bear on whether they were part of Paul's own argument at this point." | 32 words; vague ("part of the tradition", "taken to bear on"). Structure: this is a fact, not a case for a reading, so the two positions lack matched parts (G7). | medium, **needs John** on structure | "Some manuscripts put the two verses at the end of the chapter. Readers have used this to ask whether they were part of Paul's own argument here." |
| 14 | related_passages 1TI.2.11-12 | "The other passage in the Pauline letters on women, teaching, and quietness." | "Pauline". "Paul's letters" would take a side on who wrote 1 Timothy. | low, **needs John** | "The other passage in the letters under Paul's name on women, teaching and quietness." |

**Evidence layer only:** c1 (present active imperative), c2 (nominative plural).

**Passed (and why)**

- whats_happening, s2: concrete and short. Naming the two conditions (vv. 28, 30) would help, but it adds content.
- key_words[1], key_words[3]: plain.
- claims c3, c5: concrete.
- c7 and c9 labels: plain and neutral.
- related_passages 1CO.11.5, 1CO.14.26-14.40: concrete.

---

## Revelation 13:18 (`golden/rev.13.18.json`)

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s2 | "The number is written out as three ordinary words rather than as a figure, and the verse says it is a number of a man without saying which man." | 29 words; "a figure" is ambiguous. "Which man" assumes a particular person, the side c9 debates. | **high**, **needs John** | "The number is written as three ordinary words, not in digits. The verse calls it 'a number of a man' without saying who or what is meant." |
| 2 | whats_happening, s3 | "This is the only place in the book that explicitly invites the reader to work something out." | Contradicts related_passages REV.17.9 ("The other place in the book that calls for a mind with wisdom"). | **high**, **needs John** | Change one of the two. For example: "This is one of two places in the book that call for wisdom, and the only one that asks the reader to calculate." |
| 3 | key_words[0] (ψηφίζω) | "An aorist imperative addressed to a third party. The verb is about reckoning or counting up, and is built on the word for a pebble used in counting." | Grammar labels; the pebble origin is etymology, which the house style rules out. | medium, **needs John** on dropping the pebble | "A command in the form 'let him…'. The verb means to count up or work out a total." |
| 4 | key_words[1] (ἄνθρωπος) | "Genitive and without the article, which leaves open whether a particular person or humanity in general is meant." | "Genitive", "article". | medium | "'Of a man', with no 'the', which leaves open whether a particular person or people in general is meant." |
| 5 | written-out number, four fields | key_words[2], translation_note, whats_happening s2 and claims c2 all say the number is spelled out. | Repetition (S5). | low | Keep it in whats_happening and c2; drop key_words[2]'s note or the translation_note's first sentence. |
| 6 | translation_note | "English versions print 666 as a figure, which the Greek does not. Writing it out as three words is part of what the verse is doing, since the reader is being asked to count rather than to recognise a symbol." | 28-word second sentence. "The Greek does not" is true of SBLGNT; some early manuscripts write the number with numeral letters. | medium, **needs John** | "English versions print 666 in digits; the Greek text here writes it as three words. That fits the verse: the reader is asked to count, not to recognise a symbol." |
| 7 | claims c3 | "ἀνθρώπου is genitive and stands without the article." | Grammar labels. | low | "ἀνθρώπου ('of a man') has no 'the' before it." Keep "genitive" in the evidence layer. |
| 8 | claims c5 | "SBLGNT marks the closing number and the pronoun before it as points of textual variation." | "SBLGNT", "pronoun", "textual variation". | medium | "The SBL Greek New Testament (SBLGNT) marks the final number, and the word 'its' before it, as places where manuscripts differ." |
| 9 | claims c7 | "Assigning numeric values to the letters of a name was an established practice in Greek and Hebrew writing." | Abstract; the key context reads as a footnote. | low | "Giving each letter of a name a number value was a known practice in Greek and Hebrew writing." |
| 10 | claims c8 | "What number the earliest text carried is disputed." | Bare "is disputed". | medium | "Some manuscripts have 616 instead of 666, and readers disagree about which is original." |
| 11 | c8 positions[0].case | "This is the reading printed by SBLGNT and carried by the bulk of the manuscript tradition…" | "Bulk of the manuscript tradition". | low | "SBLGNT prints this reading, most manuscripts have it, and the editors judged it original." |
| 12 | c8 positions[1].case | "A reading of six hundred sixteen is attested in part of the tradition, and any name proposed as the solution has to account for which of the two numbers it is being counted against." | 34 words; "attested". Structure: it gives no case for 616 being original, so the two positions are not matched (G7). | medium, **needs John** on structure | "Some manuscripts read six hundred sixteen. Any name offered as the answer has to say which of the two numbers it is counted against." |
| 13 | claims c9 | "Whether ἀριθμὸς ἀνθρώπου points to one person or characterises the number as human is disputed." | Bare "is disputed". | medium | "Readers disagree whether 'a number of a man' points to one person or means a human number." |
| 14 | c9 positions[1].case | "An anarthrous genitive readily carries a qualitative sense, giving a human number, so the line would be contrasting the beast with what is divine rather than encoding a name." | 29 words; "anarthrous genitive", "qualitative". | medium | "Without 'the', the phrase can easily describe a kind of number: a human one. The line would then contrast the beast with what is divine, rather than hiding a name in code." |
| 15 | c9 positions[0].case | "…only makes sense if there is something to arrive at…" | Mildly vague. | low | "The instruction to calculate only makes sense if there is an answer to reach, which points to the number standing for a specific name." |
| 16 | related_passages DAN.7.1-7.28 | "The beast imagery this chapter draws on." | "Imagery". | low | "The beasts in Daniel that this chapter draws on." |

**Evidence layer only:** c1 (aorist active imperative), c4 (present active participle).

**Passed (and why)**

- close_rendering: the verse.
- whats_happening, s1: concrete; "beast" is the reader's own word.
- key_words[2]: "letters standing for numerals" defines itself (see #5 on repetition).
- claims c2, c6: concrete.
- c8 and c9 labels: plain and neutral.
- related_passages REV.13.11-13.17, REV.17.9: plain (see #2 for the conflict).

---

## John 1:1, vocabulary only (`golden/jhn.1.1.json`)

Only words not already handled in `writing-audit-jhn-1-1.md`. Where that audit's accepted wording
already removes the word, the field is not listed.

| # | Field | Original | Problem | Severity | Proposed |
|---|---|---|---|---|---|
| 1 | whats_happening, s1 | "not with a birth or a genealogy" | "Genealogy" (John's own example). | medium | "not with a birth or a family tree" |
| 2 | whats_happening, s2–s3; claims c3, c4, c5, c11, c12 | "clause" (seven uses) | A grammar word; the earlier audit's proposals keep it. | medium | "part" or "line": "In the third part of the verse…" |
| 3 | key_words[0] | "a reasoned principle" | Abstract. | low | "a reason or principle behind things" |
| 4 | key_words[0]; claims c10; c12 positions[1].case | "Jewish wisdom writing", "wisdom language" | A genre label the reader can't place. | medium | "Jewish writings about wisdom" (define once; the earlier audit's "wisdom writers" needs the same) |
| 5 | claims c1 | "indicative" | Grammar label not covered before. | low | Evidence layer only. |
| 6 | claims c5, c6 | "governed by", "dative", "feminine" | Grammar labels not covered before. | low | Evidence layer only. |
| 7 | claims c8; c12 positions[1].case; related_passages JHN.1.14, JHN.20.28 | "prologue" (four uses) | Specialist word. | medium | First use: "the opening section (verses 1–18)"; then "the opening section". |
| 8 | claims c9 | "The Greek Old Testament" | Readers won't know the Old Testament was translated into Greek. | medium | "The early Greek translation of the Old Testament" |
| 9 | c11 positions labels | "Qualitative" / "Definite" / "Indefinite" | Grammar labels as position names. | medium, **needs John** | "God's nature" / "The same God" / "A god" |
| 10 | claims c12 | "Whether ὁ λόγος denotes a personal figure from the first verse…" | "Denotes"; bare "is disputed" (passed for clarity in the earlier audit, but it is the same pattern as c11). | medium | "Readers disagree whether 'the Word' is a person from verse 1, or only becomes one at verse 14." |
| 11 | c12 positions labels | "Personified expression first" | "Personified". | low, **needs John** | "Spoken of as a person, at first" |
| 12 | c12 positions[0].case | "a preposition of orientation toward a person" | Jargon, and it depends on the πρός sense the earlier audit flagged high (#2). | medium, **needs John** | Follow the decision on the earlier audit's #2. If kept: "a word meaning 'toward', used of a person". |
| 13 | c12 positions[1].case | "a divine attribute is spoken of as though it acted" | "Divine attribute". | low | "a quality of God is spoken of as though it acted" |
| 14 | John's Gospel, throughout | "Gospel" | A Bible term to keep, but a first-time reader may not know it. | low | Define once on first use: "his Gospel (his account of Jesus' life)". |

---

## Word list (across entries)

| Hard word | Where | Plain replacement |
|---|---|---|
| is disputed (bare) | GEN c9, c10; LEV c9; PSA c7; ISA c9, c10; 1CO c7, c9; REV c8, c9; JHN c11, c12 | "Readers disagree whether/about…", naming the question |
| participle | PSA wh, kw0, c1; ISA kw0, c1; REV c4 | "a verb form", or say what it does ("something done to him") |
| perfect / imperfect | GEN kw1, tn, c1; LEV kw0, c1, c3; PSA c2, c7 + positions; ISA kw2, c2; JHN | evidence layer only; in prose, say the sense ("points to the future") |
| Qal / Niphal / waw consecutive | GEN, LEV, PSA, ISA parse claims and key words | evidence layer only |
| construct / absolute | GEN kw0, c5, c9 + labels, rel GEN.1.2; LEV kw1; PSA kw0; ISA kw3 | "linked to the next word" / "standing alone" |
| morphemes | LEV kw1, c4; ISA kw3, c3 | "parts" |
| suffix | LEV kw1; PSA kw0; ISA kw3, c5 | "with 'my' / 'our' attached" |
| preposition / particle | GEN kw0, kw3; LEV tn, c2; ISA wh, kw1, tn, c4; JHN c12 | "a small word", plus its sense in quotes |
| governs | GEN kw2; LEV tn, c2; JHN c5, c6 | "takes", "is followed by" |
| (definite) direct object | GEN kw3, c4; LEV c2 | "the specific thing a verb acts on" |
| article / anarthrous / genitive | REV kw1, c3, c9 positions; JHN | "no 'the'"; "of" |
| aorist / imperative | REV kw0, c1; JHN | "a command in the form 'let him…'" |
| clause / temporal clause / motive clause | GEN wh, c8, c9; LEV c5, c8; JHN (7 uses) | "part", "line"; "a 'when' clause"; "a reason given for the law" |
| Masoretic / pointing / superscription / versification | GEN c5, c9; PSA c4 | "the vowel marks added by Jewish scribes (the Masoretes)"; "heading"; "verse numbering" |
| consonants / renderings | GEN tn; ISA tn | "the written letters"; "translations", "readings" |
| manuscript tradition / attested / textual variation | 1CO c8, c9; REV c5, c8 | "manuscripts"; "most manuscripts"; "places where manuscripts differ" |
| SBLGNT / BSB, WEB, KJV | 1CO c8, tn; REV c5, c8 | spell out once: "the SBL Greek New Testament (SBLGNT)"; "the BSB, WEB and KJV translations" |
| ancient Near East | GEN c8; LEV c8; PSA c6 | keep, define once: "(the lands around Israel)" |
| case law | LEV c6, c8 | "laws" (and see LEV #9 on accuracy) |
| deity / Semitic / plural of majesty | GEN c10 positions; PSA c6 | "a god"; "related languages"; "a plural of honour" |
| collectively / individually | ISA c8, c9 label | "as a people" / "as one person" |
| resident foreigner | LEV c7, c9, rel | "the foreigner living among them" |
| tongue-speakers / assembly | 1CO wh, kw0, c4 | "people speaking in tongues"; "church meetings" |
| rhetorical / Greco-Roman / Pauline | 1CO c6, rel | "public speaking"; "Greek and Roman"; "letters under Paul's name" |
| genealogy / prologue / Greek Old Testament / wisdom writing | JHN | "family tree"; "the opening section (verses 1–18)"; "the early Greek translation of the Old Testament"; "Jewish writings about wisdom" |
| narrative / imagery / unpacking | GEN rel; REV rel; PSA wh, rel | "story"; "picture"; "spells out" |
| transgressions / iniquities / chastisement | ISA close_rendering, tn, c4 | keep (reader's Bible words); define once: "wrongdoings", "punishment" |

## For the generation prompt (beyond the existing five)

6. **The top layer may not take a side.** Every sentence in whats_happening, key_words and
   translation_note must hold under every position of every debated claim (REV "which man", PSA
   "not a noun", LEV "not as a feeling", 1CO kw0).
7. **No field may contradict another.** The adversary checks that counts, verse numbers and "only"
   or "same words" claims agree across fields (REV "only place" vs 17:9; GEN 1:2 vs verse 3; LEV
   "same words" vs "same form"; GEN "the one genuine question" vs two debated claims).
8. **Every position argues for its own reading** with the same parts, and never rebuts a view no
   listed position holds (ISA c9 positions[1]; 1CO c9 and REV c8 second positions are facts, not cases).
9. **Name sources and specialist terms in plain words on first use**: edition names (SBLGNT,
   Westminster Leningrad Codex), "Masoretic", "ancient Near East", "Greek Old Testament", book genres.
10. **No "one word carrying N morphemes" notes**, and no etymology (the pebble). A word note gives
    the sense in this verse or is left empty.
11. **Scope a text claim to its edition** when manuscripts differ: "the Greek text here", not "the
    Greek" (REV translation_note).
