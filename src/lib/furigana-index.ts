import furiganaJson from "@content/furigana.json";
import { buildFuriganaIndex, type FuriganaEntry, type FuriganaIndex } from "@/lib/text/furigana";

/**
 * アプリ全体で使う読み方のデータ（content/furigana.json）の索引。
 * 画面（RubyText）も 3D の看板（text-canvas）も、ここだけを使う。同じ字に同じ読みが出る。
 */
export const FURIGANA: FuriganaIndex = buildFuriganaIndex(
  furiganaJson.entries as unknown as FuriganaEntry[],
);
