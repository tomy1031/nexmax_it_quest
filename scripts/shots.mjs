#!/usr/bin/env node
/**
 * 豆知識の絵を撮る（npm run shots）。グラフィック工場の部品を /factory?shot=<id> で描き、
 * 背景を透明にして public/img/tips/<id>.webp に保存する。
 *
 * 使い方: 開発サーバー（npm run dev）を立ててから `npm run shots`。別の URL なら `npm run shots -- http://localhost:5174`。
 * 絵を作り直したいときは、src/app/shots.tsx の角度や中身を直してから、もう一度実行する。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL("..", import.meta.url).pathname;
const base = process.argv[2] ?? "http://localhost:5173";
const only = process.argv[3]?.split(",");
const tips = JSON.parse(await readFile(join(ROOT, "content/tips.json"), "utf8")).tips;
await mkdir(join(ROOT, "public/img/tips"), { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
for (const tip of tips) {
  if (only && !only.includes(tip.id)) continue;
  await page.goto(`${base}/factory?shot=${tip.id}`, { waitUntil: "networkidle" });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch {
    console.warn(`撮れなかった: ${tip.id}`);
    continue;
  }
  const dataUrl = await page.evaluate(() =>
    document.querySelector("canvas").toDataURL("image/webp", 0.9),
  );
  const out = join(ROOT, "public/img/tips", `${tip.id}.webp`);
  await writeFile(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`撮影  ${tip.id}`);
}
await browser.close();
