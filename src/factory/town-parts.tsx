import { useMemo } from "react";
import { t, type UiKey } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { box, FLAT, merge } from "@/factory/kit";
import { Prop, type Recolor } from "@/factory/props";
import { drawRuby, FONT_FAMILY } from "@/factory/text-canvas";

/**
 * 町の看板。polyfork の看板・のれんには飾りの漢字が描いてあり、ふりがなを付けられない
 * （AGENTS.md 必ず守るルール2）。そこで漢字を消し、かなの字を Canvas で上に描く。
 * 字は content/ui.json の town.* から読む（かなだけ。漢字を入れるなら横書きの drawRuby にする）。
 */

/** のれんの白い字を、のれんの紺色で塗りつぶす。 */
export const BLANK_NOREN: Recolor = (r, g, b) =>
  r > 0.85 && g > 0.85 && b > 0.85 ? [0.36, 0.43, 0.55] : null;

const KANJI = /[一-鿿]/;
/** 小さいかな（ぁぃぅぇぉっゃゅょゎ・カタカナも）。 */
const SMALL =
  /[\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308e\u30a1\u30a3\u30a5\u30a7\u30a9\u30c3\u30e3\u30e5\u30e7\u30ee]/;

/** たて書き（かなだけ）。小さい字は右上に寄せる。漢字があれば横書きでふりがなを付ける。 */
function drawVertical(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  color: string,
) {
  if (KANJI.test(text)) {
    drawRuby(ctx, text, w / 2, h * 0.6, { size: w * 0.5, color, align: "center" });
    return;
  }
  const chars = [...text];
  const size = Math.min(w * 0.72, (h * 0.86) / chars.length);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = h / 2 - (size * chars.length) / 2;
  chars.forEach((c, i) => {
    const small = SMALL.test(c);
    ctx.font = `800 ${small ? size * 0.7 : size}px ${FONT_FAMILY}`;
    ctx.fillText(
      c,
      w / 2 + (small ? size * 0.16 : 0),
      top + size * (i + 0.5) - (small ? size * 0.2 : 0),
    );
  });
}

/**
 * 店の前に出す、たての看板（かべから横につき出す）。
 * position は看板の中心。看板の面は ±x を向く（道を歩く人から読める）。
 */
export function VSign({
  position,
  rotationY = 0,
  text,
  bg = "#f4efe2",
  fg = "#9c1f24",
  frame = "#6b4f36",
  height = 2.2,
}: {
  position: [number, number, number];
  /** 0 のとき、かべは -z の側。 */
  rotationY?: number;
  text: UiKey;
  bg?: string;
  fg?: string;
  frame?: string;
  height?: number;
}) {
  const w = 0.6;
  const geo = useMemo(
    () =>
      merge([
        box(0.12, height + 0.1, w + 0.1, frame),
        box(0.08, 0.06, 0.06, "#c9cdd2", { pos: [0, height * 0.35, -w / 2 - 0.08] }),
        box(0.08, 0.06, 0.06, "#c9cdd2", { pos: [0, -height * 0.35, -w / 2 - 0.08] }),
      ]),
    [height, frame],
  );
  const label = t(text);
  const draw = (ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    drawVertical(ctx, label, cw, ch, fg);
  };
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geo} material={FLAT} raycast={() => null} />
      <CanvasPanel
        width={w}
        height={height}
        ppm={220}
        position={[0.061, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        fontText={label}
        draw={draw}
      />
      <CanvasPanel
        width={w}
        height={height}
        ppm={220}
        position={[-0.061, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        fontText={label}
        draw={draw}
      />
    </group>
  );
}

/** のれん（字は消して、かなを白く描く）。position は polyfork ののれんと同じ（中心の高さ）。 */
export function Noren({
  position,
  rotationY = 0,
  text,
}: {
  position: [number, number, number];
  rotationY?: number;
  text: UiKey;
}) {
  const label = t(text);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Prop url="street/noren" position={[0, 0, 0]} recolor={BLANK_NOREN} />
      <CanvasPanel
        width={1.2}
        height={0.6}
        ppm={260}
        position={[0, 0.36, 0.06]}
        transparent
        fontText={label}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#f4f1e8";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const chars = [...label];
          const size = Math.min(h * 0.62, (w * 0.8) / chars.length);
          ctx.font = `800 ${size}px ${FONT_FAMILY}`;
          // のれんは2枚に分かれているので、1枚に1字ずつ置く
          chars.forEach((c, i) => {
            ctx.fillText(c, (w * (i + 0.5)) / chars.length, h * 0.5);
          });
        }}
      />
    </group>
  );
}
