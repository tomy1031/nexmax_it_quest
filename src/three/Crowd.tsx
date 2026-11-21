import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { DEFAULT_AVATAR, useSettings, type AvatarConfig } from "@/lib/store";
import { Avatar, type Motion } from "@/three/Avatar";
import type { ModelKey } from "@/three/avatar-model";

/**
 * まわりの人。同じモデルを色ちがいで使う（モデルの数を増やさず、にぎやかに見せる）。
 * 「かるい」設定では人数を半分にする。stare が true のとき、こちら（カメラ）へ顔を向ける。
 */
export interface NpcSpec {
  pos: [number, number, number];
  yaw?: number;
  model?: ModelKey;
  look?: Partial<AvatarConfig>;
  motion?: Motion;
}

const SKINS = ["#f1c9a5", "#e0ac83", "#c68e64", "#a8714a", "#8a5a3b"];
const HAIRS = ["#1d1612", "#2b1d14", "#4a3020", "#6a6a6a", "#1a1a1a"];
const SUITS = ["#1c1e24", "#232f52", "#3a3d45", "#4b505a"];
const COATS = ["#8a8f98", "#3b6ea5", "#9c3b3b", "#4e7d4e", "#d8c3a5", "#2b2b2b"];

export function npcLook(i: number, outfit: "suit" | "casual"): AvatarConfig {
  return {
    ...DEFAULT_AVATAR,
    outfit,
    figure: i % 3 === 1 ? "f" : "m",
    skin: SKINS[i % SKINS.length]!,
    hair: HAIRS[(i * 7) % HAIRS.length]!,
    suit: SUITS[(i * 3) % SUITS.length]!,
    tie: ["#7a1c2b", "#1f3f7a", "#2d5e3a", "#444"][i % 4]!,
    coat: COATS[(i * 5) % COATS.length]!,
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
    const base = npcLook(index, spec.model?.startsWith("casual") ? "casual" : "suit");
    return { ...base, ...spec.look };
  }, [index, spec.model, spec.look]);
  const model: ModelKey =
    spec.model ?? (index % 4 === 3 ? "casual-m" : cfg.figure === "f" ? "suit-f" : "suit-m");
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
        <Avatar
          config={cfg}
          model={model}
          motion={spec.motion ?? "idle"}
          phase={(index * 0.37) % 1}
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
    if (ref.current) ref.current.position.y = 2.05 + Math.sin(s.clock.elapsedTime * 8) * 0.04;
  });
  return (
    <sprite ref={ref} position={[0, 2.05, 0]} scale={[0.32, 0.32, 0.32]} raycast={() => null}>
      <spriteMaterial map={tex} depthTest={false} toneMapped={false} />
    </sprite>
  );
}
