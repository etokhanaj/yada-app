import json, re, sqlite3, difflib, glob, os, sys
D = "/Users/johnetokhana/yada/content/raw/audio-check"
core = sqlite3.connect("file:/Users/johnetokhana/yada/content/bundles/core.v5.db?mode=ro", uri=True)
def bsb(book, ch):
    lo = book * 1000000 + ch * 1000
    rows = core.execute("select text from texts where translation='BSB' and ord between ? and ? order by ord", (lo, lo + 999)).fetchall()
    return " ".join(r[0] for r in rows)
NUM = {"one":"1","two":"2"}
def words(t):
    t = t.lower().replace("’", "'").replace("—", " ").replace("–", " ")
    return [w for w in re.findall(r"[a-z0-9']+", t) if w]
text = {"Gen": words(bsb(1, 1)), "Jhn": words(bsb(43, 1))}
for f in sorted(glob.glob(f"{D}/out/*.json")):
    name = os.path.basename(f)[:-5]
    data = json.load(open(f))
    spoken = " ".join(seg["text"] for seg in data["transcription"])
    # Drop the spoken heading ("Genesis chapter 1", "The Gospel of John, chapter 1") the recordings open with.
    sw = words(spoken)
    key = "Gen" if "_Gen_" in name else "Jhn"
    ref = text[key]
    sm = difflib.SequenceMatcher(a=ref, b=sw, autojunk=False)
    # Score only the span the recording covers (it starts with a heading and may end with silence).
    ops = [op for op in sm.get_opcodes() if op[0] != "equal"]
    changed = sum(max(i2 - i1, j2 - j1) for _, i1, i2, j1, j2 in ops)
    lines = []
    for tag, i1, i2, j1, j2 in ops:
        lines.append(f"    {tag:7} text: {' '.join(ref[i1:i2])[:60]!r:64} heard: {' '.join(sw[j1:j2])[:60]!r}")
    print(f"{name}: {len(ref)} words in the BSB, {len(sw)} heard, {changed} differ ({100*changed/len(ref):.1f}%)")
    print("\n".join(lines[:40]))
