/**
 * 質問の 見かた（端末の 中で 決める。AI には 決めさせない）。設計 03_ステージ2.md §4-3。
 *
 * 聞きとった 質問と キーワードを、どちらも 読み（ひらがな）と 字の 両方に そろえて くらべる。
 * 読みは アプリの 読み方の データ（FURIGANA）から 作る。
 */
import { FURIGANA } from "@/lib/furigana-index";
import { annotateRuby } from "@/lib/text/furigana";
import { normalizeJa } from "@/lib/voice-check";
import { cardById, isBonus, type MeetingCard, type MeetingFile } from "./content";
import type { Judgement, TurnResult } from "./types";

/** これより 短い 読みの 質問は `unclear`。 */
const MIN_KANA = 5;
const ANSWER = "%answer%";

/** 漢字を 読みに 直し（読みの 無い 漢字は そのまま）、カタカナ・空白・記号を そろえる。 */
export function readingOf(text: string): string {
  const kana = annotateRuby(text, FURIGANA)
    .map((s) => s.reading ?? s.text)
    .join("");
  return normalizeJa(kana);
}

interface Norm {
  raw: string;
  kana: string;
}
const norm = (text: string): Norm => ({ raw: normalizeJa(text), kana: readingOf(text) });

function hit(h: Norm, keyword: string): boolean {
  const k = norm(keyword);
  return (
    (k.raw.length > 0 && h.raw.includes(k.raw)) || (k.kana.length > 0 && h.kana.includes(k.kana))
  );
}
const hits = (h: Norm, keywords: readonly string[]) => keywords.filter((k) => hit(h, k)).length;

/** いちばん 多く 当たった もの（同じ 数が 2つ 以上なら tie）。 */
function best<T>(items: readonly T[], score: (t: T) => number, min: number) {
  let top: T | undefined;
  let topScore = 0;
  let tie = false;
  for (const it of items) {
    const s = score(it);
    if (s < min) continue;
    if (s > topScore) {
      top = it;
      topScore = s;
      tie = false;
    } else if (s === topScore) tie = true;
  }
  return { top, score: topScore, tie };
}

function cardResult(
  m: MeetingFile,
  card: MeetingCard,
  opened: readonly string[],
  deep: boolean,
): Judgement {
  if (opened.includes(card.id)) return { result: "known", cardId: card.id, deep };
  return { result: isBonus(m, card.id) ? "bonus" : "new", cardId: card.id, deep };
}

export function judgeQuestion(
  m: MeetingFile,
  heard: string,
  ctx: { selected?: string | null; opened: string[] },
): Judgement {
  const h = norm(heard);
  const deep = m.deepMarkers.some((k) => hit(h, k));
  if (h.kana.length < MIN_KANA) return { result: "unclear", deep };

  const all = [...m.cards, ...m.bonus];
  const scores = new Map(all.map((c) => [c.id, hits(h, c.keywords)]));

  // 1. えらんだ カードの キーワードが 1つ 以上
  const selected = ctx.selected ? cardById(m, ctx.selected) : undefined;
  if (selected && (scores.get(selected.id) ?? 0) >= 1) {
    return cardResult(m, selected, ctx.opened, deep);
  }

  // 2. いちばん 多く 当たった カード（2つ 以上）と、わかった こと・相談中の こと（1つ 以上）
  const card = best(all, (c) => scores.get(c.id) ?? 0, 2);
  const known = best(m.known, (k) => hits(h, k.keywords), 1);
  const undecided = best(m.undecided, (u) => hits(h, u.keywords), 1);
  const side = known.score >= undecided.score ? known : undecided;

  if (card.top && card.score >= side.score) {
    if (card.tie) return { result: "pending", deep };
    return cardResult(m, card.top, ctx.opened, deep);
  }
  if (known.top && known.score > undecided.score && !known.tie) {
    return { result: "known", knownId: known.top.id, deep };
  }
  if (undecided.top && undecided.score > known.score && !undecided.tie) {
    return { result: "undecided", undecidedId: undecided.top.id, deep };
  }
  return { result: "pending", deep };
}

/** `pending` の ときに、お客さまの 返事（文字起こし）から 決める。 */
export function judgeReply(m: MeetingFile, reply: string, ctx: { opened: string[] }): Judgement {
  const h = norm(reply);
  const deep = false;
  const all = [...m.cards, ...m.bonus];
  const card = best(all, (c) => hits(h, c.markers), 1);
  if (card.top && !card.tie) return cardResult(m, card.top, ctx.opened, deep);

  const rm = m.replyMarkers;
  const order: [TurnResult, readonly string[]][] = [
    ["known", rm.known],
    ["undecided", rm.undecided],
    ["offTopic", rm.offTopic],
    ["unclear", rm.unclear],
  ];
  for (const [result, markers] of order) {
    if (markers.some((k) => hit(h, k))) return { result, deep };
  }
  return { result: "offTopic", deep };
}

/** お客さまの 決まった 返事（声の 言い方が 少し ちがっても、この 文が 正）。 */
export function replyText(m: MeetingFile, j: Judgement): string {
  switch (j.result) {
    case "new":
    case "bonus":
      return (j.cardId && cardById(m, j.cardId)?.secret) || "";
    case "known": {
      if (j.knownId) {
        const k = m.known.find((x) => x.id === j.knownId);
        if (k) return m.replies.known.replace(ANSWER, k.answer);
      }
      const card = j.cardId ? cardById(m, j.cardId) : undefined;
      // もう 開いた カード: 「さきほど お話ししましたが、」＋ カードの 答え
      if (card) return m.replies.known.split(ANSWER)[0] + card.secret;
      return m.replies.known.split(ANSWER)[0]!.trim();
    }
    case "undecided":
      return m.replies.undecided;
    case "offTopic":
      return m.replies.offTopic;
    case "unclear":
      return m.replies.unclear;
    default:
      return "";
  }
}

/** 1回ごとの ひとこと（学生へ）。 */
export function feedbackText(m: MeetingFile, j: Judgement): string {
  if (j.result === "pending") return "";
  if (j.result === "bonus") {
    const praise = j.cardId ? cardById(m, j.cardId)?.praise : undefined;
    return praise ? `${m.feedback.bonus} ${praise}` : m.feedback.bonus;
  }
  return m.feedback[j.result];
}

/** 「なぜ」「どんな」で 聞いた ときの ほめる ひとこと（答えが あった とき だけ）。 */
export function deepNote(m: MeetingFile, j: Judgement): string | null {
  if (!j.deep) return null;
  if (j.result === "pending" || j.result === "unclear" || j.result === "offTopic") return null;
  return m.feedback.deep;
}
