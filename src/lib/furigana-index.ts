import furiganaJson from "@content/furigana.json";
import { create } from "zustand";
import { buildFuriganaIndex, type FuriganaEntry, type FuriganaIndex } from "@/lib/text/furigana";

/**
 * アプリ全体で使う読み方のデータ（content/furigana.json）の索引。
 * 画面（RubyText）も 3D の看板（text-canvas）も、ここだけを使う。同じ字に同じ読みが出る。
 */
const BASE_ENTRIES = furiganaJson.entries as unknown as FuriganaEntry[];
export const FURIGANA: FuriganaIndex = buildFuriganaIndex(BASE_ENTRIES);

/**
 * あとから決まる読み（管理者が決める先生の名前 など）。データ（DB の設定）から来るので、手書きのルビではない。
 * 足すと、画面のふりがな（RubyText）が この読みも使う。
 */
const useExtra = create<{ entries: FuriganaEntry[]; index: FuriganaIndex }>(() => ({
  entries: [],
  index: FURIGANA,
}));

export function setRuntimeReadings(entries: FuriganaEntry[]): void {
  const clean = entries.filter(([base, reading]) => base.trim() && reading.trim());
  const same =
    clean.length === useExtra.getState().entries.length &&
    clean.every((e, i) => {
      const o = useExtra.getState().entries[i]!;
      return o[0] === e[0] && o[1] === e[1];
    });
  if (same) return;
  useExtra.setState({
    entries: clean,
    index: clean.length ? buildFuriganaIndex([...BASE_ENTRIES, ...clean]) : FURIGANA,
  });
}

/** 画面で使う索引（データ＋あとから決まる読み）。 */
export function useFuriganaIndex(): FuriganaIndex {
  return useExtra((s) => s.index);
}
