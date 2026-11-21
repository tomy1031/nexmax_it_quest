import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * 端末に保存するもの（localStorage）。顔写真だけは大きいので IndexedDB（src/lib/photo.ts）。
 * 版（version）を上げたら migrate を足す。保存のキーは変えない（学生の進み具合が消える）。
 */

export type Outfit = "suit" | "casual";
export type HairStyle = "model" | "spiky" | "side" | "bob" | "long" | "ponytail" | "twin" | "bun";
export type Figure = "m" | "f";

export interface AvatarConfig {
  outfit: Outfit;
  figure: Figure;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  glasses: boolean;
  /** 身長（cm）。モデルの大きさを、この高さに合わせる。 */
  height: number;
  /** 目の形（ちびキャラの顔）。 */
  eyes: "round" | "smile" | "sparkle" | "calm";
  /** ほっぺの赤み。 */
  blush: boolean;
  suit: string;
  shirt: string;
  tie: string;
  coat: string;
  pants: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  outfit: "casual",
  figure: "m",
  skin: "#c68e64",
  hair: "#1d1612",
  hairStyle: "model",
  glasses: false,
  height: 168,
  eyes: "round",
  blush: true,
  suit: "#2f3a5e",
  shirt: "#f4f6f8",
  tie: "#1f3f7a",
  coat: "#8a8f98",
  pants: "#3a3d44",
};

export interface Profile {
  name: string;
  nickname: string;
  hasPhoto: boolean;
}

export interface StageProgress {
  section?: string;
  cleared?: boolean;
  clearedAt?: string;
  /** 修了証の名前の横に出す日付（クリアした日）。 */
}

interface PersistedState {
  profile: Profile;
  avatar: AvatarConfig;
  stages: Record<string, StageProgress>;
  inventory: string[];
  icocaBalance: number;
  memo: string;
  /** 一度読んだ豆知識（ずかん）。 */
  tipsSeen: string[];
  /** 修了証の 報告の 文（学生が書いた文）。 */
  reportText: string;
}

interface GameState extends PersistedState {
  setProfile: (p: Partial<Profile>) => void;
  setAvatar: (a: Partial<AvatarConfig>) => void;
  setSection: (stageId: string, section: string) => void;
  clearStage: (stageId: string) => void;
  resetStage: (stageId: string) => void;
  give: (item: string) => void;
  has: (item: string) => boolean;
  charge: (yen: number) => void;
  setMemo: (memo: string) => void;
  seeTip: (id: string) => void;
  setReport: (text: string) => void;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      profile: { name: "", nickname: "", hasPhoto: false },
      avatar: DEFAULT_AVATAR,
      stages: {},
      inventory: [],
      icocaBalance: 0,
      memo: "",
      tipsSeen: [],
      reportText: "",
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setAvatar: (a) => set((s) => ({ avatar: { ...s.avatar, ...a } })),
      setSection: (stageId, section) =>
        set((s) => ({ stages: { ...s.stages, [stageId]: { ...s.stages[stageId], section } } })),
      clearStage: (stageId) =>
        set((s) => ({
          stages: {
            ...s.stages,
            [stageId]: {
              ...s.stages[stageId],
              cleared: true,
              clearedAt: new Date().toISOString(),
              section: undefined,
            },
          },
        })),
      resetStage: (stageId) =>
        set((s) => ({
          stages: { ...s.stages, [stageId]: { ...s.stages[stageId], section: undefined } },
        })),
      give: (item) =>
        set((s) => (s.inventory.includes(item) ? s : { inventory: [...s.inventory, item] })),
      has: (item) => get().inventory.includes(item),
      charge: (yen) => set((s) => ({ icocaBalance: Math.min(20000, s.icocaBalance + yen) })),
      setMemo: (memo) => set({ memo }),
      seeTip: (id) => set((s) => (s.tipsSeen.includes(id) ? s : { tipsSeen: [...s.tipsSeen, id] })),
      setReport: (reportText) => set({ reportText }),
    }),
    {
      name: "nexmax-it-quest:game",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // 版1 → 2: アバターに身長が増えた（無い人は決まった値）
      migrate: (persisted, version) => {
        const s = persisted as PersistedState;
        // 版2 → 3: ちびキャラの目とほっぺが増えた
        if (version < 3 && s?.avatar) s.avatar = { ...DEFAULT_AVATAR, ...s.avatar };
        return s;
      },
      partialize: (s): PersistedState => ({
        profile: s.profile,
        avatar: s.avatar,
        stages: s.stages,
        inventory: s.inventory,
        icocaBalance: s.icocaBalance,
        memo: s.memo,
        tipsSeen: s.tipsSeen,
        reportText: s.reportText,
      }),
    },
  ),
);

export type Quality = "normal" | "low";

interface SettingsState {
  /** Gemini の キー。この端末の中だけに置く（AGENTS.md 必ず守るルール4）。 */
  geminiKey: string;
  geminiOk: boolean;
  furigana: boolean;
  quality: Quality;
  textScale: 1 | 1.15 | 1.3;
  sound: boolean;
  setSettings: (s: Partial<Omit<SettingsState, "setSettings">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      geminiKey: "",
      geminiOk: false,
      furigana: true,
      quality: "normal",
      textScale: 1,
      sound: true,
      setSettings: (s) => set(s),
    }),
    {
      name: "nexmax-it-quest:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** カタカナ（と長音・中黒・空白）だけか。名前の欄のチェック。 */
export function isKatakanaName(name: string): boolean {
  return /^[ァ-ヶー・\s\u3000]+$/.test(name.trim()) && name.trim().length > 0;
}

/** タイトルの「スタート」を押せるか（必須の設定がそろったか）。 */
export function isSetupComplete(
  profile: Profile,
  opts: { loginRequired: boolean; loggedIn: boolean },
) {
  if (!isKatakanaName(profile.name) || profile.nickname.trim().length === 0) return false;
  if (opts.loginRequired && !opts.loggedIn) return false;
  return true;
}
