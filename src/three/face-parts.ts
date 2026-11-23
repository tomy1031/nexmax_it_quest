import atlasJson from "@/three/face-atlas.json";

/**
 * 顔のパーツの絵（Codex で作った表を scripts/cut_face_parts.py で切り出したもの。public/img/face/）。
 * 表は 6列x4行。face_eyes … 行が目の形（まる・キラキラ・おだやか・小さい）、列が
 *   ひらく・とじる・にこにこ・びっくり・考える・ねむい。
 * face_mouth … 1行目 まゆ（灰色で描いてあるので髪の色にぬる）・2行目 鼻・3〜4行目 口。
 * face_cheeks … 1行目 ほっぺ・2行目 しるし（あせ・なみだ など）。
 * 絵は「キャラの右の目・まゆ」（見る人の左）。反対がわは左右に反転して使う。
 */

export type FaceBox = [x: number, y: number, w: number, h: number];
interface Sheet {
  kind: "eyes" | "mouth" | "cheeks";
  url: string;
  w: number;
  h: number;
  cells: (FaceBox | null)[][];
}

export const FACE_ATLAS = atlasJson as unknown as Record<string, Sheet>;
const BASE = import.meta.env.BASE_URL;

const images = new Map<string, HTMLImageElement>();
let ready = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function faceAtlasReady(): boolean {
  return ready;
}

/** 絵が そろったら呼ぶ（顔をかき直すため）。 */
export function onFaceAtlas(fn: () => void): void {
  listeners.add(fn);
}

export function faceSheetUrl(name: string): string {
  return `${BASE}${FACE_ATLAS[name]?.url ?? ""}`;
}

/** 表の絵を読みこむ（1回だけ）。 */
export function loadFaceAtlas(): Promise<void> {
  if (loading) return loading;
  if (typeof Image === "undefined") return Promise.resolve();
  loading = Promise.all(
    Object.keys(FACE_ATLAS).map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(name, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = faceSheetUrl(name);
        }),
    ),
  ).then(() => {
    ready = images.size > 0;
    if (ready) listeners.forEach((fn) => fn());
  });
  return loading;
}

export function faceCell(sheet: string, col: number, row: number): FaceBox | null {
  return FACE_ATLAS[sheet]?.cells[row]?.[col] ?? null;
}

const tintCache = new Map<string, HTMLCanvasElement>();

function tinted(sheet: string, box: FaceBox, color: string): CanvasImageSource | null {
  const img = images.get(sheet);
  if (!img) return null;
  const key = `${sheet}|${box.join(",")}|${color}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = box[2];
  c.height = box[3];
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(img, box[0], box[1], box[2], box[3], 0, 0, box[2], box[3]);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, box[2], box[3]);
  tintCache.set(key, c);
  return c;
}

export interface PartOptions {
  /** 左右に反転する（反対がわの目・まゆ・ほっぺ）。 */
  mirror?: boolean;
  /** この マスの絵の中心を基準にする（目の とじる・にこにこ を、ひらいた目と同じ所に置く）。 */
  anchor?: [col: number, row: number];
  /** 色をぬりかえる（まゆを髪の色に、など）。 */
  tint?: string;
  alpha?: number;
  /** 横の ちぢめ（球に貼ると横に のびるので、少し ちぢめて描く）。 */
  squash?: number;
}

/** パーツを1つ描く。(x, y) が基準の中心、s は 表の 1px → 顔の絵の px。 */
export function drawFacePart(
  ctx: CanvasRenderingContext2D,
  sheet: string,
  col: number,
  row: number,
  x: number,
  y: number,
  s: number,
  o: PartOptions = {},
): void {
  const box = faceCell(sheet, col, row);
  const img = images.get(sheet);
  if (!box || !img) return;
  // 基準のマスの絵の中心と、この絵の中心の ずれ（どちらも、それぞれのマスの中での位置で くらべる）
  const sh = FACE_ATLAS[sheet]!;
  const cw = sh.w / 6;
  const ch = sh.h / 4;
  const [ac, ar] = o.anchor ?? [col, row];
  const ref = faceCell(sheet, ac, ar) ?? box;
  const sx = s * (o.squash ?? 0.88);
  const sy = s;
  const dx = (box[0] + box[2] / 2 - col * cw - (ref[0] + ref[2] / 2 - ac * cw)) * sx;
  const dy = (box[1] + box[3] / 2 - row * ch - (ref[1] + ref[3] / 2 - ar * ch)) * sy;
  const w = box[2] * sx;
  const h = box[3] * sy;
  ctx.save();
  ctx.translate(x, y);
  if (o.mirror) ctx.scale(-1, 1);
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.tint) {
    const src = tinted(sheet, box, o.tint);
    if (src) ctx.drawImage(src, dx - w / 2, dy - h / 2, w, h);
  } else {
    ctx.drawImage(img, box[0], box[1], box[2], box[3], dx - w / 2, dy - h / 2, w, h);
  }
  ctx.restore();
}
