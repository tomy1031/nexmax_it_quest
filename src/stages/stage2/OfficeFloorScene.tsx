import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import charactersJson from "@content/characters.json";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/props";
import { LaptopScreen } from "@/factory/small-parts";
import { drawRuby, FONT_FAMILY } from "@/factory/text-canvas";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/lib/store";
import { t } from "@/lib/t";
import { usePlay } from "@/stages/play-store";
import { Chibi } from "@/three/Chibi";
import { npcLook } from "@/three/Crowd";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import type { Rect, V3 } from "@/three/layout";

/**
 * ネクストメイクの オフィス（7階。docs/design/03_ステージ2.md §6）。明るい 春の 朝。
 * つくえの 島が 2つ（ノートパソコン）・ヘンディさんの 席・自分の 席（my-desk。パソコンが 光る）・植木・窓・
 * エレベーターの 戸（はじめに 立つ 所）・おくの かべに「会議室A」の 戸（door-a。上に 看板）。名前の 無い 社員が 3人。
 */

const LOOKS = charactersJson.characters as unknown as { id: string; look: AvatarConfig }[];
const HENDY = { ...DEFAULT_AVATAR, ...LOOKS.find((c) => c.id === "hendy")!.look, bag: false };

/** 島の まん中（x）。1つの 島に つくえ 4つ（2つずつ 向かい合う）。 */
const ISLANDS = [-3.4, 1.0];
const DESK_DX = [-0.8, 0.8];
/** 手前の 列（人は +z 側に 座る）と おくの 列（-z 側に 座る）。 */
const FRONT_Z = 0.4;
const BACK_Z = -0.4;
const HENDY_DESK: [number, number] = [ISLANDS[0]! + DESK_DX[1]!, FRONT_Z];
const MY_DESK: [number, number] = [ISLANDS[1]! + DESK_DX[1]!, FRONT_Z];
const DOOR_A_X = 4.6;

const WALK: Rect[] = [{ minX: -6.5, maxX: 6.5, minZ: -4.5, maxZ: 4.5 }];
const BLOCKS: Rect[] = ISLANDS.flatMap((cx) => [
  { minX: cx - 1.6, maxX: cx + 1.6, minZ: -0.8, maxZ: 0.8 },
  // いす
  { minX: cx - 1.6, maxX: cx + 1.6, minZ: 0.85, maxZ: 1.35 },
  { minX: cx - 1.6, maxX: cx + 1.6, minZ: -1.35, maxZ: -0.85 },
]);

function useWaiting(id: string): boolean {
  return usePlay((s) => s.waitingFor === `click:${id}`);
}

export function OfficeFloorScene() {
  useSceneLayout({
    anchors: {
      elevator: { pos: [3.2, 0, 2.1], yaw: -Math.PI / 2 },
    },
    walk: WALK,
    blocks: BLOCKS,
    shots: {
      hendy: { pos: [HENDY_DESK[0] + 1.5, 1.55, 4.3], look: [HENDY_DESK[0], 0.75, 1.6], fov: 48 },
      "my-desk": { pos: [MY_DESK[0] + 0.15, 1.3, 1.9], look: [MY_DESK[0], 0.8, 0.3], fov: 46 },
    },
    camera: { mode: "follow", distance: 3.8, height: 2.0 },
    bounds: { minX: -6.8, maxX: 6.8, minZ: -4.8, maxZ: 4.8, maxY: 3.1 },
    showPlayer: true,
  });

  const line = usePlay((s) => s.line);
  const showHendy = useWaiting("hendy");
  const showDesk = useWaiting("my-desk");
  const showDoor = useWaiting("door-a");

  const geo = useMemo(
    () =>
      merge([
        box(14, 0.1, 10, "#e3d6c0", { pos: [0, -0.05, 0] }),
        box(14, 0.1, 10, "#f8f6f1", { pos: [0, 3.3, 0] }),
        // おくの かべ（会議室A の 戸の 所は あける）
        box(DOOR_A_X - 0.55 + 7, 3.3, 0.2, "#eef3ee", {
          pos: [(-7 + DOOR_A_X - 0.55) / 2, 1.65, -5],
        }),
        box(7 - DOOR_A_X - 0.55, 3.3, 0.2, "#eef3ee", {
          pos: [(7 + DOOR_A_X + 0.55) / 2, 1.65, -5],
        }),
        box(1.1, 1.1, 0.2, "#eef3ee", { pos: [DOOR_A_X, 2.75, -5] }),
        box(0.2, 3.3, 10, "#eef3ee", { pos: [7, 1.65, 0] }),
        // 左の かべ（窓）
        box(0.2, 0.9, 10, "#eef3ee", { pos: [-7, 0.45, 0] }),
        box(0.2, 0.6, 10, "#eef3ee", { pos: [-7, 3.0, 0] }),
        ...[-3.4, -1, 1.4, 3.8].map((z) => box(0.22, 1.8, 0.2, "#dde3dc", { pos: [-7, 1.8, z] })),
        // 手前の かべ（エレベーター）
        box(14, 3.3, 0.2, "#eef3ee", { pos: [0, 1.65, 5] }),
        // 床の 通路
        box(12.6, 0.01, 1.2, "#d2c4ab", { pos: [0, 0.006, 2.6] }),
        box(1.2, 0.01, 4.0, "#d2c4ab", { pos: [DOOR_A_X, 0.006, -2.6] }),
        // コピー機の ような 台
        block(1.0, 0.95, 0.6, "#dfe3e8", { pos: [6.2, 0, 1.6] }),
      ]),
    [],
  );

  // つくえと いす（手前の 列は 人が +z 側、おくの 列は -z 側）
  const desks = ISLANDS.flatMap((cx) =>
    DESK_DX.flatMap((dx) => [
      { x: cx + dx, z: FRONT_Z, back: false },
      { x: cx + dx, z: BACK_Z, back: true },
    ]),
  );

  return (
    <>
      <Lights preset="room" />
      <color attach="background" args={["#e8f3f6"]} />
      <mesh geometry={geo} material={FLAT} />
      <WalkSurface size={[14, 10]} center={[0, 0]} />

      {/* 窓の 外（春の 空） */}
      <mesh position={[-7.15, 1.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 1.8]} />
        <meshBasicMaterial color="#bfe3fb" />
      </mesh>

      {desks.map((d) => (
        <group key={`${d.x},${d.z}`}>
          <Prop url="home/desk" position={[d.x, 0, d.z]} />
          <Prop
            url="home/chair"
            position={[d.x, 0, d.z + (d.back ? -0.85 : 0.85)]}
            rotationY={d.back ? 0 : Math.PI}
          />
          {!(d.x === MY_DESK[0] && d.z === MY_DESK[1]) && (
            <Prop
              url="home/laptop"
              position={[d.x, 0.72, d.z + (d.back ? 0.05 : -0.05)]}
              rotationY={d.back ? Math.PI : 0}
            />
          )}
        </group>
      ))}
      <Prop url="home/mug" position={[HENDY_DESK[0] + 0.5, 0.72, HENDY_DESK[1]]} />

      {/* 名前の 無い 社員（座って いる 2人・歩いて いる 1人） */}
      <Suspense fallback={null}>
        {[
          { x: ISLANDS[0]! + DESK_DX[0]!, i: 4 },
          { x: ISLANDS[1]! + DESK_DX[0]!, i: 7 },
        ].map((p) => (
          <group key={p.x} position={[p.x, 0, BACK_Z - 0.85]}>
            <Chibi
              config={{ ...npcLook(p.i, "suit"), bag: false }}
              motion="sitting"
              phase={p.i * 0.2}
            />
          </group>
        ))}
        <Strolling />
      </Suspense>

      <Prop url="home/plant" position={[-6.4, 0, -4.4]} />
      <Prop url="home/plant" position={[6.4, 0, -4.4]} />
      <Prop url="home/plant" position={[-6.4, 0, 4.4]} scale={0.8} />
      <Prop url="station/wall-clock" position={[0, 0.4, -4.88]} />

      {/* エレベーターの 戸（はじめに 立つ 所の うしろ） */}
      <mesh position={[3.2, 1.1, 4.88]}>
        <boxGeometry args={[1.2, 2.2, 0.06]} />
        <meshStandardMaterial color="#b9bec6" metalness={0.3} roughness={0.45} />
      </mesh>
      <CanvasPanel
        width={1.6}
        height={0.42}
        position={[-1.5, 2.3, 4.88]}
        rotation={[0, Math.PI, 0]}
        fontText={t("s2.officeSign")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#235d6e";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("s2.officeSign"), w / 2, h * 0.72, {
            size: h * 0.42,
            color: "#ffffff",
            align: "center",
          });
        }}
      />

      {/* ヘンディさん（自分の 席の 横に 立って いる） */}
      <Interactable
        id="hendy"
        approach={[HENDY_DESK[0] + 0.2, 2.35]}
        marker={[HENDY_DESK[0], 1.75, 1.6]}
        disabled={!showHendy}
      >
        <group position={[HENDY_DESK[0], 0, 1.6]} rotation={[0, 0.25, 0]}>
          <Suspense fallback={null}>
            <Chibi
              config={HENDY}
              motion={line?.who === "hendy" ? "talking" : "idle"}
              expression="happy"
            />
          </Suspense>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.6, 1.4, 0.6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </Interactable>

      {/* 自分の 席（パソコンが 光る） */}
      <Interactable
        id="my-desk"
        approach={[MY_DESK[0], 1.7]}
        marker={[MY_DESK[0], 1.15, MY_DESK[1]]}
        disabled={!showDesk}
      >
        <Prop url="home/laptop" position={[MY_DESK[0], 0.72, MY_DESK[1] - 0.05]} />
        <LaptopScreen
          position={[MY_DESK[0], 0.72, MY_DESK[1] - 0.05]}
          ppm={900}
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#1b2a5c";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(w * 0.32, h * 0.1, w * 0.62, h * 0.8);
            ctx.fillStyle = "#38e1ff";
            ctx.font = `800 ${h * 0.1}px ${FONT_FAMILY}`;
            ctx.fillText("NMChat", w * 0.035, h * 0.2);
            ctx.fillStyle = "#ffd23f";
            ctx.fillRect(w * 0.04, h * 0.36, w * 0.24, h * 0.08);
            ctx.fillStyle = "#e25868";
            ctx.beginPath();
            ctx.arc(w * 0.9, h * 0.16, h * 0.06, 0, Math.PI * 2);
            ctx.fill();
          }}
        />
        <mesh position={[MY_DESK[0], 0.95, MY_DESK[1]]}>
          <boxGeometry args={[1.2, 0.5, 0.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      {/* 会議室A の 戸と 看板 */}
      <CanvasPanel
        width={1.3}
        height={0.42}
        position={[DOOR_A_X, 2.5, -4.88]}
        fontText={t("s2.signRoomA")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#2f5d50";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("s2.signRoomA"), w / 2, h * 0.78, {
            size: h * 0.5,
            color: "#ffffff",
            align: "center",
          });
        }}
      />
      <Interactable
        id="door-a"
        approach={[DOOR_A_X, -4.1]}
        marker={[DOOR_A_X, 1.9, -4.8]}
        disabled={!showDoor}
      >
        <mesh position={[DOOR_A_X, 1.1, -4.95]}>
          <boxGeometry args={[1.0, 2.2, 0.08]} />
          <meshStandardMaterial color="#b88b5e" />
        </mesh>
        <mesh position={[DOOR_A_X + 0.35, 1.05, -4.88]}>
          <boxGeometry args={[0.06, 0.2, 0.06]} />
          <meshStandardMaterial color="#e0c27a" metalness={0.5} roughness={0.3} />
        </mesh>
      </Interactable>
      <Ready />
    </>
  );
}

/** 通路を 行ったり 来たり する 社員（名前の 無い 人）。 */
function Strolling() {
  const ref = useRef<THREE.Group>(null);
  const look = useMemo(() => ({ ...npcLook(10, "suit"), bag: false }), []);
  const path: [V3, V3] = [
    [-5.6, 0, 3.4],
    [1.6, 0, 3.4],
  ];
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const span = path[1][0] - path[0][0];
    const tt = (s.clock.elapsedTime * 0.7) % (span * 2);
    const forward = tt < span;
    g.position.x = path[0][0] + (forward ? tt : span * 2 - tt);
    g.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={ref} position={path[0]}>
      <Chibi config={look} motion="walk" holding="coffee" />
    </group>
  );
}
