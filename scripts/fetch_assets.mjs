#!/usr/bin/env node
/**
 * polyfork の 3D モデルを取り寄せる（npm run assets:fetch）。
 *
 * - assets.json の models を1つずつ（まとめて取らない。polyfork の利用の決まり）取り寄せ、
 *   public/models/<file>.glb に置く。params があるものは polyfork のバリエーション（-remix.glb）。
 * - clips は人の動き（CC0）。public/models/clips/<name>.json に置く。
 * - 置いた GLB のクレジット（CC BY 4.0）を CREDITS.md に書き出す。手で直さない。
 * - すでにあるファイルは取り直さない（--force で取り直す）。
 *
 * .mjs（形を変えられるプログラム版）は公開リポジトリに置けないので取らない（AGENTS.md 必ず守るルール9）。
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = "https://polyfork.dev";
const UA = "nexmax-it-quest-asset-fetch (educational, low volume)";
const force = process.argv.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = "buffer") {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "5") * 1000;
      console.warn(`429: ${wait}ms 待ってやり直す ${url}`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return as === "json" ? res.json() : Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`取れなかった: ${url}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const manifest = JSON.parse(await readFile(join(ROOT, "assets.json"), "utf8"));
const credits = new Map();

for (const model of manifest.models) {
  const out = join(ROOT, "public/models", `${model.file}.glb`);
  const meta = await get(`${BASE}/api/assets/${model.id}`, "json");
  const asset = meta.asset ?? meta;
  credits.set(model.id, { title: asset.title, credit: asset.credit, page: asset.page });
  if (!force && (await exists(out))) {
    console.log(`あり  ${model.file}`);
    continue;
  }
  const url = model.params
    ? `${BASE}/cdn/${model.id}-remix.glb?p=${encodeURIComponent(JSON.stringify(model.params))}`
    : `${BASE}/cdn/${model.id}.glb`;
  const buf = await get(url);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`取得  ${model.file} (${Math.round(buf.length / 1024)} KiB)`);
  await sleep(400);
}

for (const clip of manifest.clips ?? []) {
  const out = join(ROOT, "public/models/clips", `${clip}.json`);
  if (!force && (await exists(out))) {
    console.log(`あり  clips/${clip}`);
    continue;
  }
  const buf = await get(`${BASE}/cdn/anim-${clip}.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`取得  clips/${clip}`);
  await sleep(300);
}

const lines = [
  "# 3D モデルのクレジット",
  "",
  "`npm run assets:fetch` が `assets.json` から作る。手で直さない。",
  "",
  "## polyfork（https://polyfork.dev/）",
  "",
  "メッシュのファイル（GLB）は CC BY 4.0。下のクレジットを付けて置いている。",
  "人（自分・まわりの人）の体・服・髪型は、このリポジトリのブレンダーのスクリプトで作る（下の「そのほか」）。",
  "",
  ...[...credits.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => `- ${c.credit}`),
  "",
  "## そのほか",
  "",
  ...(manifest.others ?? []).map(
    (o) => `- ${o.title}（public/models/${o.file}）: ${o.source} — ${o.note}`,
  ),
  "",
];
await writeFile(join(ROOT, "CREDITS.md"), lines.join("\n"));
// タイトルの「クレジット」から見られるように、同じものを配るファイルにも置く
await writeFile(join(ROOT, "public/credits.txt"), lines.join("\n"));
console.log(`CREDITS.md に ${credits.size} 件`);
