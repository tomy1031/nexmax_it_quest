# NEXMAX IT QUEST

カンボジアの IT 学生（日本語は N4 学習中）が、3D のバーチャル空間で「日本で働く日々」を体で覚えるアプリ。
姉妹アプリは [nexmax-academy](https://github.com/tomy1031/nexmax-academy)。

- ステージ1「入社初日：ネクストメイクに行きましょう！」— 家の目覚まし → NMChat → スーツに着がえ → 押しボタンの信号 → 地下鉄の路線図・定期券・改札・ホーム → 電車の中のマナー → 本町で乗りかえ → 阿波座 → 修了証
- ステージ2「入社式」— 準備中

AI の作業のルールは [AGENTS.md](AGENTS.md)、設計は [docs/design/00_全体設計.md](docs/design/00_全体設計.md)。

## 技術

Vite + React 19 + TypeScript + three.js（React Three Fiber）+ zustand + zod + Tailwind CSS v4。
3D の部品は [polyfork](https://polyfork.dev/)（クレジットは [CREDITS.md](CREDITS.md)）と、`src/factory/` のプログラム（グラフィック工場）。

## 開発

Node は `.nvmrc` に合わせる（Node 22）。

```bash
npm install
cp .env.example .env.local   # Supabase を使うときだけ（無ければログインなしで動く）
npm run dev                  # http://localhost:5173
```

| コマンド                                                | 内容                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run build`                                         | 型チェック＋ビルド（`dist/` に静的なファイル）                                |
| `npm run typecheck` / `npm run lint` / `npm run format` | 型・ESLint・Prettier                                                          |
| `npm run lint:content`                                  | 教材のチェック（形・ふりがなの付け忘れ・src の中の日本語・「タイ」）          |
| `npm run furigana:suggest`                              | 付け忘れた漢字の読みの候補（kuromoji）                                        |
| `npm test`                                              | 単体テスト（読みの正しさ・書く練習の判定）                                    |
| `npm run e2e`                                           | ステージ1を最初から修了証まで通すテスト（画面の写真が `e2e-screens/` に残る） |
| `npm run assets:fetch`                                  | polyfork の 3D モデルを取り寄せる（`assets.json`）                            |
| `npm run shots`                                         | 豆知識の絵を撮る（開発サーバーを立ててから）                                  |

開発中だけ、`/factory` でグラフィック工場の部品の見本を見られる。

## 公開

今は GitHub Pages に置いている（一時の公開先。先々 Cloudflare に移す）。
リポジトリのふだんの枝（default branch）に push すると、`.github/workflows/pages.yml` がビルドして公開する。

- URL: https://tomy1031.github.io/nexmax_it_quest/
- はじめの1回だけ、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする。
- 移し方は [docs/design/00_全体設計.md](docs/design/00_全体設計.md) の「12. 公開」。
