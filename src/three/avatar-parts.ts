import * as THREE from "three";
import type { AvatarConfig, Kigurumi } from "@/lib/store";
import { pastelize, type PastelOpts } from "@/factory/kit";

/**
 * アバターの部品（ブレンダーで作った public/models/avatar/avatar.glb。作り方は tools/blender/build_avatar.py）。
 * 部品の名前の頭で色を決める（top_ 上着・bottom_ ズボン/スカート・shirt_ シャツ・tie_ ネクタイ/リボン・hair_ 髪 など）。
 * 腕・足は付け根（肩・股）が原点。髪・耳・めがねは頭の中心（joint_head）からの位置に直して使う。
 */

export const AVATAR_URL = `${import.meta.env.BASE_URL}models/avatar/avatar.glb`;
/** avatar.glb は Draco で小さくしてある。読み手は外のサーバーでなく public/draco/ に置いたもの。 */
export const DRACO_URL = `${import.meta.env.BASE_URL}draco/`;

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

/** くつの形（tomy さん 2026-11-23「靴もかわぐつ、スニーカー、サンダルを選べるように」）。 */
export function shoeTypeOf(cfg: AvatarConfig): "leather" | "sneaker" | "sandal" {
  return cfg.shoeType ?? (cfg.outfit === "suit" ? "leather" : "sneaker");
}

const SHOE_DEFAULT = { leather: "#24201f", sneaker: "#f4f4f2", sandal: "#5b4a3f" } as const;

/** 下の服（男性はズボン。女性はスカートかズボン）。 */
export function bottomOf(cfg: AvatarConfig): "pants" | "skirt" {
  if (cfg.figure !== "f" || cfg.outfit === "kigurumi") return "pants";
  if (cfg.bottom) return cfg.bottom;
  return cfg.outfit === "suit" ? "skirt" : "pants";
}

const matCache = new Map<string, THREE.Material>();
let gradient: THREE.DataTexture | null = null;

/** 布の模様（Codex で作った布を scripts/make_fabrics.py で灰色にしたもの）。選んだ服の色に かける。 */
export type Fabric = "twill" | "knit" | "denim" | "check";
/** 模様の くり返し（UV の 1 = 0.25m。tools/blender/build_avatar.py の FABRIC_TILE）。 */
const FABRIC_REPEAT: Record<Fabric, number> = { twill: 1.2, knit: 0.7, denim: 1, check: 1.1 };
const fabricCache = new Map<Fabric, THREE.Texture>();

function fabricTexture(f: Fabric): THREE.Texture {
  const hit = fabricCache.get(f);
  if (hit) return hit;
  const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}img/fabric/${f}.png`);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(FABRIC_REPEAT[f], FABRIC_REPEAT[f]);
  // 灰色の こさを そのまま「かける数」に使う（色の空間の変換をしない）
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  fabricCache.set(f, tex);
  return tex;
}

/** やわらかい陰（4だん）の素材。色ごとに1つだけ作って、みんなで使う。 */
/** 服・髪の色の パステル（はだは そのまま。はだの色を白くしない）。 */
const PASTEL_CLOTH: PastelOpts = { lift: 0.14, sat: 0.95, tint: "#fff6e8" };
const PASTEL_HAIR: PastelOpts = { lift: 0.06, sat: 1, tint: "#fff3e6" };

export function softMaterial(
  color: string,
  vertexColors = false,
  fabric?: Fabric,
  tone: "cloth" | "hair" | "skin" = "skin",
): THREE.Material {
  const key = `${color}|${vertexColors}|${fabric ?? ""}|${tone}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  if (!gradient) {
    // かげの いちばん こい所も 明るめに（どう森のような やわらかい陰。tomy さん 2026-11-23）
    const d = new Uint8Array([
      214, 214, 214, 255, 232, 232, 232, 255, 247, 247, 247, 255, 255, 255, 255, 255,
    ]);
    gradient = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradient,
    vertexColors,
    map: fabric ? fabricTexture(fabric) : null,
  });
  if (tone !== "skin") pastelize(m, tone === "hair" ? PASTEL_HAIR : PASTEL_CLOTH);
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

/** 着ぐるみの色（体・おなか・耳の内がわ・しっぽ）。 */
const KIG_COLORS: Record<Kigurumi, { main: string; belly: string; inner: string; tail: string }> = {
  bear: { main: "#9a6a48", belly: "#f0d9b8", inner: "#e2b98f", tail: "#9a6a48" },
  cat: { main: "#f0b25e", belly: "#fff4e2", inner: "#f7a8b8", tail: "#f0b25e" },
  rabbit: { main: "#f6f3ee", belly: "#ffffff", inner: "#f7b2c0", tail: "#ffffff" },
};

/** 着ぐるみのときの色（null なら使わない）。髪・人の耳・ふつうの服の小物は かくす。 */
function kigurumiColor(name: string, cfg: AvatarConfig): string | null {
  const kind = cfg.kigurumi ?? "bear";
  const k = KIG_COLORS[kind];
  const side = name.replace(/_[LR]$/, "");
  switch (side) {
    case "top_torso":
      return cfg.figure === "f" ? null : k.main;
    case "top_torsoF":
      return cfg.figure === "f" ? k.main : null;
    case "sleeve":
    case "bottom_hips":
    case "leg":
    case "hand":
      return k.main;
    case "shoe":
      return shade(k.main, 0.82);
    case "glasses_frame":
      return cfg.glasses ? "#2a2d35" : null;
    case "kig_belly":
      return k.belly;
    default:
      if (name === `kig_hood_${kind}`) return k.main;
      if (name === `kig_inner_${kind}`) return k.inner;
      if (name === `kig_tail_${kind}`) return k.tail;
      return null;
  }
}

/** 寝巻きのときの色（上下 同じ色・はだし）。 */
function pajamaColor(name: string, cfg: AvatarConfig): string | null {
  const c = cfg.pajama ?? "#a9cdeb";
  const side = name.replace(/_[LR]$/, "");
  switch (side) {
    case "top_torso":
      return cfg.figure === "f" ? null : c;
    case "top_torsoF":
      return cfg.figure === "f" ? c : null;
    case "sleeve":
    case "bottom_hips":
    case "leg":
      return c;
    case "hand":
    case "ear":
    case "skin_foot":
      return cfg.skin;
    case "glasses_frame":
      return cfg.glasses ? "#2a2d35" : null;
    case "acc_flowerPetals":
    case "acc_flowerCenter":
    case "acc_ribbon":
      return null;
    default:
      if (name === `hair_${cfg.hairStyle}`) return cfg.hair;
      if (name === `acc_tie_${cfg.hairStyle}`) return shade(cfg.hair, 0.7);
      if (name === `acc_clip_${cfg.hairStyle}`) return "#f2c14e";
      if (name === `acc_band_${cfg.hairStyle}`) return "#f3e3c8";
      return null;
  }
}

/** 部品の名前 → 色（null なら この設定では使わない）。 */
function colorFor(name: string, cfg: AvatarConfig): string | null {
  if (cfg.outfit === "kigurumi") return kigurumiColor(name, cfg);
  if (cfg.outfit === "pajama") return pajamaColor(name, cfg);
  if (name.startsWith("kig_")) return null;
  {
    // くつ（形を えらぶ）。着ぐるみでないときは、まるい「shoe」は使わない
    const st = shoeTypeOf(cfg);
    const shoe = cfg.shoes ?? SHOE_DEFAULT[st];
    const sd = name.replace(/_[LR]$/, "");
    if (sd === "shoe") return null;
    if (sd === "shoe_leather") return st === "leather" ? shoe : null;
    if (sd === "shoe_sneaker") return st === "sneaker" ? shoe : null;
    if (sd === "white_sneakerSole") return st === "sneaker" ? "#f6f6f4" : null;
    if (sd === "shoe_sandal") return st === "sandal" ? shoe : null;
    if (sd === "dark_sandalSole") return st === "sandal" ? "#d8c09a" : null;
    if (sd === "skin_foot") return st === "sandal" ? cfg.skin : null;
  }
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
      // ヘアピン（黄色）・カチューシャ（クリーム色）
      if (name === `acc_clip_${cfg.hairStyle}`) return "#f2c14e";
      if (name === `acc_band_${cfg.hairStyle}`) return "#f3e3c8";
      return null;
  }
}

/** 部品の名前 → 布の模様（スーツは ツイル・パーカーは ニット・ふだんのズボンは デニム・ふだんのスカートは チェック）。 */
function fabricFor(name: string, cfg: AvatarConfig): Fabric | undefined {
  if (cfg.outfit === "kigurumi") return undefined;
  if (cfg.outfit === "pajama") return "check";
  const suit = cfg.outfit === "suit";
  const side = name.replace(/_[LR]$/, "");
  if (side === "top_torso" || side === "top_torsoF" || side === "sleeve" || side === "top_suitHem")
    return suit ? "twill" : "knit";
  if (side === "bottom_hips" || (side === "leg" && bottomOf(cfg) === "pants"))
    return suit ? "twill" : "denim";
  if (side === "bottom_skirt") return suit ? "twill" : "check";
  return undefined;
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
      isHair
        ? softMaterial(boost(color, 1.25), true, undefined, "hair")
        : softMaterial(color, false, fabricFor(name, cfg), color === cfg.skin ? "skin" : "cloth"),
    );
    m.name = name;
    if (/^(sleeve|hand|cuff)_L$/.test(name)) {
      out.armL.push(m);
    } else if (/^(sleeve|hand|cuff)_R$/.test(name)) {
      out.armR.push(m);
    } else if (/^(leg|shoe\w*|white_sneakerSole|dark_sandalSole|skin_foot)_L$/.test(name)) {
      out.legL.push(m);
    } else if (/^(leg|shoe\w*|white_sneakerSole|dark_sandalSole|skin_foot)_R$/.test(name)) {
      out.legR.push(m);
    } else if (/^(hair_|ear_|glasses_|acc_|kig_hood_|kig_inner_)/.test(name)) {
      m.position.copy(src.position).sub(joints.head);
      out.head.push(m);
    } else {
      m.position.copy(src.position);
      out.body.push(m);
    }
  });
  return out;
}
