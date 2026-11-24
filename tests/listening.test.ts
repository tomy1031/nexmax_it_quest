import { describe, expect, it } from "vitest";
import hendyJson from "../content/listenings/hendy-speech.json";
import aobaJson from "../content/listenings/aoba-kickoff.json";
import talksJson from "../content/talks.json";
import { listeningFile, talksFile } from "../src/content/schema";
import { FURIGANA } from "../src/lib/furigana-index";
import {
  hiddenKeywords,
  isLineRevealed,
  keywordHint,
  lineStarts,
  newlyRevealed,
  preOpenListening,
  createListening,
  revealRate,
  submitListening,
} from "../src/lib/listening/checks";
import { startListening, transcriptOf } from "../src/lib/listening/content";
import { kanaOf } from "../src/lib/text/furigana";
import { matchedGroups } from "../src/lib/voice-check";

const hendy = listeningFile.parse(hendyJson);
const aoba = listeningFile.parse(aobaJson);

describe("虫食い（preOpen）", () => {
  it("はじめから 文の 終わりが 開いて、中身の 言葉は かくれている", () => {
    const s = startListening(hendy);
    const t = transcriptOf(hendy);
    const starts = lineStarts(hendy.script.map((l) => l.text));
    // 3行目「1つ目は、あいさつです。」: です は 見え、あいさつ は かくれる
    const line = hendy.script[2]!.text;
    const at = starts[2]!;
    const desu = line.indexOf("です");
    expect(s.revealed.has(at + desu)).toBe(true);
    expect(s.revealed.has(at + line.indexOf("あいさつ"))).toBe(false);
    expect(t.slice(at, at + line.length)).toBe(line);
    // 点は 増えない
    expect(s.score).toBe(0);
    expect(revealRate(s)).toBeGreaterThan(0);
    expect(revealRate(s)).toBeLessThan(hendy.revealGoal);
  });

  it("漢字の 語の 中の 読みでは 開けない（書いた 字の 所だけ）", () => {
    const fresh = createListening("会議です。", ["会議"], { minLength: 2, maxMiss: 5 }, FURIGANA);
    const s = preOpenListening(fresh, ["かい"]);
    expect(s.revealed.has(0)).toBe(false);
  });

  it("開けた 言葉を 打つと「もう 見つけたよ」（点なし・ミスでない）", () => {
    const s = submitListening(startListening(hendy), "ください");
    expect(s.log[0]?.kind).toBe("repeat");
    expect(s.misses).toBe(0);
  });
});

describe("ヘンディさんの お話で 当てる", () => {
  it("キーワードは 漢字でも かなでも 見つかり、全部の 場所が 開く", () => {
    for (const kw of hendy.keywords) {
      const byKanji = submitListening(startListening(hendy), kw);
      expect(byKanji.foundKeywords, kw).toContain(kw);
      const kana = keywordHint(startListening(hendy), kw, 2).reading;
      const byKana = submitListening(startListening(hendy), kana);
      expect(byKana.foundKeywords, `${kw}→${kana}`).toContain(kw);
    }
  });

  it("「じかん」で 2つ目の 文の「時間」が 開く（よみで せいかい）", () => {
    const before = startListening(hendy);
    const after = submitListening(before, "じかん");
    expect(after.log[0]?.kind).toBe("hiragana");
    const t = transcriptOf(hendy);
    const at = t.indexOf("時間");
    expect(newlyRevealed(before, after)).toEqual(expect.arrayContaining([at, at + 1]));
  });

  it("数字の 語も 聞いた とおりに 打てる（ごふんまえ・みっつめ）", () => {
    expect(submitListening(startListening(hendy), "ごふんまえ").foundKeywords).toContain("5分前");
    expect(submitListening(startListening(hendy), "みっつめ").log[0]?.kind).toBe("partial");
  });

  it("本文に ない 言葉・ローマ字・とちゅうまで を 見分ける", () => {
    expect(submitListening(startListening(hendy), "りんご").log[0]?.kind).toBe("miss");
    expect(submitListening(startListening(hendy), "aisatsu").log[0]?.kind).toBe("romaji");
    const partway = submitListening(startListening(hendy), "あいさつしない");
    expect(["partway", "close"]).toContain(partway.log[0]?.kind);
  });

  it("ヒント: 1回目は はじめの 1字と 字の 数、2回目は 読みを 全部", () => {
    const s = startListening(hendy);
    expect(keywordHint(s, "相談", 1)).toEqual({
      reading: "そうだん",
      masked: "そ□□□",
      count: 4,
    });
    expect(keywordHint(s, "相談", 2).masked).toBe("そうだん");
    expect(hiddenKeywords(s)).toContain("相談");
    expect(hiddenKeywords(submitListening(s, "相談"))).not.toContain("相談");
  });

  it("入れた 言葉で つづきから（開いた 所が 同じ）", () => {
    const played = ["あいさつ", "じかん", "相談"].reduce(submitListening, startListening(hendy));
    const resumed = startListening(hendy, ["あいさつ", "じかん", "相談"]);
    expect(revealRate(resumed)).toBe(revealRate(played));
    expect(resumed.misses).toBe(0);
  });

  it("文を かなで 打てば 全部の 文が 開く（数字は 聞いた とおりの 読みで）", () => {
    let s = startListening(hendy);
    const t = transcriptOf(hendy);
    for (const line of hendy.script) {
      const spelled = hendy.sounds.reduce((x, [w, r]) => x.replaceAll(w, r), line.text);
      const kana = kanaOf(spelled, FURIGANA);
      expect(kana, line.text).not.toBeNull();
      s = submitListening(s, kana!);
    }
    const starts = lineStarts(hendy.script.map((l) => l.text));
    const closed = hendy.script.filter((l, i) => !isLineRevealed(s, starts[i]!, l.text));
    expect(closed.map((l) => l.text)).toEqual([]);
    expect(t.length).toBeGreaterThan(0);
  });
});

describe("リスニングの データ", () => {
  it.each([hendy, aoba])("$id: キーワード・preOpen・sounds の 字が 台本に ある", (file) => {
    const t = transcriptOf(file);
    for (const kw of file.keywords) expect(t, kw).toContain(kw);
    for (const [w] of file.sounds) expect(t, w).toContain(w);
    for (const work of file.works) {
      if (work.kind !== "situation") continue;
      for (const item of work.items) {
        expect(item.line).toBeLessThan(file.script.length);
        expect(item.options.filter((o) => o.correct)).toHaveLength(1);
      }
    }
  });

  it("aoba-kickoff: 話す人が 2人で、sort の ワークが ある", () => {
    expect(aoba.participants.map((p) => p.id)).toEqual(["hendy", "yamamoto"]);
    expect(aoba.works[0]?.kind).toBe("sort");
    const s = submitListening(startListening(aoba), "ぼしゅう");
    expect(s.foundKeywords).toContain("募集");
    expect(submitListening(startListening(aoba), "さんじゅっぷん").foundKeywords).toContain("30分");
  });
});

describe("声で 言う（speech-check）", () => {
  const talk = talksFile.parse(talksJson).talks.find((x) => x.id === "speech-check")!;
  const step = talk.steps[0]!;
  it("あいさつ・時間・相談の どれかが 入っていれば 合格", () => {
    if (step.kind !== "answer" || !step.check) throw new Error("check の ある answer のはず");
    expect(matchedGroups("あいさつです", step.check)).toBe(1);
    expect(matchedGroups("時間です。", step.check)).toBe(1);
    expect(matchedGroups("そうだんです", step.check)).toBe(1);
    expect(matchedGroups("わかりません", step.check)).toBe(0);
  });
});
