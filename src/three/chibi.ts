import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AvatarConfig } from "@/lib/store";

/**
 * ちびキャラ工場。丸い大きな頭・短い体・点の目とほっぺの、かわいい人をプログラムで作る。
 * （どうぶつの森のような頭身の「感じ」を目指すが、特定のゲームのキャラはまねない。）
 *
 * - モデルのファイルを使わないので、ライセンスの心配が無い。スーツ・髪型・身長を自由に足せる。
 * - 部品は「体・頭・腕2本・足2本」の7つの形にまとめる（描画の回数を少なくする）。動きは骨を使わず、部品を回して作る。
 * - 色は頂点の色（1つの素材を全員で使う）。顔だけは Canvas に描いた絵を頭に貼る（まばたきで目を閉じた絵と入れかえる）。
 *
 * 大きさは身長 168cm のとき 約1.2m（頭が全体の 4割）。身長の設定に合わせて全体を大きくする。
 */

export type EyeStyle = "round" | "smile" | "sparkle" | "calm";

const c = new THREE.Color();

/** 形に色を塗る（なめらかな陰影のため、法線は残す）。 */
function tint(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  c.set(color).convertSRGBToLinear();
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

function at(
  g: THREE.BufferGeometry,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  return g;
}

const sphere = (
  r: number,
  color: string,
  pos: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  seg = 16,
) =>
  at(tint(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), color), pos, [0, 0, 0], scale);
const capsule = (
  r: number,
  len: number,
  color: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) => at(tint(new THREE.CapsuleGeometry(r, len, 6, 14), color), pos, rot, scale);
const cone = (
  rTop: number,
  rBottom: number,
  h: number,
  color: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
) => at(tint(new THREE.CylinderGeometry(rTop, rBottom, h, 20, 1, false), color), pos, rot);
const rbox = (
  w: number,
  h: number,
  d: number,
  color: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
) => at(tint(new THREE.BoxGeometry(w, h, d, 2, 2, 2), color), pos, rot);
/** 球の一部（髪のかぶさる所）。theta は上から何度まで。phi は横の範囲。 */
const cap = (
  r: number,
  color: string,
  phiStart: number,
  phiLen: number,
  thetaStart: number,
  thetaLen: number,
  pos: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
) =>
  at(
    tint(new THREE.SphereGeometry(r, 24, 16, phiStart, phiLen, thetaStart, thetaLen), color),
    pos,
    [0, 0, 0],
    scale,
  );

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("chibi merge failed");
  return g;
}

/** 頭の大きさと位置（体の座標。足の下が y=0）。 */
export const HEAD = { r: 0.25, y: 0.9 };
const SHOULDER = { x: 0.185, y: 0.64 };
const HIP = { x: 0.085, y: 0.33 };

/** 全員で使う素材（頂点の色・トゥーンの陰影）。 */
let toonGradient: THREE.DataTexture | null = null;
function gradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([178, 178, 178, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
  toonGradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  toonGradient.minFilter = THREE.NearestFilter;
  toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}
let bodyMat: THREE.MeshToonMaterial | null = null;
export function chibiMaterial(): THREE.MeshToonMaterial {
  bodyMat ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient() });
  return bodyMat;
}

const darker = (hex: string, k: number) => {
  const col = new THREE.Color(hex);
  return `#${col.multiplyScalar(k).getHexString()}`;
};

export interface ChibiParts {
  body: THREE.BufferGeometry;
  headExtras: THREE.BufferGeometry;
  armL: THREE.BufferGeometry;
  armR: THREE.BufferGeometry;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
}

/** 設定から、ちびキャラの7つの形を作る（体の座標で作り、腕と足は付け根を原点にする）。 */
export function buildChibi(cfg: AvatarConfig): ChibiParts {
  const suit = cfg.outfit === "suit";
  const skirt = suit && cfg.figure === "f";
  const top = suit ? cfg.suit : cfg.coat;
  const bottom = suit ? cfg.suit : cfg.pants;
  const shoe = suit ? "#2b2320" : "#f2f2f0";

  // 体（胴・スーツの V・ネクタイ・リュック・スカート）
  const body: THREE.BufferGeometry[] = [
    capsule(0.165, 0.13, top, [0, 0.52, 0], [0, 0, 0], [1, 1, 0.86]),
    cone(0.12, 0.17, 0.12, bottom, [0, 0.36, 0]),
  ];
  if (suit) {
    // シャツの V とネクタイ（胴の前に うすく貼る）
    const v = new THREE.BufferGeometry();
    v.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.06, 0.7, 0, 0.06, 0.7, 0, 0, 0.53, 0], 3),
    );
    v.computeVertexNormals();
    body.push(at(tint(v, cfg.shirt), [0, 0, 0.146]));
    body.push(rbox(0.035, 0.11, 0.012, cfg.tie, [0, 0.6, 0.153], [0, 0, Math.PI / 4 / 4]));
    body.push(rbox(0.03, 0.03, 0.012, cfg.tie, [0, 0.665, 0.15], [0, 0, Math.PI / 4]));
    body.push(sphere(0.012, darker(top, 0.6), [0.035, 0.49, 0.145]));
    body.push(sphere(0.012, darker(top, 0.6), [0.035, 0.43, 0.14]));
    if (skirt) body.push(cone(0.15, 0.2, 0.17, bottom, [0, 0.27, 0]));
  } else {
    // パーカー（フード・ポケット）とリュック（タイトル画像の主人公のように）
    body.push(
      at(
        tint(new THREE.TorusGeometry(0.11, 0.045, 8, 20, Math.PI), darker(top, 0.92)),
        [0, 0.7, -0.06],
        [Math.PI / 2 + 0.3, 0, 0],
      ),
    );
    body.push(rbox(0.17, 0.07, 0.03, darker(top, 0.85), [0, 0.45, 0.135]));
    body.push(rbox(0.25, 0.27, 0.12, "#2b2f38", [0, 0.53, -0.18]));
    body.push(rbox(0.2, 0.08, 0.04, "#3a404c", [0, 0.47, -0.245]));
    body.push(rbox(0.03, 0.3, 0.03, "#2b2f38", [0.11, 0.55, 0.13], [0.15, 0, 0]));
    body.push(rbox(0.03, 0.3, 0.03, "#2b2f38", [-0.11, 0.55, 0.13], [0.15, 0, 0]));
  }

  // 腕（肩が原点。下へのびる）
  const arm = () =>
    merge([
      capsule(0.052, 0.13, top, [0, -0.1, 0], [0, 0, 0]),
      sphere(0.058, cfg.skin, [0, -0.2, 0.005]),
      ...(suit ? [cone(0.056, 0.056, 0.02, cfg.shirt, [0, -0.16, 0])] : []),
    ]);
  // 足（股が原点。下へのびる）
  const leg = () =>
    merge([
      capsule(0.06, 0.12, skirt ? cfg.skin : bottom, [0, -0.13, 0]),
      sphere(0.075, shoe, [0, -0.28, 0.025], [1, 0.62, 1.35]),
    ]);

  // 頭のまわり（耳・髪・めがね）。頭の中心が原点
  const R = HEAD.r;
  const hair = cfg.hair;
  const extras: THREE.BufferGeometry[] = [
    sphere(0.045, cfg.skin, [R * 1.0, -0.01, 0], [0.6, 1, 0.9]),
    sphere(0.045, cfg.skin, [-R * 1.0, -0.01, 0], [0.6, 1, 0.9]),
  ];
  // 髪のかぶさり（頭の上と後ろ）。前は額まで
  const crown = () =>
    cap(R * 1.07, hair, 0, Math.PI * 2, 0, Math.PI * 0.42, [0, 0.01, 0], [1, 1.02, 1]);
  const backHair = (down: number) =>
    cap(R * 1.07, hair, Math.PI, Math.PI, 0, Math.PI * down, [0, 0.01, -0.005]);
  const bangs = (tilt = 0) => [
    sphere(0.075, hair, [-0.11, 0.13, 0.17], [1.2, 0.55, 0.7]),
    sphere(0.08, hair, [0, 0.15, 0.185], [1.3, 0.5, 0.7]),
    sphere(0.075, hair, [0.11, 0.13 + tilt, 0.17], [1.2, 0.55, 0.7]),
  ];
  switch (cfg.hairStyle) {
    case "spiky":
      extras.push(crown(), backHair(0.62), ...bangs());
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2;
        extras.push(
          at(
            tint(new THREE.ConeGeometry(0.05, 0.12, 8), hair),
            [Math.sin(a) * 0.12, R * 0.92, Math.cos(a) * 0.1 - 0.02],
            [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6],
          ),
        );
      }
      break;
    case "side":
      extras.push(crown(), backHair(0.62));
      extras.push(sphere(0.1, hair, [0.03, 0.14, 0.18], [1.8, 0.5, 0.65]));
      extras.push(sphere(0.07, hair, [-0.16, 0.02, 0.14], [0.6, 1.4, 0.7]));
      break;
    case "bob":
      extras.push(crown(), ...bangs());
      extras.push(
        cap(R * 1.1, hair, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.72, [0, 0.0, -0.01]),
      );
      break;
    case "long":
      extras.push(crown(), ...bangs());
      extras.push(
        cap(R * 1.1, hair, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.72, [0, 0.0, -0.01]),
      );
      extras.push(capsule(0.14, 0.2, hair, [0, -0.22, -0.12], [0.15, 0, 0], [1.25, 1, 0.55]));
      break;
    case "ponytail":
      extras.push(crown(), backHair(0.6), ...bangs());
      extras.push(sphere(0.05, cfg.tie === "#c9a227" ? "#c9a227" : "#e85c7a", [0, 0.06, -0.26]));
      extras.push(capsule(0.065, 0.2, hair, [0, -0.1, -0.31], [0.35, 0, 0]));
      break;
    case "twin":
      extras.push(crown(), backHair(0.6), ...bangs());
      for (const sx of [-1, 1]) {
        extras.push(sphere(0.04, "#e85c7a", [sx * 0.23, 0.05, -0.08]));
        extras.push(capsule(0.06, 0.18, hair, [sx * 0.29, -0.1, -0.08], [0, 0, sx * 0.25]));
      }
      break;
    case "bun":
      extras.push(crown(), backHair(0.6), ...bangs());
      extras.push(sphere(0.1, hair, [0, R * 1.0, -0.06]));
      break;
    default:
      extras.push(crown(), backHair(0.62), ...bangs());
  }
  if (cfg.glasses) {
    const g = "#2a2d35";
    for (const sx of [-1, 1]) {
      extras.push(
        at(tint(new THREE.TorusGeometry(0.045, 0.007, 6, 18), g), [sx * 0.075, -0.035, R * 0.96]),
      );
      extras.push(rbox(0.006, 0.006, 0.2, g, [sx * 0.125, -0.025, 0.1]));
    }
    extras.push(rbox(0.04, 0.006, 0.006, g, [0, -0.03, R * 0.98]));
  }

  // 頭（顔の絵を貼る球。少しつぶした丸）
  const head = new THREE.SphereGeometry(R, 32, 24);
  head.scale(1.04, 0.96, 1);

  return {
    body: merge(body),
    headExtras: merge(extras),
    armL: arm(),
    armR: arm(),
    legL: leg(),
    legR: leg(),
    head,
  };
}

export const CHIBI_JOINTS = { HEAD, SHOULDER, HIP };

// ── 顔（Canvas に描いて頭に貼る） ──

const faceCache = new Map<string, THREE.CanvasTexture>();

/**
 * 顔の絵。球の貼り方では、絵の横 1/4 の所が顔の正面（+z）になる。
 * 目・まゆ・口・ほっぺ。open=false はまばたき（目を閉じた絵）。
 */
export function faceTexture(cfg: AvatarConfig, open: boolean): THREE.CanvasTexture {
  const eyes = (cfg.eyes ?? "round") as EyeStyle;
  const key = `${cfg.skin}|${cfg.hair}|${eyes}|${cfg.blush ?? true}|${open}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  ctx.fillStyle = cfg.skin;
  ctx.fillRect(0, 0, W, H);
  const cx = W * 0.25;
  const ey = H * 0.535;
  const gap = W * 0.054;
  const ink = "#2a1f1d";
  // ほっぺ
  if (cfg.blush ?? true) {
    ctx.fillStyle = "rgba(255,120,140,0.42)";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sx * W * 0.088, H * 0.61, W * 0.03, H * 0.034, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // まゆ
  ctx.strokeStyle = darker(cfg.hair, 0.9);
  ctx.lineCap = "round";
  ctx.lineWidth = W * 0.006;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * gap - W * 0.017, H * 0.415);
    ctx.quadraticCurveTo(cx + sx * gap, H * 0.398, cx + sx * gap + W * 0.017, H * 0.415);
    ctx.stroke();
  }
  // 目
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = W * 0.009;
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap;
    if (!open || eyes === "smile") {
      ctx.beginPath();
      ctx.arc(x, ey + H * 0.02, W * 0.022, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    if (eyes === "calm") {
      ctx.beginPath();
      ctx.ellipse(x, ey, W * 0.011, H * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.skin;
      ctx.fillRect(x - W * 0.014, ey - H * 0.04, W * 0.028, H * 0.022);
      ctx.fillStyle = ink;
      continue;
    }
    const rx = eyes === "sparkle" ? W * 0.026 : W * 0.021;
    const ry = eyes === "sparkle" ? H * 0.08 : H * 0.068;
    ctx.beginPath();
    ctx.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - rx * 0.3, ey - ry * 0.42, rx * 0.42, 0, Math.PI * 2);
    ctx.fill();
    if (eyes === "sparkle") {
      ctx.beginPath();
      ctx.arc(x + rx * 0.35, ey + ry * 0.35, rx * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ink;
  }
  // 口（小さな にっこり）
  ctx.strokeStyle = "#7a3b3b";
  ctx.lineWidth = W * 0.006;
  ctx.beginPath();
  ctx.arc(cx, H * 0.6, W * 0.014, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}
