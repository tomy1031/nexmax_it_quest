import * as THREE from "three";
import { FURIGANA } from "@/lib/furigana-index";
import { annotateRuby } from "@/lib/text/furigana";
import { useSettings } from "@/lib/store";

/**
 * 看板工場: 文字を Canvas に描き、3D に貼る。ふりがなは画面と同じ読み方のデータから付ける
 * （AGENTS.md 必ず守るルール2。本物の看板にふりがなは無いので、ネクマックスの「AR 表示」としてシアンで重ねる）。
 *
 * 文字は画像に焼かずデータから描くので、VR でも読める・直せば全部の看板が直る。
 * フォントは読みこみを待ってから描く（待たないと別の字体がテクスチャに焼き付く）。
 */

export const FONT_FAMILY = `"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Noto Sans JP", sans-serif`;
export const AR_RUBY = "#5ff3ff";

const loaded = new Set<string>();
export async function ensureFont(text: string): Promise<void> {
  const key = text;
  if (loaded.has(key) || typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`800 40px "M PLUS Rounded 1c"`, text),
      document.fonts.load(`700 40px "M PLUS Rounded 1c"`, text),
    ]);
  } catch {
    /* 読めなくても、ある字体で描く */
  }
  loaded.add(key);
}

export interface RubyDrawOptions {
  size: number;
  color: string;
  rubyColor?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  /** ふりがなを付けるか（設定の「ふりがな なし」でも、学生の設定に合わせる）。 */
  ruby?: boolean;
  shadow?: string;
}

function font(size: number, weight: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** ふりがなつきの1行の幅。 */
export function measureRuby(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: RubyDrawOptions,
): number {
  ctx.font = font(o.size, o.weight ?? 800);
  return ctx.measureText(text).width;
}

/**
 * ふりがなつきで1行を描く。y は文字の下端（ベースライン）。ふりがなはその上に乗る。
 * ふりがなが漢字より長いときは、ふりがなの字を細めて漢字の幅に収める。
 */
export function drawRuby(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: RubyDrawOptions,
): number {
  const weight = o.weight ?? 800;
  const showRuby = (o.ruby ?? true) && useSettings.getState().furigana;
  const segments = showRuby ? annotateRuby(text, FURIGANA) : [{ text }];
  ctx.font = font(o.size, weight);
  const total = ctx.measureText(text).width;
  let cx = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const seg of segments) {
    ctx.font = font(o.size, weight);
    const w = ctx.measureText(seg.text).width;
    if (o.shadow) {
      ctx.shadowColor = o.shadow;
      ctx.shadowBlur = o.size * 0.15;
    }
    ctx.fillStyle = o.color;
    ctx.fillText(seg.text, cx, y);
    ctx.shadowBlur = 0;
    if (seg.reading) {
      const rs = o.size * 0.42;
      ctx.font = font(rs, 800);
      const rw = ctx.measureText(seg.reading).width;
      const sx = rw > w ? w / rw : 1;
      ctx.save();
      ctx.translate(cx + w / 2, y - o.size * 0.86);
      ctx.scale(sx, 1);
      ctx.fillStyle = o.rubyColor ?? o.color;
      ctx.textAlign = "center";
      ctx.fillText(seg.reading, 0, 0);
      ctx.restore();
    }
    cx += w;
  }
  return total;
}

/** Canvas から 3D 用のテクスチャを作る（色の空間・ミップマップを決めておく）。 */
export function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 線のマーク（丸に M・C など）。色だけでなく文字でも見分けられるようにする（色覚への配慮）。 */
export function drawLineBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  letter: string,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = r * 0.22;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = font(r * 1.15, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, cx, cy + r * 0.05);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: "left" | "right" | "up" | "down",
  color: string,
) {
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(0, -size * 0.45);
  ctx.lineTo(0, -size * 0.18);
  ctx.lineTo(-size * 0.5, -size * 0.18);
  ctx.lineTo(-size * 0.5, size * 0.18);
  ctx.lineTo(0, size * 0.18);
  ctx.lineTo(0, size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
