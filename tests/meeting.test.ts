import { describe, expect, it } from "vitest";
import {
  applyTurn,
  askedCount,
  bonusCards,
  cardById,
  currentMember,
  deepNote,
  feedbackText,
  initMeeting,
  judgeQuestion,
  judgeReply,
  meetingContent,
  memoText,
  minutesLeft,
  missedCards,
  mustCards,
  replyText,
  slotsLeft,
  stars,
  type Judgement,
  type TeamMeetingState,
} from "../src/lib/meeting";

const m = meetingContent("aoba-kickoff")!;
const members = [
  { id: "a", name: "ソク" },
  { id: "b", name: "ソピア" },
];
const none = { opened: [] as string[] };

describe("ミーティングの 教材", () => {
  it("読める・カードが そろう", () => {
    expect(m).toBeDefined();
    expect(mustCards(m)).toHaveLength(8);
    expect(bonusCards(m)).toHaveLength(4);
    expect(cardById(m, "budget")?.short).toBe("50万円");
    expect(cardById(m, "why")?.praise).toBeTruthy();
    expect(cardById(m, "nope")).toBeUndefined();
    expect(meetingContent("nope")).toBeUndefined();
  });
});

describe("質問の 見かた（教材の tests）", () => {
  for (const t of m.tests) {
    it(`${t.say} → ${t.card ?? t.result}`, () => {
      const j = judgeQuestion(m, t.say, none);
      if (t.card) {
        expect(j.cardId).toBe(t.card);
        const bonus = bonusCards(m).some((c) => c.id === t.card);
        expect(j.result).toBe(bonus ? "bonus" : "new");
      }
      if (t.result) expect(j.result).toBe(t.result);
    });
  }

  it("かなだけ・カタカナでも 当たる", () => {
    expect(judgeQuestion(m, "きゅうりょうは いくらですか", none).cardId).toBe("pay");
    expect(judgeQuestion(m, "ノウキは いつですか", none).cardId).toBe("deadline");
  });

  it("わかった ことの id・相談中の id が 付く", () => {
    expect(judgeQuestion(m, "新しい店はどこですか", none).knownId).toBe("where");
    expect(judgeQuestion(m, "写真はありますか", none).undecidedId).toBe("photo");
    expect(judgeQuestion(m, "休みは何日ですか", none)).toMatchObject({
      result: "undecided",
      undecidedId: "holiday",
    });
  });

  it("もう 開いた カードを また 聞くと known", () => {
    const j = judgeQuestion(m, "給料はいくらですか", { opened: ["pay"] });
    expect(j).toMatchObject({ result: "known", cardId: "pay" });
    expect(replyText(m, j)).toContain("30万円");
    expect(replyText(m, j).startsWith("さきほど")).toBe(true);
  });

  it("えらんだ カードは キーワード 1つで 当たる", () => {
    expect(judgeQuestion(m, "予算はどうですか", none).result).toBe("pending");
    expect(judgeQuestion(m, "予算はどうですか", { selected: "budget", opened: [] })).toMatchObject({
      result: "new",
      cardId: "budget",
    });
    // えらんだ カードに 1つも 当たらなければ、ふつうの 見かた
    expect(
      judgeQuestion(m, "給料はいくらですか", { selected: "deadline", opened: [] }).cardId,
    ).toBe("pay");
  });

  it("短い 質問は unclear", () => {
    expect(judgeQuestion(m, "いつ？", none).result).toBe("unclear");
    expect(judgeQuestion(m, "", none).result).toBe("unclear");
  });

  it("深い 質問の 印", () => {
    const j = judgeQuestion(m, "なぜプノンペンに店を出しますか", none);
    expect(j.deep).toBe(true);
    expect(deepNote(m, j)).toBe(m.feedback.deep);
    const plain = judgeQuestion(m, "給料はいくらですか", none);
    expect(plain.deep).toBe(false);
    expect(deepNote(m, plain)).toBeNull();
  });

  it("決まらない ときは pending → 返事で 決める", () => {
    const j = judgeQuestion(m, "社長は何さいですか", none);
    expect(j.result).toBe("pending");
    expect(replyText(m, j)).toBe("");
    expect(feedbackText(m, j)).toBe("");
    expect(judgeReply(m, m.replies.offTopic, none).result).toBe("offTopic");
    expect(judgeReply(m, m.replies.undecided, none).result).toBe("undecided");
    expect(judgeReply(m, m.replies.unclear, none).result).toBe("unclear");
    expect(judgeReply(m, "予算は 50万円です。", none)).toMatchObject({
      result: "new",
      cardId: "budget",
    });
    expect(judgeReply(m, "みなさんの 笑顔が 忘れられません。", none)).toMatchObject({
      result: "bonus",
      cardId: "why",
    });
    expect(judgeReply(m, "予算は 50万円です。", { opened: ["budget"] }).result).toBe("known");
    expect(judgeReply(m, "さきほど お話ししましたが、プノンペンです。", none).result).toBe("known");
    expect(judgeReply(m, "ええと。", none).result).toBe("offTopic");
  });
});

describe("返事と ひとこと", () => {
  it("カードの 答え・わかった こと・決まった 返事", () => {
    expect(replyText(m, { result: "new", cardId: "budget", deep: false })).toBe(
      cardById(m, "budget")!.secret,
    );
    expect(replyText(m, { result: "known", knownId: "where", deep: false })).toBe(
      "さきほど お話ししましたが、プノンペンです。",
    );
    expect(replyText(m, { result: "undecided", deep: false })).toBe(m.replies.undecided);
    expect(replyText(m, { result: "offTopic", deep: false })).toBe(m.replies.offTopic);
    expect(replyText(m, { result: "unclear", deep: false })).toBe(m.replies.unclear);
  });

  it("ひとこと（ボーナスは ほめる 文も）", () => {
    expect(feedbackText(m, { result: "new", cardId: "pay", deep: false })).toBe(m.feedback.new);
    expect(feedbackText(m, { result: "bonus", cardId: "why", deep: false })).toBe(
      `${m.feedback.bonus} ${cardById(m, "why")!.praise}`,
    );
    expect(feedbackText(m, { result: "known", deep: false })).toBe(m.feedback.known);
    expect(deepNote(m, { result: "unclear", deep: true })).toBeNull();
    expect(deepNote(m, { result: "offTopic", deep: true })).toBeNull();
  });
});

describe("進み方（回数・番）", () => {
  const ask = (s: TeamMeetingState, j: Partial<Judgement> & Pick<Judgement, "result">) =>
    applyTurn(s, m, { q: "q", a: "a", j: { deep: false, ...j } });

  it("はじめ", () => {
    const s = initMeeting("aoba-kickoff", members);
    expect(currentMember(s).id).toBe("a");
    expect(slotsLeft(s, m)).toBe(10);
    expect(minutesLeft(s, m)).toBe(30);
    expect(s.done).toBe(false);
  });

  it("答えが あった 質問は 1回 使って 次の 人へ", () => {
    let s = initMeeting("aoba-kickoff", members);
    s = ask(s, { result: "new", cardId: "pay" });
    expect(s.slotsUsed).toBe(1);
    expect(currentMember(s).id).toBe("b");
    expect(s.opened.pay).toEqual({ by: "a", q: "q" });
    s = ask(s, { result: "offTopic" });
    expect(currentMember(s).id).toBe("a");
    s = ask(s, { result: "undecided", undecidedId: "photo" });
    s = ask(s, { result: "undecided", undecidedId: "photo" });
    expect(s.undecided).toEqual(["photo"]);
    expect(s.slotsUsed).toBe(4);
    expect(minutesLeft(s, m)).toBe(18);
  });

  it("unclear は 回数を 使わない。2回 つづくと 次の 人へ", () => {
    let s = initMeeting("aoba-kickoff", members);
    s = ask(s, { result: "unclear" });
    expect(s.slotsUsed).toBe(0);
    expect(currentMember(s).id).toBe("a");
    s = ask(s, { result: "unclear" });
    expect(s.slotsUsed).toBe(0);
    expect(currentMember(s).id).toBe("b");
    expect(s.unclearStreak).toBe(0);
    s = ask(s, { result: "unclear" });
    s = ask(s, { result: "known", knownId: "where" });
    expect(s.unclearStreak).toBe(0);
    expect(currentMember(s).id).toBe("a");
    expect(askedCount(s)).toEqual({ a: 0, b: 1 });
  });

  it("回数が 0 で おわり", () => {
    let s = initMeeting("aoba-kickoff", members);
    for (let i = 0; i < 10; i += 1) s = ask(s, { result: "offTopic" });
    expect(s.done).toBe(true);
    expect(slotsLeft(s, m)).toBe(0);
    expect(ask(s, { result: "new", cardId: "pay" })).toBe(s);
    expect(stars(s, m)).toBe(0);
    expect(missedCards(s, m)).toHaveLength(8);
  });

  it("8まい 全部 開いて おわり・星・メモ", () => {
    let s = initMeeting("aoba-kickoff", members);
    const ids = mustCards(m).map((c) => c.id);
    s = ask(s, { result: "bonus", cardId: "why" });
    ids.slice(0, 5).forEach((id) => (s = ask(s, { result: "new", cardId: id })));
    expect(stars(s, m)).toBe(1);
    s = ask(s, { result: "new", cardId: ids[5] });
    expect(stars(s, m)).toBe(1);
    s = ask(s, { result: "new", cardId: ids[6] });
    expect(stars(s, m)).toBe(2);
    expect(missedCards(s, m).map((c) => c.id)).toEqual([ids[7]]);
    expect(s.done).toBe(false);
    s = ask(s, { result: "new", cardId: ids[7] });
    expect(stars(s, m)).toBe(3);
    expect(s.done).toBe(true);
    expect(s.slotsUsed).toBe(9);
    const memo = memoText(s, m);
    expect(memo.startsWith("ページの 目的: ")).toBe(true);
    expect(memo).toContain("予算: 50万円");
    expect(memo.endsWith("なぜ プノンペン？: カンボジアの 人の 笑顔が 忘れられない")).toBe(true);
    expect(askedCount(s)).toEqual({ a: 5, b: 4 });
  });

  it("pending の まま 入れると unclear あつかい", () => {
    const s = ask(initMeeting("aoba-kickoff", members), { result: "pending" });
    expect(s.slotsUsed).toBe(0);
    expect(s.log[0]!.result).toBe("unclear");
  });
});
