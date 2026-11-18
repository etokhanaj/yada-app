"""Reference prototype of the no-AI assembler, v3 (12 Oct 2026). docs/no-ai-understand.md is the spec; the pipeline
stage ports this to TypeScript. Every line it produces is a published source as published (credited) or a data fact
in a fixed sentence. Nothing is generated.

Usage:
  python3 -I assemble.py report               quality report for every book with sources
  python3 -I assemble.py 1CO 1CO.14.34 ...    one book's report plus the full output for the given verses
"""
import csv, collections, difflib, glob, json, os, re, sqlite3, sys

ROOT = os.environ.get("YADA_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
B, RAW = f"{ROOT}/content/bundles", f"{ROOT}/content/raw"
csv.field_size_limit(10 ** 9)
core = sqlite3.connect(f"{B}/core.v5.db")
spk = sqlite3.connect(f"{B}/speakers.v1.db")
NAMES = dict(core.execute("select code, name from books"))
ORDER = [c for (c,) in core.execute("select code from books order by ord")]
WORD_BUDGET = 150  # house style: about 150 words before any tap

# ---------------------------------------------------------------- reviewed tables (John reviews each line once)
FRAME = {
    "JHN": "John’s account of Jesus’ life, written so that readers would believe in him",
    "1CO": "Paul’s letter to the church in Corinth, answering their questions and problems",
}
GLOSSARY = [  # plain words for terms a beginner meets in notes; meaning kept
    (r"\bthe synoptic Gospels\b", "Matthew, Mark and Luke"), (r"\bsynoptic Gospels\b", "Matthew, Mark and Luke"),
    (r"\bthe Pastoral Letters\b", "Paul’s letters to Timothy and Titus"), (r"\bthe Sanhedrin\b", "the Jewish high council"),
    (r"\bGentiles\b", "non-Jews"), (r"\bthe torah\b", "the law of Moses"), (r"\bthe logos\b", "the Word"),
    (r"\bprologue\b", "opening"), (r"\bquintessential\b", "very"),
    # BSB footnote abbreviations
    # TR is the Textus Receptus, Greek editions printed 1516–1633, not manuscripts (audit, 12 Oct); NA and NE are modern
    # critical editions.
    (r"\bNE, BYZ, and TR include\b", "One modern edition, later manuscripts and Greek editions printed in the 1500s and 1600s include"),
    (r"\bBYZ and TR include\b", "Later manuscripts and Greek editions printed in the 1500s and 1600s include"),
    (r"\bTR includes\b", "Greek editions printed in the 1500s and 1600s include"),
    (r"\bBYZ and TR\b", "Later manuscripts and Greek editions printed in the 1500s and 1600s"), (r"\bBYZ\b", "Later manuscripts"),
    (r"\bTR\b", "Greek editions printed in the 1500s and 1600s"),
    (r"\bLXX\b", "the Greek Old Testament"), (r"\bMT\b", "the Hebrew text"), (r"\bDSS\b", "the Dead Sea Scrolls"), (r"\bNA\b", "A modern critical edition"),
]
CREDITS = {  # shown under each line; the licences ask adapted copies to say what changed
    "ust": "Simplified Text, adapted from unfoldingWord (alignment markup removed) · CC BY-SA 4.0",
    "tn": "Translation Notes, adapted from unfoldingWord (translator guidance removed; readings set in a fixed sentence) · CC BY-SA 4.0",
    "tw": "Translation Words, adapted from unfoldingWord (definition only) · CC BY-SA 4.0",
    "tq": "Translation Questions, adapted from unfoldingWord (verse references removed, spacing tidied) · CC BY-SA 4.0",
    "obs": "Open Bible Stories, adapted from unfoldingWord (images removed) · CC BY-SA 4.0",
    # The glossary changes words inside Tyndale's sentences ("Gentiles" → "non-Jews"); CC BY-SA asks that to be said.
    "tyndale": "Adapted from Tyndale Open Study Notes: references and some quotations removed; some terms in plain words (e.g. “Gentiles” → “non-Jews”) · CC BY-SA 4.0",
    "bsb": "Berean Standard Bible footnotes · public domain",
}
TEMPLATES = {  # every fact sentence the app can show; data fills the braces
    "differ": "Translations differ: “{bsb}” (BSB) · {others}.",
    "word": "“{bsb}” translates a word used {n} times in {book}{where}.",
    "cited": "Quotes {ref}.",
    "speakers": "Speaking: {names}.",
    # Readers differ, one fixed shape the reader can follow (John reviews it once): the phrase is named by the BSB's
    # own words, through the translation tables, so no translator framing survives.
    # Three wordings, so a page of readings doesn't repeat one shape (John, 12 Oct: approve two or three variants once).
    "jps": "A Jewish translation, the JPS 1917, reads: “{jps}”",  # draft, John approves
    "intro2": "Some readers believe {a}; others believe {b}.",
    "most": "{book} uses the word for “{bsb}” more than any other book: {n} of its {total} uses in the Bible.",
    "read2": ("Some read “{about}” as {a}. Others read it as {b}.",
              "“{about}” can mean {a}, or {b}.",
              "Readers take “{about}” two ways: {a}; or {b}."),
    "read3": ("Some read “{about}” as {a}. Others read it as {b}. Still others, as {c}.",
              "“{about}” can mean {a}, {b}, or {c}.",
              "Readers take “{about}” three ways: {a}; {b}; or {c}."),
}

# ---------------------------------------------------------------- small helpers
def plain(t):
    t = re.sub(r"<[^>]+>", "", t).replace("&amp;", "&").replace("|", "")
    return re.sub(r"\s+", " ", t).strip()

def gloss(t):
    for a, b in GLOSSARY:
        t = re.sub(a, b, t)
    return t

def sentences(par):
    return [x for x in re.split(r"(?<=[.!?”])\s+(?=[A-Z“(])", par) if x]

def syllables(w):
    g = re.findall(r"[aeiouy]+", w.lower())
    return max(1, len(g) - (1 if w.lower().endswith("e") and len(g) > 1 else 0))

def grade(t):
    ws = re.findall(r"[A-Za-z’']+", t)
    if not ws:
        return 0.0
    return round(0.39 * len(ws) / max(1, len(sentences(t))) + 11.8 * sum(map(syllables, ws)) / len(ws) - 15.59, 1)

def words(t):
    return len(re.findall(r"\S+", t or ""))

DANGLING = re.compile(r"^(It|This|These|That|There|They|He|She|His|Her|Its|Their|Such|Here|Then|Also|However)\b")
REFWORD = r"(?:[1-3]\s)?[A-Z][a-z]+"

# ---------------------------------------------------------------- sources
_NORM = lambda n: n.replace("Psalms", "Psalm").replace("Song of Solomon", "Song of Songs").strip().lower()
_BY_NAME = {_NORM(nm): c for c, nm in NAMES.items()}
def book_code(name):
    # The tables say "Psalm 23:1", the core "Psalms": both sides are normalised the same way.
    return _BY_NAME.get(_NORM(name))

def load_tables():
    """BSB translation tables (Berean, public domain per berean.bible/licensing): per verse, the BSB rendering of each
    original word, the BSB heading that opens a section, cross-references and BSB footnotes."""
    verses, headings = collections.defaultdict(list), []
    rows = csv.reader(open(f"{RAW}/bsb-tables/bsb_tables.tsv", encoding="utf-8-sig", errors="replace"), delimiter="\t")
    next(rows)
    cur = None
    for r in rows:
        if len(r) < 23:
            continue
        if r[12]:
            m = re.match(r"^(.*) (\d+):(\d+)$", r[12])
            cur = (book_code(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
        if not cur or not cur[0]:
            continue
        if r[13]:
            h = plain(r[13])
            if h:
                headings.append((cur, h, plain(r[14]).strip("() ")))
        verses[cur].append({"orig": r[6].strip(), "translit": r[7], "strong": r[11] or r[10], "lang": r[4],
                            "bsb": r[18].strip(), "foot": plain(r[21])})
    return verses, headings

TABLES, HEADINGS = load_tables()

MS_RE = re.compile(r"manuscript|\bBYZ\b|\bTR\b|\bNA\b|\bECM\b|\bSBL\b")
def ms_targets(bk, c, v, note):
    """The verses a manuscript footnote is about. The BSB hangs it on a neighbouring verse: John 7:53–8:11's note sits
    on 7:52, 1 Cor 14:34–35's on 14:35, the 5:4 note on 5:3. The note itself names the verses."""
    out = {(c, v)}
    for c1, v1, c2, v2 in re.findall(r"(\d+):(\d+) through (?:[1-3]?\s?[A-Z][a-z]+ )?(\d+):(\d+)", note):
        c1, v1, c2, v2 = map(int, (c1, v1, c2, v2))
        out |= {(cc, vv) for (bb, cc, vv) in TABLES if bb == bk and (c1, v1) <= (cc, vv) <= (c2, v2)}
    for a_, b_ in re.findall(r"verses (\d+)[–-](\d+)", note):
        out |= {(c, n) for n in range(int(a_), int(b_) + 1)}
    for n in re.findall(r"(?<!after )verse (\d+)\b", note):
        out.add((c, int(n)))
    for n in re.findall(r"after verse (\d+)", note):   # "end the Gospel of Mark after verse 8": the verses after it
        out |= {(cc, vv) for (bb, cc, vv) in TABLES if bb == bk and cc == c and vv > int(n)}
    return out

MS_NOTES = collections.defaultdict(list)
for (bk, c, v), ws in TABLES.items():
    for w in ws:
        if w["foot"] and MS_RE.search(w["foot"]) and not w["foot"].startswith(("Or ", "Literally")):
            for t in ms_targets(bk, c, v, w["foot"]):
                if w["foot"] not in MS_NOTES[(bk,) + t]:
                    MS_NOTES[(bk,) + t].append(w["foot"])
# A verse the BSB omits has no row of its own: its note hangs on the verse before and names it ("BYZ and TR include 4 …").
for (bk, c, v), ws in list(TABLES.items()):
    for w in ws:
        f = w["foot"] or ""
        if re.search(r"\bincludes?\b", f) and MS_RE.search(f):
            for n in re.findall(r"(?<![\d:])(\d+)(?=[A-Z“‘])", f):   # "include 21But …": verse 21's text follows
                if int(n) != v and f not in MS_NOTES[(bk, c, int(n))]:
                    MS_NOTES[(bk, c, int(n))].append(f)
STRONG_REFS = collections.defaultdict(list)  # (book, strong) -> ["14:28", ...]
for (bk, c, v), ws in TABLES.items():
    for w in ws:
        if w["strong"]:
            STRONG_REFS[(bk, w["strong"])].append(f"{c}:{v}")

def ust_verses(path):
    """Plain verse text from aligned USFM. Chapter and verse markers can sit mid-line in poetry ("\\q1 \\v 2 …"), so
    the text is split on the markers themselves, not on lines. Headings and titles outside verses are dropped."""
    src = open(path, encoding="utf8").read()
    src = re.sub(r"\\zaln-[se][^\\]*?\\\*", "", src)
    src = re.sub(r"\\w ([^|\\]*)\|[^\\]*\\w\*", r"\1", src)
    src = re.sub(r"(?m)^\\(?:s\d?|ms\d?|mt\d?|mr|toc\d|h|id|ide|usfm|sts|rem|cl|r)\b.*$", "", src)
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
            t = re.sub(r"\s+([,.;:!?’”])", r"\1", re.sub(r"\s+", " ", t)).strip()
            for n in range(v[0], v[1] + 1):  # a bridged verse ("\\v 1-2") stands for each verse it covers
                out[(ch, n)] = (out.get((ch, n), "") + " " + t).strip()
    return out

def tsv(path):
    if not os.path.exists(path):
        return []
    return [r for r in csv.reader(open(path, encoding="utf8"), delimiter="\t")][1:]

def md(t):
    t = t.replace("\\n", "\n")
    t = re.sub(r"\[\[rc://[^\]]*\]\]", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"\s*\(See:?[^)]*\)", "", t)
    return t.replace("**", "")

def tw_article(link):
    """Translation Words: the Definition (or Facts) section, translator suggestions dropped."""
    m = re.search(r"/tw/dict/bible/(\w+)/([\w-]+)$", link)
    if not m:
        return None
    p = f"{RAW}/uw-tw/en_tw/bible/{m.group(1)}/{m.group(2)}.md"
    if not os.path.exists(p):
        return None
    t = md(open(p, encoding="utf8").read())
    title = re.match(r"#\s*(.+)", t).group(1).split(",")[0].strip()
    sec = re.search(r"##\s*(?:Definition|Facts):?\s*\n(.*?)(?=\n##|\Z)", t, re.S)
    body = sec.group(1).strip() if sec else ""
    first = body.split("\n\n")[0].strip()
    return {"term": title, "definition": first, "kind": m.group(1)}

def obs_stories():
    out = []
    for p in sorted(glob.glob(f"{RAW}/uw-obs/en_obs/content/[0-9]*.md")):
        t = open(p, encoding="utf8").read()
        title = re.match(r"#\s*(.+)", t).group(1)
        frames = [x.strip() for x in re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t).split("\n\n")[1:] if x.strip() and not x.strip().startswith("_")]
        ref = re.search(r"_A Bible story from:\s*(.+?)_", t)
        spans = []
        for part in (ref.group(1) if ref else "").split(";"):
            m = re.match(r"\s*((?:[1-3] )?[A-Za-z ]+?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?", part)
            if not m:
                continue
            bk = book_code(m.group(1).strip())
            c1 = int(m.group(2)); v1 = int(m.group(3) or 1)
            if m.group(5):
                c2, v2 = int(m.group(4)), int(m.group(5))
            elif m.group(4) and m.group(3):
                c2, v2 = c1, int(m.group(4))
            elif m.group(4):
                c2, v2 = int(m.group(4)), 999
            else:
                c2, v2 = c1, (999 if not m.group(3) else v1)
            if bk:
                spans.append((bk, c1, v1, c2, v2))
        out.append({"title": title, "frames": frames, "spans": spans})
    return out

OBS = obs_stories()

class Book:
    def __init__(self, code):
        self.code = code
        u = glob.glob(f"{RAW}/uw-ust/en_ust/*-{code}.usfm")
        self.ust = ust_verses(u[0]) if u else {}
        self.tn = tsv(f"{RAW}/uw-tn/en_tn/tn_{code}.tsv")
        self.tq = tsv(f"{RAW}/uw-tq/en_tq/tq_{code}.tsv")
        self.twl = tsv(f"{RAW}/uw-twl/en_twl/twl_{code}.tsv")
        sp = f"{B}/study-{code.lower()}.v1.db"
        self.study = sqlite3.connect(sp) if os.path.exists(sp) else None
        self.sections = self._sections()

    def _sections(self):
        hs = [(c, v, h, x) for (bk, c, v), h, x in HEADINGS if bk == self.code]
        if not hs:
            hs = [(c, 1, f"{NAMES[self.code]} {c}", "") for (c,) in core.execute("select distinct chapter from verses where book=? order by chapter", (self.code,))]
        last = core.execute("select max(chapter) from verses where book=?", (self.code,)).fetchone()[0]
        out = []
        for i, (c, v, h, x) in enumerate(hs):
            nc, nv = (hs[i + 1][0], hs[i + 1][1]) if i + 1 < len(hs) else (last, 999)
            end = (nc, nv - 1) if nv > 1 else (nc - 1, 999)
            out.append({"title": h, "start": (c, v), "end": end, "parallels": x})
        return out

    def section(self, c, v):
        for s in self.sections:
            if s["start"] <= (c, v) <= s["end"]:
                return s
        return None

    def passage_of(self, c, v):
        """The passage that contains the verse, as the passage guide cuts it (John, 12 Oct, option A): the book
        bundle's own passages where it has at least one per chapter, else the BSB sections, a section under 3 verses
        joining the next (never in Psalms), the same rule passage_summary.py uses. One section system everywhere."""
        if not hasattr(self, "_passages"):
            self._passages = self._cut_passages()
        return next((p_ for p_ in self._passages if p_["start"] <= (c, v) <= p_["end"]), None)

    def _cut_passages(self):
        nch = core.execute("select max(chapter) from verses where book=?", (self.code,)).fetchone()[0]
        bundle = next((f"{B}/{f}" for f in sorted(os.listdir(B), reverse=True) if re.fullmatch(rf"{self.code.lower()}\.v\d+\.db", f)), None)
        if bundle:
            rows = sqlite3.connect(bundle).execute("select label, start_ord, end_ord from pericopes order by start_ord").fetchall()
            if len(rows) >= nch:
                cv = lambda o_: core.execute("select chapter, verse from verses where ord=?", (o_,)).fetchone()
                return [{"title": l_, "start": tuple(cv(a_)), "end": tuple(cv(b_))} for l_, a_, b_ in rows]
        n_of = lambda s_: core.execute("select count(*) from verses where book=? and verse>0 and (chapter>? or (chapter=? and verse>=?)) and (chapter<? or (chapter=? and verse<=?))",
                                        (self.code, s_["start"][0], s_["start"][0], s_["start"][1], s_["end"][0], s_["end"][0], s_["end"][1])).fetchone()[0]
        out = []
        for s_ in [dict(x) for x in self.sections]:
            if out and self.code != "PSA" and n_of(out[-1]) < 3:
                out[-1]["end"] = s_["end"]
            else:
                out.append(s_)
        if len(out) > 1 and self.code != "PSA" and n_of(out[-1]) < 3:
            last = out.pop(); out[-1]["end"] = last["end"]
        return out

BOOKS = {}
def book(code):
    if code not in BOOKS:
        BOOKS[code] = Book(code)
    return BOOKS[code]

# ---------------------------------------------------------------- per-verse layers
def ordinal(bk, c, v):
    r = core.execute("select ord from verses where book=? and chapter=? and verse=?", (bk, c, v)).fetchone()
    return r[0] if r else None

# JPS 1917 (public domain, Old Testament only; docs/licences/jps-1917-licence.md) lives in its own downloadable bundle,
# keyed by core's ord after the Hebrew-numbering map. It gives Compare and Readers differ a Jewish rendering from data
# (John, 12 Oct: Isaiah 7:14 "young woman", Psalm 22:16 "like a lion"). Absent bundle: no JPS, nothing else changes.
_JPS_PATH = f"{B}/translation-jps.v1.db"
jps = sqlite3.connect(_JPS_PATH) if os.path.exists(_JPS_PATH) and os.path.getsize(_JPS_PATH) else None

def text(o, tr="BSB"):
    if tr == "JPS":
        r = jps.execute("select text from texts where ord=?", (o,)).fetchone() if jps else None
        return r[0] if r else ""
    r = core.execute("select text from texts where ord=? and translation=?", (o, tr)).fetchone()
    return r[0] if r else ""

def plain_words(bk, c, v):
    """UST verse; {…} marks words the UST adds for meaning. A verse in [ ] is one the UST marks as missing from older
    manuscripts, so it is reported as such rather than shown as plain meaning."""
    t = book(bk).ust.get((c, v))
    if not t:
        return None
    bracketed = t.startswith("[") and t.rstrip().endswith("]")
    return {"text": t.strip("[] "), "added": re.findall(r"\{([^}]*)\}", t), "bracketed": bracketed, "credit": CREDITS["ust"]}

TRANSLATOR = re.compile(r"(your language|Alternate translation|If it would be helpful|If possible,|you could|you may|you should|"
                        r"In your translation|\bULT\b|\bUST\b|translate this|translated as|translators?\b)", re.I)

def tn_rows(bk, c, v):
    return [r for r in book(bk).tn if r[0] == f"{c}:{v}"]

import unicodedata
def _bare(w):
    w = unicodedata.normalize("NFD", w)
    return re.sub(r"[^\w]", "", "".join(ch for ch in w if not unicodedata.combining(ch))).lower()

def bsb_words_for(bk, c, v, quote):
    """The BSB words that translate the Greek or Hebrew phrase a note is about ("αἱ γυναῖκες" → "Women")."""
    want = {_bare(q) for part in quote.split("&") for q in part.split() if _bare(q)}
    got = [re.sub(r"[\[\]{}]", "", w["bsb"]).strip() for w in TABLES.get((bk, c, v), []) if _bare(w["orig"].strip("«»{}[]()⧼⧽〈〉‹›*")) in want]
    got = [g for g in got if g and g not in ("-", "vvv") and not all(key(x) in STOP | MODAL for x in g.split())]
    got = list(dict.fromkeys(got))
    return " … ".join(got) if got and sum(len(g.split()) for g in got) <= 4 else None

CAP = 18  # words per reading on the first screen; past it, "Read the full note"
def capped(o):
    first = re.split(r"(?<=[.!?])\s+", o)[0]
    ws = first.split()
    if len(ws) <= CAP:
        return first.rstrip("."), first != o
    cut = " ".join(ws[:CAP])
    cut = cut[: cut.rfind(",")] if "," in cut[len(cut) // 2:] else cut
    return cut.rstrip(",;: ") + "…", True

def readers_differ(bk, c, v):
    out = []
    for r in tn_rows(bk, c, v):
        t = md(r[6]).split("\n")[0]
        m = re.match(r"^(.*?)(?:could|may|might) (?:refer to|mean|indicate|be|describe|have)[^:]*:\s*(\(1\).*)$", t)
        if not m:
            continue
        opts = [re.sub(r"\s*(?:Alternate translation|For this interpretation)[^|]*$", "", o).strip(" ;.") for o in re.split(r"\(\d\)\s*", m.group(2)) if o.strip()]
        opts = [re.sub(r"\s*In support of this view[^.]*\.?", "", o).strip(" ;.") for o in opts]
        opts = [re.sub(r"\s*\(See:?[^)]*\)", "", o).strip(" ;.") for o in opts if o and not TRANSLATOR.search(o)]
        # Translators' figure-of-speech labels ("in which case “above” is a euphemism for God", "a doublet used for
        # emphasis") explain the Greek to a translator, not the meaning to a reader (John, 12 Oct): cut that clause.
        opts = [re.sub(r",?\s*(?:in which case|so that)\b[^;.]*\b(?:euphemism|doublet|idiom|metonym\w*|synecdoche|hendiadys|merism|litotes|genitive)\b[^;.]*", "", o)
                for o in opts]
        opts = [re.sub(r";?\s*many languages\b[^;.]*", "", o).strip(" ;.,") for o in opts]
        # tN's "(1) … or (2) …" leaves a trailing "or" on the first reading, which the template's own "or" doubled
        # ("hovering” or; or “and a wind", Genesis 1:2).
        opts = [re.sub(r"[,;]?\s+or$", "", o).strip(" ;.,") for o in opts]
        lead = re.split(r"(?<=[.!?”])\s+", m.group(1).strip())[-1]
        about = re.sub(r"^(?:Here,?\s*|just as in [^,]+,\s*|and throughout [^,]+,\s*)+", "", lead).rstrip(",")
        about = re.sub(r"\s+(?:that|which|It|it)$", "", about)
        if about.lower() in ("it", "this", "that", "they", "these", "") or TRANSLATOR.search(about):
            about = "What this means"
        if len(opts) >= 2:
            # The phrase by the BSB's own words; if that runs long, the note's own short name when the verse uses it.
            vt_ = text(ordinal(bk, c, v) or 0).lower()
            content = [key(w) for w in about.split() if key(w) not in STOP | MODAL]
            single = len(about.split()) == 1 and re.search(rf"\b{re.escape(about.lower())}\b", vt_)   # "so" in John 3:16
            own = about if (len(about.split()) <= 4 and content and all(re.search(rf"\b{re.escape(w)}", vt_) for w in content)) or single else None
            phrase = own or bsb_words_for(bk, c, v, r[4]) or "this"
            short = [capped(o) for o in opts[:3]]
            lc = lambda t: t[0].lower() + t[1:] if t and not re.match(r"^[A-Z][a-z]+ [A-Z]|^(God|Jesus|Paul|Israel|Lord|Christ)\b", t) else t
            vals = [lc(t) for t, _ in short]
            # The wording turns with the verse and with each reading in it, so neighbours differ and a rerun repeats.
            n_ = (v + len(out)) % 3
            sentence = (TEMPLATES["read3"][n_].format(about=phrase, a=vals[0], b=vals[1], c=vals[2]) if len(vals) == 3
                        else TEMPLATES["read2"][n_].format(about=phrase, a=vals[0], b=vals[1]))
            sentence = sentence.replace("“this”", "this")
            sentence = sentence[0].upper() + sentence[1:] if sentence[0] != "“" else "“" + sentence[1].upper() + sentence[2:]
            out.append({"about": phrase, "options": opts, "sentence": sentence,
                        "full_note": any(f for _, f in short) or len(opts) > 3, "source": "tn", "id": r[1], "credit": CREDITS["tn"]})
    return out

SKIP_TAGS = ("figs-imperative3p", "figs-activepassive", "figs-abstractnouns", "writing-pronouns", "grammar-", "figs-possession",
             "figs-ellipsis", "figs-infostructure", "figs-nominaladj", "figs-genericnoun", "figs-quotations", "writing-quotations",
             "figs-gendernotations", "figs-exclusive", "figs-doublet", "translate-unknown", "figs-123person", "figs-rquestion")

def explained(bk, c, v):
    out = []
    for r in tn_rows(bk, c, v):
        if any(r[3].split("/")[-1].startswith(t) for t in SKIP_TAGS) or re.search(r"\(1\)", r[6]):
            continue
        kept = [s for s in sentences(md(r[6]).split("\n")[0]) if not TRANSLATOR.search(s)]
        while kept and DANGLING.match(kept[0]) and not kept[0].startswith(("Here", "This ", "These ")) and len(kept) > 1:
            kept = kept[1:]
        t = " ".join(kept).strip()
        if words(t) >= 8:
            out.append({"text": t, "id": r[1]})
    return out

def bsb_notes(bk, c, v):
    """The BSB translators' own footnotes on the verse: 'Or …' renderings, 'Literally …', manuscripts, citations."""
    out = []
    for w in TABLES.get((bk, c, v), []):
        f = w["foot"]
        if not f:
            continue
        kind = ("or" if f.startswith("Or ") else "literally" if f.startswith("Literally") else
                "cited" if f.startswith("Cited") else
                "manuscripts" if re.search(r"manuscript|\bBYZ\b|\bTR\b|\bNA\b|\bECM\b|\bSBL\b", f) else "other")
        out.append({"kind": kind, "on": w["bsb"], "text": gloss(f)})
    return out

def key_words(bk, c, v):
    out, seen = [], set()
    for r in book(bk).twl:
        if r[0] != f"{c}:{v}":
            continue
        a = tw_article(r[5])
        if a and a["term"] not in seen and a["definition"]:
            seen.add(a["term"])
            out.append(a)
    return out

def check_questions(bk, c, v):
    return [{"q": r[5], "a": r[6]} for r in book(bk).tq if r[0] == f"{c}:{v}" and r[5] and r[6]]

# ---------------------------------------------------------------- data facts
STOP = set("a an the and or but of to in on for with is was be are were that this it he she they him his her their them who whom "
           "which as at by from not no so if then also let your".split())
MODAL = {"has", "have", "had", "is", "are", "was", "were", "shall", "should", "will", "would", "may", "might", "must", "can", "could",
         "do", "does", "did", "be"}

def key(w):
    w = re.sub(r"n't$", "", w.lower().replace("’", "'"))
    return re.sub(r"[^a-z]", "", w)

def expand(t):
    return re.sub(r"(\w+)n[’']t\b", lambda m: {"won": "will", "sha": "shall"}.get(m.group(1), m.group(1)) + " not", t)

def differs_pairs(o):
    base = expand(text(o)).split()
    found = collections.OrderedDict()
    for tr in ("WEB", "KJV", "LSV"):
        # The LSV marks Hebrew poetry's line pairs with "||"; it is layout, not a word (Job 8:6 showed "|| Surely").
        oth = [w for w in expand(text(o, tr)).replace("||", " ").split() if w]
        sm = difflib.SequenceMatcher(a=[key(w) for w in base], b=[key(w) for w in oth], autojunk=False)
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            if op != "replace":
                continue
            cut = lambda ws: ws[:next((i + 1 for i, w in enumerate(ws) if re.search(r"[,;:.]$", w)), len(ws))]
            f, t = cut(base[a1:a2]), cut(oth[b1:b2])
            while f and key(f[0]) in STOP | MODAL: f = f[1:]
            while t and key(t[0]) in STOP | MODAL: t = t[1:]
            while f and key(f[-1]) in STOP | MODAL: f = f[:-1]
            while t and key(t[-1]) in STOP | MODAL: t = t[:-1]
            fc, tc = {key(w) for w in f} - STOP, {key(w) for w in t} - STOP
            if not f or not t or not fc or not tc or len(f) > 2 or len(t) > 2 or fc <= MODAL:
                continue
            if all(any(x[:4] == y[:4] or x[:3] == y[:3] and abs(len(x) - len(y)) <= 3 for y in tc) for x in fc):
                continue
            trim = lambda ws: " ".join(w.strip(",.;:“”‘’") for w in ws).strip()
            found.setdefault(trim(f), []).append((trim(t), tr))
    return sorted(found.items(), key=lambda kv: (-len(kv[1]), -max(len(k) for k in kv[0].split())))

def jps_contrast(o, most=2):
    """Where JPS 1917 and the BSB word a verse differently, the differing phrases with one word of context, up to six
    words a side, in verse order ("the virgin will be with child" / "the young woman shall conceive"). Phrases that
    differ only in function words or spelling (will/shall, encircles/inclosed is kept) are skipped."""
    a_, b_ = text(o).split(), text(o, "JPS").split()
    if not b_:
        return []
    sm = difflib.SequenceMatcher(a=[key(w) for w in a_], b=[key(w) for w in b_], autojunk=False)
    out = []
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op != "replace":
            continue
        fc = {key(w) for w in a_[a1:a2]} - STOP - MODAL
        tc = {key(w) for w in b_[b1:b2]} - STOP - MODAL
        if not fc or not tc or fc & tc or all(any(x[:4] == y[:4] for y in tc) for x in fc):
            continue
        ctx = lambda ws, i, j: " ".join(w.strip(",.;:“”‘’!?") for w in ws[max(0, i - 1):min(j, i + 5)])
        out.append((ctx(a_, a1, a2), ctx(b_, b1, b2), len(fc | tc)))
    out.sort(key=lambda x: -x[2])
    keep = sorted(out[:most], key=lambda x: a_.index(x[0].split()[0]) if x[0].split()[0] in a_ else 0)
    return [(x[0], x[1]) for x in keep]

def differs(o):
    return [TEMPLATES["differ"].format(bsb=k, others=" · ".join(f"“{t}” ({tr})" for t, tr in vs)) for k, vs in differs_pairs(o)[:2]]

def content_tokens(o):
    """The verse's verbs, nouns and adjectives, never a name: Greek names are capitalised; Hebrew marks them Np
    ("HNp", "HC/Np"; Isaiah 1:1's Isaiah and Judah, audit 12 Oct). Prefixed Hebrew forms are read by their last part."""
    for key_, surface, morph in core.execute("select occurrence_key, surface, morph from tokens where ord=? order by position", (o,)):
        morph = morph or ""
        # Greek codes read "V- 3AAI-S--". Hebrew and Aramaic ones start with a language letter (H, A) and join
        # prefixes and suffixes with "/" ("HC/Np", "ANcmsd/Td"), so the word's part of speech is its first noun, verb
        # or adjective part. Np is a name and Ng a people's name ("Chaldeans").
        if morph[:1] in ("H", "A") and morph[1:2] != "-":
            parts = [morph[1:].split("/")[0]] + morph.split("/")[1:]
            pos = next((p_ for p_ in parts if p_[:1] in ("V", "N", "A")), "")
        else:
            pos = morph
        if pos.startswith(("Np", "Ng")) or surface[:1].isupper():
            continue
        if re.match(r"^(?:V|N|A)", pos):
            yield key_, surface

def book_count(key_, bk):
    r = core.execute("select count from occurrences where occurrence_key=? and book=?", (key_, bk)).fetchone()
    return r[0] if r else 0

def word_fact(bk, c, v):
    """A rare word the verse shares with nearby verses (≤ 5 uses in the book, ≥ 2 in this chapter), named by the BSB's
    own rendering in this verse. Counted from core.occurrences, the same base as compare_fact and the app's word card,
    so one word never shows two numbers (audit, 12 Oct)."""
    o = ordinal(bk, c, v)
    best = None
    for key_, surface in content_tokens(o):
        n = book_count(key_, bk)
        if n > 5 or n < 2:
            continue
        refs = list(dict.fromkeys(f"{c_}:{v_}" for c_, v_ in core.execute(
            "select v.chapter, v.verse from tokens t join verses v on v.ord=t.ord where t.occurrence_key=? and v.book=? order by t.ord", (key_, bk))))
        same = [r for r in refs if r.split(":")[0] == str(c)]
        if len(same) < 2:
            continue
        rendering = bsb_words_for(bk, c, v, surface)
        if not rendering or key(rendering) in STOP:
            continue
        rendering = re.sub(r"^(?:the|a|an)\s+", "", rendering.split(" … ")[0], flags=re.I)
        if best is None or n < best[0]:
            best = (n, rendering, refs, same)
    if not best:
        return None
    n, rendering, refs, same = best
    others = [r for r in refs if r != f"{c}:{v}"]
    where = (f", all in this chapter: {', '.join(others)} and here" if len(same) == len(refs) else f": {', '.join(others)} and here")
    return TEMPLATES["word"].format(bsb=rendering[0].upper() + rendering[1:], n=n, book=NAMES[bk], where=where)

def covered(phrase, readings):
    """The phrase a note is about overlaps the phrase a reading is about (content words, case-insensitive)."""
    want = {key(w) for w in re.findall(r"[\w’']+", phrase or "")} - STOP - MODAL
    for d in readings:
        got = {key(w) for w in re.findall(r"[\w’']+", d.get("about") or "")} - STOP - MODAL
        if want and got and want & got:
            return True
    return False

def intro_readings(bk, c):
    """A chapter introduction that sets out two readings in tN's own words ("Some scholars believe that this refers to
    a future period of time, while others believe that it refers to Jesus reigning now from heaven", Revelation 20)."""
    row = next((r for r in book(bk).tn if r[0] == f"{c}:intro"), None)
    if not row:
        return []
    m = re.search(r"Some (?:scholars|interpreters|people) (?:believe|think) (?:that )?([^,.;]+), while others (?:believe|think) (?:that )?([^.;]+)\.", md(row[6]))
    if not m:
        return []
    return [{"about": None, "sentence": TEMPLATES["intro2"].format(a=m.group(1).strip(), b=m.group(2).strip()), "options": [m.group(1), m.group(2)],
             "full_note": True, "source": "tn", "id": row[1], "credit": CREDITS["tn"]}]

def compare_fact(bk, c, v):
    """A word fact that carries its own comparison (John, 12 Oct: never a raw count with nothing to compare): the
    verse's word that this book uses more than any other book does, named by its BSB rendering here."""
    o = ordinal(bk, c, v)
    best = None
    for key_, surface in content_tokens(o):
        rows = core.execute("select book, count from occurrences where occurrence_key=? order by count desc", (key_,)).fetchall()
        if len(rows) < 3 or rows[0][0] != bk or rows[0][1] < 10 or rows[0][1] == rows[1][1]:
            continue
        total = sum(n for _, n in rows)
        share = rows[0][1] / total
        if not best or share > best[0]:
            best = (share, surface, rows[0][1], total)
    if not best:
        return None
    rendering = bsb_words_for(bk, c, v, best[1])
    if not rendering:
        return None
    # One rendering, without its article ("the law … Law" in Romans 3:21 → "law").
    rendering = re.sub(r"^(?:the|a|an)\s+", "", rendering.split(" … ")[0], flags=re.I)
    return TEMPLATES["most"].format(book=NAMES[bk], bsb=rendering, n=best[2], total=best[3])

def speakers(o):
    names = [n for n, st, k in spk.execute("select c.name, s.standing, c.kind from verse_speakers s join characters c on c.id=s.character "
                                            "where s.ord=? order by s.line", (o,)) if st == "speaks" and k in ("character", "multiple")]
    names = list(dict.fromkeys(names))
    return TEMPLATES["speakers"].format(names=" · ".join(names)) if names else None

# ---------------------------------------------------------------- Tyndale (now under Study notes)
def tyndale(bk, o, verse_text):
    st = book(bk).study
    if not st:
        return None
    rows = st.execute("select ord_start, ord_end, text from notes where kind='note' and ord_start<=? and ord_end>=? "
                      "order by ord_end-ord_start, ord_start desc", (o, o)).fetchall()
    vt = verse_text.lower()
    for a, b, t in rows:
        body = re.sub(r"^<b>[^<]*</b>\s*", "", t.strip()).split(" • ")[0].split("\n")[0]
        if body.startswith("<x>"):
            continue
        raw = re.sub(r"<x>([^<]+)</x>", lambda m: m.group(1) if m.group(1).lower().strip(" .,:;") in vt else f"“{m.group(1)}” (NLT)", body)
        out = []
        for i, s in enumerate(sentences(plain(raw))):
            if DANGLING.match(s) and not (i == 0 and re.match(r"^(This|These) [a-z]+", s)):
                break
            s = re.sub(r"\s*\((?:see|cp\.|compare|also)?[^()]*\d+:\d+[^()]*\)", "", s)
            out.append(gloss(re.sub(r"\s+([,.;:])", r"\1", s)))
        if out:
            refs = re.findall(rf"({REFWORD} \d+:\d+(?:[-–]\d+)?|\b\d+:\d+(?:[-–]\d+)?)", plain(t))
            return {"range": (a, b), "text": " ".join(out[:2]), "named_refs": refs[:6], "credit": CREDITS["tyndale"]}
    return None


# ---------------------------------------------------------------- whose words (John's UX test, 12 Oct)
# A verse screen's plain line read bare makes Bildad's wrong claims, the Teacher's "everything is meaningless", God's
# laws and John's visions sound like Yada stating facts. One line above it says whose words they are, from the same
# speaker data the summaries use (Glyssen), or from the kind of book.
LETTER_AUTHOR = {**{b: "Paul" for b in ("ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM")},
                 "HEB": "The writer", "JAS": "James", "1PE": "Peter", "2PE": "Peter", "1JN": "John", "2JN": "John", "3JN": "John", "JUD": "Jude"}
OT_BOOKS = {"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB",
            "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
            "HAG", "ZEC", "MAL"}

def display_name(n):
    """Glyssen's name as a reader says it: notes in brackets dropped, inverted forms turned round ("angels in white,
    two" → "two angels in white")."""
    n = re.sub(r"\s*\([^)]*\)", "", n).strip()
    m = re.match(r"^(.+?),\s*(one|two|three|some|many|all|several|other)$", n)
    return f"{m.group(2)} {m.group(1)}" if m else n

def voice(bk, c, v, o):
    if bk == "REV" and (c, v) >= (1, 9):
        return "In John’s vision:"
    if bk == "ECC":
        return "The Teacher says:"
    rows = [(n, k, qp) for n, st, k, qp in spk.execute("select c.name, s.standing, c.kind, s.quote_position from verse_speakers s join characters c "
                                                          "on c.id=s.character where s.ord=? order by s.line", (o,)) if st == "speaks"]
    # In the Old Testament, Glyssen's Jesus, Christ or Messiah speakers are one tradition's reading (Isaiah test).
    rows = [r_ for r_ in rows if not (bk in OT_BOOKS and re.search(r"\b(?:Jesus|Christ|Messiah)\b", r_[0]))]
    ust_line = book(bk).ust.get((c, v), "")
    # A frame only where the data says the speech is the whole verse (Glyssen's quote_position "EntireVerse") and the
    # UST line carries no quotation marks of its own; a quoted line already says who speaks, and narration in a speech
    # verse is never the speaker's ("Lydia says: “So we accepted her invitation…”", Acts 16:15, audit 12 Oct). A group
    # ID ("priests/Levites", kind multiple) is never split or made a plural subject: no frame.
    if rows and not any(k_ == "multiple" or "/" in n_ for n_, k_, _ in rows):
        names = list(dict.fromkeys(display_name(n_) for n_, _, _ in rows))
        if len(names) == 1 and all(qp == "EntireVerse" for _, _, qp in rows) and "“" not in ust_line:
            who = "God" if names[0] in ("God", "Yahweh", "LORD", "Lord") else names[0]
            return f"{who[0].upper() + who[1:]} {'say' if re.search(r'[a-z]s$', who.split()[-1]) and who.split()[-1][0].islower() else 'says'}:"
    if bk in LETTER_AUTHOR:
        return f"{LETTER_AUTHOR[bk]} tells them:" if LETTER_AUTHOR[bk] != "The writer" else "The writer tells them:"
    return None

DEBATES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "debates.json"), encoding="utf-8"))["entries"]

HALF_READINGS = 3

def debate_for(bk, c, v):
    return next((d for d in DEBATES if d["book"] == bk and tuple(d["from"]) <= (c, v) <= tuple(d["to"])), None)

# ---------------------------------------------------------------- assemble
def assemble(bk, c, v):
    o = ordinal(bk, c, v)
    vt = text(o) if o else ""
    notes = bsb_notes(bk, c, v)
    rd = readers_differ(bk, c, v)
    pw = plain_words(bk, c, v)
    # "21But" in a BSB note is verse 21's number glued to its first word: shown apart.
    ms = list(dict.fromkeys(re.sub(r"(?<![\d:])(\d+)(?=[A-Z“‘])", r"(\1) ", gloss(t)) for t in MS_NOTES.get((bk, c, v), [])))
    if not vt:  # a verse the BSB leaves out (John 5:4): the note, and what older and later manuscripts say
        return {"verse": f"{bk}.{c}.{v}", "missing": True, "manuscripts": ms, "plain": pw}
    sec = book(bk).section(c, v)
    pas = book(bk).passage_of(c, v)
    deb = debate_for(bk, c, v)
    # Positions (John, 12 Oct): each is a source's own sentence, unchanged, credited to that source alone; John approves
    # or rejects each one and writes nothing, so he is never a credit. Two or more approved positions lead the readings.
    approved = [p_ for p_ in (deb.get("positions") or []) if p_.get("status") == "approved"] if deb else []
    approved = approved if len(approved) >= 2 else []
    kind = deb and deb.get("kind")
    if deb:
        # What a disputed verse shows depends on its kind (John, 12 Oct; `debates-sort-2026-10-12.md` (in the private repo)):
        # "data": only the JPS 1917 verse (Old Testament) or the manuscript fact; "tn-readings": tN's readings, from the
        # verse notes or a chapter introduction that sets out two; "positions" and "held": nothing until John approves.
        # tN readings on the other kinds are about other words (Genesis 1:2's Spirit or wind) and would mislead.
        if kind == "tn-readings":
            rd = rd or intro_readings(bk, c)
        else:
            rd = []
        if kind == "data" and jps:
            # The whole JPS verse, not a chosen phrase: no rule can tell which difference is the disputed one (Psalm
            # 22:16 has three), and the BSB verse is on screen above, so the reader compares the two themselves.
            jt = text(o, "JPS")
            # BSB against JPS directly (audit, 12 Oct): the WEB/KJV/LSV differences say nothing about JPS.
            if jt and jps_contrast(o, most=99):
                rd = [{"about": None, "sentence": TEMPLATES["jps"].format(jps=jt.strip()), "options": [], "full_note": False,
                       "source": "jps", "credit": "JPS 1917, public domain"}]
    if approved:
        rd = [{"about": None, "sentence": p_["text"], "options": [], "full_note": False, "source": "position",
               "credit": p_["source"], **({"held_by": p_["held_by"]} if p_.get("held_by") else {})} for p_ in approved] + rd
    if kind == "data" and rd and rd[0].get("source") == "jps":
        # A "data" entry disputes meaning (Isaiah 7:14): the BSB verse and the JPS verse side by side are the whole
        # answer, and the UST's one reading would side with one of them, so no plain line (decided 12 Oct).
        pw = None
    if deb and not rd and not (kind == "data" and ms):
        # A "data" entry whose data is a manuscript fact (Mark 16:9–20, John 7:53–8:11) disputes whether the verses
        # belong, not what they mean, so its plain line stays. Otherwise: nothing approved and nothing from the data for this kind: the UST's one reading would take a side, so no
        # plain line either (Isaiah 7:14 before JPS; every "positions" and "held" verse). The report lists the verse.
        pw = None
    # Readings lead only on a disputed verse (a debates.json entry). On any other verse the plain line leads and the
    # readings follow Notice (John's verse-sheet spec, 12 Oct, which narrows the earlier "any verse with readings").
    disputed = bool(deb) and bool(rd)
    beginner = {
        # Where readers differ, the readings come first and the plain line is one of them, at body size (John, 12 Oct).
        "order": ["readers_differ", "plain"] if disputed else ["plain", "readers_differ"],
        "voice": voice(bk, c, v, o),
        "plain": pw and {**pw, "one_reading": bool(rd) or any(n["kind"] == "or" for n in notes),
                         "label": "One way to read it" if disputed else "In plain words"},
        # One phrase is explained once, in the highest slot (audit, 12 Oct): a BSB "Or …" note on the phrase a reading
        # already covers (John 3:16, "only begotten" beside the tN reading on "one and only … Son") is left out.
        "translators": [n for n in notes if n["kind"] in ("or", "literally") and not covered(n.get("on", ""), rd)][:2],
        # Approved source sentences can run past 18 words, so all of them are kept; the half view shows the count
        # ("Readers differ · 3 readings") and the full view each sentence in full (John, 12 Oct).
        "readers_differ": rd if approved else rd[:2],
        "manuscripts": ms,
        # The debate's question is for John's list only and never shown, so it stays out of the verse layer (audit).
        "debate": deb and {"kind": deb.get("kind")},
        # The slot is always Readers differ; where John marked the readings as sitting together, the lead-in says so
        # (John, 12 Oct: Psalm 2:7, Isaiah 14:12–15). The quotes themselves are never touched.
        # The half view shows at most three readings, in the file's order, with the full count in its lead-in; the
        # full view shows every one (John, 12 Oct). The app reads readers_half; readers_more is the quiet remainder.
        "readers_half": HALF_READINGS,
        "readers_more": max(0, len(rd if approved else rd[:2]) - HALF_READINGS),
        "readers_lead": ("Readers explain this in more than one way" if deb and deb.get("relation") == "together" else "Readers differ") if rd else None,
    }
    # "Speaking: Bildad" repeats the voice line above the plain words, so it shows only when there is no voice line.
    facts = [f for f in [compare_fact(bk, c, v)] + differs(o) + [word_fact(bk, c, v), None if beginner["voice"] else speakers(o)] +
             [TEMPLATES["cited"].format(ref=re.sub(r"^Cited from\s*", "", n["text"]).rstrip(".")) for n in notes if n["kind"] == "cited"] if f]
    ty = tyndale(bk, o, vt)
    return {
        "verse": f"{bk}.{c}.{v}",
        "where": {"frame": FRAME.get(bk), "section": pas and pas["title"], "range": pas and (pas["start"], pas["end"])},
        "beginner": beginner,
        "facts": facts[:3],
        "alongside": [x for x in (ty["named_refs"] if ty else []) if not re.match(rf"^(?:\d+:\d+|{re.escape(NAMES[bk].split()[-1][:3])}\w* {c}:)", x) and not x.startswith(f"{c}:")][:3],
        "deeper": {"explained": explained(bk, c, v)[:2], "key_words": key_words(bk, c, v)[:4], "study_note": ty,
                   "check": check_questions(bk, c, v)},
    }

def passage(bk, sec):
    """A BSB section: its heading, the Open Bible Story that tells it (narratives), its questions and answers."""
    (c1, v1), (c2, v2) = sec["start"], sec["end"]
    story = None
    for s in OBS:
        for (sb, sc1, sv1, sc2, sv2) in s["spans"]:
            if sb == bk and (sc1, sv1) <= (c2, v2) and (c1, v1) <= (sc2, sv2):
                story = s; break
        if story:
            break
    qa = [{"ref": r[0], "q": r[5], "a": r[6]} for r in book(bk).tq
          if re.match(r"^\d+:\d+$", r[0]) and (c1, v1) <= tuple(map(int, r[0].split(":"))) <= (c2, v2)]
    return {"title": sec["title"], "story": story and {"title": story["title"], "frames": story["frames"]}, "questions": qa}

# ---------------------------------------------------------------- quality report
def beginner_text(r):
    b = r["beginner"]
    parts = [b["plain"]["text"] if b["plain"] else ""] + [n["text"] for n in b["translators"]] + b["manuscripts"]
    for d in b["readers_differ"]:
        parts.append(d["sentence"])
    return " ".join(parts + r["facts"])

# {…} in the plain line is the UST's own mark for added words (shown grey), so it is not a leak.
LEAKS = re.compile(r"(your language|Alternate translation|\brc://|\bULT\b|\]\(|\*\*|\\n|figs-|<[a-z/]|\(See:)")

def report(bk, show=()):
    b_ = book(bk)
    # Verse 0 is a psalm title, which the BSB prints inside verse 1: not a verse of its own.
    vids = core.execute("select chapter, verse from verses where book=? and verse>0 order by ord", (bk,)).fetchall()
    res = [assemble(bk, c, v) for c, v in vids]
    live = [r for r in res if not r.get("missing")]
    n = len(live) or 1
    cnt = lambda f: sum(1 for r in live if f(r))
    pg = [grade(re.sub(r"[{}]", "", r["beginner"]["plain"]["text"])) for r in live if r["beginner"]["plain"]]
    med = lambda xs: sorted(xs)[len(xs) // 2] if xs else 0
    over = cnt(lambda r: words(beginner_text(r)) > WORD_BUDGET)
    leaks = [(r["verse"], m.group(0)) for r in live for m in [LEAKS.search(beginner_text(r) + " ".join(e["text"] for e in r["deeper"]["explained"]))] if m]
    nlt = cnt(lambda r: r["deeper"]["study_note"] and "(NLT)" in r["deeper"]["study_note"]["text"])
    secs = len(b_.sections)
    stories = len({p["story"]["title"] for p in (passage(bk, s) for s in b_.sections) if p["story"]})
    print(f"{bk:4} {len(vids):5} verses · plain {100 * cnt(lambda r: r['beginner']['plain']) // n:3}% (grade {med(pg)}) · "
          f"translators' notes {cnt(lambda r: r['beginner']['translators']):4} · readers differ {cnt(lambda r: r['beginner']['readers_differ']):4} · "
          f"facts {100 * cnt(lambda r: r['facts']) // n:3}% · key words {100 * cnt(lambda r: r['deeper']['key_words']) // n:3}% · "
          f"questions {100 * cnt(lambda r: r['deeper']['check']) // n:3}% · sections {secs} · stories {stories} · "
          f"over budget {over} · leaks {len(leaks)} · NLT-marked notes {nlt} · missing verses {len(res) - len(live)}")
    if leaks[:3]:
        print("      leak samples:", leaks[:3])
    for vid in show:
        _, c, v = vid.split(".")
        r = next(x for x in res if x["verse"] == vid)
        print(f"\n== {vid} · {text(ordinal(bk, int(c), int(v)))}")
        print(json.dumps(r, ensure_ascii=False, indent=1)[:6000])
    return res

# ---------------------------------------------------------------- golden checks (the pipeline port keeps these as tests)
def checks():
    fails = []
    def ok(cond, what):
        if not cond:
            fails.append(what)
    r = assemble("1CO", 14, 34)
    ok(any("Are to be silent" in f and "3 times" in f and "14:28, 14:30" in f for f in r["facts"]), "14:34 word fact")
    ok(any(d["about"].lower() == "women" and "married women" in d["sentence"].lower() and "“women”" in d["sentence"].lower() for d in readers_differ("1CO", 14, 34)), "14:34 women readings")
    # 14:34–35 is a major debate with no approved note yet: no plain line and no readings on the screen (John, 12 Oct).
    ok(r["beginner"]["debate"] and r["beginner"]["order"][0] == "readers_differ" and r["beginner"]["plain"]["label"] == "One way to read it", "14:34 debate: readings first, then one way to read it")
    _saved = list(DEBATES)
    DEBATES.insert(0, {"book": "ISA", "from": [7, 14], "to": [7, 14], "question": "q", "kind": "data", "positions": [
        {"text": "Source sentence one, unchanged.", "source": "Keil and Delitzsch", "status": "approved"},
        {"text": "Source sentence two, unchanged.", "source": "Tyndale Open Study Notes", "status": "approved"},
        {"text": "A rejected sentence.", "source": "Ellicott", "status": "rejected"}]})
    rp = assemble("ISA", 7, 14)["beginner"]["readers_differ"]
    ok([x["sentence"] for x in rp[:2]] == ["Source sentence one, unchanged.", "Source sentence two, unchanged."]
       and rp[0]["credit"] == "Keil and Delitzsch" and not any("John" in x.get("credit", "") for x in rp)
       and not any(x["sentence"] == "A rejected sentence." for x in rp), "approved positions: source sentences unchanged, credited to the source only")
    DEBATES[:] = _saved
    ok(not any(" or; or " in d["sentence"] or " or, or " in d["sentence"] for d in readers_differ("GEN", 1, 2)), "no doubled or")
    ok(assemble("PSA", 2, 7)["beginner"]["readers_lead"] == "Readers explain this in more than one way", "Psalm 2:7: readings that sit together")
    ok(assemble("1CO", 14, 34)["beginner"]["readers_lead"] == "Readers differ", "1 Cor 14:34: readings that differ")
    e40 = assemble("EZK", 40, 5)["beginner"]
    n40 = sum(p_["status"] == "approved" for d_ in DEBATES if d_["book"] == "EZK" and d_["from"] == [40, 1] for p_ in d_["positions"])
    ok(len(e40["readers_differ"]) == n40 and n40 > 3 and min(e40["readers_half"], len(e40["readers_differ"])) == 3 and e40["readers_more"] == n40 - 3,
       "EZK 40: three readings in the half view, every approved one in the full view")
    ok(assemble("JAS", 2, 24)["beginner"]["readers_lead"] == "Readers explain this in more than one way", "James 2: readings that sit together")
    ok(compare_fact("JHN", 3, 16) == "John uses the word for “world” more than any other book: 78 of its 185 uses in the Bible.", "John 3:16 comparison fact")
    ok(compare_fact("JHN", 11, 35) is None, "a name is never the comparison word")
    j316 = assemble("JHN", 3, 16)["beginner"]
    ok(not any("begotten" in n["text"] for n in j316["translators"]) or not j316["readers_differ"], "John 3:16: one phrase explained once")
    ok("question" not in (assemble("ISA", 7, 14)["beginner"]["debate"] or {}), "the debate question stays out of the verse layer")
    ok("Isaiah uses the word for “Isaiah”" not in (compare_fact("ISA", 1, 1) or "") and "Judah" not in (compare_fact("ISA", 1, 1) or ""), "Hebrew names (Np) are never the comparison word")
    ok(assemble("ACT", 16, 15)["beginner"]["voice"] is None, "Acts 16:15: narration in a speech verse is not Lydia's")
    ok(assemble("JHN", 1, 21)["beginner"]["voice"] is None, "John 1:21: dialogue with priests/Levites gets no frame")
    ok(assemble("JHN", 3, 3)["beginner"]["voice"] is None, "John 3:3: the UST's own quotation already names the speaker")
    ok(not any("TR" in m or "Later manuscripts include 4" in m for m in assemble("JHN", 5, 4).get("manuscripts", [])), "TR is printed editions, not manuscripts")
    ok(assemble("ISA", 7, 14)["beginner"]["plain"] is None, "data entry disputing meaning: no plain line beside the JPS verse")
    ok(assemble("JOB", 8, 6)["beginner"]["voice"] == "Bildad the Shuhite says:", "Job 8:6 voice")
    ok(assemble("REV", 20, 2)["beginner"]["voice"] == "In John’s vision:", "Rev 20:2 voice")
    ok(assemble("ECC", 1, 2)["beginner"]["voice"] == "The Teacher says:", "Eccl 1:2 voice")
    ok(assemble("LEV", 11, 3)["beginner"]["voice"] == "God says:", "Lev 11:3 voice")
    ok(assemble("ROM", 1, 7)["beginner"]["voice"] == "Paul tells them:", "Rom 1:7 voice")
    ok(assemble("JHN", 11, 35)["beginner"]["voice"] is None, "John 11:35 narration, no voice")
    i714 = assemble("ISA", 7, 14)["beginner"]
    ok(not jps or (i714["readers_differ"] and "young woman" in i714["readers_differ"][0]["sentence"] and i714["order"][0] == "readers_differ"), "Isaiah 7:14 JPS reading leads")
    # Micah 5:2 has no approved positions after John's review (12 Oct); Genesis 1 shows only his approved quotes.
    ok(not assemble("MIC", 5, 2)["beginner"]["readers_differ"] and assemble("MIC", 5, 2)["beginner"]["plain"] is None, "positions kind: nothing until two are approved")
    ok(all(d["source"] == "position" for d in assemble("GEN", 1, 2)["beginner"]["readers_differ"]), "positions kind: approved quotes only, no off-topic tN reading")
    ok(not assemble("LEV", 18, 22)["beginner"]["readers_differ"] and assemble("LEV", 18, 22)["beginner"]["plain"] is None, "held kind: nothing")
    ok(assemble("MRK", 16, 9)["beginner"]["plain"] and assemble("MRK", 16, 9)["beginner"]["manuscripts"], "data kind: Mark 16:9 keeps its plain line beside the manuscripts fact")
    r20 = assemble("REV", 20, 4)["beginner"]["readers_differ"]
    ok(r20 and "Jesus reigning now from heaven" in r20[0]["sentence"], "tn-readings kind: Revelation 20 intro readings")
    p2216 = assemble("PSA", 22, 16)["beginner"]["readers_differ"]
    ok(not jps or (p2216 and "like a lion" in p2216[0]["sentence"]), "Psalm 22:16 JPS verse shown whole")
    j = assemble("JHN", 1, 5)
    ok(j["beginner"]["readers_differ"] and j["beginner"]["order"][0] == "plain" and j["beginner"]["plain"]["label"] == "In plain words", "an ordinary verse leads with the plain line")
    ok(all(len(x.split("“")[1].split("”")[0].split()) <= 2 for x in r["facts"] if x.startswith("Translations differ")), "differences are one or two words")
    ok(any("after verse 40" in m for m in r["beginner"]["manuscripts"]), "14:34 manuscripts note")
    ok(r["where"]["section"] == "Orderly Worship", "14:34 section: the passage that contains it (1 Corinthians has no bundle passages, so the BSB section)")
    ok(assemble("JHN", 1, 5)["where"]["section"] == sqlite3.connect(next(f"{B}/{f}" for f in sorted(os.listdir(B), reverse=True) if re.fullmatch(r"jhn\.v\d+\.db", f))).execute("select label from pericopes order by start_ord").fetchone()[0], "John 1:5 section: the guide's passage label")
    ok(any(k["term"] == "church" for k in r["deeper"]["key_words"]), "14:34 key word church")
    ok(not any(x.startswith("14:3") for x in r["alongside"]), "alongside never the verse itself")
    m = assemble("JHN", 5, 4)
    ok(m.get("missing") and m["manuscripts"] and m["plain"]["bracketed"], "John 5:4 missing, noted, UST bracketed")
    ok(assemble("JHN", 7, 53)["beginner"]["manuscripts"], "John 7:53 manuscripts note")
    ok(assemble("JHN", 11, 35)["beginner"]["plain"]["text"].startswith("Jesus started crying"), "John 11:35 plain")
    ok(assemble("PSA", 23, 1)["beginner"]["plain"], "Psalm 23:1 plain line")
    return fails

def rule9(bk):
    """No NLT wording in anything a beginner sees; Tyndale's NLT words stay marked inside the study note only."""
    bad = []
    for c, v in core.execute("select chapter, verse from verses where book=? and verse>0", (bk,)):
        r = assemble(bk, c, v)
        if r.get("missing"):
            continue
        if "(NLT)" in beginner_text(r) or any("(NLT)" in e["text"] for e in r["deeper"]["explained"]):
            bad.append(r["verse"])
    return bad

if __name__ == "__main__":
    if sys.argv[1] == "checks":
        f = checks()
        print("golden checks:", "all pass" if not f else f)
        for bk in ("JHN", "1CO", "PSA"):
            b9 = rule9(bk)
            print(f"rule 9 {bk}:", "clean" if not b9 else b9[:5])
        sys.exit(1 if f else 0)
    if sys.argv[1] == "report":
        have = [c for c in ORDER if glob.glob(f"{RAW}/uw-ust/en_ust/*-{c}.usfm") or glob.glob(f"{RAW}/uw-tn/en_tn/tn_{c}.tsv")]
        for c in (sys.argv[2:] or have):
            report(c)
    else:
        report(sys.argv[1], sys.argv[2:])
