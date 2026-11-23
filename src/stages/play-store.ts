import { create } from "zustand";
import type { SceneId, SpeakerId, PanelId } from "@/content/schema";

/**
 * いま遊んでいるステージの画面の状態（保存しない）。runner が書き、画面の部品と 3D の場面が読む。
 * 毎フレーム変わる値（人の位置など）はここに入れない。
 */
export interface Line {
  who: SpeakerId;
  text: string;
  pose?: string;
}

export interface Objective {
  text: string;
  target?: string;
  arrow: boolean;
  hints: string[];
  lines: string[];
}

/** 自動で書くメモの1つ（タイトルと くわしい文）。 */
export interface MemoItem {
  id: string;
  title: string;
  text: string;
}

/** やることリストの1つ。 */
export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface PlayState {
  stageId: string;
  sectionId: string;
  chapter: number;
  scene: SceneId | null;
  spawn: string;
  /** 場面を作り直すための番号（同じ場面へ jump したときも作り直す）。 */
  sceneKey: number;
  line: Line | null;
  objective: Objective | null;
  hintLevel: number;
  choice: { prompt: string; options: string[] } | null;
  tip: string | null;
  panel: { id: PanelId; mode?: string } | null;
  verdict: { ok: boolean; text: string } | null;
  dream: { text: string; icon: string; x?: number; y?: number }[] | null;
  /** 思いうかべる場面の絵（なければ絵文字を出す）。 */
  dreamImage: string | null;
  focus: string | null;
  chapterBanner: number | null;
  log: Line[];
  ended: boolean;
  /** いま待っている合図（テストと開発の道具が使う）。 */
  waitingFor: string | null;
  /** やることリスト（台本の todo-add で足し、todo-done で横線）。 */
  todos: Todo[];
  /** 自動で書くメモ（台本の memo-add）。 */
  memos: MemoItem[];
}

export const initialPlay: PlayState = {
  stageId: "",
  sectionId: "",
  chapter: 1,
  scene: null,
  spawn: "",
  sceneKey: 0,
  line: null,
  objective: null,
  hintLevel: 0,
  choice: null,
  tip: null,
  panel: null,
  verdict: null,
  dream: null,
  dreamImage: null,
  focus: null,
  chapterBanner: null,
  log: [],
  ended: false,
  waitingFor: null,
  todos: [],
  memos: [],
};

export const usePlay = create<PlayState>(() => initialPlay);

/** runner が待っている「学生の操作」を、画面の部品から解く。 */
export const waits: {
  next: (() => void) | null;
  choice: ((i: number) => void) | null;
  panel: ((result?: unknown) => void) | null;
  tip: (() => void) | null;
} = { next: null, choice: null, panel: null, tip: null };

export const playActions = {
  advance(): void {
    const w = waits.next;
    waits.next = null;
    w?.();
  },
  choose(i: number): void {
    const w = waits.choice;
    waits.choice = null;
    w?.(i);
  },
  closePanel(result?: unknown): void {
    const w = waits.panel;
    waits.panel = null;
    w?.(result);
  },
  closeTip(): void {
    const w = waits.tip;
    waits.tip = null;
    w?.();
  },
};
