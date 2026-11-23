# Codex に頼むこと（アバターの参考の絵・UI の相談）

> 2026-11-23 からの顔のパーツ（目・まゆ・鼻・口・ほっぺ）と服の布は、`docs/codex/face_parts.md` にまとめた。

tomy さんの指示（2026-11-22）:「アバターのデザインが可愛くないので、codexで画像生成をして、それを参考に作ってください。」「UIに関してもcodexと相談して改善してください。」

このセッション（クラウド）からは Codex に直接つなげないので、Codex のスレッドに下の指示文を貼って使う。
できた絵と答えを Claude のセッションに渡すと、Claude がそれを見て、ちびキャラ工場（`src/three/chibi.ts`）と画面を直す。

- 画面の写真は `docs/codex/screens/`（GitHub の `claude/friendly-darwin-6uwkf1` の枝）。`00-current-avatars.webp` が今のアバター。
- 絵は **academy の手順**（`tomy1031/nexmax-academy` の `docs/skills/codex_image_generation.md`）に合わせ、白い背景・文字なし・1枚に1つの差分で作る。

---

## 1. アバターの参考の絵（3枚）

Codex のスレッドに、下の「指示文」を1枚ずつ貼る（1回に1枚）。できた PNG を Claude に渡す。

### 共通の記述（3枚とも、そのまま使う。言いかえない）

```text
Style: original cute chibi characters for a Japanese-learning 3D game, like a cozy life-sim game
(but NOT copying any existing game's characters, no animal ears, no animal features, fully original design).
Proportion: about 2.5 heads tall, a big round head, a small soft body, short stubby arms and legs, mitten-like round hands.
Face: two big glossy round black eyes with two white highlights each, small eyebrows, a tiny smiling mouth, soft pink cheeks,
no visible nose, gentle friendly expression.
Rendering: soft toon shading with 2-3 flat shade steps, clean simple shapes that can be rebuilt from spheres and capsules
in low-poly 3D, thin dark outline, pastel but not washed out colors.
People: young adults from Cambodia (Southeast Asian), warm medium-brown skin tones (#c68e64, #a8714a, #e0ac83).
Background: plain white, no floor texture, soft drop shadow under the feet.
Never: readable text, logos, realistic proportions, small eyes, angry or scary faces, extra fingers.
```

### 1-1. スーツの男女（設定画）

```text
image-gen-2 でキャラクターの設定画を1枚生成してください。
出力: 1536x1024 PNG、白背景、文字なし。保存先: codex_out/avatar_suit_sheet.png
プロンプトは以下（共通の記述をそのまま使い、最後に差分を1つ足す）:
<共通の記述>
Sheet: two characters side by side, a young man and a young woman, both IT interns on their first day at a Japanese company.
Outfit: dark navy business suit, white shirt, a red tie for the man and a small navy ribbon tie for the woman,
the woman wears a knee-length skirt suit with dark stockings, both wear black shoes.
Show each character from the front, three-quarter view, side and back in one row, plus 4 small face expressions
(smile, happy with closed eyes, surprised, thinking) under each character.
```

### 1-2. ふだんの服（設定画）

```text
image-gen-2 でキャラクターの設定画を1枚生成してください。
出力: 1536x1024 PNG、白背景、文字なし。保存先: codex_out/avatar_casual_sheet.png
プロンプトは以下:
<共通の記述>
Sheet: the same two characters (same faces and proportions as the suit sheet) in casual clothes:
a light gray hoodie, dark pants, white sneakers and a small black backpack (like the student on the title image).
Show front, three-quarter view, side and back.
```

（1-1 の絵ができていたら、その絵も参照の画像として渡す。）

### 1-3. 髪型8種

```text
image-gen-2 でキャラクターの設定画を1枚生成してください。
出力: 1536x1024 PNG、白背景、文字なし。保存先: codex_out/avatar_hair_sheet.png
プロンプトは以下:
<共通の記述>
Sheet: 8 head-and-shoulder busts of the same chibi character (same face) in a 4x2 grid, each with a different black or dark brown hairstyle:
1 short neat hair, 2 short spiky hair, 3 side-parted hair, 4 bob cut, 5 long straight hair, 6 ponytail, 7 twin tails, 8 bun.
Same front angle for all, simple chunky hair shapes that can be modeled with a few rounded pieces.
```

---

## 2. UI の相談

Codex のスレッドに、`docs/codex/screens/` の写真（01〜13）を付けて、下の指示文を貼る。答えを Claude に渡す。

```text
これは日本で働く練習をする 3D の学習ゲーム「NEXMAX IT QUEST」の画面です（PC のブラウザ。three.js）。
使う人はカンボジアの IT 学生で、日本語は N4 を勉強中。漢字には全部ふりがなを付けています。
付けた写真: タイトル・設定・ステージ選択・セリフ・いま すること/ヒント・改札・路線図の問題・券売機・チャット・アバター・判定・豆知識・修了証。

UI を良くするための改善案を、効果の大きい順に10個ください。1つずつ:
- どの画面のどこか
- 何が問題か（学生にとって何が分かりにくい・読みにくいか）
- どう直すか（文字の大きさ px・色 #hex・余白・並び・アニメーションなど、具体的に）

守ること（変えないでください）:
- 色の濃い背景の上の文字とふりがなは白。
- ふりがなは消さない。文を長くしない（1画面1文。文は N4 まで）。
- キャラクターの絵を手描きの SVG で作らない。
- 進むのに要る情報（看板・電光掲示板）は 3D の中にも置く（あとで VR にするため）。
- タイトルの見た目（濃い青・シアンの光・ガラスの板）に合わせる。
```

---

## 3. 「週末に行ってみたいな」の絵（2026-11-23）

`public/img/dream/weekend.webp`（券売機のあとの、思いうかべる場面）。参考の絵は `public/img/tips/suit.webp` の左の男の人を切り出し、白い背景にしたもの。
`codex exec -m gpt-5.6-sol -i <参考の絵> -` に下の文を渡した（1536x1024 で作り、1200x800 の webp にした）。

```text
プロンプト（英語のまま使う）:
Style: match the attached reference exactly - original cute chibi character rendered like a soft toon-shaded 3D figure,
about 2.5 heads tall, very big round head, small soft body, short stubby arms, round mitten hands,
big glossy dark-brown round eyes with white highlights, small curved eyebrows, tiny smiling mouth, soft pink cheeks, tiny dot nose.
Soft pastel colors, gentle soft shading, no harsh black, no thick outlines, cozy and warm mood.
Character: the young man on the left of the reference (warm tan skin, short brown hair, dark navy business suit, white shirt, red tie),
standing at the lower left (full body, feet visible), holding a small plain light-blue IC transit card in one hand,
the other hand touching his cheek, looking up dreamily with sparkling happy eyes and a big excited smile (clearly exaggerated happy expression).
Thought bubble: a very big fluffy white cloud-shaped thought bubble in the upper right, connected to his head by three small round puffs.
Inside the bubble, three small round vignettes side by side, each clearly readable at small size:
1) a zoo: a cute friendly giraffe peeking over a wooden fence with green trees,
2) takoyaki: six round takoyaki balls on a small boat-shaped paper tray with sauce, mayonnaise lines and bonito flakes, warm steam,
3) shopping: a lively covered shopping street with colorful shop awnings and two cute shopping bags in front.
Background: evenly lit plain soft white over the WHOLE image with a very faint pastel pink and sky-blue tint, bright corners, absolutely no dark vignette, no dark or black edges or corners. Small sparkles around the bubble.
Never: readable text, letters, numbers, logos, signs with writing, realistic proportions, small eyes, scary faces, extra fingers,
animal ears on the person, copying characters from any existing game.
Composition: the character and the bubble fill the frame in a balanced way, the bubble spans from the top center to the right edge and reaches down to the middle; little empty space at the bottom right.
```
