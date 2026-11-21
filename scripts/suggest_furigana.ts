/**
 * ふりがなの付け忘れに、読みの候補を出す（npm run furigana:suggest）。
 *
 * lint:content と同じ文を集め、読み方のデータで覆えていない文を kuromoji（形態素解析）で読み、
 * [表記, よみ] の候補を出す。**候補はそのまま入れない。** 駅の名前などは kuromoji がよく間違えるので、
 * 人（AI）が1件ずつ見てから content/furigana.json に足す。
 *
 * --json を付けると、候補を JSON の配列で出す（まとめて見直すとき）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import kuromoji from "kuromoji";
import {
  buildFuriganaIndex,
  KANJI,
  uncoveredKanji,
  type FuriganaEntry,
} from "../src/lib/text/furigana";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set([
  "$comment",
  "id",
  "image",
  "icon",
  "en",
  "color",
  "scene",
  "spawn",
  "target",
  "event",
  "to",
  "item",
  "numbers",
  "letter",
  "pose",
  "who",
  "from",
  "time",
  "label",
  "t",
  "station",
  "line",
  "prev",
  "next",
  "side",
  "tone",
  "arrow",
  "lines",
  "stations",
]);

const entries = (JSON.parse(readFileSync(join(ROOT, "content/furigana.json"), "utf8")).entries ??
  []) as FuriganaEntry[];
const index = buildFuriganaIndex(entries);

const files = [
  "content/ui.json",
  "content/tips.json",
  "content/nmchat.json",
  "content/metro.json",
  "content/places.json",
];
for (const f of readdirSync(join(ROOT, "content/stages"))) files.push(`content/stages/${f}`);

const texts: string[] = [];
const collect = (v: unknown, key?: string) => {
  if (key && SKIP.has(key)) return;
  if (typeof v === "string") texts.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) collect(x, k);
};
for (const f of files) collect(JSON.parse(readFileSync(join(ROOT, f), "utf8")));

const toHira = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKana = (c: string) => /[ぁ-ゖァ-ヶー]/.test(c);

const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>(
  (resolve, reject) =>
    kuromoji
      .builder({ dicPath: join(ROOT, "node_modules/kuromoji/dict") })
      .build((err: Error | null, t: kuromoji.Tokenizer<kuromoji.IpadicFeatures>) =>
        err ? reject(err) : resolve(t),
      ),
);

const suggestions = new Map<string, string>();
for (const text of texts) {
  if (uncoveredKanji(text, index).length === 0) continue;
  for (const tok of tokenizer.tokenize(text)) {
    const surface = tok.surface_form;
    if (!KANJI.test(surface) || !tok.reading || tok.reading === "*") continue;
    let reading = toHira(tok.reading);
    let s = surface;
    // 送りがなは1字だけ残す（「止めよう」→「止め」）。残りのかなは読みからも外す
    let lastKanji = -1;
    for (let i = 0; i < s.length; i += 1) if (KANJI.test(s[i] ?? "")) lastKanji = i;
    const keep = Math.min(s.length, lastKanji + 2);
    const dropped = s.slice(keep);
    if (dropped && [...dropped].every(isKana) && reading.endsWith(toHira(dropped))) {
      s = s.slice(0, keep);
      reading = reading.slice(0, reading.length - dropped.length);
    }
    if (uncoveredKanji(s, index).length > 0 && !suggestions.has(s)) suggestions.set(s, reading);
  }
}

const out = [...suggestions.entries()].sort((a, b) => b[0].length - a[0].length);
if (process.argv.includes("--json")) console.log(JSON.stringify(out));
else for (const [s, r] of out) console.log(`["${s}", "${r}"],`);
console.error(
  `候補 ${out.length} 件（そのまま入れない。1件ずつ見てから content/furigana.json に足す）`,
);
