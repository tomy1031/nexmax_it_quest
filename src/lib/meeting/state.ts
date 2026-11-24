/** ミーティング 1回分の 進み方（回数・番の 回り方・開いた カード）。設計 03_ステージ2.md §4-5・6。 */
import type { MeetingCard, MeetingFile } from "./content";
import type { Judgement, MeetingMember, TeamMeetingState, TurnLog } from "./types";

export function initMeeting(meetingId: string, members: MeetingMember[]): TeamMeetingState {
  return {
    meetingId,
    members: [...members],
    turn: 0,
    slotsUsed: 0,
    unclearStreak: 0,
    opened: {},
    undecided: [],
    log: [],
    done: false,
  };
}

export function currentMember(s: TeamMeetingState): MeetingMember {
  return s.members[s.turn % Math.max(1, s.members.length)]!;
}

const nextTurn = (s: TeamMeetingState) => (s.turn + 1) % Math.max(1, s.members.length);

/**
 * 1回分を 足す。答えが あった 質問（new・bonus・known・offTopic・undecided）は 1回 使って 次の 人へ。
 * `unclear`（と、決まらなかった `pending`）は 回数を 使わず 同じ 人が 言い直す。2回 つづいたら 次の 人へ。
 */
export function applyTurn(
  s: TeamMeetingState,
  m: MeetingFile,
  t: { q: string; a: string; j: Judgement },
): TeamMeetingState {
  if (s.done) return s;
  const by = currentMember(s).id;
  const result = t.j.result === "pending" ? "unclear" : t.j.result;
  const entry: TurnLog = { by, q: t.q, a: t.a, result };
  if (t.j.cardId) entry.cardId = t.j.cardId;
  if (t.j.deep) entry.deep = true;
  const log = [...s.log, entry];

  if (result === "unclear") {
    const streak = s.unclearStreak + 1;
    return streak >= 2
      ? { ...s, log, unclearStreak: 0, turn: nextTurn(s) }
      : { ...s, log, unclearStreak: streak };
  }

  const opened = { ...s.opened };
  if ((result === "new" || result === "bonus") && t.j.cardId && !opened[t.j.cardId]) {
    opened[t.j.cardId] = { by, q: t.q };
  }
  const undecided =
    result === "undecided" && t.j.undecidedId && !s.undecided.includes(t.j.undecidedId)
      ? [...s.undecided, t.j.undecidedId]
      : s.undecided;
  const next: TeamMeetingState = {
    ...s,
    log,
    opened,
    undecided,
    slotsUsed: s.slotsUsed + 1,
    unclearStreak: 0,
    turn: nextTurn(s),
  };
  next.done = next.slotsUsed >= m.slots || m.cards.every((c) => next.opened[c.id]);
  return next;
}

export function slotsLeft(s: TeamMeetingState, m: MeetingFile): number {
  return Math.max(0, m.slots - s.slotsUsed);
}

export function minutesLeft(s: TeamMeetingState, m: MeetingFile): number {
  return slotsLeft(s, m) * m.minutesPerSlot;
}

const openedMust = (s: TeamMeetingState, m: MeetingFile) =>
  m.cards.filter((c) => s.opened[c.id]).length;

/** 開いた 必ず 聞く カードの 数で 星（result.stars の しきい）。 */
export function stars(s: TeamMeetingState, m: MeetingFile): 0 | 1 | 2 | 3 {
  const n = openedMust(s, m);
  const [one, two, three] = m.result.stars;
  if (n >= three) return 3;
  if (n >= two) return 2;
  if (n >= one) return 1;
  return 0;
}

/** 聞けなかった 必ず 聞く カード。 */
export function missedCards(s: TeamMeetingState, m: MeetingFile): MeetingCard[] {
  return m.cards.filter((c) => !s.opened[c.id]);
}

/** だれが いくつ 聞いたか（答えが あった 質問の 数）。 */
export function askedCount(s: TeamMeetingState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(s.members.map((x) => [x.id, 0]));
  for (const l of s.log) if (l.result !== "unclear") out[l.by] = (out[l.by] ?? 0) + 1;
  return out;
}

/** 「聞いた こと」の メモの 1行（開いた カードの 名前と 短い 答え。必ず 聞く → ボーナスの 順）。 */
export function memoText(s: TeamMeetingState, m: MeetingFile): string {
  return [...m.cards, ...m.bonus]
    .filter((c) => s.opened[c.id])
    .map((c) => `${c.label}: ${c.short}`)
    .join(" / ");
}
