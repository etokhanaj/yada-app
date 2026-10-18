# One treatment for every day's picture: a portrait crop around the subject, a gentle grade (warm for morning, cool
# for evening), lifted shadows, a little more colour. Run with: python3 -I grade.py <src> <out> <warm|cool> <cx 0..1>
import sys
from PIL import Image, ImageEnhance
src, out, tone, cx = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
im = Image.open(src).convert("RGB")
w, h = im.size
if w / h > 3 / 4:                         # wider than 3:4: crop the sides around cx
    tw = int(h * 3 / 4)
    x0 = max(0, min(w - tw, int(cx * w - tw / 2)))
    im = im.crop((x0, 0, x0 + tw, h))
else:                                     # a tall portrait: keep the full width, crop top and bottom evenly
    th = int(w * 4 / 3)
    y0 = (h - th) // 2
    im = im.crop((0, y0, w, y0 + th))
im = im.resize((1200, 1600), Image.LANCZOS)
im = ImageEnhance.Color(im).enhance(1.35)
im = ImageEnhance.Contrast(im).enhance(1.06)
r, g, b = im.split()
if tone == "warm":
    r = r.point(lambda v: min(255, int(v * 1.08 + 6)))
    g = g.point(lambda v: min(255, int(v * 1.02 + 2)))
    b = b.point(lambda v: int(v * 0.88 + 10))
else:
    r = r.point(lambda v: min(255, int(v * 0.98 + 4)))
    b = b.point(lambda v: min(255, int(v * 1.05 + 6)))
im = Image.merge("RGB", (r, g, b))
im.save(out, quality=86, optimize=True, progressive=True)
