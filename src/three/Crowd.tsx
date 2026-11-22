import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { DEFAULT_AVATAR, useSettings, type AvatarConfig } from "@/lib/store";
import { Chibi, type ChibiHolding, type ChibiMotion } from "@/three/Chibi";

/**
 * まわりの人（ちびキャラ。色・髪型・身長をばらけさせる）。
 * 「かるい」設定では人数を半分にする。stare が true のとき、こちら（カメラ）へ顔を向ける。
 */
export interface NpcSpec {
  pos: [number, number, number];
  yaw?: number;
  /** ふだんの服にするか（スーツでない人）。 */
  casual?: boolean;
  look?: Partial<AvatarConfig>;
  motion?: ChibiMotion;
  /** 手に持つ物。null なら何も持たない。無ければ、人ごとに決まった物を持つ。 */
  holding?: ChibiHolding | null;
}

/** 人ごとに決まる、持ち物（スーツの人はカバン・ふだんの服の人はスマホかコーヒー）。 */
export function npcHolding(i: number, outfit: "suit" | "casual"): ChibiHolding | undefined {
  if (outfit === "suit") return i % 3 === 0 ? "briefcase" : i % 5 === 1 ? "phone" : undefined;
  return i % 2 === 0 ? "phone" : i % 5 === 3 ? "coffee" : undefined;
}

const SKINS = ["#f1c9a5", "#e0ac83", "#c68e64", "#a8714a", "#8a5a3b"];
const HAIRS = ["#2e211b", "#4a3326", "#5e4030", "#6b4a36", "#6a6a6a", "#3a2820"];
const SUITS = ["#1c1e24", "#232f52", "#3a3d45", "#4b505a"];
const COATS = ["#8a8f98", "#3b6ea5", "#9c3b3b", "#4e7d4e", "#d8c3a5", "#2b2b2b"];

const STYLES: AvatarConfig["hairStyle"][] = [
  "model",
  "bob",
  "wavy",
  "spiky",
  "long",
  "side",
  "ponytail",
  "curly",
  "bun",
  "twin",
];
const EYES: AvatarConfig["eyes"][] = ["round", "smile", "calm", "sparkle"];

export function npcLook(i: number, outfit: "suit" | "casual"): AvatarConfig {
  return {
    ...DEFAULT_AVATAR,
    outfit,
    figure: i % 3 === 1 ? "f" : "m",
    hairStyle: STYLES[(i * 5) % STYLES.length]!,
    eyes: EYES[(i * 3) % EYES.length]!,
    height: 156 + ((i * 7) % 26),
    glasses: i % 5 === 2,
    skin: SKINS[i % SKINS.length]!,
    hair: HAIRS[(i * 7) % HAIRS.length]!,
    suit: SUITS[(i * 3) % SUITS.length]!,
    tie: ["#7a1c2b", "#1f3f7a", "#2d5e3a", "#444"][i % 4]!,
    coat: COATS[(i * 5) % COATS.length]!,
    accessory: i % 3 === 1 ? (["none", "flower", "ribbon"] as const)[(i * 7) % 3]! : "none",
    bag: i % 4 !== 2,
  };
}

export function Crowd({ people, stare = false }: { people: NpcSpec[]; stare?: boolean }) {
  const low = useSettings((s) => s.quality) === "low";
  const list = low ? people.filter((_, i) => i % 2 === 0) : people;
  return (
    <>
      {list.map((p, i) => (
        <Npc key={i} spec={p} index={i} stare={stare} />
      ))}
    </>
  );
}

function Npc({ spec, index, stare }: { spec: NpcSpec; index: number; stare: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cfg = useMemo<AvatarConfig>(() => {
    const base = npcLook(index, spec.casual || index % 4 === 3 ? "casual" : "suit");
    return { ...base, ...spec.look };
  }, [index, spec.casual, spec.look]);
  const holding =
    spec.holding === null ? undefined : (spec.holding ?? npcHolding(index, cfg.outfit));
  // スマホを持っている人は、立っている間スマホを見る
  const still: ChibiMotion = spec.motion ?? (holding === "phone" ? "phone" : "idle");
  const baseYaw = spec.yaw ?? 0;
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    let want = baseYaw;
    if (stare) {
      tmp.copy(s.camera.position).sub(g.position);
      want = Math.atan2(tmp.x, tmp.z);
    }
    let diff = want - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, dt * 6);
  });

  return (
    <group ref={group} position={spec.pos} rotation={[0, baseYaw, 0]}>
      <Suspense fallback={null}>
        <Chibi
          config={cfg}
          motion={stare ? "surprised" : still}
          phase={(index * 0.37) % 1}
          holding={stare && holding === "phone" ? undefined : holding}
          expression={stare ? "surprised" : "normal"}
        />
      </Suspense>
      {stare && <Exclaim />}
    </group>
  );
}

function Exclaim() {
  const ref = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff3b2f";
      ctx.font = "900 96px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", 64, 98);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = 1.45 + Math.sin(s.clock.elapsedTime * 8) * 0.04;
  });
  return (
    <sprite ref={ref} position={[0, 1.45, 0]} scale={[0.32, 0.32, 0.32]} raycast={() => null}>
      <spriteMaterial map={tex} depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/** 道を行き来する人。from と to の間を歩き、はしで向きを変える。 */
export interface WalkerSpec {
  from: [number, number];
  to: [number, number];
  speed?: number;
  /** 0〜1。はじめにどこにいるか。 */
  at?: number;
  casual?: boolean;
  look?: Partial<AvatarConfig>;
  holding?: ChibiHolding | null;
}

/** 歩く人の持ち物（歩きスマホはしない。カバンかコーヒーだけ）。 */
function walkerHolding(i: number, outfit: "suit" | "casual"): ChibiHolding | undefined {
  if (outfit === "suit") return i % 2 === 0 ? "briefcase" : undefined;
  return i % 3 === 1 ? "coffee" : undefined;
}

export function Walkers({ people, seed = 0 }: { people: WalkerSpec[]; seed?: number }) {
  const low = useSettings((s) => s.quality) === "low";
  const list = low ? people.filter((_, i) => i % 2 === 0) : people;
  return (
    <>
      {list.map((p, i) => (
        <Walker key={i} spec={p} index={i + seed} />
      ))}
    </>
  );
}

function Walker({ spec, index }: { spec: WalkerSpec; index: number }) {
  const group = useRef<THREE.Group>(null);
  const cfg = useMemo<AvatarConfig>(() => {
    const base = npcLook(index, (spec.casual ?? index % 3 === 0) ? "casual" : "suit");
    return { ...base, ...spec.look };
  }, [index, spec.casual, spec.look]);
  const st = useRef({ u: spec.at ?? 0, dir: 1 });
  const len = Math.hypot(spec.to[0] - spec.from[0], spec.to[1] - spec.from[1]) || 1;
  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    s.u += (s.dir * (spec.speed ?? 1.1) * dt) / len;
    if (s.u > 1) {
      s.u = 1;
      s.dir = -1;
    } else if (s.u < 0) {
      s.u = 0;
      s.dir = 1;
    }
    const dx = (spec.to[0] - spec.from[0]) * s.dir;
    const dz = (spec.to[1] - spec.from[1]) * s.dir;
    g.position.set(
      spec.from[0] + (spec.to[0] - spec.from[0]) * s.u,
      0,
      spec.from[1] + (spec.to[1] - spec.from[1]) * s.u,
    );
    const want = Math.atan2(dx, dz);
    let diff = want - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, dt * 8);
  });
  return (
    <group ref={group} position={[spec.from[0], 0, spec.from[1]]}>
      <Suspense fallback={null}>
        <Chibi
          config={cfg}
          motion="walk"
          phase={(index * 0.29) % 1}
          holding={
            spec.holding === null ? undefined : (spec.holding ?? walkerHolding(index, cfg.outfit))
          }
        />
      </Suspense>
    </group>
  );
}
