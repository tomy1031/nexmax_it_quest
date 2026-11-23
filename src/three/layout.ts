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
  camera:
    | {
        mode: "follow";
        distance?: number;
        height?: number;
        /** 向きを決めておく（自分の向きで回らない。家の中など）。0 なら +z から -z を見る。 */
        yaw?: number;
      }
    | { mode: "fixed"; shot: Shot };
  /**
   * 入れない四角（家具など。体が めりこまないように）。歩ける四角の中でも、ここには入らない。
   * 体の太さの分（BODY_R）だけ ひろげて判定する。
   */
  blocks?: Rect[];
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

/** 体の太さ（家具の四角を この分 ひろげて、体が めりこまないようにする）。 */
export const BODY_R = 0.2;

function inBlock(x: number, z: number, blocks: Rect[] | undefined, pad = BODY_R): boolean {
  if (!blocks) return false;
  return blocks.some(
    (b) => x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad,
  );
}

export function insideWalk(x: number, z: number, walk: Rect[], blocks?: Rect[]): boolean {
  const inWalk =
    walk.length === 0 || walk.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  return inWalk && !inBlock(x, z, blocks);
}

/** a から b まで まっすぐ歩けるか（とちゅうを こまかく調べる）。 */
function clearLine(ax: number, az: number, bx: number, bz: number, walk: Rect[], blocks?: Rect[]) {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08));
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    if (!insideWalk(ax + (bx - ax) * t, az + (bz - az) * t, walk, blocks)) return false;
  }
  return true;
}

/**
 * 家具を よけて歩く道（ます目の上で いちばん近い道をさがし、まっすぐ行ける所は まとめる）。
 * もどり値は とちゅうの地点の ならび（さいごが行き先）。行けないときは null。
 */
export function findPath(
  from: [number, number],
  to: [number, number],
  walk: Rect[],
  blocks?: Rect[],
): [number, number][] | null {
  if (!blocks?.length) return [to];
  if (clearLine(from[0], from[1], to[0], to[1], walk, blocks)) return [to];
  const C = 0.12;
  const minX = Math.min(...walk.map((r) => r.minX));
  const maxX = Math.max(...walk.map((r) => r.maxX));
  const minZ = Math.min(...walk.map((r) => r.minZ));
  const maxZ = Math.max(...walk.map((r) => r.maxZ));
  const W = Math.ceil((maxX - minX) / C) + 1;
  const H = Math.ceil((maxZ - minZ) / C) + 1;
  const cx = (i: number) => minX + i * C;
  const cz = (j: number) => minZ + j * C;
  const ok = new Uint8Array(W * H);
  for (let j = 0; j < H; j += 1)
    for (let i = 0; i < W; i += 1) ok[j * W + i] = insideWalk(cx(i), cz(j), walk, blocks) ? 1 : 0;
  const cell = (x: number, z: number) => {
    let bi = -1;
    let bd = Infinity;
    // いちばん近い 歩ける ます目
    const i0 = Math.round((x - minX) / C);
    const j0 = Math.round((z - minZ) / C);
    for (let r = 0; r < 12 && bi < 0; r += 1)
      for (let j = j0 - r; j <= j0 + r; j += 1)
        for (let i = i0 - r; i <= i0 + r; i += 1) {
          if (i < 0 || j < 0 || i >= W || j >= H || !ok[j * W + i]) continue;
          const d = (cx(i) - x) ** 2 + (cz(j) - z) ** 2;
          if (d < bd) {
            bd = d;
            bi = j * W + i;
          }
        }
    return bi;
  };
  const s = cell(from[0], from[1]);
  const g = cell(to[0], to[1]);
  if (s < 0 || g < 0) return null;
  // A*（8方向）
  const cost = new Float32Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const open: number[] = [s];
  cost[s] = 0;
  const hx = (k: number) => Math.hypot((k % W) - (g % W), Math.floor(k / W) - Math.floor(g / W));
  const done = new Uint8Array(W * H);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k += 1)
      if (cost[open[k]!]! + hx(open[k]!) < cost[open[bi]!]! + hx(open[bi]!)) bi = k;
    const cur = open.splice(bi, 1)[0]!;
    if (cur === g) break;
    if (done[cur]) continue;
    done[cur] = 1;
    const ci = cur % W;
    const cj = Math.floor(cur / W);
    for (let dj = -1; dj <= 1; dj += 1)
      for (let di = -1; di <= 1; di += 1) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = nj * W + ni;
        if (!ok[nk] || done[nk]) continue;
        // ななめは、となりの2つも歩けるときだけ（角を すりぬけない）
        if (di && dj && (!ok[cj * W + ni] || !ok[nj * W + ci])) continue;
        const c = cost[cur]! + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[nk]!) {
          cost[nk] = c;
          prev[nk] = cur;
          open.push(nk);
        }
      }
  }
  if (prev[g]! < 0 && g !== s) return null;
  const cells: [number, number][] = [];
  for (let k = g; k !== s && k >= 0; k = prev[k]!)
    cells.unshift([cx(k % W), cz(Math.floor(k / W))]);
  if (cells.length === 0) return [to];
  if (insideWalk(to[0], to[1], walk, blocks)) cells[cells.length - 1] = to;
  // まっすぐ行ける所は まとめる
  const out: [number, number][] = [];
  let ax = from[0];
  let az = from[1];
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m -= 1)
      if (clearLine(ax, az, cells[m]![0], cells[m]![1], walk, blocks)) {
        far = m;
        break;
      }
    out.push(cells[far]!);
    ax = cells[far]![0];
    az = cells[far]![1];
    k = far + 1;
  }
  return out;
}
