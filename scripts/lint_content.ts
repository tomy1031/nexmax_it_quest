/**
 * 教材のチェック（npm run lint:content）。コミットの前と CI で動く。
 *
 * 1. content/ の JSON が src/content/schema.ts の形に合っているか（必ず守るルール5）
 * 2. 学生が読む文の漢字に、全部ふりがなが付くか（読み方のデータ content/furigana.json で覆えているか。ルール2）
 * 3. 読み方のデータそのものが壊れていないか（当たらない見出し・送りがな落ち・同じ字に2つの読み）
 * 4. 「タイ」という国名が無いか（ルール7）
 * 5. src/ のプログラムの中に日本語の文字列が無いか（画面の言葉は content/ui.json に置く。ふりがなを機械で見るため）
 * 6. 台本の中の参照（豆知識の id・jump 先）が実在するか
 *
 * 分かち書きが無い長い文は「注意」として出す（止めない）。
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { z } from "zod";
import {
  charactersFile,
  talksFile,
  chatFile,
  furiganaFile,
  listeningFile,
  metroFile,
  placesFile,
  stageFile,
  tipsFile,
  uiFile,
  type Beat,
} from "../src/content/schema";
import { buildFuriganaIndex, uncoveredKanji, type FuriganaEntry } from "../src/lib/text/furigana";
import { checkFuriganaEntries } from "../src/lib/text/furigana-checks";

const ROOT = join(import.meta.dirname, "..");
const errors: string[] = [];
const warnings: string[] = [];

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function check<T>(path: string, schema: z.ZodType<T>): T | null {
  const result = schema.safeParse(readJson(path));
  if (!result.success) {
    for (const issue of result.error.issues.slice(0, 10)) {
      errors.push(`${path}: 形が合わない ${issue.path.join(".")} — ${issue.message}`);
    }
    return null;
  }
  return result.data;
}

// ── 読み方のデータ ──
const furigana = check("content/furigana.json", furiganaFile);
const entries = (furigana?.entries ?? []) as FuriganaEntry[];
for (const p of checkFuriganaEntries(entries)) errors.push(`content/furigana.json: ${p.message}`);
const index = buildFuriganaIndex(entries);

// ── 学生が読む文を集める ──
/** 学生の目に入らない値のキー（id・ファイルの場所・英語など）。 */
const SKIP_KEYS = new Set([
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
  "look",
  "persona",
  "voice",
  "partner",
  "kind",
]);

const texts: { where: string; text: string }[] = [];
function collect(value: unknown, where: string, key?: string, skip: Set<string> = SKIP_KEYS) {
  if (key && skip.has(key)) return;
  if (typeof value === "string") texts.push({ where, text: value });
  else if (Array.isArray(value))
    value.forEach((v, i) => collect(v, `${where}[${i}]`, undefined, skip));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      // stage の wait.else のキーは出来事の名前（学生は見ない）
      collect(v, `${where}.${k}`, k, skip);
    }
  }
}

const contentFiles: [string, z.ZodType<unknown>][] = [
  ["content/ui.json", uiFile],
  ["content/tips.json", tipsFile],
  ["content/nmchat.json", chatFile],
  ["content/metro.json", metroFile],
  ["content/places.json", placesFile],
  ["content/characters.json", charactersFile],
  ["content/talks.json", talksFile],
];
for (const f of readdirSync(join(ROOT, "content/stages"))) {
  if (f.endsWith(".json")) contentFiles.push([`content/stages/${f}`, stageFile]);
}
const parsed = new Map<string, unknown>();
const listeningIds = new Set<string>();
for (const [path, schema] of contentFiles) {
  const data = check(path, schema);
  if (data) parsed.set(path, data);
  collect(readJson(path), path);
}

// ── リスニング（content/listenings/*.json。docs/design/02_リスニング.md） ──
/** リスニングの 中で 学生の 目に 入らない 値（label は 学生が 読むので、ここでは 調べる）。 */
const LISTENING_SKIP = new Set([
  "$comment",
  "id",
  "image",
  "icon",
  "en",
  "speaker",
  "voice",
  "kind",
  "line",
  "sounds",
]);
for (const f of readdirSync(join(ROOT, "content/listenings"))) {
  if (!f.endsWith(".json")) continue;
  const path = `content/listenings/${f}`;
  const data = check(path, listeningFile);
  collect(readJson(path), path, undefined, LISTENING_SKIP);
  if (!data) continue;
  if (`${data.id}.json` !== f) errors.push(`${path}: id「${data.id}」と ファイルの 名前が ちがう`);
  const transcript = data.script.map((l) => l.text).join("\n");
  const inScript = (word: string, what: string) => {
    if (!transcript.includes(word))
      errors.push(`${path}: ${what}「${word}」が 台本に その字の まま 出て こない`);
  };
  data.keywords.forEach((w) => inScript(w, "keywords"));
  // preOpen は 共通の 文の 終わり（です・ます など）を 書くので、台本に 無い ものは 注意だけ
  data.preOpen.forEach((w) => {
    if (!transcript.includes(w))
      warnings.push(`${path}: preOpen「${w}」が 台本に 出て こない（開ける 所が 無い）`);
  });
  data.sounds.forEach(([w]) => inScript(w, "sounds"));
  data.script.forEach((l, i) => {
    const len = [...l.text].length;
    if (len > 30) warnings.push(`${path}: script[${i}] が 30字を こえる（${len}字）`);
  });
  const ids = new Set(data.participants.map((p) => p.id));
  data.script.forEach((l, i) => {
    if (!ids.has(l.speaker))
      errors.push(`${path}: script[${i}] の 話す人「${l.speaker}」が participants に 無い`);
  });
  for (const work of data.works) {
    const images =
      work.kind === "match"
        ? work.pairs.map((p) => p.image)
        : work.kind === "situation"
          ? work.items.map((x) => x.image)
          : [];
    for (const img of images) {
      if (!existsSync(join(ROOT, "public", img)))
        warnings.push(`${path}: 絵が まだ 無い ${img}（無い 間は ネクマックスの 絵が 出る）`);
    }
    if (work.kind === "situation") {
      for (const item of work.items) {
        if (item.line >= data.script.length)
          errors.push(`${path}: 「${item.id}」の line ${item.line} が 台本の 外`);
        if (item.options.filter((o) => o.correct).length !== 1)
          errors.push(`${path}: 「${item.id}」の 正解（correct）は 1つに する`);
      }
    }
  }
  listeningIds.add(data.id);
}

for (const { where, text } of texts) {
  const missing = uncoveredKanji(text, index);
  if (missing.length > 0) {
    errors.push(
      `${where}: ふりがなが付かない漢字 ${missing.join("・")} — 「${text}」（content/furigana.json に読みを足す。npm run furigana:suggest で候補が出る）`,
    );
  }
  if (/(?<![ァ-ヶー])タイ(?![ァ-ヶー])|Thailand|Thai\b/.test(text)) {
    errors.push(
      `${where}: 「タイ」という国名は使わない（AGENTS.md 必ず守るルール7） — 「${text}」`,
    );
  }
  // 分かち書き（学生向けの文は文節の間に空白）。長いのに空白が無い文は注意だけ出す
  const jp = text.replace(/[A-Za-z0-9%#:：・、。！？「」（）()\-\s]/g, "");
  if (jp.length >= 14 && !/\s/.test(text) && !where.includes(".name")) {
    warnings.push(`${where}: 分かち書きの空白が無い長い文 — 「${text}」`);
  }
}

// ── 台本の中の参照 ──
const tips = parsed.get("content/tips.json") as z.infer<typeof tipsFile> | undefined;
const tipIds = new Set(tips?.tips.map((t) => t.id) ?? []);
for (const tip of tips?.tips ?? []) {
  if (!existsSync(join(ROOT, "public", tip.image))) {
    warnings.push(
      `content/tips.json: 豆知識「${tip.id}」の絵がまだ無い ${tip.image}（無い間はネクマックスの絵が出る。npm run shots で作る）`,
    );
  }
}
for (const [path, data] of parsed) {
  if (!path.startsWith("content/stages/")) continue;
  const stage = data as z.infer<typeof stageFile>;
  const sectionIds = new Set(stage.sections.map((s) => s.id));
  if (sectionIds.size !== stage.sections.length) errors.push(`${path}: 場面の id が重なっている`);
  const chapters = new Set(stage.chapters.map((c) => c.no));
  const walk = (beats: Beat[], where: string) => {
    beats.forEach((b, i) => {
      const w = `${where}[${i}]`;
      if (b.t === "tip" && !tipIds.has(b.id))
        errors.push(`${w}: 豆知識「${b.id}」が content/tips.json に無い`);
      if (b.t === "panel" && b.id === "listening" && !listeningIds.has(b.mode ?? ""))
        errors.push(`${w}: リスニング「${b.mode}」が content/listenings に 無い`);
      if (b.t === "jump" && !sectionIds.has(b.to))
        errors.push(`${w}: jump 先「${b.to}」の場面が無い`);
      if (b.t === "choice") {
        if (!b.options.some((o) => o.correct)) errors.push(`${w}: 選択肢に正解（correct）が無い`);
        b.options.forEach((o, j) => o.then && walk(o.then, `${w}.options[${j}]`));
      }
      if (b.t === "wait" && b.else)
        for (const [k, v] of Object.entries(b.else)) walk(v, `${w}.else.${k}`);
    });
  };
  for (const s of stage.sections) {
    if (!chapters.has(s.chapter))
      errors.push(`${path}: 場面「${s.id}」の章 ${s.chapter} が chapters に無い`);
    walk(s.beats, `${path}#${s.id}`);
  }
}

// ── src/ の中の日本語 ──
const JP = /[぀-ヿ㐀-鿿]/;
/** 学生の目に入らない、開発者向けの文だけを持つ所（読み方のデータの検査の説明など）。 */
const SRC_EXEMPT = ["src/lib/text/", "src/content/schema.ts"];
function walkDir(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
}
const srcFiles: string[] = [];
walkDir(join(ROOT, "src"), srcFiles);
for (const file of srcFiles) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (SRC_EXEMPT.some((e) => rel.startsWith(e))) continue;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text;
      if (JP.test(text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        errors.push(
          `${rel}:${line + 1}: プログラムの中に日本語 「${text.trim().slice(0, 30)}」 — content/ui.json に置いて t() で出す`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// ── 結果 ──
for (const w of warnings) console.warn(`注意  ${w}`);
for (const e of errors) console.error(`エラー  ${e}`);
console.log(
  `\n学生が読む文 ${texts.length} 件・読み方 ${entries.length} 件を調べました。エラー ${errors.length} 件・注意 ${warnings.length} 件。`,
);
if (errors.length > 0) process.exit(1);
