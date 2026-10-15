"""Passage summary without AI: an extractive summary of a pericope, from credited open data.

John chose an Understand built without AI (docs/no-ai-understand.md, 12 Oct 2026). A guide still needs a short
"what happens here" for each passage, and the UST already says each verse in plain words (grade ~7). This picks
the sentences that best carry the passage, keeps them in order, and adds who speaks (Glyssen, confident rows
only). Every word shown is the UST's (CC BY-SA 4.0) or a fixed template's: nothing is generated (rule 2, rule 4).

Method, in order:
1. Plain sentences: the passage's UST verses, alignment markup removed, split into sentences. UST's added words
   ({...}) are kept as words but the braces are dropped for scoring.
2. Score each sentence by
   - centrality: TextRank over content-word overlap, so sentences that share the passage's main words rank high;
   - coverage: content words a sentence adds that the chosen ones lack (greedy, so the summary isn't repetitive);
   - title words: overlap with the pericope's own title ("Nicodemus by night");
   - narrative: sentences that report an action (a named person or a past-tense verb) over pure dialogue, since a
     summary says what happens, and the guide shows who speaks separately;
   - position: a small bonus for the passage's first and last sentences, where narration usually sets and closes.
3. Choose greedily until the word budget (default 55 words) is met, then put the choices back in passage order.
4. Speakers: Glyssen `speaks` rows only, in order of first appearance, under Glyssen's own names.

Run: YADA_ROOT=/Users/johnetokhana/yada python3 packages/pipeline/prototypes/passage_summary.py JHN [PERICOPE_ID ...]
"""

import math
import os
import json
import re
import sqlite3
import sys
from collections import Counter

ROOT = os.environ.get("YADA_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
BUNDLES = f"{ROOT}/content/bundles"
UST_DIR = f"{ROOT}/content/raw/uw-ust/en_ust"
BUDGET = int(os.environ.get("SUMMARY_WORDS", "55"))

STOP = set("""a an the and or but if then so that this these those of to in into on onto at by for from with without
as is are was were be been being am do does did done have has had having it its it's he him his she her they them
their we us our you your i me my not no nor all any some each every who whom whose which what when where why how
will would shall should can could may might must also very just only even than too here there about after before
again because while until up down out over under said says say tell told one two three yes now very own such
people person thing things way day time made make makes god's""".split())


def ust_verses(path):
    """{(chapter, verse): plain text}. Markers can sit mid-line in poetry ("\\q1 \\v 2 …"), so the text is split on the
    markers themselves (same reader as assemble.py). {…} added words are kept; scoring drops the braces."""
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"\\zaln-[se][^\\]*?\\\*", " ", src)
    src = re.sub(r"\\w ([^|\\]+)\|[^\\]*\\w\*", r"\1", src)
    # A speaker heading (Song of Songs: "\sp The woman thinks about the man she loves") runs over several lines once
    # its words are aligned; it is not verse text, so it goes up to the next paragraph or verse marker (John, 12 Oct).
    src = re.sub(r"\\sp\b.*?(?=\\(?:q\d?|v|p|m|c|nb|li\d?|b)\b)", " ", src, flags=re.S)
    src = re.sub(r"(?m)^\\(?:s\w*|ms\d?|mt\d?|mr|toc\d|h|id|ide|usfm|sts|rem|cl|r)\b.*$", "", src)
    src = re.sub(r"\\(?:sr|r|mr)\s[^\\\n]*", " ", src)  # an inline section range ("\\sr 2:4-25") is not verse text
    src = re.sub(r"\\f .*?\\f\*", "", src, flags=re.S)
    out, ch, v = {}, 0, None
    for tok in re.split(r"(\\c \d+|\\v \d+(?:-\d+)?)", src):
        m = re.match(r"\\c (\d+)", tok)
        if m:
            ch, v = int(m.group(1)), None; continue
        m = re.match(r"\\v (\d+)(?:-(\d+))?", tok)
        if m:
            v = (int(m.group(1)), int(m.group(2) or m.group(1))); continue
        if ch and v:
            t = re.sub(r"\\[a-z0-9-]+\*?", " ", tok).replace("\\*", " ")
            t = re.sub(r"\s+([,.;:!?’”)])", r"\1", t)
            t = re.sub(r"([“‘(])\s+", r"\1", t)
            t = re.sub(r"\{\s+", "{", re.sub(r"\s+\}", "}", t))
            t = re.sub(r"\s+", " ", t).strip()
            # Alignment markup can split a possessive or contraction ("Jesse’ s son"): rejoin it.
            t = re.sub(r"(\w)\s*([’'])\s+(s|t|re|ll|ve|d|m)\b", r"\1\2\3", t)
            # And a number's thousands ("12, 000", Revelation 7:5), and a word run into an added word ("flaws{this way}").
            t = re.sub(r"(\d),\s+(\d{3})\b", r"\1,\2", t)
            t = re.sub(r"(\w)\{", r"\1 {", t)
            for n in range(v[0], v[1] + 1):
                out[(ch, n)] = (out.get((ch, n), "") + " " + t).strip()
    return out


SP_VERB = re.compile(r"^(.*?)\s+(?:speak|think|say|talk|respond|repl|prais|describ|sing|call|ask|answer|tell|continu|express|long|admir|invit|warn|imagin)\w*\b")


def ust_speakers(path):
    """{(chapter, verse): speaker} from the UST's own speaker headings ("\\sp The woman thinks about the man she
    loves"). The Song of Songs never names its speakers, so tN says the UST "places a header to identify the speaker";
    Glyssen marks every line there "uncertain". A verse takes the speaker whose heading came before it starts
    (John, 12 Oct: love poetry names its speakers)."""
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"\\zaln-[se][^\\]*?\\\*", " ", src)
    src = re.sub(r"\\w ([^|\\]+)\|[^\\]*\\w\*", r"\1", src)
    out, ch, cur = {}, 0, None
    for tok in re.split(r"(\\c \d+|\\v \d+(?:-\d+)?|\\sp\b.*?(?=\\(?:q\d?|v|p|m|c|nb|li\d?|b)\b))", src, flags=re.S):
        m = re.match(r"\\c (\d+)", tok)
        if m:
            ch = int(m.group(1)); continue
        m = re.match(r"\\v (\d+)(?:-(\d+))?", tok)
        if m and ch and cur:
            for n in range(int(m.group(1)), int(m.group(2) or m.group(1)) + 1):
                out[(ch, n)] = cur
            continue
        if tok.startswith("\\sp"):
            head = re.sub(r"\s+", " ", re.sub(r"\\[a-z0-9-]+\*?", " ", tok[3:])).strip()
            sm = SP_VERB.match(head)
            who = sm.group(1) if sm else (head if len(head.split()) <= 4 else None)
            if who:
                cur = who
    return out


OBS_DIR = f"{ROOT}/content/raw/uw-obs/en_obs/content"
TABLES = f"{ROOT}/content/raw/bsb-tables/bsb_tables.tsv"


def clean_footnote(raw):
    """A BSB footnote as plain text. A quoted verse inside it keeps its verse number in a span ("<span
    class=|fnv|>9</span>But they quickly reported…", Mark 16:8), which glues onto the next word ("9But") once the
    markup goes: the number is dropped first (John, 12 Oct)."""
    t = re.sub(r"<span class=\|fnv\|>\s*\d+\s*</span>", "", raw)
    t = re.sub(r"<[^>]+>|\|", "", t)
    t = re.sub(r"(?:(?<=^)|(?<=[\s:“(]))\d+(?=[A-Z][a-z])", "", t)
    return re.sub(r"\s+", " ", t).strip()


def footnote_fact(f):
    """(fact, rest): a footnote shows as one plain sentence at most; anything after it waits behind "Read the note"
    (John, 12 Oct: Mark 16:8's note ran on into the whole short ending)."""
    parts = re.split(r"(?<=[a-z0-9][.!?])\s+(?=[A-Z])", f.strip(), maxsplit=1)
    return parts[0], (parts[1] if len(parts) > 1 else "")


def bsb_headings(book_name, footnotes=None, parallels=None):
    """[((chapter, verse), heading)] from the Berean BSB tables (public domain): the BSB's own section headings.
    When `footnotes` is a list, the BSB's manuscript footnotes [((c, v), text)] are collected into it too. When
    `parallels` is a list, each heading's cross-reference line [((c, v), ["Matthew 8:23–27", …])] goes into it: the
    BSB prints the same event's other tellings under the heading."""
    import csv
    csv.field_size_limit(10 ** 9)
    out, cur = [], None
    if not os.path.exists(TABLES):
        return out
    pat = re.compile(rf"^{re.escape(book_name)} (\d+):(\d+)$")
    for r in csv.reader(open(TABLES, encoding="utf-8-sig", errors="replace"), delimiter="\t"):
        if len(r) < 23:
            continue
        if r[12]:
            m = pat.match(r[12])
            cur = (int(m.group(1)), int(m.group(2))) if m else None
        if cur and r[13]:
            h = re.sub(r"\s+", " ", re.sub(r"<[^>]+>|\|", " ", r[13])).strip()
            if h:
                out.append((cur, h))
        if cur and parallels is not None and r[14]:
            parallels.append((cur, re.findall(r">([^<>]+?)</a>", r[14])))
        if cur and footnotes is not None and r[21]:
            f = clean_footnote(r[21])
            if re.search(r"manuscript", f):
                footnotes.append((cur, f))
    return out


def obs_stories(book_names):
    """unfoldingWord Open Bible Stories (CC BY-SA 4.0): [{title, frames, spans}], spans as (book, c1, v1, c2, v2) from
    each story's "_A Bible story from: …_" line. Images are dropped (no images in reading; their licence is unchecked)."""
    out = []
    if not os.path.isdir(OBS_DIR):
        return out
    norm = lambda n: n.replace("Psalms", "Psalm").strip().lower()
    by_name = {norm(nm): c for c, nm in book_names.items()}
    for f in sorted(os.listdir(OBS_DIR)):
        if not re.fullmatch(r"\d+\.md", f):
            continue
        t = open(f"{OBS_DIR}/{f}", encoding="utf-8").read()
        title = re.match(r"#\s*(.+)", t).group(1).strip()
        frames = [x.strip() for x in re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t).split("\n\n")[1:] if x.strip() and not x.strip().startswith("_")]
        ref = re.search(r"_A Bible story from:\s*(.+?)_", t)
        spans = []
        for part in (ref.group(1) if ref else "").split(";"):
            m = re.match(r"\s*((?:[1-3] )?[A-Za-z ]+?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?\s*$", part)
            if not m or norm(m.group(1)) not in by_name:
                continue
            c1, v1 = int(m.group(2)), int(m.group(3) or 1)
            if m.group(5):
                c2, v2 = int(m.group(4)), int(m.group(5))
            elif m.group(4) and m.group(3):
                c2, v2 = c1, int(m.group(4))
            elif m.group(4):
                c2, v2 = int(m.group(4)), 999
            else:
                c2, v2 = c1, (999 if not m.group(3) else v1)
            spans.append((by_name[norm(m.group(1))], c1, v1, c2, v2))
        out.append({"no": int(f[:-3]), "title": title, "frames": frames, "spans": spans})
    return out


def obs_candidates(story, john_text, verses):
    """Sentences from a story's frames that John's own account supports. Stories spanning several Gospels blend in
    details from Matthew, Mark or Luke: a sentence is kept only if most of its content words appear in this passage's
    BSB or UST text and every name in it does (rule 4: never state what John doesn't say)."""
    stem = lambda w: w.replace("’", "'")[:5]
    jw = {stem(w) for w in words(john_text)}
    jlow = john_text.lower()
    out = []
    for fi, fr in enumerate(story["frames"]):
        depth = 0  # open quotation marks before this sentence: a summary reports what happens, not part of a speech
        for si, sent in enumerate(sentences(fr)):
            inside_quote = depth > 0
            depth += sent.count("“") - sent.count("”")
            if inside_quote or "“" in sent or "”" in sent:
                continue
            ws = set(words(sent))
            if not ws or not balanced(sent):
                continue
            # A sentence that leans on the one before it ("This is what Pilate had told them…") means nothing alone.
            if re.match(r"(This|That|These|Those|He|She|They|It|His|Her|Their|Then)\b", sent):
                continue
            names = [n for n in re.findall(r"(?<![.!?“]\s)(?<!^)\b([A-Z][a-z]+)\b", sent) if n not in ("God", "Jesus", "Lord", "I", "Teacher")]
            if any(n.lower() not in jlow for n in names):
                continue
            # Synoptic details share common words with John, so the test is strict: nearly every content word (by
            # stem) must be in John's own verses, and any number too ("groups of 50" is Luke's, not John's).
            if sum(1 for w in ws if stem(w) in jw) / len(ws) < 0.85:
                continue
            if any(n not in jlow for n in re.findall(r"\b\d+\b", sent)):
                continue
            out.append((sent, (fi, si)))
    return out


TQ_DIR = f"{ROOT}/content/raw/uw-tq/en_tq"
# Letters argue rather than narrate: their headline says which part of the argument a passage belongs to ("Part of:"),
# from the narrowest outline section that contains it, however long. Narrative books keep "What happens:".
POETRY = {"PSA"}
OT = {"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB",
      "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
      "HAG", "ZEC", "MAL"}
# Major debates (John, 12 Oct): passages where readers divide and tN gives one side or none. A summary never settles
# them: no sentence comes from a short disputed range, and "Readers differ" shows only a note John (or a reviewer he
# trusts) wrote and approved. Until then nothing is shown and the report lists the passage. data/debates.json.
_HERE = os.path.dirname(os.path.abspath(__file__))
DEBATES = json.load(open(f"{_HERE}/data/debates.json", encoding="utf-8"))["entries"]
# Prophets: plain names for tN's outline words and one setting line per section (John, 12 Oct). data/prophets.json.
PROPHETS = json.load(open(f"{_HERE}/data/prophets.json", encoding="utf-8"))
LETTERS = {"ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
           "1PE", "2PE", "1JN", "2JN", "3JN", "JUD"}


def tq_answers(book):
    """[(chapter, verse, answer)] from unfoldingWord Translation Questions (CC BY-SA 4.0). Each answer is a plain,
    complete statement of a key fact in the passage, written so a reader can check they understood it, which is the
    job a summary sentence does. Answers that only restate a question's wording or are under 5 words are skipped."""
    path = f"{TQ_DIR}/tq_{book}.tsv"
    if not os.path.exists(path):
        return []
    out = []
    for line in open(path, encoding="utf-8").read().splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) < 7:
            continue
        m = re.match(r"(\d+):(\d+)", cols[0])
        # A trailing reference ("…to encourage them. 50:22-26") is the answer's citation, not part of what it says.
        ans = re.sub(r"\s*\(?\b\d+:\d+(?:[-–]\d+)?(?:,\s*\d+(?::\d+)?(?:[-–]\d+)?)*\)?\s*$", "", cols[6].strip()).strip()
        ans = re.sub(r"\s+([.,;:!?])", r"\1", ans)
        # An answer that leans on its question ("No.", "She told this…") means nothing alone in a summary.
        leans = re.match(r"(Yes|No|He|She|They|It|This|That|These|Those|Because|To|So)\b", ans)
        if m and not leans and len(ans.split()) >= 5 and ans.endswith((".", "!", "?")):
            out.append((int(m.group(1)), int(m.group(2)), ans))
    return out


TN_DIR = f"{ROOT}/content/raw/uw-tn/en_tn"


BOOK_WORD = re.compile(r"\s+(?:[1-3]\s)?(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Ezekiel|Daniel|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Hebrews|Revelation)$")


def clean_title(t):
    """An outline item, tidied: no trailing book name ("Joseph’s death Genesis"), single spaces, links as plain text.
    A book name that a preposition needs stays ("Introduction and purpose for Proverbs", John, 12 Oct)."""
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t.strip())
    if not re.search(r"\b(?:for|of|in|to|from|about|on|the)\s+(?:[1-3]\s)?[A-Z][a-z]+$", t):
        t = BOOK_WORD.sub("", t)
    return re.sub(r"\s+", " ", t).strip()


def md_(t):
    t = t.replace("\\n", "\n")
    t = re.sub(r"\[\[rc://[^\]]*\]\]", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    return t.replace("**", "")


def clean_heading(h):
    """A BSB heading as a reader should see it: entities decoded ("&#1488; ALEPH" → "א Aleph"), book divisions dropped
    ("BOOK I Psalms 1–41 The Two Paths" → "The Two Paths")."""
    import html as _html
    h = _html.unescape(h)
    h = re.sub(r"^BOOK [IVX]+\s+Psalms\s+\d+[–-]\d+\s*", "", h)
    h = re.sub(r"\b([A-Z]{3,})\b", lambda m: m.group(1).title(), h)
    return re.sub(r"\s+", " ", h).strip()


def glyssen_name(n):
    """Glyssen's own name for a speaker, without its bracketed notes ("voice of one calling (preparing way for
    Christ)" states one tradition's reading as fact) and without a cut-off tail ("seraph, one of the")."""
    n = re.sub(r"\s*\([^)]*\)", "", n).strip()
    n = re.sub(r",?\s+(?:one\s+)?of\s+the$", "", n).strip(" ,")
    return n


QUANTITY = r"(?:one|two|three|four|five|six|seven|some|another|still another|yet another|other|first|second|third|fourth|fifth|sixth|seventh|loud|powerful|many|several|all|both|certain)"


def display_name(n):
    """Glyssen files a speaker under its noun, with the count or adjective after a comma ("angels in white, two",
    "bystanders at Calvary, some"). A reader sees it the English way round: "two angels in white" (John, 12 Oct).
    Only a single trailing count or adjective moves; a list ("sea captains, seafarers, sailors") stays as it is."""
    m = re.fullmatch(rf"([^,]+),\s+({QUANTITY})", n.strip())
    return f"{m.group(2)} {m.group(1)}" if m else n


def is_plural(who):
    # A group speaks in the plural ("Chief priests say", "Disciples say"); one named person never does, whatever the
    # name ends in ("Cornelius says", "James says"), and "the man who told the guards and priests" is one man.
    subj = re.split(r"\s+(?:who|whom|that|of|from|to|in|at|on|with)\s+|,", who)[0].strip()
    ws_ = subj.split()
    head = ws_[-1] if ws_ else who
    group_names = {"Disciples", "Elders", "Pharisees", "Sadducees", "Jews", "People", "Crowds", "Soldiers", "Apostles",
                   "Israelites", "Philistines", "Levites", "Priests", "Seraphs", "Angels", "Brothers", "Sons", "Men", "Women"}
    return (head in group_names or head in ("women", "men", "people", "children")
            or (head.endswith("s") and head[:1].islower())
            or (len(ws_) > 1 and head.endswith("s") and head[:1].isupper() and ws_[0][:1].islower())
            or " and " in subj)


def framed(sentence, speaker, to=None):
    """Speech in a summary is always someone's: "God says: “…”", or "God tells Moses: “…”" when the passage names who
    is spoken to. Never Yada's own voice (Isaiah test, 12 Oct)."""
    who = "God" if speaker in ("God", "Yahweh", "LORD", "Lord", "Yahweh (God)") else display_name(speaker)
    verb = ("tell" if is_plural(who) else "tells") + f" {to}" if to else ("say" if is_plural(who) else "says")
    return f"{who[0].upper() + who[1:]} {verb}: “{inner(sentence)}”"


def inner(sentence):
    """A sentence placed inside a frame's quotation marks: its own quotations become single marks."""
    return sentence.strip().replace("“", "‘").replace("”", "’")


# ---- Modes by kind of writing (John, 12 Oct). Which passages take which mode, and every fixed line they show, are
# draft data for John (data/kinds.json, data/letters.json, data/plain_words.json); nothing shows as approved until he
# approves it (rule 2). The common rule: whenever the words belong to someone other than the narrator (a speaker, a
# letter writer, God giving commands, the Teacher, a vision), the summary says whose words they are.
KINDS = json.load(open(f"{_HERE}/data/kinds.json", encoding="utf-8"))
LETTER_DATA = json.load(open(f"{_HERE}/data/letters.json", encoding="utf-8"))
PLAIN = json.load(open(f"{_HERE}/data/plain_words.json", encoding="utf-8"))
GOSPELS = {"MAT", "MRK", "LUK", "JHN"}
# First- and second-person words: in a summary they are someone's words, never Yada's, so a sentence holding one
# outside quotation marks must be framed with its owner (gate check h).
PERSON = re.compile(r"\bI\b|\b(?i:me|my|mine|myself|we|us|our|ours|ourselves|you|your|yours|yourself|yourselves)\b")
QUOTE_FRAME = re.compile(r"^[^“]{1,90}? (?:says?|tells? [^:“]{1,60}?): “")
# Reported speech names its speaker itself ("The Teacher says that whatever seems new already existed … before us";
# "loud voices in heaven said that the kingdom of the world had become the kingdom of our Lord").
REPORTED_IN = re.compile(r"\b(?:says?|said|tells?|told|asks?|asked|wants?|wanted|commands?|commanded|warns?|warned)\b(?: [\w’]+){0,3} (?:that|to|if|whether|not to)\b")
REPORTED = re.compile(r"^(?:The )?[A-Z][\w’]*(?: [a-z’]+){0,2} (?:says?|said|tells?|told|asks?|asked|teaches|taught|writes|wrote|thinks|thought|advises|warns|urges)\b")
VISION = KINDS["voices"]["REV"]["vision"]


def mode_of(book, vs):
    """The passage's kind of writing, by its middle verse: Psalms, a draft range from kinds.json, a letter, a Gospel,
    or narrative."""
    if book in POETRY:
        return "psalms"
    mid = vs[len(vs) // 2]
    for m in KINDS["modes"]:
        if m["book"] == book and tuple(m["from"]) <= mid <= tuple(m["to"]):
            return m["mode"]
    return "letter" if book in LETTERS else "gospel" if book in GOSPELS else "narrative"


def kind_line(key, book, vs):
    """The draft setting or purpose line (kinds.json) whose range holds the passage."""
    return next(((x["line"], x["source"]) for x in KINDS[key] if x["book"] == book and tuple(x["from"]) <= vs[0]
                 and vs[-1] <= tuple(x["to"])), (None, None))


def ust_subs(text, book):
    """The approved word list (plain_words.json): "apprentices" → "disciples" (Mark test, 12 Oct). Returns the text
    and the changes made, which the UST credit names."""
    fired = []
    for s in PLAIN["ust_substitutions"]:
        scope = s["books"].split()
        if not (book in scope or ("NT" in scope and book not in OT)):
            continue
        to = s["to"]
        new = re.sub(rf"\b{re.escape(s['from'])}\b", lambda m: to[0].upper() + to[1:] if m.group(0)[0].isupper() else to,
                     text, flags=re.I)
        if new != text:
            fired.append(f"{s['from']} → {to}")
            text = new
    return text, fired


def plain_words(t):
    """tN's translator terms through the plain-words table ("quadrupeds" → "animals", Leviticus 11)."""
    for k, v in sorted(PLAIN["plain_words"].items(), key=lambda kv: -len(kv[0])):
        t = re.sub(rf"\b{re.escape(k)}\b", lambda m: v[0].upper() + v[1:] if m.group(0)[0].isupper() else v, t, flags=re.I)
    return t


def unquoted(s):
    return re.sub(r"“[^”]*”", " ", s)


def syllables(w):
    w = w.lower()
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and not w.endswith(("le", "ee")) and n > 1:
        n -= 1
    return max(1, n)


def grade(s):
    """Flesch–Kincaid grade of one sentence: a measure, not a judgment."""
    ws = re.findall(r"[A-Za-z’']+", s)
    if not ws:
        return 0.0
    return 0.39 * len(ws) + 11.8 * sum(syllables(w) for w in ws) / len(ws) - 15.59


# tQ answers follow the ULT's word order, which can put the verb before its subject ("By the witnesses of the Law and
# the Prophets has a righteousness … been made known", Romans 3:21). Such an answer reads harder than the UST's line for
# the same verse, so the UST line is used (John, 12 Oct).
INVERTED = re.compile(r"^(?:By|In|Through|With|From|To|Of|Into|Upon|On|At|For|Under|Among)\b[^,;.]{3,90}?\s"
                      r"(?:has|have|had|is|was|were|are|will|shall|did|does|do|can|could|would|should|must)\s+"
                      r"(?:a|an|the|this|that|these|those|his|her|their|its|our|God|he|she|they|it|we|you|I|[A-Z][a-z]+)\b")


def reads_harder(ans, ust_line, gap=True):
    """A measurable reason to prefer the UST over a tQ answer: inverted syntax anywhere; and in a letter, where tQ
    keeps the ULT's argument most closely, an answer whose sentences average at least 5 grades above the UST's for
    the verse. A grade on a short sentence turns on its names ("Abraham took another wife named Keturah" scores 12),
    so answers under 15 words are judged on syntax alone."""
    if INVERTED.match(ans):
        return "inverted syntax"
    us, qs = sentences(ust_line or ""), sentences(ans)
    if gap and us and qs and len(ans.split()) >= 15:
        g_ust = sum(grade(x) for x in us) / len(us)
        g_ans = sum(grade(x) for x in qs) / len(qs)
        if g_ans >= 12 and g_ans - g_ust >= 5:
            return "reads harder"
    return None


def repeats_itself(s):
    """A garbled sentence says the same four words twice ("If anyone’s enemies are going to kill him with a sword,
    they will kill him with a sword", Revelation 13:10)."""
    ws = re.findall(r"[a-z’']+", s.lower())
    # Five words with two content words among them: "show everyone how great" twice (John 17:1) is rhetoric, not a
    # garble.
    grams = [tuple(ws[i:i + 5]) for i in range(len(ws) - 4)]
    if any(n > 1 for g, n in Counter(grams).items() if sum(1 for w in g if w not in STOP) >= 2):
        return True
    # Or its condition and its result say the same thing ("if anyone’s enemies are going to capture him, they will
    # capture him", Revelation 13:10): every content word after the comma was already in the "if" clause.
    m = re.match(r"^\W*(?:If|When|Whenever)\b([^,]+),\s*([^,]+?)[.!?]?[’”]?$", s)
    if m:
        cond, res = set(words(m.group(1))), set(words(m.group(2)))
        return bool(res) and res <= cond
    return False


# A plan's sentence that gives a size or a count of parts ("50 loops", "100 cubits") is a measurement, not what the
# passage is about (John, 12 Oct, Exodus 26).
NUMBER = r"(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|half)"
MEASURE = re.compile(rf"\b(?:cubits?|spans?|handbreadths?|shekels?|talents?|meters?|centimeters?|feet|foot|inches|liters?|kilograms?)\b"
                     rf"|\b{NUMBER}(?:\s+\w+){{0,2}}\s+(?:loops|rings|clasps|fasteners|bars|frames|bases|sockets|posts|pillars|"
                     rf"curtains|hangings|boards|hooks|cups|branches|pieces)\b", re.I)


def also_told_in(book, vs, parallels, names_by_code, glyssen_par=()):
    """The other Gospels' tellings of this passage: the BSB's section parallels under the passage's headings, else
    Glyssen's parallel-passage column for its speech verses. Only what the data names (rule 4)."""
    names = {names_by_code[g]: g for g in GOSPELS if g != book}
    inside = set(vs)
    out = []
    for cv, refs in parallels:
        if cv in inside:
            for r in refs:
                r = r.replace("-", "–")
                if r.split(" ")[0] in names and r not in out:
                    out.append(r)
    if not out:
        for raw in glyssen_par:
            for part in re.split(r"\s*;\s*", raw):
                m = re.match(r"([1-3]?[A-Z]{2,3})\s+(\d+)[.:](\d+(?:[-–]\d+)?(?:,\d+)*)", part)
                if m and m.group(1) in GOSPELS and m.group(1) != book:
                    r = f"{names_by_code[m.group(1)]} {m.group(2)}:{m.group(3).replace('-', '–')}"
                    if r not in out:
                        out.append(r)
    return out


# ---- Psalms mode (John, 12 Oct): a psalm needs context more than a summary. Four short lines, all from data.
PSALM_KIND = [  # tN's type words → plain words John approves once; tN's jargon is never shown
    (r"penitential", "A prayer asking God to forgive"),
    (r"psalms? of trust|\btrust\b psalm", "A song of trust in God"),
    (r"thanksgiving", "A song of thanks"),
    (r"lament|supplication|complaint", "A prayer from someone in trouble"),
    (r"songs? of ascents", "A song for pilgrims going up to Jerusalem"),
    (r"worship psalms?", "A song of worship"),
    (r"royal psalm|\broyal\b|honou?ring the king", "A psalm about the king"),
    (r"wisdom psalm|\bwisdom\b", "A psalm about how to live"),
    (r"hymn|praise|enthronement", "A song of praise"),
    (r"imprecatory", "A prayer asking God to judge enemies"),
    (r"deliverance", "A psalm about God’s rescue"),
    (r"labeled as “prayers”|\bprayers?\b", "A prayer"),
]
TITLE_RE = re.compile(r"^(?:For the (?:choirmaster|director)|A (?:Psalm|Song|Maskil|Miktam|Prayer|Shiggaion)|Of (?:David|Solomon|Asaph|the sons)|According to|To the tune|With stringed|On the |A psalm|Of the sons|Concerning )")


def psalm_lines(c, vs, tn_rows, bsb_v1, label, stanza=None):
    lines, srcs = [], []
    intro = next((md_(r[6]) for r in tn_rows if r[0] == f"{c}:intro"), "")
    struct = intro.split("Structure and Formatting", 1)[-1].split("##", 1)[0] if intro else ""
    # 1. What kind
    # The type is named in the section's prose before its outline (the section opens on a blank line).
    prose = " ".join(p_ for p_ in struct.split("\n\n") if p_.strip() and not re.match(r"\s*\d+\.", p_.strip()))
    kind = next((plain for pat, plain in PSALM_KIND if re.search(pat, prose, re.I)), None)
    kind_label = "What kind"
    if not kind:
        # tN's own description ("Psalm 19 is a psalm about how God has revealed himself…"), capped at about 12 words.
        m = re.search(r"\b(?:is|was) (?:a|an) (?:psalm|song|poem) (about|of|in which) ([^.(]+)", prose)
        if m:
            ws = (m.group(1) + " " + m.group(2)).split()
            kind = "A psalm " + " ".join(ws[:12]).rstrip(",;") + ("…" if len(ws) > 12 else "")
    if not kind and re.search(r"(?:probably )?originally one psalm", prose + " " + intro):
        other = re.findall(r"[Pp]salms (\d+) and (\d+)", prose + " " + intro)
        kind, kind_label = (f"Psalms {other[0][0]} and {other[0][1]} were probably one psalm at first" if other else "Probably one psalm with its neighbour at first"), "About"
    if not kind:
        m = re.search(r"Purpose:\s*([^\n]+)", intro)
        if m:
            kind, kind_label = m.group(1).strip().rstrip(".")[0].upper() + m.group(1).strip().rstrip(".")[1:], "What it’s for"
    # 2. Title (the BSB superscription, split off verse 1)
    title_s = []
    for sent in re.split(r"(?<=[.])\s+", bsb_v1 or ""):
        if TITLE_RE.match(sent) or (title_s and re.match(r"^When ", sent)):
            title_s.append(sent)
        else:
            break
    title = " ".join(title_s)
    # 3. The picture: the intro's metaphor paragraph, else the first metaphor note, translator wording removed
    pic = None
    mm = re.search(r"### (?:Extended )?Metaphor\s*\n+(.+?)(?:\n|$)", intro)
    cand = mm.group(1) if mm else next((md_(r[6]).split("\n")[0] for r in tn_rows if r[0].startswith(f"{c}:") and r[0] != f"{c}:intro" and re.search(r"figs-(?:ex)?metaphor", r[3])), None)
    if cand:
        sent = re.split(r"(?<=[.])\s+", re.sub(r"\s*\(See:[^)]*\)", "", cand))[0]
        sent = re.sub(r"^.*?\bmetaphor in which\s+", "", sent)
        sent = re.sub(r"^Here,?\s+", "", sent)
        # A picture compares ("as if", "like"); a paragraph under the heading that only gives background (Psalm 42's
        # sons of Korah) is not one.
        if not re.search(r"your language|translat", sent, re.I) and len(sent.split()) >= 6 and re.search(r"\bas (?:if|though)\b|\blike\b|\bpicture|\bimage|\bspeaks? of\b|\bspeaking of\b|\brepresents?\b", sent):
            pic = sent[0].upper() + sent[1:]
    # 4. How it moves: the intro outline, at most 3 items, each about 12 words
    moves = []
    for item in re.findall(r"^\s*\d+\.\s+(.+?)\s*\((\d+(?:[–-]\d+)?)\)\s*$", struct, re.M):
        txt = re.sub(r"\s*\([^)]*\)", "", item[0]).strip()
        ws = txt.split()
        txt = " ".join(ws[:12]) + ("…" if len(ws) > 12 else "")
        rng = item[1].replace("-", "–")
        moves.append(f"{'Verses' if '–' in rng else 'Verse'} {rng}: {txt[0].lower() + txt[1:] if not re.match(r'^(David|Yahweh|God|Israel|Jerusalem|Zion)', txt) else txt}")
    if len(moves) > 3:
        moves = [moves[0], moves[len(moves) // 2], moves[-1]]
    # The turn, only where tN states one ("moves from intense distress … to renewed confidence", Psalm 77).
    turn = None
    mt = re.search(r"\bmoves from ([^.;]+? to [^.;]+?)(?: by [^.;]+)?[.;]", prose + " " + intro)
    if mt and len(mt.group(1).split()) <= 16:
        turn = "It moves from " + mt.group(1).strip() + "."
    # Written when: the superscription's occasion, only where the title gives one ("when the prophet Nathan came to
    # him…", Psalm 51). Never an "occasion unknown" line (John, 12 Oct).
    when = None
    mw = re.search(r"(?:^|,\s*|\.\s*)[Ww]hen (.+?)\.?$", title)
    if mw:
        # The occasion ends at its own sentence end; the BSB runs the title into verse 1 (Psalm 54: …among us?” Save me).
        occ = re.split(r"(?<=[.?!]”)\s+|(?<=[.])\s+", mw.group(1).strip())[0]
        author = re.search(r"\b[Oo]f (David|Solomon|Moses)\b", title)
        if author:
            # "when he fled", "came to him": the first pronoun becomes the named author, so the line stands alone.
            occ = re.sub(r"\b(?:he|him)\b", author.group(1), occ, count=1)
        when = "Written when " + (occ if occ.endswith("”") else occ.rstrip(".") + ".")
    if stanza:
        # Psalm 119's 22 stanzas: the stanza by name and what a stanza is; the psalm's type behind "About".
        m_ = re.search(r"([\u0590-\u05FF]\s*\w+)\s*$", label)
        lead = [("Stanza", f"{m_.group(1) if m_ else label} · {vs[0][0]}:{vs[0][1]}–{vs[-1][1]}", "BSB heading"),
                ("About", "One of 22 stanzas; each begins with the next letter of the Hebrew alphabet.", "tN intro (acrostic)")]
        return lead, ([(kind_label, kind, "tN intro")] if kind else [])
    # At most two lines before the psalm, in John's order (12 Oct): Written when → the turn or the main picture →
    # What kind. Everything else waits behind "About this psalm".
    pool = []
    if when:
        pool.append(("Written when", when, "BSB superscription"))
    if turn:
        pool.append(("The turn", turn, "tN intro"))
    elif pic and len(pic.split()) <= 22:
        # A picture longer than a line (Psalm 51's ink and scroll) waits behind "About this psalm".
        pool.append(("The picture", pic, "tN"))
    if kind:
        pool.append((kind_label, kind, "tN intro"))
    lead, about = pool[:2], pool[2:]
    if title:
        about.append(("Title", title, "BSB superscription"))
    if pic and not any(k_ == "The picture" for k_, _, _ in lead):
        about.append(("The picture", pic, "tN"))
    for mv in moves:
        about.append(("How it moves", mv, "tN outline"))
    return lead, about


def tn_book_outline(book):
    """The book-level outline in tN's front:intro ([(c1, v1, c2, v2, line)]), including whole-chapter items such as
    "Jesus meets with the disciples (21)" and the text-variant list ("The story of the adulterous woman (7:53–8:11)")."""
    path = f"{TN_DIR}/tn_{book}.tsv"
    out = []
    if not os.path.exists(path):
        return out
    for line in open(path, encoding="utf-8").read().splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) < 7 or cols[0] != "front:intro":
            continue
        for item in cols[6].split("\\n"):
            # The reference can be a link, a half verse ("7:1–9a", "[7:9b](…)-[8:3](…)", Song of Songs) or a list
            # ("[12:31–50](…), [13:1–22](…)", Exodus): the item runs from the first to the last.
            m = re.match(r"\s*(?:\d+\.|\*)\s+(.+?)\s*\(((?:b?\[?\d[\d:–\-ab]*\]?(?:\([^)]*\))?(?:,\s*|[–-])?)+)\)", item)
            if not m:
                continue
            parts = [p_ for p_ in re.split(r",\s*", re.sub(r"\]\([^)]*\)|\[", "", m.group(2))) if p_]
            ends = []
            for p_ in (parts[0], parts[-1]):
                r_ = re.match(r"b?(\d+)(?::(\d+))?[ab]?(?:[–-](\d+)(?::(\d+))?[ab]?)?", p_)
                if not r_:
                    break
                c1 = int(r_.group(1)); v1 = int(r_.group(2) or 1)
                if r_.group(4):
                    c2, v2 = int(r_.group(3)), int(r_.group(4))
                elif r_.group(3) and r_.group(2):
                    c2, v2 = c1, int(r_.group(3))
                elif r_.group(3):
                    c2, v2 = int(r_.group(3)), 999
                else:
                    c2, v2 = c1, (999 if not r_.group(2) else v1)
                ends.append((c1, v1, c2, v2))
            if len(ends) == 2:
                out.append((ends[0][0], ends[0][1], ends[1][2], ends[1][3], clean_title(m.group(1))))
    return out


def tn_guides(book):
    """From unfoldingWord Translation Notes (CC BY-SA 4.0):
    - events: [(chapter, v_start, v_end, line)] from each chapter introduction's outline, which names what happens in
      each section ("Jesus’ first sign: he turns water into wine (2:1–12)"). That names the key event to anchor on.
    - asides: verses the notes tag as background or out-of-order events (writing-background, figs-events), such as
      11:2 on Mary's later anointing. A summary of what happens leaves those out."""
    path = f"{TN_DIR}/tn_{book}.tsv"
    events, asides = [], set()
    if not os.path.exists(path):
        return events, asides
    for line in open(path, encoding="utf-8").read().splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) < 7:
            continue
        ref, support, note = cols[0], cols[3], cols[6]
        m = re.match(r"(\d+):(\d+)", ref)
        if m and re.search(r"writing-background|figs-events", support):
            asides.add((int(m.group(1)), int(m.group(2))))
        if re.match(r"\d+:intro", ref):
            for item in note.split("\\n"):
                # Numbered sections and "*" bullets both (Mark lists its passages as bullets); a single verse
                # ("Summary statement (4:33–34)" or "(4:33)") too. A section ending in a later chapter runs to this
                # chapter's end, since events carry one chapter.
                mm = re.match(r"\s*(?:\d+\.|\*)\s+(.+?)\s*\(\[(\d+):(\d+)(?:[–-](?:(\d+):)?(\d+))?\]", item)
                if mm:
                    c1, v1 = int(mm.group(2)), int(mm.group(3))
                    c2 = int(mm.group(4)) if mm.group(4) else c1
                    v2 = int(mm.group(5)) if mm.group(5) else v1
                    title_ = clean_title(mm.group(1))
                    events.append((c1, v1, v2 if c2 == c1 else 999, title_))
                    continue
                # Exodus writes its outlines as verse ranges of the chapter ("* v. 1–6: Inner covering").
                mv = re.match(r"\s*\*\s+v\.\s*(\d+)(?:\s*[–-]\s*(\d+))?:\s*(.+?)\s*$", item)
                if mv:
                    c = int(ref.split(":")[0])
                    events.append((c, int(mv.group(1)), int(mv.group(2) or mv.group(1)), clean_title(mv.group(3))))
    return events, asides


def outline_item(t):
    """An outline item names a section in a few words. A tN bullet that is prose ("There are multiple different
    curtains described using three different Hebrew words: …", Exodus 26) or that quotes the text for translators
    ("Third-person: “If his offering”", Leviticus 1) is not one (John, 12 Oct: plans and law headlines)."""
    return (len(t.split()) <= 20 and not re.search(r"[“”\[\];]|:\s|\.$", t)
            and not re.search(r"\b(?:person|singular|plural|masculine|feminine|Scenario|quote|ULT|UST)\b", t))


def sentences(text):
    # A sentence can also close with "}" or ")" and the next open with "(" (John 19:31's "…Jewish law}. (Since …").
    parts = re.split(r"(?:(?<=[.!?])|(?<=[.!?][’”)}]))\s+(?=[“‘{(A-Z])", text)
    return [p.strip() for p in parts if len(p.split()) >= 4]


def words(s):
    return [w for w in re.findall(r"[a-z’']+", s.lower().replace("{", "").replace("}", "")) if w not in STOP and len(w) > 2]


def textrank(sents, d=0.85, it=40):
    toks = [set(words(s)) for s in sents]
    n = len(sents)
    w = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j and toks[i] and toks[j]:
                ov = len(toks[i] & toks[j])
                if ov:
                    w[i][j] = ov / (math.log(len(toks[i]) + 1) + math.log(len(toks[j]) + 1))
    score = [1.0] * n
    for _ in range(it):
        new = []
        for i in range(n):
            s = 0.0
            for j in range(n):
                tot = sum(w[j])
                if w[j][i] and tot:
                    s += w[j][i] / tot * score[j]
            new.append((1 - d) + d * s)
        score = new
    top = max(score) or 1
    return [x / top for x in score]


def is_narrative(s, names):
    if s.startswith(("“", "‘")) and s.rstrip().endswith(("”", "’", "”.", "’.")):
        return 0.0
    hit = any(n.lower() in s.lower() for n in names)
    past = bool(re.search(r"\b\w+ed\b|\b(went|came|said|saw|told|gave|took|made|did|was|were|became)\b", s.lower()))
    return 1.0 if (hit and past) else 0.6 if past else 0.3


def balanced(s):
    """True when quotation marks open and close inside the sentence, so no speech is cut in half. A sentence that
    closes one quotation before it opens the next ("Get away from here!’” {Then Jesus continued by saying,} “You will
    see…", Luke 13:27) holds the end of one speech and the start of another (John, 12 Oct)."""
    # Single marks too, where a quotation inside a speech is cut ("‘You must not murder anyone." / "…punish them.’",
    # Matthew 5:21); a closing mark is one not followed by a letter, so "Jesse’s" is no quotation.
    singles_ok = len(re.findall(r"’(?![A-Za-z])", s)) >= s.count("‘") and (s.count("‘") or not re.search(r"’[”]?$", s))
    return (s.count("“") == s.count("”") and not s.startswith(("”", "’")) and singles_ok
            and ("”" not in s or ("“" in s and s.index("“") < s.index("”"))))


def narration(s):
    """A sentence that reports what happens, not one spoken inside the story."""
    return balanced(s) and not s.startswith("“")


def summarise(pid, label, start, end, ust, verses_of, names, budget=BUDGET, tq=(), events=(), asides=frozenset(), obs=None, extra=(), owner=None, divided=frozenset(), tq_gap=False, opening=None, opening_line=None):
    """`owner(cv, sentence, source)` gives the sentence as shown, framed with whose words it is ("Paul tells the
    believers in Rome: “…”"), or None to leave it out (a measurement in a plan, an unattributed tQ line inside God's
    speech). Scoring and the leaning checks use the sentence itself (`raw`); the reader sees the framed one."""
    vs = verses_of(start, end)
    inside = set(vs)
    sents, raw, where, source = [], [], [], []
    own = owner or (lambda cv, s, src: s)
    if obs:
        # Open Bible Stories already retell the passage in order and in plain words: when a story covers the passage,
        # its John-supported sentences are the pool. Order is the story's own (frame, sentence).
        for sent, (fi, si) in obs["pool"]:
            sents.append(sent); raw.append(sent); where.append((-1, fi * 100 + si)); source.append(f"OBS {obs['no']}.{fi + 1}")
        tq = ()
    # The translation questions' answers come first: they already state the passage's key facts in plain words.
    for (c, v, ans) in tq:
        if (c, v) in inside and balanced(ans):
            if reads_harder(ans, ust.get((c, v), ""), gap=tq_gap):
                continue
            parts = [x for x in sentences(ans) if balanced(x)] or [ans]
            # An answer covering an aside verse (e.g. 11:1–2 runs on into Mary's later anointing) keeps only its
            # first sentence, which is the part about this passage.
            if (c, v + 1) in asides or (c, v) in asides:
                parts = parts[:1]
            for x in parts:
                shown = own((c, v), x, "tQ")
                if shown is None or repeats_itself(x):
                    continue
                sents.append(shown); raw.append(x); where.append((c, v)); source.append("tQ")
    # The UST always joins the pool behind the tQ answers: the leaning filter can leave too few answers (John 21:1–14),
    # and a summary needs three distinct sentences. tQ answers keep a small bonus in scoring.
    if not obs:
        # The UST's sentences run across verses ("…created the earth and the heavens," continues in 2:5), so the
        # passage is joined first and split into whole sentences, each credited to the verse it starts in.
        joined, starts_at = "", []
        for (c, v) in vs:
            t_ = ust.get((c, v), "")
            if t_:
                starts_at.append((len(joined), (c, v)))
                joined += t_ + " "
        pos = 0
        for s in sentences(joined.strip()):
            at = joined.find(s, pos)
            pos = at + len(s) if at >= 0 else pos
            cv = next((w for off, w in reversed(starts_at) if off <= max(at, 0)), vs[0])
            if balanced(s) and re.search(r"[.!?][’”]?$", s) and not repeats_itself(s):
                shown = own(cv, s, "UST")
                if shown is not None:
                    sents.append(shown); raw.append(s); where.append(cv); source.append("UST")
        if opening_line and opening is not None:
            sents.append(opening_line[0]); raw.append(opening_line[1]); where.append(opening); source.append("UST")
        order = sorted(range(len(sents)), key=lambda i: (where[i], source[i] != "tQ"))
        sents, raw, where, source = ([xs[i] for i in order] for xs in (sents, raw, where, source))
    # Last in the body chain: Tyndale's first sentence on the range, then Open Bible Stories frames that match the book.
    for sent, srcname, pos in extra:
        sents.append(sent); raw.append(sent); where.append(pos); source.append(srcname)
    if divided:
        keep_ = [i for i in range(len(sents)) if where[i] not in divided]
        sents, raw, where, source = ([xs[i] for i in keep_] for xs in (sents, raw, where, source))
    # Every source, not only tQ answers: a sentence that leans on the one before it can't stand in a summary. Speech
    # framed with its speaker stands ("Job says: “I wish…”"); a vision frame doesn't make "he" stand.
    bare = lambda x: re.sub(r"[{}()]", "", x).strip()
    keep = [i for i, x in enumerate(raw) if QUOTE_FRAME.match(sents[i]) or (not LEANS.match(bare(x)) and not SPEECH.match(bare(x)) and not re.search(r"\bsaid this\b", x))]
    if len(keep) >= 3:
        sents, raw, where, source = ([xs[i] for i in keep] for xs in (sents, raw, where, source))
    if not sents:
        return None
    cen = textrank(sents)
    # The key event: the chapter outline line whose range starts inside this passage, if any.
    first = verses_of(start, start)[0]
    # A passage can span two outline sections (11:1–16 "returns to Judea", 11:17–44 "raises Lazarus"): take the one
    # that shares most words with the passage's own title, then the longer section.
    half = vs[len(vs) // 2] if vs else first
    last = vs[-1] if vs else first
    cands = [e for e in events if (e[0], e[1]) >= first and (e[0], e[1]) in inside and ((e[0], e[1]) <= half or (e[0], e[2]) <= last)]
    if not cands:
        # A section can begin a few verses earlier and contain the passage (6:22–71 holds 6:25–59).
        cands = [e for e in events if (e[0], e[1]) < first and e[0] == first[0] == last[0] and e[2] >= last[1]]
    tw = set(words(label))
    key = max(cands, key=lambda e: (len(set(words(e[3])) & tw), e[2] - e[1]))[3] if cands else ""
    title = set(words(label)) | set(words(key))
    narr = [i for i, s in enumerate(sents) if narration(s)]
    # An aside (Translation Notes: writing-background, figs-events) may introduce a passage, but it never carries
    # the turning point or the ending; 11:2's later anointing is background, not what happens.
    late = [i for i in range(len(sents)) if where[i] not in asides]
    pool = narr if len(narr) >= 2 else list(range(len(sents)))

    def score(i):
        ws = set(words(sents[i]))
        tit = len(ws & title) / max(1, len(title))
        return 0.55 * cen[i] + 0.3 * tit + 0.15 * is_narrative(sents[i], names) + (0.1 if source[i] == "tQ" else 0)

    # Setting: the first narration that names a person or place from the passage's own words.
    setting = next((i for i in pool if any(n.lower() in sents[i].lower() for n in names) or set(words(sents[i])) & title), pool[0])
    if opening is not None:
        # A passage that opens with someone speaking starts with that speech, not a later voice (John, 12 Oct,
        # approved: Isaiah 40:1–5 opens with "Comfort, comfort my people", not the voice of verse 3). The speech
        # itself (framed or quoted) is preferred over a tQ line about it.
        at = [i for i in range(len(sents)) if where[i] == opening
              and (QUOTE_FRAME.match(sents[i]) or not LEANS.match(re.sub(r"[{}()]", "", raw[i]).strip()))]
        spoken = [i for i in at if QUOTE_FRAME.match(sents[i]) or "“" in sents[i]]
        if spoken or at:
            setting = (spoken or at)[0]
    # Outcome: the last narration in the passage (how it ends), unless it is the setting.
    ends = [i for i in pool if i in late]
    outcome = ends[-1] if ends and ends[-1] != setting else None
    # Turning point: the most central sentence between them that adds new words.
    covered = set(words(sents[setting])) | (set(words(sents[outcome])) if outcome is not None else set())
    middle = [i for i in range(len(sents)) if setting < i < (outcome if outcome is not None else len(sents))]
    def overlap(i):
        ws = set(words(sents[i]))
        return len(ws & covered) / max(1, len(ws))
    # Never repeat the setting: a sentence mostly made of words already chosen adds nothing.
    middle = [i for i in middle if overlap(i) < 0.6 and i in late]
    # Choose the turning point among sentences that fit the budget with the setting and outcome, rather than dropping
    # it afterwards: three sentences beat two long ones (gate check f).
    base = len(sents[setting].split()) + (len(sents[outcome].split()) if outcome is not None else 0)
    fits = [i for i in middle if base + len(sents[i].split()) <= budget * 1.3]
    middle = fits or middle
    turn = max(middle, key=lambda i: score(i) + 1.5 * (len(set(words(sents[i])) & set(words(key))) / max(1, len(set(words(key))))) + 0.3 * (1 - overlap(i))) if middle else None
    picks = [i for i in (setting, turn, outcome) if i is not None]
    # Keep inside the budget: drop the turning point first, then the outcome, never the setting.
    def size(ix):
        return sum(len(sents[i].split()) for i in ix)
    for drop in (turn, outcome):
        if size(picks) > budget * 1.3 and drop in picks and len(picks) > 1:
            picks.remove(drop)
    picks.sort()
    srcs = [source[i] if source[i].startswith(("OBS", "Tyndale")) else f"{source[i]} {where[i][0]}:{where[i][1]}" for i in picks]
    detail = [{"text": sents[i], "raw": raw[i], "src": srcs[k], "where": where[i], "aside": where[i] in asides, "setting": i == setting}
              for k, i in enumerate(picks)]
    return key, joined_text(detail), srcs, detail


def joined_text(detail):
    """The summary as read. Neighbouring lines framed with the same speaker read as one frame: "Job says: “… …”",
    not "Job says: … Job says: …" (John, 12 Oct, Job)."""
    out, prev = [], None
    for d in detail:
        m = QUOTE_FRAME.match(d["text"])
        head = m.group(0) if m else None
        if head and head == prev and out and out[-1].endswith("”"):
            out[-1] = out[-1][:-1] + " " + d["text"][len(head):]
        else:
            out.append(d["text"])
        prev = head
    return " ".join(out)


# ---------------------------------------------------------------- gate (John, 12 Oct 2026)
# Summaries are extractive from credited sources, so they ship without per-entry approval. A bad pick can still
# mislead, so every summary passes these checks or is flagged, naming the check, for John to fix in the review tool.
# Blessings and commands the UST gives without quotation marks ("May you become great in the clan of Ephrathah…",
# Ruth 4:11) read as the summary's own voice: they are speech, not narration.
SPEECH = re.compile(r"^(?:May (?:you|he|she|they|it|the Lord|God|Yahweh)\b|Let (?:us|me|him|her|them|the)\b|Do not\b|Don’t\b|Go\b|Come\b|Listen\b|O\s|Oh\b|[A-Z][a-z]+, (?:you|do|go|come|listen|let|may|hear)\b)")
# A linking word before the pronoun leans just the same ("Instead, they will be priests…", Revelation 20:6; John,
# 12 Oct).
LEANS = re.compile(r"^(?:(This|That|These|Those|He|She|They|It|So|I|We|You)\b|(?:If|When|Because|After|Before|Although|Since|While)\s+(?:he|she|they|it|we|you|I)\b"
                   r"|(?:Instead|Rather|However|Therefore|Also|But|And|Then|So|Yet|Nevertheless|Indeed|As a result|For this reason|Because of this|One day|Later|Now|Soon|Next|After that|At that time|Sometime later),?\s+(?:he|she|they|it)\b)")
SAMPLE_PER_BOOK = 5


def gate(key, text, detail, obs_ok=True, budget=BUDGET, n_verses=99, need=None, mode="narrative"):
    fails = []
    if not key:
        fails.append("a: no headline")
    for d in detail:
        r_ = d.get("raw", d["text"])
        if not QUOTE_FRAME.match(d["text"]) and (LEANS.match(re.sub(r"[{}()]", "", r_).strip()) or re.search(r"\bsaid this\b", r_)):
            fails.append(f"b: leans on missing context ({d['src']})")
    if len(text.split()) > budget * 1.3:
        fails.append(f"c: over budget ({len(text.split())} words)")
    for d in detail:
        if d["aside"] and not d["setting"]:
            fails.append(f"d: aside verse carries the story ({d['src']})")
    if not obs_ok:
        fails.append("e: Open Bible Stories sentence not supported by John")
    distinct = []
    for d in detail:
        ws = set(words(d.get("raw", d["text"])))
        if ws and all(len(ws & set(words(x))) / len(ws) < 0.6 for x in distinct):
            distinct.append(d.get("raw", d["text"]))
    # g: text hygiene. Glitches that pass a–f but would ship (Genesis and Ruth test, 12 Oct).
    for d in detail:
        t_ = d["text"]
        if re.search(r"\s[’']\s?s\b|\w[’']\s+s\b", t_):
            fails.append(f"g: stray space in a possessive ({d['src']})")
        if re.search(r"\b\d+:\d+", t_):
            fails.append(f"g: verse reference left in a sentence ({d['src']})")
        if re.search(r"\s{2,}|\s[,.;:!?]|[,;:]$|,\s(?:He|She|They|It|We|His|Her)\s", t_):
            fails.append(f"g: spacing or dangling punctuation ({d['src']})")
        if SPEECH.match(t_) and not QUOTE_FRAME.match(t_):
            fails.append(f"g: unquoted speech read as narration ({d['src']})")
        if repeats_itself(d.get("raw", t_)):
            fails.append(f"g: sentence repeats itself ({d['src']})")
    # A trailing book name is a broken outline line ("Joseph’s death Genesis"), unless a preposition needs it
    # ("Jesus teaches about John").
    if key and (re.search(r"\s{2,}", key) or (re.search(r"\s(?:Genesis|Exodus|Matthew|Mark|Luke|John|Acts)\.?$", key)
                                              and not re.search(r"\b(?:for|of|in|to|from|about|on|with|the)\s+\w+\.?$", key))):
        fails.append("g: broken headline")
    # h: whose words (John, 12 Oct, every mode). First- or second-person words outside quotation marks are someone's,
    # never Yada's: the line must be framed with its owner. In a vision every line is framed as the vision; in the
    # Teacher's book every line names the Teacher.
    for d in detail:
        t_ = d["text"]
        if d.get("fixed"):
            continue
        if not QUOTE_FRAME.match(t_) and not REPORTED.match(t_) and not REPORTED_IN.search(t_) and PERSON.search(unquoted(t_)):
            fails.append(f"h: whose words? first or second person, not framed ({d['src']})")
        if mode == "visions" and not (t_.startswith(VISION) or re.search(r"\bJohn\b", t_)) and not d["src"].startswith("Tyndale"):
            fails.append(f"h: vision line not framed as John’s vision ({d['src']})")
        if mode == "teacher" and not re.search(r"\b(?:Teacher|Qoheleth)\b", t_) and not d["src"].startswith("Tyndale"):
            fails.append(f"h: the Teacher’s words not named as his ({d['src']})")
        if mode in ("law", "plans", "debate", "love") and d.get("speech") and not QUOTE_FRAME.match(t_):
            fails.append(f"h: a speaker’s words not framed as theirs ({d['src']})")
    # i: a plan gives no measurements ("100 cubits", "50 loops"; John, 12 Oct, Exodus 26).
    if mode == "plans":
        for d in detail:
            if MEASURE.search(d.get("raw", d["text"])):
                fails.append(f"i: measurement in a plan ({d['src']})")
    # A short passage (12 verses or fewer, e.g. 6:16–24) is told in two sentences; longer ones need three (John, 12 Oct).
    need = need or (2 if n_verses <= 12 else 3)
    if len(distinct) < need:
        fails.append(f"f: {len(distinct)} distinct sentences, needs {need}")
    return fails


# A heading that names a list of people ("The Descendants of Cain", "Genealogy from Shem to Abram", "Terah’s Descendants"),
# not one that merely mentions sons ("Jacob Blesses His Sons").
# "Seven Sons of Sceva" (Acts 19) is a story about seven men, not a family list: a count before the word rules it out.
GENEALOGY_HEAD = re.compile(r"^(?!.*\b(?:Two|Three|Four|Five|Six|Seven|Parable)\b).*(?:\b(?:Descendants|Genealogy|Generations|Sons|Family|Line|Records?|Clans?|Families) (?:of|from)\b|’s (?:Descendants|Sons|Family|Line)\b|^Genealogy\b)")
GENEALOGY_WORDS = {"The", "Descendants", "Genealogy", "Generations", "Sons", "Family", "Line", "Record", "Records", "Clan", "Clans", "Families", "From", "To", "Of"}


def genealogy_line(label, bsb_txt):
    """"The list runs from A to B." only when the BSB heading itself names both ends and both appear in the passage.
    The last capitalised word in a list is often a brother, a place or another name for the same man ("runs from Shem
    to Haran" under "Genealogy from Shem to Abram"; "from Israel to Paddan"), so the text's own last name is never used
    (John, 12 Oct). A heading with one name ("The Descendants of Cain") gets no such line."""
    head = [re.sub(r"’s$", "", w) for w in re.findall(r"\b[A-Z][a-z]+(?:’s)?\b", label) if re.sub(r"’s$", "", w) not in GENEALOGY_WORDS]
    if len(head) < 2 or head[0] == head[-1]:
        return None
    if not all(re.search(rf"\b{re.escape(n)}\b", bsb_txt) for n in (head[0], head[-1])):
        return None
    return f"The list runs from {head[0]} to {head[-1]}."


# ---------------------------------------------------------------- modes by kind of writing (John, 12 Oct)
LOWER_START = {"the", "a", "an", "then", "when", "after", "as", "there", "all", "every", "some", "one", "another", "while",
               "at", "in", "on", "from", "later", "next", "before", "now", "also", "each", "many", "its", "his", "her",
               "their", "two", "three", "four", "five", "six", "seven", "twelve", "twenty-four", "out", "with", "no",
               "suddenly", "immediately", "instead", "both", "around", "behind", "beside", "inside", "among", "those",
               "these", "people", "anyone", "everyone", "nobody", "if"}


LOWER_SEEN = Counter()  # lowercase uses minus mid-sentence capitalised uses of each word in the book's BSB (main)
CAP_SEEN = set()  # words the book's BSB capitalises mid-sentence: names


def lower_first(s):
    """A sentence placed after a frame ("In John’s vision, the angel…") loses its capital unless it opens on a name:
    a word the BSB writes in lowercase ("Men will be startled") is not a name; "Satan" and "God" are."""
    w = re.match(r"[{(]?([A-Za-z’'-]+)", s)
    if not w:
        return s
    low = w.group(1).lower()
    return s[0].lower() + s[1:] if low in LOWER_START or low in STOP or LOWER_SEEN[low] > 0 or low not in CAP_SEEN else s


# Whom God speaks to, in the BSB's own words before the line ("The LORD said to Moses", "spoke to Moses and Aaron").
ADDRESS = re.compile(r"\b(?:LORD|God)\s+(?:said|spoke|called)\s+(?:again\s+)?to\s+(Moses and Aaron|Moses and Eleazar|Moses|Aaron)\b")


def addressee(bsb, cv, back=150):
    """The person God last spoke to before this verse, within `back` verses, from the BSB text; None when the text
    doesn't say (the frame is then "God says:")."""
    keys = [k for k in sorted(bsb) if k <= cv][-back:]
    for k in reversed(keys):
        hits = ADDRESS.findall(bsb[k])
        if hits:
            return hits[-1]
    return None


PAST = re.compile(r"\b(?:\w+ed|went|came|made|did|gave|took|brought|told|said|saw|stopped|was|were|had|put|set|built|wove|cast|sent|spoke)\b")
MODAL = re.compile(r"\b(?:must|should|shall|will|may|are to|is to|have to|has to)\b")


def commandlike(s):
    """A line inside God's or Moses' speech that is the speech itself (a command, a "must", an I or you), not the
    narrator's report in the same verse ("So the people stopped bringing gifts", Exodus 36:6)."""
    return bool(PERSON.search(s) or SPEECH.match(s) or MODAL.search(s) or not PAST.search(s) or IMPERATIVE.match(s))


# The commands that open lines in the law and the plans ("Make the sacred apron from finely twisted linen").
IMPERATIVE = re.compile(r"^(?:Make|Put|Take|Bring|Cover|Overlay|Set|Place|Attach|Hang|Fasten|Build|Command|Tell|Speak|Do|Have|"
                        r"Present|Anoint|Consecrate|Dedicate|Offer|Slaughter|Kill|Burn|Wash|Sprinkle|Dress|Pour|Use|Fold|"
                        r"Weave|Cast|Join|Prepare|Keep|Remember|Observe|Give|Sew|Engrave|Mount|Insert|Cut|Eat|Leave|Celebrate|"
                        r"Count|Collect|Treat|Love|Honor|Rest|Work|Stop)\b")


def opening_speech(verse, speaker, own=None, cv=None):
    """(shown, raw) for a speech that opens in the passage's first verse and runs on past it ("Our God says, “Comfort
    my people! Yes, comfort them!" continues in Isaiah 40:2). Split into sentences, its first line is cut in half and
    dropped, so the verse's own words of the speech are framed with the speaker instead (John, 12 Oct, approved)."""
    if not speaker or verse.count("“") <= verse.count("”"):
        return None
    words_ = verse[verse.rindex("“") + 1:].strip()
    # Its first lines, up to 20 words: a speech that runs on (a parable told in one verse) is not read in full.
    kept = []
    for part in re.findall(r"[^.!?]+[.!?]+", words_):
        if kept and len(" ".join(kept + [part.strip()]).split()) > 20:
            break
        kept.append(part.strip())
    words_ = " ".join(kept)
    if len(words_.split()) < 3 or len(words_.split()) > 30:
        return None
    shown = own(cv, words_, "UST") if own else words_
    if shown is None:
        return None
    return (framed(words_, speaker) if shown == words_ else shown), words_


def make_owner(mode, speaker_of, bsb, letter=None, voice=None, spoken_here=None):
    """The sentence as shown, saying whose words it is, or None to leave it out (John, 12 Oct, common rule)."""
    def own(cv, s, src):
        b_ = re.sub(r"[{}()]", "", s).strip()
        sp_ = speaker_of.get(cv) if (spoken_here is None or src != "UST" or spoken_here(cv, s)) else None
        if mode == "plans" and MEASURE.search(s):
            return None
        if src == "tQ" and REPORTED.match(s) and mode != "visions":
            return s  # tQ reports the speech itself ("Paul says the gospel is…", "The Teacher says that…")
        if mode in ("law", "plans"):
            if sp_ and "“" not in s and commandlike(b_):
                if src == "tQ":
                    # tQ paraphrases; it can't be quoted as God's words. It stays only when it reports them itself
                    # ("Yahweh tells Moses to tell the people…").
                    named = re.search(r"\b(?:Yahweh|God|the LORD|Moses)\b[^.]*?\b(?:tell|told|say|said|command|instruct|want|warn|speak|spoke)", s)
                    return s if named else None
                return framed(s, sp_, addressee(bsb, cv) if sp_ in ("God", "Yahweh", "LORD") else None)
        if mode == "letter" and letter:
            if PERSON.search(b_) or SPEECH.match(b_) or (b_.endswith("!") and len(b_.split()) <= 10):
                if src == "tQ":
                    return None  # tQ's paraphrase is not the writer's words, so it is never quoted as his
                return f"{letter['author']} tells {letter['recipients']}: “{inner(s)}”"
            return s
        if mode == "teacher" and voice:
            if re.search(r"\b(?:Teacher|Qoheleth)\b", s):
                return s
            if src == "UST":
                return framed(s, voice)
            return f"{voice} says that {lower_first(s)}"
        if mode in ("debate", "love") and sp_ and "“" not in s:
            # In a debate every speech is one side's ("Humans are fragile, like tents…" is Eliphaz's claim, and God
            # says the friends were wrong, 42:7); in the Song every line is the woman's or the man's. A tQ line stays
            # only when it reports the speech itself ("Job’s wife wanted him to curse God and die").
            if src == "tQ":
                return s if (REPORTED.match(s) or REPORTED_IN.search(s)) else None
            return framed(s, sp_)
        if src == "tQ" and PERSON.search(unquoted(b_)) and not REPORTED_IN.search(s):
            # tQ paraphrases: it can't be quoted as anyone's words, so a tQ line in someone's first or second person
            # is left out (John, 12 Oct, common rule).
            return None
        if mode == "visions" and re.match(r"^(?:\{?(?:Then|After (?:this|that)|And|Next|Now)\b,?\}?\s+)?I (?:saw|heard|looked|turned|watched|noticed|wept|fell|went|took)\b", b_):
            # John tells his own vision as "I saw…"; the verse's other speaker (Revelation 6:1's living creature) did
            # not say it.
            sp_ = KINDS["voices"]["REV"]["names"][0]
        if src != "tQ" and sp_ and "“" not in s and (SPEECH.match(b_) or re.match(r"^(?:Yes|Oh|O)\b", b_) or PERSON.search(b_)
                                                     or (b_.endswith("!") and len(b_.split()) <= 10)):
            # An oracle, prayer or command the UST gives without quotation marks: framed with its speaker (Glyssen;
            # in the Song of Songs, the UST's own speaker headings).
            s = framed(s, sp_)
            if mode == "visions" and sp_[:1].islower():
                s = s[0].lower() + s[1:]  # Glyssen's "first living creature" keeps its small letter after the frame
        if not QUOTE_FRAME.match(s) and PERSON.search(unquoted(b_)):
            # First-person words with no speaker in the verse are the writer's own ("we sailed", Acts 16; "I have
            # written", John 20:31). A book whose writer the data names frames them with him; otherwise the line is
            # left out rather than read as Yada's voice (John, 12 Oct, common rule).
            if not voice:
                return None
            s = framed(s, voice)
        if mode == "visions" and not re.search(r"\bJohn\b", s):
            # A linking word that tied the line to the one before it goes with the frame ("In John’s vision, the Lamb
            # opened…", not "…, then the Lamb opened…").
            s = VISION + lower_first(re.sub(r"^(?:But|And|Then|So|Now|Also|Yes|Indeed),?\s+(?=\S)", "", s) if not QUOTE_FRAME.match(s) else s)
        return s
    return own


NUMBER_WORDS = {"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "twelve", "thousand",
                "hundred", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"}


def stem4(w):
    w = w.replace("’", "'")
    return w[:4] if len(w) >= 5 else w


def outline_named(title, text):
    """True when the text names what an outline section is about: one of the section title's content words (numbers
    aside) occurs in it. Revelation 13 sits inside tN's "The seven trumpets (8:2–13:18)" but no trumpet sounds in
    the chapter (John, 12 Oct: tighter containment for visions). The text is the passage's chapter, so the two
    witnesses (11:1–14), between the sixth and seventh trumpets, stay inside."""
    have = {stem4(w) for w in words(text)}
    return any(stem4(w) in have for w in words(title) if w not in NUMBER_WORDS)


def concept_headings(vs, tn_rows, text):
    """tN's chapter-introduction concept headings ("Religious and Cultural Concepts") whose every content word is in
    the passage: what a vision shows, in tN's words ("Two witnesses", "Great white throne", Revelation)."""
    have = {stem4(w) for w in words(text)}
    out = []
    for c in sorted({cv[0] for cv in vs}):
        intro = next((md_(r[6]) for r in tn_rows if r[0] == f"{c}:intro"), "")
        for sec in re.split(r"(?m)^## ", intro)[1:]:
            if not re.match(r"Religious and Cultural", sec):
                continue
            for h in re.findall(r"(?m)^### (.+)$", sec):
                ws = [w for w in words(h) if w not in NUMBER_WORDS]
                if ws and not re.search(r"[“”\"]", h) and all(stem4(w) in have for w in ws):
                    out.append(h.strip())
    return out


def containing(vs, secs):
    """Outline sections (c1, v1, c2, v2, title) that hold the whole passage, narrowest first."""
    first_, last_ = vs[0], vs[-1]
    cont = [x for x in secs if (x[0], x[1]) <= first_ and last_ <= (x[2], x[3])]
    return sorted(cont, key=lambda x: ((x[2] - x[0]) * 1000 + (x[3] - x[1]), -x[0], -x[1]))


def before_after(sec, secs):
    """The outline sections either side of `sec`: the one ending just before it starts, and the one starting just
    after it ends (narrowest when several do). John, 12 Oct: a letter shows where its argument comes from and goes."""
    prev = [x for x in secs if (x[2], x[3]) < (sec[0], sec[1])]
    nxt = [x for x in secs if (x[0], x[1]) > (sec[2], min(sec[3], 998))]
    prev.sort(key=lambda x: ((x[2], x[3]), (x[0], x[1])))
    nxt.sort(key=lambda x: ((x[0], x[1]), (x[2], x[3])))
    return (prev[-1][4] if prev else None), (nxt[0][4] if nxt else None)


def topic(t, src):
    """A headline through the plain-words table, credited to it when it changed a word."""
    p = plain_words(t)
    return p, src + (f", plain words {PLAIN['status']}" if p != t else "")


def law_topic(vs, label, events, book_outline, span, mode):
    """A law or plan passage's headline is its topic, never tN prose (John, 12 Oct). In order: a book-outline item
    that fits the passage (at most 3× its length); a chapter-outline item starting in its first half; the narrowest
    book-outline item that holds it; for law only, the BSB heading. Every candidate must be an outline item, and goes
    through the plain-words table."""
    first, half = vs[0], vs[len(vs) // 2]
    fit = [x for x in containing(vs, book_outline) if span(*x[:4]) <= 3 * len(vs) and outline_item(x[4])]
    if fit:
        return topic(fit[0][4], "tN book outline")
    items = [e for e in events if outline_item(e[3])]
    # The narrowest chapter-outline item that holds the passage (Exodus 26:1–6 is "Inner covering", not v. 1–30);
    # else the first one that starts in its first half.
    hold = [e for e in items if (e[0], e[1]) <= first and e[0] == first[0] == vs[-1][0] and e[2] >= vs[-1][1]]
    if hold:
        return topic(min(hold, key=lambda e: e[2] - e[1])[3], "tN outline")
    starts = [e for e in items if first <= (e[0], e[1]) <= half]
    if starts:
        return topic(min(starts, key=lambda e: ((e[0], e[1]), -(e[2] - e[1])))[3], "tN outline")
    wide = [x for x in containing(vs, book_outline) if outline_item(x[4])]
    if wide:
        return topic(wide[0][4], "tN book outline")
    if mode == "law":
        return topic(label, "BSB heading")
    return None, None


def concept_line(c, tn_rows, topic, label, book_name):
    """The purpose for a law passage: one sentence from the tN chapter introduction's concept notes ("Religious and
    Cultural Concepts"), the one whose heading or sentence shares most words with the topic, preferring a sentence
    that says what something means or is for (Leviticus 11: what clean and unclean mean). Translator wording is never
    shown; "This chapter" becomes the chapter's name."""
    intro = next((md_(r[6]) for r in tn_rows if r[0] == f"{c}:intro"), "")
    best, score_ = None, 0
    tw = set(words(topic + " " + label))
    for sec in re.split(r"(?m)^## ", intro)[1:]:
        if not re.match(r"(?:Religious and Cultural|Important Concepts|Special Concepts)", sec):
            continue
        for sub in re.split(r"(?m)^### ", sec)[1:]:
            head, _, body = sub.partition("\n")
            para = body.strip().split("\n\n")[0]
            s1 = re.split(r"(?<=[a-z][.!?])\s+(?=[A-Z“])", para)[0].strip()
            s1 = re.sub(r"\s*\((?:See|see)[^)]*\)", "", s1)
            if (not s1.endswith(".") or re.search(r"ULT|UST|translat|your language|\(|\d+:\d+|^(?:First|As|However|But|It|They|These|This was)\b", s1)
                    or not 8 <= len(s1.split()) <= 32):
                continue
            ov = len((set(words(head)) | set(words(s1))) & tw)
            sc = ov + (0.5 if re.search(r"\bmean(?:s|ing)?\b|\bpurpose\b|\bso that\b|\bbecause\b|\bwas (?:a|an|the)\b", s1) else 0)
            if ov and sc > score_:
                best, score_ = s1, sc
    if best:
        best = re.sub(r"\b[Tt]his chapter\b", f"{book_name} {c}", best)
        best = re.sub(r"^In " + re.escape(f"{book_name} {c}") + r", (\w)", lambda m: m.group(1).upper(), best)
    return best


def sayings_lines(vs, book_outline, tn_rows, events):
    """Proverbs: "Part of" the collection (tN book outline) and the themes tN names for the chapter: its concept-note
    headings and the outline items inside the collection. No summary body (John, 12 Oct)."""
    cont = containing(vs, book_outline)
    coll = cont[-1][4] if cont else None
    themes = []
    for c in sorted({cv[0] for cv in vs}):
        intro = next((md_(r[6]) for r in tn_rows if r[0] == f"{c}:intro"), "")
        for sec in re.split(r"(?m)^## ", intro)[1:]:
            if re.match(r"Religious and Cultural", sec):
                themes += [h.strip() for h in re.findall(r"(?m)^### (.+)$", sec)]
    for x in cont[:-1]:
        themes.append(x[4])
    themes += [e[3] for e in events if (e[0], e[1]) <= vs[-1] and vs[0] <= (e[0], e[2]) and outline_item(e[3])]
    # A label for a part of the page ("Title") is not a theme.
    return coll, [plain_words(t) for t in dict.fromkeys(themes) if t and t != coll and t not in ("Title", "Introduction", "Conclusion")]


def checks():
    """Fixed cases from John's tests; run with `checks`. A failure prints and exits 1."""
    bad = []
    core = sqlite3.connect(f"{BUNDLES}/core.v5.db")
    gen = lambda c, v1, v2: " ".join(t for (t,) in core.execute("select t.text from verses v join texts t on t.ord=v.ord where v.book='GEN' "
                                                                  "and t.translation='BSB' and v.chapter=? and v.verse between ? and ?", (c, v1, v2)))
    cases = [
        ("Genealogy from Shem to Abram", gen(11, 10, 26), "The list runs from Shem to Abram."),  # said "to Haran" (John, 12 Oct)
        ("The Descendants of Cain", gen(4, 17, 24), None),
        ("Terah’s Descendants", gen(11, 27, 32), None),
        ("Genealogy from Shem to Zerubbabel", gen(11, 10, 26), None),  # an end the passage never names
    ]
    for label, txt, want in cases:
        got = genealogy_line(label, txt)
        if got != want:
            bad.append(f"genealogy_line({label!r}) = {got!r}, want {want!r}")
    for not_list in ("Jacob Blesses His Sons", "The Seven Sons of Sceva"):
        if GENEALOGY_HEAD.search(not_list):
            bad.append(f"“{not_list}” read as a genealogy")
    for who, want in (("Cornelius", "says"), ("James", "says"), ("Chief priests", "say"), ("Disciples", "say"),
                      ("Epicurean and Stoic philosophers", "say"), ("Person who told the guards and priests where the apostles were", "says"),
                      ("God", "says")):
        if f" {want}: " not in framed("x", who):
            bad.append(f"framed({who!r}) should use “{want}”")
    n = len(cases) + 9 + modes_checks(bad, core)
    for b in bad:
        print("FAIL", b)
    print(f"checks: {n - len(bad)}/{n} pass")
    sys.exit(1 if bad else 0)


def modes_checks(bad, core):
    """Cases from John's 12 Oct findings on the modes by kind of writing. Returns how many were run; failures go
    into `bad`. The last few run the script on one passage each and read what it prints."""
    import subprocess
    n = 0

    def want(ok, msg):
        nonlocal n
        n += 1
        if not ok:
            bad.append(msg)

    bsb = lambda b, c, v1, v2: " ".join(t for (t,) in core.execute(
        "select t.text from verses v join texts t on t.ord=v.ord where v.book=? and t.translation='BSB' and v.chapter=? "
        "and v.verse between ? and ?", (b, c, v1, v2)))
    # Gospels (Mark)
    want(ust_subs("Jesus and his apprentices", "MRK")[0] == "Jesus and his disciples", "apprentices → disciples")
    want(ust_subs("“Instructor, we want”", "MAT")[0] == "“Teacher, we want”", "Instructor → Teacher")
    want(ust_subs("the apprentices", "GEN")[0] == "the apprentices", "substitutions stay in the books they list")
    want(display_name("angels in white, two") == "two angels in white", "display name: two angels in white")
    want(display_name("bystanders at Calvary, some") == "some bystanders at Calvary", "display name: some bystanders")
    want(display_name("sea captains, seafarers, sailors") == "sea captains, seafarers, sailors", "a list name stays")
    want(framed("x", "bystanders at Calvary, some").startswith("Some bystanders at Calvary say:"), "framed group says")
    raw16 = ("Some early manuscripts end the Gospel of Mark after verse 8. Other manuscripts contain only a short ending, "
             "a version of the following: <i><span class=|fnv|>9</span>But they quickly reported all these instructions.</i>")
    fact, rest = footnote_fact(clean_footnote(raw16))
    want(fact == "Some early manuscripts end the Gospel of Mark after verse 8.", f"Mark 16:8 fact is one sentence: {fact!r}")
    want("9But" not in rest and rest.endswith("But they quickly reported all these instructions."), "glued verse number")
    want("9But" not in clean_footnote("the following: 9But they"), "glued verse number without its span")
    # Letters (Romans)
    want(reads_harder("By the witnesses of the Law and the Prophets has a righteousness without the law now been made known.",
                      "But now God has revealed how he makes people righteous."), "Romans 3:21 tQ reads harder")
    want(not reads_harder("Abraham took another wife named Keturah.", "Then Abraham got married again."), "short tQ kept")
    rom = make_owner("letter", {}, {}, letter=LETTER_DATA["letters"]["ROM"])
    want(rom((1, 7), "God loves you and has called you.", "UST") == "Paul tells the believers in Rome: “God loves you and has called you.”",
         "second person in a letter is the writer's")
    want(rom((1, 7), "God loves you.", "tQ") is None, "a tQ paraphrase is never quoted as the writer's")
    want(before_after((3, 21, 5, 21, "B"), [(1, 18, 3, 20, "A"), (3, 21, 5, 21, "B"), (6, 1, 8, 39, "C")]) == ("A", "C"),
         "Before this · After this")
    want(all(LETTER_DATA["letters"][b]["setting"] for b in LETTERS), "a setting line for every letter")
    # Law (Leviticus)
    want(plain_words("The rule for clean and unclean quadrupeds") == "The rule for clean and unclean animals", "quadrupeds → animals")
    unframed = [{"text": "The people should learn what is acceptable to me.", "src": "UST 11:47", "where": (11, 47), "aside": False, "setting": False}]
    want(any(f.startswith("h:") for f in gate("x", unframed[0]["text"], unframed, mode="law")), "law: unframed “acceptable to me” fails h")
    lev = make_owner("law", {(11, 47): "God"}, {(11, 1): "The LORD spoke again to Moses and Aaron, telling them"})
    want(lev((11, 47), "The people should learn what is acceptable to me.", "UST").startswith("God tells Moses and Aaron: “"),
         "law: God's words framed with whom he speaks to")
    # Debate (Job)
    want(kind_line("settings", "JOB", [(4, 1), (4, 21)])[0] == "Job’s friends argue that his suffering is punishment; at the end God says they were wrong (42:7).",
         "Job's fixed setting line")
    two = [{"text": "Job says: “I wish I had died.”"}, {"text": "Job says: “I have no peace.”"}]
    want(joined_text(two) == "Job says: “I wish I had died. I have no peace.”", "repeated frames merge")
    job = make_owner("debate", {(4, 19): "Eliphaz the Temanite"}, {})
    want(job((4, 19), "Humans are fragile, like tents.", "UST").startswith("Eliphaz the Temanite says: “"), "debate: a friend's claim is his")
    # The Teacher (Ecclesiastes)
    ecc = make_owner("teacher", {}, {}, voice="The Teacher")
    want(ecc((1, 14), "All the deeds that are done under the sun amount to vapor.", "tQ")
         == "The Teacher says that all the deeds that are done under the sun amount to vapor.", "the Teacher's view is his")
    want(kind_line("settings", "ECC", [(1, 1), (1, 11)])[0] is not None, "Ecclesiastes setting line")
    # Sayings (Proverbs)
    pro_rows = [line.split("\t") for line in open(f"{TN_DIR}/tn_PRO.tsv", encoding="utf-8").read().splitlines()[1:]]
    coll, themes = sayings_lines([(5, 1), (5, 23)], tn_book_outline("PRO"), pro_rows, tn_guides("PRO")[0])
    want(coll == "A father teaches his son about wisdom" and "Adulterous women" in themes, f"Proverbs 5: {coll!r} {themes!r}")
    want(clean_title("Introduction and purpose for Proverbs") == "Introduction and purpose for Proverbs", "a needed book name stays")
    # Love poetry (Song of Songs)
    sng = ust_speakers(f"{UST_DIR}/22-SNG.usfm")
    want(sng.get((1, 2)) == "The woman" and sng.get((4, 1)) == "The man", "Song speakers from the UST headings")
    want("thinks about" not in ust_verses(f"{UST_DIR}/22-SNG.usfm")[(1, 2)], "speaker headings are not verse text")
    # Visions (Revelation)
    rev = make_owner("visions", {}, {})
    want(rev((7, 4), "144,000 people were sealed.", "UST") == "In John’s vision, 144,000 people were sealed.", "a vision line is framed")
    want(repeats_itself("If anyone’s enemies are going to kill him with a sword, they will kill him with a sword."), "garbled 13:10")
    want(repeats_itself("If anyone’s enemies are going to capture him, they will capture him."), "garbled 13:10, capture")
    want(not repeats_itself("Show everyone how great I, your Son, am in order that I may show everyone how great you are."), "rhetoric is not garble")
    want(not outline_named("The seven trumpets", bsb("REV", 13, 1, 18)) and outline_named("The seven trumpets", bsb("REV", 11, 1, 19)),
         "13:1–10 is not in “The seven trumpets”; chapter 11 is")
    plain = [{"text": "Satan was bound for a thousand years.", "src": "tQ 20:2", "where": (20, 2), "aside": False, "setting": False}]
    want(any(f.startswith("h:") for f in gate("x", plain[0]["text"], plain, mode="visions")), "disputed 20:1–6 never a plain fact")
    # Plans (Exodus 25–40)
    want(not outline_item("There are multiple different curtains described using three different Hebrew words: one sort of curtains"),
         "tN prose is not an outline item")
    want(MEASURE.search("There must be hangings of fine twisted linen 100 cubits long.") and MEASURE.search("Make 50 loops of blue cloth.")
         and not MEASURE.search("Make a table from acacia wood."), "measurements")
    # Runs of the script itself, one book at a time.
    def run(book, *pids):
        r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), book, *pids], capture_output=True, text=True,
                           env={**os.environ, "YADA_ROOT": ROOT})
        return r.stdout
    mrk = run("MRK", "MRK.4.35-4.41", "MRK.16.1-16.8")
    want("Also told in: Matthew 8:23–27 · Luke 8:22–25" in mrk, "Mark 4:35–41 also told in Matthew and Luke")
    want("Fact: Some early manuscripts end the Gospel of Mark after verse 8.  [BSB footnote · Read the note:" in mrk and "9But" not in mrk,
         "Mark 16 fact, then Read the note")
    want("By the witnesses of the Law" not in run("ROM", "ROM.3.21-3.31"), "Romans 3:21 uses the UST line")
    want("The seven trumpets" not in run("REV", "REV.13.1-13.10"), "Revelation 13:1–10 not tagged “The seven trumpets”")
    exo = run("EXO", "EXO.26.1-26.6")
    want("Topic: Inner covering." in exo and "Hebrew words" not in exo and "cubit" not in exo, "Exodus 26:1–6 topic, no prose, no measures")
    # John, 12 Oct (approved): a passage that opens with someone speaking starts with that speech.
    isa = run("ISA", "ISA.40.1-40.5")
    body = next((ln.strip() for ln in isa.splitlines() if ln.startswith("   ") and not re.match(r"   (?:Speaking|Part of|What happens|\[)", ln)), "")
    want(body.startswith("God says: “Comfort my people!"), f"Isaiah 40:1–5 opens with God's comfort: {body[:60]!r}")
    return n


def sample_ids(book, ids, n=SAMPLE_PER_BOOK):
    """A fixed sample John reads once per book; the seed is the book code, so the sample repeats run to run."""
    import random
    rnd = random.Random(f"yada-summary-sample-{book}")
    return sorted(rnd.sample(list(ids), min(n, len(ids))), key=list(ids).index)


def main():
    book = sys.argv[1] if len(sys.argv) > 1 else "JHN"
    core = sqlite3.connect(f"{BUNDLES}/core.v5.db")
    bundle = next((f"{BUNDLES}/{f}" for f in sorted(os.listdir(BUNDLES), reverse=True) if re.fullmatch(rf"{book.lower()}\.v\d+\.db", f)), None)
    sp = sqlite3.connect(f"{BUNDLES}/speakers.v1.db")
    ust_file = next(f for f in os.listdir(UST_DIR) if f.endswith(f"-{book}.usfm"))
    ust = ust_verses(f"{UST_DIR}/{ust_file}")
    # The approved word list (draft until John approves it): "apprentices" → "disciples" and the rest.
    ust_changed = {}
    for k_ in list(ust):
        ust[k_], fired_ = ust_subs(ust[k_], book)
        if fired_:
            ust_changed[k_] = fired_
    ust_sp = ust_speakers(f"{UST_DIR}/{ust_file}")
    letter = LETTER_DATA["letters"].get(book)
    tq = tq_answers(book)
    events, asides = tn_guides(book)
    ordref = dict(((o), (c, v)) for o, c, v in core.execute("select ord, chapter, verse from verses where book=?", (book,)))
    names_by_code = dict(core.execute("select code, name from books"))
    foot, parallels = [], []
    heads = bsb_headings(names_by_code[book].replace("Psalms", "Psalm"), foot, parallels)
    peri = sqlite3.connect(bundle).execute("select pericope_id, label, start_ord, end_ord from pericopes order by start_ord").fetchall() if bundle else []
    nch = core.execute("select max(chapter) from verses where book=?", (book,)).fetchone()[0]
    if len(peri) < nch:
        # A book without its own passage divisions (1 Corinthians has one) uses the BSB's sections, heading to heading.
        ordof = dict(((c, v), o) for o, c, v in core.execute("select ord, chapter, verse from verses where book=? and verse>0", (book,)))
        keys = sorted(ordof)
        starts = sorted(dict.fromkeys(cv for cv, _ in heads if cv in ordof)) or [(c, 1) for c in range(1, nch + 1)]
        labels = {}
        for cv, h in heads:
            labels.setdefault(cv, clean_heading(h))
        peri = []
        for i, st in enumerate(starts):
            nxt = starts[i + 1] if i + 1 < len(starts) else None
            last = keys[keys.index(nxt) - 1] if nxt else keys[-1]
            peri.append((f"{book}.{st[0]}.{st[1]}-{last[0]}.{last[1]}", labels.get(st, f"{names_by_code[book]} {st[0]}"), ordof[st], ordof[last]))
        # A section under 3 verses (genealogy splits such as Genesis 10:1, 46:16–18) joins the next one for its summary,
        # or the previous one at a book's end; the reader still shows the BSB's own headings.
        merged = []
        # Psalms never merge: each psalm is its own unit, however short (Psalm 117 has two verses).
        for p_ in ([] if book in POETRY else peri):
            n_ = p_[3] - p_[2] + 1
            if merged and merged[-1][4] < 3:
                prev = merged.pop()
                p_ = (f"{prev[0].split('-')[0]}-{p_[0].split('-')[1]}", prev[1], prev[2], p_[3], prev[4] + n_)
            else:
                p_ = p_ + (n_,)
            merged.append(p_)
        if book in POETRY:
            merged = [p_ + (p_[3] - p_[2] + 1,) for p_ in peri]
        if len(merged) > 1 and merged[-1][4] < 3 and book not in POETRY:
            last_ = merged.pop(); prev = merged.pop()
            merged.append((f"{prev[0].split('-')[0]}-{last_[0].split('-')[1]}", prev[1], prev[2], last_[3], prev[4] + last_[4]))
        peri = [m_[:4] for m_ in merged]
    book_outline = tn_book_outline(book)
    tn_rows_all = [line.split("\t") for line in open(f"{TN_DIR}/tn_{book}.tsv", encoding="utf-8").read().splitlines()[1:]] if os.path.exists(f"{TN_DIR}/tn_{book}.tsv") else []
    study = f"{BUNDLES}/study-{book.lower()}.v1.db"
    tyn = sqlite3.connect(study) if os.path.exists(study) else None
    want = set(sys.argv[2:])
    chars = dict(sp.execute("select id, name from characters"))
    stories = [st for st in obs_stories(names_by_code) if st["no"] not in (49, 50)]  # 49–50 cite single verses only
    bsb = dict(((c, v), t) for c, v, t in core.execute("select v.chapter, v.verse, t.text from verses v join texts t on t.ord=v.ord "
                                                       "where v.book=? and t.translation='BSB'", (book,)))

    LOWER_SEEN.clear()
    LOWER_SEEN.update(w for t_ in bsb.values() for w in re.findall(r"\b([a-z][a-z’'-]+)\b", t_))
    # A word the BSB capitalises mid-sentence at least as often ("God", "Lord") counts as a name.
    caps_ = [w.lower() for t_ in bsb.values() for w in re.findall(r"(?<=[a-z,;] )([A-Z][a-z’'-]+)", t_)]
    LOWER_SEEN.subtract(caps_)
    CAP_SEEN.clear()
    CAP_SEEN.update(caps_)

    def verses_of(a, b):
        return [ordref[o] for o in range(a, b + 1) if o in ordref]

    results, awaiting = [], []
    for pid, label, a, b in peri:
        if want and pid not in want:
            continue
        rows = sp.execute("select character from verse_speakers where ord between ? and ? and standing='speaks' order by ord, line", (a, b)).fetchall()
        seen = []
        for (c,) in rows:
            n = chars.get(c, "")
            if not n or n.startswith(("narrator", "interruption", "Needs Review", "scripture")):
                continue
            # A slash joins alternatives or a group (Glyssen's own convention); a guide line names each once.
            for part in n.split("/"):
                part = glyssen_name(part)
                # In the Old Testament, Glyssen's "Jesus", "Christ" or "Messiah" speakers are one tradition's reading.
                if book in OT and re.search(r"\b(?:Jesus|Christ|Messiah)\b", part):
                    continue
                if part and part not in seen:
                    seen.append(part)
        names = [n.split(" (")[0].split(",")[0] for n in seen] + ["Jesus", "John", "God"]
        vs = verses_of(a, b)
        # Whose words a verse's speech is (audit, 12 Oct): one named speaker only. A group ID ("priests/Levites") is
        # never split into its first name, and a verse with two speakers (dialogue) gets no single owner. Whether a
        # given sentence is the speech or narration around it is decided per sentence (spoken_here).
        by_verse, entire = {}, set()
        for o_, c_, qp_ in sp.execute("select ord, character, quote_position from verse_speakers where ord between ? and ? and standing='speaks' order by ord, line", (a, b)):
            n_ = chars.get(c_, "")
            if n_ and not n_.startswith(("narrator", "interruption", "Needs Review", "scripture")):
                by_verse.setdefault(ordref.get(o_), []).append((n_, qp_))
        speaker_of = {}
        for cv_, rows_ in by_verse.items():
            names_ = {n_ for n_, _ in rows_}
            if len(names_) == 1 and not any("/" in n_ for n_ in names_):
                speaker_of[cv_] = glyssen_name(rows_[0][0])
                if all(q_ == "EntireVerse" for _, q_ in rows_):
                    entire.add(cv_)

        def prev_same(cv_):
            prev = next((x for x in reversed(sorted(by_verse)) if x and x < cv_), None)
            return prev is not None and speaker_of.get(prev) == speaker_of.get(cv_) and (prev[0], prev[1] + 1) == cv_

        def spoken_here(cv_, sent):
            """The sentence is the speaker's own words: the whole verse is speech, or the sentence sits inside the
            UST's quotation marks in that verse. Narration around a quote is never the speaker's (Acts 16:15)."""
            if cv_ not in speaker_of:
                return False
            line = ust.get(cv_, "")
            if "“" not in line and (cv_ in entire or prev_same(cv_)):
                # No quotation marks to go by: the whole verse is the speech when Glyssen says so, or when the verse
                # before has the same single speaker, so a long speech runs on (the Exodus 21–23 law code).
                return True
            core_ = re.sub(r"[{}“”]", "", sent).strip()[:40]
            i_ = re.sub(r"[{}]", "", line).find(core_)
            if i_ < 0:
                return False
            before = re.sub(r"[{}]", "", line)[:i_]
            return before.count("“") > before.count("”")
        if book in POETRY:
            c0 = vs[0][0]
            stanza = None
            if c0 == 119:
                st_starts = sorted(cv for cv, _ in heads if cv[0] == 119)
                stanza = 1 + sum(1 for cv in st_starts if cv < vs[0]) if st_starts else None
            lead, about = psalm_lines(c0, vs, tn_rows_all, bsb.get((c0, 1), ""), label, stanza)
            print(f"== {label} ({vs[0][0]}:{vs[0][1]}–{vs[-1][0]}:{vs[-1][1]})")
            for kind_, txt, src_ in lead:
                print(f"   {kind_}: {txt}  [{src_}]")
            if about:
                print(f"   About this psalm: {' | '.join(f'{k_}: {t_}' for k_, t_, _ in about)}")
            fails = []
            if not lead:
                fails.append("a: nothing to show before the psalm")
            if len(lead) > 2:
                fails.append(f"f: {len(lead)} lines before the psalm, at most 2")
            for _, txt, src_ in lead + about:
                if re.search(r"&#|\bBOOK [IVX]+\b|\s{2,}|\s[,.;:]|your language|translat", txt):
                    fails.append(f"g: text hygiene ({src_})")
            print(f"   {'FLAGGED: ' + '; '.join(fails) if fails else 'passes'}\n")
            results.append((pid, fails))
            continue
        mode = mode_of(book, vs)
        if mode == "love":
            # The Song never names its speakers; the UST's headings do (Glyssen marks every line "uncertain").
            speaker_of = {cv: who for cv, who in ust_sp.items() if cv in set(vs)}
            seen = list(dict.fromkeys(speaker_of[cv] for cv in vs if cv in speaker_of))
        obs = None
        for st in (stories if mode in ("narrative", "gospel") else ()):
            for (bk_, c1, v1, c2, v2) in st["spans"]:
                if bk_ != book:
                    continue
                share = sum(1 for cv in vs if (c1, v1) <= cv <= (c2, v2)) / max(1, len(vs))
                if share >= 0.6:
                    john = " ".join(bsb.get(cv, "") + " " + ust.get(cv, "") for cv in vs)
                    pool = obs_candidates(st, john, vs)
                    if len(pool) >= 3 and len({fi for _, (fi, _) in pool}) >= 2:
                        obs = {"no": st["no"], "title": st["title"], "pool": pool}
                    break
            if obs:
                break
        divs = [d_ for d_ in DEBATES if d_["book"] == book and tuple(d_["from"]) <= vs[-1] and vs[0] <= tuple(d_["to"])]
        # A short disputed range (up to 3 verses) gives no summary sentence; a long one (the servant song) can't be
        # left out of its own passage, so its note carries the weight. In a vision every line is framed as the
        # vision, so a disputed range (Revelation 7:4–8, 13, 20:1–6) never states a plain fact (gate h).
        divided = frozenset(cv for d_ in divs for cv in vs if tuple(d_["from"]) <= cv <= tuple(d_["to"])
                            and d_["from"][0] == d_["to"][0] and d_["to"][1] - d_["from"][1] <= 2)
        owner = make_owner(mode, speaker_of, bsb, letter=letter, voice=(KINDS["voices"].get(book) or {}).get("name"),
                           spoken_here=spoken_here if mode != "love" else None)
        opening = vs[0] if vs[0] in speaker_of else None  # the passage opens with someone speaking
        opening_line = opening_speech(ust.get(vs[0], ""), speaker_of.get(vs[0]), owner, vs[0]) if opening else None
        ev_ = events + ([(x[0], x[1], x[3], x[4]) for x in book_outline if x[0] == x[2]] if mode == "love" else [])
        res = None
        if mode != "sayings":
            res = summarise(pid, label, a, b, ust, verses_of, names, tq=tq, events=ev_, asides=asides, obs=obs, owner=owner, divided=divided, tq_gap=mode == "letter", opening=opening, opening_line=opening_line)
        if res and any(f.startswith(("b:", "f:")) for f in gate(res[0] or "x", res[1], res[3], True, BUDGET, len(vs))):
            # Body fallback chain, after tQ and the UST: Tyndale's first sentence on this range (adapted, NLT lemma
            # rule applied), then Open Bible Stories sentences that match the book, at sentence level.
            extra = []
            if tyn:
                for (t,) in tyn.execute("select text from notes where kind='note' and ord_start>=? and ord_end<=? order by ord_start", (a, b)):
                    body = re.sub(r"^<b>[^<]*</b>\s*", "", t.strip()).split(" • ")[0].split("\n")[0]
                    if body.startswith("<x>"):
                        continue
                    sent = re.split(r"(?<=[.!?])\s+(?=[A-Z“])", re.sub(r"<[^>]+>", "", body))[0]
                    sent = re.sub(r"\s*\((?:see|cp\.|also)?[^()]*\d+:\d+[^()]*\)", "", sent).strip()
                    # Tyndale's own "we" ("we should enjoy God’s good gifts") is the note writer's voice: left out.
                    if len(sent.split()) >= 6 and not re.match(r"^(This|That|These|Those|He|She|They|It|So|I|We|You)\b", sent) \
                            and not (mode == "plans" and MEASURE.search(sent)) and not PERSON.search(unquoted(sent)):
                        extra.append((sent, "Tyndale", (999, 0)))
                        break
            john = " ".join(bsb.get(cv, "") + " " + ust.get(cv, "") for cv in vs)
            for st in (stories if mode in ("narrative", "gospel") else ()):
                if any(bk_ == book and (c1, v1) <= vs[-1] and vs[0] <= (c2, v2) for (bk_, c1, v1, c2, v2) in st["spans"]):
                    for sent, (fi, si) in obs_candidates(st, john, vs):
                        extra.append((sent, f"OBS {st['no']}.{fi + 1}", (998, fi * 100 + si)))
            if extra:
                res = summarise(pid, label, a, b, ust, verses_of, names, tq=tq, events=ev_, asides=asides, extra=extra, owner=owner, divided=divided, tq_gap=mode == "letter", opening=opening, opening_line=opening_line) or res
        rng = f"{verses_of(a, a)[0][0]}:{verses_of(a, a)[0][1]}–{verses_of(b, b)[0][0]}:{verses_of(b, b)[0][1]}"
        print(f"== {label} ({rng})")
        if seen:
            shown = [display_name(n_) for n_ in seen[:4]]
            more = f" and {len(seen) - 4} more" if len(seen) > 4 else ""
            # " · " between names: a list name keeps its own commas ("sea captains, seafarers, sailors").
            print(f"   Speaking: {' · '.join(shown)}{more}")
        passage_text = " ".join(bsb.get(cv, "") + " " + ust.get(cv, "") for cv in vs)
        chapter_text = " ".join(bsb.get(cv, "") + " " + ust.get(cv, "") for cv in sorted(bsb) if cv[0] in {x[0] for x in vs})
        span = lambda c1, v1, c2, v2: sum(1 for cv in ordref.values() if (c1, v1) <= cv <= (c2, v2))
        if mode == "sayings":
            # Proverbs: "Part of" the collection and the chapter's themes; no summary body (John, 12 Oct).
            coll, themes = sayings_lines(vs, book_outline, tn_rows_all, events)
            # Themes show only where tN names them (rule 4); a chapter of single sayings (10–22) has its collection
            # alone, which is what the data holds.
            fails = [] if coll else ["a: no collection for Part of"]
            for t_ in [coll or ""] + themes:
                if re.search(r"\s{2,}|\s[,.;:]|your language|translat|\d+:\d+", t_):
                    fails.append("g: text hygiene (tN)")
            if coll:
                print(f"   Part of: {plain_words(coll)}.  [tN book outline]")
            if themes:
                print(f"   Themes: {' · '.join(themes)}  [tN chapter introduction]")
            for d_ in divs:
                awaiting.append(f"{pid} ({d_['question']})")
            print(f"   {'FLAGGED: ' + '; '.join(fails) if fails else 'passes'}\n")
            results.append((pid, fails))
            continue
        if res:
            key, text, src, detail = res
            obs_ok = all(not d["src"].startswith("OBS") or any(d["text"] == p_ for p_, _ in obs["pool"]) for d in detail) if obs else True
            head_src = "tN outline"
            label_kind = "What happens"
            around = None
            if mode in ("law", "plans"):
                key, head_src = law_topic(vs, label, events, book_outline, span, mode)
                label_kind = "Topic"
            elif book in LETTERS:
                # The narrowest containing section from the chapter outlines or the book outline, any length.
                secs = [(e[0], e[1], e[0], e[2], e[3]) for e in events] + list(book_outline)
                cont = [x for x in containing(vs, secs) if x[-1] and x[-1].strip().lower() != label.strip().lower()]
                if cont:
                    key, head_src, label_kind = cont[0][-1], "tN outline", "Part of"
                    # Before this · After this, at the same level of the outline (John, 12 Oct, Romans).
                    level = [(e[0], e[1], e[0], e[2], e[3]) for e in events] if cont[0] in secs[:len(events)] else list(book_outline)
                    around = before_after(cont[0], level)
            if mode == "love":
                # Each chapter of the Song holds several speeches: the outline item covering most of it leads.
                best = max(book_outline, key=lambda x: sum(1 for cv in vs if (x[0], x[1]) <= cv <= (x[2], x[3])), default=None)
                if best and any((best[0], best[1]) <= cv <= (best[2], best[3]) for cv in vs):
                    key, head_src = best[4], "tN book outline"
            if mode == "visions" and key and not outline_named(key, chapter_text):
                key = ""
            if not key and mode not in ("law", "plans"):
                # Then the book outline: the section that matches or contains this passage (12:1–11, 19:16–42, 21).
                # A section far wider than the passage ("Jesus preaches, teaches, and heals people (2–11)") says nothing
                # about it: only a section up to three times the passage's length heads it.
                hit = [e for e in containing(vs, book_outline) if span(*e[:4]) <= 3 * len(vs)
                       and (mode != "visions" or outline_named(e[4], chapter_text))]
                if hit:
                    key, head_src = hit[0][4], "tN book outline"
            if not key and book not in LETTERS and mode not in ("law", "plans"):
                # No event names this passage (Acts' notes outline only six broad parts): say which part it belongs to,
                # as letters do. The narrowest containing book-outline section, any length; in a vision, only one the
                # passage itself names.
                cont = [e for e in containing(vs, book_outline) if e[4].strip().lower() != label.strip().lower()
                        and (mode != "visions" or outline_named(e[4], chapter_text))]
                if cont:
                    key, head_src, label_kind = cont[0][4], "tN book outline", "Part of"
            if not key and mode == "visions":
                # What John sees, in tN's own words for the chapter's concepts ("Two witnesses", "Great white throne"),
                # when every word of the concept is in the passage itself.
                seen_ = concept_headings(vs, tn_rows_all, passage_text)
                if seen_:
                    key, head_src, label_kind = seen_[0], "tN chapter introduction", "What John sees"
            if not key and mode not in ("law", "plans"):
                # No outline line for this passage: the BSB's own headings inside it, as published (public domain).
                half_ = vs[len(vs) // 2]
                hs = [h for cv, h in heads if cv in set(vs) and cv <= half_ and h.strip().lower() != label.strip().lower()]
                if hs:
                    key, head_src = " · ".join(dict.fromkeys(hs)), "BSB heading"
            purpose = None
            if mode in ("law", "plans"):
                # Topic, then purpose, then at most two lines of what God says, framed as his; never rule by rule.
                if mode == "plans":
                    purpose, _ = kind_line("purposes", book, vs)
                else:
                    purpose = concept_line(vs[0][0], tn_rows_all, key or "", label, names_by_code[book])
                body = list(detail)
                # A line that leans ("He made a lid…") goes first, while another is left to carry the passage.
                for d in list(body):
                    if len(body) > 1 and not QUOTE_FRAME.match(d["text"]) and LEANS.match(re.sub(r"[{}()]", "", d["raw"]).strip()):
                        body.remove(d)
                while len(body) > 2:
                    turn_ = next((d for d in body if not d["setting"] and d is not body[-1]), body[1])
                    body.remove(turn_)
                # Within the word budget: the longer line goes first, never the last one left.
                plen = len(purpose.split()) if purpose else 0
                while len(body) > 1 and plen + sum(len(d["text"].split()) for d in body) > BUDGET * 1.3:
                    body.remove(max(body, key=lambda d: len(d["text"].split())))
                for d in body:
                    d["speech"] = d["where"] in speaker_of and d["src"].startswith("UST") and commandlike(re.sub(r"[{}()]", "", d["raw"]))
                detail = ([{"text": purpose, "raw": purpose, "src": "tN intro" if mode == "law" else "purpose (draft)",
                            "where": vs[0], "aside": False, "setting": False, "fixed": True}] if purpose else []) + body
                text = joined_text(detail)
                src = [d["src"] for d in detail]
            if GENEALOGY_HEAD.search(label) and mode in ("narrative", "gospel"):
                # Genealogy (Genesis 10, 1 Chronicles 1–9): the BSB heading leads, then one sentence, then at most the
                # "runs from" line, built only from the heading's own names (genealogy_line).
                bsb_txt = " ".join(bsb.get(cv, "") for cv in vs)
                key, head_src, label_kind = label, "BSB heading", "Genealogy"
                first_s = next((d for d in detail if not LEANS.match(d["text"]) and not SPEECH.match(d["text"])), None)
                tmpl = genealogy_line(label, bsb_txt)
                detail = ([first_s] if first_s else []) + ([{"text": tmpl, "src": "BSB names", "where": vs[0], "aside": False, "setting": False}] if tmpl else [])
                text = " ".join(d["text"] for d in detail)
                src = [d["src"] for d in detail]
            # A genealogy is told by its template and one sentence, however long the list. The heading says what the
            # list is; one sentence beside it is enough (John, 12 Oct). A law or plan passage is its topic, purpose
            # and up to two lines of speech: two lines in all.
            if mode in ("debate", "love"):
                for d in detail:
                    d["speech"] = d["where"] in speaker_of and d["src"].startswith("UST")
            need = 1 if label_kind == "Genealogy" else 2 if mode in ("law", "plans") else None
            fails = gate(key, text, detail, obs_ok, BUDGET, len(vs), need=need, mode=mode)
            # A fixed data fact, not summary prose: a BSB manuscript footnote that names this passage's verses, as
            # one plain sentence; the rest of the note waits behind "Read the note" (John, 12 Oct, Mark 16).
            vset = set(vs)
            facts = []
            for cv, f in foot:
                m = re.search(r"(\d+):(\d+) through (?:[1-3]?\s?[A-Z][a-z]+ )?(\d+):(\d+)", f)
                named = {(int(m.group(1)), int(m.group(2)))} if m else set()
                fact, rest = footnote_fact(f)
                # Only a complete, plain sentence shows as a fact; a variant fragment ("A few Hebrew manuscripts, some
                # LXX manuscripts, and Vulgate…; most Hebrew manuscripts Salma", Ruth 4:20) stays in the footnote.
                plain_ = re.match(r"^[A-Z][^;]*\.$", fact) and not re.search(r"\b(?:LXX|MT|DSS|Vulgate|Syriac|BYZ|TR|NA|SBL|ECM)\b", fact) and len(fact.split()) >= 6
                if plain_ and (named & vset or (cv in vset and re.search(r"verses? \d+", fact))):
                    facts.append((fact, rest))
            results.append((pid, fails))
            if key in PROPHETS["plain_names"]:
                # tN's translator words ("Oracles About Judah") through the table John approves once.
                key, head_src = PROPHETS["plain_names"][key], head_src + f", plain name {PROPHETS['status']}"
            if key:
                # The outline line names what happens; it leads, credited to the Translation Notes.
                print(f"   {label_kind}: {key[0].upper() + key[1:]}{'' if key.endswith('.') else '.'}  [{head_src}]")
            if around and any(around):
                print(f"   {' · '.join(x for x in (around[0] and f'Before this: {around[0]}', around[1] and f'After this: {around[1]}') if x)}  [tN outline]")
            if purpose:
                p_src = "tN chapter introduction" if mode == "law" else f"{kind_line('purposes', book, vs)[1]} · {KINDS['status']}"
                print(f"   Purpose: {purpose}  [{p_src}]")
            print(f"   {joined_text([d for d in detail if not d.get('fixed')]) if purpose else text}")
            used = {x.split()[0] for x in src}
            names_ = {"tQ": "unfoldingWord Translation Questions", "UST": "the UST", "OBS": "Open Bible Stories", "Tyndale": "Tyndale Open Study Notes", "tN": "unfoldingWord Translation Notes"}
            credit = "From " + ", ".join(names_[u] for u in ("tQ", "UST", "OBS", "Tyndale", "tN") if u in used) + ", adapted"
            changed = sorted({f_ for d in detail if d["src"].startswith("UST") for f_ in ust_changed.get(d["where"], [])
                              if f_.split(" → ")[1].lower() in d["text"].lower()})
            if changed:
                credit += f"; UST words changed by list ({PLAIN['status']}): {', '.join(changed)}"
            print(f"   [{len(text.split())} words · {', '.join(src)} · {credit}]")
            if mode == "gospel":
                par = also_told_in(book, vs, parallels, names_by_code,
                                   [p_ for (p_,) in sp.execute("select distinct parallel_passage from verse_speakers where ord between ? and ? and parallel_passage<>''", (a, b))])
                if par:
                    print(f"   Also told in: {' · '.join(par)}  [BSB section parallels]")
            for fact, rest in dict.fromkeys(facts):
                print(f"   Fact: {fact}  [BSB footnote{' · Read the note: ' + rest if rest else ''}]")
            for d_ in divs:
                ok_pos = [p_ for p_ in (d_.get("positions") or []) if p_.get("status") == "approved"]
                if len(ok_pos) >= 2:
                    # Source sentences, unchanged, credited to their sources only; John approves and is never a credit.
                    for p_ in ok_pos:
                        print(f"   Readers differ: {p_['text']}  [{p_['source']}]")
                else:
                    awaiting.append(f"{pid} ({d_['question']})")
            setting = next((x["line"] for x in PROPHETS["settings"] if x["book"] == book and tuple(x["from"]) <= vs[0] and vs[-1] <= tuple(x["to"])), None)
            if setting:
                print(f"   Setting: {setting}  [tN book intro · {PROPHETS['status']}]")
            k_line, k_src = kind_line("settings", book, vs)
            if k_line:
                print(f"   Setting: {k_line}  [{k_src} · {KINDS['status']}]")
            if letter:
                print(f"   Setting: {letter['setting']}  [tN book intro · {LETTER_DATA['status']}]")
            print(f"   {'FLAGGED: ' + '; '.join(fails) if fails else 'passes'}")
        else:
            results.append((pid, ["f: no candidate sentences"]))
        print()

    if results:
        flagged = [(p_, f) for p_, f in results if f]
        why = Counter(x.split(":")[0] for _, f in flagged for x in f)
        allv = [cv for _, _, a_, b_ in peri for cv in verses_of(a_, b_)]
        cov = lambda have: f"{100 * sum(1 for cv in allv if cv in have) // max(1, len(allv))}%"
        tqv = {(c, v) for c, v, _ in tq}
        spk_v = {ordref[o] for (o,) in sp.execute("select distinct ord from verse_speakers where standing='speaks'") if o in ordref}
        obs_v = {cv for st in stories for (bk_, c1, v1, c2, v2) in st["spans"] if bk_ == book for cv in allv if (c1, v1) <= cv <= (c2, v2)}
        print(f"{book}: sources · UST {cov(set(ust))} · tQ {cov(tqv)} · tN chapter outline lines {len(events)} · book outline {len(book_outline)} · "
              f"OBS {cov(obs_v)} · Glyssen speakers {cov(spk_v)}")
        share = len(flagged) / max(1, len(results))
        print(f"{book}: {len(results)} summaries · {len(results) - len(flagged)} pass and ship · {len(flagged)} flagged for John "
              f"({', '.join(f'{k}: {n}' for k, n in sorted(why.items()))})" + ("  ** STOP: over 15% flagged, a source gap; fix rules before release **" if share > 0.15 else ""))
        for p_, f in flagged:
            print(f"   flagged {p_}: {'; '.join(f)}")
        if awaiting:
            print(f"   major debates awaiting a note (nothing shown until John approves one): {'; '.join(awaiting)}")
        print(f"   sample for John to read once: {', '.join(sample_ids(book, [p_ for p_, _ in results]))}")


if __name__ == "__main__":
    checks() if sys.argv[1:2] == ["checks"] else main()
