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
        "download": '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"></path>',
        "cloud": '<path d="M7.5 18.5h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 11.1 3.7 3.7 0 0 0 7.5 18.5z"></path>',
        "search": '<circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path>',
        "bookmark": '<path d="M7 4h10v16l-5-3.6L7 20z"></path>',
        "bookmarkf": '<path d="M7 4h10v16l-5-3.6L7 20z" fill="currentColor"></path>',
        "copy": '<rect x="8" y="8" width="11" height="12" rx="2.5"></rect><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H14"></path>',
        "share": '<path d="M12 15V4M8 7.5 12 4l4 3.5M6 11v7.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V11"></path>',
        "alpha": '<text x="12" y="17.5" text-anchor="middle" font-size="19" font-family="Gentium Plus, serif" fill="currentColor" stroke="none">α</text>',
        "cols": '<rect x="3.5" y="5" width="17" height="14" rx="3"></rect><path d="M12 5v14"></path>',
        "play": '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"></path>',
        "pause": '<path d="M8 5v14M16 5v14" stroke-width="3.2"></path>',
        "prevv": '<path d="M6 5v14"></path><path d="M18.5 5.5v13L9 12z" fill="currentColor"></path>',
        "nextv": '<path d="M18 5v14"></path><path d="M5.5 5.5v13L15 12z" fill="currentColor"></path>',
        "stop": '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"></rect>',
        "speaker": '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"></path><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"></path>',
        "listen": '<path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><rect x="3.5" y="13.5" width="4.5" height="6.5" rx="2"></rect><rect x="16" y="13.5" width="4.5" height="6.5" rx="2"></rect>',
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


def reader(book, ch, a, b, back=("Home", "Home"), sel=(), offset=0, hint=False, foot=None, scrolled=True, abar=None, entry=True, bm=(), sup=None, collapsed=False, opener=None, tr="BSB", rows_override=None):
    title = f"{BOOK[book]} {ch} · {tr}"
    rows = rows_override if rows_override is not None else text(tr, book, ch, a, b)
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


def row(main, label=None, extra=None, chev=True, cls="", aria=None):
    l = f'<span class="lbl rl">{E(label)}</span>' if label else ""
    x = f'<span class="rx">{extra}</span>' if extra else ""
    c = f'<span class="chev">{ic("right", 18)}</span>' if chev else ""
    al = f' aria-label="{E(aria)}"' if aria else ""
    return f'<button class="row {cls}"{al}><span class="rm"><span class="claim">{main}</span>{l}{x}</span>{c}</button>'


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
        drows = "".join(row(lang(c["claim"]), extra=f'<span class="rd-n">Compare the {len(c["positions"])} readings</span>', aria=f'{c["claim"]} Compare the {len(c["positions"])} readings') for c in deb)
        parts.append(sec("Where interpretation differs", drows))
    if start in ("top", "see", "orig"):
        parts.append(original_section(k, orig, mark, reveal))
        parts.append(f'<section class="sec">{row("Compare translations", cls="plain")}</section>')
        t, r = PASSAGE[k]
        parts.append(sec("Passage", row(f"{E(t)} · {r}", cls="plain")))
        gd = "".join(row(f'{E(fref(p["ref"]))} — {REL[p["relationship"]]}', extra=f'<span class="note muted">{lang(p["note"])}</span>') for p in e["related_passages"])
        parts.append(sec("Go deeper", gd))
    return "".join(parts)


def is_grammar(c):
    """A claim that states a parse or an apparatus fact: its evidence carries a morphology code or apparatus note.
    These move under Original (as "In the Greek / Hebrew") in the simplified Understand; nothing is reworded."""
    if c["category"] != "text":
        return False
    return any(ev.get("type") == "apparatus" or (ev.get("type") == "lexical" and ev.get("note")) for ev in c["evidence"])


def understand_simple_body(k, start="top", clamp=False, orig=False, labels=True):
    e = G[k]
    plain_all = sorted([c for c in e["claims"] if c["category"] != "debated"], key=lambda c: c["display_rank"])
    reader_claims = [c for c in plain_all if not is_grammar(c)]
    grammar = [c for c in plain_all if is_grammar(c)]
    deb = sorted([c for c in e["claims"] if c["category"] == "debated"], key=lambda c: c["display_rank"])
    lname = LANGNAME[k]
    parts = []
    if start == "top":
        body = f'<p class="expl clamp">{lang(e["whats_happening"])}</p><button class="more d">More</button>' if clamp else f'<p class="expl">{lang(e["whats_happening"])}</p>'
        parts.append(sec("What’s happening", body, first=True))
    if start in ("top",):
        shown = reader_claims[:3]
        more = f'<button class="more">Show all {len(reader_claims)}</button>' if len(reader_claims) > 3 else ""
        # Inside the passage guide the labels go ("Background" meant nothing to a reader, John 11 Oct 2026).
        parts.append(sec("What we can see", "".join(row(lang(c["claim"]), claim_label(c) if labels else None) for c in shown) + more))
        drows = "".join(row(lang(c["claim"]), extra=f'<span class="rd-n">Compare the {len(c["positions"])} readings</span>', aria=f'{c["claim"]} Compare the {len(c["positions"])} readings') for c in deb)
        parts.append(sec("Where readers differ", drows))
    t, r = PASSAGE[k]
    n_rel = len(e["related_passages"])
    disc = f'<button class="disc gfdisc" aria-expanded="{"true" if orig else "false"}"><span>Original {lname}</span><span class="gfcount">{len(grammar)} notes</span>{ic("up" if orig else "down", 18)}</button>'
    inner_orig = ""
    if orig:
        g_rows = "".join(row(lang(c["claim"]), claim_label(c)) for c in grammar)
        src = "STEPBible (TAHOT)" if lname == "Hebrew" else "STEPBible (TAGNT, TBESG)"
        inner_orig = (f'<div class="orig">{interlinear(k)}<p class="note muted src">Glosses: {src}</p>'
                      f'<h3 class="lbl">In the {lname}</h3>{g_rows}</div>')
    further = (disc + inner_orig + row("Compare translations", cls="plain") + row(f"{E(t)} · {r}", cls="plain")
               + row(f"Related passages", extra=f'<span class="note muted">{n_rel} passages</span>', cls="plain"))
    parts.append(sec("Go further", further, first=(start != "top")))
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
    if isinstance(inner, dict):
        # A diagram board (IA-01/02): not a screen, so no phone frame and no AX5 column.
        steps, cols = [], inner["wide"]
    else:
        steps = inner if isinstance(inner, list) else [(lab, cls, inner) for lab, cls in (("Light", "light"), ("Dark", "dark"), ("AX5", "ax5"))]
        cols = ""
    cols += "".join(
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
    ntl = "".join(lrow(E(n), chev=c != "1CO", cls="book cur" if c == "1CO" else "book", right=f'<span class="ck">{ic("check", 22)}</span>' if c == "1CO" else None) for c, n, t in BOOKS if t == "NT" and BOOKS.index((c, n, t)) >= 39)
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

    # Variant: English leads, the Greek word follows as the hint of what is underneath
    start_cover_en = (f'<button class="lead coverlead" aria-label="Start with John. The Word became flesh, John 1:1 to 18. {kwj["surface"]}, logos, word.">'
                      f'<span class="rm cover"><span class="lbl">Start with John</span>'
                      f'<span class="cw lit">The Word became flesh</span>'
                      f'<span class="cwsm"><span lang="el" class="gk">{kwj["surface"]}</span> <span class="muted">logos · “{E(kwj["gloss"])}” · 1:1–18</span></span></span>'
                      f'<span class="chev">{ic("right", 18)}</span></button>')
    F("DP-01", "Home, first launch: English leads, Greek beneath", page(None, "Yada", start_cover_en + sec("Old Testament", ot), right=HOME_ICONS), "dp")
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
                f'<span class="cwsm"><span lang="el" class="gk">{kwj["surface"]}</span> <span class="muted">logos · “{E(kwj["gloss"])}” · 46 passages, in order</span></span></div>')
    F("DP-03", "Start here: cover and numbered passages", pg_header(("Home", "Home")) + f'<div class="pg">{st_cover}{numrows}</div>', "dp")
    F("DP-04", "Chapter opening: John 1", reader("JHN", 1, 1, 7, scrolled=False, opener="The Word became flesh"), "dp")
    F("DP-05", "Chapter opening: Genesis 1", reader("GEN", 1, 1, 6, scrolled=False, opener="The first day"), "dp")
    kwg = G["gen.1.1"]["key_words"][0]
    wc = word_card(kwg["surface"], "he", "bərēʾšîṯ", "in beginning", "Preposition with noun, feminine singular absolute",
                   "רֵאשִׁית", "rēʾšîṯ", "H7225", "beginning of", kwg["note"], "3 times in Genesis", "51 in the Bible", "Gloss: TAHOT · Parsing: OSHB",
                   morphemes=G["gen.1.1"]["gloss"][0]["morphemes"])
    F("DP-06", "Word card: Hebrew headword at cover scale", reader("GEN", 1, 1, 4, sel=(1,), scrolled=False) + scrim() + BACK_U("gen.1.1", start="orig", orig=True, mark=0) + scrim("s2") +
      sheet("lg2", "Word", "Genesis 1:1", wc), "dp")

# ================= Simpler Understand (variant) =================
if STYLE != "v1":
    def understand_simple(k, pos, **kw):
        bb, cc, vv = G[k]["verse_id"].split(".")
        return sheet(pos, f"{BOOK[bb]} {cc}:{vv}", body=understand_simple_body(k, **kw), unrev=True, scrolled=kw.get("start", "top") != "top")
    F("U-01", "Simpler Understand, medium: plain claims first", reader("1CO", 14, 33, 36, sel=(34,), offset=-70) + scrim() + understand_simple("1co.14.34", "med", clamp=True), "uv")
    F("U-02", "Simpler Understand, large: three parts and Go further", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + understand_simple("1co.14.34", "lg"), "uv")
    F("U-03", "Grammar moves under Original Greek", reader("1CO", 14, 33, 36, sel=(34,)) + scrim() + understand_simple("1co.14.34", "lg", start="further", orig=True), "uv")
    F("U-04", "Same pattern, John 1:1", reader("JHN", 1, 1, 6, sel=(1,), scrolled=False) + scrim() + understand_simple("jhn.1.1", "lg"), "uv")

# ================= More translations (v2) =================
if STYLE != "v1":
    TRD = "/private/tmp/claude-501/-Users-johnetokhana-Claude/b0718a7c-7cc7-4fe2-86c6-f104d0d3c1e7/scratchpad/tr"
    def vpl(fileid, book, ch, a, b):
        out = []
        for line in open(f"{TRD}/{fileid}.txt", encoding="utf8"):
            m = re.match(r"^(\S+) (\d+):(\d+) (.*)$", line.strip())
            if m and m.group(1) == book and int(m.group(2)) == ch and a <= int(m.group(3)) <= b:
                out.append((int(m.group(3)), m.group(4)))
        return out
    # Translation covers: a small book in one of five brand tones. Tone is identity, never state
    # (current = tick + semibold); fixed per translation so a reader learns them.
    COVER = {"BSB": "forest", "WEB": "paper", "KJV": "ink", "LSV": "lime", "ASV": "sage", "YLT": "paper",
             "DBY": "forest", "GNV": "ink", "MSB": "lime", "NIV": "sage", "NKJV": "forest", "NLT": "paper"}
    def tile(ab):
        return f'<span class="cov cov-{COVER.get(ab, "paper")}" aria-hidden="true"><span class="covab">{ab}</span><span class="covrule"></span></span>'
    def trrow(ab, name, meta, right, cls="", label=None):
        lab = label or f"{name}, {meta}"
        sub_html = f'<span class="note muted lsub">{meta}</span>' if meta else ""
        return (f'<div class="trrow {cls}" role="button" aria-label="{E(lab)}">{tile(ab)}'
                f'<span class="rm"><span class="lmain">{E(name)}</span>{sub_html}</span>'
                f'<span class="trright">{right}</span></div>')
    DL = f'<button class="trbtn" aria-label="Download">{ic("download", 22)}</button>'
    MORE = f'<button class="trbtn" aria-label="More">{ic("more", 22)}</button>'
    CHECK = f'<span class="ck">{ic("check", 22)}</span>'
    CLOUD = f'<span class="muted">{ic("cloud", 22)}</span>'
    def ring(p):
        return (f'<span class="ring" role="progressbar" aria-valuenow="{p}" aria-label="Downloading, {p} percent">'
                f'<svg viewBox="0 0 36 36" width="30" height="30"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--div)" stroke-width="3"></circle>'
                f'<circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="{p * 0.942:.1f} 100" transform="rotate(-90 18 18)"></circle>'
                f'<rect x="13" y="13" width="10" height="10" rx="2" fill="var(--accent)"></rect></svg></span>')
    on_phone = (trrow("BSB", "Berean Standard Bible", "", CHECK, cls="current", label="Berean Standard Bible, selected")
              + trrow("WEB", "World English Bible", "", "")
              + trrow("KJV", "King James Version", "", "")
              + trrow("LSV", "Literal Standard Version", "", ""))
    def downloadable(state=None):
        rows_ = [("ASV", "American Standard Version", "1901 · 1.3 MB"), ("YLT", "Young’s Literal Translation", "1898 · 1.3 MB"),
                 ("DBY", "Darby Translation", "1890 · 1.3 MB"), ("GNV", "Geneva Bible", "1599 · 1.3 MB"), ("MSB", "Majority Standard Bible", "2024 · 1.2 MB")]
        out = ""
        for ab, nm, meta in rows_:
            if state == "dl" and ab == "YLT":
                out += trrow(ab, nm, "0.6 of 1.3 MB", ring(46), label=f"{nm}, downloading, 46 percent. Double tap to cancel.")
            else:
                out += trrow(ab, nm, meta, DL, label=f"{nm}, {meta}, download")
        return out
    online = (trrow("NIV", "New International Version", "Biblica", "")
            + trrow("NKJV", "New King James Version", "Thomas Nelson", "")
            + trrow("NLT", "New Living Translation", "Tyndale House", ""))
    def tr_sheet(state=None, offline=False):
        dl = downloadable(state)
        on = online
        if offline:
            # Rows stay readable (dimming would fail contrast); only the actions go.
            dl = '<p class="note muted offl">Downloads need a connection.</p>' + dl.replace(DL, "")
        ph = on_phone
        if state == "done":
            ph += trrow("YLT", "Young’s Literal Translation", "Downloaded · 1.3 MB", MORE)
            dl = dl.replace(trrow("YLT", "Young’s Literal Translation", "1898 · 1.3 MB", DL, label="Young’s Literal Translation, 1898 · 1.3 MB, download"), "")
        body = (sec("On your iPhone", ph, first=True) + sec("Download", dl)
                + sec("Online", '<p class="note muted offl">Needs a connection.</p>' + on))
        return sheet("lg", "Translations", None, body, back=True, foot=False)
    under = reader("JHN", 1, 1, 9, scrolled=False) + scrim()
    contents_tr = lrow("Translation", right='<span class="valr">BSB</span>', cls="valrow").replace('<button class="lrow valrow">', '<button class="lrow valrow" aria-label="Translation, Berean Standard Bible">', 1)
    ntl2 = "".join(lrow(E(n), chev=c != "JHN", cls="book cur" if c == "JHN" else "book", right=CHECK if c == "JHN" else None) for c, n, t in BOOKS if t == "NT")
    F("MT-01", "Contents: one Translation row replaces the switch", under + sheet("lg", "Contents", None, f'<section class="sec first">{contents_tr}</section>' + sec("New Testament", ntl2), foot=False), "mt")
    F("MT-02", "Translations: on your iPhone, download, online", under + tr_sheet(), "mt")
    F("MT-03", "Downloading Young’s Literal Translation", under + tr_sheet("dl"), "mt")
    F("MT-04", "Downloaded: YLT joins On your iPhone", under + tr_sheet("done"), "mt")
    F("MT-05", "No connection", under + tr_sheet(offline=True), "mt")
    F("MT-06", "Reading John 1 in YLT", reader("JHN", 1, 1, 9, scrolled=False, tr="YLT", rows_override=vpl("engylt", "JOH", 1, 1, 9)), "mt")

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

# ================= Passage guide and Audio read-along (guide page) =================
# North Star (John, 10 Oct 2026): the unit is the passage, not the verse. The Greek is evidence inside the
# explanation. No pericope in any bundle has a payload yet (pericopes.payload is null for all 46 in jhn.v2), so
# passage-level copy comes from the golden entry of a verse in the passage, quoted verbatim, or is a labelled placeholder.
if STYLE != "v1":
    db4 = sqlite3.connect(f"{Y}/content/bundles/core.v4.db")  # current core (v4); the older frames above still read v2

    def t4(book, ch, a, b=None):
        return db4.execute("select v.verse, t.text from verses v join texts t on t.ord=v.ord where v.book=? and v.chapter=? and v.verse between ? and ? and t.translation='BSB' order by v.ord", (book, ch, a, b or a)).fetchall()

    PERI = {}
    for _bk in ("jhn", "1co"):
        for pid, lab, pay in sqlite3.connect(f"{Y}/content/bundles/{_bk}.v2.db").execute("select pericope_id, label, payload from pericopes order by start_ord"):
            PERI[pid] = (lab, pay)
    G2 = {k: json.load(open(f"{Y}/golden/{k}.json")) for k in ("jhn.1.1", "1co.14.34")}
    CL = {k: {c["id"].rsplit(".", 1)[1]: c for c in G2[k]["claims"]} for k in G2}
    first_sentence = lambda s: s.split(". ")[0] + "."
    JLAB = PERI["JHN.1.1-1.18"][0]; CLAB = PERI["1CO.14.26-14.40"][0]

    def todo(what):
        # A visible gap, never invented copy: the pipeline writes this per pericope and John reviews it.
        return f'<p class="todo">Placeholder · {E(what)}: to be generated and reviewed</p>'

    def plain_ref(ref, ch):
        # "1:1" in John 1 reads "Verse 1"; a verse outside the chapter keeps its chapter ("Chapter 11, verse 5").
        out = []
        for r in ref.replace("–", "-").split(", "):
            c_, v = r.split(":")
            out.append(v.replace("-", "–") if c_ == str(ch) else f"chapter {c_}, verse {v}")
        word = "Verses" if len(out) > 1 or "–" in out[0] else "Verse"
        if out[0].startswith("chapter"):
            return out[0][0].upper() + out[0][1:]
        return f"{word} {', '.join(out)}"

    def notice(c, ref, ev=None, ch=1, shown=False):
        # "1:1 · Background" meant nothing to a reader (John, 11 Oct 2026): the guide says which verse, in words.
        meta = f'<span class="note muted">{E(plain_ref(ref, ch))}</span>'
        if shown:
            meta += '<span class="note shown"> · Shown in the passage</span>'
        r = row(lang(c["claim"]), extra=meta)
        return (r.replace('class="row', 'class="row on', 1) if shown else r) + (ev or "")

    def closer(word, translit, gloss, note, count_row, expanded):
        # "Closer to the Greek" is one line inside the claim it supports (Matter's inline note, not a mode).
        head = (f'<button class="evx" aria-expanded="{"true" if expanded else "false"}"><span>Closer to the Greek: '
                f'<span lang="el" class="gk">{word}</span></span>{ic("up" if expanded else "down", 16)}</button>')
        if not expanded:
            return head
        return (head + f'<div class="evb"><p class="evh"><span lang="el" class="gk">{word}</span> <span class="muted">{E(translit)} · “{E(gloss)}”</span></p>'
                f'{row(count_row, cls="plain")}<p class="note muted">Gloss: STEPBible TAGNT · Count: SBLGNT</p></div>')

    def differ(c, ref, ch=1):
        n = len(c["positions"]); where = plain_ref(ref, ch)
        return row(lang(c["claim"]), extra=f'<span class="rd-n">Compare the {n} readings</span><span class="note muted"> · {E(where)}</span>',
                   aria=f'{c["claim"]} {where}. Compare the {n} readings')

    def gtext(book, ch, a, b, sel=(), hint=True):
        h = ""
        return f'<section class="sec gtext"><h3 class="lbl">The passage</h3>{h}{verses_html(t4(book, ch, a, b), sel=sel, ch=ch, book=book)}</section>'

    kwJ = G2["jhn.1.1"]["key_words"][0]
    LOGOS_JHN = db4.execute("select count from occurrences where book='JHN' and occurrence_key='λογοσ'").fetchone()[0]
    def john_guide(start="top", ev=False, sel=(), shown=None):
        c = CL["jhn.1.1"]
        parts = []
        if start == "top":
            parts.append(sec("Where we are", f'<p class="expl">{lang(first_sentence(G2["jhn.1.1"]["whats_happening"]))}</p>' + todo("Who is speaking to whom"), first=True))
        if start in ("top", "notice"):
            ex = closer("λόγος", "logos", kwJ["gloss"], kwJ["note"], f'<span lang="el" class="gk">λόγος</span> in John · {LOGOS_JHN}', ev)
            parts.append(sec("Three things to notice", notice(c["c9"], "1:1") + notice(c["c2"], "1:1", shown=(shown == "c2")) + notice(c["c10"], "1:1", ex), first=(start == "notice")))
        if start in ("top", "notice", "differ") and not shown:
            parts.append(sec("Where readers differ", differ(c["c11"], "1:1") + differ(c["c12"], "1:1"), first=(start == "differ")))
        txt = gtext("JHN", 1, 1, 18, sel=sel)
        if shown == "c2":
            # Tapping a thing to notice marks its evidence in the text: c2's evidence is the three ἦν of 1:1,
            # rendered "was" three times in the BSB. Its own mark (ink weight, dotted accent underline), distinct
            # from the selection wash, the difference wash and the spoken-word underline.
            cut = txt.index("He was with God")
            txt = re.sub(r"\bwas\b", '<mark class="evm">was</mark>', txt[:cut]) + txt[cut:]
            # VoiceOver hears what the eye sees: a status message, and the marked words are reachable as one stop.
            txt = '<p class="sr-only" role="status">"was" marked 3 times in verse 1. Swipe to the passage to hear it.</p>' + txt
        parts.append(txt)
        return "".join(parts)

    kwC = G2["1co.14.34"]["key_words"][0]
    SIG_1CO = db4.execute("select o.count from occurrences o join lexemes l on l.occurrence_key=o.occurrence_key where o.book='1CO' and l.lemma='σιγάω'").fetchone()[0]
    def cor_guide(start="top", ev=False):
        c = CL["1co.14.34"]
        parts = []
        if start == "top":
            parts.append(sec("Where we are", f'<p class="expl">{lang(first_sentence(G2["1co.14.34"]["whats_happening"]))}</p>', first=True))
        if start in ("top",):
            ex = closer("σιγάω", "sigaō", "be silent", kwC["note"], f'<span lang="el" class="gk">σιγάω</span> in 1 Corinthians · {SIG_1CO}', ev)
            parts.append(sec("Three things to notice", notice(c["c3"], "14:28, 14:30", ex, ch=14) + notice(c["c5"], "11:5", ch=14) + notice(c["c6"], "14:34", ch=14)))
        parts.append(sec("Where readers differ", differ(c["c7"], "14:34–35", ch=14) + differ(c["c9"], "14:34–35", ch=14), first=(start == "differ")))
        parts.append(gtext("1CO", 14, 26, 40))
        return "".join(parts)

    def guide(pos, title, sub, body, scrolled=False):
        # At the guide's top level × and "Back to reading" did the same thing, two controls with one meaning to
        # VoiceOver; × stays, and "Back to reading" appears one level down, where it saves steps.
        return sheet(pos, title, sub, body, scrolled=scrolled, foot=False).replace('aria-label="Close"', 'aria-label="Close, back to reading"', 1)

    jrows = t4("JHN", 1, 1, 9)
    opener_btn = (f'<button class="opener olink" aria-label="{E(JLAB)}, John 1:1 to 18. Opens the passage guide">'
                  f'<span>{E(JLAB)}</span>{ic("right", 14)}</button>')
    j_reader = reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows)
    j_reader = j_reader.replace('<div class="rbody"><div style="margin-top: 0px">', f'<div class="rbody"><div style="margin-top: 0px">{opener_btn}', 1)
    under_j = reader("JHN", 1, 1, 6, scrolled=False, rows_override=t4("JHN", 1, 1, 6)) + scrim()
    F("PG-01", "Reader: the passage title opens its guide", j_reader, "pg")
    F("PG-02", "Passage guide, medium: where we are, three things", under_j + guide("med", JLAB, "John 1:1–18", john_guide()), "pg")
    F("PG-03", "Guide, large: readers differ, then the text; 1:1 tapped", under_j + guide("lg", JLAB, "John 1:1–18", john_guide(start="differ", sel=(1,)), scrolled=True), "pg")
    pushed = sheet("lg", "John 1:1", JLAB, understand_simple_body("jhn.1.1", clamp=False, labels=False), back=True)
    F("PG-04", "1:1 opens its Understand inside the guide", under_j + pushed, "pg")
    F("PG-05", "Closer to the Greek: λόγος, one line that expands", under_j + guide("lg", JLAB, "John 1:1–18", john_guide(start="notice", ev=True), scrolled=True), "pg")

    # Start here, around the guide. Next is marked in type (number and "Next" in the accent, title semibold), never the
    # wash and bar: those mean a selected verse only (John, 10 Oct 2026).
    pers2 = [(pid, lab) for pid, (lab, _) in PERI.items() if pid.startswith("JHN.")][:8]
    st_rows = ""
    for i, (pid, lab) in enumerate(pers2):
        rng = prange(pid)
        if i == 0:
            orient = first_sentence(G2["jhn.1.1"]["whats_happening"])
            # "Next · range" sits above the title, so the mark is read before the title, not floated
            # beside it; the orientation is shown whole, never cut before its point (house style: ≤ 25 words).
            st_rows += (f'<button class="lrow numrow nx" aria-label="Next, passage 1, {E(lab)}, John {rng}. {E(orient)} Opens the passage guide">'
                        f'<span class="rm"><span class="nxo">Next · {rng}</span>'
                        f'<span class="lmain"><span class="num nxn">{i + 1}</span><span class="nt">{E(lab)}</span></span>'
                        f'<span class="lsub orlw"><span class="orl">{lang(orient)}</span></span></span>'
                        f'<span class="chev nxc">{ic("right", 18)}</span></button>')
        else:
            st_rows += lrow(f'<span class="num">{i + 1}</span><span class="nt">{E(lab)}</span>', sub=rng, chev=False, cls="numrow")
    st_cover2 = (f'<div class="cover stcover"><h1 class="ltitle">The Gospel of John</h1>'
                 f'<span class="cwsm"><span lang="el" class="gk">{kwJ["surface"]}</span> <span class="muted">logos · “{E(kwJ["gloss"])}” · {len([p for p in PERI if p.startswith("JHN.")])} passages, in order</span></span></div>')
    F("PG-10", "Tap a thing to notice: its evidence is marked in the passage", under_j + guide("lg", JLAB, "John 1:1–18", john_guide(start="notice", shown="c2"), scrolled=True), "pg")
    F("PG-06", "Start here: Next marked in type, with its orientation line", pg_header(("Home", "Home")) + f'<div class="pg">{st_cover2}{st_rows}</div>', "pg")

    under_c = reader("1CO", 14, 26, 31, offset=-6, rows_override=t4("1CO", 14, 26, 31)) + scrim()
    F("PG-07", "Second guide: 1 Corinthians 14:26–40, medium", under_c + guide("med", CLAB, "1 Corinthians 14:26–40", cor_guide()), "pg")
    F("PG-08", "1 Cor guide, large: σιγάω evidence open", under_c + guide("lg", CLAB, "1 Corinthians 14:26–40", cor_guide(ev=True)), "pg")
    F("PG-09", "1 Cor guide, scrolled: where readers differ, then the text", under_c + guide("lg", CLAB, "1 Corinthians 14:26–40", cor_guide(start="differ"), scrolled=True), "pg")

    # ---------- Audio read-along ----------
    # The spoken mark is its own: upcoming text muted, the spoken word in ink with a 2.5 pt accent underline, and a
    # speaker glyph on the verse number (shape, not colour). Selection keeps the wash and bar (Apple Music sing-along;
    # Speechify's wash was not taken because the wash already means "selected").
    def au_verses(rows, cur, wi, sel=()):
        out, grp = [], []
        for n, t in rows:
            if n < cur:
                body, cls = scripture(t), "v pre"
            elif n > cur:
                body, cls = scripture(t), "v au-up"
            else:
                ws = t.split(" ")
                body = " ".join(E(w) if i < wi else (f'<span class="au-w">{E(w)}</span>' if i == wi else f'<span class="au-up">{E(w)}</span>') for i, w in enumerate(ws))
                cls = "v au-cur"
            if n == 1:
                num = f'<span class="cn" aria-label="Chapter 1, verse 1">1</span>'
            elif n == cur:
                num = f'<span class="vn au-vn" aria-label="Verse {n}, playing">{n}</span>'
            else:
                num = f'<span class="vn">{n}</span>'
            p = f'<p class="{cls}{" v1" if n == 1 else ""}">{num}{"" if n == 1 else " "}{body}</p>'
            if n in sel:
                grp.append(p)
            else:
                if grp:
                    out.append('<div class="selg">' + "".join(grp) + "</div>"); grp = []
                out.append(p)
        if grp:
            out.append('<div class="selg">' + "".join(grp) + "</div>")
        return "".join(out)

    def rest_bar(rng="1:1–18"):
        # At rest: understand the passage, or listen to it. Compare is a verse action, so it waits for a selection.
        return (f'<div class="abar rest"><div class="d rest-row"><button class="ab-u" aria-label="Understand the passage, {E(JLAB)}, John {rng}">Understand {rng}</button>'
                f'<button class="rb play" aria-label="Listen to {E(JLAB)}, John {rng}">{ic("play", 22)}</button></div>'
                f'<div class="a abar-list"><button class="ab-u">Understand {rng}</button><button class="ab-i">Listen{ic("play", 30)}</button></div></div>')

    def sel_bar(v):
        # The same one-row bar whether or not audio plays: Play from here, Understand, Compare, more. Original leaves
        # the bar: the Greek is evidence inside Understand ("Closer to the Greek"), not a destination.
        return sel_bar_playing(v)

    def mini(verse, playing=True, vo=False):
        # While playing, the bar is the player: what is playing, back a verse, pause, next. Going back to re-hear a verse is
        # the commonest move while listening (John, 11 Oct 2026). Speed lives in the full player.
        b = (lambda n: f'<span class="vo" aria-hidden="true">{n}</span>') if vo else (lambda n: "")
        pp = ("pause", "Pause") if playing else ("play", "Play")
        return (f'<div class="mp" role="region" aria-label="Audio player">'
                f'<div class="mp-row"><button class="mp-lab" aria-label="{E(JLAB)}, John 1:{verse}, Berean Standard Bible. Opens the player">{b(1)}'
                f'<span class="mp-t">{E(JLAB)}</span><span class="note muted">Verse {verse} · BSB</span></button>'
                f'<div class="mp-ctl"><button class="mpb" aria-label="Previous verse">{b(2)}{ic("prevv", 20)}</button>'
                f'<button class="mpb mpp" aria-label="{pp[1]}">{b(3)}{ic(pp[0], 22)}</button>'
                f'<button class="mpb" aria-label="Next verse">{b(4)}{ic("nextv", 20)}</button></div></div></div>')

    def sel_bar_playing(v):
        # A selection takes the bar (audio, if playing, keeps going). Its first action is to play from the selected verse:
        # a tap in the reader still means "select", so jumping the audio is one tap from there (John, 11 Oct 2026).
        return (f'<div class="abar"><div class="d selp"><button class="mpb mpp pfh" aria-label="Play from verse {v.split(":")[1]}">{ic("play", 18)}<span>{v}</span></button>'
                f'<button class="ab-u">Understand {v}</button>'
                f'<button class="ab-i" aria-label="Compare translations of {v}">{ic("cols", 18)}<span>Compare</span></button><button class="ab-m" aria-label="More actions">{ic("more", 22)}</button></div>'
                f'<div class="a abar-list"><button class="ab-u">Understand {v}</button><button class="ab-i">Play from {v}{ic("play", 30)}</button><button class="ab-i">More{ic("more", 30)}</button></div></div>')

    rows9 = t4("JHN", 1, 1, 9)
    def au_reader(cur, wi, sel=(), bar=""):
        return header(("Home", "Home"), "John 1 · BSB") + f'<div class="rbody"><div class="axsel" style="margin-top: 0px">{au_verses(rows9, cur, wi, sel)}</div></div>' + bar

    rest_reader = j_reader + rest_bar()
    F("AU-01", "Reader at rest: Listen in the bar", rest_reader, "au")
    F("AU-02", "Playing: the spoken word in an ink pill, upcoming muted; mini player docked", au_reader(5, 4, bar=mini(5)), "au")
    F("AU-03", "Playing 1:5, 1:6 selected: Play from 1:6 is one tap; the audio keeps going until then", au_reader(5, 4, sel=(6,), bar=sel_bar_playing("1:6")), "au")

    def full(cur, wi, vo=False, rm=False):
        b = (lambda n: f'<span class="vo" aria-hidden="true">{n}</span>') if vo else (lambda n: "")
        rows = t4("JHN", 1, max(1, cur - 2), min(18, cur + 4))
        ly = []
        for n, t in rows:
            if n == cur:
                ws = t.split(" ")
                body = " ".join(E(w) if i < wi else (f'<span class="au-w">{E(w)}</span>' if i == wi else f'<span class="au-up">{E(w)}</span>') for i, w in enumerate(ws))
                ly.append(f'<p class="ly cur" aria-current="true"><span class="lyn">{n}</span>{body}</p>')
            else:
                ly.append(f'<p class="ly{" past" if n < cur else " up"}"><span class="lyn">{n}</span>{E(t)}</p>')
        segs = [(18, "1:1–18"), (16, "1:19–34"), (17, "1:35–51")]
        bar_ = "".join(f'<span class="seg2" style="flex: {w}"><span class="fill" style="width: {min(100, max(0, (cur - s0) / w * 100)):.0f}%"></span></span>'
                       for (w, _), s0 in zip(segs, (0, 18, 34)))
        top = (f'<div class="fph"><button class="sh-x fpd" aria-label="Close player">{b(1)}{ic("down", 20)}</button>'
               f'<div class="stitle"><span class="sttl">{E(JLAB)}</span><span class="ssub">John 1 · BSB</span></div><span></span></div>')
        scroll_cls = " snap" if rm else ""
        return (f'<div class="fp">{top}<div class="lyr{scroll_cls}">{b(2)}{"".join(ly)}</div>'
                f'<div class="fpc"><div class="prog" role="progressbar" aria-label="John 1, verse {cur} of 51" aria-valuenow="{cur}" aria-valuemin="1" aria-valuemax="51">{b(3)}{bar_}</div>'
                f'<div class="progl note muted"><span>Verse {cur}</span><span>of 51</span></div>'
                f'<div class="fpr"><button class="mpb mps" aria-label="Speed, 1 times">{b(4)}1×</button>'
                f'<button class="mpb big" aria-label="Previous verse">{b(5)}{ic("prevv", 26)}</button>'
                f'<button class="mpb mpp big2" aria-label="Pause">{b(6)}{ic("pause", 30)}</button>'
                f'<button class="mpb big" aria-label="Next verse">{b(7)}{ic("nextv", 26)}</button>'
                f'<button class="mpb guideb" aria-label="Open the passage guide, {E(JLAB)}">{b(8)}Guide</button></div></div></div>')

    F("AU-04", "Full player: spoken words fill in ink; tap any verse to jump there", full(5, 4), "au")
    F("AU-05", "Reduce Motion: no smooth scroll, the next verse snaps into place", [
        ("Light · 1:5 playing", "light", full(5, 10, rm=True)),
        ("Dark · 1:6 starts: it snaps, no scroll", "dark", full(6, 0, rm=True)),
        ("AX5 · 1:6, snapped", "ax5", full(6, 0, rm=True))], "au")
    F("AU-06", "VoiceOver: player order and labels", [
        ("Light · full player, order 1–8", "light", full(5, 4, vo=True)),
        ("Dark · mini player, order 1–5", "dark", au_reader(5, 4, bar=mini(5, vo=True))),
        ("AX5 · mini player, order 1–5", "ax5", au_reader(5, 4, bar=mini(5, vo=True)))], "au")

    GUIDE_NOTES = {
        "refs_pg": (
            "Passage guide · why it looks like this\n\n"
            "Order: Where we are → Three things to notice → Where readers differ → The passage (verse detail one tap away). "
            "Labelled sections of plain prose, typography only: Headway 'What's inside?' mobbin.com/screens/3a17e556-460c-43b0-bf46-893f5d49e263 · "
            "Blinkist 'What's it about?' mobbin.com/screens/b4bd59db-b995-4fc3-ab5a-cae6efeff848 · Google step guide 'What you're solving for / What's given' "
            "mobbin.com/screens/8d10ee12-c96f-4289-9c80-0544e00c2d08 · Co–Star serif sections stacked, first open mobbin.com/screens/b2f59e7e-d75c-4065-9726-9e3f9be19afc · "
            "stoic. intro before the walk mobbin.com/screens/15924ee7-16ea-4638-a904-2e35d88ac048\n\n"
            "Rejected: Duolingo path and XP (mobbin.com/screens/fd077091-e8e9-413f-9aff-bb68984e5b04), Blinkist and Headway covers, read/listen CTAs, "
            "MasterClass/Udemy curriculum cards. Imprint, BibleProject and Glorify: not indexed on Mobbin (searched).\n\n"
            "Verse inside the guide: tapping a verse in 'The passage' pushes its Understand inside the same sheet (‹ back to the guide). Still one sheet, so the evidence sheet stays the second."),
        "gaps_pg": (
            "Data behind these frames\n\n"
            "No pericope has a payload: pericopes.payload is null for all 46 John passages (jhn.v2) and for 1CO.14.26-14.40 (1co.v2). "
            "So every passage-level line is quoted from the one golden entry inside the passage:\n"
            "• Where we are = first sentence of whats_happening (JHN.1.1, 1CO.14.34).\n"
            "• Three things = claims c9, c2, c10 (JHN.1.1; c8 left out, it restated the header's range); c3, c5, c6 (1CO.14.34). Their wording is verse-level ('The verse opens…').\n"
            "• Where readers differ = the entry's debated claims; they are about one verse, not the passage.\n"
            "• 'Who is speaking to whom' (John) is not in the data: placeholder.\n"
            "Counts from core.v4: λόγος in John 40; σιγάω in 1 Corinthians 3. Text: BSB, core.v4.\n"
            "No 'Unreviewed' tag: John approved all seven golden entries (review/decisions.jsonl, 10 Oct; bundles say human_reviewed).\n\n"
            "Why 1 Corinthians 14 and not a second John passage: John has one entry (JHN.1.1). Any other John guide would be all placeholder. "
            "1CO.14.34 has 9 claims, 2 of them disputed."),
        "refs_au": (
            "Audio read-along · references\n\n"
            "Spoken word lit, rest dim: Apple Music sing-along mobbin.com/screens/d4df9c1d-7006-4d78-87e2-852058c3ec53 · mobbin.com/screens/d869e223-b0f8-4cec-a965-c1955fe513c6\n"
            "Lyrics auto-scroll, current line high: Spotify mobbin.com/screens/27859727-f251-4887-8b72-e4776a6d7597 · transcript mobbin.com/screens/6af5c215-bc53-4033-9b8c-40c92051794e\n"
            "Read-along in the text: ElevenReader mobbin.com/screens/633320e0-b7fc-4791-b65e-c250e82c7b06 · Speechify mobbin.com/screens/c3343a61-2e32-4e5d-a061-39cd80573727 "
            "(both mark with a wash; not taken, the wash means selected)\n"
            "Mini player docked: Matter mobbin.com/screens/9f487f5f-2f6c-4cd5-94ab-01616381033a · Audible mobbin.com/screens/3f32bf32-8516-4fd2-a248-4565689b793a\n"
            "Transcript player: Brink mobbin.com/screens/0c68aed6-765a-4380-a4ff-a88ef011ce6c\n"
            "YouVersion, Dwell, Kindle Whispersync: not indexed on Mobbin (searched).\n\n"
            "Marks: spoken word = ink + 2.5 pt accent underline; upcoming = mutedInk (5.6:1 light, 6.0:1 dark); playing verse number carries a speaker glyph. "
            "Selected verse keeps wash + 3 pt bar. Prev/next go by verse, not ±15 s: scripture is addressed by verse.\n"
            "Progress = verse of chapter, split at the three passages of John 1. No times shown: there is no audio file yet, so any duration would be invented.\n\n"
            "Motion: the spoken verse scrolls to 30% from the top (SPRING.standard, 0.4 s) as it starts; only when the reader hasn't scrolled in 4 s. Reduce Motion (AU-05): it snaps, the word mark moves without a fade.\n\n"
            "VoiceOver (AU-06). Full player: 1 'Close player' → 2 text, each verse 'John 1:5, playing. The Light shines…' (current verse first when focus enters) → "
            "3 'John 1, verse 5 of 51', adjustable: swipe up/down moves a verse → 4 'Speed, 1 times' → 5 'Previous verse' → 6 'Pause' → 7 'Next verse' → 8 'Stop listening'. "
            "Mini player: 1 'The Word became flesh, John 1:5, Berean Standard Bible. Opens the player' → 2 'Previous verse' → 3 'Pause' → 4 'Next verse' → 5 'Speed, 1 times'. "
            "Magic tap (two-finger double tap) plays and pauses. Word tracking is not announced; focus never moves on its own. Reader verse: 'Verse 5, playing'."),
    }

# ================= App-wide IA after the passage shift (guide page) =================
if STYLE != "v1":
    wc = lambda s_: len(re.sub(r"<[^>]+>", "", s_).split())

    def node(name, desc="", depth=None, kids="", cls=""):
        d = f'<span class="dgd">{E(depth)}</span>' if depth else ""
        ds = f'<span class="dgs">{desc}</span>' if desc else ""
        k = f'<ul>{kids}</ul>' if kids else ""
        return f'<li class="{cls}"><div class="dgn"><span class="dgt">{name}</span>{ds}{d}</div>{k}</li>'

    before = node("Home", "Continue · Start with John · books", "", 
        node("Start here", "46 passages → opens the reader at the passage")
        + node("Search", "Go to · Words · Passages (verses) → reader at the verse")
        + node("Reader · John 1 · BSB", "Contents, Aa", "depth 0",
            node("Tap a verse → action bar", "Understand 1:1 · Original · Compare · ⋯", kids=
                node("Understand 1:1", "sheet: What’s happening · What we can see · Where readers differ · Go further (Original Greek, Compare, Passage, Related)", "depth 1",
                    node("Evidence sheet", "Why we say this · Word → Occurrences · Compare the readings · Translations · Peek", "depth 2"))
                + node("Original", "→ Understand, scrolled to Original Greek", cls="gone")
                + node("Compare", "→ Understand, scrolled to Compare"))
            + node("Select 2+ verses", "Passage Understand: the verse entries stitched under small labels")))
    after = node("Home", "Continue: where you are in John (passage 3 of 46) · Next passage with its orientation · books", "",
        node("Start here", "46 passages, Next marked in type with its orientation → <b>Passage guide</b>")
        + node("Search", "Guides (passage titles) → <b>Passage guide</b> · Verses → reader at the verse")
        + node("Reader · John 1 · BSB", "Contents, Aa · passage title above verse 1 → <b>Passage guide</b>", "depth 0",
            node("Bar at rest", "<b>Understand 1:1–18</b> · Listen", kids=
                node("Passage guide", "sheet: Where we are · How it moves · What’s happening · Three things to notice · Where readers differ · The passage", "depth 1",
                    node("Verse in the passage", "Understand 1:1, pushed inside the guide (‹ back to the guide)", "depth 1, pushed")
                    + node("Evidence sheet", "Why we say this · <i>Closer to the Greek</i> → word → occurrences · Compare the readings · Translations · Peek", "depth 2"), cls="new")
                + node("Listen", "the bar becomes the mini player → full player (read-along)", cls="new"))
            + node("Tap a verse → bar", "Play from 1:1 · <b>Understand 1:1</b> · Compare · ⋯ (Copy, Share, Bookmark); one row, playing or not")
            + node("Original", "no longer a bar action or a mode: one line of evidence inside a claim, and Go further › Original Greek in a verse’s Understand", cls="gone")))

    def diagram(cls, title, tree, foot):
        return f'<div class="dgw {cls}"><p class="dgh">{title}</p><ul class="tree">{tree}</ul><p class="dgf">{foot}</p></div>'
    F("IA-01", "Sitemap, before and after (light)", {"wide": diagram("light", "Before · the verse is the unit", before, "Three depth-1 doors (Understand, Original, Compare) open one sheet. The passage exists only as a row inside a verse’s Understand.")
                                                           + diagram("light", "After · the passage is the unit", after, "One depth-1 surface per passage. Verse detail is one level down, inside it. The Greek is evidence, never a destination.")}, "ia")
    F("IA-02", "Sitemap, before and after (dark)", {"wide": diagram("dark", "Before · the verse is the unit", before, "Three depth-1 doors (Understand, Original, Compare) open one sheet.")
                                                          + diagram("dark", "After · the passage is the unit", after, "One depth-1 surface per passage; verse detail one level down.")}, "ia")

    # Home: where you are in John. Example reader state (marked on the canvas): passages 1–2 read, reading 1:39.
    j139 = t4("JHN", 1, 39)[0][1]
    njohn = len([p for p in PERI if p.startswith("JHN.")])
    ticks = "".join(f'<span class="tk{" dn" if i < 2 else (" cu" if i == 2 else "")}"></span>' for i in range(njohn))
    jp = [(pid, lab) for pid, (lab, _) in PERI.items() if pid.startswith("JHN.")]
    home_cont = (f'<button class="lead coverlead" aria-label="Continue reading, {E(jp[2][1])}, John 1:39. {E(j139)}"><span class="rm cover"><span class="lbl">Continue · John 1:39</span>'
                 f'<span class="cw lit">{E(jp[2][1])}</span><span class="excerpt">{E(j139)}</span></span><span class="chev">{ic("right", 18)}</span></button>'
                 f'<div class="prg" role="img" aria-label="2 of {njohn} passages in John read"><div class="tks" aria-hidden="true">{ticks}</div><p class="note muted">2 of {njohn} passages read</p></div>')
    nxt = (f'<button class="lrow numrow nx" aria-label="Next, passage 4, {E(jp[3][1])}, John {prange(jp[3][0])}. Opens the passage guide">'
           f'<span class="rm"><span class="lmain"><span class="num nxn">4</span><span class="nt">{E(jp[3][1])}</span></span>'
           f'<span class="note muted lsub">{prange(jp[3][0])}<span class="a nxw"> · Next</span></span><span class="lsub orlw">{todo("Passage orientation")}</span></span>'
           f'<span class="lright"><span class="nxw">Next</span></span><span class="chev">{ic("right", 18)}</span></button>')
    # "All passages", not "All 46": the progress line right above already says 46 (visual pass, 11 Oct 2026).
    allp = lrow("All passages in John", cls="valrow")
    F("IA-03", "Home: where you are in John, the next passage oriented", page(None, "Yada", home_cont + sec("Next in John", nxt + allp) + sec("Old Testament", ot), right=HOME_ICONS), "ia")
    F("IA-04", "Reader at rest: the passage is the primary action", rest_reader, "ia")
    F("IA-05", "Verse selected: Understand 1:1, Compare, more; no Original", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows, sel=(1,)) + sel_bar("1:1"), "ia")

    j114 = t4("JHN", 1, 14)[0][1]
    guide_hits = [(pid, lab) for pid, lab in jp if "word became flesh" in lab.lower()]
    sr = sec("Guides", "".join(lrow(f'<span class="nt">{E(lab)}</span>', sub=f"John {prange(pid)}") for pid, lab in guide_hits), first=True)
    vcount = db4.execute("select count(*) from texts_fts f join texts t on t.rowid=f.rowid where texts_fts match '\"word became flesh\"' and t.translation='BSB'").fetchone()[0]
    sr += sec(f"Verses · {vcount}", lrow(f'<span class="excerpt2">{bold(j114, "The Word became flesh")}</span>', cls="passage").replace('<span class="lmain">', '<span class="lmain"><span class="pref">John 1:14</span>', 1))
    F("IA-06", "Search: a passage title finds its guide", home_under + search_sheet("word became flesh", sr), "ia")

    # House style (reports/Simple yet deep…): orientation ≤25 words; 2–5 movement steps; what's happening 2–4 sentences
    # with a because/so; ≤3 + ≤2 claims; about 150 words before any tap. Budget tags are canvas annotations, not UI.
    c = CL["jhn.1.1"]
    o_txt = first_sentence(G2["jhn.1.1"]["whats_happening"])
    wh = G2["jhn.1.1"]["whats_happening"]
    see_w = sum(wc(c[k]["claim"]) for k in ("c9", "c2", "c10")); dif_w = sum(wc(c[k]["claim"]) for k in ("c11", "c12"))
    total = wc(o_txt) + wc(wh) + see_w + dif_w
    tag = lambda t: f'<span class="wb" aria-hidden="true">{E(t)}</span>'
    hs = (sec("Where we are", f'<p class="expl">{lang(o_txt)}</p>{tag(f"{wc(o_txt)} words · max 25")}', first=True)
          + sec("How the passage moves", todo("2–5 steps, each under 10 words") + tag("0 words: no movement in the data"))
          + sec("What’s happening", f'<p class="expl">{lang(wh)}</p>{tag(f"{wc(wh)} words · 3 sentences · has “because” · 40–80")}')
          + sec("Three things to notice", notice(c["c9"], "1:1") + notice(c["c2"], "1:1") + notice(c["c10"], "1:1") + tag(f"{see_w} words · 3 of 3"))
          + sec("Where readers differ", differ(c["c11"], "1:1") + differ(c["c12"], "1:1") + tag(f"{dif_w} words · 2 of 2")))
    budget = f'<div class="wbt" aria-hidden="true">Before any tap: {total} words · budget about 150</div>'
    F("IA-07", "House style: the first-screen word budget, medium detent", under_j + guide("med", JLAB, "John 1:1–18", hs).replace('<div class="sbody">', '<div class="sbody">' + budget, 1), "ia")

    # Disagreement, agreed first, each reading with the same three parts, no winner. Manuscript question listed first (tc before tn).
    cc = CL["1co.14.34"]
    def position(p_, here):
        links = "".join(f'<button class="elink">{E(fref(ev["ref"]))}{ic("right", 16)}</button>' for ev in p_["evidence"] if ev.get("type") == "verse" and ev["ref"] != here)
        links += "".join(f'<p class="note muted">{lang(ev.get("lemma", ""))} · {lang(ev.get("note", ""))}</p>' for ev in p_["evidence"] if ev.get("type") != "verse")
        return (f'<section class="pos"><h4 class="rlabel">{lang(p_["label"])}</h4>'
                f'<p class="plbl">What it says</p><p class="claim">{lang(p_["case"])}</p>{tag(str(wc(p_["case"])) + " words")}'
                f'<p class="plbl">Supporters point to</p><div class="elinks">{links or todo("Evidence")}</div>'
                f'<p class="plbl">Main difficulty</p>{todo("Main difficulty")}</section>')
    dis = (sec("Where readers differ",
               row(lang(cc["c9"]["claim"]), extra=f'<span class="note muted">Manuscripts · </span><span class="rd-n">Compare the {len(cc["c9"]["positions"])} readings</span>', aria=f'{cc["c9"]["claim"]} Manuscripts. Compare the {len(cc["c9"]["positions"])} readings')
               + f'<div class="dq"><p class="claim dqq">{lang(cc["c7"]["claim"])}</p><p class="plbl">What everyone agrees on</p>{todo("Agreed facts")}'
               + "".join(position(p_, "1CO.14.34") for p_ in cc["c7"]["positions"]) + "</div>", first=True))
    F("IA-08", "Where readers differ: agreed first, equal parts, no winner", under_c + guide("lg", CLAB, "1 Corinthians 14:26–40", dis, scrolled=True), "ia")

    GUIDE_NOTES["refs_ia"] = (
        "App-wide IA · references and decisions\n\n"
        "Progress without a streak: Deepstash 'Continue Journey · 1 of 6 Read' with a segmented bar and 'Read next' mobbin.com/screens/ce6338b6-717e-41f2-892d-f175aa75dd5f · "
        "Quizlet 'Jump back in' mobbin.com/screens/15f84fb7-e67c-4483-b5d5-c5650540b051. Rejected: Apple Books daily Reading Goals ring mobbin.com/screens/00643994-7713-4c56-9d46-e81e10a83ba7, "
        "Fable and timespent streak counters mobbin.com/screens/f76cf0f3-138c-44d3-9f1f-c07cf9aa5d1c · mobbin.com/screens/11c278de-5ff4-427f-9163-255adc2ec7d8 (research: streak guilt is a documented reason readers quit).\n\n"
        "Bar with one primary action: Crouton docked pill mobbin.com/screens/bfb5df79-f490-45d3-b573-35d72f6ff3c8 · Noom audio bar above tab bar mobbin.com/screens/21f57f4c-71da-4689-8d02-eedb0a533b9b.\n\n"
        "Home (IA-03) shows an example reader state: passages 1–2 read, reading 1:39. Progress counts passages read, so a missed week loses nothing; no dates, no streak, no reminders. Done = full tick, current = half tick, plus the sentence.\n\n"
        "Bar (IA-04/05): at rest 'Understand 1:1–18' (the passage, primary), Listen, Compare. On a verse: Understand 1:1, Compare, ⋯. Original leaves the bar. "
        "The bar steps back with the header while reading (D-05) and returns on scroll up.\n\n"
        "Entry points to a guide: the passage title above its first verse (PG-01), the bar at rest (IA-04), Start here (PG-06), Home's Next row (IA-03), Search 'Guides' (IA-06).\n\n"
        f"House style (IA-07): orange tags are canvas annotations. Today's data: orientation {wc(o_txt)} words (max 25, over by {wc(o_txt) - 25}); movement missing; what's happening {wc(wh)} words; "
        f"claims {see_w} + {dif_w}. Total {total} before any tap against about 150. The passage-level payload must be written to the budget; verse entries can't stand in.\n\n"
        "Disagreement (IA-08): the manuscript question first (NET's tc before tn), then the interpretive one open: agreed facts, then each reading with the same three parts. "
        f"Parity: {wc(cc['c7']['positions'][0]['case'])} vs {wc(cc['c7']['positions'][1]['case'])} words (within 20%). 'Agreed' and 'Main difficulty' are not in the schema: placeholders. "
        "Reading order is the entry's own; a corpus-wide ordering rule is still to be chosen.")
# ================= New flows (v2, guide page): a clear start, open study notes, people, voice, iCloud =================
if STYLE != "v1":
    # Real data only: Tyndale Open Study Notes (CC BY-SA 4.0) and OpenBible.info cross-references (CC BY 4.0) from the
    # study bundle the pipeline built (packages/pipeline/src/study.ts). Licences read from the files (rule 3).
    STUDY = os.environ.get("YADA_STUDY_DB", "/Users/johnetokhana/yada/.claude/worktrees/agent-ae8a170e66179a4fa/content/bundles/study.v1.db")
    sdb = sqlite3.connect(STUDY)
    # Inline the credit is one line; the NLT sentence moves to the whole-note page, since the leading lemma is already
    # marked (NLT) where it stands (visual pass 2, 11 Oct 2026: two lines of credit under four lines of note).
    TOSN_SRC = "Tyndale Open Study Notes, CC BY-SA 4.0"
    TOSN_FULL = "Tyndale Open Study Notes, CC BY-SA 4.0. Quoted words are the NLT’s."
    OB_SRC = "Cross-references from OpenBible.info, CC BY 4.0."

    def o_of(b, c, v):
        return db.execute("select ord from verses where book=? and chapter=? and verse=?", (b, c, v)).fetchone()[0]

    def bcv(o):
        return db.execute("select book, chapter, verse from verses where ord=?", (o,)).fetchone()

    def oref(o1, o2=None):
        b, c, v = bcv(o1)
        s = f"{BOOK[b]} {c}:{v}"
        if o2 and o2 != o1:
            b2, c2, v2 = bcv(o2)
            s += f"–{v2}" if c2 == c else f"–{c2}:{v2}"
        return s

    def bsb(o):
        return db.execute("select text from texts where translation='BSB' and ord=?", (o,)).fetchone()[0]

    def note_paras(t):
        # Shown as published (John: no review, 11 Oct 2026): only the markup changes. The leading "1:1" goes because the
        # sheet header already names the verse; Tyndale's " • " joins separate notes, so each becomes its own paragraph.
        t = re.sub(r"^<b>[0-9:\-–]+</b>\s*", "", t.strip())
        # A note that opens on Tyndale's lemma quotes the NLT, which the reader isn't reading: the lemma says so where it
        # stands, not only in the source line (the BSB of 1:5 says "overcome", the NLT "extinguish").
        t = re.sub(r"^<x>([^<]+?):</x>", r'“<x>\1</x>” <span class="nlt">(NLT)</span>:', t)
        t = (t.replace("<x>", '<q class="nq">').replace("</x>", "</q>").replace("<sc>", '<span class="sc">').replace("</sc>", "</span>"))
        out = []
        for line in t.split("\n"):
            if line.startswith("<h>"):
                out.append(("h", line[3:].replace("</h>", "")))
            else:
                out += [("p", p) for p in line.split(" • ") if p.strip()]
        return out

    def notes_for(o):
        own = sdb.execute("select text from notes where kind='note' and ord_start=? and ord_end=?", (o, o)).fetchall()
        rng = sdb.execute("select ord_start, ord_end, text from notes where kind='note' and ord_start<=? and ord_end>=? and ord_start<ord_end "
                          "order by ord_end-ord_start", (o, o)).fetchall()
        return [t for (t,) in own], rng

    def study_page(o):
        # The whole note is a page pushed inside the sheet (‹ back), the same move as See also and a profile: one
        # gesture for "more of this" everywhere, and the Understand sheet never grows in place (UX pass, 11 Oct 2026).
        own, rng = notes_for(o)
        body = "".join(f'<p class="snote">{p}</p>' for t in own for k_, p in note_paras(t) if k_ == "p")
        for a, b_, t in rng:
            body += f'<h3 class="lbl nov">On {oref(a, b_).rsplit(" ", 1)[1]}</h3>' + "".join(f'<p class="snote">{p}</p>' for k_, p in note_paras(t) if k_ == "p")
        return f'<section class="sec first">{body}<p class="note muted credit">{TOSN_FULL}</p></section>'

    def study_sec(o, first=False):
        # Collapsed to the first paragraph, four lines at most: the note is evidence one tap away, never the first
        # screen's weight (house style word budget, IA-07).
        own, _ = notes_for(o)
        paras = [p for t in own for p in note_paras(t)]
        body = f'<p class="snote clamp">{paras[0][1]}</p><button class="more">Read the whole note</button>'
        return sec("Study notes", body + f'<p class="note muted credit">{TOSN_SRC}</p>', first=first)

    def xrefs(o, n=5):
        return sdb.execute("select to_ord_start, to_ord_end from xrefs where from_ord=? order by votes desc limit ?", (o, n)).fetchall()

    def xrow(a, b_):
        # A range shows its first verse whole and no trailing "…": the reference already says 3:19–20, and "evil. …"
        # read as a typo (last visual pass, 11 Oct 2026).
        t = bsb(a)
        return (f'<button class="row xr" aria-label="{E(oref(a, b_))}. {E(t)}"><span class="rm"><span class="claim xref">{E(oref(a, b_))}</span>'
                f'<span class="xt">{E(t)}</span></span><span class="chev">{ic("right", 18)}</span></button>')

    def see_also(o, k=None, all_=False):
        # One list, not two: Yada's reviewed related passages come first and say why; OpenBible's fill in after them and
        # show the verse itself. The second line tells the two apart without a label or a colour.
        rows, seen = [], set()
        if k:
            for rp in G[k]["related_passages"]:
                b, c, v = rp["ref"].split(".")
                oo = o_of(b, int(c), int(v)); seen.add(oo)
                rows.append(("y", f'<button class="row xr"><span class="rm"><span class="claim xref">{E(fref(rp["ref"]))}</span>'
                                  f'<span class="note muted">{lang(rp["note"])}</span></span><span class="chev">{ic("right", 18)}</span></button>'))
        for a, b_ in xrefs(o):
            if a not in seen:
                rows.append(("o", xrow(a, b_)))
        shown = rows if all_ else rows[:3]
        more = "" if all_ or len(rows) <= 3 else f'<button class="more">Show all {len(rows)}</button>'
        src = f'<p class="note muted credit">{OB_SRC}</p>' if any(s == "o" for s, _ in shown) else ""
        return sec("See also", "".join(r for _, r in shown) + more + src)

    TRS = [t for (t,) in db4.execute("select distinct translation from texts")]
    TRS = [t for t in ("BSB", "WEB", "KJV", "LSV") if t in TRS]

    def nrow(main, sub, disclose=None):
        # Every Go further row is the same object: a name, one muted line saying what is behind it, a bare chevron.
        # Original still opens in place (its words belong beside the verse), so its chevron points down and turns up
        # when open; it no longer sits in a filled circle, which made it read as a button among rows (UI pass,
        # John 11 Oct 2026: "the dropdown style beside it").
        if disclose is None:
            attrs, chev = "", ic("right", 18)
        else:
            attrs, chev = f' aria-expanded="{"true" if disclose else "false"}"', ic("up" if disclose else "down", 18)
        return (f'<button class="row nav"{attrs} aria-label="{E(re.sub("<[^>]+>", "", main))}. {E(sub)}"><span class="rm"><span class="claim">{main}</span>'
                f'<span class="note muted">{E(sub)}</span></span><span class="chev">{chev}</span></button>')

    def go_further(lname, plab, prng, o, grammar=0, study=False, see=0, k=None, open_=False):
        words = db4.execute("select count(*) from tokens where ord=?", (o,)).fetchone()[0]
        rows = nrow(f"Original {lname}", f"{words} words" + (f" · {grammar} grammar notes" if grammar else ", each with its English"), disclose=open_)
        if open_ and k:
            g_rows = "".join(row(lang(c["claim"]), claim_label(c)) for c in G[k]["claims"] if c["category"] != "debated" and is_grammar(c))
            rows += (f'<div class="orig">{interlinear(k)}<p class="note muted credit">Glosses: STEPBible (TAGNT, TBESG)</p>'
                     f'<h3 class="lbl">In the {lname}</h3>{g_rows}</div>')
        if study:
            own, rng = notes_for(o)
            rows += nrow("Study notes", f"Tyndale · {len(own) + len(rng)} notes")
        if see:
            rows += nrow("See also", f"{see} passages")
        rows += nrow("Compare translations", ", ".join(TRS))
        rows += nrow(E(plab), f"Passage guide · {prng}")
        return sec("Go further", rows)

    def usheet(pos, title, sub, body, **kw):
        # × is the one exit and says where it goes; the "Back to reading" pill repeated it and took 60 pt from the
        # sheet, the same duplicate removed from the guide (accessibility pass, 11 Oct 2026).
        return sheet(pos, title, sub, body, foot=False, **kw).replace('aria-label="Close"', 'aria-label="Close, back to reading"', 1)

    PROFILES = sdb.execute("select title, text from notes where kind='profile'").fetchall()

    def people(o, first=False):
        t = bsb(o)
        hits = [ti for ti, _ in PROFILES if re.search(rf"\b{re.escape(ti)}\b", t)]
        if not hits:
            return ""
        return sec("People", "".join(row(E(h), extra='<span class="note muted">Who he was</span>' if h == "Nicodemus" else None, aria=f"{h}. Who he was") for h in hits), first=first)

    # ---------- A clear way to start ----------
    # No onboarding screens (John asked why we had them, 11 Oct 2026): Home itself is the start. One lead, named for what
    # it does, above the books. Deepstash 'Let's start with your first read' mobbin.com/screens/ae4112fa-00aa-4415-ab8f-7d1ec5c49692
    # (one featured start on Home, no questions); Apple Books 'Continue' first for a returning reader
    # mobbin.com/screens/38f5b90d-0d5b-467f-9e2d-7155ba17a3ea.
    def start_lead(vo=False):
        bd = '<span class="vo" aria-hidden="true">5</span>' if vo else ""
        return (f'<button class="lead coverlead" style="position:relative" aria-label="Start here. The Gospel of John, one passage at a time, explained. Opens the first passage">{bd}'
                f'<span class="rm cover"><span class="lbl">Start here</span><span class="cw lit">The Gospel of John</span>'
                f'<span class="excerpt">One passage at a time, explained.</span></span><span class="chev">{ic("right", 18)}</span></button>')

    def home_first(vo=False):
        h = page(None, "Yada", start_lead(vo) + sec("Old Testament", ot), right=HOME_ICONS)
        if vo:
            for n, lab in ((1, "Search"), (2, "Bookmarks"), (3, "More: Recent, Sources")):
                h = h.replace(f'<button class="gbtn" aria-label="{lab}">', f'<button class="gbtn" style="position:relative" aria-label="{lab}"><span class="vo" aria-hidden="true">{n}</span>', 1)
            h = h.replace('<h1 class="wmh">', '<h1 class="wmh" style="position:relative"><span class="vo" aria-hidden="true">4</span>', 1)
            h = h.replace('<h3 class="lbl">Old Testament</h3>', '<h3 class="lbl" style="position:relative"><span class="vo" aria-hidden="true">6</span>Old Testament</h3>', 1)
            h = h.replace('<button class="lrow book">', '<button class="lrow book" style="position:relative"><span class="vo" aria-hidden="true" style="left:auto;right:0;top:14px">7</span>', 1)
        return h

    F("ON-01", "First launch: Home is the start; one lead, the books below", home_first(), "on")
    F("ON-02", "Start here opens John 1:1–18 in its guide", under_j + guide("med", JLAB, "John 1:1–18", john_guide()), "on")
    on_reader = reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows, hint=True)
    on_reader = on_reader.replace('<p class="hint">', f'{opener_btn}<p class="hint">', 1)
    F("ON-03", "× closes the guide onto the text; the hint shows once", on_reader, "on")
    p2 = jp[1]
    next_row = (f'<button class="lrow numrow nx" aria-label="Next, {E(p2[1])}, John {prange(p2[0])}. Opens its guide">'
                f'<span class="rm"><span class="nxo">Next · {prange(p2[0])}</span><span class="lmain"><span class="nt">{E(p2[1])}</span></span></span>'
                f'<span class="chev nxc">{ic("right", 18)}</span></button>')
    end_body = f'<section class="sec gtext first"><h3 class="lbl">The passage</h3>{verses_html(t4("JHN", 1, 17, 18), ch=1, book="JHN")}</section>' + sec(None, next_row)
    F("ON-04", "End of the guide: the next passage is one tap", under_j + guide("lg", JLAB, "John 1:1–18", end_body, scrolled=True), "on")
    # Continue and a Next row together were two calls to action for one reader; mid-passage only Continue shows
    # (UX pass, 11 Oct 2026). Once a passage is finished, the lead itself becomes Next (ON-07).
    F("ON-05", "Second launch, mid-passage: Continue is the one lead", page(None, "Yada", home_cont + allp + sec("Old Testament", ot), right=HOME_ICONS), "on")
    j119 = t4("JHN", 1, 19)[0][1]
    next_lead = (f'<button class="lead coverlead" aria-label="Next, {E(p2[1])}, John {prange(p2[0])}. Opens its guide"><span class="rm cover"><span class="lbl">Next · John {prange(p2[0])}</span>'
                 f'<span class="cw lit">{E(p2[1])}</span><span class="excerpt">{E(j119)}</span></span><span class="chev">{ic("right", 18)}</span></button>'
                 f'<p class="note muted prgl">1 of {njohn} passages read</p>')
    F("ON-07", "Passage finished: the lead becomes Next", page(None, "Yada", next_lead + allp + sec("Old Testament", ot), right=HOME_ICONS), "on")
    F("ON-06", "VoiceOver: Home, first launch, order 1–7", [
        ("Light · order 1–7", "light", home_first(vo=True)),
        ("Dark · order 1–7", "dark", home_first(vo=True)),
        ("AX5 · order 1–7", "ax5", home_first(vo=True))], "on")

    # ---------- Study notes and See also ----------
    O11, O15, O31 = o_of("JHN", 1, 1), o_of("JHN", 1, 5), o_of("JHN", 3, 1)
    # With a Yada entry, Understand keeps one voice up front: its three parts, then Go further. Tyndale's note and the
    # See also list are rows there, a tap away. Six sections on one sheet was the overwhelm John asked us to avoid.
    yada_rel = {o_of(r.split(".")[0], int(r.split(".")[1]), int(r.split(".")[2])) for r in (rp["ref"] for rp in G["jhn.1.1"]["related_passages"])}
    n_see = len(yada_rel) + len([x for x in xrefs(O11) if x[0] not in yada_rel])
    n_gram = len([c for c in G["jhn.1.1"]["claims"] if c["category"] != "debated" and is_grammar(c)])
    gf_11 = go_further("Greek", JLAB, "1:1–18", O11, grammar=n_gram, study=True, see=n_see)
    body_11 = understand_simple_body("jhn.1.1")
    body_11 = body_11[body_11.index('<section class="sec"><h3 class="lbl">Where readers differ</h3>'):body_11.index('<section class="sec"><h3 class="lbl">Go further</h3>')].replace('<section class="sec">', '<section class="sec first">', 1) + gf_11
    F("SN-01", "Understand 1:1 with an entry: Study notes and See also wait in Go further", under_j + usheet("lg", "John 1:1", None, body_11, scrolled=True), "sn")
    gf_open = go_further("Greek", JLAB, "1:1–18", O11, grammar=n_gram, study=True, see=n_see, k="jhn.1.1", open_=True)
    F("SN-09", "Original Greek opens in place; its chevron turns up", under_j + usheet("lg", "John 1:1", None, gf_open.replace('<section class="sec">', '<section class="sec first">', 1), scrolled=True), "sn")
    F("SN-02", "Study notes, pushed: the whole note, then the note on 1:1–18", under_j + sheet("lg", "Study notes", "John 1:1", study_page(O11), back=True, foot=False), "sn")
    u15 = lambda pre="": study_sec(O15, first=True) + see_also(O15) + go_further("Greek", JLAB, "1:1–18", O15) if not pre else pre + go_further("Greek", JLAB, "1:1–18", O15)
    under_15 = reader("JHN", 1, 3, 9, sel=(5,), scrolled=False, rows_override=t4("JHN", 1, 3, 9)) + scrim()
    F("SN-03", "John 1:5 has no Yada entry yet: Study notes leads", under_15 + usheet("med", "John 1:5", None, u15()), "sn")
    # About 130 KB a book: it downloads by itself the first time a book is opened online, so the happy path asks for
    # nothing. Only a slow fetch, a failure or no connection says anything, in one line (UX pass, 11 Oct 2026).
    dl = lambda state: sec(None, {
        "busy": '<p class="note muted offl" role="status">Getting the study notes for John.</p>',
        "fail": ('<div class="row dlfail"><span class="rm"><span class="note muted" role="status">The study notes for John didn’t download.</span></span>'
                 '<button class="tbtn2">Try again</button></div>'),
        "off": '<p class="note muted offl">Study notes download when you’re online.</p>'}[state], first=True)
    F("SN-04", "First open of John, still fetching: one line, nothing to tap", under_15 + usheet("med", "John 1:5", None, u15(dl("busy"))), "sn")
    F("SN-05", "The download failed: one line and Try again", under_15 + usheet("med", "John 1:5", None, u15(dl("fail"))), "sn")
    F("SN-06", "Offline, not downloaded: one quiet line, no error", under_15 + usheet("med", "John 1:5", None, u15(dl("off"))), "sn")
    a, b_ = xrefs(O15)[0]
    ba, bc, bv = bcv(a)
    F("SN-07", "A See also row opens the verse, with a way back", reader(ba, bc, bv, bv + 4, back=("John 1:5", "Back to John 1:5"), sel=tuple(range(bv, bcv(b_)[2] + 1)), offset=0, abar=f"{bc}:{bv}–{bcv(b_)[2]}"), "sn")
    F("SN-08", "See also, all of them: pushed inside the sheet", under_j + sheet("lg", "See also", "John 1:1", see_also(O11, "jhn.1.1", all_=True).replace('<h3 class="lbl">See also</h3>', "", 1), back=True, foot=False), "sn")

    # ---------- People (Tyndale profiles) ----------
    # A dictionary tab was rejected (John asked, 11 Oct 2026): readers look things up at the moment of confusion, so a
    # person shows as a row on the verse that names them, and Search finds them. Definition pattern: Public 'Earnings'
    # sheet, term, plain body, source line mobbin.com/screens/93eeef7a-1110-439f-8d05-5d3bbe02747d.
    under_31 = reader("JHN", 3, 1, 6, sel=(1,), offset=0, scrolled=False) + scrim()
    F("TD-01", "John 3:1: a person named in the verse gets a row", under_31 + usheet("lg", "John 3:1", None, people(O31, first=True) + study_sec(O31) + see_also(O31) + go_further("Greek", PERI["JHN.3.1-3.21"][0], "3:1–21", O31)), "td")
    nic = dict(PROFILES)["Nicodemus"]
    nparas = note_paras(nic)
    further_i = [i for i, (k_, p) in enumerate(nparas) if k_ == "h" and "Further" in p][0]
    pbody = "".join(f'<p class="snote">{p}</p>' for k_, p in nparas[1:further_i] if k_ == "p")
    refs = []
    book_ = "John"
    for part in nparas[further_i + 1][1].replace("John ", "").split(";"):
        part = part.strip()
        c, vs = part.split(":")
        v1, v2 = (vs.split("-") + [None])[:2]
        refs.append(f"John {c}:{v1}" + (f"–{v2}" if v2 else ""))
    pbody += sec("Read about him", "".join(row(E(r_), cls="plain") for r_ in refs)) + f'<p class="note muted credit">Tyndale Open Study Notes, CC BY-SA 4.0.</p>'
    F("TD-02", "Nicodemus: the profile pushes inside the sheet; ‹ goes back", under_31 + sheet("lg", "Nicodemus", "John 3:1", pbody, back=True, foot=False), "td")
    nv = db.execute("select v.verse_id, t.text from verses v join texts t on t.ord=v.ord where t.translation='BSB' and t.text like '%Nicodemus%' order by v.ord").fetchall()
    srows = sec("People", lrow("Nicodemus", sub="Who he was · Tyndale"), first=True) + sec("Verses", "".join(
        lrow(f'<span class="excerpt2">{bold(t, "Nicodemus")}</span>', cls="passage").replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, t in nv[:4]))
    F("TD-03", "Search: a name finds the person first, then the verses", home_under + search_sheet("nicodemus", srows), "td")

    # ---------- Audio voice (Apple's speech, on the phone) ----------
    vhint = '<p class="note muted vhint">For a clearer voice: Settings&nbsp;› Accessibility&nbsp;› Spoken Content&nbsp;› Voices.</p>'
    F("AU-07", "First listen on the basic voice: one line, once", full(5, 4).replace('<div class="lyr">', vhint + '<div class="lyr">', 1), "au")

    # ---------- iCloud ----------
    F("IC-01", "Bookmarks kept in iCloud: one line says so", page(("Home", "Home"), "Bookmarks", bmrows + '<p class="note muted icl">Bookmarks and your reading place are kept in iCloud.</p>', right=EDIT), "ic")
    F("IC-02", "Not signed in to iCloud: on this iPhone only, and how to change it", page(("Home", "Home"), "Bookmarks", bmrows + '<p class="note muted icl">On this iPhone only. Sign in to iCloud in Settings to keep them.</p>', right=EDIT), "ic")

    GUIDE_NOTES["refs_on"] = (
        "A clear way to start · decisions\n\n"
        "No onboarding screens. Home is the start: one lead, 'Start here · The Gospel of John', above the books (ON-01). "
        "A first-launch question was drafted and dropped: it put a screen between the reader and the Bible, and asked a newcomer to choose before they knew the choices.\n\n"
        "The path: Start here → John 1:1–18's guide (ON-02) → × lands on the text with the one-time hint (ON-03) → the guide ends on the next passage (ON-04). "
        "A passage counts as read when the reader reaches that Next row; nothing announces it.\n\n"
        "Home has one lead at a time: Continue while a passage is open (ON-05), Next once it is finished (ON-07). The earlier Home showed Continue and a Next row together: two calls to action for one reader.\n\n"
        "References: Deepstash 'Let's start with your first read' mobbin.com/screens/ae4112fa-00aa-4415-ab8f-7d1ec5c49692 · "
        "Apple Books Continue first mobbin.com/screens/38f5b90d-0d5b-467f-9e2d-7155ba17a3ea. "
        "Rejected: Fable 'How do you want to get started?' mobbin.com/screens/08bb1ff7-9130-4c7e-91ce-68152c1005d5 and every goals or interests picker.\n\n"
        "WCAG and COGA: the lead's label names where it goes (2.4.4); VoiceOver order follows the eye, header to lead to books (1.3.2, ON-06); "
        "no time limits, nothing moves on its own (2.2.1); the hint shows once and never blocks; plain words, one main action per screen (W3C COGA objective 3).")
    GUIDE_NOTES["refs_sn"] = (
        "Open study notes · decisions\n\n"
        "With a Yada entry, Understand keeps one voice up front: What's happening, What we can see, Where readers differ, then Go further, where Study notes and See also are rows (SN-01). "
        "Six sections on one sheet was too much. With no entry, Study notes leads, then See also (SN-03), so no verse is empty and every verse's bar offers Understand (SN-07).\n\n"
        "One gesture for more: the whole note, the full See also list and a profile each push a page inside the sheet, ‹ back (SN-02, SN-08, TD-02). Nothing grows in place.\n\n"
        "Shown as published: only markup changes; the leading '1:1' goes because the header names the verse. A note that opens on Tyndale's lemma marks it (NLT) where it stands, "
        "because the BSB beside it says something else ('overcome', not 'extinguish'). Never in any AI call (rule 9).\n\n"
        "See also is one list: Yada's related passages first, each saying why; OpenBible's follow, each showing the verse. Votes rank them and are never shown.\n\n"
        "Downloads ask nothing: about 130 KB for John (measured from the study bundle), fetched the first time the book opens online. "
        "Only a slow fetch (SN-04), a failure with Try again (SN-05) or no connection (SN-06) says anything, in one line.\n\n"
        "References: Public's term sheet with a source line mobbin.com/screens/93eeef7a-1110-439f-8d05-5d3bbe02747d · "
        "Matter notebook, prose with a quiet source mobbin.com/screens/a855cd68-c4dd-4433-a830-90f54e903ae2.")
    GUIDE_NOTES["refs_td"] = (
        "People · decisions\n\n"
        "No dictionary tab. A person named in the verse gets a row above Study notes, since who someone is comes before what a note says about them (TD-01); the profile pushes inside the same sheet, so there are never more than two sheets (TD-02). "
        "Rows, not inline links: a whole row is a 44 pt target VoiceOver reaches as one stop; a name inside a paragraph is neither.\n\n"
        "Today's data: Tyndale's 124 profiles and theme articles. A Bible dictionary (places, terms like 'Pharisee') needs its own licensed source; Theographic is CC BY-SA and waits on John. "
        "Search finds a person before the verses that name them (TD-03).")
    GUIDE_NOTES["refs_ic"] = (
        "iCloud and voice · decisions\n\n"
        "iCloud needs no switch and no screen: bookmarks, reading place, Start here progress and text settings sync through the user's own iCloud. "
        "One line on Bookmarks says so (IC-01); signed out, the line says where they are and how to change it (IC-02). On a second device, Home's Continue already shows the place read on the first.\n\n"
        "Voice (AU-07): Apple's on-device speech, free and offline, with word timings for the ink pill. The basic voice sounds flat; the one line shows on the first listen only, and names the exact Settings path, since iOS can't open that page from an app.")
# ---------- write files + index ----------
W, H, GX, GY = 1430, 1026, 80, 120
names, boards = [], {}
y = 0
notes = {}
GROUPS = (("j01", "Journey 01 · 1 Corinthians 14"), ("jn", "John 1:1"), ("gn", "Genesis 1:1")) + ((("dl", "Delight"), ("hs", "Home, Search, Contents"), ("ss", "Settings and saved"), ("es", "Edge states"), ("so", "Sources"), ("dp", "Depth"), ("sp", "Splash"), ("uv", "Simpler Understand (variant)"), ("mt", "More translations")) if STYLE != "v1" else ())
# Passage guide and audio live on their own canvas page ("guide"), laid out from y = 0 there.
if STYLE != "v1":
    GROUPS += (("pg", "Passage guide"), ("au", "Audio read-along"), ("ia", "App-wide IA after the passage shift"), ("on", "A clear way to start"), ("sn", "Open study notes and See also"), ("td", "People"), ("ic", "iCloud"))
PAGE_OF = {"pg": "guide", "au": "guide", "ia": "guide", "on": "guide", "sn": "guide", "td": "guide", "ic": "guide"}
ys = {}
for gi, (grp, label) in enumerate(GROUPS):
    pg = PAGE_OF.get(grp, STYLE)
    y = ys.get(pg, 0)
    fr = [f for f in FRAMES if f[3] == grp]
    notes[f"t_{grp}" + ("" if STYLE == "v1" else f"_{pg}")] = {"x": 0, "y": y, "text": label, "kind": "title1", "maxW": 4 * W + 3 * GX, **({"page": pg} if pg != STYLE else {})}
    if grp in ("pg", "au", "ia", "on", "sn", "td", "ic"):
        for j, key in enumerate([k for k in GUIDE_NOTES if k.endswith(grp)]):
            notes[key] = {"x": 4 * (W + GX), "y": y + 260 + j * 1180, "w": 560, "maxH": 1120, "size": "m", "page": pg, "fill": "gray", "text": GUIDE_NOTES[key]}
    y += 260
    for i, (fid, title, inner, _) in enumerate(fr):
        name = ("Main.dc.html" if fid == "J01-01" else f"{fid}.dc.html") if STYLE == "v1" else (f"{fid}.dc.html" if pg != STYLE else f"{fid}-{STYLE}.dc.html")
        open(f"{OUT}/{name}", "w").write(doc(fid, title, inner))
        boards[name] = {"x": (i % 4) * (W + GX), "y": y + (i // 4) * (H + GY), "w": W, "h": H, "title": f"{fid} · {title}", **({"page": pg} if pg != STYLE else {})}
        names.append(name)
    y += ((len(fr) + 3) // 4) * (H + GY) + 200
    ys[pg] = y

if STYLE != "v1":
    # A restyle lands on its own canvas page; merge this fragment into the live index before publishing.
    for b in boards.values():
        b.setdefault("page", STYLE)
    for n in notes.values():
        n.setdefault("page", STYLE)
    json.dump({"boards": boards, "order": names, "notes": notes}, open(f"{OUT}/canvas.{STYLE}.json", "w"), ensure_ascii=False, indent=1)
    gb = {k: v for k, v in boards.items() if v["page"] == "guide"}
    json.dump({"boards": gb, "order": [n for n in names if n in gb], "notes": {k: v for k, v in notes.items() if v["page"] == "guide"}},
              open(f"{OUT}/canvas.guide.json", "w"), ensure_ascii=False, indent=1)
    print(len(names), "boards"); sys.exit()
idx = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
       "title": "Yada Redesign", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": names, "notes": notes, "designSystems": []}
json.dump(idx, open(f"{OUT}/canvas.json", "w"), ensure_ascii=False, indent=1)
print(len(names), "boards")
for n in names:
    print(n, os.path.getsize(f"{OUT}/{n}"))
