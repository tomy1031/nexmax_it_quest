import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FURIGANA } from "@/lib/furigana-index";
import { hideableChar, lineStarts } from "@/lib/listening/checks";
import { LISTENINGS } from "@/lib/listening/content";
import { useListeningStage } from "@/lib/listening/stage-store";
import { useSettings } from "@/lib/store";
import { annotateRuby } from "@/lib/text/furigana";
import { t, type UiKey } from "@/lib/t";
import { ensureFont, FONT_FAMILY, makeCanvas, roundRect, toTexture } from "@/factory/text-canvas";

/** 浮かび上がる 時間（ms）。画面の ノートと そろえる。 */
const RISE_MS = 800;
const PPM = 300;

/**
 * リスニングの 大きな 画面（3D）。いま 読んでいる 文を 虫食いで 大きく 出す（docs/design/02_リスニング.md）。
 * 進むのに 要る 情報（いまの 文）を 3D の 中にも 置く（必ず守るルール10）。
 *
 * - かくれた 字は 箱。開いた 字は 白。ふりがなは 言葉が 丸ごと 開いた ときだけ（読み方の データから）。
 * - 新しく 開いた 字は 下から 浮かび上がって 金色に 光る（0.8 秒）。
 * - こたえあわせの 間は 文を 全部 開いて 出す。
 * 色の 濃い 地の 上なので、字も ふりがなも 白（tomy さん 2026-11-22）。
 */
export function ListeningBoard3D({
  width,
  height,
  position,
  rotation,
}: {
  width: number;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const W = Math.round(width * PPM);
  const H = Math.round(height * PPM);
  const [canvas, ctx] = useMemo(() => makeCanvas(W, H), [W, H]);
  const texture = useMemo(() => toTexture(canvas), [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const furigana = useSettings((s) => s.furigana);
  const id = useListeningStage((s) => s.id);
  const file = id ? LISTENINGS[id] : undefined;
  const fontText = useMemo(
    () => (file ? file.script.map((l) => l.text).join("") + file.title : ""),
    [file],
  );
  const fontReady = useRef(false);
  useEffect(() => {
    fontReady.current = false;
    void ensureFont(fontText).then(() => {
      fontReady.current = true;
      dirty.current = true;
    });
  }, [fontText]);

  // 変わったら 描き直す（光っている 間は 毎フレーム）
  const dirty = useRef(true);
  useEffect(
    () =>
      useListeningStage.subscribe(() => {
        dirty.current = true;
      }),
    [],
  );
  useEffect(() => {
    dirty.current = true;
  }, [furigana]);

  useFrame(() => {
    const st = useListeningStage.getState();
    const now = performance.now();
    const rising = st.flash !== null && now - st.flash.at < RISE_MS + 50;
    if (!dirty.current && !rising) return;
    dirty.current = false;
    paint(ctx, W, H, st, now, furigana);
    texture.needsUpdate = true;
  });

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function font(size: number, weight = 800) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  st: ReturnType<typeof useListeningStage.getState>,
  now: number,
  furigana: boolean,
) {
  // 地（会場の 画面と 同じ 青）
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1f4f94");
  g.addColorStop(1, "#3d7fcc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const file = st.id ? LISTENINGS[st.id] : undefined;
  if (!file) return;
  const lines = file.script.map((l) => l.text);
  const starts = lineStarts(lines);
  const i = Math.min(Math.max(0, st.line), lines.length - 1);
  const text = lines[i]!;
  const start = starts[i]!;

  // 上: 話す 人と 文の 番号
  const speaker = file.script[i]!.speaker;
  const p = file.participants.find((x) => x.id === speaker);
  const name = p?.name ?? t(`speaker.${speaker}` as UiKey) ?? speaker;
  const pill = h * 0.11;
  ctx.font = font(pill * 0.62);
  const nameW = ctx.measureText(name).width + pill * 1.2;
  roundRect(ctx, w * 0.03, h * 0.06, nameW, pill, pill / 2);
  ctx.fillStyle = st.speaking ? "#e07a3e" : "rgba(255,255,255,0.18)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(name, w * 0.03 + pill * 0.6, h * 0.06 + pill * 0.54);
  ctx.textAlign = "right";
  ctx.fillText(`${i + 1} / ${lines.length}`, w * 0.97, h * 0.06 + pill * 0.54);
  if (st.speaking) {
    // 声が 鳴っている 印（3つの 波）
    for (let k = 0; k < 3; k += 1) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(now / 180 + k));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(
        w * 0.03 + nameW + pill * (0.4 + k * 0.35),
        h * 0.06 + pill * 0.3,
        pill * 0.18,
        pill * 0.4,
      );
    }
  }
  ctx.textBaseline = "alphabetic";

  // 文（長い ときは 空白の 所で 2行に 分ける）
  const rows = splitRows(ctx, text, w * 0.92, h);
  const flash = st.flash;
  const fresh = new Set(flash?.positions ?? []);
  const p01 = flash ? Math.min(1, (now - flash.at) / RISE_MS) : 1;
  const segs = annotateRuby(text, FURIGANA);
  // 1字ずつ、どの 言葉（ふりがな）に 入るか
  const segOf: { s0: number; len: number; reading?: string }[] = [];
  let at = 0;
  for (const s of segs) {
    for (let k = 0; k < s.text.length; k += 1)
      segOf.push({ s0: at, len: s.text.length, reading: s.reading });
    at += s.text.length;
  }
  const open = (k: number) => st.showAll || !hideableChar(text[k]) || st.revealed.has(start + k);

  rows.forEach((row) => {
    ctx.font = font(row.size);
    const total = ctx.measureText(text.slice(row.from, row.to)).width;
    let x = (w - total) / 2;
    const y = row.y;
    for (let k = row.from; k < row.to; k += 1) {
      const ch = text[k]!;
      ctx.font = font(row.size);
      const cw = ctx.measureText(ch).width;
      if (open(k)) {
        const isNew = fresh.has(start + k) && p01 < 1;
        const rise = isNew ? (1 - easeOut(p01)) * row.size * 0.55 : 0;
        ctx.save();
        if (isNew) {
          ctx.globalAlpha = 0.25 + 0.75 * easeOut(p01);
          ctx.shadowColor = "rgba(255, 214, 90, 0.95)";
          ctx.shadowBlur = row.size * 0.45 * (1 - p01 * 0.6);
          ctx.fillStyle = mix("#ffd65a", "#ffffff", p01);
        } else {
          ctx.fillStyle = "#ffffff";
        }
        ctx.textAlign = "left";
        ctx.fillText(ch, x, y + rise);
        ctx.restore();
      } else {
        const bw = cw * 0.84;
        roundRect(
          ctx,
          x + (cw - bw) / 2,
          y - row.size * 0.82,
          bw,
          row.size * 0.86,
          row.size * 0.12,
        );
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fill();
        ctx.lineWidth = row.size * 0.06;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.stroke();
      }
      // ふりがな: 言葉の さいごの 字の 所で、言葉 全体が 開いていれば 付ける
      const seg = segOf[k]!;
      if (furigana && seg.reading && k === seg.s0 + seg.len - 1 && seg.s0 >= row.from) {
        let all = true;
        for (let q = seg.s0; q <= k; q += 1) if (!open(q)) all = false;
        if (all) {
          ctx.font = font(row.size);
          const segW = ctx.measureText(text.slice(seg.s0, k + 1)).width;
          const left = x + cw - segW;
          const rs = row.size * 0.42;
          ctx.font = font(rs);
          const rw = ctx.measureText(seg.reading).width;
          const sx = rw > segW ? segW / rw : 1;
          ctx.save();
          ctx.translate(left + segW / 2, y - row.size * 0.9);
          ctx.scale(sx, 1);
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(seg.reading, 0, 0);
          ctx.restore();
        }
      }
      x += cw;
    }
  });
}

/** 文を 1行か 2行に 分け、字の 大きさと 置く 高さを 決める。 */
function splitRows(ctx: CanvasRenderingContext2D, text: string, maxW: number, h: number) {
  const measure = (s: string, size: number) => {
    ctx.font = font(size);
    return ctx.measureText(s).width;
  };
  const one = Math.min(h * 0.27, (h * 0.27 * maxW) / Math.max(1, measure(text, h * 0.27)));
  if (one >= h * 0.17) return [{ from: 0, to: text.length, size: one, y: h * 0.72 }];
  // 真ん中に いちばん 近い 空白（無ければ 句読点の あと）で 分ける
  const mid = text.length / 2;
  let cut = -1;
  for (let k = 1; k < text.length - 1; k += 1) {
    if (/[\s、。]/.test(text[k - 1]!) && (cut < 0 || Math.abs(k - mid) < Math.abs(cut - mid)))
      cut = k;
  }
  if (cut < 0) cut = Math.round(mid);
  const a = text.slice(0, cut);
  const b = text.slice(cut);
  const base = h * 0.2;
  const size = Math.min(base, (base * maxW) / Math.max(1, measure(a, base), measure(b, base)));
  return [
    { from: 0, to: cut, size, y: h * 0.56 },
    { from: cut, to: text.length, size, y: h * 0.88 },
  ];
}

function easeOut(x: number) {
  return 1 - (1 - x) ** 3;
}

function mix(a: string, b: string, k: number) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return `#${ca.lerp(cb, Math.max(0, Math.min(1, k))).getHexString()}`;
}
