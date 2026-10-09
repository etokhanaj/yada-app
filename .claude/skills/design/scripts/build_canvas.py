import json, re, sqlite3, html, os, sys, datetime

Y = os.environ.get("YADA_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))
STYLE = sys.argv[2] if len(sys.argv) > 2 else "v1"  # v1 = brief tokens as written; v2 = the modern restyle
OUT = os.path.join(sys.argv[1] if len(sys.argv) > 1 else "canvas", "project")
os.makedirs(OUT, exist_ok=True)
db = sqlite3.connect(f"{Y}/content/bundles/core.v2.db")
G = {k: json.load(open(f"{Y}/golden/{k}.json")) for k in ["1co.14.34", "jhn.1.1", "gen.1.1", "psa.23.1"]}

BOOK = {"1CO": "1 Corinthians", "1TI": "1 Timothy", "JHN": "John", "GEN": "Genesis", "PSA": "Psalm", "ISA": "Isaiah"}
for _code, _name in db.execute("select code, name from books"):
    BOOK.setdefault(_code, _name)  # "Psalm" stays singular (audit 17)
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
        "note": '<rect x="4" y="4.5" width="16" height="15" rx="4"></rect><path d="M8.5 10h7M8.5 14h4.5"></path>',
        "search": '<circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path>',
        "bookmark": '<path d="M7 4h10v16l-5-3.6L7 20z"></path>',
        "bookmarkf": '<path d="M7 4h10v16l-5-3.6L7 20z" fill="currentColor"></path>',
        "copy": '<rect x="8" y="8" width="11" height="12" rx="2.5"></rect><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H14"></path>',
        "share": '<path d="M12 15V4M8 7.5 12 4l4 3.5M6 11v7.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V11"></path>',
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


ENTRIES = set()
for _b in ("gen", "lev", "psa", "isa", "jhn", "1co", "rev"):
    ENTRIES |= {r[0] for r in sqlite3.connect(f"{Y}/content/bundles/{_b}.v1.db").execute("select verse_id from entries")}


def with_marker(html_, exm):
    if not exm:
        return html_
    head, _, last = html_.rpartition(" ")
    return f'{head} <span class="nowrap">{last}{exm}</span>' if head else f'<span class="nowrap">{last}{exm}</span>'


def scripture(t):
    # LORD in small capitals: the BSB's own convention for the divine name.
    s_ = E(t)
    return s_.replace("LORD", '<span class="sc">Lord</span>') if STYLE != "v1" else s_


def verses_html(rows, sel=(), before=None, ch=None, bm=(), sup=None, book=None):
    out, group = [], []
    def flush():
        if group:
            out.append('<div class="selg">' + "".join(group) + "</div>")
            group.clear()
    for n, t in rows:
        pre = " pre" if before is not None and n < before else ""
        mark_ = f'<span class="bmk" aria-label="bookmarked">{ic("bookmarkf", 13)}</span>' if n in bm else ""
        exm = (f' <span class="exm" role="img" aria-label="Has an explanation">{ic("note", 14)}</span>'
               if STYLE != "v1" and book and f"{book}.{ch}.{n}" in ENTRIES else "")
        if n == 1 and sup and t.startswith(sup):
            # The psalm's title is the bundle's verse 0; BSB prints it inside verse 1.
            out.append(f'<p class="sup">{E(sup.strip())}</p>')
            t = t[len(sup):].lstrip()
        if n == 1 and ch and STYLE != "v1":
            p = f'<p class="v v1{pre}"><span class="cn" aria-label="Chapter {ch}, verse 1">{ch}</span>{with_marker(scripture(t), exm)}</p>'
        else:
            p = f'<p class="v{pre}"><span class="vn">{n}</span>{mark_} {with_marker(scripture(t), exm)}</p>'
        if n in sel:
            group.append(p)
        else:
            flush(); out.append(p)
    flush()
    return "".join(out)


def reader(book, ch, a, b, back=("Home", "Home"), sel=(), offset=0, hint=False, foot=None, scrolled=True, abar=None, entry=True, bm=(), sup=None, collapsed=False, opener=None):
    title = f"{BOOK[book]} {ch} · BSB"
    rows = text("BSB", book, ch, a, b)
    h = header(back, title, scrolled)
    if collapsed and STYLE != "v1":
        # While reading, the controls step back to one quiet line under the island (YouVersion's scroll state);
        # tapping it, or scrolling up, brings them back.
        name, tr = title.rsplit(" · ", 1)
        h = f'<div class="hdr mini"><button class="minit" aria-label="{E(name)}, {tr}. Shows controls">{E(name)} · {tr}</button></div>'
    hint_html = '<p class="hint">Tap a verse to see what it meant.</p>' if hint else ""
    if opener:
        hint_html += f'<p class="opener" role="heading">{E(opener)}</p>'
    foot_html = ""
    if foot:
        prev_ = f'<button class="clink">{ic("back", 18)}{E(foot[0])}</button>' if foot[0] else "<span></span>"
        next_ = f'<button class="clink">{E(foot[1])}{ic("right", 18)}</button>' if foot[1] else ""
        foot_html = f'<div class="cfoot"><div class="clinks">{prev_}{next_}</div><p class="note muted">Berean Standard Bible</p></div>'
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
    return f'{h}<div class="rbody"><div{axsel} style="margin-top: {offset}px">{hint_html}{verses_html(rows, sel, before=first, ch=ch, bm=bm, sup=sup, book=book)}{foot_html}</div></div>{bar}'


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


PASSAGE = {"1co.14.34": ("Order in the assembly", "14:26–40"), "jhn.1.1": ("The Word became flesh", "1:1–18"), "gen.1.1": ("The first day", "1:1–5"), "psa.23.1": ("The LORD is my shepherd", "23:1–6")}
LANGNAME = {"1co.14.34": "Greek", "jhn.1.1": "Greek", "gen.1.1": "Hebrew", "psa.23.1": "Hebrew"}


def interlinear(k, mark=None, reveal=None):
    g = G[k]["gloss"]
    rtl = k.startswith(("gen", "psa"))
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
    F("D-05", "Reading: the header steps back", reader("1CO", 14, 33, 40, offset=-40, collapsed=True), "dl")

# ================= The rest of the app (v2) =================
WM_INNER = '<g aria-label="yada" fill="currentColor" transform="translate(15 96) scale(0.06 -0.06)"><path d="M654 134 509 -136 132 725Q114 767 93.5 784.5Q73 802 38 814Q18 825 9.5 836.5Q1 848 1 865Q1 889 16.5 902.5Q32 916 57 916H473Q499 916 513.5 903.0Q528 890 528 867Q528 848 517.5 836.0Q507 824 485 816L447 807Q415 797 409.5 771.5Q404 746 425 697ZM452 -174 518 -14 564 73 805 691Q824 741 816.5 768.0Q809 795 773 806L734 816Q713 824 703.0 836.0Q693 848 693 867Q693 890 708.0 903.0Q723 916 749 916H1011Q1037 916 1052.0 903.0Q1067 890 1067 867Q1067 851 1059.5 839.0Q1052 827 1031 816Q991 802 968.5 778.5Q946 755 924 699L579 -150Q529 -273 483.5 -345.0Q438 -417 384.5 -448.0Q331 -479 257 -479Q146 -479 82.0 -416.5Q18 -354 18 -262Q18 -202 47.5 -167.0Q77 -132 127 -132Q172 -132 196.5 -158.5Q221 -185 240 -236L254 -275Q263 -309 279.5 -325.5Q296 -342 320 -342Q343 -342 363.5 -326.5Q384 -311 405.5 -274.0Q427 -237 452 -174Z" transform="translate(0 0)"/><path d="M635 126V152L615 159V710Q615 776 581.0 812.0Q547 848 487 848Q431 848 400.5 824.0Q370 800 370 764V700Q370 641 332.5 608.5Q295 576 227 576Q168 576 138.0 604.5Q108 633 108 683Q108 746 157.5 804.0Q207 862 304.5 899.5Q402 937 544 937Q712 937 795.5 864.5Q879 792 879 667V181Q879 158 889.5 144.0Q900 130 920 130Q936 130 945.5 136.5Q955 143 961 152Q966 157 971.0 161.0Q976 165 984 165Q998 165 1006.5 154.0Q1015 143 1015 125Q1015 92 992.0 57.5Q969 23 926.5 0.0Q884 -23 823 -23Q739 -23 687.0 17.5Q635 58 635 126ZM67 206Q67 330 174.5 404.5Q282 479 472 479Q529 479 578.0 470.0Q627 461 662 445L640 371Q607 385 573.0 393.0Q539 401 499 401Q424 401 380.0 362.0Q336 323 336 253Q336 185 374.0 149.5Q412 114 472 114Q524 114 571.0 138.5Q618 163 649 204L671 135Q620 60 532.0 18.5Q444 -23 343 -23Q219 -23 143.0 40.0Q67 103 67 206Z" transform="translate(1059 0)"/><path d="M747 172 738 179V1237Q738 1267 729.5 1279.0Q721 1291 704 1296L657 1299Q639 1306 630.0 1316.5Q621 1327 621 1344Q621 1362 633.0 1375.0Q645 1388 672 1398L852 1461Q886 1474 907.5 1480.0Q929 1486 948 1486Q975 1486 989.0 1469.5Q1003 1453 1003 1427V181Q1003 147 1012.0 132.0Q1021 117 1038 110L1071 100Q1089 91 1098.5 79.0Q1108 67 1108 49Q1108 26 1093.5 13.0Q1079 0 1052 0H860Q811 0 779.0 30.5Q747 61 747 110ZM58 433Q58 590 118.0 702.5Q178 815 280.5 876.0Q383 937 510 937Q623 937 708.5 883.5Q794 830 848 733L785 653Q743 734 685.0 772.5Q627 811 559 811Q495 811 444.0 772.0Q393 733 363.0 655.5Q333 578 333 462Q333 350 362.5 274.5Q392 199 442.5 161.0Q493 123 558 123Q627 123 685.5 163.5Q744 204 789 284L830 224Q756 107 659.5 42.0Q563 -23 446 -23Q333 -23 245.5 34.0Q158 91 108.0 194.0Q58 297 58 433Z" transform="translate(2093 0)"/><path d="M635 126V152L615 159V710Q615 776 581.0 812.0Q547 848 487 848Q431 848 400.5 824.0Q370 800 370 764V700Q370 641 332.5 608.5Q295 576 227 576Q168 576 138.0 604.5Q108 633 108 683Q108 746 157.5 804.0Q207 862 304.5 899.5Q402 937 544 937Q712 937 795.5 864.5Q879 792 879 667V181Q879 158 889.5 144.0Q900 130 920 130Q936 130 945.5 136.5Q955 143 961 152Q966 157 971.0 161.0Q976 165 984 165Q998 165 1006.5 154.0Q1015 143 1015 125Q1015 92 992.0 57.5Q969 23 926.5 0.0Q884 -23 823 -23Q739 -23 687.0 17.5Q635 58 635 126ZM67 206Q67 330 174.5 404.5Q282 479 472 479Q529 479 578.0 470.0Q627 461 662 445L640 371Q607 385 573.0 393.0Q539 401 499 401Q424 401 380.0 362.0Q336 323 336 253Q336 185 374.0 149.5Q412 114 472 114Q524 114 571.0 138.5Q618 163 649 204L671 135Q620 60 532.0 18.5Q444 -23 343 -23Q219 -23 143.0 40.0Q67 103 67 206Z" transform="translate(3241 0)"/></g>'
if STYLE != "v1":
    def glass_btn(icon, label):
        return f'<button class="gbtn" aria-label="{label}">{ic(icon, 20)}</button>'

    def pg_header(back=None, right=""):
        b = (f'<button class="hb-back" aria-label="{E(back[1])}">{ic("back", 22)}<span>{E(back[0])}</span></button>' if back else '<span></span>')
        return (f'<div class="hdr pgh"><div class="hrow d">{b}<span></span><div class="hright">{right}</div></div>'
                f'<div class="a"><div class="hrow">{b}<span class="sp"></span><div class="hright">{right}</div></div></div></div>')

    WORDMARK = ('<h1 class="wmh"><svg class="wordmark" role="img" aria-label="Yada" viewBox="0 0 320 130" xmlns="http://www.w3.org/2000/svg">'
                + WM_INNER + "</svg></h1>")

    def page(back, title, body, right="", sub=None):
        s_ = f'<p class="note muted pgsub">{E(sub)}</p>' if sub else ""
        head = WORDMARK if title == "Yada" else f'<h1 class="ltitle">{lang(title)}</h1>'
        return f'{pg_header(back, right)}<div class="pg">{head}{s_}{body}</div>'

    def lrow(main, sub=None, right=None, cls="", chev=True):
        sb = f'<span class="note muted lsub">{sub}</span>' if sub else ""
        rt = f'<span class="lright">{right}</span>' if right else ""
        cv = f'<span class="chev">{ic("right", 18)}</span>' if chev else ""
        return f'<button class="lrow {cls}"><span class="rm"><span class="lmain">{main}</span>{sb}</span>{rt}{cv}</button>'

    BOOKS = db.execute("select code, name, testament from books order by ord").fetchall()
    HOME_ICONS = glass_btn("search", "Search") + glass_btn("bookmark", "Bookmarks") + glass_btn("more", "More: Recent, Sources")

    # ---- Home ----
    ot = "".join(lrow(E(n), chev=False, cls="book") for c, n, t in BOOKS if t == "OT")
    start = (f'<button class="lead"><span class="rm"><span class="leadt">Start with John</span>'
             f'<span class="note muted">46 passages, in order</span></span><span class="chev">{ic("right", 18)}</span></button>')
    if False: F("H-01", "Home, first launch", page(None, "Yada", start + sec("Old Testament", ot), right=HOME_ICONS), "hs")
    j82 = text("BSB", "JHN", 8, 2)[0][1]
    cont = (f'<button class="lead"><span class="rm"><span class="lbl">Continue</span><span class="leadt">John 8:2</span>'
            f'<span class="excerpt">{E(j82)}</span></span><span class="chev">{ic("right", 18)}</span></button>')
    nt = "".join(lrow(E(n), chev=False, cls="book") for c, n, t in BOOKS if t == "NT")
    if False: F("H-02", "Home, returning", page(None, "Yada", cont + sec("New Testament", nt), right=HOME_ICONS), "hs")

    # ---- Search (a sheet over Home, field focused) ----
    home_under = page(None, "Yada", start + sec("Old Testament", ot), right=HOME_ICONS) + scrim()

    def search_sheet(query, body):
        field = (f'<div class="srch"><label class="sfield">{ic("search", 18)}<input type="search" aria-label="Search the Bible" value="{E(query)}"></label>'
                 f'<button class="scancel">Cancel</button></div>')
        return f'<div class="sheet lg srsheet"><div class="grab"></div>{field}<div class="sbody">{body}</div></div>'

    j316 = text("BSB", "JHN", 3, 16)[0][1]
    F("S-01", "Search: a reference", home_under + search_sheet("jn 3 16",
      sec("Go to", lrow("John 3:16", sub=f'<span class="excerpt">{E(j316)}</span>'), first=True)), "hs")

    LEX = db.execute("select script, lemma, translit, gloss, total from lexemes where gloss like '%love%' or gloss like '%loving%' order by total desc limit 5").fetchall()
    def wrow(script, lemma, tr, gloss, total):
        lg = "he" if script == "hebrew" else "el"
        d = ' dir="rtl"' if lg == "he" else ""
        return lrow(f'<span class="wo" lang="{lg}"{d}>{lemma}</span> <span class="wt">{E(tr)}</span> <span class="wg">“{E(gloss)}”</span>',
                    sub=f'{script.title()} · {total} times')
    love = db.execute("select v.verse_id, t.text from texts_fts f join texts t on t.rowid=f.rowid join verses v on v.ord=t.ord where texts_fts match 'love' and t.translation='BSB' order by t.ord limit 3").fetchall()
    prow = "".join(lrow(f'<span class="excerpt2">{bold(t, "love")}</span>', sub=None, cls="passage") .replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, t in love)
    F("S-02", "Search: love", home_under + search_sheet("love",
      sec("Words", "".join(wrow(*l) for l in LEX) + '<button class="more">Show all 25 words</button>', first=True)
      + sec("Passages · 331", prow)), "hs")

    LG = db.execute("select script, lemma, translit, gloss, total from lexemes where lemma='λόγος'").fetchone()
    LGS = db.execute("select script, lemma, translit, gloss, total from lexemes where lemma in ('λέγω','λογίζομαι') order by total desc").fetchall()
    F("S-03", "Search: λόγος", home_under + search_sheet("λόγος",
      sec("Words", wrow(*LG) + "".join(wrow(*l) for l in LGS), first=True)), "hs")

    BYB = db.execute("select b.name, o.count from occurrences o join books b on b.code=o.book where o.occurrence_key='λογοσ' order by b.ord").fetchall()
    occb = "".join(lrow(E(n), right=f'<span class="cnt2">{c}</span>') for n, c in BYB)
    F("S-04", "λόγος in the Bible", home_under +
      f'<div class="sheet lg srsheet"><div class="grab"></div>'
      f'<div class="shdr"><button class="sh-back" aria-label="Back to search">{ic("back", 22)}</button><div class="stitle"><span class="sttl"><span lang="el" class="gk">λόγος</span> in the Bible</span><span class="ssub">330 times in 318 verses</span></div><button class="sh-x" aria-label="Close">{ic("x", 20)}</button></div>'
      f'<div class="sbody">{occb}</div></div>', "hs")

    # ---- Contents ----
    def seg(on):
        return '<div class="seg" role="radiogroup" aria-label="Translation">' + "".join(
            f'<button role="radio" aria-checked="{"true" if t == on else "false"}" class="{"on" if t == on else ""}">{t}</button>' for t in ("BSB", "WEB", "KJV")) + "</div>"
    ntl = "".join(lrow(E(n), cls="book here" if c == "1CO" else "book", right='<span class="note muted">Reading</span>' if c == "1CO" else None) for c, n, t in BOOKS if t == "NT" and BOOKS.index((c, n, t)) >= 39)
    under14 = reader("1CO", 14, 33, 40, offset=-8) + scrim()
    F("C-01", "Contents: books", under14 + sheet("lg", "Contents", None, seg("BSB") + sec("New Testament", ntl), foot=False), "hs")
    chg = '<div class="chg">' + "".join(f'<button class="{"on" if n == 14 else ""}" aria-label="Chapter {n}{", reading" if n == 14 else ""}">{n}</button>' for n in range(1, 17)) + "</div>"
    F("C-02", "Contents: chapters of 1 Corinthians", under14 + sheet("lg", "1 Corinthians", None, seg("BSB") + chg, back=True, foot=False), "hs")

    # ---- Settings and saved ----
    steps = ('<div class="d stepper"><button class="stp" aria-label="Smaller text">A−</button><span class="stv" aria-live="polite">3 of 6</span><button class="stp" aria-label="Larger text">A+</button></div>'
             '<div class="a"><p class="claim">Using iPhone text size</p><div class="stepper off"><button class="stp" aria-disabled="true">A−</button><span class="stv">3 of 6</span><button class="stp" aria-disabled="true">A+</button></div></div>')
    appear_list = "".join(lrow(n, right=(f'<span class="ck">{ic("check", 20)}</span>' if n == "System" else None), chev=False, cls="opt on" if n == "System" else "opt") for n in ("System", "Light", "Dark"))
    tiles = "".join(
        f'<button class="tile{" on" if n == "System" else ""}" role="radio" aria-checked="{"true" if n == "System" else "false"}">'
        f'<span class="thumb th-{n.lower()}"><span></span><span></span><span></span></span>'
        f'<span class="tlab">{(ic("check", 14) if n == "System" else "")}{n}</span></button>' for n in ("System", "Light", "Dark"))
    appear = f'<div class="d tiles" role="radiogroup" aria-label="Appearance">{tiles}</div><div class="a">{appear_list}</div>'
    F("T-01", "Text size and appearance", reader("JHN", 1, 1, 9, scrolled=False) + scrim() +
      sheet("med", "Text and appearance", None, sec("Text size", steps, first=True) + sec("Appearance", appear), foot=False), "ss")

    menu = ('<div class="menu" role="menu">' + "".join(f'<button role="menuitem"><span>{n}</span>{ic(i, 20)}</button>' for n, i in (("Copy", "copy"), ("Share", "share"), ("Bookmark", "bookmark"))) + "</div>")
    F("M-01", "More actions menu", reader("1CO", 14, 31, 40, sel=(34,), offset=-20, abar="14:34") + '<div class="menuscrim"></div>' + menu, "ss")

    BMS = [("1CO", 14, 34), ("JHN", 1, 1), ("GEN", 1, 1), ("PSA", 23, 4)]
    bmrows = "".join(lrow(f'<span class="excerpt2">{scripture(text("BSB", b, c, v)[0][1])}</span>', cls="passage", chev=False).replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(BOOK.get(b, b))} {c}:{v}</span>', 1) for b, c, v in BMS)
    EDIT = '<button class="tbtn">Edit</button>'
    F("B-01", "Bookmarks", page(("Home", "Home"), "Bookmarks", bmrows, right=EDIT), "ss")
    F("B-02", "Bookmarks, empty", page(("Home", "Home"), "Bookmarks", '<p class="empty">No bookmarks yet.</p><p class="note muted">Tap a verse, then ⋯ › Bookmark.</p>'), "ss")
    F("B-03", "Reader with a bookmarked verse", reader("JHN", 1, 1, 9, scrolled=False, bm=(4,)), "ss")
    REC = [("1 Corinthians 14:34", '<span lang="el" class="gk">σιγάτωσαν</span>', "1CO", 14, 34), ("John 1:1", "Understand", "JHN", 1, 1), ("Genesis 1:1", '<bdi lang="he" dir="rtl" class="hb">בְּרֵאשִׁ֖ית</bdi>', "GEN", 1, 1)]
    recrows = "".join(lrow(f'<span class="excerpt2">{scripture(text("BSB", b, c, v)[0][1])}</span>', cls="passage", chev=False)
                      .replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(r)} · <span class="tag">{tag}</span></span>', 1) for r, tag, b, c, v in REC)
    F("R-01", "Recent", page(("Home", "Home"), "Recent", recrows), "ss")

    # ---- Edge states ----
    F("P-01", "Psalm 23: superscription, LORD in small capitals", reader("PSA", 23, 1, 6, scrolled=False, sup="A Psalm of David. "), "es")
    F("P-02", "Psalm 23:1, Original Hebrew", reader("PSA", 23, 1, 3, sel=(1,), scrolled=False, sup="A Psalm of David. ") + scrim() + understand("psa.23.1", "lg", start="orig", orig=True), "es")
    nogreek = (f'<section class="sec first"><button class="disc" aria-expanded="true"><span>Original Greek</span>{ic("up", 18)}</button>'
               f'<p class="claim nog">John 7:53–8:11 is not in the earliest manuscripts, so Yada’s Greek text has none of it.</p></section>'
               f'<section class="sec">{row("Compare translations", cls="plain")}</section>')
    F("N-01", "John 8:3, no Greek", reader("JHN", 8, 1, 6, sel=(3,), offset=-140) + scrim() + sheet("med", "John 8:3", body=nogreek), "es")
    PER = db.execute("select 1").fetchall()
    jdb = sqlite3.connect(f"{Y}/content/bundles/jhn.v1.db")
    pers = jdb.execute("select pericope_id, label from pericopes order by start_ord limit 9").fetchall()
    def prange(pid):
        a_, b_ = pid.split("-")
        _, c1, v1 = a_.split("."); c2, v2 = b_.split(".")
        return f"{c1}:{v1}–{v2}" if c1 == c2 else f"{c1}:{v1}–{c2}:{v2}"
    strows = ""
    for i, (pid, lab) in enumerate(pers):
        if i < 2:
            strows += lrow(E(lab), sub=prange(pid), right=f'<span class="ck" aria-label="read">{ic("check", 20)}</span>', chev=False, cls="done")
        elif i == 2:
            strows += lrow(E(lab), sub=prange(pid), right='<span class="nextw">Next</span>', cls="nextrow")
        else:
            strows += lrow(E(lab), sub=prange(pid), chev=False)
    if False: F("ST-01", "Start here: John, passage by passage", page(("Home", "Home"), "The Gospel of John", strows, sub="46 passages"), "es")

    # ---- Sources ----
    # Readers care what is explained and where it comes from, not file sizes: everything ships in the app.
    OFFLINE = "All of it is on your iPhone. Nothing needs a connection."
    exv = db.execute("select v.verse_id, v.book, v.chapter, v.verse, t.text from verses v join texts t on t.ord=v.ord and t.translation='BSB' "
                     f"where v.verse_id in ({','.join('?' * len(ENTRIES))}) order by v.ord", sorted(ENTRIES)).fetchall()
    exrows = "".join(lrow(f'{E(BOOK[b])} {c}:{v}', sub=f'<span class="excerpt">{scripture(t.removeprefix("A Psalm of David. "))}</span>') for _, b, c, v, t in exv)
    F("SO-01", "Sources: what is explained", page(("Home", "Home"), "Sources",
      sec(f"Explained so far · {len(exv)} verses", exrows, first=True), sub=OFFLINE), "so")
    LIC = {"CC-BY-SA-3.0": "CC BY-SA 3.0", "CC-BY-4.0": "CC BY 4.0", "PUBLIC_DOMAIN": "Public domain", "CUSTOM_EULA": "Own licence", "OFL-1.1": "SIL OFL 1.1"}
    # Plain-English role first; the dataset's own name second, where licences require it.
    ROLE = {"Berean Standard Bible (text)": ("Bible text", "Berean Standard Bible", "English · BSB"),
            "World English Bible, Protestant canon (engwebp)": ("Bible text", "World English Bible", "English · WEB"),
            "King James Version, 1769 standardised text (eng-kjv2006)": ("Bible text", "King James Version", "English · KJV"),
            "SBLGNT (Greek text)": ("Bible text", "Greek New Testament", "SBLGNT"),
            "morphhb — Westminster Leningrad Codex text": ("Bible text", "Hebrew Bible", "Westminster Leningrad Codex"),
            "morphgnt/sblgnt (morphological annotations)": ("Word data", "Greek parsing", "MorphGNT"),
            "morphhb — lemma and morphology data": ("Word data", "Hebrew parsing", "OSHB"),
            "TAGNT — Translators Amalgamated Greek NT (per-word English glosses)": ("Word data", "Greek word glosses", "STEPBible TAGNT"),
            "TAHOT — Translators Amalgamated Hebrew OT (per-morpheme English glosses)": ("Word data", "Hebrew word glosses", "STEPBible TAHOT"),
            "TBESG — brief Greek lexicon of Extended Strongs": ("Word data", "Greek dictionary forms", "STEPBible TBESG"),
            "TBESH — brief Hebrew lexicon of Extended Strongs": ("Word data", "Hebrew dictionary forms", "STEPBible TBESH"),
            "TVTMS — versification traditions": ("Word data", "Verse numbering", "STEPBible TVTMS")}
    groups = {"Bible text": "", "Word data": ""}
    for ds, li, enc in db.execute("select dataset, license, coalesce(encumbered, '') from sources").fetchall():
        if ds not in ROLE:
            continue  # fonts and the WEB excerpt file sit in the app's About, not here
        g, role, name = ROLE[ds]
        # `encumbered` holds the team's open legal questions (PRD 0E), not licence wording for readers.
        sub_ = f'{E(name)} · {LIC.get(li, li)}'
        groups[g] += lrow(E(role), sub=sub_, cls="src").replace('<button class="lrow src">', f'<button class="lrow src" aria-label="{E(role)}, {E(name)}, opens the source">', 1)
    scrolled_hdr = pg_header(("Home", "Home")).replace('<span></span><div class="hright">', '<span class="inl">Sources</span><div class="hright">', 1)
    F("SO-02", "Sources, scrolled: texts and data", scrolled_hdr + '<div class="pg pgs">' +
      sec("Bible text", groups["Bible text"], first=True) + sec("Word data", groups["Word data"]) + "</div>", "so")

# ================= Edge cases (v2) =================
if STYLE != "v1":
    F("E-01", "Long book name with a long return chip", reader("1TH", 5, 1, 8, back=("2 Thess 3:10", "Back to 2 Thessalonians 3:10"), scrolled=False), "es")
    F("E-02", "Longest verse selected: Esther 8:9", reader("EST", 8, 8, 10, sel=(9,), abar="8:9", offset=-60, entry=False), "es")
    F("E-03", "The last chapter of the Bible", reader("REV", 22, 17, 21, offset=0, foot=("Revelation 21", None)), "es")
    F("E-04", "Search: no results", home_under + search_sheet("Melchizedekk",
      '<p class="empty">No results for “Melchizedekk”.</p><p class="note muted">Search takes references, English words, and Greek or Hebrew.</p>'), "es")
    F("E-05", "Recent, empty", page(("Home", "Home"), "Recent", '<p class="empty">Nothing yet.</p><p class="note muted">Verses you explore appear here.</p>'), "es")
    ic_frame = reader("1CO", 14, 33, 36, sel=(34,), offset=-70) + scrim() + understand("1co.14.34", "med")
    F("E-06", "Increase Contrast", [("Light · Increase Contrast", "light ic", ic_frame), ("Dark · Increase Contrast", "dark ic", ic_frame), ("AX5 · Increase Contrast", "ax5 ic", ic_frame)], "es")

# ================= Depth (v2): the text as the image =================
if STYLE != "v1":
    def cover(word, lng, translit, gloss, foot):
        d = ' dir="rtl"' if lng == "he" else ""
        return (f'<span class="cw" lang="{lng}"{d}>{word}</span>'
                f'<span class="ct">{E(translit)} · “{E(gloss)}”</span><span class="cf">{foot}</span>')

    kwj = G["jhn.1.1"]["key_words"][0]
    start_cover = (f'<button class="lead coverlead" aria-label="Start with John. {kwj["surface"]}, logos, word. 46 passages, in order">'
                   f'<span class="rm cover"><span class="lbl">Start with John</span>{cover(kwj["surface"], "el", "logos", kwj["gloss"], "The Word became flesh · 1:1–18")}</span>'
                   f'<span class="chev">{ic("right", 18)}</span></button>')
    F("DP-01", "Home, first launch: typographic cover", page(None, "Yada", start_cover + sec("Old Testament", ot), right=HOME_ICONS), "dp")
    # John 8:2 sits in a passage with no entry: the passage title carries the cover instead of a word
    cont_cover = (f'<button class="lead coverlead"><span class="rm cover"><span class="lbl">Continue · John 8:2</span>'
                  f'<span class="cw lit">The woman caught in adultery</span>'
                  f'<span class="excerpt">{E(j82)}</span></span><span class="chev">{ic("right", 18)}</span></button>')
    F("DP-02", "Home, returning: passage with no entry", page(None, "Yada", cont_cover + sec("New Testament", nt), right=HOME_ICONS), "dp")
    numrows = ""
    for i, (pid, lab) in enumerate(pers):
        state = ' done' if i < 2 else (' nextrow' if i == 2 else '')
        right = (f'<span class="ck" aria-label="read">{ic("check", 20)}</span>' if i < 2 else ('<span class="nextw">Next</span>' if i == 2 else None))
        numrows += lrow(f'<span class="num">{i + 1}</span><span class="nt">{E(lab)}</span>', sub=prange(pid), right=right, chev=(i == 2), cls="numrow" + state)
    st_cover = (f'<div class="cover stcover"><h1 class="ltitle">The Gospel of John</h1>'
                f'<span class="cw" lang="el">{kwj["surface"]}</span><span class="ct">logos · “{E(kwj["gloss"])}” · 46 passages, in order</span></div>')
    F("DP-03", "Start here: cover and numbered passages", pg_header(("Home", "Home")) + f'<div class="pg">{st_cover}{numrows}</div>', "dp")
    F("DP-04", "Chapter opening: John 1", reader("JHN", 1, 1, 7, scrolled=False, opener="The Word became flesh"), "dp")
    F("DP-05", "Chapter opening: Genesis 1", reader("GEN", 1, 1, 6, scrolled=False, opener="The first day"), "dp")
    kwg = G["gen.1.1"]["key_words"][0]
    wc = word_card(kwg["surface"], "he", "bərēʾšîṯ", "in beginning", "Preposition with noun, feminine singular absolute",
                   "רֵאשִׁית", "rēʾšîṯ", "H7225", "beginning of", kwg["note"], "3 times in Genesis", "51 in the Bible", "Gloss: TAHOT · Parsing: OSHB",
                   morphemes=G["gen.1.1"]["gloss"][0]["morphemes"])
    F("DP-06", "Word card: Hebrew headword at cover scale", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + BACK_U("gen.1.1", start="orig", orig=True, mark=0) + scrim("s2") +
      sheet("lg2", "Word", "Genesis 1:1", wc), "dp")

# ================= Splash (v2) =================
if STYLE != "v1":
    SYM_D = 'M 34 42 C 62 40 80 44 94 64 C 104 79 115 101 131 133 L 144 161 C 146 139 146 119 151 101 C 158 77 181 53 221 40 L 221 94 C 191 94 174 103 164 119 C 157 131 154 152 150 172 C 145 198 128 221 99 227 C 75 232 49 226 42 208 C 34 190 43 171 61 169 C 80 167 94 179 91 196 C 90 204 86 210 81 214 C 97 214 108 205 112 191 C 115 180 112 169 105 155 L 60 76 C 50 57 43 47 34 42 Z'
    SYM_T = 'translate(0 0) scale(1.0)'
    LOCK = '<path d="M 34 42 C 62 40 80 44 94 64 C 104 79 115 101 131 133 L 144 161 C 146 139 146 119 151 101 C 158 77 181 53 221 40 L 221 94 C 191 94 174 103 164 119 C 157 131 154 152 150 172 C 145 198 128 221 99 227 C 75 232 49 226 42 208 C 34 190 43 171 61 169 C 80 167 94 179 91 196 C 90 204 86 210 81 214 C 97 214 108 205 112 191 C 115 180 112 169 105 155 L 60 76 C 50 57 43 47 34 42 Z" transform="translate(12 8) scale(0.4375)" fill="currentColor"/><g aria-label="yada" fill="currentColor" transform="translate(142.2 99.0) scale(0.05949999999999999 -0.05949999999999999)"><path d="M654 134 509 -136 132 725Q114 767 93.5 784.5Q73 802 38 814Q18 825 9.5 836.5Q1 848 1 865Q1 889 16.5 902.5Q32 916 57 916H473Q499 916 513.5 903.0Q528 890 528 867Q528 848 517.5 836.0Q507 824 485 816L447 807Q415 797 409.5 771.5Q404 746 425 697ZM452 -174 518 -14 564 73 805 691Q824 741 816.5 768.0Q809 795 773 806L734 816Q713 824 703.0 836.0Q693 848 693 867Q693 890 708.0 903.0Q723 916 749 916H1011Q1037 916 1052.0 903.0Q1067 890 1067 867Q1067 851 1059.5 839.0Q1052 827 1031 816Q991 802 968.5 778.5Q946 755 924 699L579 -150Q529 -273 483.5 -345.0Q438 -417 384.5 -448.0Q331 -479 257 -479Q146 -479 82.0 -416.5Q18 -354 18 -262Q18 -202 47.5 -167.0Q77 -132 127 -132Q172 -132 196.5 -158.5Q221 -185 240 -236L254 -275Q263 -309 279.5 -325.5Q296 -342 320 -342Q343 -342 363.5 -326.5Q384 -311 405.5 -274.0Q427 -237 452 -174Z" transform="translate(0 0)"/><path d="M635 126V152L615 159V710Q615 776 581.0 812.0Q547 848 487 848Q431 848 400.5 824.0Q370 800 370 764V700Q370 641 332.5 608.5Q295 576 227 576Q168 576 138.0 604.5Q108 633 108 683Q108 746 157.5 804.0Q207 862 304.5 899.5Q402 937 544 937Q712 937 795.5 864.5Q879 792 879 667V181Q879 158 889.5 144.0Q900 130 920 130Q936 130 945.5 136.5Q955 143 961 152Q966 157 971.0 161.0Q976 165 984 165Q998 165 1006.5 154.0Q1015 143 1015 125Q1015 92 992.0 57.5Q969 23 926.5 0.0Q884 -23 823 -23Q739 -23 687.0 17.5Q635 58 635 126ZM67 206Q67 330 174.5 404.5Q282 479 472 479Q529 479 578.0 470.0Q627 461 662 445L640 371Q607 385 573.0 393.0Q539 401 499 401Q424 401 380.0 362.0Q336 323 336 253Q336 185 374.0 149.5Q412 114 472 114Q524 114 571.0 138.5Q618 163 649 204L671 135Q620 60 532.0 18.5Q444 -23 343 -23Q219 -23 143.0 40.0Q67 103 67 206Z" transform="translate(1059 0)"/><path d="M747 172 738 179V1237Q738 1267 729.5 1279.0Q721 1291 704 1296L657 1299Q639 1306 630.0 1316.5Q621 1327 621 1344Q621 1362 633.0 1375.0Q645 1388 672 1398L852 1461Q886 1474 907.5 1480.0Q929 1486 948 1486Q975 1486 989.0 1469.5Q1003 1453 1003 1427V181Q1003 147 1012.0 132.0Q1021 117 1038 110L1071 100Q1089 91 1098.5 79.0Q1108 67 1108 49Q1108 26 1093.5 13.0Q1079 0 1052 0H860Q811 0 779.0 30.5Q747 61 747 110ZM58 433Q58 590 118.0 702.5Q178 815 280.5 876.0Q383 937 510 937Q623 937 708.5 883.5Q794 830 848 733L785 653Q743 734 685.0 772.5Q627 811 559 811Q495 811 444.0 772.0Q393 733 363.0 655.5Q333 578 333 462Q333 350 362.5 274.5Q392 199 442.5 161.0Q493 123 558 123Q627 123 685.5 163.5Q744 204 789 284L830 224Q756 107 659.5 42.0Q563 -23 446 -23Q333 -23 245.5 34.0Q158 91 108.0 194.0Q58 297 58 433Z" transform="translate(2093 0)"/><path d="M635 126V152L615 159V710Q615 776 581.0 812.0Q547 848 487 848Q431 848 400.5 824.0Q370 800 370 764V700Q370 641 332.5 608.5Q295 576 227 576Q168 576 138.0 604.5Q108 633 108 683Q108 746 157.5 804.0Q207 862 304.5 899.5Q402 937 544 937Q712 937 795.5 864.5Q879 792 879 667V181Q879 158 889.5 144.0Q900 130 920 130Q936 130 945.5 136.5Q955 143 961 152Q966 157 971.0 161.0Q976 165 984 165Q998 165 1006.5 154.0Q1015 143 1015 125Q1015 92 992.0 57.5Q969 23 926.5 0.0Q884 -23 823 -23Q739 -23 687.0 17.5Q635 58 635 126ZM67 206Q67 330 174.5 404.5Q282 479 472 479Q529 479 578.0 470.0Q627 461 662 445L640 371Q607 385 573.0 393.0Q539 401 499 401Q424 401 380.0 362.0Q336 323 336 253Q336 185 374.0 149.5Q412 114 472 114Q524 114 571.0 138.5Q618 163 649 204L671 135Q620 60 532.0 18.5Q444 -23 343 -23Q219 -23 143.0 40.0Q67 103 67 206Z" transform="translate(3241 0)"/></g>'
    def splash(cls, inner):
        return f'<div class="splash {cls}" role="img" aria-label="Yada">{inner}</div>'
    symbol = f'<svg class="splsym" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><path d="{SYM_D}" transform="{SYM_T}" fill="currentColor"></path></svg>'
    lockup = f'<svg class="spllock" viewBox="0 0 450 140" xmlns="http://www.w3.org/2000/svg">{LOCK}</svg>'
    F("SP-01", "Splash: chartreuse symbol on the dark ground (chosen)", [
        ("Light mode", "light", splash("on-dark", symbol)), ("Dark mode", "dark", splash("on-dark", symbol)), ("AX5 · unchanged", "ax5", splash("on-dark", symbol))], "sp")
    F("SP-02", "Splash: lockup on forest (Fable pattern)", [
        ("Light", "light", splash("on-forest", lockup)), ("Dark", "dark", splash("on-forest", lockup)), ("AX5 · unchanged", "ax5", splash("on-forest", lockup))], "sp")
    jn_rm = reader("JHN", 1, 1, 9, hint=True, scrolled=False) + f'<div class="splash on-dark" style="opacity: .5">{symbol}</div>'
    F("SP-03", "Splash with Reduce Motion", [
        ("1 · Launch", "light", splash("on-dark", symbol)), ("2 · Reduce Motion: cross-fade, 150 ms", "light", jn_rm),
        ("3 · Reader at John 1", "light", reader("JHN", 1, 1, 9, hint=True, scrolled=False))], "sp")

    LEAF_CLIP = "M 144 161 L 164 119 L 260 119 L 260 -10 L 150 -10 Z"
    STEM_CLIP = "M -10 -10 L 150 -10 L 144 161 L 164 119 L 260 119 L 260 270 L -10 270 Z"
    def split_symbol(tilt, scale=1, op=1):
        return (f'<svg class="splsym" style="transform: scale({scale}); opacity: {op}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">'
                f'<defs><clipPath id="lf"><path d="{LEAF_CLIP}"></path></clipPath><clipPath id="sm"><path d="{STEM_CLIP}"></path></clipPath></defs>'
                f'<path d="{SYM_D}" transform="{SYM_T}" fill="currentColor" clip-path="url(#sm)"></path>'
                f'<g transform="rotate({tilt} 144 161)"><path d="{SYM_D}" transform="{SYM_T}" fill="currentColor" clip-path="url(#lf)"></path></g></svg>')
    def anim(reader_html, ground_op, tilt, scale, sym_op):
        return reader_html + f'<div class="splash on-dark" style="opacity: {ground_op}">{split_symbol(tilt, scale, sym_op)}</div>'
    jn = reader("JHN", 1, 1, 9, hint=True, scrolled=False)
    F("SP-04", "Splash motion, light mode: the page lifts", [
        ("1 · 160 ms · leaf lifts 8°", "light", anim(jn, 1, -8, 1, 1)),
        ("2 · 340 ms · ground dissolves", "light", anim(jn, .5, -8, .95, .5)),
        ("3 · 520 ms · John 1", "light", jn)], "sp")
    F("SP-05", "Splash motion, dark mode", [
        ("1 · 160 ms · leaf lifts 8°", "dark", anim(jn, 1, -8, 1, 1)),
        ("2 · 340 ms · symbol settles", "dark", anim(jn, .5, -8, .95, .5)),
        ("3 · 520 ms · John 1", "dark", jn)], "sp")

# ---------- write files + index ----------
W, H, GX, GY = 1430, 1026, 80, 120
names, boards = [], {}
y = 0
notes = {}
GROUPS = (("j01", "Journey 01 · 1 Corinthians 14"), ("jn", "John 1:1"), ("gn", "Genesis 1:1")) + ((("dl", "Delight"), ("hs", "Home, Search, Contents"), ("ss", "Settings and saved"), ("es", "Edge states"), ("so", "Sources"), ("dp", "Depth"), ("sp", "Splash")) if STYLE != "v1" else ())
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
