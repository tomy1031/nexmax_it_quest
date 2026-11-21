import { create } from "zustand";

/**
 * いまの場面の「地図」。場面の部品が書き、プレイヤー・カメラ・目印が読む。
 * - anchors: 名前のある地点（はじめに立つ所・行き先の輪）
 * - walk: 歩ける四角（XZ）。この外へは出ない（物理エンジンは使わない。VR のテレポート先にも使う）
 * - shots: 「アップ」のカメラの位置（台本の focus）
 * - triggers: 近づくと reach:<id> を出す所
 * - targets: 目印（矢印）を出す位置（クリックできる物・地点の id → 位置）
 */
export type V3 = [number, number, number];

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Shot {
  pos: V3;
  look: V3;
  fov?: number;
}

export interface Trigger {
  id: string;
  x: number;
  z: number;
  r: number;
}

export interface Layout {
  anchors: Record<string, { pos: V3; yaw?: number }>;
  walk: Rect[];
  shots: Record<string, Shot>;
  triggers: Trigger[];
  targets: Record<string, V3>;
  /** カメラ: 後ろから追う／決まった位置。 */
  camera: { mode: "follow"; distance?: number; height?: number } | { mode: "fixed"; shot: Shot };
  /** 自分の姿を出すか（電車の中など、決まったカメラの場面）。 */
  showPlayer: boolean;
  /** カメラが出てはいけない範囲の内がわ（かべの外に出ない）。 */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number };
}

export const emptyLayout: Layout = {
  anchors: {},
  walk: [],
  shots: {},
  triggers: [],
  targets: {},
  camera: { mode: "follow" },
  showPlayer: true,
};

export const useLayout = create<Layout>(() => emptyLayout);

/** 点を、歩ける四角のどれかの中へ寄せる（いちばん近い所）。 */
export function clampToWalk(x: number, z: number, walk: Rect[]): [number, number] {
  if (walk.length === 0) return [x, z];
  let best: [number, number] = [x, z];
  let bestD = Infinity;
  for (const r of walk) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x));
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = [cx, cz];
    }
  }
  return best;
}

export function insideWalk(x: number, z: number, walk: Rect[]): boolean {
  return (
    walk.length === 0 || walk.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
  );
}
