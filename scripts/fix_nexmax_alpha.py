"""ネクマックスの絵の、外につながっていない背景の白（足の間など）を透明にする。
顔の画面（いちばん大きい白い所）と、その中の白（めがねのレンズなど）は残す。"""
import sys
from collections import deque
from PIL import Image

def fix(path, out):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    def whiteish(p):
        r, g, b, a = p
        return a > 0 and min(r, g, b) > 222 and max(r, g, b) - min(r, g, b) < 22
    seen = bytearray(w * h)
    comps = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or not whiteish(px[x, y]):
                continue
            q = deque([(x, y)]); seen[i] = 1; pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and whiteish(px[nx, ny]):
                            seen[j] = 1; q.append((nx, ny))
            comps.append(pts)
    if not comps:
        im.save(out); return 0
    face = max(comps, key=len)
    fx0 = min(p[0] for p in face) - 4; fx1 = max(p[0] for p in face) + 4
    fy0 = min(p[1] for p in face) - 4; fy1 = max(p[1] for p in face) + 4
    removed = 0
    for pts in comps:
        if pts is face:
            continue
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if fx0 <= cx <= fx1 and fy0 <= cy <= fy1:
            continue  # 顔の中（めがねのレンズなど）
        if len(pts) < 30:
            continue  # 小さな光（ハイライト）
        for (x, y) in pts:
            r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 0)
        # ふちのうすい灰色（にじみ）も少しだけ消す
        for (x, y) in pts:
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < w and 0 <= ny < h:
                    r, g, b, a = px[nx, ny]
                    if a > 0 and min(r, g, b) > 190 and max(r, g, b) - min(r, g, b) < 26:
                        px[nx, ny] = (r, g, b, int(a * 0.35))
        removed += len(pts)
    im.save(out, "WEBP", quality=90, method=6, exact=True)
    return removed

for p in sys.argv[1:]:
    print(p, fix(p, p))
