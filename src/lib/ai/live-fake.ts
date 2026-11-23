import type { LiveConn, LiveEvent } from "@/lib/ai/live";

/**
 * にせの Gemini Live（e2e の テストと 開発の 道具だけで 使う。本番では 使わない）。
 * マイクも キーも 無い ところで、会話の 流れ（押す → 聞きとった 文字 → 相手の 返事）を ためす。
 *
 * テストは window.__fakeLive = { answers: ["おはようございます", ...] } を 置く。
 * 話しおわる（talkEnd）たびに、answers を 1つずつ「聞きとった 文字」として 返し、相手が みじかく 返事を する。
 * 進行の 合図（prompt）には、合図の 中の「」の 文を 相手の 返事として 返す。
 */
export interface FakeLiveScript {
  answers: string[];
  /** 相手の 返事（無ければ OK）。 */
  reply?: string;
}

export function openFakeLive(script: FakeLiveScript, emit: (e: LiveEvent) => void): LiveConn {
  let closed = false;
  const later = (fn: () => void, ms: number) =>
    window.setTimeout(() => {
      if (!closed) fn();
    }, ms);
  const respond = (text: string) => {
    later(() => emit({ type: "speaking", on: true }), 60);
    later(() => emit({ type: "said", text }), 120);
    later(() => emit({ type: "speaking", on: false }), 200);
    later(() => emit({ type: "turn" }), 240);
  };
  return {
    talkStart() {},
    talkEnd() {
      const heard = script.answers.shift() ?? "";
      later(() => {
        if (heard) emit({ type: "heard", text: heard });
      }, 40);
      respond(script.reply ?? "OK");
    },
    prompt(text: string) {
      const quoted = /「([^」]+)」/.exec(text)?.[1];
      respond(quoted ?? "OK");
    },
    hush() {},
    close() {
      closed = true;
    },
  };
}
