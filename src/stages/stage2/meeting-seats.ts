import type { V3 } from "@/three/layout";

/** 会議室A の テーブルと 席（3D の 場面と、リスニングの 部品を つなぐ ときに 使う）。 */
export const TABLE = { minX: -0.55, maxX: 0.55, minZ: -2.1, maxZ: 1.7 };
export const ROWS = [-1.5, -0.6, 0.3, 1.2];
export const LEFT_X = -1.0;
export const RIGHT_X = 1.0;

/** 席（いすの 位置と、座った 人の 向き）。 */
export const SEATS: Record<string, { pos: V3; yaw: number }> = {
  yamamoto: { pos: [LEFT_X, 0, ROWS[0]!], yaw: Math.PI / 2 },
  hendy: { pos: [RIGHT_X, 0, ROWS[0]!], yaw: -Math.PI / 2 },
  me: { pos: [RIGHT_X, 0, ROWS[2]!], yaw: -Math.PI / 2 },
  team1: { pos: [LEFT_X, 0, ROWS[2]!], yaw: Math.PI / 2 },
  team2: { pos: [RIGHT_X, 0, ROWS[3]!], yaw: -Math.PI / 2 },
  team3: { pos: [LEFT_X, 0, ROWS[3]!], yaw: Math.PI / 2 },
};

/**
 * リスニング（ヘンディさんと 山本社長の 会話）の 話す 人の id → 席に 座って いる 人。
 * あとで ListeningBoard3D を つなぐ ときに 使う（話す 人を「話す 動き」に する: useBoard.setState({ talking: id })）。
 */
export const MEETING_SPEAKERS = {
  hendy: SEATS.hendy!,
  yamamoto: SEATS.yamamoto!,
} as const;
export type MeetingSpeakerId = keyof typeof MEETING_SPEAKERS;
export function speakerSeat(id: string): { pos: V3; yaw: number } | null {
  return id === "hendy" || id === "yamamoto" ? MEETING_SPEAKERS[id] : null;
}
