"""
M'Cheyne's Calendar for daily reading (1842, public domain) as Yada's plan table: 365 readings of four
portions, no dates (build plan Phase 5; canvas RP-01–04).

Source, pinned by sha256 in content/raw/mcheyne.sha256: David Haslam's digitisation of the 1842 calendar
(mcheyne.info/calendar.pdf), verse-faithful (Psalm 119 in parts, chapter-spanning ranges). Checked day by
day against an independent lineage, bibleplan.org's table (paulyoder/mcheyne-bible-reading-plan plan.js,
blob b02617ae), on chapters: the two must agree, or this refuses. plan.js has no licence, so it is a witness
only; nothing of it ships.

Run: python3 scripts/plans/build_mcheyne.py <YADA_ROOT> <out.json>
"""

import hashlib, json, re, sys
from pathlib import Path

import pypdf

root = Path(sys.argv[1])
out = Path(sys.argv[2])
raw = root / "content/raw/mcheyne"
pins = dict(reversed(l.split()) for l in (root / "content/raw/mcheyne.sha256").read_text().splitlines() if l.strip())
for name in ("calendar.pdf", "plan.js"):
    got = hashlib.sha256((raw / name).read_bytes()).hexdigest()
    if pins.get(name) != got:
        sys.exit(f"{name}: sha256 {got} is not the pinned one")

books = json.loads((Path(__file__).parent / "books.json").read_text())
name_to_code = {name: code for code, name, _ in books}
name_to_code["Song"] = "SNG"
name_to_code["Psalm"] = "PSA"
name_to_code["Phillipians"] = "PHP"  # as the source spells it (October)
chapters = {code: n for code, _, n in books}
# Longest names first, so "1 John" wins over "John"; a numbered name needs its digit.
names = sorted(name_to_code, key=len, reverse=True)
book_re = re.compile(r"(?<![A-Za-z])(" + "|".join(re.escape(n) for n in names) + r")(?![a-z])")


def books_in(line):
    """
    The book names on a line, left to right: "1 John" is found before a bare "John" could be. A numbered
    name right after a comma, or with nothing since the book before it, is a chapter followed by a bare
    name: "Leviticus 2 , 3John21" is Leviticus 2, 3 then John 21.
    """
    found = []
    pos = 0
    while (m := book_re.search(line, pos)) is not None:
        before = line[: m.start()].rstrip()
        since = line[found[-1].end() : m.start()].strip() if found else "x"
        # "Exodus 23 John": 23, then John; "Zechariah 12 , 13:1 John 15": verse 1, then John.
        run_in = m.start() > 0 and (line[m.start() - 1].isdigit() or line[m.start() - 1] == ":")
        if m.group(1)[0].isdigit() and (before.endswith(",") or since == "" or run_in):
            pos = m.start() + 1
            continue
        found.append(m)
        pos = m.end()
    return found


MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def segments(code, ref):
    """'11,12:1-21' → [{c:11},{c:12,vs:1,ve:21}]; a verse range carries over to its chapter only."""
    segs = []
    for piece in ref.split(","):
        m = re.fullmatch(r"(\d+)(?::(\d+)(?:-(\d+))?)?", piece)
        if m is None:
            raise ValueError(f"{code} {ref!r}")
        c = int(m.group(1))
        if not 1 <= c <= chapters[code]:
            raise ValueError(f"{code} {c} is not a chapter")
        seg = {"b": code, "c": c}
        if m.group(2):
            seg["vs"], seg["ve"] = int(m.group(2)), int(m.group(3) or m.group(2))
        segs.append(seg)
    return segs


reader = pypdf.PdfReader(str(raw / "calendar.pdf"))
text = "\n".join((p.extract_text() or "") for p in reader.pages[3:])
readings = []
month = -1
day = 0
for line in text.splitlines():
    # Some rows are letter-spaced in the PDF ("M i c a h1 L u k e1 0", 26–30 November).
    line = re.sub(r"(?<![A-Za-z])(?:[A-Za-z] ){2,}[A-Za-z](?![A-Za-z])", lambda m: m.group(0).replace(" ", ""), line)
    header = next((i for i, m in enumerate(MONTHS) if m in line and "calendar" in line), None)
    if header is not None:
        if header != month + 1 or (month >= 0 and day != DAYS[month]):
            sys.exit(f"month {MONTHS[header]} after {day} days of {MONTHS[month] if month >= 0 else '-'}")
        month, day = header, 0
        continue
    found = books_in(line)
    if month < 0 or len(found) != 4:
        continue
    refs = [re.sub(r"\s+", "", line[f.end() : (found[i + 1].start() if i < 3 else len(line))]) for i, f in enumerate(found)]
    day += 1
    # The day number is printed between the second and third portions, run into the second's chapter.
    if not refs[1].endswith(str(day)):
        sys.exit(f"{MONTHS[month]} {day}: {line!r}")
    refs[1] = refs[1][: -len(str(day))]
    readings.append([segments(name_to_code[f.group(1)], r) for f, r in zip(found, refs)])
# The source's own slips, each confirmed by the witness and by the coverage count below. Nothing else
# is changed.
CORRECTIONS = {
    # 6 March: the PDF repeats "2 Corinthians 1"; the run is 1–4 before it and 6 after, plan.js has 5.
    (65, 3): [{"b": "2CO", "c": 5}],
}
for (n, p), fixed in CORRECTIONS.items():
    readings[n - 1][p] = fixed
if len(readings) != 365 or day != 31:
    sys.exit(f"{len(readings)} readings, ending on day {day}")

# The witness, an independent lineage: bibleplan.org's table, day by day where it has the day (it stops
# at 10 August and picks up on 30 October: 285 of the 365).
plan = (raw / "plan.js").read_text()
witness = {}
for mm in re.finditer(r"\n  (\d+): \{(.*?)\n  \}", plan, re.S):
    for dm in re.finditer(r"\n\s+(\d+): \[(.*?)\]", mm.group(2)):
        witness[(int(mm.group(1)), int(dm.group(1)))] = re.findall(r"'([^']*)'", dm.group(2))
order = [(m + 1, d + 1) for m in range(12) for d in range(DAYS[m])]


def chapters_of(portion):
    portion = portion.replace("ff", "").replace(" & ", ",")  # "Luke 1:39ff", "Jeremiah 36 & 45"
    m = re.fullmatch(r"(.+?) ([\d:,\-]+)", portion.strip())
    # A one-chapter book is written without its number ("Philemon").
    name, ref = (m.group(1), m.group(2)) if m is not None else (portion.strip(), "1")
    code = name_to_code.get(name) or name_to_code.get(name.replace("Song of Solomon", "Song").replace("Song of Songs", "Song"))
    out = set()
    for piece in ref.split(","):
        a = piece.split("-")
        first = int(a[0].split(":")[0])
        last = int(a[1].split(":")[0]) if len(a) > 1 and ":" not in a[1] and ":" not in a[0] else (int(a[1].split(":")[0]) if len(a) > 1 and ":" in a[1] else first)
        out |= {(code, c) for c in range(first, last + 1)}
    return out


disagree = []
for n, (ours, when) in enumerate(zip(readings, order), 1):
    theirs = witness.get(when)
    if theirs is None:
        continue
    for p, (o, t) in enumerate(zip(ours, theirs)):
        # bibleplan.org drops a few verses run on into the next chapter (Joshua 5 and 6:1-5): ours may have
        # more, only as part of a chapter; it may never lack one of the witness's.
        mine = {(s["b"], s["c"]) for s in o}
        partial = {(s["b"], s["c"]) for s in o if "vs" in s}
        theirs_ch = chapters_of(t)
        if not theirs_ch <= mine or not (mine - theirs_ch) <= partial:
            disagree.append(f"reading {n} portion {p + 1}: {o} vs {t!r}")
if disagree:
    print("\n".join(disagree[:20]))
    sys.exit(f"{len(disagree)} portions disagree with the witness")

# The whole year against M'Cheyne's own design: the Old Testament once, the New Testament and the Psalms
# twice. A misread row breaks the count.
NT = {code for code, _, _ in books[39:]}
seen = {}
for reading in readings:
    for portion in reading:
        for seg in portion:
            if "vs" in seg and seg["vs"] != 1:
                continue  # a chapter split across two days is counted once, at its first part
            seen[(seg["b"], seg["c"])] = seen.get((seg["b"], seg["c"]), 0) + 1
wrong = [f"{b} {c}: {seen.get((b, c), 0)}" for b, _, n in books for c in range(1, n + 1) if seen.get((b, c), 0) != (2 if b in NT or b == "PSA" else 1)]
if wrong:
    sys.exit("coverage: " + ", ".join(wrong[:20]))

out.write_text(json.dumps({"source": "M'Cheyne, Calendar for daily reading (1842); David Haslam's digitisation, sha256 " + pins["calendar.pdf"], "readings": readings}, separators=(",", ":")) + "\n")
print(f"{len(readings)} readings; coverage as M'Cheyne designed it; {len(witness)} days agree with the witness -> {out}")
