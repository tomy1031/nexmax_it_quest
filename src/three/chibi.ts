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

/** 頭の大きさと位置（体の座標。足の下が y=0）。Codex の参考の絵（codex_out/）に合わせ、約2.5頭身。 */
export const HEAD = { r: 0.27, y: 0.9 };
const SHOULDER = { x: 0.17, y: 0.62 };
const HIP = { x: 0.08, y: 0.32 };

/** 全員で使う素材（頂点の色・トゥーンの陰影）。 */
let toonGradient: THREE.DataTexture | null = null;
function gradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([190, 190, 190, 255, 236, 236, 236, 255, 255, 255, 255, 255]);
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

/**
 * ふちの線（参考の絵の、こげ茶の細い線）。形を法線の向きに少しふくらませ、裏側だけを描く。
 * 太さは体の大きさの 1cm ほど。
 */
let outlineMat: THREE.MeshBasicMaterial | null = null;
export function chibiOutlineMaterial(): THREE.MeshBasicMaterial {
  if (outlineMat) return outlineMat;
  const m = new THREE.MeshBasicMaterial({ color: "#2b1d18", side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  transformed += normalize(normal) * 0.0105;",
    );
  };
  outlineMat = m;
  return m;
}

const darker = (hex: string, k: number) => {
  const col = new THREE.Color(hex);
  return `#${col.multiplyScalar(k).getHexString()}`;
};
const lighter = (hex: string, k: number) => {
  const col = new THREE.Color(hex);
  col.lerp(new THREE.Color("#ffffff"), k);
  return `#${col.getHexString()}`;
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

/** 三角の板（えり・シャツの V）。点は体の座標。 */
function tri(points: number[], color: string): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return tint(g, color);
}

/** 設定から、ちびキャラの7つの形を作る（体の座標で作り、腕と足は付け根を原点にする）。 */
export function buildChibi(cfg: AvatarConfig): ChibiParts {
  const suit = cfg.outfit === "suit";
  const female = cfg.figure === "f";
  const skirt = suit && female;
  const top = suit ? cfg.suit : cfg.coat;
  const bottom = suit ? cfg.suit : cfg.pants;
  const shoe = cfg.shoes ?? (suit ? "#24201f" : "#f4f4f2");
  const sole = suit ? "#111" : "#b9bcc2";
  const stockings = "#3b302c";

  // 体（胴・すそ・スーツのえりとシャツとネクタイ／パーカーとリュック・スカート）
  const body: THREE.BufferGeometry[] = [
    capsule(0.15, 0.12, top, [0, 0.5, 0], [0, 0, 0], [1.05, 1, 0.82]),
    // 上着のすそ（少しひろがる）
    cone(0.15, 0.165, 0.09, top, [0, 0.38, 0]),
    cone(0.115, 0.15, 0.08, bottom, [0, 0.33, 0]),
  ];
  const zf = 0.128; // 胴の前の面
  if (suit) {
    // シャツの V（白）
    body.push(
      tri([-0.065, 0.66, zf + 0.006, 0.065, 0.66, zf + 0.006, 0, 0.5, zf + 0.012], cfg.shirt),
    );
    // えり（上着の色を少しこく）
    const lap = darker(top, 0.78);
    body.push(tri([-0.07, 0.665, zf + 0.008, -0.02, 0.6, zf + 0.016, -0.06, 0.52, zf + 0.01], lap));
    body.push(tri([0.07, 0.665, zf + 0.008, 0.06, 0.52, zf + 0.01, 0.02, 0.6, zf + 0.016], lap));
    if (female) {
      // リボン（ちょうちょ結び）
      body.push(sphere(0.022, cfg.tie, [-0.03, 0.635, zf + 0.022], [1.3, 0.8, 0.6]));
      body.push(sphere(0.022, cfg.tie, [0.03, 0.635, zf + 0.022], [1.3, 0.8, 0.6]));
      body.push(sphere(0.012, darker(cfg.tie, 0.8), [0, 0.635, zf + 0.03]));
      body.push(rbox(0.012, 0.05, 0.008, cfg.tie, [-0.012, 0.6, zf + 0.022], [0, 0, 0.3]));
      body.push(rbox(0.012, 0.05, 0.008, cfg.tie, [0.012, 0.6, zf + 0.022], [0, 0, -0.3]));
    } else {
      // ネクタイ
      body.push(rbox(0.03, 0.022, 0.012, cfg.tie, [0, 0.645, zf + 0.02]));
      body.push(rbox(0.032, 0.12, 0.01, cfg.tie, [0, 0.575, zf + 0.02]));
      body.push(rbox(0.024, 0.024, 0.01, cfg.tie, [0, 0.513, zf + 0.02], [0, 0, Math.PI / 4]));
    }
    // ボタン・ポケットのふた
    body.push(sphere(0.011, darker(top, 0.55), [0, 0.455, zf + 0.012]));
    body.push(rbox(0.055, 0.012, 0.01, darker(top, 0.7), [-0.085, 0.43, zf - 0.01], [0, 0.35, 0]));
    body.push(rbox(0.055, 0.012, 0.01, darker(top, 0.7), [0.085, 0.43, zf - 0.01], [0, -0.35, 0]));
    if (skirt) body.push(cone(0.14, 0.185, 0.16, bottom, [0, 0.26, 0]));
  } else {
    // パーカー（フード・ひも・ポケット）
    body.push(
      at(
        tint(new THREE.TorusGeometry(0.105, 0.048, 8, 20, Math.PI), darker(top, 0.9)),
        [0, 0.66, -0.05],
        [Math.PI / 2 + 0.35, 0, 0],
      ),
    );
    body.push(rbox(0.012, 0.09, 0.008, "#f2f2f2", [-0.035, 0.6, zf + 0.012]));
    body.push(rbox(0.012, 0.09, 0.008, "#f2f2f2", [0.035, 0.6, zf + 0.012]));
    body.push(rbox(0.16, 0.08, 0.025, darker(top, 0.88), [0, 0.45, zf - 0.002]));
    if (cfg.bag !== false) {
      // リュック（タイトル画像の主人公のように）
      body.push(rbox(0.24, 0.27, 0.11, "#26292f", [0, 0.51, -0.17]));
      body.push(rbox(0.19, 0.08, 0.04, "#33373f", [0, 0.44, -0.235]));
      // 肩ひも（肩から胸の横へ）
      body.push(rbox(0.03, 0.17, 0.026, "#26292f", [0.118, 0.585, 0.11], [0.25, 0, 0.12]));
      body.push(rbox(0.03, 0.17, 0.026, "#26292f", [-0.118, 0.585, 0.11], [0.25, 0, -0.12]));
    }
  }

  // 腕（肩が原点。下へのびる）。手はまるいミトン
  const arm = () =>
    merge([
      capsule(0.048, 0.12, top, [0, -0.095, 0]),
      sphere(0.052, cfg.skin, [0, -0.19, 0.008], [1, 1.05, 0.95]),
      ...(suit ? [cone(0.05, 0.05, 0.022, cfg.shirt, [0, -0.155, 0])] : []),
    ]);
  // 足（股が原点。下へのびる）。くつは前が丸い
  const legColor = skirt ? stockings : bottom;
  const leg = () =>
    merge([
      capsule(0.058, 0.11, legColor, [0, -0.125, 0]),
      sphere(0.072, shoe, [0, -0.265, 0.025], [1, 0.62, 1.4]),
      sphere(0.072, sole, [0, -0.29, 0.025], [1.02, 0.25, 1.42]),
    ]);

  // 頭のまわり（耳・髪・めがね・かざり）。頭の中心が原点
  const R = HEAD.r;
  const hair = cfg.hair;
  const shine = lighter(hair, 0.22);
  // 耳（頭は横に 1.08 倍なので、その外に出す）
  const extras: THREE.BufferGeometry[] = [
    sphere(0.048, cfg.skin, [R * 1.07, -0.035, 0.015], [0.5, 0.9, 0.75]),
    sphere(0.048, cfg.skin, [-R * 1.07, -0.035, 0.015], [0.5, 0.9, 0.75]),
  ];
  // 頭の表面の点（theta は真上から、phi は正面から右まわり）
  const surf = (theta: number, phi: number, k = 1): THREE.Vector3 =>
    new THREE.Vector3(
      R * 1.08 * k * Math.sin(theta) * Math.sin(phi),
      R * 0.95 * k * Math.cos(theta),
      R * k * Math.sin(theta) * Math.cos(phi),
    );
  /** 頭の表面にそって下へ垂れる、髪の束（しずくの形）。 */
  const lock = (theta: number, phi: number, len: number, wid: number, color = hair) => {
    const p0 = surf(theta, phi, 1.04);
    const n = surf(theta, phi).normalize();
    const down = surf(theta + 0.05, phi)
      .sub(surf(theta, phi))
      .normalize();
    const side = new THREE.Vector3().crossVectors(down, n).normalize();
    const g = tint(new THREE.SphereGeometry(1, 12, 9), color);
    g.scale(wid, len, wid * 0.5);
    g.translate(0, -len * 0.45, 0);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(side, down.clone().negate(), n).setPosition(p0));
    return g;
  };
  // 髪のかぶさり（頭の上と後ろ）。前は額の上まで（まゆを出す）。ボリュームを出すため、頭より大きく
  const crown = (k = 1.12) =>
    cap(R * k, hair, 0, Math.PI * 2, 0, Math.PI * 0.3, [0, 0.02, -0.004], [1.06, 1.08, 1]);
  const backHair = (down: number) =>
    // three.js の球は phi=π/2 が正面（+z）。後ろと横（耳の上）だけをおおう
    cap(
      R * 1.1,
      hair,
      Math.PI * 0.88,
      Math.PI * 1.24,
      0,
      Math.PI * down,
      [0, 0.012, -0.008],
      [1.05, 1, 1],
    );
  const shineSpot = () => sphere(0.05, shine, [-0.08, R * 0.9, 0.11], [1.6, 0.3, 0.8]);
  // 前髪（額にかかる束。まん中で少し分ける）
  const bangs = (lean = 0) => [
    lock(0.62, -0.95, 0.12, 0.07),
    lock(0.58, -0.5 + lean, 0.13, 0.075),
    lock(0.56, -0.08 + lean, 0.14, 0.075),
    lock(0.57, 0.36 + lean, 0.13, 0.075),
    lock(0.6, 0.8, 0.12, 0.07),
    // 上のふくらみ（ふわっとした毛の量）
    sphere(0.1, hair, [-0.08, R * 0.95, 0.07], [1.2, 0.6, 1]),
    sphere(0.1, hair, [0.08, R * 0.97, 0.05], [1.2, 0.62, 1]),
  ];
  // 横の髪（もみあげ・顔の横に下りる毛）
  const sideLocks = (len = 0.12) => [lock(1.05, 1.15, len, 0.045), lock(1.05, -1.15, len, 0.045)];
  switch (cfg.hairStyle) {
    case "spiky":
      extras.push(crown(1.12), backHair(0.62), ...bangs(), shineSpot());
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        extras.push(
          at(
            tint(new THREE.ConeGeometry(0.055, 0.13, 8), hair),
            [Math.sin(a) * 0.14, R * 0.95, Math.cos(a) * 0.11 - 0.03],
            [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7],
          ),
        );
      }
      break;
    case "side":
      extras.push(crown(1.12), backHair(0.62), shineSpot());
      // よこ分け: 大きく流れる前髪
      extras.push(
        lock(0.5, -0.7, 0.16, 0.11),
        lock(0.52, -0.15, 0.15, 0.1),
        lock(0.58, 0.4, 0.13, 0.08),
      );
      extras.push(lock(0.75, 0.95, 0.1, 0.06));
      extras.push(sphere(0.11, hair, [-0.06, R * 0.97, 0.06], [1.4, 0.6, 1]));
      break;
    case "wavy":
      // ふわっとした くせ毛（参考の絵の男の人）。毛先が いろいろな向きに はねる
      extras.push(crown(1.13), backHair(0.64), shineSpot());
      extras.push(
        lock(0.6, -1.0, 0.11, 0.075),
        lock(0.52, -0.55, 0.14, 0.085),
        lock(0.5, -0.05, 0.15, 0.09),
        lock(0.53, 0.45, 0.13, 0.085),
        lock(0.62, 0.95, 0.11, 0.075),
        lock(0.85, 1.35, 0.1, 0.06),
        lock(0.85, -1.35, 0.1, 0.06),
      );
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2;
        extras.push(
          sphere(
            0.07,
            hair,
            [Math.sin(a) * 0.15, R * 0.93 + (i % 2) * 0.02, Math.cos(a) * 0.12 - 0.02],
            [1.1, 0.7, 1],
          ),
        );
      }
      extras.push(sphere(0.05, hair, [0.1, R * 1.02, 0.12], [0.8, 1.3, 0.7]));
      break;
    case "curly":
      // まき毛（小さな まるい毛の かたまりを、頭の上と横に たくさん）
      extras.push(crown(1.02), backHair(0.6));
      for (let ring = 0; ring < 4; ring += 1) {
        const theta = 0.12 + ring * 0.27;
        const n = 5 + ring * 4;
        for (let i = 0; i < n; i += 1) {
          const phi = (i / n) * Math.PI * 2 + ring * 0.3;
          if (ring >= 2 && Math.cos(phi) > 0.5) continue; // 顔の前は あける
          const p0 = surf(theta, phi, 1.1);
          const tone = i % 3 === 0 ? lighter(hair, 0.1) : hair;
          extras.push(sphere(0.068, tone, [p0.x, p0.y, p0.z]));
        }
      }
      // 額の上の小さな まき毛
      for (let i = 0; i < 5; i += 1) {
        const p0 = surf(0.62, -0.9 + i * 0.45, 1.06);
        extras.push(sphere(0.05, hair, [p0.x, p0.y, p0.z]));
      }
      break;
    case "bob":
      extras.push(crown(1.12), ...bangs(), shineSpot());
      extras.push(
        cap(R * 1.14, hair, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.74, [0, 0.0, -0.01]),
      );
      break;
    case "long":
      extras.push(crown(1.12), ...bangs(), shineSpot());
      extras.push(
        cap(R * 1.14, hair, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.74, [0, 0.0, -0.01]),
      );
      extras.push(capsule(0.15, 0.24, hair, [0, -0.25, -0.12], [0.12, 0, 0], [1.3, 1, 0.55]));
      extras.push(...sideLocks(0.2));
      break;
    case "ponytail":
      extras.push(crown(1.1), backHair(0.6), ...bangs(), shineSpot(), ...sideLocks(0.08));
      extras.push(
        sphere(0.05, cfg.accessory === "ribbon" ? "#e85c7a" : darker(hair, 0.8), [0, 0.16, -0.26]),
      );
      extras.push(capsule(0.075, 0.22, hair, [0, 0.02, -0.33], [0.5, 0, 0]));
      break;
    case "twin":
      extras.push(crown(1.1), backHair(0.6), ...bangs(), shineSpot());
      for (const sx of [-1, 1]) {
        extras.push(sphere(0.04, "#e85c7a", [sx * 0.25, 0.08, -0.06]));
        extras.push(capsule(0.07, 0.2, hair, [sx * 0.32, -0.08, -0.06], [0, 0, sx * 0.3]));
      }
      break;
    case "bun":
      extras.push(crown(1.1), backHair(0.6), ...bangs(), shineSpot(), ...sideLocks(0.12));
      extras.push(sphere(0.105, hair, [0, R * 0.55, -0.24]));
      extras.push(sphere(0.06, shine, [-0.03, R * 0.66, -0.2], [1.2, 0.5, 0.6]));
      break;
    default:
      extras.push(crown(1.12), backHair(0.62), ...bangs(), shineSpot());
  }
  // 髪のかざり（花・リボン）
  if (cfg.accessory === "flower") {
    // 右の耳の上の花（参考の絵のような、5まいの花びら）。花は髪の外に、外を向けて付ける
    const c0 = surf(0.8, 0.95, 1.2);
    const n = surf(0.8, 0.95).normalize();
    const u = new THREE.Vector3(0, 1, 0).sub(n.clone().multiplyScalar(n.y)).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const pp = c0
        .clone()
        .addScaledVector(u, Math.cos(a) * 0.032)
        .addScaledVector(v, Math.sin(a) * 0.032);
      extras.push(sphere(0.026, "#fff3c4", [pp.x, pp.y, pp.z]));
    }
    const cc = c0.clone().addScaledVector(n, 0.012);
    extras.push(sphere(0.016, "#f2b705", [cc.x, cc.y, cc.z]));
  } else if (cfg.accessory === "ribbon" && cfg.hairStyle !== "ponytail") {
    const c0 = surf(0.42, 0.75, 1.12);
    extras.push(sphere(0.036, "#e85c7a", [c0.x - 0.035, c0.y, c0.z], [1.3, 0.8, 0.6]));
    extras.push(
      sphere(0.036, "#e85c7a", [c0.x + 0.035, c0.y - 0.01, c0.z - 0.02], [1.3, 0.8, 0.6]),
    );
    extras.push(sphere(0.016, "#c43d5c", [c0.x, c0.y, c0.z + 0.01]));
  }
  if (cfg.glasses) {
    const g = "#2a2d35";
    for (const sx of [-1, 1]) {
      extras.push(
        at(tint(new THREE.TorusGeometry(0.05, 0.007, 6, 18), g), [sx * 0.085, -0.04, R * 0.96]),
      );
      extras.push(rbox(0.006, 0.006, 0.22, g, [sx * 0.135, -0.03, 0.1]));
    }
    extras.push(rbox(0.04, 0.006, 0.006, g, [0, -0.035, R * 0.98]));
  }

  // 頭（顔の絵を貼る球。横に少し広い丸）
  const head = new THREE.SphereGeometry(R, 36, 26);
  head.scale(1.08, 0.95, 1);

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
/** 表情（Codex の参考の絵の4つ: ふつう・にこにこ・びっくり・考える）。 */
export type Expression = "normal" | "happy" | "surprised" | "thinking";

export function faceTexture(
  cfg: AvatarConfig,
  open: boolean,
  expr: Expression = "normal",
): THREE.CanvasTexture {
  const eyes = (cfg.eyes ?? "round") as EyeStyle;
  const key = `${cfg.skin}|${cfg.hair}|${eyes}|${cfg.blush ?? true}|${cfg.figure}|${open}|${expr}`;
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
  const ey = H * 0.56;
  const gap = W * 0.066;
  const ink = "#2a1f1d";
  // ほっぺ
  if (cfg.blush ?? true) {
    ctx.fillStyle = "rgba(255,120,140,0.42)";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sx * W * 0.092, H * 0.635, W * 0.03, H * 0.036, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // まゆ（短い弧）
  ctx.strokeStyle = darker(cfg.hair, 0.9);
  ctx.lineCap = "round";
  ctx.lineWidth = W * 0.005;
  for (const sx of [-1, 1]) {
    // びっくり: まゆを上げる。考える: 右のまゆだけ上げて、ななめに
    const lift = expr === "surprised" ? -H * 0.035 : expr === "thinking" && sx > 0 ? -H * 0.03 : 0;
    const tilt = expr === "thinking" ? sx * H * 0.012 : 0;
    ctx.beginPath();
    ctx.moveTo(cx + sx * gap - W * 0.014, H * 0.405 + lift - tilt);
    ctx.quadraticCurveTo(
      cx + sx * gap,
      H * 0.39 + lift,
      cx + sx * gap + W * 0.014,
      H * 0.405 + lift + tilt,
    );
    ctx.stroke();
  }
  // 目
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = W * 0.009;
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap;
    if (!open || eyes === "smile" || expr === "happy") {
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
    // びっくり: 少し小さく まるい目。考える: 黒目が上を見る
    const big = expr === "surprised" ? 0.85 : 1;
    const rx = (eyes === "sparkle" ? W * 0.032 : W * 0.029) * big;
    const ry = (eyes === "sparkle" ? H * 0.1 : H * 0.092) * big;
    const lookUp = expr === "thinking" ? -H * 0.012 : 0;
    // 黒目（こげ茶のふち＋黒）
    ctx.beginPath();
    ctx.ellipse(x, ey + lookUp, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2e22";
    ctx.beginPath();
    ctx.ellipse(x, ey + lookUp + ry * 0.35, rx * 0.7, ry * 0.45, 0, 0, Math.PI);
    ctx.fill();
    // 光（大きい光と小さい光の2つ）
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.28, ey + lookUp - ry * 0.38, rx * 0.36, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      x + rx * 0.32,
      ey + lookUp + ry * 0.3,
      rx * (eyes === "sparkle" ? 0.24 : 0.16),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // まつげ（女性の顔は、目の外がわに小さく）
    if (cfg.figure === "f") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = W * 0.005;
      ctx.beginPath();
      ctx.moveTo(x + sx * rx * 0.85, ey - ry * 0.55);
      ctx.lineTo(x + sx * rx * 1.35, ey - ry * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = ink;
  }
  // 口
  ctx.strokeStyle = "#5a2b24";
  ctx.lineWidth = W * 0.006;
  if (expr === "happy") {
    // 大きく笑った口（赤い口と、したの ピンク）
    ctx.fillStyle = "#8a2f2a";
    ctx.beginPath();
    ctx.arc(cx, H * 0.625, W * 0.02, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff8f8f";
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.66, W * 0.011, H * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === "surprised") {
    ctx.fillStyle = "#8a2f2a";
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.645, W * 0.009, H * 0.026, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === "thinking") {
    // 小さく むっと した口
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.012, H * 0.645);
    ctx.quadraticCurveTo(cx, H * 0.635, cx + W * 0.012, H * 0.645);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, H * 0.63, W * 0.013, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}
