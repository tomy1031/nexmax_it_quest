# Codex に頼むこと（顔のパーツ・服の布）

tomy さんの指示（2026-11-23）:「シルエットだけ先に作って（男性パンツ、女性スカート、女性パンツなど）テクスチャのパーツ（目、眉毛、鼻、チーク、上下など）をGPTで作成したらなんとかなりますか？」「ブレンダーで調整できる？」「進めて」

体の形（3種）と髪型（10種）はブレンダーで作った（`tools/blender/build_avatar.py`）。
顔は、いまはプログラムで描いた仮の目（`src/three/chibi.ts` の `faceTexture`）。ここを GPT で作った絵のパーツに置きかえる。

## 使い方

1. Codex のスレッドに、下の「指示文」を **1回に1枚** 貼る（全部で 4 枚）。
2. できた PNG を、指示文に書いた名前で `codex_out/` に置いて push する。
3. Claude が、背景の緑を消して1つずつ切り出し、3D の顔に貼る（目・まゆは左右に使う。まゆは髪の色にぬり直す）。

切り出しは Claude がプログラムで行う。マス目がすこしずれていても、パーツどうしが離れていれば切り出せる。

---

## 共通の記述（4枚とも、そのまま使う。言いかえない）

```text
Style: original cute face parts for chibi characters in a cozy, soft 3D life-sim game
(fully original design, NOT copying any existing game, no animal features).
The parts will be cut out one by one and pasted onto a round 3D head, like stickers.
Drawing: flat 2D shapes with clean smooth edges, no outline around the whole part, no texture, no gradients
except where written, no drop shadows, no 3D shading, no paper or canvas effect.
Background: one solid flat pure green (#00FF00) everywhere. Never use #00FF00 inside a part.
Layout: a grid of equal square cells (written below for each sheet). One part per cell, centered in the cell,
each part fits inside the middle 70% of its cell with empty green around it. Parts never touch each other.
Do not draw grid lines, numbers, labels or any text.
All parts in a sheet are drawn at the same scale, as if they belong to the same face.
```

---

## 1. 目（いちばん大事）

```text
image-gen-2 で画像を1枚生成してください。
出力: 1536x1024 PNG。保存先: codex_out/face_eyes.png
プロンプトは以下（共通の記述をそのまま使い、最後に差分を足す）:
<共通の記述>
Sheet: eyes. Grid of 6 columns x 4 rows (each cell 256x256 px).
Each cell has ONE eye only: the character's right eye (it appears on the LEFT side of the face when we look at it).
Rows are 4 eye designs, columns are 6 states of that same design.
Row 1 (round): a big glossy round dark-brown eye, taller than wide, one big white highlight at the upper left
  and one small white highlight at the lower right, a slightly darker brown lower half.
Row 2 (sparkle): like row 1 but a little bigger, with three short cute eyelashes at the outer upper corner
  and a soft warm brown lower half.
Row 3 (calm): a gentle half-closed eye, the top is a flat lid line, a dark-brown pupil with one small highlight.
Row 4 (small): a small simple oval dark eye with one tiny highlight, friendly and plain.
Columns (same for every row):
  1 open (normal), 2 closed (blink: a soft curved line, a little lower than the open eye),
  3 happy (an upside-down U arc, like smiling eyes), 4 surprised (a bit wider, the pupil smaller, more highlight),
  5 thinking (the pupil looks up and to the side), 6 sleepy (half-closed, heavy lid).
Lines and dark parts: very dark brown #2a1f1d, not pure black. Highlights: pure white.
Keep the same size and the same center position for all 6 states of a row (so they can be swapped while blinking).
```

## 2. まゆ・鼻・口

```text
image-gen-2 で画像を1枚生成してください。
出力: 1536x1024 PNG。保存先: codex_out/face_mouth.png
プロンプトは以下:
<共通の記述>
Sheet: eyebrows, noses and mouths. Grid of 6 columns x 4 rows (each cell 256x256 px).
Row 1, eyebrows (only the character's right eyebrow, the one on the LEFT when we look at the face),
  drawn in ONE flat dark gray #303030 so the game can recolor it to the hair color:
  1 short soft arc, 2 thick round short brow, 3 thin straight brow, 4 worried (inner end raised),
  5 surprised (high arch), 6 thinking (slanted up toward the outside).
Row 2, noses, very small and subtle, drawn in a soft brown #b06a4a:
  1 tiny dot, 2 tiny short curve, 3 tiny upside-down triangle shadow, 4 small round button nose,
  5 tiny two-dot nostrils, 6 small side-curve nose (like a small "c" shape).
Rows 3 and 4, mouths (12), lines in dark red-brown #5a2b24, the inside of open mouths deep red #8a2f2a
  with a pink tongue #ff8f8f, white teeth only where written:
  1 small closed smile, 2 open happy smile, 3 big laughing open mouth, 4 small round "o" (surprised),
  5 small wavy line (unsure, thinking), 6 small open mouth (talking),
  7 cat-like "w" mouth, 8 short flat line (neutral), 9 small pout,
  10 wide grin with a row of white upper teeth, 11 relieved soft smile, 12 big oval yawn.
```

## 3. ほっぺ・しるし

```text
image-gen-2 で画像を1枚生成してください。
出力: 1536x1024 PNG。保存先: codex_out/face_cheeks.png
プロンプトは以下:
<共通の記述>
Sheet: cheeks and small face marks. Grid of 6 columns x 4 rows (each cell 256x256 px). Use only the first 2 rows,
leave rows 3 and 4 empty green.
Row 1, cheeks (one cheek only), soft pink #ff7890 with a soft faded edge (this is the only place where a soft edge is allowed):
  1 soft round blush, 2 soft wide oval blush, 3 round blush with three short diagonal lines on it,
  4 small light-brown freckles (5 dots), 5 small round blush with a tiny white shine dot, 6 heart-shaped faint blush.
Row 2, marks drawn on or near the face:
  1 a light-blue sweat drop, 2 a small light-blue tear drop, 3 a small yellow sparkle star (4 points),
  4 a tiny light-blue question-like swirl with no letters, 5 three short light-gray lines (surprise lines),
  6 a small round light-gray sleep bubble.
```

## 4. 服の布（上下の服の模様）

1回に1枚。4枚。どれも「つなぎ目が見えない（上下左右に並べてもつながる）」布の写真ではなく、やわらかい絵の布にする。

```text
image-gen-2 で画像を1枚生成してください。
出力: 1024x1024 PNG。保存先: codex_out/fabric_<名前>.png
プロンプトは以下:
Seamless tileable fabric texture for a cute, soft 3D toy-like game. Flat front view, evenly lit, no folds, no shadows,
no seams, no labels or text, the pattern repeats perfectly when tiled left-right and top-bottom.
Keep the detail soft and large enough to read on a small character (not photo-realistic).
<下の1行>
```

| 保存先                       | `<下の1行>`                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `codex_out/fabric_twill.png` | `Suit fabric: a very subtle diagonal twill weave in light neutral gray (#c8c8c8), almost plain.`            |
| `codex_out/fabric_knit.png`  | `Hoodie fabric: soft cotton knit with fine vertical ribs, light neutral gray (#d0d0d0).`                    |
| `codex_out/fabric_denim.png` | `Pants fabric: soft blue denim with a gentle diagonal weave and a few faint lighter fibers.`                |
| `codex_out/fabric_check.png` | `Skirt fabric: a simple soft check (tartan) of navy, dark green and a thin white line, medium size checks.` |

（灰色の布は、アプリで好きな色にぬり直して使う。）

---

## Claude がすること（絵が届いたら）

- 背景の緑（#00FF00）を透明にし、マス目ごとにパーツを切り出して `public/img/face/` に置く。
- 3D の顔（`faceTexture`）を、絵のパーツを貼る作りに変える。左の目・まゆは右を左右反転して使う。まばたき・表情（ふつう・うれしい・びっくり・考える）は列を切りかえる。
- 着がえの「目」に、4つの目の形を出す。まゆ・口・ほっぺも選べるようにするかは、絵を見てから tomy さんに聞く。
- 布は、ブレンダーで部品に貼る位置（UV）を付けてから、上着・ズボン・スカートに使う。
