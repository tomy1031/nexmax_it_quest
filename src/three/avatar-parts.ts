import * as THREE from "three";
import type { AvatarConfig } from "@/lib/store";

/**
 * アバターの部品（ブレンダーで作った public/models/avatar/avatar.glb。作り方は tools/blender/build_avatar.py）。
 * 部品の名前の頭で色を決める（top_ 上着・bottom_ ズボン/スカート・shirt_ シャツ・tie_ ネクタイ/リボン・hair_ 髪 など）。
 * 腕・足は付け根（肩・股）が原点。髪・耳・めがねは頭の中心（joint_head）からの位置に直して使う。
 */

export const AVATAR_URL = `${import.meta.env.BASE_URL}models/avatar/avatar.glb`;

export interface AvatarJoints {
  head: THREE.Vector3;
  shoulderL: THREE.Vector3;
  shoulderR: THREE.Vector3;
  hipL: THREE.Vector3;
  hipR: THREE.Vector3;
}

export interface AvatarParts {
  joints: AvatarJoints;
  /** 体（腰を中心に曲げる）に付く部品。位置は体の座標のまま。 */
  body: THREE.Mesh[];
  /** 頭に付く部品（頭の中心からの位置）。 */
  head: THREE.Mesh[];
  armL: THREE.Mesh[];
  armR: THREE.Mesh[];
  legL: THREE.Mesh[];
  legR: THREE.Mesh[];
}

/** 下の服（男性はズボン。女性はスカートかズボン）。 */
export function bottomOf(cfg: AvatarConfig): "pants" | "skirt" {
  if (cfg.figure !== "f") return "pants";
  if (cfg.bottom) return cfg.bottom;
  return cfg.outfit === "suit" ? "skirt" : "pants";
}

const matCache = new Map<string, THREE.Material>();
let gradient: THREE.DataTexture | null = null;

/** やわらかい陰（4だん）の素材。色ごとに1つだけ作って、みんなで使う。 */
export function softMaterial(color: string, vertexColors = false): THREE.Material {
  const key = `${color}|${vertexColors}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  if (!gradient) {
    const d = new Uint8Array([
      196, 196, 196, 255, 222, 222, 222, 255, 244, 244, 244, 255, 255, 255, 255, 255,
    ]);
    gradient = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, vertexColors });
  matCache.set(key, m);
  return m;
}

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  if (k <= 1) c.multiplyScalar(k);
  else c.lerp(new THREE.Color("#ffffff"), k - 1);
  return `#${c.getHexString()}`;
}

/** 色の明るさだけを上げる（色あいは そのまま。頂点の色 0.8 をかけると元の色にもどる）。 */
function boost(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}

/** 部品の名前 → 色（null なら この設定では使わない）。 */
function colorFor(name: string, cfg: AvatarConfig): string | null {
  const suit = cfg.outfit === "suit";
  const bottom = bottomOf(cfg);
  const top = suit ? cfg.suit : cfg.coat;
  const pants = suit ? cfg.suit : cfg.pants;
  const female = cfg.figure === "f";
  const side = name.replace(/_[LR]$/, "");
  switch (side) {
    case "top_torso":
      return female ? null : top;
    case "top_torsoF":
      return female ? top : null;
    case "sleeve":
      return top;
    case "top_suitHem":
    case "shirt_suitV":
    case "dark_suitLapel":
      if (!suit) return null;
      return side === "shirt_suitV" ? cfg.shirt : side === "dark_suitLapel" ? shade(top, 0.8) : top;
    case "cuff":
      return suit ? cfg.shirt : null;
    case "tie_suitTie":
      return suit && !female ? cfg.tie : null;
    case "tie_suitRibbon":
      return suit && female ? cfg.tie : null;
    case "top_hoodieHood":
      return suit ? null : shade(top, 0.93);
    case "dark_hoodiePocket":
      return suit ? null : shade(top, 0.86);
    case "white_hoodieStrings":
      return suit ? null : "#f2f2f2";
    case "bag_backpack":
      return !suit && cfg.bag !== false ? "#2b2f37" : null;
    case "bottom_hips":
      return bottom === "pants" ? pants : null;
    case "bottom_skirt":
      return bottom === "skirt" ? (suit ? cfg.suit : cfg.pants) : null;
    case "leg":
      return bottom === "skirt" ? (suit ? "#3b302c" : cfg.skin) : pants;
    case "shoe":
      return cfg.shoes ?? (suit ? "#24201f" : "#f4f4f2");
    case "hand":
    case "ear":
      return cfg.skin;
    case "glasses_frame":
      return cfg.glasses ? "#2a2d35" : null;
    case "acc_flowerPetals":
      return cfg.accessory === "flower" ? "#fff3c4" : null;
    case "acc_flowerCenter":
      return cfg.accessory === "flower" ? "#f2b705" : null;
    case "acc_ribbon":
      return cfg.accessory === "ribbon" && cfg.hairStyle !== "ponytail" ? "#e85c7a" : null;
    default:
      if (name === `hair_${cfg.hairStyle}`) return cfg.hair;
      // 髪をむすぶ ゴム（ポニーテール・ハーフアップ・みつあみ）。かざりが リボンなら ピンク
      if (name === `acc_tie_${cfg.hairStyle}`)
        return cfg.accessory === "ribbon" ? "#e85c7a" : shade(cfg.hair, 0.7);
      return null;
  }
}

/** GLB の中身から、設定に合う部品を選んで色をぬる（形は共有。メッシュだけ新しく作る）。 */
export function pickParts(scene: THREE.Object3D, cfg: AvatarConfig): AvatarParts {
  const at = (n: string) => scene.getObjectByName(n)?.position.clone() ?? new THREE.Vector3();
  const joints: AvatarJoints = {
    head: at("joint_head"),
    shoulderL: at("joint_shoulder_L"),
    shoulderR: at("joint_shoulder_R"),
    hipL: at("joint_hip_L"),
    hipR: at("joint_hip_R"),
  };
  const out: AvatarParts = { joints, body: [], head: [], armL: [], armR: [], legL: [], legR: [] };
  scene.traverse((o) => {
    const src = o as THREE.Mesh;
    if (!src.isMesh) return;
    const name = src.name;
    const color = colorFor(name, cfg);
    if (!color) return;
    // 髪は頂点の色（つやの帯。ふつうの所は 0.8）を使うので、色を明るくしておく
    const isHair = name.startsWith("hair_");
    const m = new THREE.Mesh(
      src.geometry,
      isHair ? softMaterial(boost(color, 1.25), true) : softMaterial(color),
    );
    m.name = name;
    if (/^(sleeve|hand|cuff)_L$/.test(name)) {
      out.armL.push(m);
    } else if (/^(sleeve|hand|cuff)_R$/.test(name)) {
      out.armR.push(m);
    } else if (/^(leg|shoe)_L$/.test(name)) {
      out.legL.push(m);
    } else if (/^(leg|shoe)_R$/.test(name)) {
      out.legR.push(m);
    } else if (/^(hair_|ear_|glasses_|acc_)/.test(name)) {
      m.position.copy(src.position).sub(joints.head);
      out.head.push(m);
    } else {
      m.position.copy(src.position);
      out.body.push(m);
    }
  });
  return out;
}
