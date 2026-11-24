# Codex に頼むこと（ヘンディさんのお話・ステージ2 の絵）

tomy さん（2026-11-24）:「ビジュアルなどが必要な場合は別途コーデックスで準備をするので、プロンプトなどを用意していただけると助かります。」

今は、どの絵も **3D の部品を撮った絵**（`npm run shots`）が入っている。下の絵が届いたら、**同じ名前のファイルに置きかえる**だけで画面が変わる。
使う所の設計は `docs/design/02_リスニング.md`・`docs/design/03_ステージ2.md`。

## 使い方

1. Codex のスレッドに、下の指示文を **1回に1枚** 貼る。参考の絵として `public/img/tips/suit.webp`（今のちびキャラ）を付ける。
2. できた PNG を、書いてある名前で `codex_out/` に置いて push する。
3. Claude が webp にして、`public/img/...` の同じ名前に置く。

絵の中に、読める文字・数字・ロゴを入れない（文は画面のデータで出す。ふりがなを付けるため）。「タイ」という国名は使わない。

## 共通の記述（どの絵も、そのまま使う。言いかえない）

```text
Style: match the attached reference exactly - original cute chibi characters rendered like soft toon-shaded 3D figures,
about 2.5 heads tall, very big round head, small soft body, short stubby arms, round mitten hands,
big glossy dark-brown round eyes with white highlights, small curved eyebrows, tiny mouth, soft pink cheeks, tiny dot nose.
Soft pastel colors, gentle soft shading, no harsh black, no thick outlines, cozy and warm mood
(fully original design, NOT copying characters from any existing game, no animal ears on people).
People: young adults from Cambodia (Southeast Asian), warm medium-brown skin, dark brown hair, navy or gray business suits.
Background: evenly lit plain soft cream-white (#fffaf0) over the whole image, bright corners, no dark vignette.
Never: readable text, letters, numbers, logos, signs with writing, realistic proportions, small eyes, scary faces, extra fingers.
Expressions are clear and a little exaggerated so the feeling can be read at small size.
```

## 1. メモしている絵（豆知識「メモを 取る」）

保存先: `codex_out/memo-wo-toru.png` → `public/img/tips/memo-wo-toru.webp`（4:3）

```text
image-gen-2 で画像を1枚生成してください。出力: 1200x900 PNG。
<共通の記述>
Scene: a new employee (young man or woman in a navy suit) sits on a simple chair in the front row of a small company hall,
holding a small open notebook in one hand and writing in it with a pen in the other hand, looking up toward the speaker
(the speaker is outside the frame) with a serious but bright, eager face. Two or three other seated new employees are softly
blurred behind. A few small pastel sparkle marks and a small pencil icon float above the notebook to show "writing notes".
Composition: the note-taking person is large in the center, full upper body with the notebook clearly visible.
```

## 2. ヘンディさんのお話のワークの絵（4まい。どれも 1:1）

保存先: `codex_out/listening-<名前>.png` → `public/img/listening/<名前>.webp`（800x800）

| 名前      | Scene（共通の記述のあとに足す）                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aisatsu` | `Scene: morning at an office entrance. A new employee in a navy suit bows a little and waves with a big bright smile to a senior coworker, who smiles and raises a hand back. A small sun icon and sparkle marks show "morning, cheerful greeting".`                                                    |
| `jikan`   | `Scene: a meeting room. A new employee already sits at the table, calm and ready with a notebook, while a round wall clock with plain tick marks (no numbers) is large on the wall. The other chairs are still empty. A small check mark icon floats near the clock to show "on time, a little early".` |
| `renraku` | `Scene: a train station platform with a stopped train in soft focus. A new employee in a suit holds a smartphone to the ear with a slightly worried but responsible face, calling the office. A small phone icon and a small speech bubble with three dots float nearby.`                               |
| `soudan`  | `Scene: at an office desk with a laptop. A new employee raises one hand a little with a small question mark icon above the head, asking a kind senior coworker who leans in and points at the laptop with a warm smile. A small light bulb icon floats between them.`                                   |

## 3. ステージ2の豆知識の絵（4:3）

保存先: `codex_out/<名前>.png` → `public/img/tips/<名前>.webp`（1200x900）

| 名前              | Scene                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jutaku-kaihatsu` | `Scene: a simple story in one picture. On the left, a happy shop owner (a client, wearing an apron) hands over a paper with a simple drawing of a web page. On the right, two engineers in suits at desks with laptops build that same page on a big monitor. A soft arrow curves from the client's paper to the monitor. Shows "the client asks, we build it in our office".`                                                                         |
| `aoba`            | `Scene: a calm, clean Japanese matcha cafe counter in deep green and white. A smiling barista whisks bright green matcha in a tea bowl. On the counter: a matcha latte with a leaf-shaped foam, a matcha soft-serve, a small bamboo whisk. Outside the window, palm trees and a warm sunny street hint at a tropical city. No shop name or text.`                                                                                                      |
| `kikanai-to`      | `Scene: a meeting table. A client (a woman in her forties, short bob hair, deep-green jacket) has a soft thought bubble above her head with three small icons inside: a coin, a calendar page with no numbers, and a checklist. A new employee across the table raises a hand to ask a question, and a dotted line connects the question to the thought bubble, which starts to open. Shows "things in the client's head come out only when you ask".` |

## 4. 山本社長の顔（セリフの枠・会話の所。1:1）

保存先: `codex_out/yamamoto.png` → `public/img/people/yamamoto.webp`（512x512）。`public/img/people/hendy.webp` と同じ絵の調子にするので、参考に それも付ける。

```text
image-gen-2 で画像を1枚生成してください。出力: 1024x1024 PNG。
Style: match the attached portrait reference (same anime-style bust portrait style, same lighting, same framing).
Subject: a Japanese woman in her early forties, president of a matcha cafe company. Short neat bob hair, dark brown.
Calm, friendly, confident smile. Deep-green tailored jacket over a white blouse, a small leaf-shaped pin on the lapel.
Bust portrait, facing slightly left, plain soft cream background. No text, no logo, no name tag.
```

## 5. Aoba の採用ページの見本（次のステージで使う。今回は使わない）

次のステージ（聞いたことを整理して、ページの形を考える）で、見本のページの絵が要る。頼むのは、そのステージを作るときにする。
