"""
The 1979 Book of Common Prayer's traditional (Rite One) Sunday and seasonal collects, for Daily prayer (Build 11; John,
22 Oct 2026: the 1979 book, traditional wording). Source: the Episcopal Church's own PDF of the book, certified by the
Custodian of the Standard Book, January 2007 (episcopalchurch.org/wp-content/uploads/2023/06/book_of_common_prayer.pdf),
pinned by its sha256. Pages 159 to 185, "Collects: Traditional", Seasons of the Year.

Licence (rule 3): the file carries no copyright notice anywhere in its 1,001 pages. The Episcopal Church's archives
record that "General Convention, through the Canons of this Church, has made it clear that authorized versions of the
Book of Common Prayer are to be in the Public Domain" (resolution 2024-D038, its explanation;
content/raw/bcp-1979/gc-2024-D038.pdf).

Each collect is taken whole, word for word, from the first line after its heading that opens a prayer to its "Amen.";
rubrics ("Preface of Advent", "The Proper Liturgy for this day is on page 264.") are left out. A heading not found
refuses the run rather than leaving a gap.

Run from the repo root:
  python3 packages/pipeline/prototypes/collects.py content/raw/bcp-1979/book_of_common_prayer.pdf \
    apps/mobile/src/data/collects.generated.ts
"""

import hashlib
import json
import re
import sys

from pypdf import PdfReader

PDF_SHA256 = "d4552eb39fcc26c7f2bb83ccd8e15fae4801521ac0e76df12b60bbd1525a0a57"
FIRST_PAGE, LAST_PAGE = 159, 185

# Headings as the book prints them, and the name Yada's calendar uses (apps/mobile/src/lib/collects.ts).
HEADS = [
    ("First Sunday of Advent", "Advent 1"), ("Second Sunday of Advent", "Advent 2"),
    ("Third Sunday of Advent", "Advent 3"), ("Fourth Sunday of Advent", "Advent 4"),
    ("The Nativity of Our Lord: Christmas Day", "Christmas Day"), ("First Sunday after Christmas Day", "Christmas 1"),
    ("The Holy Name", "Holy Name"), ("Second Sunday after Christmas Day", "Christmas 2"),
    ("The Epiphany", "Epiphany"),
    *[(f"{o} Sunday after the Epiphany", f"Epiphany {n}") for n, o in enumerate(
        ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"], start=1)],
    ("Last Sunday after the Epiphany", "Last Epiphany"), ("Ash Wednesday", "Ash Wednesday"),
    *[(f"{o} Sunday in Lent", f"Lent {n}") for n, o in enumerate(["First", "Second", "Third", "Fourth", "Fifth"], start=1)],
    ("Sunday of the Passion: Palm Sunday", "Palm Sunday"), ("Monday in Holy Week", "Holy Monday"),
    ("Tuesday in Holy Week", "Holy Tuesday"), ("Wednesday in Holy Week", "Holy Wednesday"),
    ("Maundy Thursday", "Maundy Thursday"), ("Good Friday", "Good Friday"), ("Holy Saturday", "Holy Saturday"),
    ("Easter Day", "Easter Day"),
    *[(f"{d} in Easter Week", f"Easter {d}") for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]],
    *[(f"{o} Sunday of Easter", f"Easter {n}") for n, o in enumerate(["Second", "Third", "Fourth", "Fifth", "Sixth"], start=2)],
    ("Ascension Day", "Ascension Day"), ("Seventh Sunday of Easter", "Easter 7"),
    ("The Day of Pentecost", "Pentecost"), ("First Sunday after Pentecost", "Trinity Sunday"),
    *[(f"Proper {n}", f"Proper {n}") for n in range(1, 30)],
]

# A prayer's first words; anything else after a heading is a rubric.
OPENING = re.compile(
    r"^(Almighty|O |Grant|We |Merciful|Stir|Eternal|Give|Set |Keep|Lord|Blessed|Gracious|Be |Mercifully|Direct|"
    r"Remember|Increase|Assist|Let |Lighten|Most |Heavenly|Father|Everliving|Holy|God|Preserve|Look|Our )"
)
FOOTER = re.compile(r"^(Collects: Traditional\s*\d*|\d+\s+Collects: Traditional|Holy Days)$")


def read_pages(path):
    data = open(path, "rb").read()
    got = hashlib.sha256(data).hexdigest()
    if got != PDF_SHA256:
        sys.exit(f"collects: REFUSED. {path} is not the pinned file ({got})")
    reader = PdfReader(path)
    return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]


def extract(pages):
    lines = [s for n, t in pages if FIRST_PAGE <= n <= LAST_PAGE for s in (l.strip() for l in t.split("\n")) if s and not FOOTER.match(s)]

    def find(heading, start):
        exact = re.compile(r"^" + re.escape(heading) + r"(\s|:|$)")
        after_rubric = re.compile(r"[.]\s+" + re.escape(heading) + r"(\s|:|$)")
        for i in range(start, len(lines)):
            if exact.match(lines[i]) or after_rubric.search(lines[i]):
                return i
        return None

    out, cursor, missing = {}, 0, []
    for heading, name in HEADS:
        i = find(heading, cursor)
        if i is None:
            missing.append(heading)
            continue
        k = i + 1
        while k < len(lines) and not OPENING.match(lines[k]):
            k += 1
        body = []
        while k < len(lines):
            body.append(lines[k])
            if lines[k].endswith("Amen."):
                break
            k += 1
        out[name] = re.sub(r"\s+", " ", " ".join(body).replace("- ", "-")).strip()
        cursor = i + 1
    if missing:
        sys.exit(f"collects: REFUSED. headings not found: {missing}")
    bad = [name for name, text in out.items() if not text.endswith("Amen.")]
    if bad:
        sys.exit(f"collects: REFUSED. no Amen. in {bad}")
    return out


if __name__ == "__main__":
    collects = extract(read_pages(sys.argv[1]))
    ts = (
        "// Generated by packages/pipeline/prototypes/collects.py from the 1979 Book of Common Prayer (the Episcopal\n"
        f"// Church's PDF, sha256 {PDF_SHA256[:12]}…). Traditional (Rite One) collects, word for word. Do not edit.\n\n"
        "export const COLLECTS: Readonly<Record<string, string>> = "
        + json.dumps(collects, ensure_ascii=False, indent=2)
        + ";\n"
    )
    open(sys.argv[2], "w").write(ts)
    print(f"wrote {sys.argv[2]}: {len(collects)} collects")
