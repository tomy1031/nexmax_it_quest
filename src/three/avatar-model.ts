import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AvatarConfig } from "@/lib/store";
import { box, FLAT, merge } from "@/factory/kit";

/**
 * polyfork の人のモデルを、学生のアバターの色に塗りかえる。
 *
 * モデルは部品ごとに形が分かれている（0 体・1 髪・2 シャツとネクタイ・3 上着・4 ズボン・5 くつ・6 リュック）。
 * 部品ごとに「元の色 → 新しい色」を当て、元の明るさの差（上着のかげなど）は比で残す。
 * 元の色は polyfork のモデルに入っている色そのもの（assets.json のモデルで調べた値）。
 */

export const MODEL_URL = {
  "suit-m": "models/people/suit-m.glb",
  "suit-f": "models/people/suit-f.glb",
  "casual-m": "models/people/casual-m.glb",
  "casual-f": "models/people/casual-f.glb",
  hoodie: "models/people/hoodie.glb",
  school: "models/people/school.glb",
  worker: "models/people/worker.glb",
} as const;
export type ModelKey = keyof typeof MODEL_URL;

export function modelFor(cfg: Pick<AvatarConfig, "outfit" | "figure">): ModelKey {
  return `${cfg.outfit}-${cfg.figure}` as ModelKey;
}

type Rule = { from: string[]; to: keyof AvatarConfig | "keep" };

/** 部品の番号ごとの塗りかえ。from の最初の色が「基準の色」。 */
const RULES: Record<"suit" | "casual", Rule[][]> = {
  suit: [
    [{ from: ["#d8ae8a", "#9a6f55"], to: "skin" }],
    [{ from: ["#261a0e"], to: "hair" }],
    [
      { from: ["#daf3f3"], to: "shirt" },
      { from: ["#2a3550"], to: "tie" },
    ],
    [
      { from: ["#353841", "#393c45"], to: "suit" },
      { from: ["#daf3f3"], to: "shirt" },
    ],
    [{ from: ["#353841"], to: "suit" }],
    [],
  ],
  casual: [
    [{ from: ["#e4b793", "#9a6a55"], to: "skin" }],
    [{ from: ["#5a1a18"], to: "hair" }],
    [{ from: ["#3b4c5f"], to: "shirt" }],
    [{ from: ["#93bcc2", "#76a0a7"], to: "coat" }],
    [{ from: ["#444542"], to: "pants" }],
    [],
    [],
  ],
};

const c = new THREE.Color();
function lin(hex: string): THREE.Color {
  return new THREE.Color(hex).convertSRGBToLinear();
}
function key(r: number, g: number, b: number): string {
  c.setRGB(r, g, b).convertLinearToSRGB();
  return `#${c.getHexString()}`;
}

/** 体の部品の形（SkinnedMesh）を、出てくる順に集める。 */
export function bodyParts(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const parts: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh);
  });
  return parts;
}

/** 頂点の色を塗りかえる（形は複製してから塗る。元のモデルは変えない）。 */
export function recolor(root: THREE.Object3D, cfg: AvatarConfig): void {
  const rules = RULES[cfg.outfit];
  bodyParts(root).forEach((mesh, i) => {
    const partRules = rules[i] ?? [];
    const geo = mesh.geometry.clone();
    mesh.geometry = geo;
    const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!col) return;
    for (const rule of partRules) {
      if (rule.to === "keep") continue;
      const base = lin(rule.from[0]!);
      const target = lin(cfg[rule.to] as string);
      const fromSet = new Set(rule.from);
      for (let v = 0; v < col.count; v += 1) {
        const r = col.getX(v);
        const g = col.getY(v);
        const b = col.getZ(v);
        if (!fromSet.has(key(r, g, b))) continue;
        // 元の明るさの差を、比で残す
        const k = (r + g + b) / Math.max(1e-4, base.r + base.g + base.b);
        col.setXYZ(
          v,
          Math.min(1, target.r * k),
          Math.min(1, target.g * k),
          Math.min(1, target.b * k),
        );
      }
    }
    col.needsUpdate = true;
  });
}

/** モデルを1人分に複製し、素材を共通の FLAT（頂点の色・面ごとの陰影）にそろえる。 */
export function instantiate(gltf: { scene: THREE.Object3D }): THREE.Object3D {
  const root = cloneSkinned(gltf.scene);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = FLAT;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
    }
  });
  return root;
}

// ── 動き（polyfork の CC0 の動き。public/models/clips/*.json） ──

interface RawClip {
  name: string;
  times: number[];
  tracks: Record<string, number[]>;
  hips: number[];
}

const BAKED_HIP = 0.95;
const clipCache = new Map<string, Promise<RawClip>>();

export function loadRawClip(name: string): Promise<RawClip> {
  const url = `${import.meta.env.BASE_URL}models/clips/${name}.json`;
  let p = clipCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => r.json() as Promise<RawClip>);
    clipCache.set(url, p);
  }
  return p;
}

/** 動きのデータを、この人の骨に合わせた AnimationClip にする（その場で動く。位置はゲームが動かす）。 */
export function buildClip(
  raw: RawClip,
  root: THREE.Object3D,
  name = raw.name,
): THREE.AnimationClip {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && !bones.has(o.name)) bones.set(o.name, o as THREE.Bone);
  });
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, values] of Object.entries(raw.tracks)) {
    const b = bones.get(bone);
    if (!b || values.length === 0) continue;
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${b.uuid}.quaternion`,
        raw.times.slice(),
        Float32Array.from(values),
      ),
    );
  }
  const hips = bones.get("Hips");
  if (hips) {
    const rest = (hips.userData.rest as THREE.Vector3 | undefined) ?? hips.position.clone();
    hips.userData.rest = rest;
    const ratio = (rest.y || BAKED_HIP) / BAKED_HIP;
    const pos = new Float32Array(raw.hips.length);
    for (let i = 0; i < raw.hips.length; i += 3) {
      pos[i] = rest.x;
      pos[i + 1] = rest.y + (raw.hips[i + 1] ?? 0) * ratio;
      pos[i + 2] = rest.z;
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`, raw.times.slice(), pos));
  }
  return new THREE.AnimationClip(name, -1, tracks);
}

// ── 髪型とめがね（グラフィック工場で作り、頭の骨に付ける） ──

/**
 * モデルの頭の大きさ（polyfork の人の髪の形から測った値。体型・年れいで少し変わるが、大人ならほぼ同じ）。
 * x: ±0.111 / y: 1.454〜1.714 / z: -0.105〜0.106（顔は +z）
 */
const HEAD = { x: 0.112, y0: 1.454, y1: 1.714, z0: -0.106, z1: 0.106 };

function hairShape(style: AvatarConfig["hairStyle"], color: string): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const back = (y0: number) =>
    box(HEAD.x * 2 + 0.03, HEAD.y1 - y0, 0.07, color, {
      pos: [0, (HEAD.y1 + y0) / 2, HEAD.z0 - 0.005],
    });
  const side = (y0: number, sx: number) =>
    box(0.025, HEAD.y1 - 0.04 - y0, 0.15, color, {
      pos: [sx * (HEAD.x + 0.01), (HEAD.y1 - 0.04 + y0) / 2, -0.03],
    });
  switch (style) {
    case "long":
      parts.push(back(1.3), side(1.36, -1), side(1.36, 1));
      break;
    case "bob":
      parts.push(back(1.44), side(1.47, -1), side(1.47, 1));
      break;
    case "ponytail":
      parts.push(box(0.07, 0.07, 0.06, color, { pos: [0, 1.6, HEAD.z0 - 0.03] }));
      parts.push(
        box(0.06, 0.24, 0.06, color, { pos: [0, 1.48, HEAD.z0 - 0.07], rot: [0.25, 0, 0] }),
      );
      break;
    case "bun":
      parts.push(
        box(0.11, 0.1, 0.1, color, { pos: [0, HEAD.y1 + 0.02, HEAD.z0 + 0.0], rot: [0.2, 0.4, 0] }),
      );
      break;
    default:
      return null;
  }
  return merge(parts);
}

function glassesShape(): THREE.BufferGeometry {
  const c = "#1f2229";
  const y = 1.585;
  const z = HEAD.z1 + 0.006;
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.05;
    parts.push(box(0.065, 0.008, 0.008, c, { pos: [x, y + 0.022, z] }));
    parts.push(box(0.065, 0.008, 0.008, c, { pos: [x, y - 0.022, z] }));
    parts.push(box(0.008, 0.044, 0.008, c, { pos: [x - 0.03, y, z] }));
    parts.push(box(0.008, 0.044, 0.008, c, { pos: [x + 0.03, y, z] }));
    parts.push(box(0.006, 0.008, 0.12, c, { pos: [sx * (HEAD.x + 0.002), y + 0.015, z - 0.06] }));
  }
  parts.push(box(0.03, 0.006, 0.008, c, { pos: [0, y + 0.012, z] }));
  return merge(parts);
}

/** 頭の骨にだけ付いて動く形（SkinnedMesh。モデルの髪と同じ骨組みを使う）。 */
function headPiece(
  template: THREE.SkinnedMesh,
  geo: THREE.BufferGeometry,
): THREE.SkinnedMesh | null {
  const skeleton = template.skeleton;
  const headIndex = skeleton.bones.findIndex((b) => b.name === "Head");
  if (headIndex < 0) return null;
  const n = geo.getAttribute("position").count;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    idx[i * 4] = headIndex;
    w[i * 4] = 1;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  const mesh = new THREE.SkinnedMesh(geo, FLAT);
  mesh.frustumCulled = false;
  mesh.bind(skeleton, template.bindMatrix);
  return mesh;
}

/** 髪型とめがねを付ける（recolor のあとに呼ぶ）。 */
export function dress(root: THREE.Object3D, cfg: AvatarConfig): void {
  const parts = bodyParts(root);
  const hair = parts[1];
  if (!hair) return;
  const add: THREE.SkinnedMesh[] = [];
  const h = hairShape(cfg.hairStyle, cfg.hair);
  if (h) {
    const m = headPiece(hair, h);
    if (m) add.push(m);
  }
  if (cfg.glasses) {
    const m = headPiece(hair, glassesShape());
    if (m) add.push(m);
  }
  for (const m of add) hair.parent?.add(m);
}
