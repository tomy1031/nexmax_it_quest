# Codex に頼むこと（髪型の参考の絵）

tomy さん（2026-11-23）:「髪型はもっとバリエーション欲しい」「髪型も必要ならcodexにアドバイスもらいますよ。」

髪型はブレンダーで作っている（`tools/blender/build_avatar.py`。いま 25 種類）。
形の考え方は「頭にかぶる、厚みのある1つのかたまり」（細い毛束を並べない・はしは厚く まるい・前髪は大きな毛先か まっすぐ）。
Codex には、この作り方で作れる**新しい髪型の設定画**を頼む。Claude がそれを見て、ブレンダーで形にする。

## 使い方

1. Codex のスレッドに、下の指示文を **1回に1枚** 貼る（2枚）。
2. できた PNG を `codex_out/` に、書いてある名前で置いて push する。

## 共通の記述（2枚とも、そのまま使う）

```text
Style: original cute chibi characters for a cozy, soft 3D life-sim game (fully original, NOT copying any existing game).
Hair is modeled as ONE thick, smooth, rounded mass that sits on the head like a soft cap, with clean rounded edges.
No thin strands, no individual hair lines, no texture. Bangs are either a few big rounded points or a straight cut.
Head: a big round head (about 2.5 heads tall body), simple face with big eyes, no nose detail.
People: young adults from Cambodia (Southeast Asian), warm medium-brown skin.
Hair color: dark brown for every hairstyle (#4a3326), with one soft lighter band as shine.
Background: plain white. No text, no labels, no numbers.
```

## 1. 男の人にも合う髪型（8つ）

```text
image-gen-2 で画像を1枚生成してください。
出力: 1536x1024 PNG、白背景、文字なし。保存先: codex_out/hair_ref_a.png
<共通の記述>
Sheet: 8 head-and-shoulder busts in a 4x2 grid, all the same face, each with a different NEW hairstyle that is not
short neat, spiky, side-part, wavy, curly, buzz, center-part, two-block, slicked-back or soft-mohawk.
Each bust shows the front view large and a small back view next to it.
Ideas (choose freely, keep them cute and wearable for office workers and students):
short with a big swirl cowlick on top, messy bedhead, short hair with a fluffy top knot, medium hair tucked behind the ears,
short hair with a cute round fringe, layered wolf cut, man bun, slicked side sweep with volume.
```

## 2. 女の人にも合う髪型（8つ）

```text
image-gen-2 で画像を1枚生成してください。
出力: 1536x1024 PNG、白背景、文字なし。保存先: codex_out/hair_ref_b.png
<共通の記述>
Sheet: 8 head-and-shoulder busts in a 4x2 grid, all the same face, each with a different NEW hairstyle that is not
bob, long straight, ponytail, twin tails, bun, half-up, single braid, two buns, side tail, low ponytail, hime cut,
long wavy or two low braids.
Each bust shows the front view large and a small back view next to it.
Ideas (choose freely, keep them cute and wearable for office workers and students):
short pixie, lob (long bob) with side part, high twin buns with loose ends, crown braid, fluffy medium perm,
long hair with a big side bang, puffy pigtails at ear level, short bob with a hair clip.
```

## Claude がすること（絵が届いたら）

- 1つずつ、切りそろえた線（前髪・横・後ろ）と ふくらみ を読み取って、ブレンダーで作る。
- 着がえの「髪型」に絵のボタンを足す（`tools/blender/render_hair_icons.py`）。
- 絵の髪型を そのまま写すのではなく、このアプリの作り方（厚みのある かたまり）に合わせて作りなおす。
