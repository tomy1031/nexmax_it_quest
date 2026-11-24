import { meetingFile, type MeetingCard, type MeetingFile } from "@/content/schema";

export type { MeetingCard, MeetingFile };

/** content/meetings/*.json を 全部 読む（形は zod で たしかめる）。 */
const files = import.meta.glob("../../../content/meetings/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const MEETINGS = new Map<string, MeetingFile>();
for (const raw of Object.values(files)) {
  const m = meetingFile.parse(raw);
  MEETINGS.set(m.id, m);
}

export function meetingContent(id: string): MeetingFile | undefined {
  return MEETINGS.get(id);
}

/** 必ず 聞く こと（ホワイトボードの「？」カード）。 */
export function mustCards(m: MeetingFile): MeetingCard[] {
  return m.cards;
}

/** かくれた ボーナス。 */
export function bonusCards(m: MeetingFile): MeetingCard[] {
  return m.bonus;
}

/** 必ず 聞く こと・ボーナスの どちらでも。 */
export function cardById(m: MeetingFile, id: string): MeetingCard | undefined {
  return m.cards.find((c) => c.id === id) ?? m.bonus.find((c) => c.id === id);
}

export function isBonus(m: MeetingFile, id: string): boolean {
  return m.bonus.some((c) => c.id === id);
}
