/**
 * リスニングの聞き取り判定（純関数）。姉妹アプリ academy の
 * src/components/listening/listening-checks.ts から 移した（同じ 持ち主。docs/design/02_リスニング.md）。
 * このアプリで 変えた 所: 外れた ときの 手がかりは 文では なく データ（hintHead）で 返す
 * （画面の 文は content/ui.json に 置く）。preOpen（はじめから 開けておく 言葉）を 足した。
 *
 * 以下は academy の 説明:
 *
 * 旧アプリ（listening/soudan・listening/renraku）の移植。
 * 原典は **入力欄が1つ** で、そこに入れた言葉が
 *   ①キーワードか ②キーワードを含むか ③本文に出てくるか
 * を順に見て、点数を変えながら原稿の該当箇所を開いていく作りだった。
 * 「キーワード発見」と「原稿リベール」は別々の機能ではなく、
 * ひとつの入力に対する結果の大小でしかない。
 *
 * ## ひらがなで 打っても 当たる（2026-09-04 に 直した）
 * 前は `normalizeReading` を 1回 通すだけ だった。これは **カタカナを ひらがなに
 * するだけ**で 漢字は 漢字の まま 残る——だから 原稿の 「達成感」に 対して
 * 「たっせいかん」と 打っても **絶対に 当たらなかった**。学習者は 聞いた とおりに
 * かなで 打つ のに、漢字で 書かないと 点に ならない 作りに なっていた。
 *
 * いまは **原稿も 入力も、教材の 読み辞書（furigana）で かなへ 倒してから 比べる**
 *（`annotateRuby` → 読みへ 置換）。辞書に 無い 漢字の ために、素の 形の 見かたも
 * 同時に 持ち、**どちらかに 当たれば 当たり**に する。
 *
 * ## 数字・英字で 始まる 語も かなで 当たる（2026-09-28 に 足した）
 * 読み辞書は **漢字の 位置からしか 引かない**ので、「10時」「360円」「GitHub」は
 * 読みを 書いても 当たらなかった——聞いた とおり「じゅうじ」「ぎっとはぶ」と 打つと
 * 永久に 外れる。そこで **聞き取りチェック だけが 使う 読み**（`SoundsIndex`・
 * 台帳は `src/content/listening-sounds.ts`）を 別に 持ち、**どの 位置からでも** 引く。
 * 同じ 表記に 読みを 何本も 書ける（80％ → はちじゅっ／はちじっ ぱーせんと）ので、
 * 読みの 見かたは 候補の 数だけ 作る。ルビは 振らない（画面の 見た目は 変えない）。
 */

import { looseReading, normalizeReading, toHiragana } from "@/lib/text/normalize";
import { LATIN_KANA } from "@/lib/text/kana-tables";
import {
  annotateRuby,
  KANJI,
  type FuriganaEntry,
  type FuriganaIndex,
  type RubySegment,
} from "@/lib/text/furigana";

/** 判定の種類。点数と文言はここで決まる（原典の配点をそのまま使う）。 */
export type HitKind =
  /** キーワードそのもの（原稿の表記と一致）。 */
  | "keyword"
  /** キーワードの読み・別表記。 */
  | "hiragana"
  /** 複数のキーワードを含む言い方。 */
  | "contains"
  /** キーワードは含むが、本文にその言い方では出てこない。 */
  | "close"
  /** キーワードではないが本文に出てくる。 */
  | "partial"
  /** 短すぎて判定できない。 */
  | "tooShort"
  /**
   * さっき 打った ことば。
   *
   * **`miss` と 混ぜない**（2026-09-04 の 指摘）。前は 同じ ことばを 2回 打つと
   * 「まだ 出ていないみたい」と 出て いた——1回目に「本文に ある」と 言われた
   * ばかりの ことばなのに、である。出て いない のでは なく **もう 見つけて いる**。
   */
  | "repeat"
  /**
   * 本文には あるが、入力の **途中まで**しか 合って いない。
   * 「まだ 出ていないみたい」だけでは 何が ちがうのか 分からない
   *（2026-09-04 の 指摘「意味不明」）ので、**どこまで 合って いたか**を 返す。
   */
  | "partway"
  /** ローマ字（英字）で 打った。 */
  | "romaji"
  /** 本文に まったく 出て こない。 */
  | "miss";

/**
 * 長い言葉ほど点が高い。
 *
 * 1語ずつ拾うより、聞こえた**ひとかたまり**を書き取るほうが難しく、
 * 聞き取りの練習としても価値が高い。短い語の連打で稼げるままだと、
 * 学習者はいちばん楽な当て方に寄っていく。
 */
export function lengthBonus(text: string, rules: ListeningRules): number {
  const extra = normalizeReading(text).length - rules.minLength;
  return extra <= 0 ? 0 : Math.min(10, extra);
}

export const POINTS: Record<HitKind, number> = {
  keyword: 5,
  hiragana: 3,
  contains: 5, // 含まれていたキーワード1つにつき
  close: 0,
  partial: 2,
  tooShort: 0,
  repeat: 0,
  partway: 0,
  romaji: 0,
  miss: 0,
};

/** ミスできる回数の既定（教材ごとに変えられる — listeningSchema の check）。 */
export const MAX_MISS = 3;

/** 受けつける最小の文字数の既定。 */
export const MIN_LENGTH = 3;

/** 聞き取りチェックの設定（教材から渡す）。 */
export interface ListeningRules {
  /** ひらがなだけの入力を、何文字から受けつけるか。 */
  readonly minLength: number;
  readonly maxMiss: number;
}

export const DEFAULT_RULES: ListeningRules = { minLength: MIN_LENGTH, maxMiss: MAX_MISS };

/**
 * 原稿を「かなに 倒した 並び」と、その 1文字ずつが **元の どこから 来たか**の 対応表。
 *
 * 読みは 表記と 長さが ちがう（達成感=3字 → たっせいかん=6字）ので、
 * かなの 1文字が 元の 1文字に 対応するとは 限らない。だから **読みの どこに 当たっても
 * その ことば まるごとを ひらく**——漢字を 半分だけ ひらいても 読めないからである。
 */
interface KanaView {
  readonly kana: string;
  /** kana[i] を ひらく ときに 開ける 元の 位置（複数）。 */
  readonly owners: readonly (readonly number[])[];
}

export interface ListeningState {
  readonly transcript: string;
  readonly keywords: readonly string[];
  readonly rules: ListeningRules;
  /**
   * 隠せる文字の数（かな・漢字・数字）。表示率の分母。
   *
   * 以前は原稿の長さを分母にしていたので、句読点や空白は最初から見えている
   * ぶんだけ**何も当てていないのに 11% から始まっていた**。
   * 学習者から見ると「もう1割わかった」と嘘をつかれたことになる。
   */
  readonly hideableCount: number;
  /** 見つけたキーワード。 */
  readonly foundKeywords: readonly string[];
  /** 一度当てた入力（同じ語で二度稼げないようにする）。 */
  readonly usedInputs: readonly string[];
  readonly score: number;
  readonly kanjiHits: number;
  readonly hiraganaHits: number;
  readonly otherHits: number;
  readonly misses: number;
  /** 原稿の見えている文字の位置。 */
  readonly revealed: ReadonlySet<number>;
  /**
   * 読み辞書で かなへ 倒した 見かた（ひらがな入力は これに 当てる）。
   * **聞き取り専用の 読みの 候補の 数だけ** ある（候補が 無ければ 1つ）。
   */
  readonly kanaViews: readonly KanaView[];
  /** 素の 見かた（辞書に 無い 漢字・英字は こちらで 当てる）。 */
  readonly rawView: KanaView;
  /** 入力を かなへ 倒す ための 辞書。 */
  readonly furigana: FuriganaIndex;
  /** 聞き取りチェック だけが 使う 読み（数字・英字で 始まる 語。どの 位置からでも 引く）。 */
  readonly sounds: SoundsIndex;
  /**
   * 長音を 母音に 開いた 見かた（「さーばー」＝「さあばあ」）。
   * `looseReading` は 1文字を 1文字に 置きかえる ので 長さが 変わらず、
   * 位置の 対応表（owners）は そのまま 使える。
   */
  readonly looseViews: readonly KanaView[];
  /** 入力の履歴（新しい順に画面へ出す）。 */
  readonly log: readonly LogEntry[];
}

export interface LogEntry {
  readonly input: string;
  readonly kind: HitKind;
  readonly points: number;
  /** 見つかったキーワード（contains のときは複数）。 */
  readonly keywords: readonly string[];
  /**
   * 外れた ときの 手がかり（partway のとき、本文に あった はじめの 部分）。
   * 何が ちがうのか 分からない まま 打ち直させない ため。文は 画面が 作る。
   */
  readonly hintHead?: string;
}

/* ------------------------------------------------------------------ *
 * 聞き取り専用の 読み（数字・英字で 始まる 語）
 * ------------------------------------------------------------------ */

/** 聞き取り専用の 読みの 1語。 */
interface SoundsEntry {
  /** 比べる 形（`foldChars` を 通した 表記）。 */
  readonly key: string;
  /** 読みの 候補（`normalizeReading` を 通した もの）。1つ目が 基本。 */
  readonly readings: readonly string[];
}

/** 聞き取り専用の 読みの 索引。 */
export interface SoundsIndex {
  /** 長い 表記から 順（最長一致）。 */
  readonly entries: readonly SoundsEntry[];
  /** 読みの 候補の 最大数＝作る 見かたの 数（候補が 無ければ 1）。 */
  readonly variants: number;
}

export const NO_SOUNDS: SoundsIndex = { entries: [], variants: 1 };

/**
 * 1文字ずつ NFKC ＋ 小文字に そろえる（**長さを 変えない**）。
 *
 * 学習者は「ＧｉｔＨｕｂ」「github」とも、「80パーセント」「80ぱーせんと」とも 打つ ので、
 * 表記の 比べは この 形で する（カタカナも ひらがなへ。1字は 1字の まま）。
 * 1文字が 2文字以上に ほどける 字（「㎇」など）は そのまま 残す——長さが 変わると
 * 原稿の 位置の 対応（owners）が ずれる。
 */
function foldChars(text: string): string {
  return text
    .split("")
    .map((ch) => {
      const folded = toHiragana(ch.normalize("NFKC").toLowerCase());
      return folded.length === 1 ? folded : ch;
    })
    .join("");
}

/**
 * `[表記, よみ]` の 並びから 索引を 作る。**同じ 表記を 何行でも 書ける**——
 * 2行目からは 別の 読み（聞こえかたの ゆれ）に なる。
 */
export function buildSoundsIndex(entries: readonly FuriganaEntry[] = []): SoundsIndex {
  const byKey = new Map<string, string[]>();
  for (const [surface, reading] of entries) {
    const key = foldChars(surface);
    const kana = normalizeReading(reading);
    if (!key || !kana) continue;
    const list = byKey.get(key) ?? [];
    if (!list.includes(kana)) list.push(kana);
    byKey.set(key, list);
  }
  const list = [...byKey.entries()]
    .map(([key, readings]) => ({ key, readings }))
    .sort((a, b) => b.key.length - a.key.length);
  const variants = list.reduce((max, entry) => Math.max(max, entry.readings.length), 1);
  return { entries: list, variants };
}

const LATIN = /[a-z]/;
const DIGIT = /[0-9]/;
const KANJI_NUMERAL = /[〇一二三四五六七八九十百千万]/;

/**
 * 語の 切れ目に 当たって いるか。「5時」が「15時」の 中で、「API」が「RAPID」の 中で、
 * 「五時」が「十五時」の 中で、「5GB」が「1.5GB」の 中で 当たると、ちがう 数・ちがう 語の
 * 読みに なる。**英字の 前後に 英字、数字（漢数字）の 前後に 数字が 続く ところでは
 * 当てない**（「100GB」の「GB」は 数字の あとなので 当たる）。
 */
function atWordEdge(folded: string, start: number, length: number): boolean {
  const same = (a: string | undefined, b: string | undefined) =>
    a !== undefined &&
    b !== undefined &&
    ((LATIN.test(a) && LATIN.test(b)) ||
      (DIGIT.test(a) && DIGIT.test(b)) ||
      (KANJI_NUMERAL.test(a) && KANJI_NUMERAL.test(b)));
  const first = folded[start];
  // 小数点・桁の 区切りを はさんだ 数（1.5GB・3,600円）の 途中から 始めない
  const inNumber =
    first !== undefined &&
    DIGIT.test(first) &&
    /[.,]/.test(folded[start - 1] ?? "") &&
    DIGIT.test(folded[start - 2] ?? "");
  return (
    !inNumber &&
    !same(first, folded[start - 1]) &&
    !same(folded[start + length - 1], folded[start + length])
  );
}

/**
 * 読み辞書の 熟語を 割らないか。「10時間」に 台帳の「10時」を 当てると、辞書の「時間」が
 * 割れて「じかん」と 打っても 当たらなく なる。**台帳の 語の 中から 始まって 外まで
 * 続く 辞書の 見出し**が あれば、その 位置では 台帳を 当てない（辞書に ゆずる）。
 */
function splitsDictionaryWord(
  text: string,
  furigana: FuriganaIndex,
  start: number,
  end: number,
): boolean {
  for (let k = start; k < end; k += 1) {
    if (!KANJI.test(text[k] ?? "")) continue;
    const longer = furigana.entries.some(
      ([surface]) => k + surface.length > end && text.startsWith(surface, k),
    );
    if (longer) return true;
  }
  return false;
}

/**
 * 文を 読みの ついた 断片に 割る（聞き取りチェック用）。
 *
 * 聞き取り専用の 読みを **どの 位置からでも** 先に 当て、その あいだは 読み辞書
 *（`annotateRuby`・漢字の 位置から）で 割る。`variant` 番目の 読みの 候補を 使う
 *（候補が 足りない 語は 1つ目）。
 */
function typingSegments(
  text: string,
  furigana: FuriganaIndex,
  sounds: SoundsIndex,
  variant: number,
): RubySegment[] {
  if (sounds.entries.length === 0) return annotateRuby(text, furigana);
  const folded = foldChars(text);
  const out: RubySegment[] = [];
  let gapStart = 0;
  let i = 0;
  while (i < text.length) {
    const hit = sounds.entries.find(
      (entry) =>
        folded.startsWith(entry.key, i) &&
        atWordEdge(folded, i, entry.key.length) &&
        !splitsDictionaryWord(text, furigana, i, i + entry.key.length),
    );
    if (!hit) {
      i += 1;
      continue;
    }
    if (i > gapStart) out.push(...annotateRuby(text.slice(gapStart, i), furigana));
    const reading = hit.readings[Math.min(variant, hit.readings.length - 1)] ?? hit.readings[0];
    out.push({ text: text.slice(i, i + hit.key.length), reading });
    i += hit.key.length;
    gapStart = i;
  }
  if (gapStart < text.length) out.push(...annotateRuby(text.slice(gapStart), furigana));
  return out;
}

/**
 * 聞き取り専用の 読みの 語だけ **かなに 置きかえた 文**（ほかの 字は そのまま）。
 *
 * 音づくり（`scripts/lib/speech_reading.ts`）が、原稿と 文字起こしの 両方を これに
 * 通してから 読みを 比べる。文字起こしは「GitHub」とも「ギットハブ」とも、
 * 「10時」とも「十時」とも 書く ので、同じ 台帳で そろえないと 正しく 読んだ 音まで 落ちる。
 */
export function spellSounds(
  text: string,
  sounds: SoundsIndex,
  render: (reading: string) => string = (reading) => reading,
): string {
  return typingSegments(text, { entries: [], maxLength: 0 }, sounds, 0)
    .map((segment) => (segment.reading ? render(segment.reading) : segment.text))
    .join("");
}

/**
 * 原稿を かなの 並びへ 倒し、1文字ずつ「元の どこか」を 覚える。
 *
 * `variant` が 数の ときだけ 読み（辞書と 聞き取り専用の 読みの その 番目の 候補）を 使う。
 * `null` の ときは 1文字ずつ `normalizeReading` を 通すだけ——
 * 辞書に 無い 漢字や 英字（SES など）は こちらで 当てる。
 */
function buildView(
  transcript: string,
  index: FuriganaIndex,
  sounds: SoundsIndex,
  variant: number | null,
): KanaView {
  const withReadings = variant !== null;
  const owners: (readonly number[])[] = [];
  let kana = "";
  let at = 0;
  const segments: readonly RubySegment[] = withReadings
    ? typingSegments(transcript, index, sounds, variant)
    : [{ text: transcript }];
  for (const segment of segments) {
    const reading = segment.reading;
    if (withReadings && reading) {
      // 読みの どこに 当たっても、その ことば まるごとを ひらく
      const whole = Array.from({ length: segment.text.length }, (_, k) => at + k);
      const piece = normalizeReading(reading);
      for (let k = 0; k < piece.length; k += 1) owners.push(whole);
      kana += piece;
    } else {
      for (let c = 0; c < segment.text.length; c += 1) {
        const plain = normalizeReading(segment.text[c] ?? "");
        // 読みの 見かたでは 英字も 1文字ずつ 開く（SES → えすいーえす）
        const piece = withReadings ? spellLatin(plain) : plain;
        for (let k = 0; k < piece.length; k += 1) owners.push([at + c]);
        kana += piece;
      }
    }
    at += segment.text.length;
  }
  return { kana, owners };
}

/**
 * 英字 1文字ずつの 読み。**リスニングでは 字が 想像できない**ので、
 * 「SES」を 聞いて「えすいーえす」と 打つ 学習者を 落とさない
 *（2026-09-04 の 指定「できる限り 許容範囲を 広げて欲しい」）。
 */

/** 英字の 連なりを 1文字ずつの 読みに 開く（ses → えすいーえす）。 */
function spellLatin(text: string): string {
  return [...text].map((ch) => LATIN_KANA[ch] ?? ch).join("");
}

/**
 * 入力を 読み辞書で かなへ 倒す（辞書に 無い 漢字は そのまま 残る）。
 * 聞き取り専用の 読みが あれば、その `variant` 番目の 候補で 倒す。
 */
function toKana(
  text: string,
  index: FuriganaIndex,
  sounds: SoundsIndex = NO_SOUNDS,
  variant = 0,
): string {
  return typingSegments(text, index, sounds, variant)
    .map((segment) =>
      segment.reading
        ? normalizeReading(segment.reading)
        : spellLatin(normalizeReading(segment.text)),
    )
    .join("");
}

/**
 * かなへ 倒した 形を **読みの 候補の 数だけ** 返す（重複は 落とす。1つ目が 基本）。
 * 「80％」は「はちじゅっぱーせんと」と「はちじっぱーせんと」の 2つに なる。
 *
 * タイピング（`src/components/typing/typing-checks.ts`）も 同じ 倒しかたで 文を 比べる
 * ので 外に 出す（2026-09-30。聞き取りと タイピングで 読みの 当たりかたを 変えない）。
 */
export function readingForms(
  text: string,
  furigana: FuriganaIndex,
  sounds: SoundsIndex = NO_SOUNDS,
): readonly string[] {
  const forms = Array.from({ length: sounds.variants }, (_, variant) =>
    toKana(text, furigana, sounds, variant),
  );
  /*
   * **台帳を 通さない 形も 残す**。「5じまで」「10じごろ」の ように 数字を 変換せずに
   * かなと 混ぜて 打つ 学習者は、台帳の 読み（ごじ）では なく 数字の まま（5じ）の
   * 見かたに 当たる。台帳を 入れた せいで これが 外れると「嘘の 不正解」に なる。
   */
  if (sounds.entries.length > 0) forms.push(toKana(text, furigana));
  return [...new Set(forms)];
}

function kanaForms(text: string, state: ListeningState): readonly string[] {
  return readingForms(text, state.furigana, state.sounds);
}

/**
 * 読みの 候補を **1つ目に そろえた** 形（同じ ことばかを 見る ため）。
 * 「はちじっぱーせんと」も「はちじゅうぱーせんと」も「はちじゅっぱーせんと」に なる。
 * 長い 読みから 先に 当てる（「ひゃくぎが」を「ひゃくぎがばいと」の 頭で 置きかえない）。
 */
export function canonicalKana(kana: string, sounds: SoundsIndex): string {
  const alternates = sounds.entries
    .filter((entry) => entry.readings.length > 1)
    .flatMap((entry) => entry.readings.map((reading) => [reading, entry.readings[0]!] as const))
    .sort((a, b) => b[0].length - a[0].length);
  if (alternates.length === 0) return kana;
  let out = "";
  let i = 0;
  while (i < kana.length) {
    const hit = alternates.find(([reading]) => kana.startsWith(reading, i));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else {
      out += kana[i];
      i += 1;
    }
  }
  return out;
}

export function createListening(
  transcript: string,
  keywords: readonly string[],
  rules: ListeningRules = DEFAULT_RULES,
  furigana: FuriganaIndex = { entries: [], maxLength: 0 },
  sounds: SoundsIndex = NO_SOUNDS,
): ListeningState {
  const kanaViews = Array.from({ length: sounds.variants }, (_, variant) =>
    buildView(transcript, furigana, sounds, variant),
  );
  // 台帳を 通さない 見かたも 1本（「5時」を「5じ」と 打つ 学習者の ため。`kanaForms` と 対）
  if (sounds.entries.length > 0) kanaViews.push(buildView(transcript, furigana, NO_SOUNDS, 0));
  const rawView = buildView(transcript, furigana, sounds, null);
  // 記号・空白は最初から見えている（形だけ分かると「発掘」しやすい）
  const revealed = new Set<number>();
  let hideableCount = 0;
  for (let i = 0; i < transcript.length; i += 1) {
    if (isHideable(transcript[i])) hideableCount += 1;
    else revealed.add(i);
  }
  return {
    transcript,
    keywords,
    rules,
    furigana,
    sounds,
    kanaViews,
    rawView,
    looseViews: [...kanaViews, rawView].map((view) => ({
      kana: looseReading(view.kana),
      owners: view.owners,
    })),
    hideableCount,
    foundKeywords: [],
    usedInputs: [],
    score: 0,
    kanjiHits: 0,
    hiraganaHits: 0,
    otherHits: 0,
    misses: 0,
    revealed,
    log: [],
  };
}

/**
 * 入力を1つ受ける。原典の判定順をそのまま守る:
 *   1. キーワードそのもの → 5点（読み・別表記なら 3点）
 *   2. キーワードを含む言い方 → 含んだ数 × 5点。ただし本文に無ければ「おしい」
 *   3. 短すぎる入力 → ミス
 *   4. 本文に出てくる → 2点
 *   5. どれでもない → ミス
 * 当たった言葉は、その場で原稿の該当箇所を開く。
 */
export function submitListening(state: ListeningState, raw: string): ListeningState {
  const input = raw.trim();
  if (!input) return state;

  const needle = normalizeReading(input);
  if (!needle) return state;
  /** 入力を 読み辞書で かなへ 倒した 形（「達成感」→「たっせいかん」）。 */
  const kanas = kanaForms(input, state);

  /*
   * 同じ ことばで 二度は 稼げない。ただし **「まだ 出ていない」とは 言わない**——
   * さっき 見つけた ばかりの ことばに それを 言うと 嘘に なる（2026-09-04 の 指摘）。
   *
   * 見るのは **表記では なく ことば**。「たっせいかん」の あとに 「達成感」と
   * 打っても 同じ ことばなので 二度は 数えない（読みへ 倒してから 見くらべる）。
   */
  const mineKeys = new Set(kanas.map((one) => canonicalKana(one, state.sounds)));
  const alreadyUsed = state.usedInputs.some(
    (used) =>
      used === needle ||
      kanaForms(used, state).some((one) => mineKeys.has(canonicalKana(one, state.sounds))),
  );
  if (alreadyUsed) {
    return push(state, { input, kind: "repeat", points: 0, keywords: [] }, { countMiss: false });
  }

  const remaining = state.keywords.filter((kw) => !state.foundKeywords.includes(kw));

  // 1. キーワードそのもの（表記／読みの どちらでも）
  const exact = remaining.find((kw) => kw === input);
  const mine = needleForms(needle, ...kanas);
  const byReading = remaining.find((kw) => {
    const theirs = needleForms(normalizeReading(kw), ...kanaForms(kw, state));
    return theirs.some((one) => mine.includes(one));
  });
  if (exact || byReading) {
    const hit = exact ?? byReading!;
    const kind: HitKind = exact ? "keyword" : "hiragana";
    return award(
      state,
      input,
      needle,
      kanas,
      kind,
      POINTS[kind] + lengthBonus(input, state.rules),
      [hit],
    );
  }

  // 2. キーワードを含む言い方
  const contained = remaining.filter((kw) => {
    const theirs = needleForms(normalizeReading(kw), ...kanaForms(kw, state));
    return theirs.some((one) => one.length > 0 && mine.some((form) => form.includes(one)));
  });
  if (contained.length > 0) {
    if (isInTranscript(state, needle, kanas)) {
      return award(
        state,
        input,
        needle,
        kanas,
        "contains",
        POINTS.contains * contained.length + lengthBonus(input, state.rules),
        contained,
      );
    }
    return push(state, { input, kind: "close", points: 0, keywords: contained });
  }

  // 3. 短すぎる入力（ひらがなだけなら minLength、漢字まじりはその1つ手前から）
  const allKana = /^[ぁ-ゖー0-9]+$/.test(needle);
  const floor = allKana ? state.rules.minLength : Math.max(1, state.rules.minLength - 1);
  if (needle.length < floor) {
    return push(state, { input, kind: "tooShort", points: 0, keywords: [] });
  }

  // 4. キーワードではないが本文に出てくる
  if (isInTranscript(state, needle, kanas)) {
    return award(
      state,
      input,
      needle,
      kanas,
      "partial",
      POINTS.partial + lengthBonus(input, state.rules),
      [],
    );
  }

  // 5. 該当なし —— **なぜ 外れたか**を 切り分けて 返す
  return push(state, { input, ...diagnose(state, needle, kanas) });
}

/**
 * 外れた ときに「何が ちがうのか」を 言う。
 *
 * 2026-09-04 の 指摘:「まだ出てないみたい」は 意味不明。
 * 学習者は **打ち直す 手がかり**が 要る のであって、否定が 要る のでは ない。
 * 見分けるのは 3つ:
 *   - ローマ字で 打った（日本語に すれば 当たる かもしれない）
 *   - 途中までは 合って いる（続きだけ ちがう）
 *   - 本当に 出て こない
 */
function diagnose(
  state: ListeningState,
  needle: string,
  kanas: readonly string[],
): { kind: HitKind; points: number; keywords: readonly string[]; hintHead?: string } {
  const base = { points: 0, keywords: [] as readonly string[] };

  // ローマ字のまま（かなに ならなかった）
  if (/^[a-z0-9\s]+$/.test(needle) && needle.trim().length > 0) {
    return { ...base, kind: "romaji" };
  }

  /*
   * 途中までは 合って いるか。**長い ほうから** 見て、いちばん 長く 合った
   * ところを 返す（2文字 未満は 手がかりに ならない ので 出さない）。
   */
  const forms = needleForms(needle, ...kanas).filter((form) => form.length >= 3);
  for (const form of forms) {
    for (let end = form.length - 1; end >= 2; end -= 1) {
      const head = form.slice(0, end);
      if (allViews(state).some((view) => view.kana.includes(head))) {
        return { ...base, kind: "partway", hintHead: head };
      }
    }
  }

  return { ...base, kind: "miss" };
}

function award(
  state: ListeningState,
  input: string,
  needle: string,
  kanas: readonly string[],
  kind: HitKind,
  points: number,
  keywords: readonly string[],
): ListeningState {
  /*
   * 当たった ことばと、その キーワードの 表記の 両方で 原稿を ひらく。
   * **素の 形と 読みの 形の 両方で 探す**——「たっせいかん」で 当てた 学習者にも
   * 「達成感」で 当てた 学習者にも、同じ ところが ひらかなければ ならない。
   */
  let revealed = state.revealed;
  for (const form of [input, ...keywords]) {
    const forms =
      form === input
        ? needleForms(needle, ...kanas)
        : needleForms(normalizeReading(form), ...kanaForms(form, state));
    for (const view of allViews(state)) {
      for (const one of forms) revealed = revealWith(view, revealed, one);
    }
  }

  const next: ListeningState = {
    ...state,
    revealed,
    score: state.score + points,
    foundKeywords: [...state.foundKeywords, ...keywords],
    usedInputs: [...state.usedInputs, needle],
    kanjiHits: state.kanjiHits + (kind === "keyword" || kind === "contains" ? keywords.length : 0),
    hiraganaHits: state.hiraganaHits + (kind === "hiragana" ? 1 : 0),
    otherHits: state.otherHits + (kind === "partial" ? 1 : 0),
  };
  return push(next, { input, kind, points, keywords }, { countMiss: false });
}

function push(
  state: ListeningState,
  entry: LogEntry,
  { countMiss = true }: { countMiss?: boolean } = {},
): ListeningState {
  const isMiss = countMiss && (entry.kind === "miss" || entry.kind === "tooShort");
  return {
    ...state,
    misses: state.misses + (isMiss ? 1 : 0),
    log: [entry, ...state.log].slice(0, 8),
  };
}

/* ------------------------------------------------------------------ *
 * 原稿の開きぐあい
 * ------------------------------------------------------------------ */

/**
 * かなの 並びの 上で 探し、当たった ところが 元の どこかを たどって ひらく。
 *
 * 見かたは `createListening` で 1度だけ 組み立てて ある（前は 入力の たびに
 * 原稿ぜんぶを 組み直して いた）。
 */
function revealWith(
  view: KanaView,
  revealed: ReadonlySet<number>,
  needle: string,
): ReadonlySet<number> {
  if (!needle) return revealed;
  const next = new Set(revealed);
  let from = 0;
  for (;;) {
    const at = view.kana.indexOf(needle, from);
    if (at < 0) break;
    for (let k = at; k < at + needle.length; k += 1) {
      for (const original of view.owners[k] ?? []) next.add(original);
    }
    from = at + 1;
  }
  return next;
}

/**
 * その ことばが 原稿に あるか。**素の 形でも 読みの 形でも 当たれば あり**。
 *
 * 前は `normalizeReading(transcript)` を 見て いた——カタカナを ひらがなに するだけ なので
 * 漢字は 漢字の まま で、かなで 打った 学習者は 永久に 当たらなかった。
 */
function isInTranscript(state: ListeningState, needle: string, kanas: readonly string[]): boolean {
  const forms = needleForms(needle, ...kanas);
  return allViews(state).some((view) =>
    forms.some((form) => form.length > 0 && view.kana.includes(form)),
  );
}

/** 原稿の 見かた ぜんぶ（素・読み・長音を 開いた もの）。 */
function allViews(state: ListeningState): readonly KanaView[] {
  return [state.rawView, ...state.kanaViews, ...state.looseViews];
}

/**
 * 入力の 形 ぜんぶ。**リスニングでは 字が 想像できない**ので、
 * ひらがな・カタカナ・漢字・英字の どれで 打っても 当たる ように 手を 広げる
 *（2026-09-04 の 指定）。重複は 落とす。
 */
function needleForms(needle: string, ...kanas: readonly string[]): readonly string[] {
  return [
    ...new Set([
      needle,
      ...kanas,
      looseReading(needle),
      ...kanas.map((kana) => looseReading(kana)),
    ]),
  ];
}

/**
 * 原稿の表示率（%）。答え合わせへ進めるかの判定に使う。
 *
 * **分母は「隠せる文字」だけ**。句読点や空白は最初から見えているので、
 * それを数に入れると何も当てていないのに 11% から始まる。
 */
export function revealRate(state: ListeningState): number {
  if (state.hideableCount === 0) return 100;
  let shown = 0;
  for (const index of state.revealed) {
    if (isHideable(state.transcript[index])) shown += 1;
  }
  const percent = Math.round((shown / state.hideableCount) * 100);
  /*
   * **1字でも 残って いれば 100 と 言わない**（2026-10-06）。四捨五入で 100 に なると、
   * 学習者は 終わったと 思って こたえあわせへ 進み、修了証の 100%（`isFullyRevealed`）を 取りのがす。
   */
  return percent === 100 && shown < state.hideableCount ? 99 : percent;
}

/**
 * 原稿を **1字も 残さず** 開いたか（修了証の「100%」）。
 *
 * `revealRate` は 四捨五入なので、300字の うち 1字 残って いても 100 に なる。
 * 修了証は「100% 達成」の 証明なので、ここでは 丸めずに 数える（2026-10-06・願い #562）。
 */
export function isFullyRevealed(state: ListeningState): boolean {
  let shown = 0;
  for (const index of state.revealed) {
    if (isHideable(state.transcript[index])) shown += 1;
  }
  return shown >= state.hideableCount;
}

/** 隠す対象の文字か（かな・漢字・数字）。 */
function isHideable(char: string | undefined): boolean {
  return char !== undefined && /[\p{Letter}\p{Number}]/u.test(char);
}

/**
 * 保存してある入力を順に流し込んで、続きから始められるようにする。
 *
 * 開いた場所そのもの（位置の集合）ではなく**入力した言葉**を保存する。
 * 位置は台本を1文字直すだけでずれるが、言葉なら意味が変わらない。
 */
export function replayListening(state: ListeningState, inputs: readonly string[]): ListeningState {
  let next = state;
  for (const input of inputs) next = submitListening(next, input);
  // やり直しの途中でついたミスは持ち越さない（前回の失敗を今日の回数に足さない）
  return { ...next, misses: 0, log: [] };
}

/** あと何こ見つければよいか。「のこり」を主役に出すために使う。 */
export function remainingKeywords(state: ListeningState): number {
  return state.keywords.length - state.foundKeywords.length;
}

/* ------------------------------------------------------------------ *
 * このアプリで 足した もの（虫食い・ヒント・行ごとの 表示）
 * ------------------------------------------------------------------ */

/**
 * はじめから 開けておく 言葉（`preOpen`）を、点なしで 開ける（「虫食い」にする）。
 *
 * N5 の 学生は 何も 無い 所から 始めると むずかしいので、文の 終わり（です・ます・ください）を 先に 見せる。
 * 開けるのは **書いた 字の まま 出てくる 所だけ**（読みでは 開けない。「ます」の 読みが 漢字の 語の 中に
 * 当たって、漢字まで 開いて しまわないように）。開けた 言葉は 入力済みに する
 * （あとで 打っても「もう 見つけたよ」。点は 増えない）。
 */
export function preOpenListening(state: ListeningState, words: readonly string[]): ListeningState {
  let revealed = state.revealed;
  const used = [...state.usedInputs];
  for (const word of words) {
    const needle = normalizeReading(word);
    if (!needle) continue;
    revealed = revealWith(state.rawView, revealed, needle);
    if (!used.includes(needle)) used.push(needle);
  }
  return { ...state, revealed, usedInputs: used };
}

/** 台本を 1本の 文に つなぐ ときの 区切り（行の 境目は 開かない字ではなく、見える 記号として 扱う）。 */
export const LINE_JOIN = "\n";

/** 行ごとの 文の 始まりの 位置（`lines.join(LINE_JOIN)` の 中で）。 */
export function lineStarts(lines: readonly string[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + LINE_JOIN.length;
  }
  return starts;
}

/** その 行が 全部 開いているか。 */
export function isLineRevealed(state: ListeningState, start: number, text: string): boolean {
  for (let k = 0; k < text.length; k += 1) {
    if (isHideable(text[k]) && !state.revealed.has(start + k)) return false;
  }
  return true;
}

/** 前の 状態から 新しく 開いた 位置。 */
export function newlyRevealed(before: ListeningState, after: ListeningState): number[] {
  const out: number[] = [];
  for (const i of after.revealed) if (!before.revealed.has(i)) out.push(i);
  return out.sort((a, b) => a - b);
}

/** まだ 開いていない キーワード（書いた 字の 所が 1字でも かくれている もの）。 */
export function hiddenKeywords(state: ListeningState): string[] {
  return state.keywords.filter((kw) => {
    if (state.foundKeywords.includes(kw)) return false;
    let from = 0;
    for (;;) {
      const at = state.transcript.indexOf(kw, from);
      if (at < 0) return false;
      for (let k = 0; k < kw.length; k += 1) {
        if (isHideable(state.transcript[at + k]) && !state.revealed.has(at + k)) return true;
      }
      from = at + 1;
    }
  });
}

/** キーワードの 読み（ヒントで 出す。数字・英字は 聞き取り専用の 読みで）。 */
export function keywordReading(state: ListeningState, keyword: string): string {
  return readingForms(keyword, state.furigana, state.sounds)[0] ?? keyword;
}

/**
 * ヒントの 中身。1回目は「はじめの 1字と 字の 数」、同じ 言葉で 2回目は 読みを 全部。
 * `level` は 1 か 2。返す `masked` は「そ□□□」の 形。
 */
export function keywordHint(
  state: ListeningState,
  keyword: string,
  level: 1 | 2,
): { reading: string; masked: string; count: number } {
  const reading = keywordReading(state, keyword);
  const chars = [...reading];
  const masked = level === 2 ? reading : chars[0] + "□".repeat(Math.max(0, chars.length - 1));
  return { reading, masked, count: chars.length };
}

/** 文字が かくせる 字か（画面の 箱を 出すか）。 */
export function hideableChar(char: string | undefined): boolean {
  return isHideable(char);
}
