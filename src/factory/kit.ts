import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * グラフィック工場の道具。polyfork のモデルと同じ「角ばった低ポリゴン・頂点の色・1つの素材」で
 * 日本の駅の部品（券売機・改札・信号など）を組み立てる。部品ごとに1つの形にまとめ、描画の回数を減らす。
 */

/** polyfork と同じ見た目の素材（頂点の色・面ごとの陰影）。全部の部品でこれを1つだけ使う。 */
export const FLAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.82,
  metalness: 0.02,
});

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
