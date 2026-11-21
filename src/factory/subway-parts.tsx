import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { t, type UiKey } from "@/lib/t";
import { useSettings } from "@/lib/store";
import { block, box, FLAT, glowMaterial, merge } from "@/factory/kit";
import { player } from "@/three/player";
import {
  drawRuby,
  ensureFont,
  FONT_FAMILY,
  makeCanvas,
  roundRect,
  toTexture,
} from "@/factory/text-canvas";

/**
 * 地下の駅の部品（「8番出口」の地下通路の空気をまねる: 白いタイルのかべ・同じポスターのならび・
 * 長い蛍光灯・黄色の出口の看板）。どれも同じテクスチャを使い回して、数を置いても重くしない。
 */

// ---------- 白いタイルのかべ ----------

const tileCache = new Map<string, THREE.CanvasTexture>();

function tileTexture(color: string, grout: string): THREE.CanvasTexture {
  const key = `${color}|${grout}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 256, 256);
  const n = 4;
  const s = 256 / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      // タイルごとに、ほんの少し明るさを変える（のっぺりさせない）
      const k = 0.97 + (((i * 7 + j * 13) % 5) / 5) * 0.05;
      const c = new THREE.Color(color);
      ctx.fillStyle = `rgb(${Math.min(255, c.r * 255 * k)},${Math.min(255, c.g * 255 * k)},${Math.min(255, c.b * 255 * k)})`;
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(i * s + 3, j * s + 3, s - 8, 3);
    }
  }
  const tex = toTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tileCache.set(key, tex);
  return tex;
}

/**
 * タイルのかべ（板1枚）。size は [横, たて]（m）。板の正面（+z）が見える側。
 * tile はタイル1枚の大きさ（m）。band を渡すと、線の色の帯を腰の高さに引く。
 */
export function TileWall({
  size,
  position,
  rotationY = 0,
  tile = 0.2,
  color = "#f3f3ee",
  grout = "#c9ccc8",
  band,
  bandY = 1.0,
}: {
  size: [number, number];
  position: [number, number, number];
  rotationY?: number;
  tile?: number;
  color?: string;
  grout?: string;
  band?: string;
  /** 帯の高さ（板の下のはしから）。 */
  bandY?: number;
}) {
  const [w, h] = size;
  const map = useMemo(() => {
    const tex = tileTexture(color, grout).clone();
    tex.repeat.set(w / (tile * 4), h / (tile * 4));
    tex.needsUpdate = true;
    return tex;
  }, [color, grout, w, h, tile]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.35} metalness={0.02} />
      </mesh>
      {band && (
        <mesh position={[0, -h / 2 + bandY, 0.01]} raycast={() => null}>
          <planeGeometry args={[w, 0.22]} />
          <meshStandardMaterial color={band} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}

// ---------- 蛍光灯の列 ----------

/** 天井の蛍光灯の列。xs の位置に、z の向きへ長く並べる。 */
export function LightStrips({
  xs,
  y,
  from,
  to,
  rotationY = 0,
}: {
  xs: number[];
  y: number;
  from: number;
  to: number;
  rotationY?: number;
}) {
  const geo = useMemo(() => {
    if (xs.length === 0) return null;
    const p: THREE.BufferGeometry[] = [];
    for (const x of xs) {
      for (let z = from; z < to - 0.6; z += 1.5) {
        p.push(box(0.16, 0.05, 1.3, "#ffffff", { pos: [x, y, z + 0.65] }));
      }
    }
    return merge(p);
  }, [xs, y, from, to]);
  const housing = useMemo(() => {
    if (xs.length === 0) return null;
    const p: THREE.BufferGeometry[] = [];
    for (const x of xs)
      p.push(box(0.3, 0.06, to - from, "#c9ccd0", { pos: [x, y + 0.05, (from + to) / 2] }));
    return merge(p);
  }, [xs, y, from, to]);
  const glow = useMemo(() => glowMaterial("#f4fbff", 1.4), []);
  if (!geo || !housing) return null;
  return (
    <group rotation={[0, rotationY, 0]}>
      <mesh geometry={housing} material={FLAT} raycast={() => null} />
      <mesh geometry={geo} material={glow} raycast={() => null} />
    </group>
  );
}

// ---------- ポスター ----------

export type PosterKind = "manner" | "osaka" | "cafe" | "rush" | "nexmax" | "ginkgo";
export const POSTER_KINDS: PosterKind[] = ["manner", "osaka", "cafe", "rush", "nexmax", "ginkgo"];

const PW = 0.73;
const PH = 1.03;
const PPM = 520;
const posterCache = new Map<string, THREE.CanvasTexture>();

function txt(key: UiKey): string {
  return t(key);
}

function center(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  drawRuby(ctx, text, x, y, { size, color, align: "center", rubyColor: "#0a6bd6" });
}

function english(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

/** ポスターの絵（形だけ。人の顔やキャラクターは描かない）。 */
const DRAW: Record<PosterKind, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  manner: (ctx, w, h) => {
    ctx.fillStyle = "#eaf6ff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f6fd6";
    ctx.fillRect(0, 0, w, h * 0.12);
    // 電話と ×
    ctx.fillStyle = "#26303d";
    roundRect(ctx, w * 0.36, h * 0.2, w * 0.28, h * 0.34, w * 0.04);
    ctx.fill();
    ctx.fillStyle = "#7fd0ff";
    ctx.fillRect(w * 0.39, h * 0.235, w * 0.22, h * 0.25);
    ctx.strokeStyle = "#e5303a";
    ctx.lineWidth = w * 0.05;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.37, w * 0.27, 0, Math.PI * 2);
    ctx.moveTo(w * 0.31, h * 0.24);
    ctx.lineTo(w * 0.69, h * 0.5);
    ctx.stroke();
    center(ctx, txt("poster.manner.title"), w / 2, h * 0.72, w * 0.075, "#13233d");
    english(ctx, txt("poster.manner.en"), w / 2, h * 0.86, w * 0.05, "#3b4c66");
  },
  osaka: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ff9a5a");
    g.addColorStop(0.55, "#ffd48a");
    g.addColorStop(1, "#fff4dc");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // お城のかげ（石垣と屋根の重なり）
    ctx.fillStyle = "#3a2f4a";
    ctx.fillRect(w * 0.2, h * 0.5, w * 0.6, h * 0.08);
    const roof = (y: number, half: number) => {
      ctx.beginPath();
      ctx.moveTo(w / 2 - half, y);
      ctx.lineTo(w / 2 + half, y);
      ctx.lineTo(w / 2 + half * 0.7, y - h * 0.045);
      ctx.lineTo(w / 2 - half * 0.7, y - h * 0.045);
      ctx.closePath();
      ctx.fill();
    };
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(
        w / 2 - w * (0.2 - i * 0.04),
        h * (0.5 - (i + 1) * 0.06),
        w * (0.4 - i * 0.08),
        h * 0.06,
      );
      roof(h * (0.5 - i * 0.06), w * (0.26 - i * 0.04));
    }
    center(ctx, txt("poster.osaka.title"), w / 2, h * 0.74, w * 0.1, "#3a2f4a");
    english(ctx, txt("poster.osaka.en"), w / 2, h * 0.86, w * 0.06, "#6a4a3a");
  },
  cafe: (ctx, w, h) => {
    ctx.fillStyle = "#3b2a22";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f4e9dc";
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.25);
    ctx.lineTo(w * 0.7, h * 0.25);
    ctx.lineTo(w * 0.64, h * 0.52);
    ctx.lineTo(w * 0.36, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c98a4a";
    ctx.fillRect(w * 0.31, h * 0.31, w * 0.38, h * 0.06);
    ctx.strokeStyle = "#f4e9dc";
    ctx.lineWidth = w * 0.02;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(w * (0.42 + i * 0.08), h * 0.22);
      ctx.quadraticCurveTo(w * (0.46 + i * 0.08), h * 0.17, w * (0.42 + i * 0.08), h * 0.12);
      ctx.stroke();
    }
    center(ctx, txt("poster.cafe.title"), w / 2, h * 0.68, w * 0.1, "#f4e9dc");
    center(ctx, txt("poster.cafe.sub"), w / 2, h * 0.8, w * 0.075, "#ffcf7a");
    english(ctx, txt("poster.cafe.en"), w / 2, h * 0.9, w * 0.05, "#d8c8b8");
  },
  rush: (ctx, w, h) => {
    ctx.fillStyle = "#fff6d6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2c21b";
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
    // 走る人の記号（信号の人と同じ、記号の形）と、閉まるドア
    ctx.fillStyle = "#9aa3ad";
    ctx.fillRect(w * 0.6, h * 0.14, w * 0.14, h * 0.42);
    ctx.fillRect(w * 0.78, h * 0.14, w * 0.14, h * 0.42);
    ctx.strokeStyle = "#e5303a";
    ctx.fillStyle = "#e5303a";
    ctx.lineCap = "round";
    ctx.lineWidth = w * 0.05;
    const cx = w * 0.36;
    ctx.beginPath();
    ctx.arc(cx + w * 0.04, h * 0.2, w * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.27);
    ctx.lineTo(cx - w * 0.04, h * 0.4);
    ctx.lineTo(cx - w * 0.16, h * 0.52);
    ctx.moveTo(cx - w * 0.04, h * 0.4);
    ctx.lineTo(cx + w * 0.1, h * 0.5);
    ctx.moveTo(cx, h * 0.3);
    ctx.lineTo(cx - w * 0.14, h * 0.36);
    ctx.moveTo(cx, h * 0.3);
    ctx.lineTo(cx + w * 0.12, h * 0.33);
    ctx.stroke();
    center(ctx, txt("poster.rush.title"), w / 2, h * 0.7, w * 0.078, "#a01d24");
    english(ctx, txt("poster.rush.en"), w / 2, h * 0.81, w * 0.05, "#5a4a2a");
  },
  nexmax: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0b1d4a");
    g.addColorStop(1, "#1aa3d9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,230,255,0.5)";
    ctx.lineWidth = w * 0.006;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, h * (0.1 + i * 0.05));
      ctx.lineTo(w, h * (0.05 + i * 0.06));
      ctx.stroke();
    }
    english(ctx, "NEXMAX", w / 2, h * 0.36, w * 0.16, "#ffffff");
    english(ctx, "IT QUEST", w / 2, h * 0.47, w * 0.11, "#7fe9ff");
    center(ctx, txt("poster.nexmax.title"), w / 2, h * 0.72, w * 0.085, "#ffffff");
    english(ctx, txt("poster.nexmax.en"), w / 2, h * 0.84, w * 0.05, "#bfefff");
  },
  ginkgo: (ctx, w, h) => {
    ctx.fillStyle = "#fff8e1";
    ctx.fillRect(0, 0, w, h);
    // イチョウの葉（おうぎの形）
    ctx.fillStyle = "#f2b705";
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.18 + ((i * 37) % 64) / 100);
      const y = h * (0.12 + ((i * 23) % 40) / 100);
      const r = w * (0.09 + (i % 3) * 0.02);
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.9);
      ctx.arc(x, y + r * 0.9, r, Math.PI * 1.2, Math.PI * 1.8);
      ctx.closePath();
      ctx.fill();
    }
    center(ctx, txt("poster.ginkgo.title"), w / 2, h * 0.7, w * 0.1, "#7a4a00");
    english(ctx, txt("poster.ginkgo.en"), w / 2, h * 0.82, w * 0.05, "#7a5a2a");
  },
};

const POSTER_FONT_TEXT = POSTER_KINDS.map((k) => t(`poster.${k}.title` as UiKey)).join("");

function posterTexture(kind: PosterKind, furigana: boolean): THREE.CanvasTexture {
  const key = `${kind}|${furigana}`;
  const hit = posterCache.get(key);
  if (hit) return hit;
  const W = Math.round(PW * PPM);
  const H = Math.round(PH * PPM);
  const [canvas, ctx] = makeCanvas(W, H);
  const tex = toTexture(canvas);
  const paint = () => {
    ctx.clearRect(0, 0, W, H);
    DRAW[kind](ctx, W, H);
    tex.needsUpdate = true;
  };
  paint();
  void ensureFont(POSTER_FONT_TEXT + "120").then(paint);
  posterCache.set(key, tex);
  return tex;
}

/** ポスター（B1 の大きさ・銀のわく）。position はポスターの中心。正面は +z。 */
export function Poster({
  kind,
  position,
  rotationY = 0,
}: {
  kind: PosterKind;
  position: [number, number, number];
  rotationY?: number;
}) {
  const furigana = useSettings((s) => s.furigana);
  const map = useMemo(() => posterTexture(kind, furigana), [kind, furigana]);
  const frame = useMemo(() => box(PW + 0.06, PH + 0.06, 0.03, "#b8bdc4"), []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frame} material={FLAT} raycast={() => null} />
      <mesh position={[0, 0, 0.017]} raycast={() => null}>
        <planeGeometry args={[PW, PH]} />
        <meshStandardMaterial map={map} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 同じポスターを等間隔にならべる（「8番出口」の通路のように）。 */
export function PosterRow({
  kinds,
  x,
  y = 1.55,
  zs,
  rotationY,
}: {
  kinds: PosterKind[];
  x: number;
  y?: number;
  zs: number[];
  rotationY: number;
}) {
  return (
    <>
      {zs.map((z, i) => (
        <Poster
          key={z}
          kind={kinds[i % kinds.length]!}
          position={[x, y, z]}
          rotationY={rotationY}
        />
      ))}
    </>
  );
}

/** ホームの床の乗車位置のしるし（ドアの前）。 */
export function BoardingMarks({ x, zs, color }: { x: number; zs: number[]; color: string }) {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [];
    for (const z of zs) {
      p.push(box(0.5, 0.012, 1.3, "#ffffff", { pos: [x, 0.008, z] }));
      p.push(box(0.4, 0.014, 1.2, color, { pos: [x, 0.01, z] }));
      p.push(box(0.12, 0.016, 0.4, "#ffffff", { pos: [x, 0.012, z] }));
    }
    return merge(p);
  }, [x, zs, color]);
  return <mesh geometry={geo} material={FLAT} raycast={() => null} />;
}

// ---------- 柱（カメラと自分の間に入ると、うすく透ける） ----------

/**
 * 駅の柱。タイル色の角柱・腰の高さに線の色の帯・下に幅木。
 * カメラと自分（プレイヤー）の間に入った柱は、うすく透けて、前が見えるようにする。
 */
export function Pillars({
  list,
  height,
  band,
  size = 0.62,
}: {
  list: [number, number][];
  height: number;
  band: string;
  size?: number;
}) {
  const geo = useMemo(
    () =>
      merge([
        block(size, height, size, "#eeeeea"),
        block(size + 0.02, 0.18, size + 0.02, band, { pos: [0, 1.0, 0] }),
        block(size + 0.04, 0.12, size + 0.04, "#9aa0a8"),
      ]),
    [size, height, band],
  );
  const key = JSON.stringify(list);
  const mats = useMemo(
    () =>
      list.map(
        () =>
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.82,
            metalness: 0.02,
            transparent: true,
            opacity: 1,
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame(({ camera }, dt) => {
    const cx = camera.position.x;
    const cz = camera.position.z;
    const px = player.pos.x;
    const pz = player.pos.z;
    const dx = px - cx;
    const dz = pz - cz;
    const len2 = dx * dx + dz * dz || 1;
    list.forEach(([x, z], i) => {
      // 柱の中心から、カメラ→自分の線までの近さ
      const u = ((x - cx) * dx + (z - cz) * dz) / len2;
      let block = false;
      if (u > 0 && u < 1) {
        const qx = cx + dx * u - x;
        const qz = cz + dz * u - z;
        block = qx * qx + qz * qz < (size * 0.5 + 0.35) ** 2;
      }
      const m = mats[i]!;
      const want = block ? 0.18 : 1;
      m.opacity += (want - m.opacity) * Math.min(1, dt * 10);
      m.depthWrite = m.opacity > 0.95;
    });
  });
  return (
    <>
      {list.map(([x, z], i) => (
        <mesh key={`${x},${z}`} geometry={geo} material={mats[i]} position={[x, 0, z]} />
      ))}
    </>
  );
}
