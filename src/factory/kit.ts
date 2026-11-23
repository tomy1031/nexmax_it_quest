import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * グラフィック工場の道具。polyfork のモデルと同じ「角ばった低ポリゴン・頂点の色・1つの素材」で
 * 日本の駅の部品（券売機・改札・信号など）を組み立てる。部品ごとに1つの形にまとめ、描画の回数を減らす。
 */

/**
 * 色合いを パステルに寄せる（tomy さん 2026-11-23「色彩感のベースはどう森を意識したい」「全般パステルで柔らかさを感じるもの」）。
 * 素材の色（頂点の色・絵）を、少し淡くして（sat）、あたたかい白に近づける（lift）。黒っぽい色も こい灰色まで上がる。
 * polyfork の部品も、工場で作った部品も、同じ素材を通すので、ここ1か所で全体の色合いが そろう。
 */
export interface PastelOpts {
  /** 白に近づける量（0〜1）。 */
  lift: number;
  /** 色の こさ（1 で そのまま）。 */
  sat: number;
  /** 近づける白（少し あたたかい）。 */
  tint?: string;
  /**
   * 光が当たったあとの色も整える（いちばん暗い所を うすい ラベンダーの灰色に、いちばん明るい所を クリーム色に）。
   * コントラストが やわらかくなり、黒が出なくなる。町・駅の部品（FLAT）だけに使う。
   */
  grade?: boolean;
}

export const PASTEL: PastelOpts = { lift: 0.1, sat: 1.08, tint: "#fff6e8", grade: true };

export function pastelize<T extends THREE.Material>(mat: T, o: PastelOpts = PASTEL): T {
  const tint = new THREE.Color(o.tint ?? "#fff8ee");
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.pastelTint = { value: new THREE.Vector3(tint.r, tint.g, tint.b) };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 pastelTint;\nvoid main() {")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 pc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
          float pl = dot(pc, vec3(0.299, 0.587, 0.114));
          pc = mix(vec3(pl), pc, ${o.sat.toFixed(3)});
          pc = mix(pc, pow(pastelTint, vec3(1.0 / 2.2)), ${o.lift.toFixed(3)});
          diffuseColor.rgb = pow(pc, vec3(2.2));
        }`,
      );
    if (o.grade)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `{
          vec3 gc = pow(max(outgoingLight, vec3(0.0)), vec3(1.0 / 2.2));
          gc = mix(vec3(0.27, 0.24, 0.29), vec3(1.0, 0.98, 0.94), clamp(gc, 0.0, 1.0));
          outgoingLight = pow(gc, vec3(2.2));
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `pastel-${o.lift}-${o.sat}-${o.tint ?? ""}-${o.grade ?? false}`;
  mat.needsUpdate = true;
  return mat;
}

/** polyfork と同じ見た目の素材（頂点の色・面ごとの陰影）。全部の部品でこれを1つだけ使う。 */
export const FLAT = pastelize(
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.02,
  }),
);

/** 光る部品（ランプ・画面のふち）。 */
export function glowMaterial(color: string, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    toneMapped: false,
  });
}

const tmpColor = new THREE.Color();

/** 形に1色を塗る（頂点の色）。色は sRGB で書く。 */
export function paint(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  tmpColor.set(color).convertSRGBToLinear();
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g;
}

type Vec3 = [number, number, number];

export interface PartOpts {
  pos?: Vec3;
  rot?: Vec3;
}

function place(g: THREE.BufferGeometry, o: PartOpts): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(...(o.rot ?? [0, 0, 0]));
  m.compose(
    new THREE.Vector3(...(o.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(e),
    new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g;
}

/** 輪（ドーナツの形）。輪は XY の面にある（+z の方から見ると まるい）。r は輪の半径、tube は太さ。 */
export function ring(
  r: number,
  tube: number,
  color: string,
  o: PartOpts = {},
  seg = 20,
): THREE.BufferGeometry {
  return place(paint(new THREE.TorusGeometry(r, tube, 6, seg), color), o);
}

/** 箱。pos は箱の中心。 */
export function box(
  w: number,
  h: number,
  d: number,
  color: string,
  o: PartOpts = {},
): THREE.BufferGeometry {
  return place(paint(new THREE.BoxGeometry(w, h, d), color), o);
}

/** 床に置く箱（pos の y は箱の下の面）。 */
export function block(
  w: number,
  h: number,
  d: number,
  color: string,
  o: PartOpts = {},
): THREE.BufferGeometry {
  const [x, y, z] = o.pos ?? [0, 0, 0];
  return box(w, h, d, color, { ...o, pos: [x, y + h / 2, z] });
}

export function cyl(
  r: number,
  h: number,
  color: string,
  o: PartOpts = {},
  seg = 8,
): THREE.BufferGeometry {
  return place(paint(new THREE.CylinderGeometry(r, r, h, seg), color), o);
}

/** いくつもの形を1つにまとめる（1回の描画で出る）。 */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("merge failed");
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** 階段（上り）。段の数・幅・高さ。z のマイナス方向へ上る。 */
export function stairs(
  steps: number,
  width: number,
  rise: number,
  run: number,
  color: string,
  o: PartOpts = {},
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < steps; i += 1) {
    parts.push(
      block(width, rise * (i + 1), run, i % 2 === 0 ? color : shade(color, 0.92), {
        pos: [0, 0, -i * run - run / 2],
      }),
    );
  }
  return place(merge(parts), o);
}

/** 色を少し暗く・明るくする。 */
export function shade(color: string, k: number): string {
  const c = new THREE.Color(color);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}
