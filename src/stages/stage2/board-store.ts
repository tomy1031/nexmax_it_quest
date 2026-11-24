import { create } from "zustand";

/**
 * 会議室A の ホワイトボード と 話している 人（3D の 場面と 画面の 部品が 読み書きする。保存しない）。
 * - known: 「わかった こと」を 出したか（台本の fx: board-known）
 * - opened: 開いた カード（必ず 聞く ことと ボーナス）の id
 * - selected: いま えらんでいる「？」カード（質問の 時間）
 * - pickable: ホワイトボードの カードを 押して えらべるか（質問の 時間の 番の とき）
 * - talking: いま 話している 人（"hendy" / "yamamoto" / チームの 人の id）。席の 人が「話す 動き」に なる
 */
export interface BoardState {
  known: boolean;
  opened: string[];
  selected: string | null;
  pickable: boolean;
  talking: string | null;
}

export const initialBoard: BoardState = {
  known: false,
  opened: [],
  selected: null,
  pickable: false,
  talking: null,
};

export const useBoard = create<BoardState>(() => initialBoard);

/** ホワイトボードの カードを 押した とき（画面の 札と 同じ 動き）。 */
export function pickCard(id: string): void {
  const s = useBoard.getState();
  if (!s.pickable || s.opened.includes(id)) return;
  useBoard.setState({ selected: s.selected === id ? null : id });
}
