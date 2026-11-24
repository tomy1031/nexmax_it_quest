import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * いま 遊んでいる リスニングの 様子（画面の パネル・3D の 大きな 画面・話す 人の 動きが 読む）。
 * パネルが 書き、3D は 読むだけ。保存は しない（入れた 言葉は useListeningSaves に 保存する）。
 */
export type ListeningPhase = "intro" | "listen" | "review" | "works" | "done";

export interface ListeningStageState {
  /** いま 開いている リスニングの id（無ければ null）。 */
  id: string | null;
  phase: ListeningPhase | null;
  /** いま 読んでいる（見ている）文の 番号。 */
  line: number;
  /** その 文を 話す 人の id。 */
  speaker: string | null;
  /** 声が 鳴っているか（話す 人の 動き）。 */
  speaking: boolean;
  /** 開いた 位置（台本 全体の 中の 位置）。 */
  revealed: ReadonlySet<number>;
  /** 新しく 開いた 位置と その 時刻（浮かび上がる 光）。 */
  flash: { positions: readonly number[]; at: number } | null;
  /** その 文を 全部 開いて 出すか（こたえあわせ）。 */
  showAll: boolean;
}

export const initialListeningStage: ListeningStageState = {
  id: null,
  phase: null,
  line: 0,
  speaker: null,
  speaking: false,
  revealed: new Set(),
  flash: null,
  showAll: false,
};

export const useListeningStage = create<ListeningStageState>(() => initialListeningStage);

/** 入れた 言葉（リスニングごと）。開いた 場所では なく 言葉を 保存する（台本を 直しても ずれない）。 */
export const useListeningSaves = create<{
  inputs: Record<string, string[]>;
  setInputs: (id: string, inputs: string[]) => void;
}>()(
  persist(
    (set) => ({
      inputs: {},
      setInputs: (id, inputs) => set((s) => ({ inputs: { ...s.inputs, [id]: inputs } })),
    }),
    {
      name: "nexmax-it-quest:listening",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
