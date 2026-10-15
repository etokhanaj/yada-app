"""Render canvas frames to PNGs for QA: each PNG holds one frame in Light, Dark and AX5, side by side (1430 x 1026),
the same image the canvas shows. Compare these with simulator screenshots of the built app.

Usage (YADA_ROOT points at the checkout that holds content/):
  YADA_ROOT=/Users/johnetokhana/yada python3 render_frames.py <out-dir> [GROUPS=vs,na,...] [ONLY=VS-01,MM-]
Groups and IDs are the canvas's (see GROUPS in build_canvas.py). Writes <out-dir>/png/<ID>.png and index.json."""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

OUT = os.path.abspath(sys.argv[1])
G = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_canvas.py")
src = open(G).read().split("# ---------- write files + index ----------")[0]
ns = {"__file__": G, "__name__": "x"}
sys.argv = [G, f"{OUT}/canvas", "v2"]
exec(compile(src, G, "exec"), ns)
groups = set(filter(None, os.environ.get("GROUPS", "").split(",")))
only = tuple(filter(None, os.environ.get("ONLY", "").split(",")))
frames = [f for f in ns["FRAMES"] if (not groups or f[3] in groups) and (not only or f[0].startswith(only))]
os.makedirs(f"{OUT}/html", exist_ok=True)
os.makedirs(f"{OUT}/png", exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def one(fr):
    fid, title, inner, grp = fr[0], fr[1], fr[2], fr[3]
    page = ns["doc"](fid, title, inner)
    helmet = re.search(r"<helmet>(.*?)</helmet>", page, re.S).group(1)
    body = re.search(r"</helmet>(.*?)</x-dc>", page, re.S).group(1)
    p = f"{OUT}/html/{fid}.html"
    open(p, "w").write(f"<!doctype html><html lang='en'><head><meta charset='utf-8'>{helmet}</head><body>{body}</body></html>")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1430,1026",
                    "--virtual-time-budget=4000", f"--screenshot={OUT}/png/{fid}.png", "file://" + p], capture_output=True)
    return (fid, title, grp)


with ThreadPoolExecutor(6) as ex:
    index = list(ex.map(one, frames))
json.dump(index, open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=0)
print(len(index), "frames")
