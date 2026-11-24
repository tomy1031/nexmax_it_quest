#!/usr/bin/env node
/**
 * 豆知識の絵を撮る（npm run shots）。グラフィック工場の部品を /factory?shot=<id> で描き、
 * 背景を透明にして public/img/tips/<id>.webp に保存する。
 * 豆知識でない絵（ヘンディさんのお話・人の顔など）や、まだ豆知識に無い絵は、
 * scripts/shot-outputs.json に「id → 保存先・大きさ（ピクセル）」を書くと、そこへ保存する。
 *
 * 使い方: 開発サーバー（npm run dev）を立ててから `npm run shots`。別の URL なら `npm run shots -- http://localhost:5174`。
 * 一部だけ撮るときは、id をカンマでつなげて足す: `npm run shots -- http://localhost:5173 yamamoto,listening-jikan`
 * 絵を作り直したいときは、src/app/shots.tsx の角度や中身を直してから、もう一度実行する。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL("..", import.meta.url).pathname;
const base = process.argv[2] ?? "http://localhost:5173";
const only = process.argv[3]?.split(",");
const tips = JSON.parse(await readFile(join(ROOT, "content/tips.json"), "utf8")).tips;
const extra = JSON.parse(await readFile(join(ROOT, "scripts/shot-outputs.json"), "utf8"));

/** 撮る物の一覧（豆知識は 640x480 の画面を2倍で撮る = 1280x960）。 */
const jobs = new Map();
for (const tip of tips) {
  jobs.set(tip.id, { out: `public/img/tips/${tip.id}.webp`, width: 1280, height: 960 });
}
for (const [id, o] of Object.entries(extra)) jobs.set(id, o);

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
// 画面の大きさごとに ページを作る（絵は 2倍の細かさ dpr=2 で描かれる）
const pages = new Map();
async function pageFor(width, height) {
  const key = `${width}x${height}`;
  if (!pages.has(key)) {
    pages.set(key, await browser.newPage({ viewport: { width: width / 2, height: height / 2 } }));
  }
  return pages.get(key);
}

for (const [id, job] of jobs) {
  if (only && !only.includes(id)) continue;
  const page = await pageFor(job.width, job.height);
  await page.goto(`${base}/factory?shot=${id}`, { waitUntil: "networkidle" });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch {
    console.warn(`撮れなかった: ${id}`);
    continue;
  }
  const dataUrl = await page.evaluate(() =>
    document.querySelector("canvas").toDataURL("image/webp", 0.9),
  );
  const out = join(ROOT, job.out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`撮影  ${id} → ${job.out}`);
}
await browser.close();
