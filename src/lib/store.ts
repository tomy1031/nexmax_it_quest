import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * 端末に保存するもの（localStorage）。顔写真だけは大きいので IndexedDB（src/lib/photo.ts）。
 * 版（version）を上げたら migrate を足す。保存のキーは変えない（学生の進み具合が消える）。
 */

export type Outfit = "suit" | "casual" | "kigurumi" | "pajama";
/** 着ぐるみの どうぶつ（tomy さん 2026-11-23「服の中に着ぐるみをつくって」＋パンダ・かえる・しば犬）。 */
export type Kigurumi = "bear" | "cat" | "rabbit" | "panda" | "frog" | "shiba";
export type EyebrowStyle = "soft" | "thick" | "straight" | "gentle" | "arch" | "sharp";
export type NoseStyle = "dot" | "curve" | "triangle" | "button" | "dots" | "side";
export type MouthStyle = "smile" | "open" | "happy" | "cat" | "flat" | "pout" | "grin" | "soft";
export type CheekStyle = "none" | "round" | "oval" | "lines" | "freckles" | "gloss" | "heart";
export type FaceMark = "none" | "bandaid" | "star" | "mole";
export type HatStyle =
  | "none"
  | "cap"
  | "beanie"
  | "beret"
  | "bucket"
  | "headphones"
  | "catears"
  | "crown"
  | "flowerCrown";
export type GlassesStyle = "none" | "round" | "square" | "sunglasses" | "star" | "visor";
export type AccessoryStyle = "none" | "flower" | "ribbon" | "starClip" | "earrings" | "sprout";
export type NeckwearStyle = "none" | "krama" | "scarf" | "bowtie" | "lanyard";
export type BagStyle = "none" | "backpack" | "bearBag" | "wings" | "laptopBag";
export type CasualStyle = "hoodie" | "cardigan" | "tshirt" | "jacket";
export type HairStyle =
  | "model"
  | "spiky"
  | "side"
  | "wavy"
  | "curly"
  | "buzz"
  | "center"
  | "bob"
  | "long"
  | "ponytail"
  | "twin"
  | "bun"
  | "halfup"
  | "braid"
  | "twinbun"
  | "shichisan"
  | "allback"
  | "twoblock"
  | "mohawk"
  | "afro"
  | "sidetail"
  | "lowpony"
  | "hime"
  | "longwave"
  | "osage"
  | "swirl"
  | "messy"
  | "topknot"
  | "mash"
  | "wolf"
  | "tucked"
  | "pixie"
  | "lob"
  | "budtail"
  | "crown"
  | "perm"
  | "lowpuff"
  | "clipbob"
  | "headband";
export type Figure = "m" | "f";

export interface AvatarConfig {
  outfit: Outfit;
  figure: Figure;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  glasses: boolean;
  /** めがねの 形（無ければ glasses が true のとき round）。 */
  glassesStyle?: GlassesStyle;
  /** めがねの 色。 */
  glassesColor?: string;
  /** 身長（cm）。モデルの大きさを、この高さに合わせる。 */
  height: number;
  /** 目の形（ちびキャラの顔）。 */
  eyes:
    | "round"
    | "smile"
    | "sparkle"
    | "calm"
    | "small"
    | "gloss"
    | "flick"
    | "twinkle"
    | "heart"
    | "egg"
    | "lashes"
    | "roly"
    | "dot"
    | "sharp"
    | "bright"
    | "star"
    | "sleepy";
  /** 目の 色（無ければ もとの こげ茶）。 */
  eyeColor?: string;
  /** まゆの 形。 */
  eyebrow?: EyebrowStyle;
  /** 鼻の 形。 */
  nose?: NoseStyle;
  /** 口の 形。 */
  mouth?: MouthStyle;
  /** ほっぺの赤み（古い保存データとの互換用）。 */
  blush: boolean;
  /** ほっぺの 種類（無ければ blush に合わせる）。 */
  cheek?: CheekStyle;
  /** 顔の ワンポイント（ばんそうこう・ほし・ほくろ）。 */
  faceMark?: FaceMark;
  /** ぼうし・ヘッドホン。 */
  hat?: HatStyle;
  /** ぼうしの 色。 */
  hatColor?: string;
  /** 髪や 耳の かざり。 */
  accessory?: AccessoryStyle;
  /** 首もとの かざり（クロマー・マフラー・ちょうネクタイ・社員証）。 */
  neckwear?: NeckwearStyle;
  /** 首もとの 色。 */
  neckColor?: string;
  /** ふだんの服のときのリュック（古い保存データとの互換用）。 */
  bag?: boolean;
  /** バッグの 種類（無ければ bag に合わせる）。 */
  bagStyle?: BagStyle;
  /** バッグの 色。 */
  bagColor?: string;
  /** ふだんの服の 上着の形（パーカー・カーディガン・Tシャツ・ジャケット）。 */
  casualStyle?: CasualStyle;
  /** くつの形（無ければ、スーツは革ぐつ・ふだんの服はスニーカー）。 */
  shoeType?: "leather" | "sneaker" | "sandal";
  /** くつの色（無ければ、スーツは黒・ふだんの服は白）。 */
  shoes?: string;
  /** 寝巻きの色（tomy さん 2026-11-23「デフォルトは寝巻きにしてください」）。 */
  pajama?: string;
  /** 着ぐるみの どうぶつ（服が着ぐるみのとき）。 */
  kigurumi?: Kigurumi;
  /** 下の服（女性だけ選べる。無ければ、女性のスーツはスカート・ふだんの服はズボン。男性はいつもズボン）。 */
  bottom?: "pants" | "skirt";
  suit: string;
  shirt: string;
  tie: string;
  coat: string;
  pants: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  outfit: "pajama",
  pajama: "#a9cdeb",
  figure: "m",
  skin: "#c68e64",
  hair: "#4a3326",
  hairStyle: "model",
  glasses: false,
  glassesStyle: "none",
  glassesColor: "#2a2d35",
  height: 168,
  eyes: "round",
  eyebrow: "soft",
  nose: "dot",
  mouth: "smile",
  blush: true,
  cheek: "round",
  faceMark: "none",
  hat: "none",
  hatColor: "#3b6ea5",
  accessory: "none",
  neckwear: "none",
  neckColor: "#c83e4d",
  bag: true,
  bagStyle: "backpack",
  bagColor: "#2b2f37",
  casualStyle: "hoodie",
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
  /** 学校（AUPP / CADT）。空は まだ えらんでいない。academy の profiles.university と同じ値。 */
  university?: "" | "AUPP" | "CADT";
  /** 何期生（1〜5）。0 は まだ えらんでいない。academy の profiles.cohort と同じ値。 */
  cohort?: number;
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
  /** 定期券を買った日（YYYY-MM-DD）。券面の「〜から〜まで」に使う。 */
  passStart?: string;
}

interface GameState extends PersistedState {
  setProfile: (p: Partial<Profile>) => void;
  setAvatar: (a: Partial<AvatarConfig>) => void;
  setSection: (stageId: string, section: string) => void;
  clearStage: (stageId: string) => void;
  resetStage: (stageId: string) => void;
  /** 最初の場面から始めるとき、前に遊んだときの 持ち物・残高・定期券の日・報告を消す。 */
  resetRun: () => void;
  give: (item: string) => void;
  has: (item: string) => boolean;
  charge: (yen: number) => void;
  setMemo: (memo: string) => void;
  seeTip: (id: string) => void;
  setReport: (text: string) => void;
  setPassStart: (date: string) => void;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      profile: { name: "", nickname: "", hasPhoto: false, university: "", cohort: 0 },
      avatar: DEFAULT_AVATAR,
      stages: {},
      inventory: [],
      icocaBalance: 0,
      memo: "",
      tipsSeen: [],
      reportText: "",
      setPassStart: (date) => set({ passStart: date }),
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
      resetRun: () =>
        set({ inventory: [], icocaBalance: 0, passStart: undefined, reportText: "", memo: "" }),
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
        passStart: s.passStart,
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
  /** やることリストで、できたものを かくす。 */
  hideDoneTodos?: boolean;
  /** 右上のメモを大きく出す。 */
  memoBig?: boolean;
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
