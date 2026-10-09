import json, re, sqlite3, html, os, sys, datetime

Y = os.environ.get("YADA_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))
STYLE = sys.argv[2] if len(sys.argv) > 2 else "v1"  # v1 = brief tokens as written; v2 = the modern restyle
OUT = os.path.join(sys.argv[1] if len(sys.argv) > 1 else "canvas", "project")
os.makedirs(OUT, exist_ok=True)
db = sqlite3.connect(f"{Y}/content/bundles/core.v2.db")
G = {k: json.load(open(f"{Y}/golden/{k}.json")) for k in ["1co.14.34", "jhn.1.1", "gen.1.1"]}

BOOK = {"1CO": "1 Corinthians", "1TI": "1 Timothy", "JHN": "John", "GEN": "Genesis", "PSA": "Psalm", "ISA": "Isaiah"}
SHORT = {"1CO": "1 Cor", "1TI": "1 Tim", "JHN": "John", "GEN": "Gen"}
REL = {"contrast": "Contrast", "development": "Develops", "thematic": "Same theme", "allusion": "Echoes"}


def text(tr, book, ch, a, b=None):
    b = b or a
    rows = db.execute("select v.verse, t.text from verses v join texts t on t.ord=v.ord where v.book=? and v.chapter=? and v.verse between ? and ? and t.translation=? order by v.ord", (book, ch, a, b, tr)).fetchall()
    return rows


def fref(r):
    p = r.split("-")
    b, c, v = p[0].split(".")
    s = f"{BOOK[b]} {c}:{v}"
    if len(p) > 1:
        q = p[1].split(".")
        if len(q) == 2:
            s += f"–{q[1]}" if q[0] == c else f"–{q[0]}:{q[1]}"
        else:
            s += f"–{q[0]}"
    return s


E = lambda s: html.escape(s, quote=False)
GREEK = re.compile(r"([Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ\s]*[Ͱ-Ͽἀ-῿̀-ͯ]|[Ͱ-Ͽἀ-῿])")
HEB = re.compile(r"([֐-׿][֐-׿\s]*[֐-׿]|[֐-׿])")


def lang(s):
    """Escape, then wrap Greek runs in lang=el and Hebrew runs in an isolated lang=he (brief §5: every run)."""
    s = E(s)
    s = GREEK.sub(lambda m: f'<span lang="el" class="gk">{m.group(1)}</span>', s)
    s = HEB.sub(lambda m: f'<bdi lang="he" dir="rtl" class="hb">{m.group(1)}</bdi>', s)
    return s


# ---------- icons (inline stroke SVG) ----------
def ic(name, size=20):
    if name == "alpha":
        # A real Greek letter at text size; an alpha drawn inside a 24-unit icon box renders too small to read.
        return '<span class="gly" lang="el" aria-hidden="true">α</span>'
    p = {
        "back": '<path d="M15 4 7 12l8 8"></path>',
        "down": '<path d="m6 9 6 6 6-6"></path>',
        "up": '<path d="m6 15 6-6 6 6"></path>',
        "right": '<path d="m9 5 7 7-7 7"></path>',
        "x": '<path d="M6 6l12 12M18 6 6 18"></path>',
        "more": '<circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle>',
        "check": '<path d="m5 12.5 4.5 4.5L19 7"></path>',
        "alpha": '<text x="12" y="17.5" text-anchor="middle" font-size="19" font-family="Gentium Plus, serif" fill="currentColor" stroke="none">α</text>',
        "cols": '<rect x="3.5" y="5" width="17" height="14" rx="3"></rect><path d="M12 5v14"></path>',
    }[name]
    return f'<svg class="i" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p}</svg>'


# ---------- reader ----------
def header(back, title, scrolled=False, hint=None):
    cls = "hdr scrolled" if scrolled else "hdr"
    b = f'<button class="hb-back" aria-label="{E(back[1])}">{ic("back", 22)}<span>{E(back[0])}</span></button>'
    if STYLE == "v1":
        t = f'<button class="hb-title" aria-label="{E(title)}, opens books, chapters and translations"><span>{E(title)}</span>{ic("down", 16)}</button>'
    else:
        name, tr = title.rsplit(" · ", 1)
        t = f'<button class="hb-title" aria-label="{E(name)}, {tr}, opens books, chapters and translations"><span class="tt">{E(name)}</span><span class="tv">{tr}{ic("down", 12)}</span></button>'
    aa = '<button class="hb-aa" aria-label="Text size and appearance">Aa</button>'
    return f'<div class="{cls}"><div class="hrow d">{b}{t}{aa}</div><div class="a"><div class="hrow">{b}<span class="sp"></span>{aa}</div><div class="hrow2">{t}</div></div></div>'


def verses_html(rows, sel=(), before=None, ch=None):
    out, group = [], []
    def flush():
        if group:
            out.append('<div class="selg">' + "".join(group) + "</div>")
            group.clear()
    for n, t in rows:
        pre = " pre" if before is not None and n < before else ""
        if n == 1 and ch and STYLE != "v1":
            p = f'<p class="v v1{pre}"><span class="cn" aria-label="Chapter {ch}, verse 1">{ch}</span>{E(t)}</p>'
        else:
            p = f'<p class="v{pre}"><span class="vn">{n}</span> {E(t)}</p>'
        if n in sel:
            group.append(p)
        else:
            flush(); out.append(p)
    flush()
    return "".join(out)


def reader(book, ch, a, b, back=("Home", "Home"), sel=(), offset=0, hint=False, foot=None, scrolled=True, abar=None, entry=True):
    title = f"{BOOK[book]} {ch} · BSB"
    rows = text("BSB", book, ch, a, b)
    h = header(back, title, scrolled)
    hint_html = '<p class="hint">Tap a verse to see what it meant.</p>' if hint else ""
    foot_html = ""
    if foot:
        foot_html = f'<div class="cfoot"><div class="clinks"><button class="clink">{ic("back", 18)}{E(foot[0])}</button><button class="clink">{E(foot[1])}{ic("right", 18)}</button></div><p class="note muted">Berean Standard Bible</p></div>'
    bar = ""
    if abar and STYLE != "v1" and not entry:
        bar = (f'<div class="abar"><div class="d abar-row"><button class="ab-i">{ic("alpha", 18)}<span>Original</span></button>'
               f'<button class="ab-i">{ic("cols", 18)}<span>Compare</span></button><button class="ab-m" aria-label="More actions">{ic("more", 22)}</button></div>'
               f'<div class="a abar-list"><button class="ab-i">Original</button><button class="ab-i">More{ic("more", 30)}</button></div></div>')
    elif abar and STYLE != "v1":
        bar = (f'<div class="abar"><div class="d abar-row"><button class="ab-u">Understand {E(abar)}</button><button class="ab-i">{ic("alpha", 18)}<span>Original</span></button>'
               f'<button class="ab-i">{ic("cols", 18)}<span>Compare</span></button><button class="ab-m" aria-label="More actions">{ic("more", 22)}</button></div>'
               f'<div class="a abar-list"><button class="ab-u">Understand {E(abar)}</button><button class="ab-i">More{ic("more", 30)}</button></div></div>')
    elif abar:
        bar = (f'<div class="abar"><div class="d abar-row"><button class="ab-u">Understand {E(abar)}</button><button class="ab-i">Original</button>'
               f'<button class="ab-i">Compare</button><button class="ab-m" aria-label="More actions">{ic("more", 22)}</button></div>'
               f'<div class="a abar-list"><button class="ab-u">Understand {E(abar)}</button><button class="ab-i">Original</button><button class="ab-i">Compare</button><button class="ab-i">More actions</button></div></div>')
    # With an action bar up, AX frames scroll so the selected verse starts the page (brief §4: it stays above the bar).
    first = min(sel) if (abar and sel) else None
    axsel = ' class="axsel"' if first else ""
    return f'{h}<div class="rbody"><div{axsel} style="margin-top: {offset}px">{hint_html}{verses_html(rows, sel, before=first, ch=ch)}{foot_html}</div></div>{bar}'


# ---------- sheets ----------
def sheet(pos, title, sub=None, body="", unrev=False, back=False, scrolled=False, foot=True, cls=""):
    bk = f'<button class="sh-back" aria-label="Back">{ic("back", 22)}</button>' if back else ""
    lbl = '<button class="lbl unrev">Unreviewed</button>' if unrev else ""
    subh = f'<span class="ssub">{lang(sub)}</span>' if sub else ""
    hd = f'<div class="shdr{" scrolled" if scrolled else ""}">{bk}<div class="stitle"><span class="sttl">{lang(title)}</span>{subh}{lbl}</div><button class="sh-x" aria-label="Close">{ic("x", 20)}</button></div>'
    ft = '<div class="sfoot"><button class="btr">Back to reading</button></div>' if foot else ""
    return f'<div class="sheet {pos} {cls}"><div class="grab"></div>{hd}<div class="sbody">{body}</div>{ft}</div>'


def scrim(cls=""):
    return f'<div class="scrim {cls}"></div>'


def sec(label, inner, first=False, hint=None, cls=""):
    h = f'<p class="note muted hint2">{E(hint)}</p>' if hint else ""
    lb = f'<h3 class="lbl">{E(label)}</h3>' if label else ""
    return f'<section class="sec{" first" if first else ""}{" " + cls if cls else ""}">{lb}{h}{inner}</section>'


def row(main, label=None, extra=None, chev=True, cls=""):
    l = f'<span class="lbl rl">{E(label)}</span>' if label else ""
    x = f'<span class="rx">{extra}</span>' if extra else ""
    c = f'<span class="chev">{ic("right", 18)}</span>' if chev else ""
    return f'<button class="row {cls}"><span class="rm"><span class="claim">{main}</span>{l}{x}</span>{c}</button>'


def claim_label(c):
    if c["grounding"] == "model_knowledge":
        return "Background"
    if c["evidence_strength"] == "supported":
        return "Supported"
    return None


PASSAGE = {"1co.14.34": ("Order in the assembly", "14:26–40"), "jhn.1.1": ("The Word became flesh", "1:1–18"), "gen.1.1": ("The first day", "1:1–5")}
LANGNAME = {"1co.14.34": "Greek", "jhn.1.1": "Greek", "gen.1.1": "Hebrew"}


def interlinear(k, mark=None, reveal=None):
    g = G[k]["gloss"]
    rtl = k.startswith("gen")
    lng = "he" if rtl else "el"
    units, rows_ = [], []
    for i, w in enumerate(g):
        m = " mark" if mark == i else ""
        if reveal is not None:
            m += " rv-on" if i < reveal else (" rv-next" if i == reveal else " rv-off")
        gl = E(w["gloss"])
        units.append(f'<span class="w{m}"><span class="o" lang="{lng}">{w["surface"]}</span><span class="gl">{gl}</span></span>')
        rows_.append(f'<span class="wr{m}"><span class="gl">{gl}</span><span class="o" lang="{lng}">{w["surface"]}</span></span>' if rtl else
                     f'<span class="wr{m}"><span class="o" lang="{lng}">{w["surface"]}</span><span class="gl">{gl}</span></span>')
    d = ' dir="rtl"' if rtl else ""
    rcls = " rtl" if rtl else ""
    return f'<div class="il d"{d}>{"".join(units)}</div><div class="ilr a{rcls}">{"".join(rows_)}</div>'


def original_section(k, expanded, mark=None, reveal=None):
    name = LANGNAME[k]
    hdr = f'<button class="disc" aria-expanded="{"true" if expanded else "false"}"><span>Original {name}</span>{ic("up" if expanded else "down", 18)}</button>'
    if not expanded:
        return f'<section class="sec">{hdr}</section>'
    src = "STEPBible (TAHOT)" if name == "Hebrew" else "STEPBible (TAGNT, TBESG)"
    inner = (f'{hdr}<div class="orig">{interlinear(k, mark, reveal)}<p class="note muted src">Glosses: {src}</p>'
             f'<h3 class="lbl">Closer to the {name}</h3><p class="close">{E(G[k]["close_rendering"])}</p><p class="note muted">Composed, not a word-for-word gloss.</p></div>')
    return f'<section class="sec">{inner}</section>'


def understand_body(k, start="top", show_all=False, hint=False, orig=False, large=False, mark=None, clamp=False, reveal=None):
    e = G[k]
    plain = sorted([c for c in e["claims"] if c["category"] != "debated"], key=lambda c: c["display_rank"])
    deb = sorted([c for c in e["claims"] if c["category"] == "debated"], key=lambda c: c["display_rank"])
    parts = []
    if large and start == "top":
        b, c, v = e["verse_id"].split(".")
        vt = text("BSB", b, int(c), int(v))[0][1]
        parts.append(f'<button class="vline d"><span>{E(vt)}</span>{ic("down", 16)}</button><button class="vshow a">Show verse</button>')
    if start == "top":
        if clamp and STYLE != "v1":
            parts.append(sec("What’s happening", f'<p class="expl clamp">{lang(e["whats_happening"])}</p><button class="more d">More</button>', first=not large))
        else:
            parts.append(sec("What’s happening", f'<p class="expl">{lang(e["whats_happening"])}</p>', first=not large))
    shown = plain if show_all else plain[:3]
    rows_ = "".join(row(lang(c["claim"]), claim_label(c)) for c in shown)
    more = "" if show_all else f'<button class="more">Show all {len(plain)}</button>'
    if start in ("top", "see"):
        parts.append(sec("What we can see", rows_ + more, first=(start == "see"), hint="Tap a line to see the evidence." if hint else None))
    if start in ("top", "see"):
        drows = "".join(row(lang(c["claim"]), extra=f'<span class="link">Compare the {len(c["positions"])} readings</span>') for c in deb)
        parts.append(sec("Where interpretation differs", drows))
    if start in ("top", "see", "orig"):
        parts.append(original_section(k, orig, mark, reveal))
        parts.append(f'<section class="sec">{row("Compare translations", cls="plain")}</section>')
        t, r = PASSAGE[k]
        parts.append(sec("Passage", row(f"{E(t)} · {r}", cls="plain")))
        gd = "".join(row(f'{E(fref(p["ref"]))} — {REL[p["relationship"]]}', extra=f'<span class="note muted">{lang(p["note"])}</span>') for p in e["related_passages"])
        parts.append(sec("Go deeper", gd))
    return "".join(parts)


def understand(k, pos="med", **kw):
    kw.setdefault("clamp", pos == "med")
    b, c, v = G[k]["verse_id"].split(".")
    return sheet(pos, f"{BOOK[b]} {c}:{v}", body=understand_body(k, **kw), unrev=True, scrolled=kw.get("start", "top") != "top")


# ---------- frame composition ----------
CSS = open(os.path.join(os.path.dirname(__file__), "style.css" if STYLE == "v1" else f"style-{STYLE}.css")).read()
FONTS = "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&amp;family=Gentium+Plus&amp;family=Noto+Serif+Hebrew:wght@400;600&amp;display=swap"


def doc(fid, title, inner):
    chrome_open, chrome_close = ("", "") if STYLE == "v1" else ('<div class="island" aria-hidden="true"></div>', '<div class="homeind" aria-hidden="true"></div>')
    steps = inner if isinstance(inner, list) else [(lab, cls, inner) for lab, cls in (("Light", "light"), ("Dark", "dark"), ("AX5", "ax5"))]
    cols = "".join(
        f'<div class="col"><div class="cap">{fid} · {lab}</div><div class="ph {cls}">{chrome_open}{html_}{chrome_close}</div></div>'
        for lab, cls, html_ in steps)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{E(fid)} {E(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="{FONTS}">
<style>
{CSS}
</style>
</helmet>
<div class="ab">{cols}</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1430,"height":1026}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''


FRAMES = []


def F(fid, title, inner, group):
    FRAMES.append((fid, title, inner, group))


# ----- content helpers -----
def word_card(headword, lng, translit, gloss, form, lemma, lemma_tr, strongs, usually, note, in_book, in_bible, sources, morphemes=None):
    rtl = lng == "he"
    dir_attr = ' dir="rtl"' if rtl else ""
    hw = f'<p class="hw{" rtl" if rtl else ""}" lang="{lng}"{dir_attr}>{headword}</p>'
    morph = ""
    if morphemes:
        morph = sec("Parts", "".join(
            f'<div class="mrow"><span class="mg">{E(m["gloss"])}<span class="note muted"> · {E(m["role"])}</span></span><span class="mo" lang="he" dir="rtl">{m["surface"]}</span></div>' for m in morphemes))
    body = (hw + f'<p class="tr">{E(translit)} · {E(gloss)}</p>'
            + sec("Form", f'<p class="claim">{E(form)}</p>', cls="kv")
            + morph
            + sec("Dictionary form", f'<p class="claim">{lang(lemma)} · {E(lemma_tr)} · {strongs}</p><p class="note muted">Usually “{E(usually)}”.</p>', cls="kv")
            + sec("In this verse", f'<p class="claim">{lang(note)}</p>')
            + f'<section class="sec">{row(E(in_book), cls="plain")}<p class="note muted cnt">{E(in_bible)}</p><p class="note muted">{E(sources)}</p></section>')
    return body


def occ_rows(items):
    out = []
    for ref, eng, form, lng, here in items:
        h = '<span class="here">Here</span>' if here else ""
        cls = "orow here-row" if here else "orow"
        out.append(f'<button class="{cls}"><span class="rm"><span class="oref">{E(ref)}{h}</span><span class="otext">{eng}</span><span class="note muted">Form <span lang="{lng}">{form}</span></span></span><span class="chev">{ic("right", 18)}</span></button>')
    return "".join(out)


def bold(t, w):
    return E(t).replace(E(w), f"<b>{E(w)}</b>", 1)


STOP = set("unto saith thing anything any been keep also the a an and or but to of in for is are be as it they them their if at on with about this that let your own also any has have not must were was its so he she his her him from by do did no nor".split())


def words(s):
    return re.findall(r"[A-Za-z’']+|[^A-Za-z’'\s]+|\s+", s)


def mark_diff(s, others):
    pool = set()
    for o in others:
        pool |= {w.lower()[:5] for w in re.findall(r"[A-Za-z’']+", o)}
    out = []
    for w in words(s):
        if re.match(r"[A-Za-z’']+$", w) and w.lower() not in STOP and w.lower()[:5] not in pool:
            out.append(f'<mark class="df">{E(w)}</mark>')
        else:
            out.append(E(w))
    return "".join(out)


# ================= Journey 01 =================
FOOT14 = ("1 Corinthians 13", "1 Corinthians 15")
F("J01-01", "Reader, 1 Cor 14:33–38", reader("1CO", 14, 33, 40, offset=-8, foot=FOOT14), "j01")
F("J01-02", "Verse 34 selected, action bar", reader("1CO", 14, 31, 40, sel=(34,), offset=-20, abar="14:34"), "j01")
F("J01-03", "Understand 14:34, medium", reader("1CO", 14, 33, 36, sel=(34,), offset=-70) + scrim() + understand("1co.14.34", "med"), "j01")
F("J01-04", "Understand, large, What we can see expanded", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + understand("1co.14.34", "lg", start="see", show_all=True), "j01")

c1 = G["1co.14.34"]["claims"][0]
why = (f'<p class="claim big">{lang(c1["claim"])}</p>'
       + sec("How we know", '<p class="claim">From the Greek text and its parsing (MorphGNT).</p>')
       + f'<section class="sec">{row(lang("See the word σιγάτωσαν"), cls="plain")}</section>')
BACK_U = lambda k, **kw: understand(k, "back", **kw)
F("J01-05", "Why we say this", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + BACK_U("1co.14.34") + scrim("s2") +
  sheet("med", "Why we say this", "1 Corinthians 14:34", why), "j01")
F("J01-06", "Understand, Original Greek expanded", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + understand("1co.14.34", "lg", start="orig", orig=True), "j01")

kw1 = G["1co.14.34"]["key_words"][0]
F("J01-07", "Word: σιγάτωσαν", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + BACK_U("1co.14.34", start="orig", orig=True, mark=5) + scrim("s2") +
  sheet("med", "Word", "1 Corinthians 14:34", word_card("σιγάτωσαν", "el", "sigatōsan", "let them be silent", "Present active imperative, 3rd person plural",
        "σιγάω", "sigaō", "G4601", "were silent", kw1["note"], "3 times in 1 Corinthians", "9 in the Bible", "Gloss: TAGNT · Parsing: MorphGNT")), "j01")

v28 = text("BSB", "1CO", 14, 28)[0][1]; v30 = text("BSB", "1CO", 14, 30)[0][1]; v34 = text("BSB", "1CO", 14, 34)[0][1]
occ = occ_rows([("1 Corinthians 14:28", bold(v28, "remain silent"), "σιγάτω", "el", False),
                ("1 Corinthians 14:30", bold(v30, "should stop"), "σιγάτω", "el", False),
                ("1 Corinthians 14:34", bold(v34, "be silent"), "σιγάτωσαν", "el", True)])
F("J01-08", "Occurrences: σιγάω in 1 Corinthians", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + BACK_U("1co.14.34") + scrim("s2") +
  sheet("lg2", "σιγάω in 1 Corinthians", "1 Corinthians 14:34", occ, back=True), "j01")

c7 = G["1co.14.34"]["claims"][6]
def readings(c, here):
    out = []
    for p in c["positions"]:
        links = []
        for ev in p["evidence"]:
            if ev["type"] == "verse" and ev["ref"] == here:
                continue
            if ev["type"] == "verse":
                links.append(f'<button class="elink">{E(fref(ev["ref"]))}{ic("right", 16)}</button>')
            else:
                links.append(f'<p class="note muted">{lang(ev["lemma"])} · {lang(ev["note"])} · {E(ev["dataset"])}</p>')
        out.append(f'<section class="sec rd"><h3 class="rlabel">{lang(p["label"])}</h3><p class="claim">{lang(p["case"])}</p><div class="elinks">{"".join(links)}</div></section>')
    return "".join(out)
F("J01-09", "Compare the readings", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + BACK_U("1co.14.34") + scrim("s2") +
  sheet("med", "Who the instruction addresses", "1 Corinthians 14:34", readings(c7, "1CO.14.34")), "j01")

t12 = text("BSB", "1TI", 2, 11, 12)
peek = (f'<p class="lbl">Same theme</p><p class="note muted pk">{E(G["1co.14.34"]["related_passages"][2]["note"])}</p>'
        + verses_html(t12) + f'<button class="readbtn">Read 1 Timothy 2{ic("right", 18)}</button>')
F("J01-10", "Peek: 1 Timothy 2:11–12", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + BACK_U("1co.14.34") + scrim("s2") +
  sheet("med", "1 Timothy 2:11–12", "From 1 Corinthians 14:34", peek), "j01")
F("J01-11", "Reader at 1 Timothy 2:11, return chip", reader("1TI", 2, 10, 15, back=("1 Cor 14:34", "Back to 1 Corinthians 14:34"), offset=-60, foot=("1 Timothy 1", "1 Timothy 3")), "j01")

e34 = G["1co.14.34"]
pas = (sec(None, row("Order in the assembly · 14:26–40", cls="plain"), first=True)
       + sec("14:34", f'<p class="expl">{lang(e34["whats_happening"])}</p>{row("More on 14:34", cls="plain")}'))
F("J01-12", "Passage Understand 14:34–35", reader("1CO", 14, 33, 36, sel=(34, 35), offset=-80) + scrim() +
  sheet("med", "1 Corinthians 14:34–35", body=pas, unrev=True), "j01")

def translations(book, ch, a, b):
    T = {tr: " ".join(t for _, t in text(tr, book, ch, a, b)) for tr in ("BSB", "WEB", "KJV")}
    if len({re.sub(r"\W", "", v.lower()) for v in T.values()}) == 1:
        return f'<p class="claim">BSB, WEB and KJV agree here.</p><p class="scrq">{E(T["BSB"])}</p>'
    out = []
    for tr in ("BSB", "WEB", "KJV"):
        others = [T[o] for o in T if o != tr] if tr == "BSB" else [T["BSB"]]
        body_ = mark_diff(T[tr], others) if (tr == "BSB" or STYLE == "v1") else E(T[tr])
        out.append(f'<section class="sec tr-sec"><h3 class="lbl">{tr}</h3><p class="scrq">{body_}</p></section>')
    return "".join(out)
F("J01-13", "Translations 14:34–35", reader("1CO", 14, 33, 36, sel=(34, 35)) + scrim() +
  sheet("back", "1 Corinthians 14:34–35", body=pas, unrev=True) + scrim("s2") +
  sheet("lg2", "Translations", "1 Corinthians 14:34–35", translations("1CO", 14, 34, 35)), "j01")
F("J01-14", "Back to reading at 14:34", reader("1CO", 14, 31, 40, sel=(34,), offset=-20, abar="14:34"), "j01")
F("J01-15", "1 Timothy 2:11 selected, no explanation", reader("1TI", 2, 9, 15, back=("1 Cor 14:34", "Back to 1 Corinthians 14:34"), sel=(11,), offset=-150, abar="2:11", entry=False), "j01")

# ================= John 1:1 =================
FOOTJ = ("John 21", "John 2")
F("JN-01", "First launch: John 1, hint line", reader("JHN", 1, 1, 9, hint=True, scrolled=False), "jn")
F("JN-02", "1:1 selected", reader("JHN", 1, 1, 9, sel=(1,), scrolled=False, abar="1:1"), "jn")
F("JN-03", "Understand 1:1, medium, first-time hint", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + understand("jhn.1.1", "med", hint=True), "jn")
F("JN-04", "Original Greek expanded", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + understand("jhn.1.1", "lg", start="orig", orig=True), "jn")
kwj = G["jhn.1.1"]["key_words"][0]
F("JN-05", "Word: λόγος", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + BACK_U("jhn.1.1", start="orig", orig=True, mark=4) + scrim("s2") +
  sheet("med", "Word", "John 1:1", word_card("λόγος", "el", "logos", "word", "Noun, nominative masculine singular",
        "λόγος", "logos", "G3056", "word", kwj["note"], "40 times in John", "330 in the Bible", "Gloss: TAGNT · Parsing: MorphGNT")), "jn")
F("JN-06", "Translations: all three agree", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + BACK_U("jhn.1.1") + scrim("s2") +
  sheet("med", "Translations", "John 1:1", translations("JHN", 1, 1, 1)), "jn")
ej = G["jhn.1.1"]
pasj = (sec(None, row("The Word became flesh · 1:1–18", cls="plain"), first=True)
        + sec("1:1", f'<p class="expl">{lang(ej["whats_happening"])}</p>{row("More on 1:1", cls="plain")}'))
F("JN-07", "Passage Understand 1:1–5", reader("JHN", 1, 1, 6, sel=(1, 2, 3, 4, 5), scrolled=False) + scrim() +
  sheet("med", "John 1:1–5", body=pasj, unrev=True), "jn")

# ================= Genesis 1:1 =================
F("GN-01", "Reader, Genesis 1, 1:1 selected", reader("GEN", 1, 1, 8, sel=(1,), scrolled=False, abar="1:1"), "gn")
F("GN-02", "Understand 1:1, Hebrew inside English claims", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + understand("gen.1.1", "lg", large=True), "gn")
F("GN-03", "Original Hebrew expanded, right to left", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + understand("gen.1.1", "lg", start="orig", orig=True), "gn")
kwg = G["gen.1.1"]["key_words"][0]
F("GN-04", "Word: בְּרֵאשִׁית with parts", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + BACK_U("gen.1.1", start="orig", orig=True, mark=0) + scrim("s2") +
  sheet("lg2", "Word", "Genesis 1:1", word_card("בְּרֵאשִׁ֖ית", "he", "bərēʾšîṯ", "in beginning", "Preposition with noun, feminine singular absolute",
        "רֵאשִׁית", "rēʾšîṯ", "H7225", "beginning of", kwg["note"], "3 times in Genesis", "51 in the Bible", "Gloss: TAHOT · Parsing: OSHB",
        morphemes=G["gen.1.1"]["gloss"][0]["morphemes"])), "gn")
g1 = text("BSB", "GEN", 1, 1)[0][1]; g10 = text("BSB", "GEN", 10, 10)[0][1]; g49 = text("BSB", "GEN", 49, 3)[0][1]
occg = occ_rows([("Genesis 1:1", bold(g1, "beginning"), "בְּרֵאשִׁ֖ית", "he", True),
                 ("Genesis 10:10", bold(g10, "began"), "רֵאשִׁ֤ית", "he", False),
                 ("Genesis 49:3", bold(g49, "beginning"), "וְרֵאשִׁ֣ית", "he", False)])
F("GN-05", "Occurrences: רֵאשִׁית in Genesis", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + BACK_U("gen.1.1") + scrim("s2") +
  sheet("lg2", "רֵאשִׁית in Genesis", "Genesis 1:1", occg, back=True), "gn")

# ================= Delight (v2) =================
if STYLE != "v1":
    U_ORIG = lambda **kw: understand("1co.14.34", "lg", start="orig", orig=True, mark=5, **kw)
    base = reader("1CO", 14, 33, 36, sel=(34,)) + scrim()
    word_sheet = lambda pos: sheet(pos, "Word", "1 Corinthians 14:34", word_card("σιγάτωσαν", "el", "sigatōsan", "let them be silent", "Present active imperative, 3rd person plural",
        "σιγάω", "sigaō", "G4601", "were silent", kw1["note"], "3 times in 1 Corinthians", "9 in the Bible", "Gloss: TAGNT · Parsing: MorphGNT"))
    F("D-01", "Word lifts into its card", [
        ("1 · Tap the word", "light", base + U_ORIG()),
        ("2 · It leaves its place and rides up as the headword", "light", base + '<div class="lifting">' + BACK_U("1co.14.34", start="orig", orig=True, mark=5) + '</div>' + scrim("s2") + word_sheet("rise")),
        ("3 · It lands as the headword", "light", base + BACK_U("1co.14.34", start="orig", orig=True, mark=5) + scrim("s2") + word_sheet("med")),
    ], "dl")
    gbase = reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim()
    F("D-02", "Hebrew arrives right to left", [
        ("1 · The first word, from the right", "light", gbase + understand("gen.1.1", "lg", start="orig", orig=True, reveal=1)),
        ("2 · Reading on, right to left", "light", gbase + understand("gen.1.1", "lg", start="orig", orig=True, reveal=4)),
        ("3 · Settled", "light", gbase + understand("gen.1.1", "lg", start="orig", orig=True)),
    ], "dl")
    jg = G["jhn.1.1"]["gloss"]; gg = G["gen.1.1"]["gloss"]
    pair = (f'<div class="pair"><div class="pr"><span class="o" lang="el">{jg[0]["surface"]} {jg[1]["surface"]}</span><span class="gl">{E(jg[0]["gloss"])} {E(jg[1]["gloss"])} · John 1:1</span></div>'
            f'<div class="pr"><span class="o" lang="he" dir="rtl">{gg[0]["surface"]}</span><span class="gl">{E(gg[0]["gloss"])} · Genesis 1:1</span></div></div>')
    echo = (f'<p class="lbl">Same first words</p>{pair}'
            + verses_html(text("BSB", "GEN", 1, 1)) + f'<button class="readbtn">Read Genesis 1{ic("right", 18)}</button>')
    F("D-03", "Same first words: John 1:1 and Genesis 1:1", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + BACK_U("jhn.1.1") + scrim("s2") +
      sheet("med", "Genesis 1:1", "From John 1:1", echo), "dl")
    F("D-04", "Chapter opening", reader("JHN", 1, 1, 9, scrolled=False, foot=None), "dl")

# ---------- write files + index ----------
W, H, GX, GY = 1430, 1026, 80, 120
names, boards = [], {}
y = 0
notes = {}
GROUPS = (("j01", "Journey 01 · 1 Corinthians 14"), ("jn", "John 1:1"), ("gn", "Genesis 1:1")) + ((("dl", "Delight"),) if STYLE != "v1" else ())
for gi, (grp, label) in enumerate(GROUPS):
    fr = [f for f in FRAMES if f[3] == grp]
    notes[f"t_{grp}" + ("" if STYLE == "v1" else f"_{STYLE}")] = {"x": 0, "y": y, "text": label, "kind": "title1", "maxW": 4 * W + 3 * GX}
    y += 260
    for i, (fid, title, inner, _) in enumerate(fr):
        name = ("Main.dc.html" if fid == "J01-01" else f"{fid}.dc.html") if STYLE == "v1" else f"{fid}-{STYLE}.dc.html"
        open(f"{OUT}/{name}", "w").write(doc(fid, title, inner))
        boards[name] = {"x": (i % 4) * (W + GX), "y": y + (i // 4) * (H + GY), "w": W, "h": H, "title": f"{fid} · {title}"}
        names.append(name)
    y += ((len(fr) + 3) // 4) * (H + GY) + 200

if STYLE != "v1":
    # A restyle lands on its own canvas page; merge this fragment into the live index before publishing.
    for b in boards.values():
        b["page"] = STYLE
    for n in notes.values():
        n["page"] = STYLE
    json.dump({"boards": boards, "order": names, "notes": notes}, open(f"{OUT}/canvas.{STYLE}.json", "w"), ensure_ascii=False, indent=1)
    print(len(names), "boards"); sys.exit()
idx = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
       "title": "Yada Redesign", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": names, "notes": notes, "designSystems": []}
json.dump(idx, open(f"{OUT}/canvas.json", "w"), ensure_ascii=False, indent=1)
print(len(names), "boards")
for n in names:
    print(n, os.path.getsize(f"{OUT}/{n}"))
