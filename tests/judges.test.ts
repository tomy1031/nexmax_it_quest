import { describe, expect, it } from "vitest";
import { isKatakanaName } from "@/lib/store";
import { reportOk } from "@/ui/hud/ReportPanel";

/** 書く練習の判定は学生に有利に（漢字・かな・ローマ字のどれでも通す）。 */
describe("ヘンディさんへの連絡", () => {
  it.each([
    "阿波座駅に 着きました。",
    "あわざえきに つきました",
    "いま つきました！",
    "Arrived at Awaza",
  ])("%s は通る", (t) => {
    expect(reportOk(t)).toBe(true);
  });
  it.each(["", "はい", "おはようございます"])("%s は通らない", (t) => {
    expect(reportOk(t)).toBe(false);
  });
});

describe("名前はカタカナ", () => {
  it.each(["ソク ピセット", "ソピア", "ピア・ソク"])("%s は通る", (n) =>
    expect(isKatakanaName(n)).toBe(true),
  );
  it.each(["", "sok", "そく", "ソク1"])("%s は通らない", (n) =>
    expect(isKatakanaName(n)).toBe(false),
  );
});

import { expressionOf } from "@/three/expression";

describe("セリフの文から表情を決める", () => {
  it.each([
    ["あっ、点滅して いる！", "surprised"],
    ["あれ？ ずっと 赤の ままだ。", "surprised"],
    ["うーん…… 何の 音？", "thinking"],
    ["7時だ。今日は 大事な 日！", "happy"],
    ["地下の 駅だ。", "normal"],
  ])("%s → %s", (text, want) => {
    expect(expressionOf(text)).toBe(want);
  });
});
