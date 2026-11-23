import { describe, expect, it } from "vitest";
import type { StageFile } from "@/content/schema";

// runner は ブラウザの window.setTimeout を使う（テストは node で動くので、同じものを置く）
(globalThis as unknown as { window: typeof globalThis }).window ??= globalThis;

/** 待つ前に起きた 券売機の合図（チャージした）を 取っておく（tomy さん 2026-11-23）。 */
describe("券売機の合図を 取っておく", () => {
  it("説明の とちゅうで チャージしても、あとの「チャージを待つ」で もう一度 言われない", async () => {
    const { questEvents } = await import("@/stages/events");
    const { usePlay } = await import("@/stages/play-store");
    const { StageRunner } = await import("@/stages/runner");
    const stage = {
      id: "t",
      title: "t",
      subtitle: "t",
      chapters: [{ no: 1, title: "t" }],
      words: [],
      sections: [
        {
          id: "s1",
          chapter: 1,
          title: "t",
          scene: "home",
          spawn: "bed",
          beats: [
            { t: "pause", ms: 30 },
            { t: "wait", event: "ticket:charged" },
            { t: "flag", id: "ok" },
          ],
        },
      ],
    } as unknown as StageFile;
    const runner = new StageRunner({ stage, fast: true });
    const done = runner.run();
    questEvents.emit("scene:ready");
    // 「待つ」の前に チャージした
    questEvents.emit("ticket:charged");
    await new Promise((r) => setTimeout(r, 200));
    expect(usePlay.getState().waitingFor).toBeNull();
    runner.stop();
    await done.catch(() => undefined);
  });
});
