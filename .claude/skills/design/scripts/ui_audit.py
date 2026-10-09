"""UI stress audit for the v2 canvas: renders every frame plus stress frames in headless Chrome and
reports targets under 44 pt, occlusion, horizontal overflow, clipping and contrast.
Usage: python3 ui_audit.py <tag> <out-dir>"""
import runpy, sys, os, re, glob, subprocess, json
S = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else ".")
G = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_canvas.py")
tag = sys.argv[1]
sys.argv = [G, f"{S}/aud_{tag}", "v2"]
try:
    ns = runpy.run_path(G)
except SystemExit:
    pass
# runpy swallows globals on SystemExit; rebuild namespace without the exit by exec-ing up to the write step
src = open(G).read().split("# ---------- write files + index ----------")[0]
ns = {"__file__": G, "__name__": "x"}
sys.argv = [G, f"{S}/aud_{tag}", "v2"]
exec(compile(src, G, "exec"), ns)
B = ns["BOOK"]; B.update({"1TH": "1 Thessalonians", "SNG": "Song of Songs", "EST": "Esther"})
r = ns["reader"]
stress = [
    ("X-01", "Long title, long return chip", r("1TH", 5, 1, 8, back=("2 Thess 3:10", "Back to 2 Thessalonians 3:10"), offset=0)),
    ("X-02", "Song of Songs, return chip", r("SNG", 8, 1, 8, back=("1 Cor 14:34", "Back to 1 Corinthians 14:34"))),
    ("X-03", "Longest verse selected, action bar", r("EST", 8, 8, 10, sel=(9,), abar="8:9", offset=-60)),
]
frames = [(f[0], f[1], f[2]) for f in ns["FRAMES"]] + stress
CSS = open(os.path.join(os.path.dirname(G), "style-v2.css")).read()
os.makedirs(f"{S}/aud_{tag}/html", exist_ok=True)
AUD = open(os.path.join(os.path.dirname(G), "audit.js")).read()
C = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
res = {}
for fid, title, inner in frames:
    page = ns["doc"](fid, title, inner)
    helmet = re.search(r"<helmet>(.*?)</helmet>", page, re.S).group(1)
    body = re.search(r"</helmet>(.*?)</x-dc>", page, re.S).group(1)
    p = f"{S}/aud_{tag}/html/{fid}.html"
    open(p, "w").write(f"<!doctype html><html lang='en'><head><meta charset='utf-8'>{helmet}</head><body>{body}<script>window.addEventListener('load',()=>setTimeout(()=>{{{AUD}}},300))</script></body></html>")
    dom = subprocess.run([C, "--headless=new", "--disable-gpu", "--window-size=1430,1026", "--virtual-time-budget=6000", "--dump-dom", "file://" + p], capture_output=True, text=True).stdout
    m = re.search(r'<pre id="audit">(.*?)</pre>', dom, re.S)
    res[fid] = json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")) if m else "NO AUDIT"
    if fid.startswith("X-"):
        subprocess.run([C, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1430,1026", "--virtual-time-budget=6000", f"--screenshot={S}/aud_{tag}/{fid}.png", "file://" + p], capture_output=True)
json.dump(res, open(f"{S}/aud_{tag}/audit.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
cnt = Counter(); 
for fid, items in res.items():
    if isinstance(items, str): print(fid, items); continue
    for it in items: cnt[(it["kind"], it["theme"])] += 1
print(dict(cnt))
