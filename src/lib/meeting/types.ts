/** お客さまとの ミーティング（質問の 時間）の 形。設計 docs/design/03_ステージ2.md §2・§4。 */

export type TurnResult = "new" | "bonus" | "known" | "undecided" | "offTopic" | "unclear";

export interface MeetingMember {
  id: string;
  name: string;
}

export interface TurnLog {
  by: string;
  q: string;
  a: string;
  result: TurnResult;
  cardId?: string;
  deep?: boolean;
}

export interface TeamMeetingState {
  meetingId: string;
  /** 順番（1人目は 自分）。 */
  members: MeetingMember[];
  /** 次に 話す 人（members の 番号）。 */
  turn: number;
  /** 使った 質問の 回数。 */
  slotsUsed: number;
  /** 同じ 人が つづけて `unclear` に なった 回数。 */
  unclearStreak: number;
  /** 開いた カード（必ず 聞く こと・ボーナス）。 */
  opened: Record<string, { by: string; q: string }>;
  /** 「まだ 相談中」と 言われた こと（undecided の id）。 */
  undecided: string[];
  log: TurnLog[];
  done: boolean;
}

export interface Judgement {
  /** `pending` は 端末だけでは 決まらない（お客さまの 返事で judgeReply が 決める）。 */
  result: TurnResult | "pending";
  cardId?: string;
  knownId?: string;
  undecidedId?: string;
  deep: boolean;
}
