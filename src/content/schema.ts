import { z } from "zod";

/**
 * 教材データの形（AGENTS.md 必ず守るルール5）。
 * `npm run lint:content` が content/ の JSON をここに通し、ふりがなの付け忘れも調べる。
 *
 * 学生が読む文は、どれも「文字だけ」で持つ。ふりがなは content/furigana.json から表示のときに付ける
 * （HTML のタグ・{漢字|よみ} のような書き方を弾く）。
 */

/** 学生が読む文。HTML や手書きのふりがなを入れさせない。 */
export const learnerText = z
  .string()
  .min(1)
  .refine(
    (s) => !/[<>{}|]/.test(s),
    "学生が読む文に < > { } | は使えない（ふりがなは辞書で付ける）",
  );

export const furiganaEntry = z.tuple([z.string().min(1), z.string().regex(/^[ぁ-ゖー・\s]+$/)]);
export const furiganaFile = z.object({
  $comment: z.string().optional(),
  entries: z.array(furiganaEntry),
});

/** 画面の言葉（ボタン・見出し・案内）。キーは「画面.場所」。 */
export const uiFile = z.object({
  $comment: z.string().optional(),
  text: z.record(z.string(), learnerText),
});

// ── 台本 ──────────────────────────────────────────────

export const speakerId = z.enum(["me", "nexmax", "hendy", "staff", "announce", "people", "phone"]);
export type SpeakerId = z.infer<typeof speakerId>;

export const sceneId = z.enum([
  "home",
  "street",
  "tennoji-concourse",
  "tennoji-platform",
  "train-midosuji",
  "hommachi",
  "hommachi-chuo",
  "train-chuo",
  "awaza",
]);
export type SceneId = z.infer<typeof sceneId>;

export const panelId = z.enum([
  "nmchat",
  "avatar",
  "routemap-quiz",
  "memo",
  "report",
  "certificate",
]);
export type PanelId = z.infer<typeof panelId>;

export const nexmaxPose = z.enum(["guide", "hello", "cheer", "listen", "book", "build"]);

type BeatShape =
  | { t: "say"; who: SpeakerId; text: string; pose?: z.infer<typeof nexmaxPose> }
  | { t: "objective"; text: string; target?: string; arrow?: boolean; hints?: string[] }
  | { t: "clear-objective" }
  | { t: "wait"; event: string; else?: Record<string, BeatShape[]> }
  | { t: "tip"; id: string }
  | {
      t: "choice";
      prompt: string;
      options: { text: string; correct?: boolean; then?: BeatShape[] }[];
    }
  | { t: "panel"; id: PanelId; mode?: string }
  | { t: "focus"; target: string }
  | { t: "unfocus" }
  | { t: "goto"; anchor: string }
  | { t: "fx"; id: string }
  | { t: "sfx"; id: string }
  | { t: "pause"; ms: number }
  | { t: "give"; item: string }
  | { t: "flag"; id: string }
  | { t: "jump"; to: string }
  | { t: "verdict"; ok: boolean; text: string }
  | { t: "dream"; items: { text: string; icon: string }[] }
  | { t: "end" };

export const beat: z.ZodType<BeatShape> = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({
      t: z.literal("say"),
      who: speakerId,
      text: learnerText,
      pose: nexmaxPose.optional(),
    }),
    z.object({
      t: z.literal("objective"),
      text: learnerText,
      target: z.string().optional(),
      arrow: z.boolean().optional(),
      hints: z.array(learnerText).max(3).optional(),
    }),
    z.object({ t: z.literal("clear-objective") }),
    z.object({
      t: z.literal("wait"),
      event: z.string(),
      /** ちがう出来事が来たときに流す台本（流したあと、また待つ。jump で場面ごとやり直せる）。 */
      else: z.record(z.string(), z.array(beat)).optional(),
    }),
    z.object({ t: z.literal("tip"), id: z.string() }),
    z.object({
      t: z.literal("choice"),
      prompt: learnerText,
      options: z
        .array(
          z.object({
            text: learnerText,
            correct: z.boolean().optional(),
            then: z.array(beat).optional(),
          }),
        )
        .min(2),
    }),
    z.object({ t: z.literal("panel"), id: panelId, mode: z.string().optional() }),
    z.object({ t: z.literal("focus"), target: z.string() }),
    z.object({ t: z.literal("unfocus") }),
    z.object({ t: z.literal("goto"), anchor: z.string() }),
    z.object({ t: z.literal("fx"), id: z.string() }),
    z.object({ t: z.literal("sfx"), id: z.string() }),
    z.object({ t: z.literal("pause"), ms: z.number().int().min(0).max(20000) }),
    z.object({ t: z.literal("give"), item: z.string() }),
    z.object({ t: z.literal("flag"), id: z.string() }),
    z.object({ t: z.literal("jump"), to: z.string() }),
    z.object({ t: z.literal("verdict"), ok: z.boolean(), text: learnerText }),
    z.object({
      t: z.literal("dream"),
      items: z.array(z.object({ text: learnerText, icon: z.string() })).min(1),
    }),
    z.object({ t: z.literal("end") }),
  ]),
);
export type Beat = BeatShape;

export const section = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  chapter: z.number().int().min(1),
  title: learnerText,
  scene: sceneId,
  spawn: z.string(),
  /** 場面の始めに、持っていないといけない物（途中から始めたときに補う）。 */
  requires: z.array(z.string()).optional(),
  beats: z.array(beat).min(1),
});
export type Section = z.infer<typeof section>;

export const stageFile = z.object({
  id: z.string(),
  title: learnerText,
  subtitle: learnerText,
  chapters: z.array(z.object({ no: z.number().int(), title: learnerText })),
  /** 修了証に載せる「きょうの ことば」。 */
  words: z.array(z.object({ word: learnerText, en: z.string() })),
  sections: z.array(section).min(1),
});
export type StageFile = z.infer<typeof stageFile>;

// ── 豆知識 ────────────────────────────────────────────

export const tip = z.object({
  id: z.string(),
  title: learnerText,
  /** 1文目（必ず読む）。 */
  text: learnerText,
  /** 「もっと」で出す2文目。 */
  more: learnerText.optional(),
  en: z.string(),
  /** 絵: 3D の部品を撮った絵か、ネクマックスの絵。 */
  image: z.string(),
  pose: nexmaxPose.optional(),
});
export const tipsFile = z.object({ $comment: z.string().optional(), tips: z.array(tip) });
export type Tip = z.infer<typeof tip>;

// ── NMChat ────────────────────────────────────────────

export const chatMessage = z.object({
  from: z.enum(["hendy", "nexmax", "me", "system", "yamada", "tanaka"]),
  time: z.string(),
  lines: z.array(learnerText).min(1),
});
export const chatFile = z.object({
  $comment: z.string().optional(),
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      topic: learnerText,
      messages: z.array(chatMessage),
    }),
  ),
});
export type ChatFile = z.infer<typeof chatFile>;

// ── 路線（大阪メトロの一部） ───────────────────────────

export const metroFile = z.object({
  $comment: z.string().optional(),
  lines: z.array(
    z.object({
      id: z.string(),
      letter: z.string().length(1),
      name: learnerText,
      en: z.string(),
      color: z.string().regex(/^#[0-9a-f]{6}$/),
      /** 路線図の上での並び（駅の id）。 */
      stations: z.array(z.string()),
    }),
  ),
  stations: z.array(
    z.object({
      id: z.string(),
      name: learnerText,
      en: z.string(),
      numbers: z.array(z.string()),
      /** 路線図の座標（0〜100）。 */
      x: z.number(),
      y: z.number(),
      /** 名前を出す向き。 */
      label: z.enum(["left", "right", "top", "bottom"]).default("right"),
      weekend: z.object({ text: learnerText, icon: z.string() }).optional(),
    }),
  ),
});
export type MetroFile = z.infer<typeof metroFile>;

// ── 駅のホーム・のりかえの看板 ─────────────────────────

const signTone = z.enum(["navy", "yellow", "white"]);
const arrowDir = z.enum(["left", "right", "up", "down"]);

export const placesFile = z.object({
  $comment: z.string().optional(),
  platforms: z.array(
    z.object({
      id: z.string(),
      station: z.string(),
      line: z.string(),
      prev: z.string().optional(),
      next: z.string().optional(),
      tracks: z.array(
        z.object({
          side: z.enum(["left", "right"]),
          track: z.number().int(),
          direction: learnerText,
          en: z.string(),
          led: z.array(z.object({ kind: learnerText, time: z.string(), dest: learnerText })).min(1),
        }),
      ),
    }),
  ),
  transfer: z.array(
    z.object({
      id: z.string(),
      lines: z.array(z.string()),
      text: learnerText,
      en: z.string(),
      tone: signTone,
      arrow: arrowDir.optional(),
      /** 出口の番号（黄色の看板の黒い四角）。 */
      number: z.number().int().positive().optional(),
    }),
  ),
  trainNext: z.record(z.string(), z.array(learnerText)),
});
export type PlacesFile = z.infer<typeof placesFile>;

// ── 主要キャラの見た目 ─────────────────────────────────

export const charactersFile = z.object({
  $comment: z.string().optional(),
  characters: z.array(
    z.object({
      id: z.string(),
      name: learnerText,
      look: z.object({
        outfit: z.enum(["suit", "casual"]),
        figure: z.enum(["m", "f"]),
        skin: z.string(),
        hair: z.string(),
        hairStyle: z.enum(["model", "spiky", "side", "bob", "long", "ponytail", "twin", "bun"]),
        glasses: z.boolean(),
        height: z.number().min(140).max(200),
        eyes: z.enum(["round", "smile", "sparkle", "calm"]).optional(),
        blush: z.boolean().optional(),
        suit: z.string(),
        shirt: z.string(),
        tie: z.string(),
        coat: z.string(),
        pants: z.string(),
      }),
    }),
  ),
});
