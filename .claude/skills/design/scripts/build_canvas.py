import json, re, sqlite3, html, os, sys, datetime

Y = os.environ.get("YADA_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))
STYLE = sys.argv[2] if len(sys.argv) > 2 else "v1"  # v1 = brief tokens as written; v2 = the modern restyle
OUT = os.path.join(sys.argv[1] if len(sys.argv) > 1 else "canvas", "project")
os.makedirs(OUT, exist_ok=True)
db = sqlite3.connect(f"{Y}/content/bundles/core.v2.db")
G = {k: json.load(open(f"{Y}/golden/{k}.json")) for k in ["1co.14.34", "jhn.1.1", "gen.1.1", "psa.23.1"]}

BOOK = {"1CO": "1 Corinthians", "1TI": "1 Timothy", "JHN": "John", "GEN": "Genesis", "PSA": "Psalm", "ISA": "Isaiah", "JOB": "Job", "REV": "Revelation"}
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
    src = "STEPBible"
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
        src = "STEPBible"
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


def keep_together(html_):
    def fix(m):
        t_ = m.group(1)
        # The dot stays with the word before it, so a line never starts with "·"; it may end one, as a comma does.
        t_ = t_.replace(" · ", "\u00a0· ")
        t_ = re.sub(r"(\d)–(\d)", "\\1\u2060–\u2060\\2", t_)
        t_ = re.sub(r"(\d+):(\d+)", "\\1:\u2060\\2", t_)
        t_ = t_.replace("CC BY-SA", "CC\u00a0BY\u2011SA")
        t_ = re.sub(r"(?<=[A-Za-z])'(?=[a-z])", "’", t_)
        t_ = re.sub(r"(\d) (more|times|verses|words|chapters)\b", "\\1\u00a0\\2", t_)
        t_ = re.sub(r"(\d+:\d+)-(\d+)", "\\1–\\2", t_)
        t_ = re.sub(r"\b([1-3]) ([A-Z][a-z]+)", "\\1\u00a0\\2", t_)
        return ">" + t_ + "<"
    return re.sub(r">([^<>]+)<", fix, html_)


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
        for lab, cls, html_ in [(l_, c_, keep_together(h_)) for l_, c_, h_ in steps])
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
    HOME_ICONS = glass_btn("search", "Search") + glass_btn("bookmark", "Bookmarks") + glass_btn("more", "More: Recent, Reading plans, Settings")

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
        # The scratch copy goes when its session's tmp is cleared; content/raw keeps the same eBible file.
        path = f"{TRD}/{fileid}.txt"
        if not os.path.exists(path):
            path = os.path.join(os.environ.get("YADA_ROOT", ""), "content", "raw", f"{fileid}_vpl.txt")
        for line in open(path, encoding="utf8"):
            m = re.match(r"^(\S+) (\d+):(\d+) (.*)$", line.strip())
            if m and m.group(1) == book and int(m.group(2)) == ch and a <= int(m.group(3)) <= b:
                out.append((int(m.group(3)), m.group(4)))
        return out
    # Translation covers: a small book in one of five brand tones. Tone is identity, never state
    # (current = tick + semibold); fixed per translation so a reader learns them.
    COVER = {"BSB": "forest", "WEB": "paper", "KJV": "ink", "LSV": "lime", "ASV": "sage", "YLT": "paper",
             "DBY": "forest", "GNV": "ink", "MSB": "lime", "NIV": "sage", "NKJV": "forest", "NLT": "paper", "MSG": "sage"}
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
    # IA v3 (IA-14): Home's one plan line, the same on every frame that draws Home (second slop pass).
    allp = (f'<button class="lrow valrow" aria-label="Your plan, The Gospel of John. Opens the plan">'
            f'<span class="rm"><span class="lmain">The Gospel of John</span><span class="note muted lsub">Your plan</span></span>'
            f'<span class="chev">{ic("right", 18)}</span></button>')
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
# ================= Next release (v2, "next" page): handoff 12 Oct 2026, scope items 1–9 =================
# Drawn before building (CLAUDE.md §Design). Real data only: BSB/KJV and tokens from core.v5, passages from jhn.v3,
# Tyndale profiles and intro summaries from the study bundles. Where the data does not exist yet (guide payloads,
# recordings, TIPNR, Aquifer, UST, licensed text) the frame shows a labelled placeholder, never invented copy.
if STYLE != "v1":
    db5 = sqlite3.connect(f"{Y}/content/bundles/core.v5.db")
    NEXT_NOTES = {}

    def t5(book, ch, a, b=None, tr="BSB"):
        # The LSV wraps a disputed passage in [[ ]] (John 5:4): markup, never shown; the frame's own note says why.
        return [(v_, t_.replace("[[", "").replace("]]", "")) for v_, t_ in _t5(book, ch, a, b, tr)]

    def _t5(book, ch, a, b=None, tr="BSB"):
        return db5.execute("select v.verse, t.text from verses v join texts t on t.ord=v.ord where v.book=? and v.chapter=? and v.verse between ? and ? and t.translation=? order by v.ord", (book, ch, a, b or a, tr)).fetchall()

    def o5(b, c, v):
        return db5.execute("select ord from verses where book=? and chapter=? and verse=?", (b, c, v)).fetchone()[0]

    def study_db(code):
        return sqlite3.connect(f"{Y}/content/bundles/study-{code.lower()}.v1.db")

    def study_opt(o):
        # A verse with no Tyndale note shows no Study notes section, rather than an empty one.
        return study_sec(o) if notes_for(o)[0] else ""

    def todo_src(what):
        return f'<span class="todoi">{E(what)}</span>'

    def todo_inline(what):
        return f'<span class="todoi">{E(what)}: from the Berean audio manifest</span>'

    JP = sqlite3.connect(f"{Y}/content/bundles/jhn.v3.db").execute("select pericope_id, label from pericopes order by start_ord").fetchall()
    NJ = len(JP)

    def placeholder_text(what):
        # Licensed or not-yet-ingested text is never reproduced on the canvas: a labelled block stands in its place.
        return f'<p class="todo ptext">{E(what)}</p>'

    def missing_line(ch, v):
        # A verse the oldest manuscripts lack keeps its place in the count, as one quiet line that opens the note.
        # Plain words, no sigla (roadmap v2); a real button so VoiceOver reaches it between verses 3 and 5.
        return (f'<button class="msl" aria-label="Verse {v} is not in the oldest manuscripts. Opens a note">'
                f'<span class="vn">{v}</span><span>Not in the oldest manuscripts</span>{ic("right", 14)}</button>')

    def verses_gap(book, ch, a, b, sel=()):
        rows = t5(book, ch, a, b)
        out, chunk = "", []
        for n, t in rows:
            if t.strip():
                chunk.append((n, t))
            else:
                out += verses_html(chunk, sel=sel, ch=ch, book=book) + missing_line(ch, n)
                chunk = []
        return out + verses_html(chunk, sel=sel, ch=ch, book=book)

    def rd(book, ch, body, back=("Home", "Home"), tr="BSB", bar="", mini_=False):
        return header(back, f"{BOOK[book]} {ch} · {tr}") + f'<div class="rbody"><div style="margin-top: 0px">{body}</div></div>' + bar

    # ---------- 1 · John's guides, all 46 ----------
    def st_list(start, nxt, done):
        out = ""
        for i, (pid, lab) in enumerate(JP[start:start + 8], start):
            rng = prange(pid)
            if i == nxt:
                out += (f'<button class="lrow numrow nx" aria-label="Next, passage {i + 1}, {E(lab)}, John {rng}. Opens the passage guide">'
                        f'<span class="rm"><span class="nxo">Next · {rng}</span>'
                        f'<span class="lmain"><span class="num nxn">{i + 1}</span><span class="nt">{E(lab)}</span></span>'
                        f'<span class="lsub orlw">{todo("Orientation from this passage’s guide")}</span></span>'
                        f'<span class="chev nxc">{ic("right", 18)}</span></button>')
            elif i < done:
                out += lrow(f'<span class="num">{i + 1}</span><span class="nt">{E(lab)}</span>', sub=rng,
                            right=f'<span class="ck" aria-label="read">{ic("check", 20)}</span>', chev=False, cls="numrow done")
            else:
                out += lrow(f'<span class="num">{i + 1}</span><span class="nt">{E(lab)}</span>', sub=rng, chev=False, cls="numrow")
        return out
    p5 = [p for p in JP if p[0] == "JHN.5.1-5.15"][0]
    i5 = JP.index(p5)
    F("GD-01", "Start here, every passage guided: Next is passage 10", pg_header(("Home", "Home")) +
      f'<div class="pg"><h1 class="ltitle">The Gospel of John</h1><p class="note muted pgsub">9 of {NJ} passages read</p>{st_list(i5 - 2, i5, i5)}</div>', "gd")

    def g5(start="top"):
        parts = []
        if start == "top":
            parts.append(sec("Where we are", todo("Where we are · 25 words at most"), first=True))
            parts.append(sec("Three things to notice", todo("Three claims, each naming its verse")))
            parts.append(sec("Where readers differ", todo("Only where readers really differ; may be empty")))
        parts.append(f'<section class="sec gtext{" first" if start != "top" else ""}"><h3 class="lbl">The passage</h3>{verses_gap("JHN", 5, 1, 9)}</section>')
        return "".join(parts)
    under5 = reader("JHN", 5, 1, 6, scrolled=False, rows_override=[r for r in t5("JHN", 5, 1, 6) if r[1].strip()]) + scrim()
    F("GD-02", "Guide for John 5:1–15, medium: the same four parts", under5 + guide("med", p5[1], "John 5:1–15", g5()), "gd")
    F("GD-03", "The guide’s passage keeps the verse-4 line", under5 + guide("lg", p5[1], "John 5:1–15", g5("text"), scrolled=True), "gd")
    mk_rest = (f'<div class="abar rest"><div class="d rest-row"><button class="ab-i lone" aria-label="Listen to Mark 1">{ic("play", 18)}<span>Listen</span></button></div>'
               f'<div class="a abar-list"><button class="ab-i">Listen{ic("play", 30)}</button></div></div>')
    F("GD-04", "A book with no guides yet: no passage link, Listen alone", reader("MRK", 1, 1, 8, scrolled=False, rows_override=t5("MRK", 1, 1, 8)) + mk_rest, "gd")

    # ---------- 2 · Human-read BSB audio ----------
    def voice_btn(label):
        return f'<button class="vsel" aria-label="Voice: {E(label)}. Changes the voice">{E(label)}{ic("down", 12)}</button>'

    def full_rec(cur=5, wi=4, label="Recorded", line=None):
        h = full(cur, wi)
        h = h.replace('<span class="ssub">John 1 · BSB</span>', f'<span class="ssub">John 1 · BSB · {voice_btn(label)}</span>', 1)
        if line:
            h = h.replace('<div class="lyr">', f'<p class="note muted vhint" role="status">{E(line)}</p><div class="lyr">', 1)
        return h
    F("BA-01", "Full player, recorded reading: the voice is named under the title", full_rec(), "ba")

    def pring(p, size=30):
        return (f'<span class="pring" role="progressbar" aria-valuenow="{p}" aria-label="{p} percent">'
                f'<svg viewBox="0 0 36 36" width="{size}" height="{size}"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--div)" stroke-width="3"></circle>'
                f'<circle cx="18" cy="18" r="15" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-dasharray="{p * 0.942:.1f} 100" transform="rotate(-90 18 18)"></circle>'
                f'<rect x="13" y="13" width="10" height="10" rx="2" fill="var(--ink)"></rect></svg></span>')
    getting = (f'<div class="mp" role="region" aria-label="Audio player"><div class="mp-row">'
               f'<button class="mp-lab" aria-label="Getting the recording of John 1. Opens the player"><span class="mp-t">{E(JLAB)}</span>'
               f'<span class="note muted" role="status">Getting the recording</span></button>'
               f'<div class="mp-ctl"><button class="mpb" aria-label="Stop, 40 percent">{pring(40)}</button></div></div></div>')
    F("BA-02", "First play of a chapter: it downloads, then plays; one line, a stop", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows) + getting, "ba")

    def vrow(name, sub, on=False, right=None):
        r = right if right is not None else (f'<span class="ck">{ic("check", 22)}</span>' if on else "")
        return (f'<div class="lrow opt{" on" if on else ""}" role="radio" aria-checked="{"true" if on else "false"}" aria-label="{E(name)}. {E(re.sub("<[^>]+>", "", sub))}">'
                f'<span class="rm"><span class="lmain">{E(name)}</span><span class="note muted lsub">{sub}</span></span><span class="lright">{r}</span></div>')
    DLG = f'<button class="trbtn" aria-label="Download John">{ic("download", 22)}</button>'
    MOREB = f'<button class="trbtn" aria-label="More: Remove download">{ic("more", 22)}</button>'

    def voice_sheet(book_state="none", tr="BSB"):
        if tr != "BSB":
            body = sec(None, vrow("iPhone voice", "Works offline", on=True), first=True) + '<p class="note muted offl">Only the BSB has a recorded reading.</p>'
            return sheet("med", "Voice", f"John 1 · {tr}", body, foot=False)
        body = sec(None, vrow("Recorded reading", "Berean Bible audio · " + todo_src("narrator"), on=True)
                   + vrow("iPhone voice", "Works offline"), first=True)
        # Sizes come from each chapter's manifest entry (plan additions §D: John about 30–45 MB at 32–48 kbps);
        # the canvas marks the value as the manifest's, never a guessed number.
        sz = todo_src("size from the manifest")
        dl = {"none": vrow("Download John", f"21 chapters · {sz}", right=DLG),
              "busy": vrow("Downloading John", "6 of 21 chapters", right=f'<button class="trbtn" aria-label="Stop downloading, 6 of 21 chapters">{pring(29)}</button>'),
              "done": vrow("John is downloaded", f"21 chapters · {sz}", right=MOREB),
              "space": vrow("Download John", f"21 chapters · {sz}", right=DLG) + '<p class="note muted offl" role="status">Not enough space on this iPhone to download John.</p>'}[book_state]
        return sheet("med", "Voice", "John 1 · BSB", body + sec("Download", dl), foot=False)

    F("BA-03", "Voice: recorded or iPhone; download the whole book", full_rec() + scrim() + voice_sheet(), "ba")
    F("BA-04", "Downloading John, then done: Remove sits under ⋯", [
        ("Light · 6 of 21 chapters", "light", full_rec() + scrim() + voice_sheet("busy")),
        ("Dark · downloaded", "dark", full_rec() + scrim() + voice_sheet("done")),
        ("AX5 · 6 of 21 chapters", "ax5", full_rec() + scrim() + voice_sheet("busy"))], "ba")
    # Above the row that opened it, so "John is downloaded" stays readable (slop pass).
    rm_menu = ('<div class="menu rmmenu" role="menu" style="right:24px">'
               f'<button role="menuitem"><span>Remove John’s audio</span>{ic("x", 20)}</button></div>')
    F("BA-07", "⋯ on a downloaded book: one action, Remove", full_rec() + scrim() + voice_sheet("done") + '<div class="menuscrim"></div>' + rm_menu, "ba")
    F("BA-08", "Not enough space: one line, the button stays", full_rec() + scrim() + voice_sheet("space"), "ba")
    F("BA-05", "Offline, chapter not saved: the iPhone voice reads, one line says why", full_rec(label="iPhone voice", line="You’re offline."), "ba")
    F("BA-06", "Reading the WEB: one voice, so the voice line says so and opens nothing", full_rec().replace("John 1 · BSB · ", "John 1 · WEB · ").replace(voice_btn("Recorded"), '<span>iPhone voice</span>'), "ba")

    # ---------- 3 · Swipe between chapters ----------
    j2 = t5("JHN", 2, 1, 6)
    pane_cur = reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows)
    pane_next = reader("JHN", 2, 1, 6, scrolled=False, rows_override=j2)

    def swipe(dx, rm=False, back=False):
        if rm:
            return f'<div class="pane" style="opacity:.45">{pane_cur}</div><div class="pane" style="opacity:.55">{pane_next}</div>'
        if back:
            return f'<div class="pane" style="transform:translateX(-{dx}%)">{pane_cur}</div><div class="pane edge" style="transform:translateX({100 - dx}%)">{pane_next}</div>'
        return f'<div class="pane" style="transform:translateX(-{dx}%)">{pane_cur}</div><div class="pane edge" style="transform:translateX({100 - dx}%)">{pane_next}</div>'
    F("SW-01", "Swiping: John 2 peeks in from the right", swipe(42), "sw")
    F("SW-02", "Motion: past a third it goes on; short of it, it springs back", [
        ("1 · Drag 42%: past the line, John 2 follows", "light", swipe(42)),
        ("2 · Released: settles on John 2 (spring, 0.35 s)", "light", pane_next),
        ("3 · A short drag of 18% springs back to John 1", "light", swipe(18))], "sw")
    end_pane = (header(("Home", "Home"), "John 21 · BSB") +
                f'<div class="endpg"><p class="endk">End of John</p><p class="endt">21 chapters</p>'
                f'<button class="clink endl" aria-label="Go on to Acts 1">Acts 1{ic("right", 18)}</button></div>')
    j21 = reader("JHN", 21, 20, 25, scrolled=False, rows_override=t5("JHN", 21, 20, 25))
    F("SW-03", "End of a book: the swipe stops on a page with a link, never into Acts", f'<div class="pane" style="transform:translateX(-64%)">{j21}</div><div class="pane edge" style="transform:translateX(36%)">{end_pane}</div>', "sw")
    vo_actions = ('<div class="vorot" aria-hidden="true"><p class="vort">Actions</p><p class="vori on">Next chapter, John 2</p><p class="vori">Previous chapter, Luke 24</p><p class="vori">Contents</p></div>')
    F("SW-04", "When swiping is off, and the other ways to turn the page", [
        ("Light · a verse is selected: swipe is off", "light", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows, sel=(4,)) + sel_bar("1:4")),
        ("Dark · Reduce Motion: a 200 ms cross-fade", "dark", swipe(0, rm=True)),
        ("AX5 · VoiceOver: swipe up or down for Actions", "ax5", pane_cur + vo_actions)], "sw")

    # ---------- 4 · Home Screen widget and Live Activity ----------
    yicon = (f'<span class="appic yic" aria-hidden="true"><svg viewBox="0 0 256 256"><path d="{SYM_D}" fill="#DBEC9A"></path></svg></span>')
    def apps(n, yada_at=None):
        return "".join((f'<span class="app">{yicon}<span class="apl">Yada</span></span>' if i == yada_at else
                        '<span class="app"><span class="appic"></span><span class="apl">App</span></span>') for i in range(n))
    p231 = t5("PSA", 23, 1)[0][1]
    j139w = t5("JHN", 1, 39)[0][1]

    def w_small(ref, txt, lab="Continue"):
        return (f'<button class="wg sm" aria-label="{lab}, {ref}. {E(txt)}. Opens Yada at {ref}"><span class="wgl">{lab}</span>'
                f'<span class="wgr">{ref}</span><span class="wgt">{E(txt)}</span></button>')

    def w_med(ref, txt, lab):
        return (f'<button class="wg md" aria-label="{lab}. {ref}. {E(txt)}"><span class="wgl">{lab}</span>'
                f'<span class="wgq">{scripture(txt)}</span><span class="wgr">{ref} · BSB</span></button>')
    homescreen = lambda: (f'<div class="hscr"><div class="sbar"><span>9:41</span></div>'
                          f'<div class="wgrid">{w_small("John 1:39", j139w)}<div class="apps4">{apps(4, 3)}</div></div>'
                          f'{w_med("Psalm 23:1", p231, "A passage for today")}<div class="apps4 row4">{apps(4)}</div></div>')
    F("WL-01", "Home Screen: Continue (small) and a passage for today (medium)", homescreen(), "wl")

    def live(cur=5, compact=False):
        return (f'<div class="la" role="group" aria-label="Yada, listening. {E(JLAB)}, John 1:{cur}">'
                f'<div class="la-top">{yicon}<span class="la-t"><span class="la-h">{E(JLAB)}</span><span class="la-s">John 1:{cur} · BSB</span></span></div>'
                f'<div class="la-prog"><span style="width:{cur / 51 * 100:.0f}%"></span></div>'
                f'<div class="la-ctl"><button class="lab" aria-label="Previous verse">{ic("prevv", 26)}</button><button class="lab" aria-label="Pause">{ic("pause", 28)}</button>'
                f'<button class="lab" aria-label="Next verse">{ic("nextv", 26)}</button></div></div>')
    lock = lambda: (f'<div class="lscr"><p class="lsd">Monday 12 October</p><p class="lst">9:41</p>{live()}</div>')
    F("WL-02", "Lock Screen while listening: where you are, three controls", lock(), "wl")
    di = (f'<div class="dyn"><span class="dyl">{ic("play", 14)}</span><span class="dyr">1:5</span></div>')
    di_x = (f'<div class="dynx" role="group" aria-label="Yada, listening">{live()}</div>')
    F("WL-03", "Dynamic Island: verse number compact; the same three controls expanded", [
        ("Light · compact, reading on", "light", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows).replace('<div class="hdr', di + '<div class="hdr', 1)),
        ("Dark · expanded (long press)", "dark", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows) + di_x),
        ("AX5 · expanded", "ax5", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows) + di_x)], "wl")
    F("WL-04", "Reading the NKJV: the widget keeps the place and shows the BSB", (f'<div class="hscr"><div class="sbar"><span>9:41</span></div>'
      f'<div class="wgrid">{w_small("John 1:39", j139w)}<div class="apps4">{apps(4, 3)}</div></div>'
      f'<p class="wbt wgnote">Canvas note: you are reading the NKJV in the app. Widgets show only public-domain text (handoff, 12 Oct).</p></div>'), "wl")

    # ---------- 5 · Reading plans with no dates ----------
    MCH1 = [("Genesis", 1), ("Matthew", 1), ("Ezra", 1), ("Acts", 1)]
    MCH2 = [("Genesis", 2), ("Matthew", 2), ("Ezra", 2), ("Acts", 2)]
    plans = (lrow('<span class="nt">The Gospel of John</span>', sub=f"Passage by passage, explained · 9 of {NJ} read")
             + lrow('<span class="nt">M’Cheyne</span>', sub="The whole Bible, four chapters at a sitting · 1842"))
    F("RP-01", "Reading plans: two, each saying what it is", page(("Home", "Home"), "Reading plans", plans), "rp")

    def mch_rows(rs, done=0):
        out = ""
        for i, (bk, c) in enumerate(rs):
            if i < done:
                out += lrow(f"{bk} {c}", right=f'<span class="ck" aria-label="read">{ic("check", 20)}</span>', chev=False, cls="done")
            elif i == done:
                out += (f'<button class="lrow nx" aria-label="Next, {bk} {c}"><span class="rm"><span class="nxo nxo0">Next</span>'
                        f'<span class="lmain nt">{bk} {c}</span></span><span class="chev">{ic("right", 18)}</span></button>')
            else:
                out += lrow(f"{bk} {c}", chev=False)
        return out
    F("RP-02", "M’Cheyne, not started: reading 1 of 365, no dates", page(("Plans", "Reading plans"), "M’Cheyne",
      sec("Reading 1 of 365", mch_rows(MCH1), first=True) + '<p class="note muted">No dates. It waits where you stop.</p>'), "rp")
    F("RP-03", "Back after a gap: it picks up at the next chapter, nothing to catch up", page(("Plans", "Reading plans"), "M’Cheyne",
      sec("Reading 2 of 365", mch_rows(MCH2, done=1), first=True) + sec("Read", lrow("Reading 1", sub="Genesis 1 · Matthew 1 · Ezra 1 · Acts 1", chev=False))), "rp")
    g2end = reader("GEN", 2, 20, 25, scrolled=False, rows_override=t5("GEN", 2, 20, 25), foot=("Genesis 1", "Genesis 3"))
    g2end = g2end.replace('<div class="cfoot">', f'<div class="cfoot"><button class="lead pnext" aria-label="Next in M’Cheyne, Matthew 2"><span class="rm"><span class="lbl">Next in M’Cheyne</span><span class="leadt">Matthew 2</span></span><span class="chev">{ic("right", 18)}</span></button>', 1)
    F("RP-04", "End of a plan chapter: the next reading leads, the next chapter stays", g2end, "rp")

    # ---------- 6 · People and places, dictionary, manuscripts ----------
    O111 = o5("JHN", 11, 1)
    j11 = t5("JHN", 11, 1, 6)
    under111 = reader("JHN", 11, 1, 6, sel=(1,), scrolled=False, rows_override=j11) + scrim()

    def ppl_line(items):
        # One line, read in the verse's order; each name is its own 44 pt target. At AX sizes it becomes rows.
        d = '<p class="ppl d">' + '<span class="pps"> · </span>'.join(f'<button class="ppn" aria-label="{E(n)}, {k}">{E(n)}</button>' for n, k in items) + "</p>"
        a = '<div class="a">' + "".join(row(E(n), extra=f'<span class="note muted">{k.capitalize()}</span>') for n, k in items) + "</div>"
        return d + a
    PPL11 = [("Lazarus", "person"), ("Bethany", "place"), ("Mary", "person"), ("Martha", "person")]
    sl = study_db("LUK")
    mml = sl.execute("select title, text from notes where kind='profile' and title='Martha, Mary, and Lazarus'").fetchone()
    prof_row = lambda title, aria: row(E(title), extra='<span class="note muted">Tyndale profile</span>', aria=aria)
    u111 = (sec("People and places", ppl_line(PPL11) + '<p class="note muted credit">' + todo_src("STEPBible TIPNR") + '</p>', first=True)
            + sec("Profiles", prof_row(mml[0], f"{mml[0]}. Tyndale profile"))
            + study_opt(O111) + go_further("Greek", "Raising Lazarus", "11:1–44", O111))
    F("PD-01", "John 11:1: people and places in one line, in the verse’s order", under111 + usheet("lg", "John 11:1", None, u111), "pd")

    beth = [(r, t) for r, t in db5.execute("select v.verse_id, t.text from verses v join texts t on t.ord=v.ord where t.translation='BSB' and v.book='JHN' and t.text like '%Bethany%' order by v.ord")]
    beth_near = [(r, t) for r, t in beth if r != "JHN.1.28"]

    def mapsvg(focus="Bethany", big=False):
        # Hand-drawn for the canvas only: positions are approximate. The build draws Natural Earth (public domain)
        # outlines and OpenBible coordinates in these same tokens.
        lab = lambda x, y, t, cls="": f'<text x="{x}" y="{y}" class="mlab {cls}">{t}</text>'
        dots = (f'<circle cx="214" cy="196" r="4.5" class="mdot"></circle><text x="204" y="214" class="mlab" text-anchor="end">Jerusalem</text>'
                f'<circle cx="228" cy="198" r="7" class="mfoc"></circle><circle cx="228" cy="198" r="3" class="mdot"></circle>{lab(240, 186, "Bethany", "foc")}')
        return (f'<svg class="map{" big" if big else ""}" viewBox="0 0 360 300" role="img" aria-label="Map: Bethany, east of Jerusalem, near the Mount of Olives">'
                f'<rect width="360" height="300" class="mland"></rect>'
                f'<path d="M0 0 H120 C112 60 100 120 82 170 C70 210 60 250 52 300 H0 Z" class="msea"></path>'
                f'<path d="M262 40 C276 34 290 44 288 62 C286 78 270 84 262 72 C256 62 256 48 262 40 Z" class="msea"></path>'
                f'<path d="M276 82 C272 120 280 150 270 190" class="mriv"></path>'
                f'<path d="M262 196 C276 190 288 200 286 230 C284 262 272 280 262 270 C252 258 254 220 262 196 Z" class="msea"></path>'
                f'{lab(18, 140, "Great Sea", "sea")}{lab(292, 132, "Jordan", "sea")}{lab(292, 250, "Salt Sea", "sea")}{dots}</svg>')
    place_body = (mapsvg() + sec(None, todo("What the place is: TIPNR structured fields (type, region), never its AI-adapted description")
                  + '<p class="note muted">' + todo_src("Location: OpenBible.info, with its confidence") + '</p>', first=True)
                  + sec("In John", "".join(row(E(fref(r)), extra=f'<span class="note muted xt">{E(t)}</span>') for r, t in beth_near))
                  + '<p class="note muted">Another Bethany, “beyond the Jordan”, is in John 1:28.</p>')
    F("PD-02", "Bethany: a place pushes inside the sheet, map first", under111 + sheet("lg", "Bethany", "John 11:1", place_body, back=True, foot=False), "pd")

    O31b = o5("JHN", 3, 1)
    phar_john = db5.execute("select count(*) from texts t join verses v on v.ord=t.ord where t.translation='BSB' and v.book='JHN' and t.text like '%Pharisee%'").fetchone()[0]
    phar_all = db5.execute("select count(*) from texts t join verses v on v.ord=t.ord where t.translation='BSB' and t.text like '%Pharisee%'").fetchone()[0]
    under31 = reader("JHN", 3, 1, 6, sel=(1,), scrolled=False, rows_override=t5("JHN", 3, 1, 6)) + scrim()
    dict_body = (sec(None, todo("Definition from the Aquifer Open Bible Dictionary, shown as published") , first=True)
                 + sec(None, row(f"In John · {phar_john} verses", cls="plain") + f'<p class="note muted cnt">{phar_all} verses in the Bible (BSB)</p>')
                 + '<p class="note muted credit">Aquifer Open Bible Dictionary, CC BY-SA 4.0</p>')
    F("PD-03", "A term from the verse: Pharisees, pushed like a profile", under31 + sheet("lg", "Pharisees", "John 3:1", dict_body, back=True, foot=False), "pd")
    nv3 = db5.execute("select v.verse_id, t.text from verses v join texts t on t.ord=v.ord where t.translation='BSB' and t.text like '%Pharisee%' order by v.ord limit 3").fetchall()
    srd = (sec("Dictionary", lrow("Pharisees", sub="Aquifer Open Bible Dictionary"), first=True)
           + sec(f"Verses · {phar_all}", "".join(lrow(f'<span class="excerpt2">{bold(t, "Pharisee")}</span>', cls="passage").replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, t in nv3)))
    F("PD-04", "Search: a term finds its dictionary entry first", home_under + search_sheet("pharisee", srd), "pd")
    F("PD-05", "John 5: verse 4 keeps its place as one line", rd("JHN", 5, verses_gap("JHN", 5, 1, 7)), "pd")
    kjv54 = t5("JHN", 5, 4, tr="KJV")[0][1]
    ms_body = (sec(None, '<p class="expl">The oldest Greek manuscripts of John don’t have this verse, so modern translations leave it out. Later manuscripts add it, and the King James Version has it:</p>'
                   + f'<p class="kq">{E(kjv54)}</p><p class="note muted">KJV, 1769</p>', first=True)
               )
    F("PD-06", "The note: plain words, the verse the KJV has, no sigla", rd("JHN", 5, verses_gap("JHN", 5, 1, 7)) + scrim() + usheet("med", "John 5:4", None, ms_body), "pd")

    # ---------- 7 · NKJV and NLT for testers ----------
    # 12 Oct 2026: The Message replaces the NIV on the API.Bible account (NIV skipped for now). Described plainly
    # as what it is, a paraphrase, with its publisher; never ranked or recommended.
    online2 = (trrow("NKJV", "New King James Version", "Thomas Nelson", "")
               + trrow("NLT", "New Living Translation", "Tyndale House", "")
               + trrow("MSG", "The Message", "A paraphrase · NavPress", ""))
    lt_sheet = sheet("lg", "Translations", None, sec("On your iPhone", on_phone, first=True)
                     + sec("Online", '<p class="note muted offl">Needs a connection. Not read aloud.</p>' + online2), back=True, foot=False)
    F("LT-01", "Translations: NKJV, NLT and The Message online, said plainly", under + lt_sheet, "lt")
    lic_rest = (f'<div class="abar rest"><div class="d rest-row one"><button class="ab-u">Understand 1:1–18</button></div>'
                f'<div class="a abar-list"><button class="ab-u">Understand 1:1–18</button></div></div>')
    nk_body = (opener_btn + placeholder_text("NKJV text of John 1:1–9, as API.Bible sends it. Licensed: not reproduced on the canvas.")
               + f'<div class="cfoot"><p class="note muted">{todo_src("Copyright notice exactly as API.Bible sends it (§7)")}</p></div>')
    F("LT-02", "Reading John 1 in the NKJV: the notice under the text, no Listen", rd("JHN", 1, nk_body, tr="NKJV", bar=lic_rest), "lt")
    off_body = (f'<div class="offpg"><p class="empty">John 1 in the NKJV needs a connection.</p>'
                f'<button class="clink" aria-label="Read John 1 in the Berean Standard Bible">Read in the BSB</button></div>')
    F("LT-03", "Offline and not saved: one sentence and the way on", rd("JHN", 1, off_body, tr="NKJV"), "lt")
    share = (f'<div class="shs"><div class="grab"></div><div class="shp"><p class="shq">{placeholder_text("NKJV text of John 1:1")}</p>'
             f'<p class="note">John 1:1, NKJV</p><p class="note muted">{todo_src("Copyright line as API.Bible sends it")}</p></div>'
             f'<div class="shapps">{apps(4)}</div>'
             f'<div class="shact"><button class="shrow">Copy{ic("copy", 20)}</button></div></div>')
    F("LT-04", "Share from the NKJV: the name and copyright always go with it", rd("JHN", 1, nk_body, tr="NKJV") + scrim() + share, "lt")
    MSG_NOTICE = "THE MESSAGE: The Bible in Contemporary Language copyright © 1993, 2002, 2018 by Eugene H. Peterson. All rights reserved."
    share_msg = (f'<div class="shs"><div class="grab"></div><div class="shp">{placeholder_text("The Message text of John 1:1")}'
                 f'<p class="note">John 1:1, The Message</p><p class="note muted">{E(MSG_NOTICE)}</p></div>'
                 f'<div class="shapps">{apps(4)}</div><div class="shact"><button class="shrow">Copy{ic("copy", 20)}</button></div></div>')
    msg_body = (opener_btn + placeholder_text("The Message text of John 1:1–9, as API.Bible sends it. Licensed: not reproduced on the canvas.")
                + f'<div class="cfoot"><p class="note muted">{E(MSG_NOTICE)}</p></div>')
    F("LT-05", "Share from The Message: its own notice goes with it", rd("JHN", 1, msg_body, tr="MSG") + scrim() + share_msg, "lt")

    # ---------- 8 · Maps, Siri and Spotlight, the UST ----------
    F("MS-01", "Map in Yada’s own style: paper, ink, one accent dot", under111 + sheet("lg", "Bethany", "John 11:1", mapsvg(big=True) + sec(None, row("Show on a larger map", cls="plain"), first=True), back=True, foot=False), "ms")
    j316 = t5("JHN", 3, 16)[0][1]
    spot = (f'<div class="spot"><div class="sbar"><span>9:41</span></div><div class="spf">{ic("search", 18)}<span>john 3 16</span></div>'
            f'<p class="spl">Yada</p><button class="spr" aria-label="John 3:16, Berean Standard Bible. {E(j316)}">{yicon}<span class="rm"><span class="spt">John 3:16</span>'
            f'<span class="spx">{E(j316)}</span><span class="spm">Berean Standard Bible</span></span></button>'
            f'<p class="spl">Shortcuts</p><div class="sctiles"><span class="sct">{yicon}<span>Continue reading</span></span><span class="sct">{yicon}<span>Listen to the next passage</span></span></div></div>')
    F("MS-02", "Spotlight: a reference finds the verse in the BSB; two App Shortcuts", spot, "ms")
    siri = (f'<div class="lscr siri"><p class="lsd">Monday 12 October</p><p class="lst">9:41</p>'
            f'<div class="sirib"><p class="siriq">“Read John 3:16 in Yada”</p><div class="sirsn"><p class="spt">John 3:16 · BSB</p><p class="spx2">{E(j316)}</p>'
            f'<button class="clink">Open in Yada</button></div></div><div class="siriglow"></div></div>')
    F("MS-03", "Siri: the verse in the BSB, read in Siri’s voice; open to keep reading", siri, "ms")
    ust_on = on_phone + trrow("UST", "Simplified Text", "Plain English · unfoldingWord", "")
    F("MS-04", "The UST joins as a plain-English translation, said in one line", under + sheet("lg", "Translations", None, sec("On your iPhone", ust_on, first=True) + sec("Online", '<p class="note muted offl">Needs a connection. Not read aloud.</p>' + online2), back=True, foot=False), "ms")
    ust_body = (opener_btn + placeholder_text("UST text of John 1:1–9: not on disk yet; read its licence from the source at ingest (rule 3).")
                + '<div class="cfoot"><p class="note muted">unfoldingWord® Simplified Text, CC BY-SA 4.0</p></div>')
    F("MS-05", "Reading John 1 in the UST", rd("JHN", 1, ust_body, tr="UST"), "ms")

    # ---------- 9 · Tyndale: profiles everywhere they are cited, book summary ----------
    sm = study_db("MAT")
    pet = sm.execute("select text from notes where kind='profile' and title='Simon Peter'").fetchone()[0]
    O142 = o5("JHN", 1, 42)
    under142 = reader("JHN", 1, 40, 45, sel=(42,), scrolled=False, rows_override=t5("JHN", 1, 40, 45)) + scrim()
    u142 = (sec("Profiles", prof_row("Simon Peter", "Simon Peter. Tyndale profile"), first=True) + study_opt(O142)
            + go_further("Greek", "The first disciples", "1:35–51", O142))
    F("TY-01", "John 1:42: Peter’s profile now shows in John, not only in Matthew", under142 + usheet("lg", "John 1:42", None, u142), "ty")
    pp = note_paras(pet)
    fi = [i for i, (k_, p) in enumerate(pp) if k_ == "h" and "Further" in p][0]
    refs_all = pp[fi + 1][1]
    john_refs, others, bk = [], [], None
    for part in [p.strip() for p in refs_all.split(";")]:
        m = re.match(r"^((?:\d )?[A-Za-z]+) (.*)$", part)
        if m:
            bk, part = m.group(1), m.group(2)
        (john_refs if bk == "John" else others).append((bk, part))
    other_books = []
    for b, _ in others:
        if b not in other_books:
            other_books.append(b)
    pbody2 = "".join(f'<p class="snote">{p}</p>' for k_, p in pp[1:3] if k_ == "p")
    pbody2 += '<button class="more">Read the whole profile</button>'
    pbody2 += sec("In John", "".join(row(E("John " + r.replace("-", "–")), cls="plain") for _, r in john_refs))
    pbody2 += sec(None, row("Elsewhere", extra=f'<span class="note muted">{len(other_books)} more books</span>', cls="plain"))
    pbody2 += '<p class="note muted credit">Tyndale Open Study Notes, CC BY-SA 4.0.</p>'
    F("TY-02", "Simon Peter: the passages in this book come first", under142 + sheet("lg", "Simon Peter", "John 1:42", pbody2, back=True, foot=False), "ty")
    about_row = (f'<button class="aboutb" aria-label="About the Gospel of John: purpose, author, date, setting">About the Gospel of John{ic("right", 14)}</button>')
    F("TY-03", "John 1: the book summary is one line above the first passage", j_reader.replace(opener_btn, about_row + opener_btn, 1), "ty")
    intro = study_db("JHN").execute("select text from notes where kind='intro_summary'").fetchone()[0]
    ip = note_paras(intro)
    ib = ""
    for i_, (k_, p) in enumerate(ip):
        if k_ == "h" and i_ > 0:
            ib += f'<h3 class="lbl">{E(p)}</h3>'
        elif k_ == "p":
            ib += f'<p class="snote">{p}</p>'
    ib = f'<section class="sec first intro">{ib}<p class="note muted credit">Tyndale Open Study Notes, CC BY-SA 4.0.</p></section>'
    F("TY-04", "About the Gospel of John: purpose, author, date, setting", j_reader + scrim() + usheet("med", "The Gospel of John", "About the book", ib), "ty")

    M = lambda u: f"mobbin.com/screens/{u}"
    NEXT_NOTES["refs_gd"] = (
        "1 · John's 46 guides · decisions\n\n"
        "The guide's design is unchanged (PG frames, guide page); this release fills it for all 46 passages. What's new is what surrounds it: "
        "Start here with every row guided and its orientation line (GD-01), a mid-book guide (GD-02/03), and a book with no guides (GD-04).\n\n"
        f"Data: jhn.v3 has {NJ} pericopes and 0 payloads, so every guide line is a placeholder until the batch runs and John reviews each entry (rule 2). "
        "Readers never see an unreviewed guide: until a passage's guide is approved, its title is not a link and the bar offers Listen only, as in GD-04.\n\n"
        "GD-03: the passage text keeps John 5's verse-4 line (PD-05), so the manuscript note works inside the guide too.\n\n"
        f"Refs: Acorns numbered lesson list {M('823d2426-7995-4546-8dda-ebe3414345ba')} · Udemy 'Start course' rows, no dates {M('89b6481f-0676-46bb-a15b-daa62b8a10cd')}. "
        f"Rejected: Brilliant 'Lesson Complete! 110 XP' {M('3c3cb198-8f28-4ed3-84e0-d9607f4da700')}.")
    NEXT_NOTES["refs_ba"] = (
        "2 · Human-read BSB audio · decisions\n\n"
        "The read-along, mini player and full player stay as built (AU frames). A recording changes three things: the voice is named under the title as a button (BA-01); "
        "the first play of a chapter downloads it with a ring that stops (BA-02); the Voice sheet chooses recorded or iPhone and downloads the whole book (BA-03/04).\n\n"
        "Offline with the chapter not saved, the iPhone voice reads and one line says why (BA-05): listening never fails. WEB, KJV and LSV have only the iPhone voice, so the line is plain text (BA-06). "
        "Licensed translations are never read aloud (§9.1): no Listen at all (LT-02).\n\n"
        "Storage (plan additions §D): chapters download on first play and stay for offline; 'Download John' fetches the book; a per-device table records it, not synced, so a second iPhone shows 'Download John' again. "
        "Nothing about the listener is sent: the app only asks R2 for a chapter. Remove sits under ⋯ (BA-07); no space says so in one line and keeps the button (BA-08). "
        "Sizes show the manifest's value (John about 30–45 MB at 32–48 kbps; the whole BSB about 1.2–1.7 GB).\n\n"
        "Gaps: the narrator per book comes from the Berean audio manifest, not on disk yet; durations are not shown until real files exist. "
        "Encoding and alignment need about 10 GB free on the Mac. "
        "Ask the Berean team which BSB revision each recording follows before alignment (handoff).\n\n"
        f"Refs: Audible 'Read by' credit {M('e13a4cc7-8200-48ec-94ca-42600307b646')} · Headway two-option narrator sheet {M('4dd2d9d1-57bb-4a97-85e8-7a920bcd231e')} · "
        f"Headspace 'Download all' {M('3a435349-e9c8-4a37-8759-6abf32039ed9')} · Audible Download as a plain row {M('f60e8d7e-0707-49e5-90e0-6b127730e4c9')}. "
        f"Rejected: ElevenReader voice gallery with orbs {M('827c2243-30b3-4d58-b50e-199ca6b2a6ab')} · Medium flag-led voice list {M('c44f8c53-d4ae-49da-be9d-400e2c5906bc')}.")
    NEXT_NOTES["refs_sw"] = (
        "3 · Swipe between chapters · decisions (roadmap rules)\n\n"
        "The whole page moves, header included: a chapter is a page. The next chapter peeks from the right with a hairline edge (SW-01). Past a third it goes on, short of it it springs back (SW-02).\n\n"
        "Never from screen edges (the left edge is iOS Back). Off while a verse is selected or a sheet is up (SW-04). Reduce Motion: a 200 ms cross-fade. "
        "VoiceOver: Actions rotor 'Next chapter, John 2' and 'Previous chapter'; the footer chapter links stay as the visible fallback.\n\n"
        "End of a book (SW-03): the swipe lands on an 'End of John' page with 'Acts 1 ›'. It never carries the reader into another book.\n\n"
        f"Refs: Apple Books folio and chapter opener {M('f46a3373-8555-41b9-baf2-0c4802d222f9')} · {M('fda02365-2264-4eff-a55e-7850616e58bf')} · "
        f"Finimize end-of-chapter 'Next chapter →' {M('3a6dfb13-d65b-4e21-a110-ab22df6551cc')}. No peek screen is indexed on Mobbin: the peek is Apple Books behaviour. "
        f"Rejected: Deepstash 'BOOK COMPLETED' celebration {M('dc3f18fc-a2f3-499a-8b1d-43a448f22dc1')}.")
    NEXT_NOTES["refs_wl"] = (
        "4 · Widget and Live Activity · decisions\n\n"
        "Two widgets: Continue (small) opens at the place; A passage for today (medium) is a calm verse with its reference, no streak, no count (WL-01). "
        "Live Activity while listening: passage title, verse, BSB, a thin verse progress, and back/pause/next by verse, the mini player's controls (WL-02, WL-03). Started and ended on the phone; no push.\n\n"
        "Rule 9 (handoff): widgets and Live Activities show only public-domain text. Reading the NKJV, Continue keeps the place and shows the BSB (WL-04); the canvas note explains it, the widget doesn't.\n\n"
        "Open: how 'a passage for today' is chosen. Proposal: a fixed list John reviews, not generated. Psalm 23:1 is a stand-in.\n\n"
        f"Refs: Open quote widget {M('bac2c1c1-056e-4b09-bed1-bb1f0d776714')} · Paramount+ 'Keep watching' small widget {M('00d02dc9-438c-4f3b-8337-f677ae91ff7e')} · "
        f"Tiimo calm Live Activity {M('8171ea74-fb00-475b-9362-cb10ee63264e')} · Future audio Live Activity with progress {M('6053e355-c9b4-46be-b92e-c728d74a29f6')}. "
        f"Rejected: Duolingo streak widget {M('c78046b1-5d17-4225-ad76-2d66a72ac8bd')} · Deepstash fire streak {M('a9dee944-e751-4b82-ab90-470dc9fb24d0')}. "
        "No Dynamic Island audio player is indexed; WL-03 follows Apple's system layout.")
    NEXT_NOTES["refs_rp"] = (
        "5 · Reading plans with no dates · decisions\n\n"
        "Two plans to start: John passage by passage (Start here) and M'Cheyne (1842, public domain) (RP-01). 'Reading 2 of 365', never 'Day 2'; no streak, no 'behind', no reminders.\n\n"
        "After a gap the plan simply waits at the next chapter (RP-03). At the end of a plan chapter, the next reading leads and the next chapter link stays below (RP-04).\n\n"
        "Gap: the M'Cheyne calendar isn't in the repo. Readings 1–2 shown (Genesis, Matthew, Ezra, Acts) must be checked against the 1842 source at ingest. "
        "Where Reading plans lives: proposed as a row on Home under 'All passages in John'; decide with John.\n\n"
        f"Refs: Acorns numbered lessons {M('823d2426-7995-4546-8dda-ebe3414345ba')} · Tiimo serif lesson list {M('4a3fa710-da4c-4017-8994-b269c1c65c61')} · "
        f"Waking Up outline, with 'Day 15' removed {M('c7d8a3d1-fc86-4fea-bfe1-ca357d4aaeb8')}. Rejected: Babbel tiles and flame {M('832f5742-a189-409a-8bb1-06f5ed82bb60')}.")
    NEXT_NOTES["refs_pd"] = (
        "6 · People and places, dictionary, manuscripts · decisions\n\n"
        "People and places is one line at the top of a verse's Understand, in the verse's order; each name is its own 44 pt target; at AX sizes it becomes rows (PD-01). "
        "A place pushes inside the sheet with the map first (PD-02); a term the same way (PD-03). Search finds a term first (PD-04). Still never more than two sheets.\n\n"
        "Manuscripts: a missing verse keeps its number as one quiet line, 'Not in the oldest manuscripts', which opens a note in plain words with the verse the KJV has (PD-05/06). No sigla.\n\n"
        "Gaps: TIPNR, OpenBible geocoding and the Aquifer dictionary are not on disk; people/places tables in the study bundles are empty. Names in PD-01 are read from the BSB of 11:1. "
        "Signal for missing verses: BSB empty and no SBLGNT tokens (JHN 5:4, ACT 8:37). The tokens' variant_marked flag (8,702 tokens) is not this signal. "
        "John 1:28's Bethany is a different place, so place links need TIPNR's ids, not name matching. Ask STEPBible about TIPNR's no-redistribution request first.\n\n"
        f"Refs: Public term sheet {M('93eeef7a-1110-439f-8d05-5d3bbe02747d')} · Wise inline term opens a short sheet {M('b884dc4c-2841-4399-827c-2b27a21662a7')} · "
        f"Places, warm custom map and serif card {M('04c21f71-a65c-4853-bbcc-e070a1718893')}. Rejected: IMDb chips over an AI summary {M('34c2885c-9f58-4019-bc70-6ac398bf1d3f')}.")
    NEXT_NOTES["refs_lt"] = (
        "7 · NKJV and NLT for testers · decisions\n\n"
        "Online (12 Oct): NKJV, NLT and The Message. John swapped the NIV for The Message on the API.Bible account; the NIV is skipped for now. "
        "The Message is named as 'The Message', its one line says 'A paraphrase · NavPress': what it is, not a recommendation (LT-01). One line says the online ones need a connection and aren't read aloud, since Listen disappears. "
        "Same rules as NKJV and NLT: display only, never read aloud (§9.1; NavPress needs permission for audio), never in AI, 30-day cache, never on Siri, Spotlight, widgets or notifications.\n\n"
        "Reading a licensed chapter: the copyright notice exactly as API.Bible sends it sits under the text; the bar keeps Understand (built from BSB and the originals, never the NKJV) and drops Listen (LT-02). "
        "Offline and not cached: one sentence and 'Read in the BSB' (LT-03). Copy and Share always append the name and copyright line (LT-04). Writing Tools off on these screens if React Native allows, else not selectable.\n\n"
        "The canvas never reproduces licensed text: grey placeholders stand in for it.\n\n"
        f"Refs: Shazam lyric credit {M('69ac09ec-844d-4ac5-abf2-550959ed6ae7')} · YouTube Music credits {M('edffc6ff-b546-4598-a085-ac724dbb08d0')} · "
        f"Qantas 'You're not connected' {M('18f77caf-19d5-4199-98b4-a36f34096d23')}. Rejected: GoPay offline mascot {M('95483b32-a4d7-4025-b6e7-64220245eff5')}.")
    NEXT_NOTES["refs_ms"] = (
        "8 · Maps, Siri and Spotlight, the UST · decisions\n\n"
        "Maps are drawn in Yada's tokens: paper land, a sage sea, hairline rivers, serif labels, one accent dot for the place (MS-01). The canvas map is hand-drawn and approximate; the build uses public-domain outlines and OpenBible coordinates.\n\n"
        "Spotlight indexes references with BSB text only; App Shortcuts: Continue reading, Listen to the next passage (MS-02). Siri reads the BSB in Siri's own voice (MS-03). Never the NKJV, NLT or The Message (handoff, rule 9).\n\n"
        "UST: a built-in-style row whose one line says 'Plain English' (MS-04); text placeholder until ingest, credit at the foot (MS-05). Its licence must be read from the source file (rule 3) and it enters the content pipeline only if John decides so.\n\n"
        f"Refs: Places map {M('04c21f71-a65c-4853-bbcc-e070a1718893')} · Journal muted map crop {M('5b49ab72-189a-42bf-a6e7-6512763ffe47')} · FocusFlight dark map {M('dff28fee-c069-46bc-8b38-b85dd334b2c0')} · "
        f"Tripsy App Shortcuts naming {M('8085ad4b-f633-495b-9bc3-93607f5ef22c')} · Notion picker with a gloss line {M('efd159f7-2317-46c1-bca2-bfc495769903')}. "
        f"Rejected: Careem Google map with CTA {M('beb58289-03dc-4475-b042-e93d8943fe4f')}. No system Spotlight screen is indexed; MS-02 follows iOS.")
    NEXT_NOTES["refs_ty"] = (
        "9 · Tyndale, three items · decisions\n\n"
        "Verse notes: unchanged, behind Study notes (SN frames).\n\n"
        "Profiles everywhere they are cited: matched by the profile's 'Passages for Further Study', not by name in the verse. John 1:42 now shows Simon Peter (from Matthew's bundle) (TY-01); "
        "John 11:1 shows Martha, Mary, and Lazarus (from Luke's) (PD-01). The profile lists this book's passages first, the rest behind 'Elsewhere' (TY-02).\n\n"
        "Book summary: one line above the first passage of chapter 1, 'About the Gospel of John', opening Purpose, Author, Date, Setting as published (TY-03/04). Quiet on purpose: the text stays first.\n\n"
        f"Refs: ElevenReader Summary then Details {M('ee3ee9ff-e838-471b-a1b9-aec27a2850d1')} · Headway 'About' with provenance {M('811d9468-6746-4fc8-abe3-c9cf3b4560d6')} · "
        f"Letterboxd person page grouped by role {M('0b979008-483b-428d-8275-e42fe05b932c')} · The Atlantic rule-separated 'More from' {M('85125f0d-8fc1-497d-918c-e401e1f9b8f6')}. "
        f"Rejected: Deepstash person page with follower counts {M('5528ec5c-74b7-48ee-99c4-32c67c79528f')}.")
# ================= Plan additions (next page): docs/plan-additions-2026-10-12.md, A1–A3, B4–B7 =================
if STYLE != "v1":
    spk = sqlite3.connect(f"{Y}/content/bundles/speakers.v1.db")
    syn = sqlite3.connect(f"{Y}/content/bundles/syntax.v1.db")
    stg = sqlite3.connect(f"{Y}/content/staging.db")

    def vref(o):
        return "{}:{}".format(*db5.execute("select chapter, verse from verses where ord=?", (o,)).fetchone())

    def speakers(a_id, b_id):
        # passageSpeakers() in packages/pipeline/src/glyssen.ts: names joined by " · ", since Glyssen's own names hold commas
        # ("Mary, sister of Martha"). Only 'speaks' rows of character/multiple kinds count as
        # Speaking; Glyssen's own names, slashes kept as written. Uncertain rows are returned apart, never as Speaking.
        A = db5.execute("select ord from verses where verse_id=?", (a_id,)).fetchone()[0]
        B = db5.execute("select ord from verses where verse_id=?", (b_id,)).fetchone()[0]
        rows = spk.execute("select c.name, c.kind, s.standing, s.ord from verse_speakers s join characters c on c.id=s.character "
                           "where s.ord between ? and ? order by s.ord, s.line", (A, B)).fetchall()
        speaking, uncertain = {}, {}
        for n, k, st, o in rows:
            if k not in ("character", "multiple"):
                continue
            d = speaking if st == "speaks" else uncertain if st == "uncertain" else None
            if d is not None:
                d.setdefault(n, []).append(o)
        return speaking, uncertain

    def spans(ords):
        out, run = [], [ords[0]]
        for o in ords[1:]:
            if o == run[-1] + 1:
                run.append(o)
            else:
                out.append(run); run = [o]
        out.append(run)
        return ", ".join(vref(r[0]) + (f"–{vref(r[-1]).split(':')[1]}" if len(r) > 1 else "") for r in out)

    def speaking_line(a_id, b_id, show=4, open_=False, scope=None):
        sp, unc = speakers(a_id, b_id)
        def plain_name(n_):
            n_ = re.sub(r"^(.+?), (the|some|two|one|many)$", r"\2 \1", n_.strip())
            return n_[0].upper() + n_[1:] if n_ else n_
        merged = {}
        for n_, os_ in sp.items():
            # A slash joins alternatives or a group (Glyssen's convention); each person is named once, by who they are
            # ("Mary, sister of Martha" → Mary; "Jews who had been with Mary and Martha, some" → the Jews).
            for x in [plain_name(y) for y in n_.split("/") if y.strip()]:
                head = re.split(r",| who ", x)[0].strip()
                head = re.sub(r"^(?:Some|some|The) ", "", head)
                head = "the " + head if head in ("Jews", "disciples", "Pharisees", "crowd") else head
                head = head if head.startswith("the ") else head[0].upper() + head[1:]
                if head.lower() not in (k_.lower() for k_ in merged):
                    merged[head] = os_
        sp = merged
        names = list(sp)
        shown = names if open_ else names[:show]
        parts = []
        for n in names:
            parts.append(f"{n}" + (f" ({spans(sp[n])})" if scope and n in scope else ""))
        aria = "Speaking in this passage: " + "; ".join(parts)
        d = f'<p class="spk" aria-label="{E(aria)}"><span class="spl2">Speaking</span> {E(" · ".join(parts[:len(shown)]))}'
        if len(shown) < len(names):
            d += f' <button class="spmore" aria-label="Show all {len(names)} speakers">and {len(names) - len(shown)} more</button>'
        d += "</p>"
        for n, os_ in unc.items():
            if n in sp and set(os_) & set(sp[n]):
                continue
            d += f'<p class="note muted spu">In {spans(os_)} the text doesn’t say who is speaking.</p>'
        return d

    def guide_where(a_id, b_id, **kw):
        return sec("Where we are", speaking_line(a_id, b_id, **kw) + todo("Where we are · 25 words at most"), first=True)

    def gbody(a_id, b_id, book, ch, va, vb, **kw):
        return (guide_where(a_id, b_id, **kw) + sec("Three things to notice", todo("Three claims, each naming its verse"))
                + f'<section class="sec gtext"><h3 class="lbl">The passage</h3>{verses_html(t5(book, ch, va, vb), ch=ch, book=book)}</section>')
    p119 = [p for p in JP if p[0] == "JHN.1.19-1.34"][0]
    under119 = reader("JHN", 1, 19, 24, scrolled=False, rows_override=t5("JHN", 1, 19, 24)) + scrim()
    F("GS-01", "Where we are: who speaks, in Glyssen’s own names", under119 + guide("med", p119[1], "John 1:19–34", gbody("JHN.1.19", "JHN.1.34", "JHN", 1, 19, 23)), "gs")
    p31 = [p for p in JP if p[0] == "JHN.3.1-3.21"][0]
    under31g = reader("JHN", 3, 1, 6, scrolled=False, rows_override=t5("JHN", 3, 1, 6)) + scrim()
    F("GS-02", "John 3: Jesus speaks to 3:13; 3:14–21 is not marked, so 3:16 is never ‘Jesus says’", under31g + guide("med", p31[1], "John 3:1–21",
      gbody("JHN.3.1", "JHN.3.21", "JHN", 3, 1, 4, scope=("Jesus",))), "gs")
    p11 = [p for p in JP if p[0] == "JHN.11.1-11.44"][0]
    F("GS-03", "Many speakers: four, then ‘and 5 more’; open shows all, as written", [
        ("Light · four and more", "light", under111 + guide("med", p11[1], "John 11:1–44", gbody("JHN.11.1", "JHN.11.44", "JHN", 11, 1, 3))),
        ("Dark · opened", "dark", under111 + guide("lg", p11[1], "John 11:1–44", gbody("JHN.11.1", "JHN.11.44", "JHN", 11, 1, 3, open_=True))),
        ("AX5 · opened", "ax5", under111 + guide("lg", p11[1], "John 11:1–44", gbody("JHN.11.1", "JHN.11.44", "JHN", 11, 1, 3, open_=True)))], "gs")

    # ---- A2 · MACULA evidence marks ----
    O316 = o5("JHN", 3, 16)
    mw = {p: (s_, en, t) for t, p, s_, en in syn.execute("select t, position, surface, english from words where ord=? order by word", (O316,))}
    frames = syn.execute("select w.english, l.arg, w2.english, w2.surface from links l join words w on w.t=l.t join words w2 on w2.t=l.target_t "
                         "where w.ord=? and l.kind='frame' order by w.word, l.arg", (O316,)).fetchall()
    fr = {}
    for v_, arg, en, sf in frames:
        fr.setdefault(v_, {})[arg] = (en, sf)
    j316b = t5("JHN", 3, 16)[0][1]

    def mark316(t):
        # Marked from MACULA's frame for ἠγάπησεν (A0 θεὸς, A1 κόσμον); the BSB words are found through an alignment
        # (open: see the note), never by counting matching English words.
        for w in ("God", "loved", "world"):
            t = re.sub(rf"\b{w}\b", f'<mark class="evm">{w}</mark>', t, count=1)
        return t
    v316 = f'<p class="v"><span class="vn">16</span> {mark316(E(j316b))}</p>'
    pop = (f'<div class="wpop" role="dialog" aria-label="loved. Linked words: God, world. MACULA Greek">'
           f'<p class="wph">loved <span lang="el" class="gk muted">{mw[3][0]}</span></p>'
           # No role names (John delegated, 12 Oct): A0/A1 mean nothing to a reader, and "who"/"whom" would be Yada's
           # reading of them, wrong where A0 isn't the doer. The card states only MACULA's link, in its order.
           f'<p class="spl2">Linked words</p>'
           f'<p class="wpr">God <span lang="el" class="gk">{fr["loved"]["A0"][1]}</span></p>'
           f'<p class="wpr">world <span lang="el" class="gk">{fr["loved"]["A1"][1]}</span></p>'
           f'<p class="note muted">MACULA Greek, CC BY 4.0</p></div>')
    mbody = (sec("Three things to notice", row("Placeholder claim about 3:16, linked to its words", extra='<span class="note shown">Shown in the passage</span>').replace('class="row', 'class="row on', 1), first=True)
             + f'<section class="sec gtext"><h3 class="lbl">The passage</h3>{verses_html(t5("JHN", 3, 14, 15), ch=3, book="JHN")}{v316}</section>')
    F("MC-01", "A claim marks its own words: God, loved, world from MACULA’s frame", under31g + guide("lg", p31[1], "John 3:1–21", mbody, scrolled=True), "mc")
    F("MC-02", "Tap a marked word: the verb and the words MACULA links to it, no role names", under31g + guide("lg", p31[1], "John 3:1–21", mbody, scrolled=True) + pop, "mc")
    F("MC-03", "Reduce Motion and VoiceOver: marks appear without a fade; one stop reads all three", [
        ("Light · marks shown", "light", under31g + guide("lg", p31[1], "John 3:1–21", mbody, scrolled=True)),
        ("Dark · VoiceOver: “God, loved, world. Marked for the claim”", "dark", under31g + guide("lg", p31[1], "John 3:1–21", mbody.replace('<p class="v"><span class="vn">16</span>', '<p class="v" style="position:relative"><span class="vo" aria-hidden="true">1</span><span class="vn">16</span>', 1), scrolled=True)),
        ("AX5 · marks shown", "ax5", under31g + guide("lg", p31[1], "John 3:1–21", mbody, scrolled=True))], "mc")

    # ---- B5 · unfoldingWord Translation Words and Questions ----
    p101 = [p for p in JP if p[0] == "JHN.10.1-10.21"][0]
    under101 = reader("JHN", 10, 1, 6, scrolled=False, rows_override=t5("JHN", 10, 1, 6)) + scrim()
    tw_body = (sec(None, todo("Translation Words article, adapted, with the unfoldingWord® mark removed (licence)"), first=True)
               + sec("In John", row("Passages that use the term", extra='<span class="note muted">from the article’s own list</span>', cls="plain"))
               + '<p class="note muted credit">Translation Words, adapted from unfoldingWord, CC BY-SA 4.0</p>')
    F("UW-01", "A key term in the guide opens a short article, pushed", under101 + sheet("lg", "Shepherd", "John 10:1–21", tw_body, back=True, foot=False), "uw")

    def q(n, open_=False):
        a = f'<div class="qa">{todo("Answer as written in Translation Questions")}</div>' if open_ else ""
        return (f'<div class="qrow"><p class="claim">{todo(f"Question {n} from Translation Questions")}</p>'
                f'<button class="evx" aria-expanded="{"true" if open_ else "false"}"><span>{"Hide" if open_ else "Show"} the answer</span>{ic("up" if open_ else "down", 16)}</button>{a}</div>')
    cw = (sec("Check what you read", q(1, True) + q(2) + q(3), first=True)
          + '<p class="note muted credit">Translation Questions, adapted from unfoldingWord, CC BY-SA 4.0</p>' + sec(None, next_row))
    F("UW-02", "End of a guide: an optional Check what you read, answers one tap away", under_j + guide("lg", JLAB, "John 1:1–18", cw, scrolled=True), "uw")

    # ---- B6 · Dictionary of Bible Themes ----
    th = sec("Themes in this passage", "".join(row(todo(f"Theme {i}")) for i in (1, 2, 3)), first=True)
    F("TH-01", "Themes in this passage: a short list near the end of the guide", under101 + guide("lg", p101[1], "John 10:1–21", th + sec(None, row("Translations and more", cls="plain")), scrolled=True), "th")
    thp = (sec(None, todo("Theme summary, as published"), first=True) + sec("Passages", "".join(row(todo("Reference"), extra='<span class="note muted xt">BSB text of the passage</span>') for _ in range(3)))
           + '<p class="note muted credit">Dictionary of Bible Themes (Aquifer), CC BY-SA 4.0</p>')
    F("TH-02", "A theme opens the passages that develop it, pushed", under101 + sheet("lg", "Theme", "John 10:1–21", thp, back=True, foot=False), "th")

    # ---- B4 · Timeline ----
    tl_line = (f'<button class="tlline" aria-label="In time. Opens the order of events">{todo("In time: one line from Theographic’s order")}{ic("right", 14)}</button>')
    F("TL-01", "Where we are gains one line placing the passage in time", under5 + guide("med", p5[1], "John 5:1–15",
      sec("Where we are", tl_line + todo("Where we are · 25 words at most"), first=True) + sec("Three things to notice", todo("Three claims"))), "tl")
    seq = ""
    for i in range(6):
        cur = i == 3
        cur_attr = ' aria-current="true"' if cur else ""
        date_ = '<span class="note muted">About AD 28</span>' if i == 1 else ""
        main_ = "Healing at the pool" if cur else todo("Event, Theographic")
        seq += (f'<div class="tlr{" cur" if cur else ""}"{cur_attr}><span class="tld" aria-hidden="true"></span><span class="rm">'
                f'<span class="lmain">{main_}</span>{date_}</span></div>')
    F("TL-02", "The order of events: sequence first, a date only where John reviewed it", under5 + sheet("lg", "In time", "John 5:1–15", sec(None, seq, first=True)
      + '<p class="note muted">Order from Theographic, CC BY-SA 4.0. Dates are shown only where reviewed.</p>', back=True, foot=False), "tl")

    # ---- B7 · WEB and KJV human audio ----
    def vs_web():
        body = sec(None, vrow("Recorded reading", "Winfred W. Henson, 2014–16 · recorded before the 2020 WEB text, so a few words may differ", on=True) + vrow("iPhone voice", "Works offline"), first=True)
        return sheet("med", "Voice", "John 1 · WEB", body, foot=False)
    web_full = full_rec().replace("John 1 · BSB · ", "John 1 · WEB · ")
    F("WA-01", "WEB recorded: the reader and the year are named", web_full + scrim() + vs_web(), "wa")
    kjv_body = sec(None, vrow("Recorded reading", "Mike Armenta, LibriVox", on=True) + vrow("iPhone voice", "Works offline"), first=True)
    F("WA-02", "KJV recorded: same sheet; off in the UK until Cambridge answers", full_rec().replace("John 1 · BSB · ", "John 1 · KJV · ") + scrim() + sheet("med", "Voice", "John 1 · KJV", kjv_body, foot=False), "wa")

    # ---- A3 · Large, small and raised Hebrew letters ----
    def hrow(vid):
        rows = stg.execute("select position, raw_surface, gloss from tokens where verse_id=? order by position", (vid,)).fetchall()
        out = []
        for p_, raw, gl in rows:
            h = raw.replace("/", "")
            h = re.sub(r'<seg type="x-(large|small|suspended)">(.*?)</seg>', lambda m: f'<span class="hl-{m.group(1)}">{m.group(2)}</span>', h)
            out.append(f'<span class="w"><span class="o" lang="he">{h}</span><span class="gl">{E(gl or "")}</span></span>')
        return out
    wr_ = lambda s_: s_.replace('class="w"', 'class="wr"')
    shema = hrow("DEU.6.4")
    hl1 = (sec("Original Hebrew", f'<div class="il d" dir="rtl">{"".join(shema)}</div><div class="ilr a rtl">{"".join(wr_(s_) for s_ in shema)}</div>'
           + '<p class="note muted">The first and last letters are written large in the Hebrew text.</p><p class="note muted src">Hebrew: Westminster Leningrad Codex · Glosses: STEPBible (TAHOT)</p>', first=True))
    underD = reader("DEU", 6, 1, 6, sel=(4,), scrolled=False, rows_override=t5("DEU", 6, 1, 6)) + scrim()
    F("HL-01", "Deuteronomy 6:4: the large letters shown as written", underD + usheet("lg", "Deuteronomy 6:4", None, hl1), "hl")
    jdg = hrow("JDG.18.30")[6:11]
    hl2 = (sec("Original Hebrew", f'<div class="il d" dir="rtl">{"".join(jdg)}</div><div class="ilr a rtl">{"".join(wr_(s_) for s_ in jdg)}</div>'
           + '<p class="note muted">In the Hebrew text, one letter of this name is written raised above the line.</p><p class="note muted src">Hebrew: Westminster Leningrad Codex · Glosses: STEPBible (TAHOT)</p>', first=True))
    underJ = reader("JDG", 18, 27, 31, sel=(30,), scrolled=False, rows_override=t5("JDG", 18, 27, 31)) + scrim()
    F("HL-02", "Judges 18:30: a raised letter, said in one plain line", underJ + usheet("lg", "Judges 18:30", None, hl2), "hl")

    NEXT_NOTES["refs_dc"] = (
        "Decisions on the five open questions (John delegated them, 12 Oct)\n\n"
        "1. Reading plans: a row on Home under 'All passages in John'. No new tab.\n"
        "2. A passage for today: a fixed list John reviews, one verse per day of the year, BSB only. Nothing generated.\n"
        "3. Book summary: one line above chapter 1 that opens a sheet (TY-03/04). The text stays first.\n"
        "4. People and places: links in one line at default sizes, rows at AX1 and above (PD-01).\n"
        "5. UST: display-only, like the licensed translations. Never in the content pipeline or any AI call; can be relaxed later.\n"
        "6. MACULA labels: neither A0/A1 nor 'who/whom'. The word card lists the linked words in MACULA's order (MC-02).")
    NEXT_NOTES["refs_gs"] = (
        "A1 · Glyssen speakers · decisions\n\n"
        "One line at the top of 'Where we are': 'Speaking' then Glyssen's names, in order of first speech, slashes kept (GS-01: 'John the Baptist, priests/Levites'). "
        "Only 'speaks' rows of character/multiple kinds (passageSpeakers()). Uncertain rows never join the line.\n\n"
        "John 3 (GS-02): Jesus speaks 3:3–13; Glyssen marks 3:14–21 uncertain, so one muted line says '3:14–21: possibly still Jesus speaking; the text doesn't mark it.' 3:16 is never presented as 'Jesus says'.\n\n"
        "Many speakers (GS-03, John 11: 9 entries): four, then 'and 5 more' opens the full list in place. Names stay exactly as Glyssen writes them ('Jews who had been with Mary and Martha, some'); tidying them would be an edit of the source.\n\n"
        "VoiceOver: 'Speaking in this passage: …' as one stop. AX5 wraps; no truncation. Credit (MIT, two copyright lines) on Sources. "
        "Delivery notes ('to crowd'): none in these three passages, so not drawn; when present they'd follow the name as 'to crowd · Glyssen's note'.\n\n"
        f"Refs: Letterboxd cast list as plain names {M('0b979008-483b-428d-8275-e42fe05b932c')}. No Mobbin screen shows a speaker line in reading text; this follows the guide's own type.")
    NEXT_NOTES["refs_mc"] = (
        "A2 · MACULA evidence marks · decisions\n\n"
        "One evidence mark everywhere: the dotted accent underline already used for a thing to notice (PG-10). MACULA changes which words get it, not how it looks: "
        "a claim links to (ord, position), so 3:16 marks God, loved and world from the frame of ἠγάπησεν (A0 θεὸς, A1 κόσμον), not words that happen to match (MC-01).\n\n"
        "Tap a marked word (MC-02): a small card with the Greek verb, then 'Linked words' in MACULA's order (God, world). Nothing generated. "
        "Decided (John delegated, 12 Oct): no role names. A0/A1 mean nothing to a reader, and 'who'/'whom' would be Yada's reading of them, wrong where A0 isn't the doer (rule 4).\n\n"
        "Reduce Motion: marks appear without a fade. VoiceOver: the verse reads with 'Marked for the claim: God, loved, world' (MC-03).\n\n"
        "Gap: MACULA gives Greek positions and Cherith glosses, not BSB words. Marking the BSB needs a Greek-to-BSB word alignment; none is on disk. The claim in MC-01 is a placeholder: John has no golden entry on 3:16.")
    NEXT_NOTES["refs_uw"] = (
        "B5 · Translation Words and Questions · decisions\n\n"
        "A term in a note or the guide opens its article, pushed inside the sheet like a profile (UW-01). Adapted copies drop the unfoldingWord® mark, as the licence asks.\n\n"
        "Check what you read (UW-02): after the passage, before Next. Optional, says so, and nothing is scored: each question has a 'Show the answer' disclosure. No streaks, no ticks.\n\n"
        "Gap: neither dataset is on disk; text is placeholder and the term ('Shepherd') must be checked against the 953 articles.\n\n"
        f"Refs: Wise inline term to short sheet {M('b884dc4c-2841-4399-827c-2b27a21662a7')} · Public term sheet {M('93eeef7a-1110-439f-8d05-5d3bbe02747d')}. Rejected: Brilliant XP completion {M('3c3cb198-8f28-4ed3-84e0-d9607f4da700')}.")
    NEXT_NOTES["refs_th"] = (
        "B6 · Dictionary of Bible Themes · decisions\n\n"
        "'Themes in this passage' sits near the end of the guide, after the text: at most three rows, each opening the passages that develop it (TH-01/02). "
        "It's a way on, not part of the first screen's word budget.\n\nGap: the Aquifer DBT isn't on disk; theme names are placeholders.")
    NEXT_NOTES["refs_tl"] = (
        "B4 · Timeline · decisions\n\n"
        "One line in 'Where we are' places the passage in time and opens the order of events (TL-01/02). Order first; a date appears only on an anchor John has reviewed, labelled so. "
        "Theographic follows one young-earth chronology with 6 dates flagged approximate, so its exact years are never shown as fact (rule 4).\n\n"
        "Before ingest: check Theographic's licence chain (people data partly from an older non-commercial TIPNR). Event names in TL-02 are placeholders; 'About AD 28' shows the format only and is not a reviewed date.")
    NEXT_NOTES["refs_wa"] = (
        "B7 · WEB and KJV human audio · decisions\n\n"
        "Same player and Voice sheet as the BSB (BA-03). The reader and year are named in the option's line (WA-01, WA-02). WEB: one line says the 2014–16 recording predates the 2020 text, so a few words may differ.\n\n"
        "Waiting: eBible.org's written confirmation (WEB); Cambridge University Press for the KJV in the UK. Until then the KJV recording is off in the UK; the sheet shows only the iPhone voice there (as BA-06).")
    NEXT_NOTES["refs_hl"] = (
        "A3 · Large, small and raised Hebrew letters · decisions\n\n"
        "Shown as written in Original Hebrew: large letters at 1.4×, small at 0.7×, raised lifted by a third of the x-height (HL-01, HL-02). One plain line says what the eye sees; nothing about why (rule 4).\n\n"
        "Data: 11 words in staging's raw_surface (<seg type=x-large|x-small|x-suspended>): LEV 11:42, NUM 27:5, DEU 6:4 ×2, JDG 18:30, JOB 38:13, 38:15, PSA 80:13, PRO 16:28, ISA 44:14, JER 39:13. "
        "Needs a bundle column (format change). Judges 18:30: the gloss reads 'Manasseh' and the BSB 'Moses'; the frame states only the raised letter.")
# ================= Understand, UX pass (next page, 12 Oct 2026) =================
# John asked: tap a verse, tap Understand, what should a beginner see; what if they want to go deeper; what if they
# selected 1:1–18. One rule: the medium detent is the beginner's whole answer; everything else waits under
# "Go deeper", grouped by the question a reader would ask, never by source.
if STYLE != "v1":
    def agree_line(vid, trs=("BSB", "WEB", "KJV", "LSV")):
        # Words only: punctuation and case never count as a difference (Compare audit, 12 Oct).
        norm = lambda s_: re.sub(r"[^a-z ]", "", s_.lower().replace("’", "'").replace("—", " "))
        b_, c_, v_ = vid.split(".")
        tx = {tr: norm(t5(b_, int(c_), int(v_), tr=tr)[0][1]) for tr in trs}
        same = [tr for tr in trs[1:] if tx[tr] == tx[trs[0]]]
        if len(same) == len(trs) - 1:
            return f"All {len(trs)} say the same"
        diff = [tr for tr in trs[1:] if tr not in same]
        return f"{' and '.join(diff) if len(diff) < 3 else ', '.join(diff[:-1]) + ' and ' + diff[-1]} word it differently"

    def drow(main, sub):
        return nrow(main, sub)

    def deeper(o, vid, k=None, people_=None, guide_lab=None, guide_rng=None, n_notes=0, n_see=0, n_deb=0, n_gram=0):
        words = db5.execute("select count(*) from tokens where ord=?", (o,)).fetchone()[0]
        g = []
        g.append(sec("In the original", drow("Original Greek", f"{words} words, each with its English" + (f" · {n_gram} notes on the Greek" if n_gram else ""))
                     + drow("Key words", "Short articles on the terms in this verse"), first=True))
        g.append(sec("In other translations", drow("Compare translations", agree_line(vid))))
        if people_:
            g.append(sec("Who and where", drow(" · ".join(people_), "People and places in this verse")))
        around = ""
        if guide_lab:
            around += drow(E(guide_lab), f"The passage guide · {guide_rng}")
        if n_see:
            around += drow("See also", f"{n_see} passages that connect")
        around += drow("Themes", "Where else the Bible develops these")
        g.append(sec("Around this verse", around))
        others = ""
        if n_deb:
            others += drow("Where readers differ", f"{n_deb} questions, each reading set out fairly")
        if n_notes:
            others += drow("Study notes", f"Tyndale · {n_notes} notes")
        if others:
            g.append(sec("What others say", others))
        return f'<div class="deep"><h2 class="deeph">Go deeper</h2>{"".join(g)}</div>'

    cJ = CL["jhn.1.1"]
    # The beginner layer is English only (a reader, 12 Oct 2026: "I thought the point was understanding the verse,
    # not just seeing some Hebrew Greek words"). A claim with Greek or Hebrew script moves under In the original;
    # nothing is reworded. For John 1:1 that leaves one of ten, which is the content gap the note names.
    has_script = lambda t_: bool(re.search(r"[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]", t_))
    plain_all = [c for c in sorted(G2["jhn.1.1"]["claims"], key=lambda c: c["display_rank"]) if c["category"] != "debated"]
    reader_cl = [c for c in plain_all if not has_script(c["claim"])][:3]
    moved11 = len([c for c in plain_all if has_script(c["claim"])])
    n_gram11 = len([c for c in G2["jhn.1.1"]["claims"] if c["category"] != "debated" and is_grammar(c)])
    n_deb11 = len([c for c in G2["jhn.1.1"]["claims"] if c["category"] == "debated"])
    own11, rng11 = notes_for(O11)
    notice_rows = "".join(row(lang(c["claim"])) for c in reader_cl)
    greek_flag = f'<span class="wb" aria-hidden="true">Canvas note: {moved11} of {len(plain_all)} notices name Greek words, so they wait under In the original. The prompt must write plain-English notices before the 46-guide batch.</span>'

    def beginner11(clamp=True):
        wh = f'<p class="expl{" clamp" if clamp else ""}">{lang(G2["jhn.1.1"]["whats_happening"])}</p>' + ('<button class="more d">More</button>' if clamp else "")
        return (sec("Where we are", wh, first=True)
                + sec("Notice", notice_rows + greek_flag)
                + f'<section class="sec">{row("Readers differ on 2 questions here", cls="plain")}</section>')

    def u_sheet(pos, body, scrolled=False):
        return usheet(pos, "John 1:1", "The Word became flesh · 1:1–18", body, scrolled=scrolled)
    d11 = deeper(O11, "JHN.1.1", guide_lab=JLAB, guide_rng="1:1–18", n_notes=len(own11) + len(rng11), n_see=n_see, n_deb=n_deb11, n_gram=moved11)
    sel11 = reader("JHN", 1, 1, 6, sel=(1,), scrolled=False, rows_override=t4("JHN", 1, 1, 6)) + scrim()
    F("UX-01", "Beginner: three parts and nothing else at the medium detent", sel11 + u_sheet("med", beginner11() + d11), "ux")
    F("UX-02", "Pull up: Go deeper, grouped by the question you’d ask", sel11 + u_sheet("lg", d11.replace('<div class="deep">', '<div class="deep first">', 1), scrolled=True), "ux")

    # A verse with no Yada entry, which is most verses: never an empty sheet. Who's here, then the passage's
    # own orientation from its guide, then a study note, then the same Go deeper.
    own111, rng111 = notes_for(O111)

    def range_note(rng):
        # No note on the verse itself: the note on its stretch, first paragraph, says which stretch.
        if not rng:
            return ""
        a_, b2, t_ = rng[0]
        ps = [p for k_, p in note_paras(t_) if k_ == "p"]
        return sec(f"A study note on {oref(a_, b2).rsplit(' ', 1)[1]}", f'<p class="snote clamp">{ps[0]}</p><button class="more">Read the whole note</button><p class="note muted credit">{TOSN_SRC}</p>')
    pl = ppl_line(PPL11)
    beg111 = (sec("People and places", pl, first=True)
              + sec("In this passage", todo("Where we are, from the guide for Raising Lazarus (11:1–44)") + row(f"{E(p11[1])} · the guide", cls="plain"))
              + (study_sec(O111) if own111 else range_note(rng111)))
    d111 = deeper(O111, "JHN.11.1", people_=["Lazarus", "Bethany", "Mary", "Martha"], guide_lab=p11[1], guide_rng="11:1–44", n_notes=len(own111) + len(rng111),
                  n_see=len(xrefs(O111)))
    F("UX-03", "No explanation for this verse: who’s here, the passage, a study note", under111 + usheet("med", "John 11:1", f"{p11[1]} · 11:1–44", beg111 + d111), "ux")

    # Several verses selected. One answer: the passage guide, because the passage is the unit (North Star, 10 Oct).
    rest_sel = lambda a, b: (f'<div class="abar"><div class="d selp"><button class="mpb mpp pfh" aria-label="Play from verse {a}">{ic("play", 18)}<span>1:{a}</span></button>'
                             f'<button class="ab-u">Understand 1:{a}–{b}</button><button class="ab-i" aria-label="Compare translations of 1:{a} to {b}">{ic("cols", 18)}<span>Compare</span></button>'
                             f'<button class="ab-m" aria-label="More actions">{ic("more", 22)}</button></div>'
                             f'<div class="a abar-list"><button class="ab-u">Understand 1:{a}–{b}</button><button class="ab-i">More{ic("more", 30)}</button></div></div>')
    F("UX-04", "1:1–18 selected: the bar says Understand 1:1–18", reader("JHN", 1, 1, 9, scrolled=False, rows_override=jrows, sel=tuple(range(1, 10))) + rest_sel(1, 18), "ux")
    F("UX-05", "…and it opens the passage guide: the same answer as the bar at rest", under_j + guide("med", JLAB, "John 1:1–18", john_guide()), "ux")

    def your_verses(a, b):
        rows_ = ""
        for v in range(a, b + 1):
            o = o5("JHN", 1, v)
            has_entry = f"JHN.1.{v}" in ENTRIES
            own, rng = notes_for(o)
            sub = "Explained" if has_entry else (f"Study notes · {len(own) + len(rng)}" if own or rng else "Words and translations")
            rows_ += nrow(f"1:{v}", sub)
        return sec("Your verses · 1:3–5", rows_, first=True)
    part_body = (your_verses(3, 5) + sec("Where we are", f'<p class="expl">{lang(first_sentence(G2["jhn.1.1"]["whats_happening"]))}</p>' + todo("Who is speaking to whom"))
                 + f'<section class="sec gtext"><h3 class="lbl">The passage</h3>{verses_html(t4("JHN", 1, 1, 6), sel=(3, 4, 5), ch=1, book="JHN")}</section>')
    F("UX-06", "Part of a passage (1:3–5): its guide, your verses first, marked in the text", under_j + guide("lg", JLAB, "John 1:1–18", part_body), "ux")
    cross = (sec(None, todo("Guide for The Word became flesh, as in UX-05"), first=True)
             + sec("Your selection continues", nrow(E(p119[1]), "John 1:19–34 · its guide")))
    F("UX-07", "Across two passages (1:15–20): the first guide, then the next one row", under_j + guide("lg", JLAB, "John 1:1–18", cross, scrolled=True), "ux")
    mk = t5("MRK", 1, 1, 4)
    mk_rows = ""
    for v, _ in mk:
        o = o5("MRK", 1, v)
        own, rng = notes_for(o)
        first_p = ""
        if own:
            ps = [p for t_ in own for k_, p in note_paras(t_) if k_ == "p"]
            first_p = f'<p class="snote clamp2">{ps[0]}</p>' if ps else ""
        none_ = '<p class="note muted">No study note on this verse.</p>'
        mk_rows += f'<section class="sec"><h3 class="lbl">1:{v}</h3>{first_p or none_}{row("More on 1:" + str(v), cls="plain")}</section>'
    mk_rows += '<p class="note muted credit">Tyndale Open Study Notes, CC BY-SA 4.0</p>'
    F("UX-08", "A book with no guides (Mark 1:1–4): verse by verse, a study note each", reader("MRK", 1, 1, 6, scrolled=False, rows_override=t5("MRK", 1, 1, 6), sel=(1, 2, 3, 4)) + scrim()
      + usheet("lg", "Mark 1:1–4", None, mk_rows.replace('<section class="sec">', '<section class="sec first">', 1)), "ux")
# ================= Compare, redesigned (next page): audit of 12 Oct 2026 =================
# The app's Compare marked a word only when no other version shared its stem, so 10% of verses showed four
# blocks with nothing marked and 1 Cor 14:34 showed none. Here each version is compared with yours alone (a word
# diff in order), its changed words are marked, and one line says what changed.
if STYLE != "v1":
    import difflib

    def toks(s_):
        return re.findall(r"[A-Za-z’']+|[^A-Za-z’'\s]+|\s+", s_)

    def key(w):
        return re.sub(r"[^a-z']", "", w.lower().replace("’", "'"))

    def pair_diff(base, other):
        bt, ot = toks(base), toks(other)
        bw = [(i, key(t)) for i, t in enumerate(bt) if key(t)]
        ow = [(i, key(t)) for i, t in enumerate(ot) if key(t)]
        sm = difflib.SequenceMatcher(a=[k for _, k in bw], b=[k for _, k in ow], autojunk=False)
        marked, changes = set(), []
        # Changes one word apart are one change ("one and only → only begotten"), not three fragments.
        ops = [o_ for o_ in sm.get_opcodes()]
        spans_ = []
        for i, (op, a1, a2, b1, b2) in enumerate(ops):
            if op == "equal":
                if spans_ and a2 - a1 == 1 and i + 1 < len(ops) and spans_[-1][4] == i - 1:
                    spans_[-1][5] = True
                continue
            if spans_ and spans_[-1][5]:
                spans_[-1][1], spans_[-1][3], spans_[-1][4], spans_[-1][5] = a2, b2, i, False
            else:
                spans_.append([a1, a2, b1, b2, i, False])
        for a1, a2, b1, b2, _, _ in spans_:
            marked |= {ow[j][0] for j in range(b1, b2) if key(ot[ow[j][0]]) not in STOP or a2 - a1 > 0}
            frm = " ".join(bt[bw[j][0]] for j in range(a1, a2))
            to = " ".join(ot[ow[j][0]] for j in range(b1, b2))
            changes.append((frm, to))
        html_ = "".join(f'<mark class="df">{E(t)}</mark>' if i in marked else E(t) for i, t in enumerate(ot))
        return html_, changes

    def change_line(changes, base_tr):
        # The line names at most two swaps of a few words; small words added or dropped ("and", "the") and long
        # rewordings are counted, not spelled out, so the line stays one line a beginner can read.
        if not changes:
            return f"Same words as the {base_tr}"
        small = lambda t: all(key(w) in STOP for w in t.split()) if t else True
        named = [(f, t) for f, t in changes if f and t and len(f.split()) <= 4 and len(t.split()) <= 4 and not (small(f) and small(t))]
        shown = named[:2]
        rest = len(changes) - len(shown)
        if not shown:
            return "Worded differently throughout"
        line = " · ".join(f"{E(f)} → {E(t)}" for f, t in shown)
        return line + (f" · {rest} more {'change' if rest == 1 else 'changes'}" if rest else "")

    def cmp_block(vid, base_tr="BSB", others=("WEB", "KJV", "LSV"), show_base=True, label_verse=None):
        b_, c_, v_ = vid.split(".")
        get = lambda tr: (t5(b_, int(c_), int(v_), tr=tr) or [(0, "")])[0][1]
        base = get(base_tr)
        out = ""
        if label_verse:
            out += f'<h3 class="lbl cmpv">{label_verse}</h3>'
        if show_base:
            out += f'<div class="cmpb"><p class="cmpn">{base_tr} <span class="muted">· yours</span></p><p class="scrq0">{scripture(base) if base else ""}</p></div>'
        for tr in others:
            o = get(tr)
            h, ch = pair_diff(base, o)
            same = not ch
            if same:
                out += f'<div class="cmpo same" aria-label="{tr}: same words as the {base_tr}"><p class="cmpn">{tr}</p><p class="note muted">Same words as the {base_tr}</p></div>'
            else:
                out += (f'<div class="cmpo"><p class="cmpn">{tr}</p><p class="scrq0">{h}</p>'
                        f'<p class="note muted cmpl">{change_line(ch, base_tr)}</p></div>')
        return out

    def cmp_sheet(pos, title, body, scrolled=False):
        choose = '<button class="tbtn2 cmpc" aria-label="Choose translations to compare">Translations</button>'
        sh = sheet(pos, "Compare", title, body, scrolled=scrolled, foot=False).replace('aria-label="Close"', 'aria-label="Close, back to reading"', 1)
        return sh.replace('<div class="sbody">', f'<div class="sbody"><div class="cmptop">{choose}</div>', 1)
    j15 = reader("JHN", 1, 1, 6, scrolled=False, rows_override=t4("JHN", 1, 1, 6), sel=(5,))
    F("CP-01", "The bar’s Compare opens Compare itself: yours, then each version against yours", j15 + scrim() + cmp_sheet("med", "John 1:5", cmp_block("JHN.1.5")), "cp")
    under316 = reader("JHN", 3, 14, 18, scrolled=False, rows_override=t5("JHN", 3, 14, 18), sel=(16,)) + scrim()
    F("CP-02", "John 3:16: ‘only begotten’, ‘whosoever’, ‘everlasting’ now show, with one line each", under316 + cmp_sheet("lg", "John 3:16", cmp_block("JHN.3.16")), "cp")
    j11b = reader("JHN", 1, 1, 6, scrolled=False, rows_override=t4("JHN", 1, 1, 6), sel=(1,)) + scrim()
    agree = (f'<p class="claim">All four say the same.</p><p class="note muted">BSB, WEB, KJV and LSV</p>'
             f'<p class="kq">{E(t5("JHN", 1, 1)[0][1])}</p>')
    F("CP-03", "When they agree, it says so once (punctuation never counts)", j11b + cmp_sheet("med", "John 1:1", agree), "cp")
    c34 = reader("1CO", 14, 33, 36, sel=(34,), offset=-70) + scrim()
    F("CP-04", "1 Corinthians 14:34: the marks the old Compare missed", c34 + cmp_sheet("lg", "1 Corinthians 14:34", cmp_block("1CO.14.34")), "cp")
    rng_body = "".join(cmp_block(f"JHN.1.{v}", label_verse=f"1:{v}") for v in (3, 4, 5))
    F("CP-05", "Several verses (1:3–5): verse by verse, the same pattern", reader("JHN", 1, 1, 6, scrolled=False, rows_override=t4("JHN", 1, 1, 6), sel=(3, 4, 5)) + scrim()
      + cmp_sheet("lg", "John 1:3–5", rng_body), "cp")
    picks = "".join(vrow(n, f, on=on, right=(f'<span class="ck">{ic("check", 22)}</span>' if on else '<span class="ckoff"></span>'))
                    for n, f, on in (("WEB", "World English Bible", True), ("KJV", "King James Version", True), ("LSV", "Literal Standard Version", True),
                                     ("YLT", "Young’s Literal Translation · downloaded", False), ("NKJV", "New King James Version · online", False), ("NLT", "New Living Translation · online", False),
                                     ("MSG", "The Message · a paraphrase · online", False)))
    F("CP-06", "Choose, inside Compare: any one to three, tick to swap", j15 + scrim() + sheet("lg", "Choose", "Compare with up to 3", sec(None, picks, first=True)
      , back=True, foot=False), "cp")
    nk_body = (f'<div class="cmpb"><p class="cmpn">NKJV <span class="muted">· yours</span></p>{placeholder_text("NKJV text of John 1:5, from API.Bible")}</div>'
               + f'<div class="cmpo"><p class="cmpn">BSB</p>{placeholder_text("BSB text, its changes from the NKJV marked")}<p class="note muted cmpl">{todo_src("one line of changes")}</p></div>'
               + '<p class="note muted">If the NKJV can’t load: “The NKJV needs a connection”, and the others compare with the BSB, which says so.</p>')
    F("CP-07", "Reading the NKJV: it is ‘yours’ and the base, never silently swapped", j15.replace("John 1 · BSB", "John 1 · NKJV") + scrim() + cmp_sheet("med", "John 1:5", nk_body), "cp")
    # A paraphrase rewords whole sentences, so a word diff against it marks nearly everything and says nothing.
    # The Message is shown whole and unmarked, with one line saying why (build session, 12 Oct).
    para_body = (cmp_block("JHN.1.5", others=("WEB", "KJV"))
                 + f'<div class="cmpo"><p class="cmpn">The Message</p>{placeholder_text("The Message text of John 1:5, from API.Bible")}'
                 f'<p class="note muted cmpl">A paraphrase, so it isn’t marked word by word.</p></div>')
    F("CP-09", "Comparing with The Message: shown whole, unmarked, one line says why", j15 + scrim() + cmp_sheet("lg", "John 1:5", para_body), "cp")
    j54 = rd("JHN", 5, verses_gap("JHN", 5, 1, 7)) + scrim()
    gap_body = (f'<div class="cmpb"><p class="cmpn">BSB <span class="muted">· yours</span></p><p class="note muted">Not in the BSB.</p>{row("Why: not in the oldest manuscripts", cls="plain")}</div>'
                + "".join(f'<div class="cmpo"><p class="cmpn">{tr}</p><p class="scrq0">{E(t5("JHN", 5, 4, tr=tr)[0][1])}</p></div>' for tr in ("WEB", "KJV", "LSV")))
    F("CP-08", "Your version lacks the verse (John 5:4): it says so; nothing becomes the base", j54 + cmp_sheet("lg", "John 5:4", gap_body), "cp")

    NEXT_NOTES["refs_ux"] = (
        "Understand, UX pass · what a beginner sees, what's deeper, what a range does\n\n"
        "Tap a verse, tap Understand (UX-01): the medium detent is the whole beginner answer. Header: the verse and its passage ('The Word became flesh · 1:1–18'). "
        "Then What's happening (4 lines, More), Notice (3 lines, no labels), one row 'Readers differ on 2 questions here'. Nothing else above the fold: no Greek panel, no sources, no counts.\n\n"
        "Go deeper (UX-02) is the second half of the same sheet, reached by pulling up. Five groups named by the reader's question, never by source: "
        "In the original · In other translations · Who and where · Around this verse · What others say. Each row: name, one muted line of what's behind it, chevron. A group with nothing in it doesn't show. "
        "Everything new this release lands in a group: Key words (TW, dictionary), people and places, map, guide, See also, Themes, timeline, Study notes, readings. So Understand stops growing sections.\n\n"
        "Most verses have no Yada entry (UX-03): never empty. Who's here (people and places), then 'In this passage' from the guide, then the study note on the verse or its stretch, then Go deeper.\n\n"
        "Several verses: one answer, the passage guide. 1:1–18 selected → 'Understand 1:1–18' → the guide (UX-04/05), the same as the bar at rest. Part of a passage → the guide, 'Your verses' first, marked in the text (UX-06). "
        "Across two passages → the first guide with the next one row (UX-07). No guides in the book → verse by verse, a study note each (UX-08). Today a range opens a separate 'passage Understand' with no guide and no Compare: that screen goes.\n\n"
        "English only above the fold (a reader, 12 Oct: 'I thought the point was understanding the verse, not just seeing some Hebrew Greek words'). "
        "A notice that names a Greek or Hebrew word waits under In the original; English always leads and the original follows it (MC-02: 'loved ἠγάπησεν'). "
        "For John 1:1 that leaves 1 of 10 notices: the entries are written for Greek students. Layout can't fix that: the generation prompt must write plain-English notices "
        "(the original word as evidence underneath), and it must change before the 46-guide batch runs, or every guide repeats the problem. The PG frames on the guide page show the same issue.\n\n"
        f"Refs: Superpower, question-headed sections in a sheet {M('60e81a73-3dfd-4b4a-8310-e2ddb31cba21')} · Wise, one term, short sheet {M('b884dc4c-2841-4399-827c-2b27a21662a7')}. "
        f"Rejected: IMDb chips over an AI summary {M('34c2885c-9f58-4019-bc70-6ac398bf1d3f')}.")
    NEXT_NOTES["refs_cp"] = (
        "Compare · audit findings (12 Oct) and the redesign\n\n"
        "What's wrong today (apps/mobile): the bar's Compare opens Understand scrolled to a row, then a second sheet: two taps, both sheets. "
        "The diff marks a word only if no other version shares its stem, so 3,203 verses (10%) show four texts with nothing marked; 1 Cor 14:34 marks nothing; John 3:16 never shows 'only begotten' or 'everlasting'. "
        "Ranges have no Compare at all. NKJV/NLT are silently dropped and BSB becomes the base unlabelled. On John 5:4 a BSB reader gets WEB as the base. LORD loses small caps in your own text. Choose lives only in Contents › Translations. Tests pass (21/21) because they encode this.\n\n"
        "Redesign: the bar's Compare opens Compare as the first sheet (CP-01). Your translation on top, plain, labelled 'yours'. Each other version is diffed with yours alone, in word order; "
        "its changed words get the difference mark (wash + underline), and one muted line says what changed ('overcome → comprehended'). Same words → one line, no repeat of the text. "
        "All agree → said once (CP-03). Punctuation and case never count.\n\n"
        "Ranges: verse by verse (CP-05). Choose sits in Compare's header and pushes inside: one to three, tick to swap (CP-06). Licensed: the NKJV reader's NKJV is the base; if it can't load, it says so (CP-07). "
        "A verse missing from yours: 'Not in the BSB' with the manuscripts note, nothing promoted to base (CP-08). "
        "The Message is a paraphrase: a word diff would mark nearly every word, so it is shown whole and unmarked with one line, 'A paraphrase, so it isn't marked word by word' (CP-09). "
        "When The Message is the reader's own version, the others are listed unmarked for the same reason.\n\n"
        f"Refs: MacroFactor 'Changed from' with arrow {M('4e13dfe2-c783-4569-be53-efecd1c9f433')} · Brink highlighted words in running text {M('85897856-0025-41a1-8ed1-87c5b8e8e6dc')}. "
        f"Rejected: GitHub red/green diff {M('9af5c498-4c87-41c3-86ac-8c2153619679')} (colour carries the state; code, not reading).")
# ================= Notifications (next page, 12 Oct 2026) =================
# What, when and how, from the reader's side. Off until the reader asks; made on the iPhone (local notifications,
# no push server, nothing sent); one a day at most; never a streak, a count, "you missed" or "come back".
if STYLE != "v1":
    j51 = t5("JHN", 5, 1)[0][1]

    def notif(title, body, sub="Yada", when="now", expanded=False, actions=()):
        acts = "".join(f'<button class="nact">{E(a)}</button>' for a in actions) if expanded else ""
        return (f'<div class="ntf{" open" if expanded else ""}" role="group" aria-label="Yada. {E(title)}. {E(body)}">'
                f'<div class="nth">{yicon}<span class="ntapp">{E(sub)}</span><span class="ntw">{when}</span></div>'
                f'<p class="ntt">{E(title)}</p><p class="ntb">{scripture(body) if body else ""}</p></div>'
                + (f'<div class="nacts">{acts}</div>' if acts else ""))

    def lock_with(*cards, top=None):
        t_ = top or ""
        return f'<div class="lscr"><p class="lsd">Tuesday 13 October</p><p class="lst">7:30</p><div class="ntstack">{t_}{"".join(cards)}</div></div>'

    # ---- When we ask: after a first passage is finished, never at launch ----
    ask = (f'<button class="lrow numrow nx" aria-label="Next, {E(p2[1])}, John {prange(p2[0])}. Opens its guide">'
           f'<span class="rm"><span class="nxo">Next · {prange(p2[0])}</span><span class="lmain"><span class="nt">{E(p2[1])}</span></span></span>'
           f'<span class="chev nxc">{ic("right", 18)}</span></button>'
           + nrow("Remind me to read", "One reminder, at a time you choose"))
    ask_body = f'<section class="sec gtext first"><h3 class="lbl">The passage</h3>{verses_html(t4("JHN", 1, 17, 18), ch=1, book="JHN")}</section>' + sec(None, ask)
    F("NT-01", "When we ask: once, after the first passage is finished; never at launch", under_j + guide("lg", JLAB, "John 1:1–18", ask_body, scrolled=True), "nt")

    days = '<div class="days" role="group" aria-label="Days">' + "".join(
        f'<button class="day{" on" if on else ""}" aria-pressed="{"true" if on else "false"}" aria-label="{full_}">{d}</button>'
        for d, full_, on in (("M", "Monday", True), ("T", "Tuesday", True), ("W", "Wednesday", True), ("T", "Thursday", True), ("F", "Friday", True), ("S", "Saturday", True), ("S", "Sunday", True))) + "</div>"
    what = (vrow("The next passage", "Where you are in John, or your plan", on=True)
            + vrow("A passage for today", "One verse, the same for everyone that day"))
    preview = f'<div class="ntprev" aria-hidden="true">{notif("Next in John: The testimony of John the Baptist", t5("JHN", 1, 19)[0][1], when="7:30")}</div>'
    rem_body = (preview + sec("Time", lrow("Every day", right='<span class="valr">7:30</span>', chev=False, cls="valrow") + days, first=True)
                + sec("What it says", what)
                + '<p class="note muted">Made on this iPhone. Nothing about your reading is sent anywhere.</p>'
                + '<button class="wide" aria-label="Turn on the reminder. iPhone will ask to allow notifications">Turn on</button>')
    F("NT-02", "Reminder, before iOS asks: see it, pick a time and what it says", page(("Back", "Back to the guide"), "Reminder", rem_body), "nt")
    alert = ('<div class="ialert" role="alertdialog"><p class="iat">“Yada” Would Like to Send You Notifications</p>'
             '<p class="iab">Notifications may include alerts, sounds and icon badges. These can be configured in Settings.</p>'
             '<div class="iabtn"><button>Don’t Allow</button><button>Allow</button></div></div>')
    F("NT-03", "Then iOS asks, once (Apple’s own words)", page(("Back", "Back to the guide"), "Reminder", rem_body) + '<div class="scrim"></div>' + alert, "nt")

    # ---- What arrives ----
    n_next = notif(f"Next in John: {p5[1]}", j51)
    F("NT-04", "The reminder: the next passage by name and its first words", lock_with(n_next), "nt")
    F("NT-05", "Long-press: Read, or Listen (BSB) — no snooze, no guilt", lock_with(notif(f"Next in John: {p5[1]}", j51, expanded=True, actions=("Read", "Listen"))), "nt")
    F("NT-06", "A passage for today: the verse itself, public-domain text only", lock_with(notif("A passage for today", p231 + " Psalm 23:1")), "nt")
    F("NT-07", "On a plan: the next reading, never a day number", lock_with(notif("M’Cheyne · Reading 2", "Genesis 2 · Matthew 2 · Ezra 2 · Acts 2")), "nt")
    F("NT-08", "A book download finished while Yada was closed: one, then quiet", lock_with(notif("John is downloaded", "21 chapters, ready to listen offline.", when="2m ago")), "nt")

    # ---- When we stop, and how to change it ----
    paused = (f'<div class="pnote" role="status"><p class="claim">Reminders paused while you were away.</p>'
              f'<div class="pnb"><button class="tbtn2">Resume</button><button class="tbtn2 outline">Turn off</button></div></div>')
    F("NT-09", "Away for two weeks: reminders pause themselves and say so once, in the app", page(None, "Yada", paused + home_cont + allp, right=HOME_ICONS), "nt")
    off_body = (sec(None, '<p class="claim">Notifications are off for Yada in iPhone Settings.</p>'
                    + '<button class="tbtn2">Open Settings</button>', first=True)
                + sec("Time", lrow("Every day", right='<span class="valr">7:30</span>', chev=False, cls="valrow off")))
    F("NT-10", "If iOS says no: one sentence and the way to Settings, no nagging", page(("Home", "Home"), "Reminder", off_body), "nt")
    more_menu = ('<div class="menu" role="menu" style="top:110px;bottom:auto">'
                 + "".join(f'<button role="menuitem"><span>{n}</span></button>' for n in ("Recent", "Reading plans", "Settings")) + "</div>")
    F("NT-11", "Where it lives: Home › ⋯ › Reminder, beside Reading plans", page(None, "Yada", home_cont + allp + sec("Old Testament", ot), right=HOME_ICONS) + '<div class="menuscrim"></div>' + more_menu, "nt")

    NEXT_NOTES["refs_nt"] = (
        "Notifications · what, when and how (reader's side)\n\n"
        "WHAT. Four kinds, all optional except the last, which only follows the reader's own action:\n"
        "1. The reminder: the next passage by name and its first words ('Next in John: Healing at the pool'), or the plan's next reading (NT-04, NT-07).\n"
        "2. A passage for today: one verse from John's reviewed list, the text in the notification (NT-06). Off by default; chosen on the Reminder page.\n"
        "3. Download finished: only when a book download ends while Yada is closed (NT-08).\n"
        "4. Listening is the Live Activity, not notifications (WL-02).\n"
        "Never: streaks, counts, 'you missed', 'come back', new-feature news, badges on the icon, sounds by default, anything about other people.\n\n"
        "WHEN. Asked once, after the first passage is finished (NT-01), the moment the reader has felt the value. Never at launch, never repeated. "
        "One notification a day at most. The time is the reader's; days default to every day. "
        "After 14 days without opening Yada, reminders pause themselves; the app says so once on return, with Resume and Turn off (NT-09). No message is sent to announce the pause.\n\n"
        "HOW. Local notifications scheduled on the iPhone: no push server, no device token, nothing sent (privacy line holds). They work offline. "
        "The Reminder page shows the notification before iOS asks (NT-02), then Apple's alert (NT-03). Denied: one sentence and Open Settings (NT-10). It lives under Home › ⋯ (NT-11) until there is a Settings page.\n"
        "Interruption level: the reminder is active; a passage for today and downloads are passive (no sound, lands in the summary). Focus modes are respected by iOS.\n"
        "Tap: opens the guide of the next passage (or the plan's next reading). Long-press: Read, Listen (NT-05). Listen starts the BSB only.\n\n"
        "Rule 9: notifications are system surfaces, so the text is BSB, WEB, KJV or LSV only. A reader on the NKJV gets the BSB in the notification.\n"
        "VoiceOver: titles read references in words ('John 5, verses 1 to 15'). Every text fits two lines at default size; long verses are cut by iOS, never by us mid-word.\n\n"
        f"Refs: Vocabulary, the notification previewed before asking {M('81aab042-f4eb-4128-ae7b-db400cfda18b')} · Whering, time and repeat days {M('e76b879c-6cd9-4bd1-a600-7b1d81e1ae1a')} · "
        f"Fable, 'What time do you want to read?' {M('63fde944-72e0-4983-9089-2508eab01c25')} · Shelf, choose what you get {M('f0d66673-c197-4d90-b5a0-d729d7e7d72f')}. "
        f"Rejected: Duolingo '11 exercises left!' {M('48b9a512-c166-4c70-a6a7-6cb88e7b8145')} · Buddy '2x more likely to stick' {M('23767153-50be-411e-94d6-cb7fafac4eb5')} · "
        f"stoic, three a day with a pointing emoji {M('8a4d669c-f03b-4c62-bdcc-aa87f82c3123')}.")

# ================= A range gives at least as much as a verse (John, 12 Oct 2026) =================
# "I don't get as much from Understand 1:1–18 as I do one verse." The guide keeps its overview, then lists every
# verse with what is behind it (real data), then the same Go deeper groups at passage scope.
if STYLE != "v1":
    A18, B18 = o5("JHN", 1, 1), o5("JHN", 1, 18)

    def vbv(a, b):
        out = ""
        for v, t_ in t5("JHN", 1, a, b):
            o = o5("JHN", 1, v)
            own, rng = notes_for(o)
            has = []
            if f"JHN.1.{v}" in ENTRIES:
                has.append("Explained")
            if own:
                has.append("Study note")
            sp_, _ = speakers(f"JHN.1.{v}", f"JHN.1.{v}")
            if sp_:
                has.append("Speaking: " + " · ".join(sp_))
            sub = " · ".join(has) or "Words and translations"
            out += (f'<button class="row vbv" aria-label="Verse {v}. {E(t_)}. {E(sub)}. Opens Understand {v}">'
                    f'<span class="vbn">{v}</span><span class="rm"><span class="vbt">{E(t_)}</span><span class="note muted">{E(sub)}</span></span>'
                    f'<span class="chev">{ic("right", 18)}</span></button>')
        return sec("Verse by verse", out)
    logos18 = db5.execute("select count(*) from tokens t join lexemes l on l.occurrence_key=t.occurrence_key where t.ord between ? and ? and l.lemma='λόγος'", (A18, B18)).fetchone()[0]
    words18 = db5.execute("select count(*) from tokens where ord between ? and ?", (A18, B18)).fetchone()[0]
    notes18 = sdb.execute("select count(*) from notes where kind='note' and ord_start between ? and ?", (A18, B18)).fetchone()[0]
    deep18 = (f'<div class="deep"><h2 class="deeph">Go deeper in 1:1–18</h2>'
              + sec("In the original", nrow("Original Greek", f"{words18} words, verse by verse") + nrow("Key words", f"λόγος, word: {logos18} times in these verses"), first=True)
              + sec("In other translations", nrow("Compare translations", "Verse by verse, yours against each"))
              + sec("Who and where", nrow("John the Baptist", "Speaks in 1:15 · Glyssen") + nrow("Moses", "Named in 1:17"))
              + sec("Around this passage", nrow("See also", "Passages that connect, for the whole passage") + nrow("Themes", "Themes in this passage"))
              + sec("What others say", nrow("Where readers differ", "2 questions, in 1:1") + nrow("Study notes", f"Tyndale · {notes18} notes in these verses"))
              + "</div>")
    top18 = sec("Where we are", f'<p class="expl">{lang(first_sentence(G2["jhn.1.1"]["whats_happening"]))}</p>' + todo("Rest of the guide’s overview: three things, readers differ"), first=True)
    F("UX-09", "Understand 1:1–18 gives more than one verse: overview, then verse by verse", under_j + guide("lg", JLAB, "John 1:1–18", top18 + vbv(1, 7), scrolled=False), "ux")
    F("UX-10", "…then Go deeper for the whole passage, the same five groups", under_j + guide("lg", JLAB, "John 1:1–18", vbv(14, 18).replace('<section class="sec">', '<section class="sec first">', 1) + deep18, scrolled=True), "ux")
    NEXT_NOTES["refs_ux"] += (
        "\n\nRange ≥ verse (John, 12 Oct: 'I don't get as much from Understand 1:1–18 as I do one verse'). The guide keeps its overview, then 'Verse by verse': every verse in the passage, "
        "its words, and one muted line of what's behind it (Explained · Study note · Speaking: …), each opening that verse's full Understand inside the guide (UX-09). "
        "Then 'Go deeper in 1:1–18' with the same five groups at passage scope: Original verse by verse, key words with counts in the passage, Compare verse by verse, "
        "who speaks and who is named, See also and Themes, readers differ and study notes for all 18 verses (UX-10). So a range is the verse view times eighteen, plus the overview.")
# ================= No AI: Understand assembled from sources (John's decision, 12 Oct 2026) =================
# Every line is a published source shown as published (Tyndale, credited) or a fact from data dropped into a fixed
# sentence that John reviews once as a template. No generated prose, no cost. Example: 1 Corinthians 14:34–35.
if STYLE != "v1":
    O1434, O1435 = o5("1CO", 14, 34), o5("1CO", 14, 35)
    s1co = study_db("1CO")
    tn = s1co.execute("select text from notes where kind='note' and ord_start=? and ord_end=?", (O1434, O1435)).fetchone()[0]
    tn_paras = [p for k_, p in note_paras(tn) if k_ == "p"]
    TOSN = "Tyndale Open Study Notes, CC BY-SA 4.0"

    def occ_refs(lemma, book):
        return [r for (r,) in db5.execute("select v.verse_id from tokens t join lexemes l on l.occurrence_key=t.occurrence_key join verses v on v.ord=t.ord "
                                          "where l.lemma=? and v.book=? order by t.ord", (lemma, book))]
    sil = occ_refs("σιγάω", "1CO")
    sub = occ_refs("ὑποτάσσω", "1CO")
    sil_refs = [r.split(".", 1)[1].replace(".", ":") for r in sil]
    tr34 = {tr: t5("1CO", 14, 34, tr=tr)[0][1] for tr in ("BSB", "WEB", "KJV", "LSV")}

    # Template facts: the sentence is fixed (reviewed once); only the data in braces changes.
    notice_na = [
        ("Translations differ: “Women” (BSB) · “Let the wives” (WEB) · “Let your women” (KJV) · “Your women” (LSV).", "Compare"),
        (f"The word for “be silent” is used {len(sil)} times in 1 Corinthians, all in this chapter: {', '.join(sil_refs[:-1])} and here.", "Word counts: SBLGNT"),
        ("The word behind “submission” is also used in 14:32, a few verses earlier.", "Word counts: SBLGNT"),
    ]

    def fact_row(text_, src):
        return (f'<button class="row" aria-label="{E(text_)} Source: {E(src)}"><span class="rm"><span class="claim">{E(text_)}</span>'
                f'<span class="note muted">{E(src)}</span></span><span class="chev">{ic("right", 18)}</span></button>')
    along = [("1CO.11.5", "1 Corinthians 11:5"), ("1TI.2.11", "1 Timothy 2:11–12")]

    def along_rows():
        out = ""
        for vid, lab in along:
            b_, c_, v_ = vid.split(".")
            t_ = t5(b_, int(c_), int(v_))[0][1]
            out += (f'<button class="row xr" aria-label="{E(lab)}. {E(t_)}"><span class="rm"><span class="claim xref">{E(lab)}</span>'
                    f'<span class="xt">{E(t_)}</span></span><span class="chev">{ic("right", 18)}</span></button>')
        return out + '<p class="note muted credit">Both are named in the Tyndale note above.</p>'

    def whats_na(clamp=True):
        body = "".join(f'<p class="snote{" clamp" if clamp and i == 0 else ""}">{p}</p>' for i, p in enumerate(tn_paras[:1 if clamp else 3]))
        more = '<button class="more">Read the whole note</button>' if clamp else ""
        return sec("What’s happening", body + more + f'<p class="note muted credit">{TOSN} · on 14:34–35</p>', first=True)

    # ---- v2 of the no-AI layers (12 Oct): plain words from the UST, readings from the Translation Notes ----
    # Both CC BY-SA 4.0, read from their LICENSE.md (rule 3). Adapted copies drop the unfoldingWord® mark and say
    # what changed: alignment markup removed (UST); translator guidance removed (Translation Notes).
    import glob as _g, csv as _csv
    _csv.field_size_limit(10 ** 8)

    def ust_verses(path):
        src = open(path, encoding="utf8").read()
        src = re.sub(r"\\zaln-[se][^\\]*?\\\*", "", src)
        src = re.sub(r"\\w ([^|\\]*)\|[^\\]*\\w\*", r"\1", src)
        out, ch_, v_, buf = {}, 0, 0, []
        def flush():
            if ch_ and v_:
                t_ = re.sub(r"\\[a-z0-9-]+\*?", " ", re.sub(r"\\f .*?\\f\*", "", " ".join(buf))).replace("\\*", " ")
                out[f"{ch_}:{v_}"] = re.sub(r"\s+([,.;:!?’”])", r"\1", re.sub(r"\s+", " ", t_)).strip()
        for line in src.split("\n"):
            m = re.match(r"\\c (\d+)", line)
            if m:
                flush(); ch_, v_, buf = int(m.group(1)), 0, []; continue
            m = re.match(r"\\v (\d+)\s*(.*)", line)
            if m:
                flush(); v_, buf = int(m.group(1)), [m.group(2)]; continue
            if v_ and not re.match(r"\\(s\d?|ms|mt|toc|h|id|ide|usfm|sts|rem|cl)\b", line):
                buf.append(line)
        flush()
        return out
    UST1CO = ust_verses(_g.glob(f"{Y}/content/raw/uw-ust/en_ust/*-1CO.usfm")[0])
    TN1CO = [r for r in _csv.reader(open(_g.glob(f"{Y}/content/raw/uw-tn/en_tn/tn_1CO.tsv")[0], encoding="utf8"), delimiter="\t")][1:]
    tn_md = lambda t_: re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t_.replace("\\n", "\n")).replace("**", "")

    def readings(ref):
        out = []
        for r in TN1CO:
            if r[0] != ref:
                continue
            t_ = tn_md(r[6]).split("\n")[0]
            m = re.match(r"^(.*?)(?:could|may|might) (?:refer to|mean|indicate)[^:]*:\s*(\(1\).*)$", t_)
            if not m:
                continue
            opts = [re.sub(r"\s*(?:Alternate translation|For this interpretation)[^|]*$", "", o_).strip(" ;.") for o_ in re.split(r"\(\d\)\s*", m.group(2)) if o_.strip()]
            opts = [re.sub(r"\s*\(See:?[^)]*\)", "", re.sub(r"\s*In support of this view[^.]*\.?", "", o_)).strip(" ;.") for o_ in opts]
            lead = re.sub(r"^(?:Here,?\s*)", "", re.split(r"(?<=[.!?”])\s+", m.group(1).strip())[-1]).rstrip(",")
            out.append((lead, opts))
        return out

    def plain_words(ref, one_reading):
        t_ = E(UST1CO[ref])
        t_ = re.sub(r"\{([^}]*)\}", r'<span class="impl">\1</span>', t_)
        lab = "One plain reading" if one_reading else "In plain words"
        return (f'<p class="plainw">{t_}</p><p class="note muted credit">{lab} · words in grey are added to make the meaning clear · '
                f'Simplified Text, adapted from unfoldingWord, CC BY-SA 4.0</p>')

    def readings_sec(ref, first=False, clamp=True):
        # One fixed sentence per question (build session, 12 Oct; John reviews the template once):
        # "Some read “X” as A. Others read it as B. Still others, as C." Each reading capped at 18 words.
        rows_ = ""
        for lead, opts in readings(ref):
            def cap(o_):
                ws = re.split(r"(?<=[.!?])\s+", o_)[0].split()
                return (" ".join(ws[:18]).rstrip(",;: ") + "…", True) if len(ws) > 18 else (" ".join(ws).rstrip("."), False)
            vals = [cap(o_) for o_ in opts[:3]]
            phrase = re.sub(r"\s+and\s+", " and ", lead.lower())
            txt = f"Some read “{phrase}” as {vals[0][0]}. Others read it as {vals[1][0]}." + (f" Still others, as {vals[2][0]}." if len(vals) > 2 else "")
            more = '<button class="more">Read the full note</button>' if (any(f for _, f in vals) or len(opts) > 3) and clamp else ""
            rows_ += f'<div class="rdq"><p class="claim">{E(txt)}</p>{more}</div>'
        return sec("Readers differ", rows_ + '<p class="note muted credit">Translation Notes, adapted from unfoldingWord (translator guidance removed; readings set in a fixed sentence), CC BY-SA 4.0</p>', first=first)

    beginner_na = (sec("In plain words", plain_words("14:34", True), first=True)
                   + readings_sec("14:34")
                   + sec("Notice", "".join(fact_row(t_, s_) for t_, s_ in notice_na))
                   + sec("Read it alongside", along_rows()))
    beginner_na_v1 = (whats_na()
                   + sec("Notice", "".join(fact_row(t_, s_) for t_, s_ in notice_na))
                   + sec("Read it alongside", along_rows()))
    deep_na = (f'<div class="deep"><h2 class="deeph">Go deeper</h2>'
               + sec("In the original", nrow("Original Greek", f"{db5.execute('select count(*) from tokens where ord=?', (O1434,)).fetchone()[0]} words, each with its English")
                     + nrow("Key words", "Short articles: woman, church, submission"), first=True)
               + sec("In other translations", nrow("Compare translations", "WEB, KJV and LSV word it differently"))
               + sec("Around this verse", nrow("Order in the assembly", "The passage guide · 14:26–40")
                     + nrow("See also", "1 Timothy 2:11 · Genesis 3:16 · Numbers 30:3 · 14:35"))
               + sec("What others say", nrow("Study notes", "Tyndale · “This aside in the discussion on using spiritual gifts…”")
                     + nrow("Explained", "“In the churches”: the gatherings of believers who meet to worship God"))
               + "</div>")
    head_na = lambda pos, body, scrolled=False: usheet(pos, "1 Corinthians 14:34", "Order in the assembly · 14:26–40", body, scrolled=scrolled)
    c34b = reader("1CO", 14, 33, 36, sel=(34,), offset=-70, rows_override=t5("1CO", 14, 33, 36)) + scrim()
    if False: F("NA-01", "No AI · 14:34: plain words first, the two readings, facts, verses to read beside it", c34b + head_na("med", beginner_na + deep_na), "na")
    if False: F("NA-02", "No AI · pulled up: every reading in full, then Go deeper (Tyndale moves to Study notes)", c34b + head_na("lg", beginner_na.replace(" clamp2", "") + deep_na, scrolled=True), "na")

    # 14:34–35 selected: the passage guide, with the note that covers exactly these two verses first.
    pa = PERI.get("1CO.14.26-14.40", ("Order in the assembly", None))[0]
    pn = s1co.execute("select text from notes where kind='note' and ord_start=? and ord_end=?", (o5("1CO", 14, 26), o5("1CO", 14, 40))).fetchone()[0]
    pn_first = [p for k_, p in note_paras(pn) if k_ == "p"][0]
    sel_body = (sec("Your verses · 14:34–35 in plain words", plain_words("14:34", True).split('<p class="note')[0] + plain_words("14:35", True), first=True)
                + readings_sec("14:34") + readings_sec("14:35")
                + sec("Notice", "".join(fact_row(t_, s_) for t_, s_ in notice_na[1:]))
                + sec("Where we are", f'<p class="snote">{pn_first}</p><p class="note muted credit">{TOSN} · on 14:26–40</p>')
                + f'<section class="sec gtext"><h3 class="lbl">The passage</h3>{verses_html(t5("1CO", 14, 33, 36), sel=(34, 35), ch=14, book="1CO")}</section>')
    under_c2 = reader("1CO", 14, 26, 31, offset=-6, rows_override=t5("1CO", 14, 26, 31)) + scrim()
    F("NA-03", "No AI · 14:34–35 selected: the guide, the note on exactly these verses first", under_c2 + guide("lg", pa, "1 Corinthians 14:26–40", sel_body), "na")
    guide_na = (sec("Where we are", f'<p class="snote">{pn_first}</p><p class="note muted credit">{TOSN} · on 14:26–40</p>', first=True)
                + sec("Notice", fact_row(f"“Be silent” is asked three times in this passage: of a tongue-speaker ({sil_refs[0]}), a prophet ({sil_refs[1]}) and women ({sil_refs[2]}).", "Word counts: SBLGNT")
                      + fact_row("The passage is part of Paul’s teaching on spiritual gifts, chapters 12 to 14.", f"{TOSN} · on 12:1–14:40"))
                + sec("Verse by verse", "".join(
                    f'<button class="row vbv"><span class="vbn">{v}</span><span class="rm"><span class="vbt">{E(t_)}</span><span class="note muted">'
                    f'{"Study note" if s1co.execute("select 1 from notes where kind=? and ord_start<=? and ord_end>=? and ord_end-ord_start<=3", ("note", o5("1CO", 14, v), o5("1CO", 14, v))).fetchone() else "Words and translations"}'
                    f'</span></span><span class="chev">{ic("right", 18)}</span></button>' for v, t_ in t5("1CO", 14, 26, 30))))
    if False: F("NA-04", "No AI · the guide for 14:26–40: Tyndale on the passage, facts across it, verse by verse", under_c2 + guide("lg", pa, "1 Corinthians 14:26–40", guide_na), "na")

    NEXT_NOTES["refs_na"] = (
        "No AI · decided by John, 12 Oct 2026 · example: 1 Corinthians 14:34–35\n\n"
        "v2 (same day): 'In plain words' is the UST verse (unfoldingWord Simplified Text, CC BY-SA 4.0), its implied words in grey; labelled 'One plain reading' wherever the notes list readings. "
        "'Readers differ' is back, from unfoldingWord Translation Notes: notes that set out (1) … (2) …, translator guidance removed. Tyndale moves to Study notes. Measured over John and 1 Corinthians: "
        "plain line for 877/878 and 436/437 verses at reading grade 6.7 and 7.3 (Tyndale: 10–11); readings on 113 and 107 verses.\n\n"
        "Understand is assembled, not written. Three kinds of line only:\n"
        "1. A published source, shown as published and credited: the Tyndale note that covers the verse most tightly (here the note on 14:34–35), its first paragraph, More for the rest. NLT words in it stay marked (NLT), as on Study notes.\n"
        "2. A fact from the data in a fixed sentence: translations that word it differently (Compare's diff), a word's count and where else it appears (SBLGNT tokens), who speaks (Glyssen), people and places (TIPNR). John reviews each sentence template once; the data fills it.\n"
        "3. Verses to read beside it: the references the Tyndale note itself names (here 1 Cor 11:5 and 1 Tim 2:11–15), shown with their BSB text, so the reader weighs the texts directly.\n\n"
        "What the data shows on 14:34 without any AI: the translations split on 'women' and 'wives'; 'be silent' is asked three times in this chapter, of a tongue-speaker (14:28), a prophet (14:30) and women (14:34); "
        "the word behind 'submission' is also in 14:32; Tyndale's own note says to read it in light of 11:5, where women pray and prophesy.\n\n"
        "Gone: Yada's own 'What's happening' and 'Where readers differ' (no open source sets out the readings fairly). 'Read it alongside' carries the balance with primary texts instead. "
        "Not in the data, so not shown: that some manuscripts place 14:34–35 after 14:40 (needs an apparatus we don't have).\n\n"
        "The 7 reviewed AI entries (golden/) are retired from the app and kept in the repo as fixtures and a record. The 46-guide Opus batch is off; CEILING_USD can return to its earlier value.")
# ================= Settings (next page, 12 Oct 2026) =================
# Reminders made a Settings place worth having: plan additions §C said "once there are about four real
# preferences", and there are now eight. One page, rows that show their current value (Matter), no icons, no toggles
# that aren't real choices. Privacy and support links wait for the website (decision on file, 12 Oct).
if STYLE != "v1":
    def vrow2(name, value, label=None, chev=True):
        lab = label or f"{name}, {re.sub('<[^>]+>', '', value)}"
        chev_html = f'<span class="chev">{ic("right", 18)}</span>' if chev else ""
        return (f'<button class="lrow valrow" aria-label="{E(lab)}"><span class="rm"><span class="lmain">{E(name)}</span></span>'
                f'<span class="valr">{value}</span>{chev_html}</button>')
    settings_body = (
        sec("Reading", vrow2("Text and appearance", "Size 3 · System") + vrow2("Translation", "BSB") + vrow2("Compare with", "WEB, KJV, LSV"), first=True)
        + sec("Listening", vrow2("Voice", "Recorded reading") + vrow2("Speed", "1×"))
        + sec("Reminder", vrow2("Reminder", "7:30 · every day"))
        + sec("On this iPhone", vrow2("Downloads", todo_src("total from the manifest")) + vrow2("iCloud", "On"))
        + sec("About", vrow2("Sources and licences", "") + vrow2("Version", "1.0.0 (4)", chev=False))
        + sec(None, '<button class="lrow plainbtn" aria-label="Remove my data. Asks before removing">Remove my data</button>'))
    F("ST-01", "Settings: eight real choices, each row showing its value", page(("Home", "Home"), "Settings", settings_body), "st")

    dl_rows = (sec("Recorded readings", vrow2("John", todo_src("size from the manifest"), chev=False)
                   .replace('</button>', f'<span class="trbtn" aria-hidden="true">{ic("more", 22)}</span></button>', 1), first=True)
               + sec("Translations", vrow2("Young’s Literal Translation", "1.3 MB", chev=False))
               + sec("Study notes", vrow2("12 books", todo_src("measured: about 130 KB a book"), chev=False))
               + '<p class="note muted">Built-in texts are part of Yada and can’t be removed.</p>'
               + '<button class="lrow plainbtn" aria-label="Remove all downloads. Asks first">Remove all downloads</button>')
    F("ST-02", "Downloads: what is on this iPhone and its size; ⋯ removes one", page(("Settings", "Back to Settings"), "Downloads", dl_rows), "st")

    confirm = ('<div class="ialert" role="alertdialog" style="margin-top:-120px"><p class="iat">Remove your data?</p>'
               '<p class="iab">Bookmarks, your reading place, plan progress, the reminder and downloads will be removed from this iPhone and from your iCloud. This can’t be undone.</p>'
               '<div class="iabtn"><button>Cancel</button><button>Remove</button></div></div>')
    F("ST-03", "Remove my data: one alert that says exactly what goes, and where", page(("Home", "Home"), "Settings", settings_body) + '<div class="scrim"></div>' + confirm, "st")

    src_rows = (sec("Bible text", vrow2("Berean Standard Bible", "Public domain", chev=False) + vrow2("World English Bible", "Public domain", chev=False)
                    + vrow2("King James Version", "Public domain", chev=False) + vrow2("Literal Standard Version", "CC BY-SA 4.0", chev=False), first=True)
                + sec("Explanations", vrow2("Simplified Text", "unfoldingWord · CC BY-SA 4.0") + vrow2("Translation Notes", "unfoldingWord · CC BY-SA 4.0")
                      + vrow2("Tyndale Open Study Notes", "Adapted · CC BY-SA 4.0"))
                + sec("Words and people", vrow2("Greek New Testament", "SBLGNT · CC BY 4.0") + vrow2("Syntax", "MACULA · CC BY 4.0")
                      + vrow2("Speakers", "Glyssen · MIT") + vrow2("Cross-references", "OpenBible.info · CC BY 4.0"))
                + sec("Read online", vrow2("NKJV · NLT · The Message", "API.Bible · display only", chev=False))
                + '<p class="note muted">Adapted: alignment markup removed (Simplified Text); translator guidance removed and readings set in a fixed sentence (Translation Notes); '
                  'references and some quotations removed (Tyndale). Yada’s adapted data is shared under CC BY-SA 4.0, as these licences ask. Where it is published: to decide.</p>')
    F("ST-04", "Sources and licences: every source, plain role first, licence second", page(("Settings", "Back to Settings"), "Sources and licences", src_rows), "st")
    menu2 = ('<div class="menu" role="menu" style="top:110px;bottom:auto">'
             + "".join(f'<button role="menuitem"><span>{n}</span></button>' for n in ("Recent", "Reading plans", "Settings")) + "</div>")
    F("ST-05", "Where it lives: Home › ⋯ › Settings; the reader’s Aa stays as the shortcut", page(None, "Yada", home_cont + allp + sec("Old Testament", ot), right=HOME_ICONS.replace("More: Recent, Sources", "More: Recent, Reading plans, Settings"))
      + '<div class="menuscrim"></div>' + menu2, "st")

    NEXT_NOTES["refs_st"] = (
        "Settings · decisions\n\n"
        "Yes to a Settings page now: §C's trigger was 'about four real preferences'; there are eight (text and appearance, translation, Compare with, voice, speed, reminder, downloads, iCloud), plus Sources and licences and Remove my data. "
        "It replaces the separate Reminder and Sources entries under Home › ⋯ (ST-05); the reader's Aa sheet stays as the in-place shortcut, writing to the same setting.\n\n"
        "Rows name the choice and show its current value (ST-01). No icons, no colour, no toggles that aren't real choices. Remove my data is plain ink, not red; the alert says exactly what goes and that it reaches iCloud (ST-03). "
        "Downloads lists what is on the iPhone with real sizes from the manifest; built-in texts can't be removed (ST-02). Sources and licences carries the BY-SA credits the new sources require (ST-04).\n\n"
        "Not on the page until the website is live: privacy and support links (decision of 12 Oct). Not added: haptics, sounds, analytics, account; there is no account.\n\n"
        f"Refs: Matter grouped rows with values {M('77e7a8b4-0314-403c-b2f6-beb42d8b6dc8')} · Blinkist downloads with size {M('0f9f3d56-1d94-4181-8687-4036319245ed')}. "
        f"Rejected: Fable streak widget and red Delete account {M('b8a823c4-d43c-4506-8818-e608965bded1')} · Google TV coloured icon tiles {M('13577f13-8ff2-4789-ab1b-5a95a0df46d8')}.")
    # The reminder's old home and NT-11 note now point here.
    NEXT_NOTES["refs_nt"] = NEXT_NOTES["refs_nt"].replace("It lives under Home › ⋯ (NT-11) until there is a Settings page.", "It lives in Settings › Reminder (ST-01); NT-11 shows the earlier placement.")
# ================= IA v3: the whole app after this release (next page, 12 Oct 2026) =================
# Everything decided this session in one map: no AI, the passage as the unit, Settings, reading plans, notifications,
# Compare from the bar, licensed and downloaded translations, audio, widgets. One rule set, so the build has one
# answer for "where does this go".
if STYLE != "v1":
    N = node
    home_tree = N("Home", "the root; no tab bar", "",
        N("Lead", "one at a time: Start here (first launch) → Continue (mid-passage) → Next (passage finished)", kids=
            N("Passage guide", "opens at the passage the lead names", cls="new"))
        + N("Your plan", "“The Gospel of John · 9 of 46”: one line under the lead → the plan", cls="new")
        + N("Books", "Old Testament, New Testament → reader at chapter 1")
        + N("Search", "header · References → reader · Guides → guide · Words → word in the Bible · Dictionary (Translation Words) → term · People and places → profile · Verses → reader")
        + N("Bookmarks", "header")
        + N("⋯", "header · Recent · Reading plans · Settings", kids=
            N("Reading plans", "John passage by passage (was Start here) · M’Cheyne · each: next reading, no dates", cls="new")
            + N("Settings", "Text and appearance · Translation · Compare with · Voice · Speed · Reminder · Downloads · iCloud · Sources and licences · Remove my data", cls="new")))
    F("IA-11", "IA v3 · Home and the pages it opens", {"wide": diagram("light", "Home and its pages", home_tree,
      "Home is the only root. Pages (Reading plans, Bookmarks, Recent, Settings) push full-screen with ‹ Home. Start here is now the John plan inside Reading plans; "
      "Sources and Reminder moved into Settings; Search is a sheet over Home.")
      + diagram("light", "What changed from v2", N("Removed", "Original in the bar · separate Sources and Reminder entries · passage Understand for ranges · Yada’s AI entries", cls="gone")
        + N("Merged", "Start here + Reading plans → Reading plans › John · Aa sheet + Settings › Text (one setting, two doors) · All passages in John + plan progress → Your plan")
        + N("Added", "Settings · Reading plans · Compare as a sheet of its own · Swipe between chapters · Listen with recorded BSB · Notifications · Widgets", cls="new")
        + N("Kept", "the passage guide as the unit · two sheets at most · ‹ pushes inside a sheet · × names where it goes"),
        "Every move keeps one door per job; where two doors remain (Aa and Settings › Text), both write the same setting.")}, "i3")

    reader_tree = N("Reader · John 1 · BSB", "header: ‹ return chip · title → Contents (books, chapters, Translation row) · Aa", "depth 0",
        N("Swipe", "chapter to chapter; stops at a book’s end page")
        + N("Passage title", "above its first verse → Passage guide")
        + N("Missing verse line", "“Not in the oldest manuscripts” → the note (sheet)")
        + N("Bar at rest", "Understand 1:1–18 · Listen", kids=
            N("Passage guide", "Where we are (headline, summary, speaking, in time) · Notice · Verse by verse · Go deeper · Check what you read · Next", "depth 1", kids=
                N("Verse in the guide", "its Understand, pushed (‹ guide)", "depth 1, pushed"))
            + N("Listen", "mini player → full player · Voice sheet · Download"))
        + N("Verse selected", "Play from · Understand 1:1 · Compare · ⋯ Copy, Share, Bookmark", kids=
            N("Understand", "In plain words · Translators’ notes (BSB only) · Readers differ · Manuscripts · Notice · Read it alongside · Go deeper; the same on every translation, BSB-bound lines labelled (UX-11)", "depth 1", kids=
                N("Pushed pages", "whole note · person · place and map · dictionary term (Translation Words) · theme · order of events · See also (‹ back)", "depth 1, pushed")
                + N("Evidence", "a word, its uses; a verse to read alongside (peek → Read it → reader with a return chip)", "depth 2"))
            + N("Compare", "yours, then each version against yours · Choose pushes inside", "depth 1")))
    # The reader's tree is the tallest: its column takes more width so it fits the board without scrolling.
    F("IA-12", "IA v3 · The reader, its sheets and depth", {"wide": diagram("light", "Reader and sheets", reader_tree,
      "Depth 1 is one sheet: a passage guide, a verse’s Understand, Compare, Contents, Text, Search. Pages inside it push with ‹. Depth 2 is evidence only. Never a third sheet.").replace('<div class="dgw light">', '<div class="dgw light" style="flex:1.8">', 1)
      + diagram("light", "Depth rules", N("Depth 0", "the text; nothing covers it until the reader asks")
        + N("Depth 1", "one sheet; its header names what it is and its verse or passage; × says ‘back to reading’")
        + N("Pushed", "‹ inside the same sheet: whole note, profile, place, key word, theme, See also, Choose, verse in a guide")
        + N("Depth 2", "evidence: a word and its uses, a verse peek; × returns to depth 1")
        + N("Leaving", "‘Read it’ from a peek goes to the reader with a return chip (‹ 1 Cor 14:34)")
        + N("Ranges", "Understand 1:3–5 → the passage guide, your verses first · Compare 1:3–5, verse by verse"),
        "Ranges never get a thinner answer than a verse: the guide holds every verse’s Understand one tap down (UX-09).")}, "i3")

    sys_tree = N("From outside the app", "every door lands where it says", "",
        N("Widget · Continue", "reader at the place (BSB text in the widget, even for an NKJV reader)")
        + N("Widget · A passage for today", "reader at the verse")
        + N("Live Activity / Dynamic Island", "the full player")
        + N("Notification · reminder", "tap: the next passage’s guide · long-press: Read, Listen (BSB)")
        + N("Notification · download finished", "Settings › Downloads")
        + N("Spotlight · Siri · Shortcuts", "reader at the verse (BSB) · Continue reading · Listen to the next passage")
        + N("Share link", "reader at the verse"))
    rules = (N("Translation", "BSB by default; the reader’s pick becomes their default; BSB stands in only when theirs can’t be read, and says so")
             + N("Licensed (NKJV, NLT, The Message)", "display only: never read aloud, never on widgets, Siri, Spotlight or notifications; a connection needed; notice under the text")
             + N("No AI", "Understand and guides are assembled: sources as adapted and credited, data facts in fixed sentences")
             + N("Passage summaries", "ship when the six checks pass; flagged ones and a seeded sample go to John")
             + N("No images in reading", "no OBS illustrations, no photos")
             + N("Dictionary", "Translation Words is the dictionary this release (open, plain, already pinned): a term opens from Key words, Search or a tap in a note; the Aquifer Open Bible Dictionary only if a gap shows")
             + N("Accessibility", "every door a 44 pt target; VoiceOver actions for swipe; Reduce Motion cross-fades; AX5 stacks rows"))
    F("IA-13", "IA v3 · Doors from outside the app, and the rules that hold everywhere", {"wide": diagram("light", "System surfaces", sys_tree,
      "Nothing from outside opens a sheet on top of a sheet: each lands at depth 0 or 1.")
      + diagram("light", "Rules", rules, "These hold on every screen; a new feature finds its place by them before it is drawn.")}, "i3")

    plan_line = (f'<button class="lrow valrow" aria-label="Your plan, The Gospel of John, 9 of {NJ} passages read. Opens the plan">'
                 f'<span class="rm"><span class="lmain">The Gospel of John</span><span class="note muted lsub">Your plan</span></span>'
                 f'<span class="chev">{ic("right", 18)}</span></button>')
    home_v3 = page(None, "Yada", home_cont + plan_line + sec("Old Testament", ot), right=HOME_ICONS.replace("More: Recent, Sources", "More: Recent, Reading plans, Settings"))
    F("IA-14", "IA v3 · Home: one lead, your plan in one line, the books", home_v3, "i3")

    NEXT_NOTES["refs_i3"] = (
        "IA v3 · decisions (12 Oct 2026)\n\n"
        "One root, Home; no tab bar (the app has one job, reading). Pages push from Home; sheets rise over the reader; never more than two sheets.\n\n"
        "Doors, one per job: Understand (bar) for a passage or verse; Compare (bar) for wording; Listen (bar); Contents (title); Text (Aa, and Settings › Text, same setting); "
        "everything else (plans, settings, sources, reminder, downloads) under Home › ⋯.\n\n"
        "Merges: Start here becomes the John plan in Reading plans; Home's ‘All passages in John’ and the progress sentence become one ‘Your plan’ line (IA-14). "
        "Sources and Reminder live in Settings. Range Understand is the passage guide; the separate passage-Understand screen goes.\n\n"
        "Translation: BSB default; the reader’s choice persists (state/settings.ts already saves it); BSB stands in only when theirs can’t be read, and the screen says so.\n\n"
        "Builds on IA-01–08 (guide page): the passage is the unit; Original is evidence, not a door.")
# ================= Understand on another translation (next page, 12 Oct 2026) =================
# John asked whether Understand works the same on other translations. The layers are the same; three lines are bound
# to the BSB (its translators' footnotes, the word fact's rendering, the evidence marks) and say so or step aside.
if STYLE != "v1":
    kjv34 = t5("1CO", 14, 34, tr="KJV")[0][1]
    diffs = []
    for tr in ("BSB", "WEB", "LSV"):
        _, ch_ = pair_diff(kjv34, t5("1CO", 14, 34, tr=tr)[0][1])
        for f_, t_ in ch_:
            if f_ and t_ and len(f_.split()) <= 4 and len(t_.split()) <= 4 and re.search(r"silen|keep|quiet", f_ + t_):
                diffs.append((f_, t_, tr)); break
    dline = ("Translations differ: “" + diffs[0][0] + "” (KJV) · " + " · ".join(f"“{t_}” ({tr})" for _, t_, tr in diffs) + ".") if diffs else None
    kjv_facts = ([(dline, "Compare · your KJV against the others")] if dline else []) + [
        (f"In the BSB, “are to be silent” translates a word used {len(sil)} times in 1 Corinthians, all in this chapter: {', '.join(sil_refs[:-1])} and here.", "Word counts: SBLGNT · BSB rendering from the Berean tables")]
    kjv_body = (sec("In plain words", plain_words("14:34", True), first=True)
                + readings_sec("14:34")
                + sec("Notice", "".join(fact_row(t_, s_) for t_, s_ in kjv_facts))
                + sec("Read it alongside", along_rows())
                + '<span class="wb" aria-hidden="true">Canvas note: the BSB translators’ footnotes step aside on the KJV; marks show only on BSB text</span>')
    c34k = reader("1CO", 14, 33, 36, sel=(34,), offset=-70, tr="KJV", rows_override=t5("1CO", 14, 33, 36, tr="KJV")) + scrim()
    F("UX-11", "Reading the KJV: the same Understand; BSB-bound lines say ‘in the BSB’ or step aside", c34k + usheet("med", "1 Corinthians 14:34", "Orderly Worship · 14:26–40", kjv_body), "ux")
    NEXT_NOTES["refs_ux"] += (
        "\n\nOn other translations (John, 12 Oct): the layers are the same. Translation-independent: In plain words (UST), Readers differ (tN, keyed to the Greek), Manuscripts, "
        "Read it alongside, Key words, Check what you read, Study notes. BSB-bound, and what they do elsewhere: (1) the BSB translators' footnotes ('Or …', 'Literally …') show only when reading the BSB; "
        "(2) a word fact quotes the BSB's rendering, so it says 'In the BSB, …'; (3) evidence marks need a word alignment, which only the BSB has (Berean tables), so marks show on BSB text only. "
        "Translation differences use the reader's own version as the base, like Compare (UX-11 on the KJV). On NKJV, NLT or The Message the same holds, the licensed text is only displayed, "
        "and the plain line, readings and facts never touch it (rule 9).")
# ================= Dictionary (next page, 12 Oct 2026) =================
# John asked how the dictionary shows up. This release's dictionary is unfoldingWord Translation Words (CC BY-SA 4.0,
# pinned): the Definition/Facts section only, translator suggestions dropped; which terms a verse uses comes from
# Translation Word Links. Doors: Understand › Key words, Search, and a browse page. No inline links in the text: they
# would clash with the evidence mark and make poor 44 pt targets.
if STYLE != "v1":
    import csv as _csv2
    TWR = f"{Y}/content/raw/uw-tw/en_tw/bible"
    def tw(kind, slug):
        t = open(f"{TWR}/{kind}/{slug}.md", encoding="utf8").read()
        t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t).replace("**", "")
        title = re.match(r"#\s*(.+)", t).group(1).split(",")[0].strip()
        sec_ = re.search(r"##\s*(?:Definition|Facts):?\s*\n(.*?)(?=\n##|\Z)", t, re.S).group(1).strip()
        paras = [p.strip() for p in sec_.split("\n\n") if p.strip()]
        first = paras[0]
        bullets = [b[2:].strip() for p in paras[1:] for b in p.split("\n") if b.startswith("* ")][:3]
        rel = re.findall(r"\(See also: (.*)\)", t)
        rel = [x.strip() for x in rel[0].split(",")] if rel else []
        return title, first, bullets, rel
    TWL1CO = [r for r in _csv2.reader(open(f"{Y}/content/raw/uw-twl/en_twl/twl_1CO.tsv", encoding="utf8"), delimiter="\t")][1:]
    def refs_of(slug):
        return [r[0] for r in TWL1CO if r[5].endswith("/" + slug)]
    TW_CREDIT = "Translation Words, adapted from unfoldingWord (definition only) · CC BY-SA 4.0"
    terms = [("kt", "church"), ("other", "submit"), ("kt", "lawofmoses")]
    def first_sentence_(t):
        return re.split(r"(?<=[.!?])\s+", t)[0]
    kw_rows = ""
    for kind, slug in terms:
        title, first, _, _ = tw(kind, slug)
        kw_rows += nrow(E(title), first_sentence_(first))
    key_words_sec = sec("Key words", kw_rows + f'<p class="note muted credit">{TW_CREDIT}</p>', first=True)
    F("DI-01", "Understand 14:34, Go deeper: Key words, each with its first sentence", c34b + usheet("lg", "1 Corinthians 14:34", "Orderly Worship · 14:26–40", key_words_sec, scrolled=True), "di")

    title, first, bullets, rel = tw("kt", "church")
    rc = refs_of("church")
    term_body = (sec(None, f'<p class="expl">{E(first)}</p>' + "".join(f'<p class="snote">{E(b)}</p>' for b in bullets), first=True)
                 + sec(f"In 1 Corinthians · {len(rc)} places", "".join(row(E("1 Corinthians " + r), extra=f'<span class="note muted xt">{E(t5("1CO", int(r.split(":")[0]), int(r.split(":")[1]))[0][1])}</span>') for r in rc[:3])
                       + f'<button class="more">Show all {len(rc)}</button>')
                 + sec("Related", "".join(nrow(E(x), "Dictionary") for x in rel))
                 + f'<p class="note muted credit">{TW_CREDIT}</p>')
    F("DI-02", "A term’s page, pushed inside the sheet: definition, where this book uses it, related terms", c34b + sheet("lg", title, "Dictionary", term_body, back=True, foot=False), "di")

    nv_ch = db5.execute("select v.verse_id, t.text from verses v join texts t on t.ord=v.ord where t.translation='BSB' and t.text like '%church%' order by v.ord limit 3").fetchall()
    n_ch = db5.execute("select count(*) from texts where translation='BSB' and text like '%church%'").fetchone()[0]
    srd2 = (sec("Dictionary", lrow("church", sub=E(first_sentence_(first))) + lrow("assembly", sub="Dictionary"), first=True)
            + sec(f"Verses · {n_ch}", "".join(lrow(f'<span class="excerpt2">{bold(t, "church")}</span>', cls="passage").replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, t in nv_ch)))
    F("DI-03", "Search: a term finds its dictionary entry before the verses", home_under + search_sheet("church", srd2), "di")

    import os as _os
    def tw_titles(kind, n):
        out = []
        for f in sorted(_os.listdir(f"{TWR}/{kind}"))[:n]:
            if f.endswith(".md"):
                out.append(re.match(r"#\s*(.+)", open(f"{TWR}/{kind}/{f}", encoding="utf8").read()).group(1).split(",")[0].strip())
        return out
    n_kt, n_names, n_other = (len([f for f in _os.listdir(f"{TWR}/{k}") if f.endswith(".md")]) for k in ("kt", "names", "other"))
    browse = (sec(f"Key words · {n_kt}", "".join(lrow(E(x), chev=True) for x in tw_titles("kt", 4)) + f'<button class="more">Show all {n_kt}</button>', first=True)
              + sec(f"People and places · {n_names}", "".join(lrow(E(x)) for x in tw_titles("names", 3)) + f'<button class="more">Show all {n_names}</button>')
              + sec(f"Other words · {n_other}", "".join(lrow(E(x)) for x in tw_titles("other", 3)) + f'<button class="more">Show all {n_other}</button>')
              + f'<p class="note muted credit">{TW_CREDIT}</p>')
    F("DI-04", "Browse the dictionary: from Search’s empty state, grouped, no tab", page(("Search", "Back to Search"), "Dictionary", browse), "di")

    # Understand on a licensed translation: identical, because it is about the verse, not the version.
    nkjv_reader = rd("1CO", 14, placeholder_text("NKJV text of 1 Corinthians 14:33–36, as API.Bible sends it. Licensed: not reproduced on the canvas."), tr="NKJV") + scrim()
    F("UX-12", "Reading the NKJV: Understand is the same, because it is about the verse, not the version", nkjv_reader + head_na("med", beginner_na), "ux")

    NEXT_NOTES["refs_di"] = (
        "Dictionary · how it shows up (John asked, 12 Oct)\n\n"
        f"Source: unfoldingWord Translation Words ({n_kt} key terms, {n_names} people and places, {n_other} other words), Definition/Facts only; Translation Word Links say which terms a verse uses. "
        "This release's dictionary; the Aquifer Open Bible Dictionary only if a gap shows.\n\n"
        "Three doors, no inline links: (1) Understand › Go deeper › Key words, each term with its first sentence (DI-01); (2) Search, where a term comes before verses (DI-03); "
        "(3) Browse, from Search's empty state, grouped and counted (DI-04). A term's page pushes inside the sheet: definition, up to three points, where this book uses it, related terms (DI-02).\n\n"
        "Why no tappable words in the text: the dotted underline already means 'evidence for a claim', and a word inside a sentence isn't a 44 pt target. Key words lists the same terms as rows.\n\n"
        "UX-12: on NKJV, NLT or The Message, Understand is identical; it is keyed to the verse and built from the Greek and open sources, never from the licensed text, which is only displayed (rule 9).")
# ================= Edge states found in the UX pass (next page, 12 Oct 2026) =================
if STYLE != "v1":
    # 1. A passage whose summary is flagged: the guide never shows unreviewed prose and never goes empty.
    m169 = t5("MRK", 16, 9, 11)
    mfact = "Some early manuscripts end the Gospel of Mark after verse 8. Other manuscripts contain only a short ending."
    eg1 = (sec("Where we are", f'<p class="claim">{E(mfact)}</p><p class="note muted credit">BSB footnote · public domain</p>', first=True)
           + sec("Verse by verse", "".join(f'<button class="row vbv"><span class="vbn">{v}</span><span class="rm"><span class="vbt">{E(t_)}</span><span class="note muted">Words and translations</span></span><span class="chev">{ic("right", 18)}</span></button>' for v, t_ in m169))
           + '<span class="wb" aria-hidden="true">Canvas note: the summary is flagged (no headline), so it is held back until John fixes it; the guide keeps its facts and its verses</span>')
    mk16 = reader("MRK", 16, 9, 14, scrolled=False, rows_override=t5("MRK", 16, 9, 14)) + scrim()
    F("EG-01", "A flagged summary in the app: held back; the guide keeps its facts and its verses", mk16 + guide("lg", "Jesus Appears to Mary Magdalene", "Mark 16:9–11", eg1), "eg")

    # 2. Understand before a book's bundle is on the iPhone, offline: what core holds still shows.
    l154 = reader("LUK", 15, 1, 7, sel=(4,), scrolled=False, rows_override=t5("LUK", 15, 1, 7)) + scrim()
    eg2 = (sec(None, '<p class="note muted offl">Understand for Luke downloads when you’re online.</p>', first=True)
           + sec("Go deeper", nrow("Original Greek", f"{db5.execute('select count(*) from tokens where ord=?', (o5('LUK', 15, 4),)).fetchone()[0]} words, each with its English")
                 + nrow("Compare translations", "WEB, KJV, LSV")))
    F("EG-02", "Understand offline before Luke’s bundle is saved: one line, and what is already on the iPhone", l154 + usheet("med", "Luke 15:4", "The Parable of the Lost Sheep", eg2), "eg")

    # 3. Listening while the page shows a licensed version: the audio is the BSB, so the read-along stops and says why.
    nk_page = rd("JHN", 1, opener_btn + placeholder_text("NKJV text of John 1:1–9 (licensed, display only)"), tr="NKJV")
    # The line lives inside the player, as its first row, so it moves with the player at every text size.
    m5 = mini(5).replace("Verse 5 · BSB", "Verse 5").replace('<div class="mp-row">', '<div class="mpline" role="status"><span class="note muted">Audio is the BSB</span><button class="clink" aria-label="Read along in the BSB. Switches this page to the BSB">Read along in the BSB</button></div><div class="mp-row">', 1)
    eg3 = nk_page + m5
    F("EG-03", "Listening while reading the NKJV: ‘Audio is the BSB’, and one tap to read along in it", eg3, "eg")

    # 4. Swiping into a licensed chapter that isn't saved, offline.
    off2 = rd("JHN", 2, '<div class="offpg"><p class="empty">John 2 in the NKJV needs a connection.</p><button class="clink">Read in the BSB</button></div>', tr="NKJV")
    nk1 = rd("JHN", 1, opener_btn + placeholder_text("NKJV text of John 1 (saved)"), tr="NKJV")
    F("EG-04", "Swiping into a licensed chapter that isn’t saved, offline: the same one sentence and the way on", f'<div class="pane" style="transform:translateX(-46%)">{nk1}</div><div class="pane edge" style="transform:translateX(54%)">{off2}</div>', "eg")

    # 5. Widgets before any reading: Start here, never an empty box.
    first_w = (f'<button class="wg sm" aria-label="Start here, The Gospel of John. Opens the first passage"><span class="wgl">Start here</span>'
               f'<span class="wgr">The Gospel of John</span><span class="wgt">One passage at a time, explained.</span></button>')
    F("EG-05", "Widget before anything is read: Start here, the same as Home", (f'<div class="hscr"><div class="sbar"><span>9:41</span></div>'
      f'<div class="wgrid">{first_w}<div class="apps4">{apps(4, 3)}</div></div>{w_med("Psalm 23:1", p231, "A passage for today")}</div>'), "eg")

    # 6. Search while reading a licensed version: it searches what is on the iPhone, and says so once.
    # Search follows the reader's translation (John, 12 Oct): on the NKJV, NLT or The Message it asks API.Bible's search
    # through the proxy, live and never stored (display only, rule 9); offline, it searches the BSB and says so once.
    nk_rows = "".join(lrow(f'<span class="excerpt2">{placeholder_text("NKJV verse text, from API.Bible search")}</span>', cls="passage")
                      .replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, _ in nv_ch[:3])
    sr6 = (sec("Verses in the NKJV", nk_rows, first=True)
           + sec("Also", lrow("Search the BSB instead", sub="on this iPhone · with Words and Dictionary", chev=True))
           + f'<p class="note muted">{todo_src("NKJV copyright notice, exactly as API.Bible returns it (§7)")}</p>')
    F("EG-06", "Search while reading the NKJV: it searches the NKJV, online", home_under + search_sheet("church", sr6), "eg")
    sr7 = (sec(None, '<p class="note muted offl">You’re offline, so this searches the BSB.</p>', first=True)
           + sec("Verses · 108", "".join(lrow(f'<span class="excerpt2">{bold(t, "church")}</span>', cls="passage").replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(fref(r))}</span>', 1) for r, t in nv_ch)))
    F("EG-07", "Search on the NKJV, offline: the BSB, said once", home_under + search_sheet("church", sr7), "eg")

    NEXT_NOTES["refs_eg"] = (
        "UX pass · edge states and depth (12 Oct)\n\n"
        "Drawn: EG-01 flagged summary held back (facts and verses stay) · EG-02 Understand offline before a book's bundle · EG-03 listening while reading a licensed version · "
        "EG-04 swipe into an unsaved licensed chapter offline · EG-05 widget before any reading · EG-06 Search scope on a licensed version.\n\n"
        "Decided, not drawn:\n"
        "• VoiceOver reads the plain line as one sentence; the grey added words are read normally, and the section's hint says once: 'Words in grey are added for meaning'.\n"
        "• A dictionary term this book never uses shows 'Elsewhere in the Bible · N' instead of 'In <book> · 0'.\n"
        "• Read it alongside and peeks show BSB text, labelled 'BSB', when the reader is on a licensed version.\n"
        "• A plan's last reading: one quiet line ('You’ve read all 365 readings'), no celebration; the reminder then follows the reader's place.\n"
        "• Remove my data during a download: the download stops first; the alert already lists downloads.\n"
        "• Settings › Downloads lists Understand bundles per book with their size (about the study notes' scale).\n"
        "• Depth: guide › verse › key word › term is three pushes in one sheet; each ‹ names where it goes back to (‹ John 1:1), so the stack never feels lost.\n"
        "• A book not yet rolled out keeps the study-notes Understand (SN-03) and GD-04's guide-less reader.\n"
        "• Two-verse sayings whose sentences lean (Luke 13:18–21) stay flagged until John's sample says whether to merge them with a neighbour.")
# ================= John's round: Psalms, prophets, one order for every screen (next page, 12 Oct 2026) =================
# From John's review of the Genesis, Psalms and Isaiah tests. Every line below is read from the pipeline's own drafts
# (docs/research/passage-summaries-*-draft.txt) or from core.v5, never typed in: the canvas shows what ships.
if STYLE != "v1":
    def draft_block(book_file, rng):
        # One passage's block from the summary drafts, as {kind: text}; the summary body under "body".
        lines_ = open(f"{Y}/.claude/worktrees/next-release/docs/research/passage-summaries-{book_file}-draft.txt", encoding="utf8").read().split("\n== ")
        blk = next(b_ for b_ in lines_ if f"({rng})" in b_.split("\n")[0])
        out = {"label": blk.split("\n")[0].rsplit(" (", 1)[0]}
        for ln in blk.split("\n")[1:]:
            ln = re.sub(r"\s+\[[^\]]*\]$", "", ln.strip())
            m_ = re.match(r"^(Written when|The turn|The picture|What kind|What it’s for|About this psalm|Part of|What happens|Setting|Speaking): (.*)$", ln)
            if m_:
                out[m_.group(1)] = m_.group(2)
            elif ln and not ln.startswith(("[", "passes", "FLAGGED")) and "body" not in out:
                out["body"] = ln
        return out

    def sources_sec(items):
        # Credits grouped once at the bottom (John, 12 Oct): each source named once, "adapted" where Yada changed it.
        return (f'<section class="sec srcs"><h3 class="lbl">Sources</h3><p class="note muted">{" · ".join(E(i_) for i_ in items)}</p>'
                f'<button class="more">Licences</button></section>')

    # ---- Psalm 51 in the reader: the one-time tip, then at most two lines, then the psalm ----
    p51 = draft_block("psalms", "51:1–51:19")
    p271 = t5("PSA", 27, 1)[0][1].replace("Of David. ", "", 1)
    rows51 = t5("PSA", 51, 1, 4)
    sup51 = re.match(r"^((?:[^.]+\.\s+){2}When [^.]+\.\s+)", rows51[0][1]).group(1)
    # Approved by John (12 Oct): both halves of the verse, each on its own line, because the second half is the point.
    # The BSB's own punctuation is kept (dashes, not the semicolons in John's note): the text is never altered.
    halves = [h_.strip() for h_ in re.split(r"(?<=\?)\s+", p271, maxsplit=1)]
    tip = (f'<div class="ptip" role="note"><p class="ptipt">Hebrew poetry often says one thing twice, in different words.</p>'
           + "".join(f'<p class="ptipq">{E(h_)}</p>' for h_ in halves) + '<p class="note muted">Psalm 27:1, BSB</p>'
           f'<button class="clink" aria-label="Got it, hides this tip">Got it</button></div>')
    plines = "".join(f'<p class="pline">{E(p51[k_])}</p>' for k_ in ("Written when", "What kind") if k_ in p51)
    about_btn = f'<button class="clink abtp" aria-label="About this psalm. Title, the picture, how it moves">About this psalm{ic("right", 14)}</button>'
    ps_open = f'<button class="opener olink" aria-label="{E(p51["label"])}. Opens the guide"><span>{E(p51["label"])}</span>{ic("right", 14)}</button>'
    ps51 = lambda tip_: rd("PSA", 51, (tip_ if tip_ else "") + ps_open + plines + about_btn + verses_html(rows51, ch=51, sup=sup51, book="PSA"))
    F("JR-01", "Psalm 51, the first psalm a reader opens: the tip once, then two lines before the psalm", ps51(tip), "jr")
    F("JR-02", "Psalm 51 after: Written when and What kind; everything else waits behind About this psalm", ps51(None), "jr")

    about = p51.get("About this psalm", "")
    parts = [x.split(": ", 1) for x in about.split(" | ") if ": " in x]
    moves = [t_ for k_, t_ in parts if k_ == "How it moves"]
    ab_body = (sec("Title", f'<p class="claim">{E(sup51.strip())}</p>', first=True)
               + "".join(sec(k_, f'<p class="claim">{E(t_)}</p>') for k_, t_ in parts if k_ == "The picture")
               + sec("How it moves", "".join(f'<p class="claim mvl">{E(m_)}</p>' for m_ in moves))
               + sources_sec(["Berean Standard Bible, public domain", "Translation Notes, adapted from unfoldingWord, CC BY-SA 4.0"]))
    F("JR-03", "About this psalm: title, the picture, how it moves; sources once at the bottom", ps51(None) + scrim() + usheet("med", "About this psalm", "Psalm 51", ab_body), "jr")

    # ---- Isaiah 40: the plain section name and one setting line above the passage ----
    i40 = draft_block("isaiah", "40:1–40:5")
    rows40 = t5("ISA", 40, 1, 5)
    i40_top = (f'<p class="secname">{E(i40["Part of"].rstrip("."))}</p><p class="pline">{E(i40["Setting"])}</p>'
               + f'<button class="opener olink" aria-label="{E(i40["label"])}. Opens the guide"><span>{E(i40["label"])}</span>{ic("right", 14)}</button>')
    F("JR-04", "Isaiah 40: the section in plain words, and when and to whom, before the text", rd("ISA", 40, i40_top + verses_html(rows40, ch=40, book="ISA")), "jr")

    # ---- One order for every genre: In short → Readers differ → Read it alongside → More, then Sources ----
    i40_body = (sec("In short", f'<p class="claim"><b>{E(i40["Part of"])}</b></p><p class="snote">{E(i40["body"])}</p><p class="note muted">{E(i40["Setting"])}</p>', first=True)
                + sec("Read it alongside", f'<p class="note muted">{todo_src("Tyndale-named references for 40:1–5")}</p>')
                + sec("More", nrow("Verse by verse", "5 verses, each with its Understand") + nrow("Key words", "comfort · glory · the LORD")
                      + nrow("Check what you read", "Questions from the passage")))
    i40_body += sources_sec(["Translation Questions and Simplified Text, adapted from unfoldingWord", "Translation Notes outline and introduction, adapted", "CC BY-SA 4.0"])
    under40 = rd("ISA", 40, i40_top + verses_html(rows40[:3], ch=40, book="ISA")) + scrim()
    F("JR-05", "Isaiah 40:1–5 guide: the same four slots as every genre; no readings here, so that slot is absent", under40 + guide("lg", i40["label"], "Isaiah 40:1–5", i40_body), "jr")

    # Understand on a verse, same order. 1 Cor 14:34: readings in two of the three approved wordings.
    import subprocess as _sp, json as _json
    _env = {**os.environ, "YADA_ROOT": Y}
    _code = ("import sys,json;sys.argv=['x'];sys.path.insert(0,'.');import assemble as a;"
             "r=a.assemble('1CO',14,34);print(json.dumps([d['sentence'] for d in r['beginner']['readers_differ']]))")
    rd34 = _json.loads(_sp.run([sys.executable, "-I", "-c", _code], cwd=f"{Y}/.claude/worktrees/next-release/packages/pipeline/prototypes",
                               env=_env, capture_output=True, text=True, check=True).stdout)
    u34 = (sec("In short", plain_words("14:34", True), first=True)
           + sec("Readers differ", "".join(f'<div class="rdq"><p class="claim">{E(s_)}</p><button class="more">Read the full note</button></div>' for s_ in rd34[:2]))
           + sec("Read it alongside", along_rows().split('<p class="note muted credit">')[0])
           + sec("More", nrow("Notice", "3 facts from the text") + nrow("Key words", "woman, church, submission")
                 + nrow("Original Greek", "words, each with its English") + nrow("Study notes", "Tyndale")))
    u34 += sources_sec(["Simplified Text and Translation Notes, adapted from unfoldingWord, CC BY-SA 4.0", "Tyndale Open Study Notes, CC BY-SA 4.0", "BSB, public domain"])
    if False: F("JR-06", "Understand 14:34 in the same order; readings in two of the three wordings; sources once", c34b + head_na("lg", u34), "jr")

    # Isaiah 7:14, a major debate: the slot shows only a note John (or a reviewer he trusts) wrote and approved.
    i7 = draft_block("isaiah", "7:10–7:16")
    rows7 = t5("ISA", 7, 13, 16)
    u714 = (sec("In short", f'<p class="claim"><b>{E(i7["Part of"])}</b></p><p class="snote">{E(i7["body"])}</p>', first=True)
            + sec("Readers differ", f'<p class="claim">{todo_src("A fair note John writes once: two or three readings of verse 14, each in its own words")}</p><p class="note muted">Written by John · reviewed</p>')
            + sec("More", nrow("Verse by verse", "7 verses") + nrow("Compare translations", "WEB, KJV, LSV")))
    u714 += sources_sec(["Translation Questions and Simplified Text, adapted from unfoldingWord, CC BY-SA 4.0"])
    F("JR-07", "A major debate (Isaiah 7:14): a human-written note once approved; until then the slot is absent and the report flags it",
      rd("ISA", 7, verses_html(rows7, sel=(14,), ch=7, book="ISA")) + scrim() + guide("lg", i7["label"], "Isaiah 7:10–16", u714), "jr")

    NEXT_NOTES["refs_jr"] = (
        "John's round · 12 Oct 2026 (after the Genesis, Psalms and Isaiah tests)\n\n"
        "Psalms: at most two lines before the psalm, in this order: Written when (only where the title gives an occasion; never 'occasion unknown') → "
        "the turn or the main picture → What kind. Psalm 51 gets Written when and What kind (JR-02). Everything else is behind About this psalm (JR-03). "
        "The psalm's title row opens its guide, as passage titles do everywhere.\n\n"
        "Tip (JR-01): once, the first time a reader opens any psalm. The wording is a draft for John to approve once; the verse is the BSB's Psalm 27:1. "
        "'Got it' hides it for good, and it never shows again on that device or iCloud.\n\n"
        "Prophets (JR-04): the section name goes through the plain-words table ('Comfort for the exiles in Babylon', not 'Announcement of the End of the Babylonian Exile'), "
        "followed by one setting line drawn from the tN book introduction. Both are drafts in data/prophets.json until John approves them.\n\n"
        "Same slots everywhere (JR-05, JR-06, JR-07): In short → Readers differ → Read it alongside → More, then Sources. An empty slot is absent, never 'none'. "
        "For a psalm, In short is its two lines; for a prophet, the section name, summary and setting.\n\n"
        "Credits: one Sources block at the bottom, each source named once; Licences opens Settings › Sources and licences.\n\n"
        "Readers differ: three wordings (data/assemble TEMPLATES), turning with the verse so neighbours differ; NA-05 shows one in place.\n\n"
        "Major debates (JR-07): 30 OT candidates in data/debates.json. Until a note is approved, the slot is absent and the passage is listed in the report. "
        "No summary sentence comes from a short disputed range: the 7:10–16 summary skips verse 14.\n\n"
        "Seen in the data: Isaiah 40:1–5's summary opens on the voice in verse 3, not 'Comfort, comfort my people' (verse 1 has no tQ answer; the UST line leans). That is for John's sample.")

    # ================= Understand v3: readings first, whose words, one Sources row (John's UX test, 12 Oct 2026) =================
    # John's stress test of NA-01–04 against every kind of writing: (1) the plain line can't take a side, so where readers
    # differ the readings come first and the plain line is "One way to read it", at body size; a major debate with no
    # approved note shows neither; (2) a voice line says whose words they are (Bildad, John's vision, the Teacher, Paul);
    # (3) added words carry a second cue besides colour; (4) one Sources row instead of a credit under every line;
    # (5) the guide leads with the passage summary, Tyndale moves to Study notes. All data from assemble.py as it ships.
    if True:
        _code3 = ("import sys,json;sys.argv=['x'];sys.path.insert(0,'.');import assemble as a;"
                  "print(json.dumps({f'{b}.{c}.{v}': a.assemble(b,c,v) for b,c,v in "
                  "[('JHN',1,5),('JOB',8,6),('REV',20,2),('ISA',7,14),('1CO',14,34)]}, default=list))")
        A3 = _json.loads(_sp.run([sys.executable, "-I", "-c", _code3], cwd=f"{Y}/.claude/worktrees/next-release/packages/pipeline/prototypes",
                                 env=_env, capture_output=True, text=True, check=True).stdout)

        def plain_v3(r):
            p_ = r["beginner"]["plain"]
            if not p_:
                return ""
            t_ = re.sub(r"\{([^}]*)\}", r'<span class="impl">\1</span>', E(p_["text"]))
            vo = f'<p class="voice">{E(r["beginner"]["voice"])}</p>' if r["beginner"]["voice"] else ""
            size = " body" if p_["label"] == "One way to read it" else ""
            # VoiceOver hears "Some words are added for clarity" once per line, never word by word (John, 12 Oct).
            added = ' aria-description="Some words are added for clarity"' if p_["added"] else ""
            return sec(p_["label"], f'{vo}<p class="plainw{size}"{added}>{t_}</p>')

        def readings_v3(r, note=None):
            rows_ = ""
            if note:
                rows_ += f'<div class="rdq"><p class="claim">{note}</p><p class="note muted">Written by John · reviewed</p></div>'
            for d_ in r["beginner"]["readers_differ"]:
                more = '<button class="more">Read the full note</button>' if d_.get("full_note") else ""
                rows_ += f'<div class="rdq"><p class="claim">{E(d_["sentence"])}</p>{more}</div>'
            return sec("Readers differ", rows_) if rows_ else ""

        def notice_v3(r):
            return sec("Notice", "".join(fact_row(f_, "Compare" if f_.startswith("Translations differ") else "Word counts") for f_ in r["facts"])) if r["facts"] else ""

        def along_v3(r):
            return sec("Read it alongside", "".join(lrow(E(x), chev=True) for x in r["alongside"])) if r["alongside"] else ""

        def sources_row(names):
            # One row at the bottom; it opens the full credits, licences and what was changed (ST-04's list).
            return sec(None, nrow("Sources", names))

        def understand_v3(r, note=None, more_rows=""):
            b_ = r["beginner"]
            parts = {"readers_differ": readings_v3(r, note), "plain": plain_v3(r)}
            body = "".join(parts[k_] for k_ in b_["order"])
            if not body and b_["voice"]:
                body = sec(None, f'<p class="voice">{E(b_["voice"])}</p>')
            body += notice_v3(r) + along_v3(r)
            body += sec("More", more_rows + nrow("Key words", "Short articles from Translation Words") + nrow("Compare translations", "WEB, KJV, LSV"))
            return body.replace('<section class="sec', '<section class="sec first', 1) if body.startswith('<section class="sec"') else body

        src_names = "Simplified Text and Translation Notes (unfoldingWord, adapted) · BSB"
        # 1 Corinthians 14:34 is now on the major-debates list: until John's note, no plain line and no readings.
        r34 = A3["1CO.14.34"]
        F("NA-01", "14:34 today: a major debate with no approved note, so no plain reading and no readings; facts and verses stay",
          c34b + head_na("med", understand_v3(r34) + sources_row(src_names)), "na")
        r34n = {**r34, "beginner": {**r34["beginner"], "order": ["readers_differ", "plain"]}}
        # Once John's note is approved: the note first, then the UST as one way to read it (body size), with whose words.
        r34n["beginner"]["plain"] = {"text": UST1CO["14:34"], "added": re.findall(r"\{([^}]*)\}", UST1CO["14:34"]), "label": "One way to read it"}
        F("NA-02", "14:34 once John’s note is approved: the note first, then ‘One way to read it’ with ‘Paul tells them’",
          c34b + head_na("lg", understand_v3(r34n, note=todo_src("John’s note: two or three readings of 14:34–35, fair to each")) + sources_row(src_names + " · Written by John"), scrolled=True), "na")

        # The guide leads with the passage summary (the gated method), Tyndale under More.
        g1co = draft_block("1cor", "14:26–14:40")
        guide_v3 = (sec("In short", f'<p class="claim"><b>{E(g1co["Part of"])}</b></p><p class="snote">{E(g1co["body"])}</p>'
                    + f'<p class="note muted">Some manuscripts place verses 34–35 after verse 40.</p>', first=True)
                    + sec("More", nrow("Verse by verse", "15 verses, each with its Understand") + nrow("Study notes", "Tyndale on 14:26–40")
                          + nrow("Check what you read", "Questions from the passage"))
                    + sources_row("Translation Questions and Simplified Text (unfoldingWord, adapted) · BSB footnote"))
        F("NA-04", "The guide for 14:26–40: the passage summary in plain words, Tyndale moved to Study notes", under_c2 + guide("lg", pa, "1 Corinthians 14:26–40", guide_v3), "na")

        r15 = A3["JHN.1.5"]
        F("NA-05", "John 1:5: readers differ first, then the plain line as one way to read it",
          reader("JHN", 1, 3, 7, sel=(5,), rows_override=t5("JHN", 1, 3, 7)) + scrim() + usheet("lg", "John 1:5", JLAB + " · 1:1–18", understand_v3(r15) + sources_row(src_names), scrolled=True), "na")
        r714 = A3["ISA.7.14"]
        F("NA-06", "Isaiah 7:14: a major debate awaiting John’s note; whose words, then facts only",
          reader("ISA", 7, 12, 16, sel=(14,), rows_override=t5("ISA", 7, 12, 16)) + scrim() + usheet("med", "Isaiah 7:14", "The Sign of Immanuel · 7:10–16", understand_v3(r714) + sources_row("BSB · WEB · KJV · LSV")), "na")
        r86 = A3["JOB.8.6"]
        F("NA-07", "Job 8:6: ‘Bildad the Shuhite says:’ above the plain line, so his claim isn’t read as Yada’s",
          reader("JOB", 8, 4, 8, sel=(6,), rows_override=t5("JOB", 8, 4, 8)) + scrim() + usheet("med", "Job 8:6", "Bildad’s first speech", understand_v3(r86) + sources_row(src_names)), "na")
        r202 = A3["REV.20.2"]
        F("NA-08", "Revelation 20:2: ‘In John’s vision’, and the thousand years is a major debate awaiting a note",
          reader("REV", 20, 1, 4, sel=(2,), rows_override=t5("REV", 20, 1, 4)) + scrim() + usheet("med", "Revelation 20:2", "The Thousand Years · 20:1–6", understand_v3(r202) + sources_row("BSB · WEB · KJV · LSV · Word counts")), "na")

        NEXT_NOTES["refs_na3"] = (
            "Understand v3 · John's UX test, 12 Oct\n\n"
            "1. The plain line can't take a side. On any verse with readings, Readers differ comes first and the plain line follows as 'One way to read it', at body size (NA-05). "
            "On a major debate with no approved note, neither shows (NA-01, NA-06, NA-08); once John's note is approved, it leads (NA-02).\n\n"
            "2. Whose words: one line above the plain words from Glyssen (Bildad the Shuhite says:, NA-07), the book (In John's vision:, NA-08; The Teacher says:), "
            "or the letter (Paul tells them:). 'Speaking: X' is dropped from Notice when the voice line says it.\n\n"
            "3. Added words: muted colour plus a lighter weight and thin brackets, so it isn't colour alone; muted is 5.6:1 light, 7:1 dark. "
            "VoiceOver reads the line as one sentence and says once 'Some words are added for clarity'.\n\n"
            "4. Credits: one Sources row at the bottom, opening credits, licences and what was changed.\n\n"
            "5. The guide leads with the passage summary (NA-04); Tyndale moves under More › Study notes. Readings stay capped at 18 words each, then 'Read the full note'.\n\n"
            "Decision for John: 1 Corinthians 14:34–35 is now on the debates list (his letters finding), so NA-01's screen shows no reading until he writes the note.")

    # ================= Verse sheet: one layered sheet (John's approved spec, 12 Oct 2026) =================
    # Tapping a verse: one sheet, two heights, no modes. Half view for a beginner (40–60 words, no scrolling at default
    # size); full view adds Go deeper first, then every reading, every fact, Read it alongside. Data from assemble.py.
    _code4 = ("import sys,json;sys.argv=['x'];sys.path.insert(0,'.');import assemble as a;"
              "out={}\n"
              "for b,c,v in [('JHN',3,16),('1CO',14,34),('ISA',7,14)]:\n"
              "  r=a.assemble(b,c,v);o=a.ordinal(b,c,v);r['ntok']=a.core.execute('select count(*) from tokens where ord=?',(o,)).fetchone()[0];"
              "r['all_rd']=r['beginner']['readers_differ'] if r['beginner']['debate'] else a.readers_differ(b,c,v);out[f'{b}.{c}.{v}']=r\n"
              "print(json.dumps(out,default=list))")
    A4 = _json.loads(_sp.run([sys.executable, "-I", "-c", _code4], cwd=f"{Y}/.claude/worktrees/next-release/packages/pipeline/prototypes",
                             env=_env, capture_output=True, text=True, check=True).stdout)

    def vs_plain(r, label=None):
        p_ = r["beginner"]["plain"]
        if not p_:
            return ""
        t_ = re.sub(r"\{([^}]*)\}", r'<span class="impl" role="text">\1</span>', E(p_["text"]))
        vo = f'<p class="voice">{E(r["beginner"]["voice"])}</p>' if r["beginner"]["voice"] else ""
        big = "" if p_["label"] == "One way to read it" else " plainbig"
        added = ' aria-description="added for clarity"' if p_["added"] else ""
        return sec(f'{p_["label"]} · UST', f'{vo}<p class="plainw{big}"{added}>{t_}</p>')

    def vs_readings(r, full=False):
        rds = r["all_rd"]
        # The BSB's own "Or …" footnote on a disputed verse is a reading from data too (Isaiah 7:14: "Or young woman").
        extra = [n_ for n_ in r["beginner"]["translators"] if n_["kind"] == "or"] if r["beginner"]["debate"] else []
        n_all = len(rds) + len(extra)
        if not n_all:
            return ""
        src_ = " · ".join(dict.fromkeys(("JPS 1917" if d_.get("source") == "jps" else "tN") for d_ in rds)) + (" · BSB" if extra else "")
        src_ = src_.strip(" ·")
        rows_ = ""
        for d_ in (rds if full else rds[:1]):
            more = '<button class="more">Read the full note</button>' if d_.get("full_note") else ""
            rows_ += f'<div class="rdq"><p class="claim">{E(d_["sentence"])}</p>{more}</div>'
        if full or not rds:
            rows_ += "".join(f'<div class="rdq"><p class="claim">The BSB’s own footnote: {E(n_["text"])}.</p></div>' for n_ in extra)
        # The slot is Readers differ; the visible lead-in follows the data ("together": Psalm 2:7, Isaiah 14:12–15).
        return sec(f"{r['beginner'].get('readers_lead') or 'Readers differ'} · {n_all}", rows_)

    def vs_notice(r, full=False):
        fs = r["facts"] if full else r["facts"][:1]
        return sec("Notice", "".join(f'<p class="claim nfact">{E(f_)}</p>' for f_ in fs)) if fs else ""

    def vs_ms(r):
        return sec("Manuscripts · BSB footnote", "".join(f'<p class="claim">{E(m_)}</p>' for m_ in r["beginner"]["manuscripts"])) if r["beginner"]["manuscripts"] else ""

    def vs_deeper(r, ot=False):
        cmp_ = "BSB · WEB · KJV · LSV · NKJV · NLT · The Message" + (" · JPS 1917" if ot else "")
        rows_ = (nrow(f"Original {'Hebrew' if ot else 'Greek'}", f"{r['ntok']} words, each with its English · evidence marks (MACULA)")
                 + nrow("Compare", cmp_)
                 + (nrow("Study notes · Tyndale", "Adapted from Tyndale Open Study Notes") if r["deeper"]["study_note"] else "")
                 + (nrow("Key words · Translation Words", " · ".join(k_["term"] for k_ in r["deeper"]["key_words"][:4])) if r["deeper"]["key_words"] else "")
                 + (nrow("Manuscripts", "What the manuscripts differ on") if r["beginner"]["manuscripts"] else "")
                 + nrow("Sources", "Every source and licence"))
        return sec("Go deeper", rows_)

    def vs_along(r):
        return sec("Read it alongside", "".join(lrow(E(x)) for x in r["alongside"])) if r["alongside"] else ""

    more_row = sec(None, f'<button class="row nav morev" aria-label="More on this verse. Opens the full view"><span class="rm"><span class="claim">More on this verse</span></span><span class="chev">{ic("right", 18)}</span></button>')

    def vs_half(r):
        b_ = r["beginner"]
        if b_["debate"]:
            body = vs_readings(r) + vs_plain(r) + vs_ms(r)
        else:
            long_ = b_["plain"] and len(re.sub(r"[{}]", "", b_["plain"]["text"]).split()) > 30
            # Over 30 words, the plain line stands alone in the half view; Notice moves to the full view (spec budget).
            body = vs_plain(r) + ("" if long_ else vs_notice(r) + vs_readings(r))
        return body.replace('<section class="sec"', '<section class="sec first"', 1) + more_row

    def vs_full(r, ot=False):
        b_ = r["beginner"]
        first = (vs_readings(r, True) + vs_plain(r) + vs_ms(r)) if b_["debate"] else vs_plain(r)
        rest = ("" if b_["debate"] else vs_readings(r, True)) + vs_notice(r, True) + vs_along(r)
        return (first + vs_deeper(r, ot) + rest).replace('<section class="sec"', '<section class="sec first"', 1)

    def vsheet(pos, ref, body, scrolled=False):
        return usheet(pos, f"{ref} · Understand", None, body, scrolled=scrolled)

    j316 = A4["JHN.3.16"]
    j3r = reader("JHN", 3, 16, 19, sel=(16,), rows_override=t5("JHN", 3, 16, 19)) + scrim()
    F("VS-01", "John 3:16, half view: the plain line alone (34 words), then More on this verse", j3r + vsheet("med", "John 3:16", vs_half(j316)), "vs")
    tipbox = '<div class="addtip" role="status">Added to make the meaning clear. Not in the Greek.</div>'
    F("VS-02", "John 3:16, full view: Go deeper straight after the first view, then readings, Notice, Read it alongside",
      j3r + vsheet("lg", "John 3:16", vs_full(j316).replace('</p></section>', f'</p>{tipbox}</section>', 1), scrolled=True), "vs")

    c34 = A4["1CO.14.34"]
    c3r = reader("1CO", 14, 34, 37, sel=(34,), rows_override=t5("1CO", 14, 34, 37)) + scrim()
    F("VS-03", "1 Corinthians 14:34, half view: Readers differ first, then one way to read it, then the manuscripts fact", c3r + vsheet("med", "1 Corinthians 14:34", vs_half(c34)), "vs")
    F("VS-04", "1 Corinthians 14:34, full view: every reading, then Go deeper", c3r + vsheet("lg", "1 Corinthians 14:34", vs_full(c34), scrolled=True), "vs")

    i714b = A4["ISA.7.14"]
    i7r = reader("ISA", 7, 14, 17, sel=(14,), rows_override=t5("ISA", 7, 14, 17)) + scrim()
    F("VS-05", "Isaiah 7:14, half view: the JPS 1917 verse and the BSB’s own footnote, then one way to read it", i7r + vsheet("med", "Isaiah 7:14", vs_half(i714b)), "vs")
    F("VS-06", "Isaiah 7:14, full view: both readings in full, Compare with JPS 1917, Go deeper", i7r + vsheet("lg", "Isaiah 7:14", vs_full(i714b, ot=True), scrolled=True), "vs")

    # AX5: the sheet opens large and covers the verse, so the verse repeats at the top in reading size.
    rep = f'<section class="sec first rep"><p class="v"><span class="vn">16</span> {scripture(t5("JHN", 3, 16)[0][1])}</p></section>'
    F("VS-07", "A verse low on the screen at AX5: scrolled up first, the sheet opens large, the verse repeats at its top",
      reader("JHN", 3, 12, 16, sel=(16,), rows_override=t5("JHN", 3, 12, 16)) + scrim() + vsheet("lg", "John 3:16", rep + vs_half(j316).replace('<section class="sec first"', '<section class="sec"', 1)), "vs")

    NEXT_NOTES["refs_vs"] = (
        "Verse sheet · John's approved spec (12 Oct)\n\n"
        "One sheet, two heights, no modes. Half view (VS-01, 03, 05): the plain line (the only large text), at most one Notice fact that carries its own comparison, "
        "Readers differ with its count and first reading, and 'More on this verse'. Over 30 words, the plain line stands alone (John 3:16, 34 words). "
        "Full view (VS-02, 04, 06): the first view, then Go deeper rows in a fixed order (Original, Compare, Study notes, Key words, Manuscripts, Sources), "
        "then every reading (18 words each, 'Read the full note'), every fact, Read it alongside.\n\n"
        "Disputed verses (debates.json): Readers differ first, then 'One way to read it' at body size, then the manuscripts fact. Isaiah 7:14 reads from data alone: "
        "the JPS 1917 verse and the BSB's own footnote 'Or young woman'.\n\n"
        "The heading is always 'Readers differ'; the three wordings sit under it. Never 'Christians read this differently'.\n\n"
        "Added words: italic and grey; a tap says 'Added to make the meaning clear. Not in the Greek.' (VS-02); VoiceOver says 'added for clarity'. "
        "The sheet remembers its last height; Settings › 'Open Understand in full' opens it full every time. AX5 (VS-07): same order, opens large, the verse repeats at the top.\n\n"
        "Gaps: manuscripts come from BSB footnotes (no SBLGNT apparatus in the data yet); Isaiah 7:14's Key words include 'enslave' from Translation Words Links, a data error to fix at source; "
        "People has no entry on these three verses; Notice's comparison fact exists for John 3:16 only (none of the other two verses has a word its book uses most).\n\n"
        "Conflicts with JR-01–07: none in the passage guides (kept). JR-07's 'Readers differ' on Isaiah 7:14 now has data before John's note (the JPS verse and the BSB footnote).")

    # ================= States the app shows but nobody drew (code audit, 12 Oct 2026) =================
    # Each frame answers one state found in apps/mobile (docs/redesign/review-2026-10-12.md §3). Pattern for a page that
    # can't open: one calm sentence and Try again (Oura "Can't load chat"); a single failed row keeps its row and adds
    # Try again (Perplexity inline). Rejected: red error icons (talabat, v0), illustrations (Noom), raw error text (v0).
    TRY = '<button class="tbtn2" aria-label="Try again">Try again</button>'

    # A1: the voice help lives in the menu the reader just used, as each row's second line; never under the title.
    pmenu = ('<div class="menu pmenu" role="menu">'
             '<button role="menuitem"><span class="mrm"><span>Speed</span><span class="msub">1×</span></span></button>'
             '<button role="menuitem"><span class="mrm"><span>Get a clearer voice</span><span class="msub">Settings › Accessibility › Spoken Content › Voices</span></span></button>'
             '<button role="menuitem"><span class="mrm"><span>Your Personal Voice</span><span class="msub">Settings › Accessibility › Personal Voice</span></span></button></div>')
    F("US-01", "Voice help: in the player’s menu, as each row’s second line, not a line under the title", full(5, 4) + '<div class="menuscrim"></div>' + pmenu, "us")

    # A2: a book with no passages: the chapter once, the translation once.
    mk_rows = t5("MRK", 1, 3, 9)
    mk_ly = "".join(f'<p class="ly{" cur" if n == 5 else (" past" if n < 5 else " up")}"><span class="lyn">{n}</span>{E(t_)}</p>' for n, t_ in mk_rows)
    mk_full = re.sub(r'<div class="lyr">.*?</div><div class="fpc">', f'<div class="lyr">{mk_ly}</div><div class="fpc">', full(5, 0), count=1, flags=re.S)
    mk_full = mk_full.replace(f'<span class="sttl">{E(JLAB)}</span><span class="ssub">John 1 · BSB</span>', '<span class="sttl">Mark 1</span><span class="ssub">BSB</span>', 1)
    mk_full = mk_full.replace(f"Open the passage guide, {E(JLAB)}", "Mark has no passage guides yet").replace('>Guide</button>', ' aria-disabled="true" disabled>Guide</button>', 1)
    F("US-02", "Player in a book with no passages: “Mark 1” once, “BSB” under it", mk_full, "us")

    # A4: Next on the last verse while paused: the session stays reachable, in the mini player's second line.
    j2lab = PERI.get("JHN.2.1-2.12", ("The Wedding at Cana", None))[0]
    m_next = mini(1, playing=False).replace(E(JLAB), E(j2lab)).replace("Verse 1 · BSB", "John 2 · Verse 1")
    F("US-03", "Next while paused at a chapter’s end: John 2 waits in the mini player, paused", reader("JHN", 2, 1, 6, scrolled=False, rows_override=t5("JHN", 2, 1, 6)) + m_next, "us")

    # A5: the end of a book: the second line says so; Next is off; Play starts the chapter again.
    j21lab = PERI.get("JHN.21.15-21.25", ("Jesus restores Peter", None))[0]
    m_end = (mini(25, playing=False).replace(E(JLAB), E(j21lab)).replace("Verse 25 · BSB", "End of John")
             .replace('aria-label="Next verse">', 'aria-label="Next verse, unavailable" aria-disabled="true" class="mpb off">', 1))
    F("US-04", "The end of a book while listening: “End of John”, Next unavailable", reader("JHN", 21, 20, 25, scrolled=False, rows_override=t5("JHN", 21, 20, 25)) + m_end, "us")

    # C1: a download that failed keeps its row; one line says what happened, Try again sits where the button was.
    def tr_fail(kind):
        meta, right = {"fail": ("Didn’t download", TRY), "space": ("Not enough space on this iPhone", DL)}[kind]
        rows_ = downloadable().replace(trrow("YLT", "Young’s Literal Translation", "1898 · 1.3 MB", DL, label="Young’s Literal Translation, 1898 · 1.3 MB, download"),
                                       trrow("YLT", "Young’s Literal Translation", meta, right, cls="failrow", label=f"Young’s Literal Translation. {meta}"))
        body = sec("On your iPhone", on_phone, first=True) + sec("Download", rows_) + sec("Online", '<p class="note muted offl">Needs a connection.</p>' + online)
        return sheet("lg", "Translations", None, body, back=True, foot=False)
    def tr_fail_scrolled(kind):
        # At AX5 the list is long, so the frame shows it scrolled to the row that failed.
        h_ = tr_fail(kind).replace(sec("On your iPhone", on_phone, first=True), "", 1).replace('<section class="sec">', '<section class="sec first">', 1)
        return h_.replace(trrow("ASV", "American Standard Version", "1901 · 1.3 MB", DL, label="American Standard Version, 1901 · 1.3 MB, download"), "", 1)
    F("US-05", "A translation download failed: its row says so, Try again in place of the button", [
        ("Light", "light", under + tr_fail("fail")), ("Dark", "dark", under + tr_fail("fail")),
        ("AX5 · scrolled to the row", "ax5", under + tr_fail_scrolled("fail"))], "us")
    F("US-06", "Not enough space: the reason in the row, the button stays", under + tr_fail("space"), "us")

    # B3: a licensed chapter that couldn't load (not offline): LT-03's sentence, Try again first, the BSB as the way on.
    err_body = (f'<div class="offpg"><p class="empty">John 1 in the NKJV didn’t load.</p>{TRY}'
                f'<button class="clink" aria-label="Read John 1 in the Berean Standard Bible">Read in the BSB</button></div>')
    F("US-07", "A licensed chapter that didn’t load: one sentence, Try again, Read in the BSB", rd("JHN", 1, err_body, tr="NKJV"), "us")

    # D2: Understand or the guide couldn't be opened: the title is known from the start, one sentence, Try again.
    u_err = sec(None, f'<p class="claim">This verse’s explanation couldn’t be opened.</p>{TRY}', first=True)
    F("US-08", "Understand couldn’t be opened: the verse in the title, one sentence, Try again",
      reader("JHN", 1, 3, 7, sel=(5,), rows_override=t5("JHN", 1, 3, 7)) + scrim() + usheet("med", "John 1:5 · Understand", None, u_err), "us")

    # E3: a chapter that couldn't be read: the reader's own header, one sentence, Try again, Home.
    ch_err = (f'<div class="offpg"><p class="empty">John 1 couldn’t be opened.</p>{TRY}'
              f'<button class="clink" aria-label="Back to Home">Back to Home</button></div>')
    F("US-09", "A chapter that couldn’t be opened: one sentence, Try again, Back to Home", rd("JHN", 1, ch_err), "us")

    # E4: Yada itself couldn't open its text: plain words in Literata, no error codes (dev builds only), Try again.
    launch_err = (f'<div class="splash"><div class="offpg lfail"><p class="empty">Yada couldn’t open the Bible text.</p>'
                  f'<p class="note muted">If this keeps happening, close Yada and open it again.</p>{TRY}</div></div>')
    F("US-10", "Yada couldn’t open its text at launch: plain words, Try again, no error code", launch_err, "us")

    # B1: Bookmarks while reading a licensed version: the excerpt is the BSB's, and says so.
    bm_nk = "".join(lrow(f'<span class="excerpt2">{scripture(text("BSB", b, c, v)[0][1])}</span>', cls="passage", chev=False)
                    .replace('<span class="lmain">', f'<span class="lmain"><span class="pref">{E(BOOK.get(b, b))} {c}:{v} · BSB</span>', 1) for b, c, v in BMS)
    F("US-11", "Bookmarks while reading the NKJV: each excerpt is the BSB’s, labelled", page(("Home", "Home"), "Bookmarks", bm_nk, right=EDIT), "us")

    NEXT_NOTES["refs_us"] = (
        "States the app shows but nobody drew (code audit, 12 Oct; docs/redesign/review-2026-10-12.md §3)\n\n"
        "US-01 voice help (player.tsx:73-83, 215-219): in the menu the reader used, as row subtitles; the line under the title stays for AU-07's first listen only. "
        "US-02 a book with no passages (player.tsx:206): 'Mark 1' and 'BSB', Guide off. US-03 Next while paused (audio.ts:299): the mini player keeps the session, 'John 2 · Verse 1'. "
        "US-04 end of the book (audio.ts:315): 'End of John', Next unavailable; Play starts the chapter again. US-05/06 a translation download that failed or had no room (translations.tsx:200): the row keeps its place, "
        "its line says what happened, Try again or the button stays. US-07 a licensed chapter that didn't load ([chapter].tsx:578): LT-03's sentence with Try again first; offline stays LT-03. "
        "US-08 Understand couldn't open (UnderstandViews.tsx:187): the title is known from the start; one sentence, Try again. US-09 a chapter that couldn't be read ([chapter].tsx:121). "
        "US-10 launch failure (_layout.tsx:137): no exception text for readers; it stays in development builds. US-11 Bookmarks on a licensed version (bookmarks.tsx:52): BSB excerpt, labelled; Recent follows the same rule.\n\n"
        "Already drawn, to build: EG-03 (audio under a licensed page), EG-06/07 (Search on a licensed version), LT-03 (offline), UX-03/08 (a range with study notes only), SN-04–06.\n\n"
        "Not drawn because nothing shows: copy and bookmark confirmations are spoken by VoiceOver ('Copied', 'Bookmarked'), with the existing haptic; a slow licensed load turns into US-07 after about 8 seconds, never a skeleton.\n\n"
        f"Refs: Oura can't-load with Try again {M('9dbf6e35-9643-449f-9d0f-c89cc6248a49')} · Perplexity inline Try again {M('53c1cd17-3832-45bf-adcc-d86bd15c7a15')}. "
        f"Rejected: talabat red failure screen {M('ce8b2238-1b89-4d12-9174-03d175a98b2c')} · v0 raw error text {M('63640548-4dd7-4a66-b9a3-48e8b0a5328c')} · Noom illustration {M('46a84752-17ac-441b-b955-02f3a9ac5f34')}.")

    # ================= Magic moments (review 12 Oct, §5) =================
    # Quiet, typographic, from the text and data Yada already has; never streaks, tallies or confetti. Motion is
    # described in the note per frame; each has a Reduce Motion and a VoiceOver form. Ref: Tolan's typographic
    # "what comes next" page (serif title, a short numbered list). Rejected: Polarsteps "Voilà" celebration, Lloyds'
    # filled colour panel.
    def ticks_on(html_, verses):
        # A short ink tick in the left margin of each verse the word appears in (MM-04); never beside the number,
        # where it would read as a range ("28–").
        for v_ in verses:
            html_ = re.sub(rf'<p class="v([^"]*)"><span class="vn">{v_}</span>', rf'<p class="v\1 fv"><span class="ftick" aria-hidden="true"></span><span class="vn">{v_}</span>', html_, count=1)
        return html_

    # MM-01 The passage boundary: a hairline, then the next passage's title as an opener; one soft tick, once.
    jp_next = next(lab for pid, lab in JP if pid.startswith("JHN.1.19"))
    bound = (verses_html(t5("JHN", 1, 15, 18), ch=1, book="JHN")
             + f'<div class="pbound" role="separator" aria-label="End of {E(JLAB)}"></div>'
             + f'<button class="opener olink nextop" aria-label="Next, {E(jp_next)}. Opens the passage guide"><span class="nxk">Next</span><span>{E(jp_next)}</span>{ic("right", 14)}</button>'
             + verses_html(t5("JHN", 1, 19, 20), ch=1, book="JHN"))
    # At AX5 one verse fills the screen, so the frame opens on the boundary itself.
    bound_ax = bound.replace(verses_html(t5("JHN", 1, 15, 18), ch=1, book="JHN"), "", 1)
    F("MM-01", "The passage boundary: a hairline draws across, the next passage’s title arrives as an opener", [
        ("Light", "light", rd("JHN", 1, bound)), ("Dark", "dark", rd("JHN", 1, bound)),
        ("AX5 · scrolled to the boundary", "ax5", rd("JHN", 1, bound_ax))], "mm")

    # MM-02 Same first words: John 1:1 and Genesis 1:1 both open "In the beginning" in the BSB.
    gk = "".join(f'<span class="w"><span class="o" lang="el">{s_}</span><span class="gl">{E(g_)}</span></span>' for s_, g_ in (("Ἐν", "In"), ("ἀρχῇ", "beginning")))
    he = f'<span class="w"><span class="o" lang="he" dir="rtl">בְּרֵאשִׁ֖ית</span><span class="gl">in beginning</span></span>'
    pair = (sec(None, '<p class="claim">John and Genesis open with the same words in the BSB.</p>', first=True)
            + sec("John 1:1", f'<p class="v sfw"><span class="sfwh">In the beginning</span> was the Word…</p><div class="il">{gk}</div>')
            + sec("Genesis 1:1", f'<p class="v sfw"><span class="sfwh">In the beginning</span> God created the heavens and the earth.</p><div class="il rtl">{he}</div>')
            + sec(None, nrow("Sources", "BSB · Greek and Hebrew words with their English")))
    F("MM-02", "Same first words: John 1:1 and Genesis 1:1, set one over the other", reader("JHN", 1, 1, 3, sel=(1,), rows_override=t5("JHN", 1, 1, 3)) + scrim() + usheet("lg", "John 1:1 · Original Greek", None, pair), "mm")

    # MM-03 The first Greek word tapped: its BSB partner in the verse takes the evidence underline.
    lg_i = next(i for i, w in enumerate(G["jhn.1.1"]["gloss"]) if w["surface"].startswith("λόγος"))
    v11 = E(t5("JHN", 1, 1)[0][1]).replace("the Word", '<span class="evu">the Word</span>', 1)
    first_word = (sec(None, f'<p class="v">{v11}</p><div class="hairjoin" aria-hidden="true"></div>{interlinear("jhn.1.1", mark=lg_i)}', first=True)
                  + sec(None, '<p class="note muted">λόγος · logos · “Word”</p>'))
    F("MM-03", "The first Greek word tapped: “the Word” in the verse takes the evidence underline, joined for a moment",
      reader("JHN", 1, 1, 3, sel=(1,), rows_override=t5("JHN", 1, 1, 3)) + scrim() + usheet("med", "John 1:1 · Original Greek", None, first_word), "mm")

    # MM-04 A word's footprints: opening σιγάω's uses ticks its verses in the reader behind the sheet.
    sil_v = [int(r.split(":")[1]) for r in sil_refs]
    behind = ticks_on(reader("1CO", 14, 28, 31, rows_override=t5("1CO", 14, 28, 31)), sil_v[:-1])
    uses = "".join(lrow(f'<span class="pref">1 Corinthians {r}</span>', sub=("Here" if r.endswith(":34") else None)) for r in sil_refs)
    F("MM-04", "A word’s footprints: its other uses are ticked in the reader behind the sheet",
      behind + usheet("med", "σιγάω in 1 Corinthians", f"{len(sil)} times, all in chapter 14", sec(None, uses, first=True)), "mm")

    # MM-05 Back after a gap: "Where you stopped", no count of days.
    gap_home = page(None, "Yada", home_cont.replace("Continue · John 1:39", "Where you stopped · John 1:39").replace("Continue reading,", "Where you stopped,"), right=HOME_ICONS)
    F("MM-05", "Back after a gap: “Where you stopped”, the last verse held for two seconds, no day count", [
        ("Light · Home", "light", gap_home),
        ("Dark · John 1:39 held, then let go", "dark", reader("JHN", 1, 38, 42, sel=(39,), rows_override=t5("JHN", 1, 38, 42))),
        ("AX5 · Home", "ax5", gap_home)], "mm")

    # MM-06 A verse kept before: the header's second line says when.
    kept = vs_half(A4["JHN.3.16"])
    F("MM-06", "A verse kept before: “Kept” and the date under Understand’s title",
      reader("JHN", 3, 16, 19, sel=(16,), rows_override=t5("JHN", 3, 16, 19)) + scrim()
      + usheet("med", "John 3:16 · Understand", None, kept).replace('<span class="sttl">', f'<span class="sttl">', 1).replace("</span></div><button", f'</span><span class="ssub">Kept {todo_src("the date it was bookmarked")}</span></div><button', 1), "mm")

    # MM-07 The next chapter's name in the swipe.
    j2_open = reader("JHN", 2, 1, 4, scrolled=False, rows_override=t5("JHN", 2, 1, 4)).replace(
        '<div class="rbody"><div style="margin-top: 0px">', f'<div class="rbody"><div style="margin-top: 0px"><p class="opener chop">{E(PERI.get("JHN.2.1-2.12", ("The wedding at Cana", None))[0])}</p>', 1)
    F("MM-07", "The next chapter’s name in the swipe: John 2 peeks in with its first passage title",
      f'<div class="pane" style="transform:translateX(-42%)">{pane_cur}</div><div class="pane edge" style="transform:translateX(58%)">{j2_open}</div>', "mm")

    # MM-08 The end of a book: its own closing verse, set like a quotation.
    j2125 = t5("JHN", 21, 25)[0][1]
    end2 = (header(("Home", "Home"), "John 21 · BSB") +
            f'<div class="endpg"><p class="endk">End of John</p><p class="endq">“{E(j2125)}”</p><p class="note muted">John 21:25 · Begun {todo_src("the date John was begun")}</p>'
            f'<button class="clink endl" aria-label="Go on to Acts 1">Acts 1{ic("right", 18)}</button></div>')
    F("MM-08", "The end of a book: its own last verse, set like a quotation, and the way on", end2, "mm")

    # MM-09 The audio catches up: following resumes by itself when the narration reaches the reader's place.
    # The playing verse sits at the top of the screen, where the reader is; the player's second line says so for two
    # seconds ("Following again"), then returns to "Verse 9".
    caught = header(("Home", "Home"), "John 1 · BSB") + f'<div class="rbody"><div class="axsel" style="margin-top: 0px">{au_verses(t4("JHN", 1, 9, 13), 9, 3, ())}</div></div>' + mini(9).replace("Verse 9 · BSB", "Following again")
    F("MM-09", "The audio catches up: following resumes where the reader is, with one light tick", caught, "mm")

    # MM-10 Translations agree: one block, said once (John 11:35 reads the same in all four).
    agree = sec(None, f'<p class="agreeq">{E(t5("JHN", 11, 35)[0][1])}</p><p class="note muted">BSB, WEB, KJV and LSV agree here.</p>', first=True)
    # Two lines need little room: the sheet rises only as far as its content.
    F("MM-10", "Translations agree: the rows fold into one block", reader("JHN", 11, 33, 37, sel=(35,), rows_override=t5("JHN", 11, 33, 37)) + scrim() + usheet("med agreesh", "John 11:35 · Compare", None, agree), "mm")

    # MM-11 LORD in small capitals, the first time: the name Yahweh leads Key words, once.
    yah = "The term “Yahweh” is God’s personal name in the Old Testament."
    lord = sec(None, f'<p class="claim">{todo_src("Fixed line, John approves: LORD in small capitals stands for God’s name, Yahweh.")}</p>', first=True) + sec("Key words · Translation Words", nrow("Yahweh", yah))
    F("MM-11", "LORD in small capitals, the first time: the name Yahweh comes first, once per device",
      reader("PSA", 23, 1, 4, sel=(1,), sup="A Psalm of David. ", rows_override=t5("PSA", 23, 1, 4)) + scrim() + usheet("med", "Psalm 23:1 · Understand", None, lord), "mm")

    # MM-12 A plan's last reading: the plan's own words, no celebration.
    F("MM-12", "A plan’s last reading: when it was begun, and a sentence from M’Cheyne’s own preface", page(("Reading plans", "Reading plans"), "M’Cheyne",
      sec(None, '<p class="note muted">The whole Bible, four chapters at a sitting</p>'
          + f'<p class="endq">{todo_src("One sentence from M’Cheyne’s 1842 preface, quoted exactly (public domain)")}</p>'
          + f'<p class="note muted">Begun {todo_src("the date the plan was begun")}</p>', first=True)
      + lrow("Start again from reading 1", chev=True)), "mm")

    NEXT_NOTES["refs_mm"] = (
        "Magic moments (review 12 Oct §5). Quiet, typographic, from data Yada has; no streaks, tallies, confetti.\n\n"
        "MM-01 boundary: reading past a passage's last verse draws a hairline across (0.4 s), the next title arrives as an opener with 'Next', one soft selection haptic once per passage; this is also what 'finished' means (review §2.1). Reduce Motion: the line simply appears. VoiceOver: 'End of The Word became flesh. Next, The testimony of John the Baptist, button.'\n\n"
        "MM-02 same first words: John 1:1 and Genesis 1:1 both open 'In the beginning' in the BSB; the Greek and Hebrew words sit under each. The Greek OT (LXX) isn't in Yada's data, so no claim is made about it. One element for VoiceOver.\n\n"
        "MM-03 first tapped word: 'the Word' in the verse takes the dotted evidence underline, a hairline joins it to λόγος for 0.5 s, once per device; afterwards just the mark. Reduce Motion: no hairline.\n\n"
        "MM-04 footprints: while σιγάω's uses are open, 14:28 and 14:30 get a short ink tick in the gutter; 14:34 keeps its bar. VoiceOver: 'Also in this chapter: verses 28 and 30.'\n\n"
        "MM-05 after more than 7 days: 'Where you stopped', the reader opens one verse early and holds the last verse's bar for 2 s. No count of days.\n\n"
        "MM-06 a kept verse: 'Kept' and the bookmark's date as Understand's second line, from local data.\n\n"
        "MM-07 the swipe's peek shows John 2's first passage title as a chapter opener; the actions rotor says it too.\n\n"
        "MM-08 the End page sets the book's own last verse as a quotation, with the date it was begun.\n\n"
        "MM-09 after the reader scrolls away, following resumes on its own when the narration reaches the verse at the top of the screen, one light tick, the read-along pill picks up on the next word. Reduce Motion: snaps (AU-05). VoiceOver: polite 'Audio has reached verse 9'.\n\n"
        "MM-10 Compare on a verse that reads the same in all four: the rows fold into one block, 'BSB, WEB, KJV and LSV agree here.' (John 11:35, 'Jesus wept.').\n\n"
        "MM-11 the first verse with LORD: the Yahweh key word leads, and one fixed line (draft, John approves) says what the small capitals mean. Once per device.\n\n"
        "MM-12 a plan's last reading: the date begun and one sentence from M'Cheyne's 1842 preface, quoted; 'Start again'. No motion.\n\n"
        f"Refs: Tolan typographic next page {M('1e4b8ef3-fbaf-43ed-81d8-7262cbf9ee30')} · CLEAR quiet Next {M('6ff76e4f-8540-4df6-9379-b0395bc47ef1')}. "
        f"Rejected: Polarsteps 'Voilà' {M('406fe653-1d9c-4f56-a28c-df05ad0c1993')} · Lloyds filled panel {M('99071622-d427-4aa3-af4e-25ac9fecc96b')}.")

    # ================= Decided, not drawn → drawn (John, 12 Oct: "do you want us to draw them?") =================
    # Dictionary: a term this book never uses says where it is used, not "0".
    tw_sab = open(f"{Y}/content/raw/uw-tw/en_tw/bible/kt/sabbath.md", encoding="utf8").read().split("## Definition:", 1)[1].strip().split("\n")[0]
    n_sab = db5.execute("select count(*) from texts_fts f join texts t on t.rowid=f.rowid where texts_fts match 'sabbath' and t.translation='BSB'").fetchone()[0]
    first_sab = db5.execute("select v.verse_id, t.text from texts_fts f join texts t on t.rowid=f.rowid join verses v on v.ord=t.ord where texts_fts match 'sabbath' and t.translation='BSB' order by t.ord limit 2").fetchall()
    sab_body = (sec(None, f'<p class="claim">{E(tw_sab)}</p>', first=True)
                + sec(f"Elsewhere in the Bible · {n_sab}", "".join(lrow(f'<span class="pref">{E(fref(r))}</span>', sub=f'<span class="excerpt">{E(t_)}</span>') for r, t_ in first_sab))
                + sources_sec(["Translation Words, adapted from unfoldingWord, CC BY-SA 4.0", "BSB, public domain"]))
    F("DN-01", "A term this book never uses: ‘Elsewhere in the Bible’ with the count, never ‘In 1 Corinthians · 0’",
      c34b + sheet("lg", "Sabbath", "Key word", sab_body, back=True, foot=False), "dn")

    # Read it alongside while on a licensed version: the verses are the BSB's, and say so.
    nk34 = rd("1CO", 14, placeholder_text("NKJV text of 1 Corinthians 14:33–36 (licensed, display only)"), tr="NKJV") + scrim()
    al_bsb = along_rows().split('<p class="note muted credit">')[0].replace('</span><span class="xt">', ' · BSB</span><span class="xt">')
    F("DN-02", "Reading the NKJV: Read it alongside shows BSB text, labelled BSB",
      nk34 + usheet("med", "1 Corinthians 14:34", "Order in the assembly · 14:26–40", sec("In plain words", plain_words("14:34", True), first=True) + sec("Read it alongside", al_bsb)), "dn")

    # A plan's last reading: one quiet line, then the reminder follows the reader's place.
    F("DN-03", "A plan’s last reading: one quiet line, no celebration", page(("Plans", "Reading plans"), "M’Cheyne",
      sec(None, lrow(todo_src("the four chapters of reading 365, from the plan table"), right=f'<span class="ck" aria-label="read">{ic("check", 20)}</span>', chev=False, cls="done"), first=True)
      + '<p class="note muted">You’ve read all 365 readings.</p>' + lrow("Start again from reading 1", chev=True)), "dn")

    # Remove my data while a download runs: it stops first, and the alert says so.
    confirm2 = ('<div class="ialert" role="alertdialog" style="margin-top:-120px"><p class="iat">Remove your data?</p>'
                '<p class="iab">The download stops, then bookmarks, your reading place, plan progress, the reminder and downloads are removed from this iPhone and iCloud. This can’t be undone.</p>'
                '<div class="iabtn"><button>Cancel</button><button>Remove</button></div></div>')
    F("DN-04", "Remove my data during a download: the alert says the download stops first", page(("Home", "Home"), "Settings", settings_body) + '<div class="scrim"></div>' + confirm2, "dn")

    # Downloads: Understand per book, with its size.
    dl2 = (sec("Understand", vrow2("John", todo_src("size of understand-jhn"), chev=False) + vrow2("Luke", todo_src("size of understand-luk"), chev=False), first=True)
           + sec("Recorded readings", vrow2("John", todo_src("size from the manifest"), chev=False))
           + '<p class="note muted">Built-in texts are part of Yada and can’t be removed.</p>')
    F("DN-05", "Downloads lists Understand per book, with its size", page(("Settings", "Back to Settings"), "Downloads", dl2), "dn")

    # Depth: three pushes in one sheet, each ‹ naming where it goes back to.
    kw_body = sec(None, f'<p class="claim">{E(tw_sab)}</p>', first=True)
    deep3 = sheet("lg", "Sabbath", "Key word", kw_body, back=True, foot=False).replace('aria-label="Back">', 'aria-label="Back to 1 Corinthians 14:34">', 1)
    deep3 = deep3.replace(f'<button class="sh-back" aria-label="Back to 1 Corinthians 14:34">{ic("back", 22)}</button>',
                          f'<button class="sh-back named" aria-label="Back to 1 Corinthians 14:34">{ic("back", 18)}<span>14:34</span></button>', 1)
    F("DN-06", "Depth: each ‹ names where it goes back to (‹ 14:34), so three pushes never feel lost", c34b + deep3, "dn")

    NEXT_NOTES["refs_dn"] = (
        "Decided, now drawn (12 Oct)\n\n"
        "DN-01 Dictionary: a term the book never uses shows 'Elsewhere in the Bible · N' with its first verses. "
        "DN-02 Licensed version: Read it alongside shows BSB text, labelled BSB. DN-03 Plan end: one line, and 'Start again'. "
        "DN-04 Remove my data while downloading: the alert says the download stops first. DN-05 Downloads: Understand per book with size. "
        "DN-06 Depth: ‹ carries the place it returns to.\n\n"
        "Still not drawn, because there is nothing to see: VoiceOver reads a plain line as one sentence, and the section's hint says once 'Words in grey are added for meaning'. "
        "A book not yet rolled out keeps SN-03 and GD-04, already on the canvas.")
# ================= Build 6: listening (John approved 13 Oct 2026, after a review of the Dwell app) =================
# Four player features: a stop at a natural break, repeat for memorising, the chapter's name spoken between chapters,
# and the WEB, KJV and LSV read by Heart and George. Ideas only from Dwell: none of its wording, names or assets.
# One control, the speed button, opens one native menu (Apple Podcasts puts its stop times in a native menu from the
# player's controls, mobbin.com/screens/e8c63ed4-2e3a-48cb-a080-7aa53b5524a8; Matter, speed in a native menu,
# mobbin.com/screens/e76e8878-9a63-45fc-8049-2e7d40cd7930), so the control row keeps its five buttons.
if STYLE != "v1":
    LB_SEGS = [(1, 18), (19, 34), (35, 51)]

    def lfull(rows, cur, wi=None, title=None, sub="John 1 · BSB", voice=None, last=51, segs=LB_SEGS, playing=True,
              status=None, head=None, speed="1×", vo=False):
        # The full player (AU-04, BA-01) with the rows given, and an optional status line under the progress.
        b = (lambda n: f'<span class="vo" aria-hidden="true">{n}</span>') if vo else (lambda n: "")
        ly = [head] if head else []
        for n, t in rows:
            if n == cur:
                if wi is None:
                    body = E(t)
                else:
                    ws = t.split(" ")
                    body = " ".join(E(w) if i < wi else (f'<span class="au-w">{E(w)}</span>' if i == wi else f'<span class="au-up">{E(w)}</span>') for i, w in enumerate(ws))
                ac = "" if head else ' aria-current="true"'
                ly.append(f'<p class="ly cur{"" if head is None else " up"}"{ac}><span class="lyn">{n}</span>{body}</p>')
            else:
                ly.append(f'<p class="ly{" past" if n < cur else " up"}"><span class="lyn">{n}</span>{E(t)}</p>')
        done = cur - 1 if head else cur
        bar_ = "".join(f'<span class="seg2" style="flex: {b_ - a_ + 1}"><span class="fill" style="width: {min(100, max(0, (done - a_ + 1) / (b_ - a_ + 1) * 100)):.0f}%"></span></span>' for a_, b_ in segs)
        vline = f' · {voice_btn(voice)}' if voice else ""
        top = (f'<div class="fph"><button class="sh-x fpd" aria-label="Close player">{b(1)}{ic("down", 20)}</button>'
               f'<div class="stitle"><span class="sttl">{E(title or JLAB)}</span><span class="ssub">{E(sub)}{vline}</span></div><span></span></div>')
        st = f'<p class="note muted stopl" role="status">{b(4)}{E(status)}</p>' if status else ""
        pp = ("pause", "Pause") if playing else ("play", "Play")
        return (f'<div class="fp">{top}<div class="lyr">{b(2)}{"".join(ly)}</div>'
                f'<div class="fpc"><div class="prog" role="progressbar" aria-label="verse {cur} of {last}">{b(3)}{bar_}</div>'
                f'<div class="progl note muted"><span>Verse {cur}</span><span>of {last}</span></div>{st}'
                f'<div class="fpr"><button class="mpb mps" aria-label="Speed {speed}, stop and repeat">{b(5)}{speed}</button>'
                f'<button class="mpb big" aria-label="Previous verse">{ic("prevv", 26)}</button>'
                f'<button class="mpb mpp big2" aria-label="{pp[1]}">{ic(pp[0], 30)}</button>'
                f'<button class="mpb big" aria-label="Next verse">{ic("nextv", 26)}</button>'
                f'<button class="mpb guideb" aria-label="Open the passage guide">Guide</button></div></div></div>')

    j1 = t5("JHN", 1, 1, 51)
    def jrows_(a, b_):
        return [r for r in j1 if a <= r[0] <= b_]
    HEART = "Heart, computer voice"

    def pmenu_(rows, header=None):
        # A native UIMenu drawn: header line, rows with the tick leading (iOS), a submenu row ends in ›.
        hd = f'<p class="mhd">{E(header)}</p>' if header else ""
        out = []
        for main, subl, on, more in rows:
            tick = f'<span class="mck">{ic("check", 18) if on else ""}</span>'
            s = f'<span class="msub">{E(subl)}</span>' if subl else ""
            chk = ' aria-checked="true"' if on else ""
            out.append(f'<button role="menuitem"{chk}>{tick}<span class="mrm"><span>{E(main)}</span>{s}</span>'
                       f'{ic("right", 16) if more else ""}</button>')
        return f'<div class="menu pmenu lbmenu" role="menu">{hd}{"".join(out)}</div>'

    TOPM = lambda sp="1×", stop="Off", rep="Off": pmenu_([("Speed", sp, False, True), ("Stop playing", stop, False, True), ("Repeat", rep, False, True)])
    base5 = lfull(jrows_(3, 9), 5, 4, voice=HEART)
    F("LB-01", "The speed button opens one menu: speed, stop and repeat, each showing its setting", base5 + '<div class="menuscrim"></div>' + TOPM(), "lb")

    STOPM = pmenu_([("End of this passage", "After 1:18", False, False), ("End of this chapter", "After 1:51", False, False),
                    ("In 15 minutes", None, False, False), ("In 30 minutes", None, False, False), ("In 1 hour", None, False, False), ("Off", None, True, False)], "Stop playing")
    F("LB-02", "Stop playing: two natural breaks, then three times; a time finishes its verse first", base5 + '<div class="menuscrim"></div>' + STOPM, "lb")

    F("LB-03", "A stop is set: one line under the progress says when", [
        ("Light · end of this passage", "light", lfull(jrows_(3, 9), 5, 4, voice=HEART, status="Stops after 1:18")),
        ("Dark · in 30 minutes", "dark", lfull(jrows_(3, 9), 5, 4, voice=HEART, status="Stops in 27 min")),
        ("AX5 · end of this passage", "ax5", lfull(jrows_(3, 9), 5, 4, voice=HEART, status="Stops after 1:18"))], "lb")

    # The stop is a pause at the break, so the place moves on: Play starts 1:19, the next passage.
    stopped = lfull(jrows_(17, 23), 19, None, title=PERI["JHN.1.19-1.34"][0], voice=HEART, playing=False)
    F("LB-04", "Stopped at the break: paused on the next verse, so Play carries on", stopped, "lb")

    REPM = pmenu_([("This verse", "1:5", False, False), ("This passage", "1:1–18", False, False), ("This chapter", "John 1", False, False), ("Off", None, True, False)], "Repeat")
    F("LB-05", "Repeat: the verse, the passage or the chapter, each naming its span", base5 + '<div class="menuscrim"></div>' + REPM, "lb")

    F("LB-06", "Repeating the passage: after 1:18 it starts again at 1:1", [
        ("Light · the second time through", "light", lfull(jrows_(1, 8), 3, 2, voice=HEART, status="Repeats 1:1–18")),
        ("Dark · with a stop", "dark", lfull(jrows_(1, 8), 3, 2, voice=HEART, status="Repeats 1:1–18 · Stops in 12 min")),
        ("AX5 · with a stop", "ax5", lfull(jrows_(1, 8), 3, 2, voice=HEART, status="Repeats 1:1–18 · Stops in 12 min"))], "lb")

    # A repeated verse never reaches a passage's end, so the stop offers only what can happen.
    STOPV = pmenu_([("In 15 minutes", None, False, False), ("In 30 minutes", None, False, False), ("In 1 hour", None, False, False), ("Off", None, True, False)], "Stop playing")
    F("LB-07", "Repeating a verse: Stop offers only the times, since no break will come",
      lfull(jrows_(3, 9), 5, 4, voice=HEART, status="Repeats 1:5") + '<div class="menuscrim"></div>' + STOPV, "lb")

    # The chapter's name is spoken between chapters, in the reading's own voice: John 2 is the current line, then 2:1.
    j2r = t5("JHN", 2, 1, 5)
    head2 = (f'<p class="ly past"><span class="lyn">51</span>{E(j1[-1][1])}</p>'
             '<p class="ly cur lyt" aria-current="true" aria-label="John, chapter 2, playing">John 2</p>')
    turn = lfull(j2r, 1, None, title=PERI["JHN.2.1-2.12"][0], sub="John 2 · BSB", voice=HEART, last=25, segs=[(1, 12), (13, 25)], head=head2)
    F("LB-08", "Between chapters: the chapter’s name is spoken, shown as the line playing", turn, "lb")

    # WEB, KJV and LSV: one voice each (John, 13 Oct 2026: WEB Heart, KJV George, LSV Heart). The voice is named as in
    # the BSB; the Voice sheet keeps the book's download and drops the choice, since there is none to make.
    w1 = [r for r in t5("JHN", 1, 3, 9, tr="WEB")]
    web = lfull(w1, 5, 4, sub="John 1 · WEB", voice=HEART)
    k1 = [r for r in t5("JHN", 1, 3, 9, tr="KJV")]
    kjv = lfull(k1, 5, 4, sub="John 1 · KJV", voice="George, computer voice")
    def vsheet_tr(tr, name):
        body = sec(None, f'<div class="lrow"><span class="rm"><span class="lmain">{E(name)}</span><span class="note muted lsub">Computer voice</span></span></div>', first=True)
        dl = vrow("Download John", f"21 chapters · {todo_src('size from the manifest')}", right=DLG)
        return sheet("med", "Voice", f"John 1 · {tr}", body + sec("Download", dl), foot=False)
    F("LB-09", "The WEB read by Heart, the KJV by George: the version’s own reading, its voice named", [
        ("Light · WEB, Heart", "light", web), ("Dark · KJV, George", "dark", kjv), ("AX5 · KJV, George", "ax5", kjv)], "lb")
    F("LB-10", "Voice on the KJV: George reads it, so no choice; the book’s KJV reading to download", kjv + scrim() + vsheet_tr("KJV", "George"), "lb")
    # Each reading is its own download, named by its text.
    dlw = (sec("Readings", vrow2("John · Heart · BSB", todo_src("size from the manifest"), chev=False) + vrow2("John · George · KJV", todo_src("size from the manifest"), chev=False), first=True))
    F("LB-11", "Downloads: a book’s readings listed by voice and text", page(("Settings", "Back to Settings"), "Downloads", dlw), "lb")

    NEXT_NOTES["refs_lb"] = (
        "Build 6 · listening (John approved 13 Oct 2026, after a review of the Dwell app; ideas only, none of its wording)\n\n"
        "One menu (LB-01): the speed button opens a native menu of three rows, each showing its setting as a second line: Speed, Stop playing, Repeat. "
        "The control row keeps its five buttons. VoiceOver: 'Speed 1×, stop and repeat, button'; its value adds 'stops after 1:18' or 'repeats 1:1–18' when set.\n\n"
        "Stop playing (LB-02): End of this passage, End of this chapter, In 15 / 30 minutes, In 1 hour, Off. Each break says where it lands ('After 1:18'). "
        "A time finishes the verse it is in. In memory only: closing the app clears it. A book with no passages drops the passage row (US-02).\n\n"
        "The status line (LB-03, LB-06): one muted line under the progress, only while something is set. 'Stops after 1:18', 'Stops in 27 min' (whole minutes, rounded up), 'Repeats 1:1–18'. "
        "Nothing on the mini player: it opens the full player, where the line is.\n\n"
        "At the stop (LB-04): audio pauses at the break and the place moves to the next verse, so Play carries on from 1:19. The setting returns to Off. No banner.\n\n"
        "Repeat (LB-05, LB-06): This verse (1:5), This passage (1:1–18), This chapter (John 1), Off. A passage loops to the latest passage start at or before the playing verse. "
        "Previous and Next still move by verse; the loop is what happens at the end.\n\n"
        "Stop with repeat (LB-07): Stop lists only the breaks the loop will reach. Repeating a verse: times only. Repeating the passage: End of this passage (the end of this time through) and the times. "
        "Choosing a smaller repeat clears a stop it would never reach.\n\n"
        "Between chapters (LB-08): the next chapter's name is spoken in the reading's own voice ('John, chapter two'; 'Psalm twenty-three'), shown as a line above 2:1 in ink, then verse 1 starts. "
        "Pause during the name: Play says the name again. A stop at the chapter's end stops before the name. The iPhone voice speaks the same words. VoiceOver: the line reads 'John, chapter 2, playing'; nothing is announced.\n\n"
        "WEB, KJV and LSV (LB-09–11), one voice each (John, 13 Oct 2026): WEB Heart, KJV George, LSV Heart, published book by book after the BSB run. A page in one of them plays that version's reading in its voice, named as in the BSB. The Heart or George choice applies only where both exist (today the BSB), so on these the Voice sheet shows the one voice, untickable, and keeps the book's download (LB-10). Where a book's reading isn't published yet, the iPhone voice reads and the voice line is plain text (BA-06), exactly as today. "
        "Downloads lists each reading by voice and text. NIV, NKJV, NLT and MSG are never read by any voice (rule 9): under a licensed page Listen plays the BSB, and the player says BSB (EG-03, unchanged).\n\n"
        f"Refs: Apple Podcasts stop times in a native menu {M('e8c63ed4-2e3a-48cb-a080-7aa53b5524a8')} · Insight Timer 'End of Track' with what's left {M('3d07ca31-4aa3-4140-88a1-cc8b8b655186')} · "
        f"Matter speed in a native menu {M('e76e8878-9a63-45fc-8049-2e7d40cd7930')} · Apple Photos 'Loop' as a menu row {M('d6180b87-d373-482d-b227-099130ccf975')}. "
        f"Rejected: a moon button beside speed (Apple Podcasts): a sixth control in the row; full-sheet timer lists (SiriusXM {M('110b26d8-1d2b-42ad-9d82-fccd7cf067e5')}, ElevenReader {M('dfc70a7f-265e-4dcd-90ee-b882faa05a79')}): a second sheet over the player for one choice.")
# ================= Build 6: Download for the licensed versions (John approved 15 Oct 2026) =================
# One book of the NKJV, NLT or MSG kept on the iPhone, fetched chapter by chapter through the licensed proxy into
# licensed_chapters. Terms (docs/licensed-translations.md §11, §18.8): refreshed within 30 days, a chapter 30 days
# old is deleted and never shown, removal and termination delete it. "Download" is John's word. The book's download
# sits under its version, as the Voice sheet keeps a book's reading (BA-03/04/07): HBO Max lists a download per
# title with its count, mobbin.com/screens/d9a2fca3-d30a-424a-befb-a9d3f4454ea9.
if STYLE != "v1":
    NK_CUR = trrow("NKJV", "New King James Version", "Thomas Nelson", CHECK, cls="current", label="New King James Version, selected")
    NLT_R = trrow("NLT", "New Living Translation", "Tyndale House", "")
    MSG_R = trrow("MSG", "The Message", "A paraphrase · NavPress", "")
    on_lic = on_phone.replace(CHECK, "").replace(' class="trrow current"', ' class="trrow"').replace("Berean Standard Bible, selected", "Berean Standard Bible")

    def ld_row(state):
        return {"none": vrow("Download John", "21 chapters", right=DLG.replace("Download John", "Download John in the NKJV")),
                "busy": vrow("Downloading John", "6 of 21 chapters", right=f'<button class="trbtn" aria-label="Stop downloading John, 6 of 21 chapters">{pring(29)}</button>'),
                "done": vrow("John is downloaded", "21 chapters", right=MOREB.replace("More: Remove download", "More: Remove John’s NKJV download")),
                "limit": vrow("Download John", "Try again tomorrow", right=""),
                "off": vrow("Download John", "21 chapters", right="")}[state]

    def ld_sheet(state, hint="Needs a connection.", scrolled=False):
        # AX5 frames show the sheet scrolled to Online, where the row is.
        online_ = NK_CUR + f'<div class="ldsub">{ld_row(state)}</div>' + NLT_R + MSG_R
        body = ("" if scrolled else sec("On your iPhone", on_lic, first=True)) + sec("Online", f'<p class="note muted offl">{E(hint)}</p>' + online_)
        return sheet("lg", "Translations", None, body, back=True, foot=False)

    nk3 = rd("JHN", 3, placeholder_text("NKJV text of John 3, as API.Bible sends it. Licensed: not reproduced on the canvas."), tr="NKJV") + scrim()
    F("LD-01", "Reading the NKJV: Download John sits under the version, as a free translation’s download does", [("Light", "light", nk3 + ld_sheet("none")), ("Dark", "dark", nk3 + ld_sheet("none")), ("AX5 · scrolled to Online", "ax5", nk3 + ld_sheet("none", scrolled=True))], "ld")
    F("LD-02", "Downloading: chapters counted, one at a time; the ring stops it", [("Light", "light", nk3 + ld_sheet("busy")), ("Dark", "dark", nk3 + ld_sheet("busy")), ("AX5 · scrolled to Online", "ax5", nk3 + ld_sheet("busy", scrolled=True))], "ld")
    rm = ('<div class="menu rmmenu" role="menu" style="right:24px;bottom:auto;top:430px">'
          f'<button role="menuitem"><span>Remove John’s NKJV</span>{ic("x", 20)}</button></div>')
    F("LD-03", "Downloaded: ⋯ holds Remove; after 30 days without a refresh it is Download John again", [
        ("Light · downloaded", "light", nk3 + ld_sheet("done")),
        ("Dark · ⋯ › Remove", "dark", nk3 + ld_sheet("done") + '<div class="menuscrim"></div>' + rm),
        ("AX5 · downloaded", "ax5", nk3 + ld_sheet("done", scrolled=True))], "ld")
    F("LD-04", "Can’t download now: the day’s limit, or no connection; the row stays, the button goes", [
        ("Light · the day’s limit", "light", nk3 + ld_sheet("limit")),
        ("Dark · offline", "dark", nk3 + ld_sheet("off", "Downloads need a connection.")),
        ("AX5 · the day’s limit", "ax5", nk3 + ld_sheet("limit", scrolled=True))], "ld")
    dlp = (sec("Translations", vrow2("John · NKJV", "21 chapters", chev=False), first=True)
           + sec("Readings", vrow2("John · Heart · BSB", todo_src("size from the manifest"), chev=False)))
    F("LD-05", "Downloads lists the book under Translations, removed like the others", page(("Settings", "Back to Settings"), "Downloads", dlp), "ld")

    NEXT_NOTES["refs_ld"] = (
        "Build 6 · Download for the NKJV, NLT and The Message (John approved 15 Oct 2026)\n\n"
        "ON HOLD (15 Oct 2026): not to be built until John decides. API.Bible's Starter plan allows 5,000 calls a month for the whole account (docs.api.bible/quick-start/rate-limiting), shared by every reader; one book of Psalms is 150 calls. §9.1 also confirms licensed text is never spoken, so Listen under a licensed page stays the BSB.\n\n"
        "Where: Translations › Online, under the version being read: 'Download John · 21 chapters' with the download glyph (LD-01), the same row, glyph, ring and ⋯ as a book's reading in the Voice sheet (BA-03/04/07). "
        "Only the book being read is offered, one at a time, never the whole Bible: the API.Bible Starter plan has a daily request limit on the account (one constant in the app, John confirms the number).\n\n"
        "Downloading (LD-02): chapter by chapter through the licensed proxy, one request at a time, into licensed_chapters in user.db. '6 of 21 chapters'; the ring stops it and keeps the chapters already fetched. "
        "Downloaded (LD-03): 'John is downloaded', ⋯ › Remove. The reader then opens John offline with its notice under the text, as online; LT-03's 'needs a connection' never shows for it.\n\n"
        "Kept honest (§11, §18.8): online, a downloaded book is refreshed quietly before any chapter reaches 30 days. A chapter 30 days old is deleted at launch and never shown, even offline; "
        "a book with any deleted chapter shows 'Download John' again. No 'expires in' line. Removing the version, or the proxy no longer serving it, deletes its chapters at the next launch, as today.\n\n"
        "Can't (LD-04): the day's limit reached (the proxy's 429) says 'Try again tomorrow' in the row; offline, the Online group's line becomes 'Downloads need a connection.' as for free translations. Rows are never dimmed.\n\n"
        "Downloads (LD-05): the book under Translations, 'John · NKJV · 21 chapters'. No sizes: the proxy sends no length and the text is small.\n\n"
        "Never (rule 9): R2, the pipeline, audio, AI, widgets, Siri, Spotlight or notifications.\n\n"
        "VoiceOver: 'Download John in the NKJV, 21 chapters, button'; downloading 'Stop downloading John, 6 of 21 chapters'; progress announced politely every 25%.\n\n"
        f"Refs: HBO Max downloads per title {M('d9a2fca3-d30a-424a-befb-a9d3f4454ea9')} · Udemy section download in the list {M('b9a7ca6e-c921-4ca5-9579-c18e634a7612')}. "
        f"Rejected: Apple TV's select-and-delete mode {M('7f8d63f9-51ce-4239-9005-df7db597c38f')}: one book at a time needs no batch.")
# ================= System surfaces (John, 15 Oct 2026: "improve our widgets and Siri, notifications and live notifications") =================
# Supersedes WL-01–04, MS-02/03, NT-04–08 and EG-05. Every surface here is outside Yada, so rule 9 is absolute: references
# and BSB text only, never the NIV, NKJV, NLT or MSG, whatever the reader reads in the app. No streaks, counts or "missed";
# dates written out; the Live Activity is started and ended on the phone, never by push. Sizes are iPhone 17 Pro points
# (402 × 874): widgets scaled from Apple's 393 pt table (small 162, medium 346 × 162, large 346 × 362), Lock Screen
# accessories circular 72, rectangular 160 × 72, inline one line; Live Activity at most 160 tall; Dynamic Island compact 36 tall.
if STYLE != "v1":
    PS = 138  # psalmForDay(15 Oct 2026) in src/lib/reminder.ts: day 287 of the year, (287 % 150) + 1
    p138 = t5("PSA", PS, 1, 3)
    SUP, P1 = p138[0][1].split(". ", 1)  # "Of David." is the psalm's title, carried in verse 1 of the BSB text
    j5 = dict(t5("JHN", 5, 1, 17))
    j1 = dict(t5("JHN", 1, 1, 9))
    PLAB5 = p5[1]
    NXT = [p for p in JP if p[0] == "JHN.5.16-5.47"][0][1]
    P23 = t5("PSA", 23, 1, 3)
    SEGS = LB_SEGS
    MARK = f'<svg viewBox="0 0 256 256" aria-hidden="true"><path d="{SYM_D}" fill="currentColor"></path></svg>'

    def g(name, s=20):
        p = {"book": '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6v13c-2.5-1.5-5.5-1.5-8-.5z"></path><path d="M20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z"></path>',
             "moon": '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"></path>',
             "repeat": '<path d="M5 10V9a3 3 0 0 1 3-3h11l-3-3M19 14v1a3 3 0 0 1-3 3H5l3 3"></path>'}
        if name in p:
            return f'<svg class="i" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p[name]}</svg>'
        return ic(name, s)

    def place(cur, a=1, b=15):
        # Where the place is in the passage: one hairline, the read part in ink. A position, never a count.
        return f'<span class="sxplace" aria-hidden="true"><span style="width:{(cur - a + 1) / (b - a + 1) * 100:.0f}%"></span></span>'

    def segbar(cur, cls="", segs=None):
        # Build 6's passage-segmented progress (LB): one segment per passage of the chapter, gaps between them.
        return (f'<span class="sxseg {cls}" aria-hidden="true">' + "".join(
            f'<span style="flex:{b_ - a_ + 1}"><i style="width:{min(100, max(0, (cur - a_ + 1) / (b_ - a_ + 1) * 100)):.0f}%"></i></span>' for a_, b_ in (segs or SEGS)) + '</span>')

    def lbtn(label, playing=False, size="m"):
        icn = "pause" if playing else "play"
        return f'<button class="sxl {size}" aria-label="{label}">{ic(icn, 20 if size == "m" else 16)}</button>'

    # ---------- Home Screen widgets ----------
    def cont_s():
        return (f'<button class="sxw s" aria-label="Continue, {E(PLAB5)}, John 5:6. Opens Yada at John 5:6">'
                f'<span class="sxo">Continue</span><span class="sxt">{E(PLAB5)}</span><span class="sxsp"></span>'
                f'<span class="sxr">John 5:6</span>{place(6)}</button>')

    def cont_m(playing=False):
        return (f'<div class="sxw m" role="group" aria-label="Continue, {E(PLAB5)}, John 5:6">'
                f'<a class="sxwm" aria-label="Opens Yada at John 5:6"><span class="sxo">Continue</span><span class="sxt">{E(PLAB5)}</span>'
                f'<span class="sxq">{scripture(j5[6])}</span><span class="sxsp"></span><span class="sxr">John 5:6 · BSB</span>{place(6)}</a>'
                f'<span class="sxwb">{lbtn("Pause" if playing else "Listen from John 5:6", playing)}</span></div>')

    def cont_l():
        vv = "".join(f'<p class="sxv{" here" if n == 6 else ""}"><span class="sxn">{n}</span>{scripture(j5[n])}</p>' for n in (5, 6))
        return (f'<div class="sxw l" role="group" aria-label="Continue, {E(PLAB5)}, John 5:6">'
                f'<span class="sxo">Continue</span><span class="sxt big">{E(PLAB5)}</span><span class="sxr mute">John 5:1–15</span>'
                f'<div class="sxvv">{vv}</div><span class="sxsp"></span>'
                f'<div class="sxfoot"><span class="sxfl">{place(6)}<span class="sxr">John 5:6 · BSB</span></span>{lbtn("Listen from John 5:6")}</div></div>')

    def today_s():
        return (f'<button class="sxw s" aria-label="A passage for today, Psalm {PS}. Opens Psalm {PS}">'
                f'<span class="sxo">Psalm</span><span class="sxbig">{PS}</span><span class="sxq3">{scripture(P1)}</span></button>')

    def today_m(playing=False, verse=1):
        foot = (f'<span class="sxr">Playing · {PS}:{verse}</span>' if playing else f'<span class="sxr">Psalm {PS}:1 · BSB</span>')
        return (f'<div class="sxw m" role="group" aria-label="A passage for today, Psalm {PS}">'
                f'<a class="sxwm" aria-label="Opens Psalm {PS}"><span class="sxsup">{SUP}.</span><span class="sxq big">{scripture(P1)}</span><span class="sxsp"></span>{foot}</a>'
                f'<span class="sxwb">{lbtn("Pause" if playing else f"Listen to Psalm {PS}", playing)}</span></div>')

    def today_l():
        vv = "".join(f'<p class="sxv"><span class="sxn">{n}</span>{scripture(P1 if n == 1 else t_)}</p>' for n, t_ in p138)
        return (f'<div class="sxw l" role="group" aria-label="A passage for today, Psalm {PS}">'
                f'<span class="sxo">A passage for today</span><span class="sxt big">Psalm {PS}</span><span class="sxsup">{SUP}.</span>'
                f'<div class="sxvv">{vv}</div><span class="sxsp"></span>'
                f'<div class="sxfoot"><span class="sxr">BSB</span>{lbtn(f"Listen to Psalm {PS}")}</div></div>')

    def lab(w, name="Yada"):
        return f'<div class="sxcell">{w}<span class="sxlab">{name}</span></div>'

    def home(*rows, top=""):
        return f'<div class="hscr sxhome">{top}<div class="sbar"><span>9:41</span></div><div class="sxgrid">{"".join(rows)}</div></div>'

    def sxapps(n):
        return f'<div class="sxapps">{apps(n)}</div>'

    F("SX-01", "Continue, small and medium: the passage by name, your place on one line; Listen without opening", home(
        f'<div class="sxrow">{lab(cont_s())}{sxapps(4)}</div>', lab(cont_m()), sxapps(4)), "sx")
    F("SX-02", "Continue, large: the verses around your place, the place marked as in the reader", home(lab(cont_l()), sxapps(4)), "sx")
    F("SX-03", "A passage for today, small and medium: the psalm’s number set large, its first words", home(
        f'<div class="sxrow">{lab(today_s())}{sxapps(4)}</div>', lab(today_m()), sxapps(4)), "sx")
    F("SX-04", "A passage for today, large: the psalm’s opening, read or heard", home(lab(today_l()), sxapps(4)), "sx")
    di_c = lambda v="138:2", ring=0.33: (f'<div class="sxdi c" role="group" aria-label="Yada, playing, Psalm {v}">'
                                          f'<span class="sxring" style="--p:{ring}"><span>{MARK}</span></span><span class="sxcam"></span><span class="sxdv">{v}</span></div>')
    F("SX-05", "Listen pressed: it plays where you are, the button turns to Pause, the Island takes over", home(
        f'<div class="sxrow">{lab(today_s())}{sxapps(4)}</div>', lab(today_m(True, 2)), sxapps(4), top=di_c()), "sx")
    tint = home(f'<div class="sxrow">{lab(cont_s())}{lab(today_s())}</div>', lab(today_m()), sxapps(4))
    F("SX-06", "Tinted Home Screen: the background goes, type and the Listen ring take the tint", [
        ("Light · tinted", "light tinted", tint), ("Dark · tinted", "dark tinted", tint), ("AX5 · tinted", "ax5 tinted", tint)], "sx")

    # ---------- Lock Screen accessories and StandBy ----------
    def lockbg(inner, date="Thursday 15 October", time="9:41", inline=None, cls=""):
        d = inline or E(date)
        return f'<div class="lscr sxlock {cls}"><p class="lsd">{d}</p><p class="lst">{time}</p>{inner}</div>'
    inl = f'<span class="sxinl">{g("book", 16)}Psalm {PS} · {E(" ".join(P1.split()[:5]))}…</span>'
    acc = (f'<div class="sxacc">'
           f'<button class="sxac c" aria-label="Continue, John 5:6"><span class="sxring big" style="--p:.4"><span class="sxacv">5:6</span></span></button>'
           f'<button class="sxac r" aria-label="Psalm {PS}:1. {E(P1)}"><span class="sxacr">Psalm {PS}:1</span><span class="sxacq">{scripture(P1)}</span></button>'
           f'<button class="sxac c" aria-label="Listen to Psalm {PS}"><span class="sxacl">{ic("listen", 26)}</span></button></div>')
    F("SX-07", "Lock Screen: today’s psalm inline, your place in a ring, the verse in a rectangle, Listen in a circle", lockbg(acc, inline=inl), "sx")

    def standby(right):
        return (f'<div class="sxsb" role="group" aria-label="StandBy"><div class="sxsbclock"><span>9:41</span></div>{right}</div>')
    sb_today = (f'<div class="sxsbw"><span class="sxo">Psalm {PS}</span><span class="sxsbq">{scripture(P1)}</span></div>')
    F("SX-08", "StandBy at night: the psalm beside the clock, in night mode’s one red", [
        ("Light · StandBy, daytime", "dark sb", standby(sb_today)),
        ("Dark · night mode", "dark sb night", standby(sb_today)),
        ("AX5 · daytime", "ax5 sb", standby(sb_today))], "sx")

    # ---------- Control Center ----------
    cc = (f'<div class="sxcc"><div class="sxccg">'
          + '<span class="sxct"></span>' * 4
          + f'<button class="sxctl wide on" aria-label="Listen, John 1:5, playing"><span class="sxcti">{ic("pause", 20)}</span><span class="sxctt"><b>Listen</b><span>John 1:5</span></span></button>'
          + f'<button class="sxctl" aria-label="Continue reading, John 5:6"><span class="sxcti">{g("book", 22)}</span></button>'
          + '<span class="sxct"></span>' * 5 + '</div></div>')
    F("SX-09", "Control Center: Listen as a wide toggle showing the place; Continue as a small button", cc, "sx")

    # ---------- Siri, Shortcuts, Spotlight ----------
    psalm23 = "".join(f'<p class="sxv"><span class="sxn">{n}</span>{scripture(t_)}</p>' for n, t_ in P23)
    siri = (home(f'<div class="sxrow">{sxapps(4)}</div>', sxapps(4), sxapps(4))
            + f'<div class="sxsiri" role="group" aria-label="Siri: Psalm 23, BSB"><p class="sxo">Psalm 23 · BSB</p><p class="sxt big">The <span class="sc">Lord</span> is my shepherd</p>'
            f'<div class="sxvv">{psalm23}</div><div class="sxbtns"><button class="sxpill">Read</button><button class="sxpill">{ic("play", 16)}Listen</button></div></div>'
            '<div class="siriglow"></div>')
    F("SX-10", "Siri, “Read Psalm 23 in Yada”: Siri reads the BSB; Read opens it, Listen plays the recording", siri, "sx")
    TILES = [("book", "Continue reading", "Continue reading in Yada"), ("listen", "Listen to the next passage", "Listen to the next passage in Yada"),
             ("play", f"Today’s psalm", "Read today’s psalm in Yada"), ("moon", "Stop at the end of the chapter", "Stop Yada at the end of the chapter"),
             ("repeat", "Repeat this passage", "Repeat this passage in Yada"), ("search", "Read a verse", "Read Psalm 23 in Yada")]
    sc = (f'<div class="sxsys"><div class="sbar"><span>9:41</span></div><p class="sxsyst">Yada</p><p class="sxsyss">App Shortcuts</p><div class="sxtiles">'
          + "".join(f'<div class="sxtile"><span class="sxtg">{g(i_, 22)}</span><span class="sxtt">{E(t_)}</span><span class="sxtp">“{E(p_)}”</span></div>' for i_, t_, p_ in TILES)
          + '</div></div>')
    F("SX-11", "Shortcuts: six, each with the sentence to say; two new for build 6 (stop, repeat)", sc, "sx")
    spot = (f'<div class="spot sxspot"><div class="sbar"><span>9:41</span></div><div class="spf">{ic("search", 18)}<span>psalm 23</span></div>'
            f'<p class="spl">Top Hit</p><div class="sxtop" role="group" aria-label="Psalm 23, The Lord is my shepherd, Berean Standard Bible">'
            f'<span class="appic yic">{MARK}</span><span class="rm"><span class="spt">Psalm 23</span><span class="sxtops">The <span class="sc">Lord</span> is my shepherd</span>'
            f'<span class="spx">{scripture(P23[0][1])}</span></span></div>'
            f'<div class="sxbtns sp"><button class="sxpill">Read</button><button class="sxpill">{ic("play", 16)}Listen</button></div>'
            f'<p class="spl">Yada</p><div class="sxspr"><span class="spt">Psalm 23:4</span><span class="spx">{scripture(t5("PSA", 23, 4)[0][1])}</span></div></div>')
    F("SX-12", "Spotlight: Psalm 23 as the top hit, its first verse, Read and Listen beside it", spot, "sx")

    # ---------- Notifications ----------
    def ntf(title, body, when="now", cls=""):
        return (f'<div class="sxnt {cls}" role="group" aria-label="Yada, {E(title)}. {E(body)}"><span class="appic yic">{MARK}</span>'
                f'<span class="rm"><span class="sxnth"><b>{E(title)}</b><span>{when}</span></span><span class="sxntb">{scripture(body)}</span></span></div>')
    rem = ntf(f"Next in John: {NXT}", j5[16], "7:30")
    F("SX-13", "The reminder, collapsed: the next passage by name over its first words", lockbg(f'<div class="sxns">{rem}</div>', time="7:31"), "sx")
    rich = (f'<div class="sxrich" role="group" aria-label="Next in John, {E(NXT)}, John 5:16–47"><p class="sxo">Next in John</p><p class="sxt big">{E(NXT)}</p>'
            f'<p class="sxr mute">John 5:16–47 · BSB</p><div class="sxvv">' + "".join(f'<p class="sxv"><span class="sxn">{n}</span>{scripture(j5[n])}</p>' for n in (16, 17)) + '</div></div>'
            '<div class="nacts sxacts"><button class="nact">Read</button><button class="nact">Listen</button></div>')
    F("SX-14", "Long-press: the passage opens in Yada’s serif; Read or Listen, nothing else", lockbg(f'<div class="sxblur"></div><div class="sxns top">{rich}</div>', time="7:31"), "sx")
    stack = (f'<div class="sxns"><p class="sxgh">Yada</p>{ntf(f"Next in John: {NXT}", j5[16], "7:30")}<div class="sxbehind"></div></div>')
    F("SX-15", "Grouped: today’s reminder on top; yesterday’s was taken back when this one came", lockbg(stack, time="7:31"), "sx")
    summ = (f'<div class="sxsum" role="group" aria-label="Morning summary"><p class="sxsumh">Your Morning Summary</p>'
            f'<div class="sxsumtop"><span class="appic yic">{MARK}</span><span class="rm"><b>A passage for today</b><span class="sxntb q">{scripture(P1)} Psalm {PS}:1</span></span></div>'
            '<div class="sxsumo"><span class="appic"></span><span class="appic"></span><span class="appic"></span><span class="sxsuml"></span></div></div>')
    F("SX-16", "Scheduled Summary: today’s psalm leads it, as its verse, not as a nudge", lockbg(summ, time="8:00"), "sx")

    # ---------- Live Activity ----------
    def la(cur=5, playing=True, status=None, title=None, verse=None, ref=None, cls="", segs=None):
        title = title or JLAB
        ref = ref or f"1:{cur}"
        verse = j1.get(cur, "") if verse is None else verse
        st = f'<span class="sxlast">{status}</span>' if status else '<span class="sxlast"></span>'
        pp = ("pause", "Pause") if playing else ("play", "Play")
        return (f'<div class="sxla {cls}" role="group" aria-label="Yada, {"playing" if playing else "paused"}. {E(title)}, John {ref}{". " + E(status) if status else ""}">'
                f'<div class="sxlah"><span class="sxlam">{MARK}</span><span class="sxlat">{E(title)}</span><span class="sxlar">{ref}</span></div>'
                f'<p class="sxlav">{scripture(verse)}</p>{segbar(cur, segs=segs)}'
                f'<div class="sxlaf">{st}<span class="sxlac"><button aria-label="Previous verse">{ic("prevv", 22)}</button>'
                f'<button class="pp" aria-label="{pp[1]}">{ic(pp[0], 24)}</button><button aria-label="Next verse">{ic("nextv", 22)}</button></span></div></div>')
    F("SX-17", "Live Activity: passage, verse in the BSB, the passages as segments, and the stop set", lockbg(la(5, status=f'{g("moon", 14)}Stops after 1:18')), "sx")
    F("SX-18", "Repeating the passage, paused: the line says Repeats; Play goes on from the same verse", lockbg(la(9, False, status=f'{g("repeat", 14)}Repeats 1:1–18')), "sx")
    F("SX-19", "Between chapters: the spoken chapter name is the line, in ink, while it is said", lockbg(la(0, verse="", ref="2:1", segs=[(1, 12), (13, 25)], title="The wedding at Cana", status=f'{g("moon", 14)}Stops in 27 min').replace('<p class="sxlav"></p>', '<p class="sxlav name">John, chapter 2</p>')), "sx")

    rd_bg = lambda: reader("JHN", 1, 1, 9, scrolled=False, rows_override=t5("JHN", 1, 1, 9))
    di_min = (f'<div class="sxdi o" aria-hidden="true"><span class="sxog"></span></div>'
              f'<div class="sxdi m" role="group" aria-label="Yada, playing, John 1:5"><span class="sxring" style="--p:.28"><span>{MARK}</span></span></div>')
    F("SX-20", "Dynamic Island: compact shows the passage ring and the verse; minimal, the ring alone", [
        ("Light · compact", "light", rd_bg() + di_c("1:5", .28)),
        ("Dark · minimal, beside another activity", "dark", rd_bg() + di_min),
        ("AX5 · compact", "ax5", rd_bg() + di_c("1:5", .28))], "sx")
    dix = (f'<div class="sxdix" role="group" aria-label="Yada, playing, {E(JLAB)}, John 1:5">'
           f'<div class="sxlah"><span class="sxring" style="--p:.28"><span>{MARK}</span></span><span class="sxlat">{E(JLAB)}</span><span class="sxlar">1:5</span></div>'
           f'<p class="sxlav">{scripture(j1[5])}</p>{segbar(5)}'
           f'<div class="sxlaf"><span class="sxlast">{g("moon", 14)}Stops in 27 min</span><span class="sxlac"><button aria-label="Previous verse">{ic("prevv", 22)}</button>'
           f'<button class="pp" aria-label="Pause">{ic("pause", 24)}</button><button aria-label="Next verse">{ic("nextv", 22)}</button></span></div></div>')
    F("SX-21", "Dynamic Island, expanded: the Lock Screen activity, black, around the camera", rd_bg() + '<div class="sxdim"></div>' + dix, "sx")
    sb_la = (f'<div class="sxsbla" role="group" aria-label="Yada, playing, {E(JLAB)}, John 1:5"><div class="sxsbt"><p class="sxo">{E(JLAB)} · John 1:5</p>'
             f'<p class="sxsbv">{scripture(j1[5])}</p>{segbar(5)}<p class="sxlast">{g("moon", 18)}Stops in 27 min</p></div>'
             f'<div class="sxsbc"><button aria-label="Previous verse">{ic("prevv", 34)}</button><button class="pp" aria-label="Pause">{ic("pause", 38)}</button><button aria-label="Next verse">{ic("nextv", 34)}</button></div></div>')
    F("SX-22", "StandBy while listening: the verse fills the screen, three controls at arm’s length", [
        ("Light · StandBy, daytime", "dark sb", f'<div class="sxsb">{sb_la}</div>'),
        ("Dark · night mode", "dark sb night", f'<div class="sxsb">{sb_la}</div>'),
        ("AX5 · daytime", "ax5 sb", f'<div class="sxsb">{sb_la}</div>')], "sx")
    end = la(18, False, title=JLAB, ref="1:18", verse=j1.get(18) or t5("JHN", 1, 18)[0][1], status="Stopped after 1:18").replace(
        'aria-label="Play"', 'aria-label="Play from John 1:19"')
    F("SX-23", "At the stop: audio paused at 1:18, Play goes on from 1:19; the phone ends the activity later", lockbg(end), "sx")

    NEXT_NOTES["refs_sx"] = (
        "System surfaces (John, 15 Oct 2026: widgets, Siri, notifications, Live Activities; 'be creative'). Supersedes WL-01–04, MS-02/03, NT-04–08, EG-05.\n\n"
        "One idea across every surface: the passage has a name, so the name leads, set in Literata; the reference is the second line; the verse is the third. "
        "No cards inside widgets, no badges, no counts, no streaks, dates written out.\n\n"
        "Sizes (iPhone 17 Pro, 402 × 874 pt): small 162 × 162, medium 346 × 162, large 346 × 362 (Apple's 393 pt table scaled; confirm in Xcode previews). "
        "Lock Screen: circular 72 × 72, rectangular 160 × 72, inline one line. Live Activity 374 wide, at most 160 tall. Island compact 36 tall; expanded 386 × 210. "
        "Every button at least 44 × 44.\n\n"
        "Widgets (SX-01–06). Continue in three sizes: the passage name, the reference, one hairline showing where the place sits in the passage (a position, not a count); "
        "large shows verses around the place with the reader's own Here mark (wash + 3 pt bar). A passage for today: the psalm's number large in small; "
        "medium and large add the BSB's title line ('Of David.') above the verse. Medium and large carry Listen, an AudioPlaybackIntent button: it plays without opening Yada, "
        "turns to Pause, and starts the Live Activity (SX-05). Tinted mode (SX-06): the paper goes, type and the ring take the tint; the passage name is the accented group.\n\n"
        "Lock Screen (SX-07): inline 'Psalm 138 · I give You thanks…', circular ring = place in passage with '5:6', rectangular = reference + verse, circular Listen. "
        "StandBy (SX-08, SX-22): night mode renders in one red; the verse is the largest thing on the screen after the clock.\n\n"
        f"Control Center (SX-09, iOS 18): Listen is a ControlWidgetToggle showing the place as its value; Continue is a ControlWidgetButton that opens at the place.\n\n"
        "Siri and Spotlight (SX-10–12): Siri's snippet is the BSB passage with Read and Listen; Siri's own voice reads the BSB text, Listen plays Yada's recording. "
        "Six App Shortcuts, each a sentence: Continue reading · Listen to the next passage · Read today's psalm · Stop Yada at the end of the chapter (build 6) · "
        "Repeat this passage (build 6) · Read Psalm 23 (a parameter). Spotlight's top hit is the passage, with Read and Listen as App Shortcut buttons.\n\n"
        "Notifications (SX-13–16): one a day at most. Collapsed: 'Next in John: The authority of the Son' over its first words. Long-press: a content extension in Yada's serif "
        "(title, reference, two verses), then iOS's Read and Listen. Each new reminder removes the one before it (same thread, removeDeliveredNotifications), so there is never a pile "
        "and never a 'you missed'. A passage for today sets a high relevanceScore so a Scheduled Summary leads with the verse. Download-finished stays as NT-08.\n\n"
        "Live Activity (SX-17–23): name in Literata, reference right, the current verse in the BSB (two lines), build 6's passage segments (John 1: 1–18, 19–34, 35–51), "
        "the stop or repeat line ('Stops after 1:18', 'Stops in 27 min', 'Repeats 1:1–18') with its glyph, and previous, play/pause, next by verse. "
        "Between chapters the spoken name is the line (SX-19). At the stop it pauses on 1:18 and Play goes on from 1:19 (SX-23); the app ends the activity with a dismissal date. "
        "Started and ended on the phone; no push token, nothing sent.\n\n"
        "AX5: widgets keep the name and reference and drop the verse; the Live Activity drops the verse and keeps name, line and controls (the 160 pt cap); "
        "Island compact keeps the reference. VoiceOver reads each surface as one element: 'Continue, Healing at the pool, John 5:6'; Listen is its own button.\n\n"
        "Rule 9: a reader on the NKJV sees the BSB here, labelled 'BSB' wherever verse text shows; Siri, Spotlight and notifications index only BSB. Never the NIV, NKJV, NLT or MSG.\n\n"
        f"Refs: segmented journey progress on a Live Activity, talabat {M('ec6b638f-ad1d-4f03-8b0e-889a969fdf28')} · Live Activity title, thin progress and one round control, Future Pro {M('6053e355-c9b4-46be-b92e-c728d74a29f6')} · "
        f"Island compact as a progress ring around a glyph with a value, Future Pro {M('77547503-ef77-4bad-b72b-727466292254')} and American Airlines {M('56fcbcca-6d48-4662-a6da-2cb1827605b9')} · "
        f"round in-activity buttons, Wispr Flow {M('ebc9b9f9-e039-4f90-a892-4fc115ebd800')} and Waymo {M('66063536-4fc7-4cd9-87a4-b87663436576')} · "
        f"interactive widget buttons in small and medium, Perplexity {M('9289eebd-4221-42df-9b55-82fef51780a4')} · round buttons on a small widget, Tolan {M('b61fb5ce-64dd-49c4-856f-547d326744dd')} · "
        f"one widget idea in several sizes, Jomo {M('fa1ae031-13bc-4eba-ad97-106f8f85b6f4')} · a centred serif quote with its source, Insight Timer {M('d8f6f4c7-6e5c-4a54-8e84-077f9f176191')} · "
        f"a shortcut listed with the sentence to say, Halide {M('ec35ab9d-9c02-433b-90fd-741076c816a9')}.\n"
        f"Rejected: illustration in the activity, Swiggy {M('0d7238ca-300e-477c-ad25-617f6d2d6279')} (no imagery in Yada); step counts and charts, Sweatcoin {M('36fdc175-debf-440c-b42e-bc9cdbf6f4c7')} (tallies); "
        f"'Unlock #1' counter, Jomo {M('33f005dd-806b-467c-b7e0-563e8116e26a')} (a count); glowing gradient type, Stardust {M('26b17b46-1486-4ba4-8fa5-65707a2da4a7')} (AI visual language); "
        f"a coloured time as the only signal, Flighty {M('a878818a-1f9e-4da1-93d6-5463fe9b0fcf')} (state by colour alone). "
        "Mobbin indexes no StandBy, Control Center, Siri or Spotlight screens: those follow Apple's system layouts.")
# ================= Build 6: asking for notifications (John, 15 Oct 2026) =================
# John: "why not show the notification permission once you get into the app, and again if you don't?" iOS shows
# its own prompt once only; a No given before Yada has shown what the reminder is can never be asked again. So
# Yada asks in its own words first, at the end of the first passage (the moment a daily reminder means
# something), shows the very notification it would send, and calls iOS only after a yes. Not now asks once more on
# a later return; then the reminder lives in Settings only. The old offer sat once at the foot of the guide and
# counted as offered the moment it rendered, so it was rarely seen.
# Refs: Vocabulary previews the real notification over a time choice, mobbin.com/screens/e992e0e3-bea7-4f37-b9bc-5dd096236d7d ·
# Todoist and How We Feel ask in context with a way out, mobbin.com/screens/71e24632-b2d1-46e8-8a2f-91950219b23a,
# mobbin.com/screens/220a74a9-69cb-4786-91fc-7c0436810dcf. Rejected: Structured's "Don't Miss Your Task!" with a
# glow, mobbin.com/screens/ff9fb695-e58b-49eb-b8de-cf23993499ce (urgency, guilt), and Mimo's mascot modal,
# mobbin.com/screens/34cb07f4-244d-46c6-acab-91ac13a98e3b.
if STYLE != "v1":
    ask_card = f'<div class="ntprev" aria-hidden="true">{notif("Next in John: The testimony of John the Baptist", t5("JHN", 1, 19)[0][1], when="7:30")}</div>'
    ask_sheet = sheet("med", "A reminder to read", None,
                      ask_card + sec(None, lrow("Every day", right='<span class="valr">7:30</span>', chev=False, cls="valrow"), first=True)
                      + '<button class="wide" aria-label="Turn on the reminder. iPhone will ask to allow notifications">Turn on</button>'
                      + '<button class="clink npnot" aria-label="Not now">Not now</button>', foot=False)
    end_of_passage = reader("JHN", 1, 15, 19, scrolled=False, rows_override=t5("JHN", 1, 15, 19)) + scrim()
    F("NP-01", "The first passage finished: Yada asks in its own words, showing the reminder it would send", end_of_passage + ask_sheet, "np")
    F("NP-02", "Turn on, then iOS asks, once (Apple’s own words)", end_of_passage + ask_sheet + '<div class="scrim"></div>' + alert, "np")
    again = (f'<div class="pnote" role="status"><p class="claim">A reminder to read each day?</p>'
             f'<div class="pnb"><button class="tbtn2">Turn on</button><button class="tbtn2 outline">Not now</button></div></div>')
    F("NP-03", "Not now: asked once more, on a later return, as one line on Home; then only in Settings", page(None, "Yada", again + home_cont + allp, right=HOME_ICONS), "np")

    NEXT_NOTES["refs_np"] = (
        "Asking for notifications (John, 15 Oct 2026)\n\n"
        "Why not at launch: iOS shows its prompt once. A No before Yada has shown what the reminder is can never be asked again, "
        "only changed in iPhone Settings. So Yada asks in its own words, at the end of the first passage (MM-01's boundary), and calls iOS only after Turn on (NP-02).\n\n"
        "NP-01: a medium sheet titled 'A reminder to read', the notification it would send (the next passage by name and its first words, BSB), "
        "'Every day 7:30' (tap to change), Turn on, Not now. No illustration, no urgency, no 'Don't miss'.\n\n"
        "Not now (NP-03): asked once more, the next time the reader returns after three or more days, as one line on Home under Continue. "
        "After a second Not now, never again: the reminder lives in Settings › Reminder. "
        "iOS says No: NT-10's one sentence and Open Settings, nothing more.\n\n"
        "Bug fixed with it: the old offer at the foot of the guide was marked offered as soon as it rendered, seen or not.\n\n"
        "Foreground: a reminder that fires while Yada is open goes to Notification Center without a banner.\n\n"
        "Refs: Vocabulary mobbin.com/screens/e992e0e3-bea7-4f37-b9bc-5dd096236d7d · Todoist mobbin.com/screens/71e24632-b2d1-46e8-8a2f-91950219b23a · "
        "How We Feel mobbin.com/screens/220a74a9-69cb-4786-91fc-7c0436810dcf. Rejected: Structured mobbin.com/screens/ff9fb695-e58b-49eb-b8de-cf23993499ce, "
        "Mimo mobbin.com/screens/34cb07f4-244d-46c6-acab-91ac13a98e3b.")
# ================= Build 6: Understand and Listen (John, 15 Oct 2026) ==========# Understand and Listen were two doors that never met. From a passage's guide or a verse's sheet, "Hear this passage"
# starts Listen at the passage's first verse and closes the sheet, so the text and the voice are together. From the
# full player, the playing line is the way to its Understand. A book with little written about it (Proverbs: an
# outline line and no summary, by design) shows that line and its rows, confidently: no empty slot, no "coming".
# Refs: Speechify's listen control beside the text it reads, mobbin.com/screens/c3343a61-2e32-4e5d-a061-39cd80573727 ·
# Blinkist's read/listen pair on one title, mobbin.com/screens/b4bd59db-b995-4fc3-ab5a-cae6efeff848.
if STYLE != "v1":
    PLAYI = f'<span class="lright">{ic("play", 18)}</span>'

    def hear(rng):
        return lrow("Hear this passage", sub=rng, right=ic("play", 18), chev=False)

    ul_half = vs_half(j316).replace(more_row, sec(None, hear("Nicodemus by night · 3:1–21")) + more_row)
    F("UL-01", "A verse’s Understand: Hear this passage, from its first verse", j3r + vsheet("med", "John 3:16", ul_half), "ul")

    ul_guide = (sec("In short", '<p class="claim"><b>Jesus is God in the flesh.</b></p><p class="snote">The Word was with God.</p>', first=True)
                + sec(None, hear("John 1:1–18"))
                + sec("Go deeper", nrow("Verse by verse", "18 verses") + nrow("Study notes", "Tyndale on 1:1–18") + nrow("Key words", "What its main words mean"))
                + sec(None, nrow("Sources", "Every source and licence")))
    F("UL-02", "A passage’s guide: Hear this passage under In short", under_j + guide("med", JLAB, "John 1:1–18", ul_guide), "ul")

    j15_sheet = usheet("med", "John 1:5", f"{E(JLAB)} · 1:1–18",
                       sec("In plain words", f'<p class="claim">{todo_src("The UST’s line for 1:5, as the verse sheet shows it")}</p>', first=True) + more_row)
    F("UL-03", "From the full player: the playing line opens its Understand; other lines play from there", full(5, 4) + scrim() + j15_sheet, "ul")

    pro = sqlite3.connect(f"{Y}/content/bundles/understand-pro.v2.db").execute("select label, headline, start_ord, end_ord from passages where passage_id='PRO.1.8-1.19'").fetchone()
    pro_body = (sec("In short", f'<p class="claim"><b>{E(pro[1])}</b></p>', first=True)
                + sec(None, hear("Proverbs 1:8–19"))
                + sec("Go deeper", nrow("Verse by verse", "12 verses") + nrow("Study notes", "Tyndale on 1:8–19"))
                + sec(None, nrow("Sources", "Every source and licence")))
    pro_reader = reader("PRO", 1, 8, 12, scrolled=False, rows_override=t5("PRO", 1, 8, 12)) + scrim()
    F("UL-04", "A book with little written: the outline line and its rows, nothing empty, nothing promised", pro_reader + guide("med", pro[0], "Proverbs 1:8–19", pro_body), "ul")

    NEXT_NOTES["refs_ul"] = (
        "Understand and Listen (John, 15 Oct 2026)\n\n"
        "UL-01, UL-02: 'Hear this passage' with its range, a ▶ at the trailing edge: Listen starts at the passage's first verse and the sheet closes, "
        "so the reader sees the words being read. Under a licensed page it reads the BSB, as Listen does (EG-03). In the verse's half view it sits above More on this verse; in the guide, under In short.\n\n"
        "UL-03: in the full player, tapping the playing line opens its Understand (the others still play from there). VoiceOver: the playing line's hint is 'Opens Understand'.\n\n"
        "UL-04: Proverbs has an outline line and no summary, by design; 227 of 2,923 passages have no summary shown. The guide shows the line in bold and its rows; "
        "no empty heading, no placeholder, no 'coming later'.\n\n"
        "Lead with one sentence: the half view already opens on one plain line (VS-01) and the guide on In short's headline; nothing else is added above them.\n\n"
        "Refs: Speechify mobbin.com/screens/c3343a61-2e32-4e5d-a061-39cd80573727 · Blinkist mobbin.com/screens/b4bd59db-b995-4fc3-ab5a-cae6efeff848.")
# ================= Build 6: book introductions and grammar terms (items G and H, 15 Oct 2026) =================
# Real text only: the intro is tN's paragraph cut by rule (packages/pipeline/src/understand/intro.ts) and each term's
# sentence is the unfoldingWord grammar's own (grammar.ts), both read from the committed review files. Every one is
# still a draft for John, so the frames show what ships once he approves it.
# Refs: Blinkist puts a quiet "Introduction" label and one paragraph above the reading,
# mobbin.com/screens/ea3c48f7-2bb6-4fd2-aec0-01dc925042cf · Apple Books starts the chapter right under its opener,
# mobbin.com/screens/8a868d50-e016-47a5-88d4-e61514ead594 · Splitwise sets each term beside its one-line meaning,
# mobbin.com/screens/7499140f-c314-49f3-873a-f390c11148a7 · Wise opens a term's short explanation in place,
# mobbin.com/screens/b884dc4c-2841-4399-827c-2b27a21662a7. Rejected: Fanatics Live's glossary with an icon per term,
# mobbin.com/screens/cf0e2d5e-c1ea-4cc3-85a5-aac411040b73, and Nibble's coloured callout card,
# mobbin.com/screens/573f7362-933a-4241-8c35-bb8451146864 (no cards, no coloured labels).
if STYLE != "v1":
    _data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../packages/pipeline/prototypes/data")
    INTROS = {e["book"]: e["text"] for e in json.load(open(os.path.join(_data, "book_intros.json")))["entries"]}
    GRAM = {e["key"]: e["text"] for e in json.load(open(os.path.join(_data, "grammar.json")))["entries"]}
    INTRO_CREDIT = "Translation Notes, adapted from unfoldingWord (book introduction, first paragraph shortened) · CC BY-SA 4.0"
    GCREDIT = {"greek": "Greek Grammar, adapted from unfoldingWord (shortened to its first sentence) · CC BY-SA 4.0",
               "hebrew": "Hebrew Grammar, adapted from unfoldingWord (shortened to its first sentence) · CC BY-SA 4.0"}
    _ul = lambda b: sqlite3.connect(f"{Y}/content/bundles/understand-{b}.v2.db").execute("select label from passages order by start_ord limit 1").fetchone()[0]

    def intro_block(book, name):
        return (f'<section class="bintro" aria-label="About {E(name)}" style="margin:2px 0 26px">'
                f'<h2 class="lbl" style="margin-bottom:6px">About {E(name)}</h2>'
                f'<p class="claim" style="color:var(--muted)">{E(INTROS[book])}</p>'
                f'<p class="note muted" style="margin-top:8px">{E(INTRO_CREDIT)}</p></section>')

    def ptitle(label, ref):
        return (f'<button class="opener olink" aria-label="{E(label)}, {ref}. Opens the passage guide">'
                f'<span>{E(label)}</span>{ic("right", 14)}</button>')

    def chapter_one(book, name, rows, first_label, ref, intro=True):
        r = reader(book, 1, rows[0][0], rows[-1][0], scrolled=False, rows_override=rows)
        top = (intro_block(book, name) if intro else "") + ptitle(first_label, ref)
        return r.replace('<div class="rbody"><div style="margin-top: 0px">', f'<div class="rbody"><div style="margin-top: 0px">{top}', 1)

    F("IG-01", "John 1: one paragraph about the book above the first passage, then the text",
      chapter_one("JHN", "John", t5("JHN", 1, 1, 6), _ul("jhn"), "John 1:1 to 18"), "ig")
    F("IG-02", "Genesis 1: tN has no introduction for Genesis, so the chapter opens as it does today",
      chapter_one("GEN", "Genesis", t5("GEN", 1, 1, 8), _ul("gen"), "Genesis 1:1 to 2:3", intro=False), "ig")

    def term_rows(terms, open_key=None):
        out = []
        for label, key, lang_ in terms:
            is_open = key == open_key
            out.append(f'<button class="lrow" aria-expanded="{"true" if is_open else "false"}" aria-label="{E(label.capitalize())}, what it means">'
                       f'<span class="rm"><span class="lmain">{E(label.capitalize())}</span></span>'
                       f'<span class="chev">{ic("up" if is_open else "down", 16)}</span></button>')
            if is_open:
                out.append(f'<div class="gdef" role="region" aria-label="{E(label.capitalize())}" style="padding:0 0 14px">'
                           f'<p class="claim">{E(GRAM[key])}</p><p class="note muted" style="margin-top:6px">{E(GCREDIT[lang_])}</p></div>')
        return f'<div class="gterms" style="margin-top:8px">{"".join(out)}</div>'

    def word_sheet_b6(ref, headword, lng, translit, gloss, form, terms, lemma, lemma_tr, strongs, usually, in_book, in_bible, sources, open_key=None, pos="med"):
        rtl = lng == "he"
        d = ' dir="rtl"' if rtl else ""
        body = (f'<p class="hw{" rtl" if rtl else ""}" lang="{lng}"{d}>{headword}</p><p class="tr">{E(translit)} · {E(gloss)}</p>'
                + sec("Form", f'<p class="claim">{E(form)}</p>' + term_rows(terms, open_key), cls="kv")
                + sec("Dictionary form", f'<p class="claim"><span lang="{lng}"{d}>{lemma}</span> · {E(lemma_tr)} · {strongs}</p><p class="note muted">Usually “{E(usually)}”.</p>', cls="kv")
                + f'<section class="sec">{row(E(in_book), cls="plain")}{row(E(in_bible), cls="plain")}<p class="note muted">{E(sources)}</p></section>')
        return sheet(pos, "Word", ref, body)

    G_TERMS = [("present", "greek:present", "greek"), ("active", "greek:active", "greek"), ("imperative", "greek:imperative", "greek")]
    sig = lambda open_key=None, pos="med": word_sheet_b6(
        "1 Corinthians 14:34", "σιγάτωσαν", "el", "sigatōsan", "let them be silent", "Present active imperative, 3rd person plural", G_TERMS,
        "σιγάω", "sigaō", "G4601", "were silent", "3 times in 1 Corinthians", "9 in the Bible", "Gloss: TAGNT · Parsing: MorphGNT", open_key, pos)
    under_c = reader("1CO", 14, 33, 36, sel=(34,), rows_override=t5("1CO", 14, 33, 36)) + scrim()
    F("IG-03", "Word: under Form, each grammar term is a row; nothing opens until asked", under_c + sig(), "ig")
    F("IG-04", "A term opened: the grammar’s first sentence, word for word, and its credit", under_c + sig("greek:present", "lg2"), "ig")
    H_TERMS = [("qal", "hebrew:qal", "hebrew"), ("perfect", "hebrew:perfect", "hebrew")]
    under_g = reader("GEN", 1, 1, 4, sel=(1,), rows_override=t5("GEN", 1, 1, 4)) + scrim()
    F("IG-05", "Hebrew: בָּרָא, qal perfect. Hebrew perfect is its own entry, not the Greek one",
      under_g + word_sheet_b6("Genesis 1:1", "בָּרָ֣א", "he", "bārāʾ", "he created", "Verb, qal perfect, 3rd person masculine singular", H_TERMS,
                              "בָּרָא", "bārāʾ", "H1254a", "created", "11 times in Genesis", "53 in the Bible", "Gloss: TAHOT · Parsing: OSHB", "hebrew:perfect", "lg2"), "ig")

    NEXT_NOTES["refs_ig"] = (
        "Book introductions and grammar terms (build 6, items G and H, 15 Oct 2026)\n\n"
        "G · Where: at the top of chapter 1 in the reader, above the first passage title, and nowhere else. It is the one moment a reader meets "
        "the book; the guide is opt-in and would hide it. A quiet 'About John' label (VoiceOver heading), the paragraph in the reading size in muted ink "
        "so it never reads as Scripture, and its credit under it. Gone once the reader scrolls; never in later chapters.\n\n"
        "Text: tN's front:intro “What is … about?” section, first paragraph, whole sentences up to 60 words, stopping before any sentence about "
        "translating, the ULT/UST or 'you'; a last sentence that only announces a list is dropped (Hebrews). 65 of 66 books. "
        "Genesis has no such section, so Genesis shows nothing (IG-02). 1 Corinthians and Romans read weakly (they say why Paul wrote, "
        "not what the letter says): flagged for John in the review queue. Shown only once John approves the book's paragraph.\n\n"
        "H · Where: the word screen. Under Form, each grammar term in the line (tense, voice, mood, case; stem, conjugation, state) is a 52 pt row; "
        "tapping opens that one sentence in place, with the grammar's credit, and tapping again closes it. Person, number and gender stay plain words with no row. "
        "Greek and Hebrew 'imperfect' and 'perfect' are separate entries (IG-05). A term with no article (rare stems; Aramaic 'determined', whose article "
        "in en_uag is a copy of the absolute one) shows no row. 92 terms, each approved by John before it ships.\n\n"
        "Accessibility: each row is a button with aria-expanded; the opened sentence follows it in reading order. AX5: rows wrap, nothing truncates.\n\n"
        "Refs: Blinkist mobbin.com/screens/ea3c48f7-2bb6-4fd2-aec0-01dc925042cf · Apple Books mobbin.com/screens/8a868d50-e016-47a5-88d4-e61514ead594 · "
        "Splitwise mobbin.com/screens/7499140f-c314-49f3-873a-f390c11148a7 · Wise mobbin.com/screens/b884dc4c-2841-4399-827c-2b27a21662a7. "
        "Rejected: Fanatics Live mobbin.com/screens/cf0e2d5e-c1ea-4cc3-85a5-aac411040b73 (an icon per term), Nibble mobbin.com/screens/573f7362-933a-4241-8c35-bb8451146864 (coloured card).")
# ================= Build 6: words and places (MM-03 built, MS-01 built; 15 Oct 2026) =================
# MM-03 as the data allows it: the Berean tables link λόγος to "Word" (ὁ is "the"), so the underline is "Word"
# alone, never "the Word" (rule 4). MS-01: OpenBible.info places (high confidence only, CC BY 4.0) on a map drawn
# from Natural Earth (public domain) in Yada's tokens, offline, with no map service.
# Refs: Brink's transcript marks one word in running text, mobbin.com/screens/e6c90cf6-9194-46bc-8b76-a0112d7b3a85 ·
# Insight Timer's place: a heading, a framed map and Open in Maps, mobbin.com/screens/5eeebd47-9082-479f-92a3-8997ff4799f1 ·
# Fly Delta's static map with one pin and facts as rows, mobbin.com/screens/63d05eda-3a07-4136-a493-35d962a28089 ·
# Rodeo's map set on paper under a plain heading, mobbin.com/screens/8d8a9f02-bb21-4372-b031-c4c9538afa2f.
if STYLE != "v1":
    import glob as _glob
    _wm_bundle = os.environ.get("WM_BUNDLE") or sorted(_glob.glob(f"{Y}/content/bundles/understand-jhn.v*.db"), key=lambda p: int(re.findall(r"v(\d+)", p)[-1]))[-1]
    wdb = sqlite3.connect(_wm_bundle)
    _has = {r[0] for r in wdb.execute("select name from sqlite_master where type='table'")}

    def links_for(o):
        if "word_links" not in _has:
            return None, []
        r = wdb.execute("select bsb, links from word_links where ord=?", (o,)).fetchone()
        return (r[0], json.loads(r[1])) if r else (None, [])

    def underline(text_, spans):
        out, at_ = "", 0
        for s_, e_ in sorted(spans):
            out += E(text_[at_:s_]) + f'<span class="evu">{E(text_[s_:e_])}</span>'
            at_ = e_
        return out + E(text_[at_:])

    def partner(o, pos):
        bsb_, links = links_for(o)
        return bsb_, [(s_, e_) for p_, s_, e_ in links if p_ == pos]

    # ---- the base map: the app's own generated file, drawn the way components/PlaceMap.tsx draws it ----
    _bm = open(os.path.join(os.path.dirname(__file__), "../../../../apps/mobile/src/data/basemap.generated.ts")).read()
    _arr = lambda name: json.loads(re.search(rf"export const {name}[^=]*= (\[.*?\]);\n", _bm, re.S).group(1))
    LAND_, LAKES_, RIVERS_ = _arr("LAND"), _arr("LAKES"), _arr("RIVERS")

    def placemap(focus, others=(), w=360, h=240, fs=13):
        # Mirrors lib/wordsAndPlaces.ts viewFor and placesToDraw: ~45 km alone, else just wide enough for the
        # passage's places (never under 0.08°); nearest first, no label on another.
        import math
        lon0, lat0 = focus["lon"], focus["lat"]
        k = math.cos(math.radians(lat0))
        needs = [n for n in (max(abs(o_["lon"] - lon0) * k * 2 / 0.8, abs(o_["lat"] - lat0) * 2 / 0.8 * w / h) for o_ in others) if n <= 8]
        span = max([0.08] + needs) if needs else 0.45
        sx = w / span
        px = lambda lon, lat: ((lon - lon0) * k * sx + w / 2, (lat0 - lat) * sx + h / 2)
        def path(ring, close=True):
            pts = [px(ring[i], ring[i + 1]) for i in range(0, len(ring), 2)]
            if not any(-w < x < 2 * w and -h < y < 2 * h for x, y in pts):
                return ""
            return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + ("Z" if close else "")
        land = "".join(f'<path d="{d}" class="mland"></path>' for d in (path(r) for r in LAND_) if d)
        lakes = "".join(f'<path d="{d}" class="msea"></path>' for d in (path(r) for r in LAKES_) if d)
        rivers = "".join(f'<path d="{d}" class="mriv"></path>' for d in (path(r, False) for r in RIVERS_) if d)
        dots = ""
        taken = [(w / 2 - 10, h / 2 - 10, w / 2 + 13 + len(focus["name"]) * (fs + 2) * 0.6, h / 2 + 10)]
        clash = lambda a, b: a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]
        drawn = []
        for o_ in sorted(others, key=lambda o_: math.hypot(*(c - m for c, m in zip(px(o_["lon"], o_["lat"]), (w / 2, h / 2))))):
            x, y = px(o_["lon"], o_["lat"])
            box = (x - 8 - len(o_["name"]) * fs * 0.6, y - fs, x + 5, y + fs * 0.6)
            if not (8 < x < w - 8 and 8 < y < h - 8) or box[0] < 0 or any(clash(t, box) for t in taken):
                continue
            taken.append(box)
            drawn.append(o_)
            dots += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" class="mdot"></circle><text x="{x - 8:.1f}" y="{y + 4:.1f}" class="mlab" text-anchor="end">{E(o_["name"])}</text>'
        others = drawn
        fx, fy = px(lon0, lat0)
        dots += (f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="8" class="mfoc"></circle><circle cx="{fx:.1f}" cy="{fy:.1f}" r="3.5" class="mdot"></circle>'
                 f'<text x="{fx + 13:.1f}" y="{fy + 5:.1f}" class="mlab foc">{E(focus["name"])}</text>')
        aria = f'Map: {focus["name"]}' + (f', {", ".join(o_["name"] for o_ in others)} nearby' if others else "")
        return f'<svg class="map" viewBox="0 0 {w} {h}" role="img" aria-label="{E(aria)}"><rect width="{w}" height="{h}" class="msea"></rect>{land}{lakes}{rivers}{dots}</svg>'

    PL = {r[1]: {"id": r[0], "name": r[1], "kind": r[2], "modern": r[3], "lon": r[4], "lat": r[5], "score": r[6]} for r in wdb.execute("select id, name, kind, modern, lon, lat, score from places")} if "places" in _has else {}

    # ---- WM-01 (MM-03, built): Understand after a word is tapped ----
    o11 = o5("JHN", 1, 1)
    lg_i = next(i for i, w_ in enumerate(G["jhn.1.1"]["gloss"]) if w_["surface"].startswith("λόγος"))
    bsb11, sp11 = partner(o11, 5)
    v11u = underline(bsb11 or t5("JHN", 1, 1)[0][1], sp11)
    wm01 = (f'<p class="v" aria-label="Verse 1, {E(bsb11 or "")}. In the BSB: Word">{v11u}</p>'
            + '<div class="hairjoin" aria-hidden="true"></div>'
            + sec(None, nrow("Original Greek", "17 words, each with its English", disclose=True)
                  + f'<div class="orig">{interlinear("jhn.1.1", mark=lg_i)}<p class="note muted credit">Glosses: STEPBible (TAGNT, TBESG)</p></div>', first=True))
    F("WM-01", "MM-03 built: λόγος tapped, “Word” in the verse takes the evidence underline; the hairline once per device",
      reader("JHN", 1, 1, 3, sel=(1,), rows_override=t5("JHN", 1, 1, 3)) + scrim() + usheet("lg", "John 1:1", JLAB, wm01), "wm")

    # ---- WM-02: the word card says it too, under the BSB only ----
    def in_bsb(o, pos):
        b_, s_ = partner(o, pos)
        if not s_:
            return ""
        words_ = " … ".join((b_ or "")[a:e] for a, e in s_)
        return sec("In the BSB", f'<p class="v sm" aria-label="In the BSB: {E(words_)}. {E(b_ or "")}">{underline(b_ or "", s_)}</p>')
    card = (f'<p class="hw" lang="el">λόγος</p><p class="tr">logos · Word</p>' + in_bsb(o11, 5)
            + sec("Form", '<p class="claim">Noun, nominative masculine singular</p>', cls="kv")
            + sec("Dictionary form", '<p class="claim"><span lang="el">λόγος</span> · logos · G3056</p>', cls="kv"))
    F("WM-02", "The word card: In the BSB, the verse with the word’s partner underlined",
      reader("JHN", 1, 1, 3, sel=(1,), rows_override=t5("JHN", 1, 1, 3)) + scrim() + usheet("lg", "Word", "John 1:1", card, back=True), "wm")

    # ---- WM-03: Hebrew, reordered: בָּרָא is "created", after "God" in the BSB ----
    og = o5("GEN", 1, 1)
    gcard = (f'<p class="hw rtl" lang="he" dir="rtl">בָּרָ֣א</p><p class="tr rtl">bārāʾ · he created</p>' + in_bsb(og, 2)
             + sec("Form", '<p class="claim">Verb, qal perfect, 3rd person masculine singular</p>', cls="kv"))
    F("WM-03", "Genesis 1:1: the Hebrew’s verb comes first; its partner “created” is underlined where the BSB puts it",
      reader("GEN", 1, 1, 3, sel=(1,), rows_override=t5("GEN", 1, 1, 3)) + scrim() + usheet("lg", "Word", "Genesis 1:1", gcard, back=True), "wm")

    # ---- WM-04: τὸν has no English of its own: no section, nothing said ----
    tcard = (f'<p class="hw" lang="el">τὸν</p><p class="tr">ton · the</p>'
             + sec("Form", '<p class="claim">Definite article, accusative masculine singular</p>', cls="kv")
             + sec("Dictionary form", '<p class="claim"><span lang="el">ὁ</span> · ho · G3588</p>', cls="kv"))
    F("WM-04", "A word the BSB leaves untranslated (τὸν), or reading the WEB: no In the BSB, nothing underlined",
      reader("JHN", 1, 1, 3, sel=(1,), rows_override=t5("JHN", 1, 1, 3)) + scrim() + usheet("lg", "Word", "John 1:1", tcard, back=True), "wm")

    # ---- WM-05: the passage guide lists its places ----
    o111, o1144 = o5("JHN", 11, 1), o5("JHN", 11, 44)
    in_passage = []
    if "verse_places" in _has:
        for (pid,) in wdb.execute("select place from verse_places where ord between ? and ? group by place order by min(ord)", (o111, o1144)):
            in_passage.append(next(p_ for p_ in PL.values() if p_["id"] == pid))
    prow = lambda p_: nrow(E(p_["name"]), f"Identified with {p_['modern']}" if p_["modern"] != p_["name"] else p_["kind"].capitalize())
    _hl = wdb.execute("select headline from passages where passage_id='JHN.11.1-11.44'").fetchone()
    g_body = (sec("In short", f'<p class="claim"><b>{E(_hl[0] if _hl else "")}</b></p>', first=True)
              + sec("Places in this passage", "".join(prow(p_) for p_ in in_passage))
              + sec("Go deeper", nrow("Verse by verse", "44 verses") + nrow("Study notes", "Tyndale on 11:1–44"))
              + sec(None, nrow("Sources", "Every source and licence")))
    F("WM-05", "A passage’s guide: Places in this passage, each a row to its map",
      reader("JHN", 11, 1, 6, scrolled=False, rows_override=t5("JHN", 11, 1, 6)) + scrim() + guide("med", "Raising Lazarus", "John 11:1–44", g_body), "wm")

    # ---- WM-06: a place: the map first, what the data says, its verses ----
    beth = PL.get("Bethany", {"name": "Bethany", "lon": 35.255903, "lat": 31.771661, "modern": "Al Eizariya", "score": 889})
    near = [p_ for p_ in (PL.get("Jerusalem"), PL.get("Mount of Olives")) if p_]
    beth_verses = [] if "verse_places" not in _has else [r[0] for r in wdb.execute("select ord from verse_places where place=? order by ord", (beth.get("id", ""),))]
    vrows = "".join(row(f"John {(o_ // 1000) % 1000}:{o_ % 1000}", extra=f'<span class="note muted xt">{E(db5.execute("select text from texts where ord=? and translation=?", (o_, "BSB")).fetchone()[0][:64])}…</span>') for o_ in beth_verses[:4])
    place_body = (placemap(beth, near)
                  + f'<p class="claim">Identified with {E(beth["modern"])}</p>'
                  + sec("In John", vrows)
                  + sec(None, row("Open in Maps", cls="plain", aria="Open in Maps. Needs a connection"))
                  + '<p class="note muted credit">Place: OpenBible.info, CC BY 4.0 · Map: Natural Earth</p>')
    F("WM-06", "Bethany: the map in Yada’s tokens, drawn on the phone; the identification and its verses",
      reader("JHN", 11, 1, 6, scrolled=False, rows_override=t5("JHN", 11, 1, 6)) + scrim() + guide("lg", "Bethany", "Raising Lazarus", place_body).replace('<div class="stitle">', f'<button class="sh-back" aria-label="Back">{ic("back", 22)}</button><div class="stitle">', 1), "wm")

    # ---- WM-07: a place named in the verse is a link ----
    b111 = t5("JHN", 11, 1)[0][1]
    spans111 = [] if "verse_places" not in _has else json.loads((wdb.execute("select spans from verse_places where ord=? and place=?", (o111, beth.get("id", ""))).fetchone() or ["[]"])[0])
    v111 = E(b111)
    if spans111:
        s_, e_ = spans111[0]
        v111 = E(b111[:s_]) + f'<button class="plink" aria-label="Bethany, place. Opens its map">{E(b111[s_:e_])}</button>' + E(b111[e_:])
    wm07 = (f'<p class="v">{v111}</p>' + sec("In plain words", f'<p class="claim">{todo_src("The UST’s line for 11:1, as the sheet shows it")}</p>', first=True)
            + sec("Go deeper", nrow("Original Greek", "Each word with its English", disclose=False) + nrow("Compare", "BSB · WEB · KJV · LSV")))
    F("WM-07", "A place the data knows, in the verse: its name in accent ink opens its map",
      reader("JHN", 11, 1, 6, sel=(1,), scrolled=False, rows_override=t5("JHN", 11, 1, 6)) + scrim() + usheet("lg", "John 11:1", "Raising Lazarus · 11:1–44", wm07), "wm")

    NEXT_NOTES["refs_wm"] = (
        "Words and places (build 6, 15 Oct 2026)\n\n"
        "MM-03, as built (WM-01–04). The Berean translation tables join each Greek or Hebrew word to its English in the BSB, by word order and spelling, "
        "never by gloss. λόγος is “Word” there (ὁ is “the”), so “Word” alone is underlined: the canvas's earlier “the Word” said more than the data does (rule 4). "
        "Supplied words in [brackets] are never underlined; a word with “-” (τὸν) or whose English is folded into another's shows nothing. "
        "87% of 62,056 tokens in John, Genesis, 1 Corinthians and Psalms link; 0.2% are skipped as uncertain.\n\n"
        "Where it shows: in Understand, the verse at the top marks the last word tapped, after its card closes; the hairline under the verse shows 0.5 s, "
        "the first time on the phone, not with Reduce Motion. The word card gains 'In the BSB': the verse with the partner underlined. "
        "VoiceOver: 'In the BSB: Word', then the verse. Only under the BSB: reading the WEB, KJV, LSV or a licensed text, nothing is underlined and the card has no In the BSB.\n\n"
        "MS-01 (WM-05–07). OpenBible.info Bible Geocoding Data, high confidence only (its own measure: a best identification of 500 or more out of 1000, resolving to one point; "
        "regions, circles of uncertainty and coordinates from OpenStreetMap or Google left out): 414 places, 4,059 mentions. "
        "The map is drawn on the phone from Natural Earth outlines (public domain) in Yada's tokens: sage sea, paper land, one accent ring. It works offline; "
        "'Open in Maps' hands the point to Apple Maps and says it needs a connection.\n\n"
        "Entry: 'Places in this passage' in the guide; a place name in the verse at the top of Understand, in accent ink, where the BSB names it (3,596 of 4,059 mentions). "
        "People: Tyndale's profiles, already in People and places.\n\n"
        "Refs: Brink mobbin.com/screens/e6c90cf6-9194-46bc-8b76-a0112d7b3a85 · Insight Timer mobbin.com/screens/5eeebd47-9082-479f-92a3-8997ff4799f1 · "
        "Fly Delta mobbin.com/screens/63d05eda-3a07-4136-a493-35d962a28089 · Rodeo mobbin.com/screens/8d8a9f02-bb21-4372-b031-c4c9538afa2f.")
# ---------- write files + index ----------
W, H, GX, GY = 1430, 1026, 80, 120
names, boards = [], {}
y = 0
notes = {}
GROUPS = (("j01", "Journey 01 · 1 Corinthians 14"), ("jn", "John 1:1"), ("gn", "Genesis 1:1")) + ((("dl", "Delight"), ("hs", "Home, Search, Contents"), ("ss", "Settings and saved"), ("es", "Edge states"), ("so", "Sources"), ("dp", "Depth"), ("sp", "Splash"), ("uv", "Simpler Understand (variant)"), ("mt", "More translations")) if STYLE != "v1" else ())
# Passage guide and audio live on their own canvas page ("guide"), laid out from y = 0 there.
if STYLE != "v1":
    GROUPS += (("pg", "Passage guide"), ("au", "Audio read-along"), ("ia", "App-wide IA after the passage shift"), ("on", "A clear way to start"), ("sn", "Open study notes and See also"), ("td", "People"), ("ic", "iCloud"), ("gd", "1 · John’s guides, all 46"), ("ba", "2 · Human-read BSB audio"), ("sw", "3 · Swipe between chapters"), ("wl", "4 · Widget and Live Activity"), ("rp", "5 · Reading plans with no dates"), ("pd", "6 · People and places, dictionary, manuscripts"), ("lt", "7 · NKJV and NLT for testers"), ("ms", "8 · Maps, Siri and Spotlight, the UST"), ("ty", "9 · Tyndale: three items"), ("dc", "Decisions on the open questions"), ("gs", "A1 · Glyssen: who is speaking"), ("mc", "A2 · MACULA evidence marks"), ("uw", "B5 · Translation Words and Questions"), ("th", "B6 · Themes in this passage"), ("tl", "B4 · A timeline"), ("wa", "B7 · WEB and KJV human audio"), ("hl", "A3 · Large, small and raised Hebrew letters"), ("ux", "Understand, UX pass: beginner first, deeper on demand"), ("cp", "Compare, redesigned"), ("nt", "Notifications: what, when and how"), ("na", "No AI: Understand assembled from sources · 1 Corinthians 14:34–35"), ("st", "Settings"), ("i3", "IA v3: the whole app after this release"), ("di", "Dictionary: how it shows up"), ("eg", "UX pass: edge states and depth"), ("jr", "John’s round: Psalms, prophets, one order for every screen"), ("dn", "Decided, now drawn"), ("vs", "Verse sheet: one sheet, half and full"), ("us", "States the app shows but nobody drew"), ("mm", "Magic moments"), ("lb", "Build 6 · listening: stop, repeat, chapter names, WEB, KJV and LSV voices"), ("ld", "Build 6 · Download for the NKJV, NLT and The Message (on hold)"), ("np", "Build 6 · Asking for notifications"), ("ul", "Build 6 · Understand and Listen"), ("ig", "Build 6 · Book introductions and grammar terms"), ("wm", "Build 6 · Words and places: the BSB partner of a word (MM-03), a map of places (MS-01)"), ("sx", "System surfaces: widgets, Lock Screen, StandBy, Control Center, Siri, notifications, Live Activity"))
PAGE_OF = {"pg": "guide", "au": "guide", "ia": "guide", "on": "guide", "sn": "guide", "td": "guide", "ic": "guide", **{g: "next" for g in ("gd", "ba", "sw", "wl", "rp", "pd", "lt", "ms", "ty", "dc", "gs", "mc", "uw", "th", "tl", "wa", "hl", "ux", "cp", "nt", "na", "st", "i3", "di", "eg", "jr", "dn", "vs", "us", "mm")}, "lb": "b6", "ld": "b6", "np": "b6", "ul": "b6", "ig": "b6", "wm": "b6", "sx": "sys"}
ys = {}
for gi, (grp, label) in enumerate(GROUPS):
    pg = PAGE_OF.get(grp, STYLE)
    y = ys.get(pg, 0)
    fr = [f for f in FRAMES if f[3] == grp]
    notes[f"t_{grp}" + ("" if STYLE == "v1" else f"_{pg}")] = {"x": 0, "y": y, "text": label, "kind": "title1", "maxW": 4 * W + 3 * GX, **({"page": pg} if pg != STYLE else {})}
    if grp in ("pg", "au", "ia", "on", "sn", "td", "ic") or pg in ("next", "b6", "sys"):
        src = NEXT_NOTES if pg in ("next", "b6", "sys") else GUIDE_NOTES
        for j, key in enumerate([k for k in src if k.endswith(grp)]):
            notes[key] = {"x": 4 * (W + GX), "y": y + 260 + j * 1180, "w": 560, "maxH": 1120, "size": "m", "page": pg, "fill": "gray", "text": src[key]}
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
    nb = {k: v for k, v in boards.items() if v["page"] == "next"}
    json.dump({"boards": nb, "order": [n for n in names if n in nb], "notes": {k: v for k, v in notes.items() if v["page"] == "next"}},
              open(f"{OUT}/canvas.next.json", "w"), ensure_ascii=False, indent=1)
    bb = {k: v for k, v in boards.items() if v["page"] == "b6"}
    json.dump({"boards": bb, "order": [n for n in names if n in bb], "notes": {k: v for k, v in notes.items() if v["page"] == "b6"}},
              open(f"{OUT}/canvas.b6.json", "w"), ensure_ascii=False, indent=1)
    sb = {k: v for k, v in boards.items() if v["page"] == "sys"}
    json.dump({"boards": sb, "order": [n for n in names if n in sb], "notes": {k: v for k, v in notes.items() if v["page"] == "sys"}},
              open(f"{OUT}/canvas.sys.json", "w"), ensure_ascii=False, indent=1)
    print(len(names), "boards"); sys.exit()
idx = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
       "title": "Yada Redesign", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": names, "notes": notes, "designSystems": []}
json.dump(idx, open(f"{OUT}/canvas.json", "w"), ensure_ascii=False, indent=1)
print(len(names), "boards")
for n in names:
    print(n, os.path.getsize(f"{OUT}/{n}"))
