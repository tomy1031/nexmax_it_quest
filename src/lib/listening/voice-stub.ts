import { isDevTools } from "@/lib/env";

/**
 * 仮の 声（本物の src/lib/listening/voice.ts が 入るまでの 代わり。同じ 形）。
 * テスト（window.__fakeLive が ある とき）だけ 動き、1文を みじかい 時間で「再生した」ことに する。
 */
export type LineVoiceError = "noKey" | "key" | "model" | "network";
export interface LineVoiceState {
  index: number;
  status: "preparing" | "playing" | "ended" | "error";
  error?: LineVoiceError;
}
export interface LineVoiceOptions {
  lines: { speaker: string; text: string }[];
  voices: Record<string, string | undefined>;
  apiKey: string;
  onState?: (s: LineVoiceState) => void;
}
export interface LineVoice {
  play(index: number, rate: number): Promise<void>;
  prefetch(index: number): void;
  stop(): void;
  setRate(rate: number): void;
  useBrowserVoice(on: boolean): void;
  hasBrowserVoice(): boolean;
  dispose(): void;
}

export class LineVoiceFailure extends Error {
  constructor(readonly reason: LineVoiceError) {
    super(reason);
  }
}

export function createLineVoice(opts: LineVoiceOptions): LineVoice {
  let timer: number | null = null;
  let cancel: (() => void) | null = null;
  const fake = isDevTools && typeof window !== "undefined" && Boolean(window.__fakeLive);
  return {
    play(index, rate) {
      this.stop();
      if (!fake) {
        opts.onState?.({ index, status: "error", error: opts.apiKey ? "model" : "noKey" });
        return Promise.reject(new LineVoiceFailure(opts.apiKey ? "model" : "noKey"));
      }
      opts.onState?.({ index, status: "playing" });
      return new Promise<void>((resolve, reject) => {
        cancel = () => reject(new Error("stopped"));
        timer = window.setTimeout(() => {
          cancel = null;
          opts.onState?.({ index, status: "ended" });
          resolve();
        }, 260 / rate);
      });
    },
    prefetch() {},
    stop() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      cancel?.();
      cancel = null;
    },
    setRate() {},
    useBrowserVoice() {},
    hasBrowserVoice: () => false,
    dispose() {
      this.stop();
    },
  };
}
