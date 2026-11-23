"""
Codex で作った顔のパーツの表（codex_out/face_*.png）から、背景の緑を消して、アプリで使う絵にする。

使い方:  python3 scripts/cut_face_parts.py

- 入力: codex_out/face_eyes*.png・face_mouth*.png・face_cheeks*.png（1536x1024・6列x4行・背景は緑 #00FF00）
  頼み方は docs/codex/face_parts.md。あとから足した表（face_eyes2.png など）も、名前の順に読む。
- 出力: public/img/face/<表の名前>.png（背景が透明。大きさは半分）と、
        src/three/face-atlas.json（表ごとの、マスごとのパーツの位置 [x, y, w, h]。空のマスは null）
"""

import glob
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "codex_out")
OUT_IMG = os.path.join(ROOT, "public", "img", "face")
OUT_JSON = os.path.join(ROOT, "src", "three", "face-atlas.json")
COLS, ROWS = 6, 4
SCALE = 0.5


def key_out(im: Image.Image, soft_rows=()) -> Image.Image:
    """緑の背景を透明にし、ふちに残る緑を取る。soft_rows の行は、ぼかしたパーツ（ほっぺ）として別に扱う。"""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 背景の色（いちばん多い緑）
    bg_mask = (g > 200) & (r < 60) & (b < 60)
    bg = a[bg_mask].mean(axis=0) if bg_mask.any() else np.array([0, 255, 0], np.float32)
    k_bg = bg[1] - max(bg[0], bg[2])
    k = g - np.maximum(r, b)
    alpha = np.clip(1.0 - k / k_bg, 0.0, 1.0)
    alpha[alpha < 0.04] = 0.0
    # 色を取り出す（まざった緑を引く）
    safe = np.maximum(alpha, 1e-3)[..., None]
    col = (a - (1.0 - alpha)[..., None] * bg) / safe
    col = np.clip(col, 0, 255)
    # すけている ふちの色は、となりの こい所の色を広げて使う（ぼかした ほっぺのふちに緑が残らないように）
    solid = alpha >= 0.85
    filled = solid.copy()
    col = col * solid[..., None]
    for _ in range(24):
        acc = np.zeros_like(col)
        cnt = np.zeros(alpha.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = np.roll(filled, (dy, dx), axis=(0, 1))
            acc += np.roll(col, (dy, dx), axis=(0, 1)) * m[..., None]
            cnt += m
        new = (~filled) & (cnt > 0)
        col[new] = acc[new] / cnt[new][:, None]
        filled |= new
    # ぼかしたパーツ: マスの中の いちばん こい色 F を決め、緑 G と F の まぜ具合から すけ具合を出す
    h, w = alpha.shape
    ch, cw = h / ROWS, w / COLS
    for ry in soft_rows:
        for cx in range(COLS):
            y0, y1, x0, x1 = int(ry * ch), int((ry + 1) * ch), int(cx * cw), int((cx + 1) * cw)
            P = a[y0:y1, x0:x1] - bg
            d = np.linalg.norm(P, axis=-1)
            if (d > 60).sum() < 12:
                continue
            far = d >= np.percentile(d[d > 60], 80)
            F = P[far].mean(axis=0)
            pa = np.clip((P @ F) / (F @ F), 0.0, 1.0)
            pa[pa < 0.04] = 0.0
            fcol = F + bg
            sub = col[y0:y1, x0:x1]
            blend = pa < 0.9
            sub[blend] = fcol
            alpha[y0:y1, x0:x1] = np.where(blend, pa, alpha[y0:y1, x0:x1])
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def cells(im: Image.Image):
    """6x4 のマスごとに、パーツのある所（不透明な所）の四角を返す。"""
    al = np.asarray(im)[..., 3]
    h, w = al.shape
    cw, ch = w / COLS, h / ROWS
    rows = []
    for ry in range(ROWS):
        row = []
        for cx in range(COLS):
            x0, y0 = int(cx * cw), int(ry * ch)
            sub = al[y0 : int((ry + 1) * ch), x0 : int((cx + 1) * cw)]
            ys, xs = np.nonzero(sub > 20)
            if len(xs) < 12:
                row.append(None)
                continue
            pad = 2
            bx0 = max(0, xs.min() - pad) + x0
            by0 = max(0, ys.min() - pad) + y0
            bx1 = min(sub.shape[1] - 1, xs.max() + pad) + x0
            by1 = min(sub.shape[0] - 1, ys.max() + pad) + y0
            row.append([int(bx0), int(by0), int(bx1 - bx0 + 1), int(by1 - by0 + 1)])
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    atlas = {}
    for kind in ("eyes", "mouth", "cheeks"):
        for path in sorted(glob.glob(os.path.join(SRC, f"face_{kind}*.png"))):
            name = os.path.splitext(os.path.basename(path))[0]
            im = Image.open(path)
            im = im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS)
            keyed = key_out(im, soft_rows=(0,) if kind == "cheeks" else ())
            keyed.save(os.path.join(OUT_IMG, f"{name}.png"), optimize=True)
            atlas[name] = {
                "kind": kind,
                "url": f"img/face/{name}.png",
                "w": keyed.width,
                "h": keyed.height,
                "cells": cells(keyed),
            }
            print("cut", name, keyed.size)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(atlas, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main()
