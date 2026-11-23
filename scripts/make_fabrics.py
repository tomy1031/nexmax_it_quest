"""
Codex で作った布（codex_out/fabric_*.png）を、服に貼る「灰色の模様」にする。

使い方:  python3 scripts/make_fabrics.py
出力: public/img/fabric/<名前>.png（256x256・灰色）。アプリは この模様に、選んだ服の色をかける（src/three/avatar-parts.ts）。
- 明るさの平均を そろえ（色が暗くならないように 0.92 前後）、模様の こさを布ごとに決める。
- もとの絵は上下左右につながる（くり返せる）ので、全体を ちぢめても つながったまま。
"""

import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "codex_out")
OUT = os.path.join(ROOT, "public", "img", "fabric")

# 名前: 模様の こさ（1 で もとのまま）
FABRICS = {"twill": 2.6, "knit": 1.5, "denim": 1.4, "check": 1.0}
MEAN = 0.92


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, contrast in FABRICS.items():
        path = os.path.join(SRC, f"fabric_{name}.png")
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGB").resize((256, 256), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32) / 255.0
        lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        d = (lum - lum.mean()) * contrast
        g = np.clip(MEAN + d, 0.0, 1.0)
        Image.fromarray((g * 255).astype(np.uint8), "L").save(os.path.join(OUT, f"{name}.png"), optimize=True)
        print("fabric", name, round(float(d.std()), 3))


if __name__ == "__main__":
    main()
