import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import charactersJson from "@content/characters.json";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { ListeningBoard3D } from "@/factory/ListeningBoard3D";
import { block, box, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/props";
import { drawRuby, FONT_FAMILY } from "@/factory/text-canvas";
import { playSfx } from "@/lib/audio";
import { useListeningStage } from "@/lib/listening/stage-store";
import { assignSeats, classmateLook, fetchClassmates, type Classmate } from "@/lib/classmates";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/lib/store";
import { t } from "@/lib/t";
import { onFx, questEvents } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { Chibi } from "@/three/Chibi";
import { npcLook } from "@/three/Crowd";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import { useLayout, type Rect } from "@/three/layout";

/**
 * 第2章（会社に 着いてから）。企画メモ「#入社式」と tomy さんの指示（2026-11-23）:
 *   1階の 受付で 名前を 言う（マイク）→ おじぎ → エレベーターで 7階へ（「G」の ボタンが 無い）
 *   → 会場で ヘンディさんに「おはようございます」（ここから Gemini Live）→ 質問に 答える → 席に すわる → ヘンディさんの あいさつ
 * 会社は 実際に 7階（docs/research の 会社の 住所）。受付の 人・会場の 人は 名前の 無い 人（ヘンディさん以外）。
 */

const HENDY = charactersJson.characters[0]!.look as AvatarConfig;

/** 受付の 人（名前の 無い 人。会社の 制服の 色）。 */
const RECEPTIONIST: AvatarConfig = {
  ...DEFAULT_AVATAR,
  outfit: "suit",
  figure: "f",
  hairStyle: "bun",
  hair: "#3a2618",
  skin: "#f1c9a5",
  eyes: "smile",
  suit: "#5b7bb0",
  shirt: "#ffffff",
  tie: "#e9a0b4",
  pants: "#3a4660",
  height: 160,
  bag: false,
};

/** だれかが 台本を 待っているか（光の玉を その時だけ 出す）。 */
function useWaiting(id: string): boolean {
  return usePlay((s) => s.waitingFor === `click:${id}`);
}

// ── 1階（受付・エレベーター） ─────────────────────────────

const LOBBY_WALK: Rect[] = [{ minX: -5.6, maxX: 5.6, minZ: -4.6, maxZ: 4.6 }];
const LOBBY_BLOCKS: Rect[] = [
  { minX: -4.6, maxX: -1.8, minZ: -1.0, maxZ: -0.2 }, // 受付の カウンター
  { minX: -5.6, maxX: -1.6, minZ: -2.6, maxZ: -1.0 }, // カウンターの おく
  { minX: 4.2, maxX: 5.6, minZ: 1.0, maxZ: 3.0 }, // ベンチ
];
/** エレベーターの 中（ドアが あいたら 歩ける）。 */
const CAR: Rect = { minX: 1.85, maxX: 2.55, minZ: -6.2, maxZ: -4.3 };
const DOOR_X = 2.2;

export function OfficeLobbyScene() {
  useSceneLayout({
    anchors: {
      entrance: { pos: [0, 0, 2.6], yaw: Math.PI },
      "in-elevator": { pos: [DOOR_X, 0, -5.75], yaw: 0 },
    },
    walk: LOBBY_WALK,
    blocks: LOBBY_BLOCKS,
    shots: {
      reception: { pos: [-1.9, 1.45, 1.7], look: [-3.25, 0.55, -1.2], fov: 46 },
      "elevator-panel": { pos: [2.05, 1.3, -5.25], look: [2.94, 1.2, -5.3], fov: 42 },
    },
    camera: { mode: "follow", distance: 4.2, height: 2.6 },
    bounds: { minX: -5.8, maxX: 5.8, minZ: -6.4, maxZ: 4.85, maxY: 3.3 },
    showPlayer: true,
  });

  const [doorOpen, setDoorOpen] = useState(0);
  const [floor, setFloor] = useState(1);
  const [lit, setLit] = useState<string | null>(null);
  const openTarget = useRef(0);

  useEffect(
    () =>
      onFx((id) => {
        if (id === "elevator-open") {
          openTarget.current = 1;
          playSfx("pi");
          useLayout.setState((s) => ({ walk: [...s.walk.filter((r) => r !== CAR), CAR] }));
        }
        if (id === "elevator-go") {
          openTarget.current = 0;
          let f = 1;
          const tick = () => {
            f += 1;
            setFloor(f);
            if (f < 7) window.setTimeout(tick, 340);
            else playSfx("pi");
          };
          window.setTimeout(tick, 600);
        }
      }),
    [],
  );

  // ドアを なめらかに 開け閉め
  const doorRef = useRef(0);
  useFrame((_, dt) => {
    const want = openTarget.current;
    const next =
      doorRef.current +
      Math.sign(want - doorRef.current) * Math.min(dt * 1.6, Math.abs(want - doorRef.current));
    if (Math.abs(next - doorRef.current) > 1e-4) {
      doorRef.current = next;
      setDoorOpen(next);
    }
  });

  const geo = useMemo(
    () =>
      merge([
        // 床・天井・かべ
        box(12, 0.1, 10, "#e8e2d6", { pos: [0, -0.05, 0] }),
        box(12, 0.1, 10, "#f7f4ee", { pos: [0, 3.4, 0] }),
        box(0.2, 3.4, 10, "#efe9df", { pos: [-6, 1.7, 0] }),
        box(0.2, 3.4, 10, "#efe9df", { pos: [6, 1.7, 0] }),
        // おくの かべ（エレベーターの 所は あける）
        box(3.6, 3.4, 0.2, "#e9e3d8", { pos: [-4.2, 1.7, -5] }),
        box(1.8, 3.4, 0.2, "#e9e3d8", { pos: [-1.3, 1.7, -5] }),
        box(0.5, 3.4, 0.2, "#d8d2c6", { pos: [0.85, 1.7, -5] }),
        box(1.1, 1.2, 0.2, "#d8d2c6", { pos: [DOOR_X, 2.8, -5] }),
        box(2.5, 3.4, 0.2, "#d8d2c6", { pos: [4.65, 1.7, -5] }),
        // 入口の 側（ガラスの 入口の 左右）
        box(4.5, 3.4, 0.2, "#efe9df", { pos: [-3.75, 1.7, 5] }),
        box(4.5, 3.4, 0.2, "#efe9df", { pos: [3.75, 1.7, 5] }),
        box(3, 0.6, 0.2, "#efe9df", { pos: [0, 3.1, 5] }),
        // 床の 帯（入口から 受付へ）
        box(1.6, 0.012, 8, "#d4cab8", { pos: [0, 0.006, 0.6] }),
        // 受付の カウンター
        block(2.8, 0.78, 0.7, "#c9a77c", { pos: [-3.2, 0, -0.6] }),
        box(2.9, 0.06, 0.8, "#f4efe6", { pos: [-3.2, 0.81, -0.6] }),
        block(2.8, 0.06, 0.06, "#e7a86a", { pos: [-3.2, 0.4, -0.24] }),
        // 受付の うしろの 板
        block(3.4, 2.6, 0.12, "#41618f", { pos: [-3.2, 0, -2.5] }),
        // エレベーターの かご（中）
        box(1.6, 0.05, 1.8, "#cfc8bb", { pos: [DOOR_X, 0.02, -5.95] }),
        box(0.08, 2.4, 1.8, "#c8ccd3", { pos: [DOOR_X - 0.8, 1.2, -5.95] }),
        box(0.08, 2.4, 1.8, "#c8ccd3", { pos: [DOOR_X + 0.8, 1.2, -5.95] }),
        box(1.6, 2.4, 0.08, "#c8ccd3", { pos: [DOOR_X, 1.2, -6.85] }),
        box(1.6, 0.06, 1.8, "#f3f5f8", { pos: [DOOR_X, 2.4, -5.95] }),
        // もう1台の エレベーター（しまっている）
        box(1.0, 2.2, 0.06, "#b9bec6", { pos: [4.4, 1.1, -4.88] }),
        box(0.02, 2.2, 0.065, "#8d939c", { pos: [4.4, 1.1, -4.86] }),
        // ベンチの 横の 台
        block(0.5, 0.5, 0.5, "#c9a77c", { pos: [5.2, 0, 3.4] }),
      ]),
    [],
  );

  const doorGeo = useMemo(() => new THREE.BoxGeometry(0.55, 2.2, 0.06), []);
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#b9bec6", metalness: 0.3, roughness: 0.45 }),
    [],
  );

  const showReception = useWaiting("reception");
  const showElevator = useWaiting("elevator");

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#dfe9f2"]} />
      <mesh geometry={geo} material={FLAT} />
      <WalkSurface size={[12, 12]} center={[0, -0.6]} />

      {/* ガラスの 入口 */}
      <mesh position={[0, 1.4, 5]}>
        <boxGeometry args={[3, 2.8, 0.05]} />
        <meshStandardMaterial color="#cfe9f7" transparent opacity={0.35} />
      </mesh>

      {/* 受付 */}
      <CanvasPanel
        width={1.6}
        height={0.62}
        position={[-3.2, 2.05, -2.43]}
        fontText={t("office.reception")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#41618f";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("office.reception"), w / 2, h * 0.66, {
            size: h * 0.42,
            color: "#ffffff",
            align: "center",
          });
          ctx.font = `800 ${h * 0.14}px ${FONT_FAMILY}`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText("RECEPTION", w / 2, h * 0.9);
        }}
      />
      <Interactable
        id="reception"
        approach={[-3.2, 0.35]}
        marker={[-3.2, 2.0, -1.5]}
        disabled={!showReception}
      >
        <group position={[-3.2, 0.22, -1.3]}>
          <Suspense fallback={null}>
            <Chibi config={RECEPTIONIST} motion="idle" expression="happy" />
          </Suspense>
        </group>
        <mesh position={[-3.2, 0.9, -0.9]}>
          <boxGeometry args={[2.8, 1.8, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <Prop url="home/plant" position={[-5.4, 0, -4.4]} />
      <Prop url="home/plant" position={[2.6, 0, 4.4]} />
      <Prop url="home/plant" position={[-2.6, 0, 4.4]} />
      <Prop url="station/bench" position={[4.9, 0, 2]} rotationY={-Math.PI / 2} />
      <Prop url="station/wall-clock" position={[-1.3, 2.6, -4.88]} />

      {/* フロアの 案内 */}
      <CanvasPanel
        width={1.3}
        height={0.5}
        position={[-1.3, 1.7, -4.88]}
        fontText={t("office.floorGuide")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#2f3a5e";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("office.floorGuide"), w / 2, h * 0.7, {
            size: h * 0.34,
            color: "#ffffff",
            align: "center",
          });
        }}
      />

      {/* エレベーター（手前の 1台が 開く） */}
      <mesh
        geometry={doorGeo}
        material={doorMat}
        position={[DOOR_X - 0.275 - doorOpen * 0.5, 1.1, -4.9]}
      />
      <mesh
        geometry={doorGeo}
        material={doorMat}
        position={[DOOR_X + 0.275 + doorOpen * 0.5, 1.1, -4.9]}
      />
      <FloorLamp position={[DOOR_X, 2.45, -4.88]} floor={floor} />
      <FloorLamp position={[4.4, 2.45, -4.88]} floor={1} />
      <Interactable
        id="elevator"
        approach={[DOOR_X, -4.0]}
        marker={[3.3, 1.75, -4.8]}
        disabled={!showElevator}
      >
        <mesh position={[3.3, 1.15, -4.88]}>
          <boxGeometry args={[0.16, 0.3, 0.04]} />
          <meshStandardMaterial color="#9aa1ab" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[3.3, 1.19, -4.855]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color={doorOpen > 0.1 ? "#ffb347" : "#f4f4f4"} toneMapped={false} />
        </mesh>
        <mesh position={[3.3, 1.1, -4.8]}>
          <boxGeometry args={[0.6, 0.8, 0.3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      {/* かごの 中の ボタン（右の かべ） */}
      <CarPanel
        floor={floor}
        lit={lit}
        onPress={(label) => {
          if (usePlay.getState().waitingFor !== "floor:7") return;
          playSfx("click");
          if (label === "7") {
            setLit("7");
            questEvents.emit("floor:7");
          } else {
            questEvents.emit("floor:wrong");
          }
        }}
      />
      <Ready />
    </>
  );
}

/** ドアの 上の 階の ランプ。 */
function FloorLamp({ position, floor }: { position: [number, number, number]; floor: number }) {
  return (
    <CanvasPanel
      width={0.4}
      height={0.18}
      position={position}
      deps={[floor]}
      emissive
      draw={(ctx, w, h) => {
        ctx.fillStyle = "#1b1f27";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ffb347";
        ctx.font = `800 ${h * 0.72}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(floor), w / 2, h * 0.55);
      }}
    />
  );
}

/** かごの 中の 操作の 板。上から 6・7 / 4・5 / 2・3 / B1・1。「G」は 無い（日本の 1階が 地面の 階）。 */
const CAR_BUTTONS = [
  ["6", "7"],
  ["4", "5"],
  ["2", "3"],
  ["B1", "1"],
];

export function CarPanel({
  floor,
  lit,
  onPress,
  position = [DOOR_X + 0.75, 1.2, -5.3],
  rotation = [0, -Math.PI / 2, 0],
}: {
  floor: number;
  lit: string | null;
  onPress?: (label: string) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const W = 0.34;
  const H = 0.7;
  const rowTop = 0.3;
  const rowH = (0.92 - rowTop) / CAR_BUTTONS.length;
  return (
    <CanvasPanel
      width={W}
      height={H}
      position={position}
      rotation={rotation}
      deps={[floor, lit]}
      draw={(ctx, w, h) => {
        ctx.fillStyle = "#c9ced6";
        ctx.fillRect(0, 0, w, h);
        // 今の 階
        ctx.fillStyle = "#1b1f27";
        ctx.fillRect(w * 0.2, h * 0.05, w * 0.6, h * 0.16);
        ctx.fillStyle = "#ffb347";
        ctx.font = `800 ${h * 0.12}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(floor), w / 2, h * 0.135);
        CAR_BUTTONS.forEach((row, r) =>
          row.forEach((label, c) => {
            const cx = w * (c === 0 ? 0.32 : 0.68);
            const cy = h * (rowTop + rowH * (r + 0.5));
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.13, 0, Math.PI * 2);
            ctx.fillStyle = lit === label ? "#ffb347" : "#f4f5f7";
            ctx.fill();
            ctx.lineWidth = w * 0.015;
            ctx.strokeStyle = "#7d848e";
            ctx.stroke();
            ctx.fillStyle = "#1b1f27";
            ctx.font = `800 ${w * (label.length > 1 ? 0.1 : 0.13)}px ${FONT_FAMILY}`;
            ctx.fillText(label, cx, cy + w * 0.005);
          }),
        );
      }}
      onPick={(x, y) => {
        const w = W * 300;
        const h = H * 300;
        CAR_BUTTONS.forEach((row, r) =>
          row.forEach((label, c) => {
            const cx = w * (c === 0 ? 0.32 : 0.68);
            const cy = h * (rowTop + rowH * (r + 0.5));
            if (Math.hypot(x - cx, y - cy) < w * 0.16) onPress?.(label);
          }),
        );
      }}
    />
  );
}

// ── 7階（入社式の 会場） ─────────────────────────────────

/** 列（前 → 後ろ）。同じ 期生の 人が 多くても 座れるように 5列（40席）。 */
const ROWS = [-2.6, -1.35, -0.1, 1.15, 2.4];
const COLS = [-3.2, -2.4, -1.6, -0.8, 0.8, 1.6, 2.4, 3.2];
/** あいている 席（前の 席・後ろの 席）。 */
const SEAT_FRONT: [number, number] = [0.8, ROWS[0]!];
const SEAT_BACK: [number, number] = [0.8, ROWS[4]!];
const HALL_WALK: Rect[] = [{ minX: -4.6, maxX: 4.6, minZ: -4.0, maxZ: 5.4 }];
const HALL_BLOCKS: Rect[] = ROWS.flatMap((z) => [
  { minX: -3.5, maxX: -0.55, minZ: z - 0.28, maxZ: z + 0.28 },
  { minX: 0.55, maxX: 3.5, minZ: z - 0.28, maxZ: z + 0.28 },
]);
/** いすの 向き（モデルは +z が 前。π まわして、座る 面が 前の 台＝-z を 向くように）。 */
const CHAIR_YAW = Math.PI;
const HENDY_START: [number, number, number] = [2.4, 0, 3.9];
const HENDY_FRONT: [number, number, number] = [0, 0.25, -4.7];

export function OfficeHallScene() {
  useSceneLayout({
    anchors: {
      door: { pos: [3.5, 0, 5.2], yaw: Math.PI },
      "seat-front": { pos: [SEAT_FRONT[0], 0, SEAT_FRONT[1] + 0.05], yaw: Math.PI },
      "seat-front-stand": { pos: [0.05, 0, SEAT_FRONT[1]], yaw: Math.PI },
      "seat-back": { pos: [SEAT_BACK[0], 0, SEAT_BACK[1] + 0.05], yaw: Math.PI },
      "seat-back-stand": { pos: [0.05, 0, SEAT_BACK[1]], yaw: Math.PI },
    },
    walk: HALL_WALK,
    blocks: HALL_BLOCKS,
    shots: {
      hendy: { pos: [4.45, 1.3, 2.75], look: [2.7, 0.6, 4.25], fov: 50 },
      stage: { pos: [1.3, 1.75, -0.9], look: [0, 1.0, -4.7], fov: 46 },
      // リスニングの 間: 前の 台の ヘンディさんと 大きな 画面が 上の 55% に 入る（下は カード）
      speech: { pos: [0, 2.0, 0.6], look: [0, 0.3, -5.4], fov: 56 },
    },
    camera: { mode: "follow", distance: 4.0, height: 2.7 },
    bounds: { minX: -4.8, maxX: 4.8, minZ: -5.8, maxZ: 7.5, maxY: 3.6 },
    showPlayer: true,
  });

  const [hendyAt, setHendyAt] = useState<"door" | "front">("door");
  useEffect(
    () =>
      onFx((id) => {
        if (id === "hendy-front") setHendyAt("front");
      }),
    [],
  );
  const line = usePlay((s) => s.line);
  // リスニングの 声が 鳴っている 間も「話す 動き」
  const listening = useListeningStage((s) => s.id !== null);
  const listenTalking = useListeningStage((s) => s.speaking && s.speaker === "hendy");
  const hendyTalking = line?.who === "hendy" || listenTalking;
  const showHendy = useWaiting("hendy");
  const showSeats = useWaiting("seat-front");

  const geo = useMemo(
    () =>
      merge([
        box(10, 0.1, 13, "#d9cbb4", { pos: [0, -0.05, 0] }),
        box(10, 0.1, 13, "#f7f4ee", { pos: [0, 3.4, 0] }),
        box(0.2, 3.4, 13, "#f1ece3", { pos: [5, 1.7, 0] }),
        box(10, 3.4, 0.2, "#f1ece3", { pos: [0, 1.7, -6.1] }),
        // 左の かべ（窓）
        box(0.2, 0.9, 13, "#f1ece3", { pos: [-5, 0.45, 0] }),
        box(0.2, 0.7, 13, "#f1ece3", { pos: [-5, 3.05, 0] }),
        ...[-4, -1.5, 1, 3.5].map((z) => box(0.22, 1.8, 0.2, "#e2dccf", { pos: [-5, 1.8, z] })),
        // 入口の かべ（右の おくに ドア）
        box(7.6, 3.4, 0.2, "#f1ece3", { pos: [-1.2, 1.7, 6.4] }),
        box(1.2, 1.1, 0.2, "#f1ece3", { pos: [4.4, 2.85, 6.4] }),
        // 前の 台
        block(4.6, 0.25, 2.0, "#b8865a", { pos: [0, 0, -5.0] }),
        // 話す 台（ヘンディさんが かくれないように 横に）
        block(0.7, 0.95, 0.45, "#8c5d3b", { pos: [-1.3, 0.25, -4.5] }),
      ]),
    [],
  );

  // 同じ 学校・期生の メンバー（ログインして 学校と 期生を えらんでいる とき）。いなければ 名前の 無い 人で うめる
  const [mates, setMates] = useState<Classmate[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchClassmates().then((list) => alive && setMates(list));
    return () => {
      alive = false;
    };
  }, []);

  const people = useMemo(() => {
    // 座れる 席（後ろの 列から 前へ）。前の 列は 両はしだけ（前に すわる 人は 少ない）。
    const seats: [number, number][] = [];
    for (const z of [...ROWS].reverse()) {
      for (const x of COLS) {
        const target =
          (x === SEAT_FRONT[0] && z === SEAT_FRONT[1]) ||
          (x === SEAT_BACK[0] && z === SEAT_BACK[1]);
        const sparseFront = z === ROWS[0] && x !== -3.2 && x !== 3.2;
        if (!target && !sparseFront) seats.push([x, z]);
      }
    }
    if (mates && mates.length > 0) {
      return assignSeats(seats, mates).map(({ seat, who }) => ({
        pos: [seat[0], 0, seat[1] + 0.05] as [number, number, number],
        look: classmateLook(who),
        name: who.name,
      }));
    }
    if (mates === null) return [];
    // 名前の 無い 人（ログインしていない・同じ 期生の 人が いない とき）。前の 4列だけ
    return seats
      .filter(([, z]) => z !== ROWS[4])
      .map(([x, z], i) => ({
        pos: [x, 0, z + 0.05] as [number, number, number],
        look: { ...npcLook(i + 3, "suit"), bag: false },
        name: "",
      }));
  }, [mates]);

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#e4eef7"]} />
      <mesh geometry={geo} material={FLAT} />
      <WalkSurface size={[10, 12]} center={[0, 0.6]} />

      {/* 窓の 外（空） */}
      <mesh position={[-5.15, 1.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[13, 1.8]} />
        <meshBasicMaterial color="#bfe3fb" />
      </mesh>

      {/* 前の 画面（リスニングの 間は、いま 読んでいる 文を 虫食いで 出す） */}
      {listening ? (
        <ListeningBoard3D width={4.2} height={1.5} position={[0, 2.35, -5.98]} />
      ) : (
        <CanvasPanel
          width={4.2}
          height={1.5}
          position={[0, 2.35, -5.98]}
          fontText={t("office.ceremony") + t("office.welcome")}
          draw={(ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, "#2f5fb0");
            g.addColorStop(1, "#4f8fd8");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
            drawRuby(ctx, t("office.ceremony"), w / 2, h * 0.58, {
              size: h * 0.36,
              color: "#ffffff",
              align: "center",
            });
            drawRuby(ctx, t("office.welcome"), w / 2, h * 0.88, {
              size: h * 0.13,
              color: "#ffffff",
              align: "center",
            });
          }}
        />
      )}
      <Prop url="home/plant" position={[-2.1, 0.25, -5.4]} />
      <Prop url="home/plant" position={[2.1, 0.25, -5.4]} />

      {/* いす（キャスターの 無い いす。tomy さん 2026-11-23）と、すわっている 人 */}
      {ROWS.flatMap((z) =>
        COLS.map((x) => (
          <Prop
            key={`${x},${z}`}
            url="office/seminar-chair"
            position={[x, 0, z]}
            rotationY={CHAIR_YAW}
          />
        )),
      )}
      <Suspense fallback={null}>
        {people.map((p, i) => (
          <group key={i} position={p.pos}>
            <group rotation={[0, Math.PI, 0]}>
              <Chibi config={p.look} motion="sitting" phase={i * 0.37} />
            </group>
            {p.name && <NameTag name={p.name} />}
          </group>
        ))}
      </Suspense>

      {/* あいている 席 */}
      <Interactable
        id="seat-front"
        approach={[0.05, SEAT_FRONT[1]]}
        marker={[SEAT_FRONT[0], 1.25, SEAT_FRONT[1]]}
        disabled={!showSeats}
      >
        <mesh position={[SEAT_FRONT[0], 0.5, SEAT_FRONT[1]]}>
          <boxGeometry args={[0.6, 1.0, 0.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <Interactable
        id="seat-back"
        approach={[0.05, SEAT_BACK[1]]}
        marker={[SEAT_BACK[0], 1.25, SEAT_BACK[1]]}
        disabled={!showSeats}
      >
        <mesh position={[SEAT_BACK[0], 0.5, SEAT_BACK[1]]}>
          <boxGeometry args={[0.6, 1.0, 0.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      {/* ヘンディさん */}
      <Interactable
        id="hendy"
        approach={[3.0, 4.6]}
        marker={[HENDY_START[0], 1.75, HENDY_START[2]]}
        disabled={!showHendy}
      >
        <group
          position={hendyAt === "door" ? HENDY_START : HENDY_FRONT}
          rotation={[0, hendyAt === "door" ? 0.7 : 0, 0]}
        >
          <Suspense fallback={null}>
            <Chibi config={HENDY} motion={hendyTalking ? "talking" : "idle"} expression="happy" />
          </Suspense>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.7, 1.3, 0.6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </Interactable>
      <Ready />
    </>
  );
}

/** 席の メンバーの 名前（頭の 上。いつも こちらを 向く）。名前は カタカナ（ふりがなは 要らない）。 */
function NameTag({ name }: { name: string }) {
  return (
    <Billboard position={[0, 1.38, 0]}>
      <CanvasPanel
        width={0.62}
        height={0.17}
        fontText={name}
        transparent
        draw={(ctx, w, h) => {
          ctx.font = `800 ${h * 0.56}px ${FONT_FAMILY}`;
          const tw = Math.min(w * 0.96, ctx.measureText(name).width + h * 0.7);
          ctx.fillStyle = "rgba(12, 30, 70, 0.78)";
          ctx.beginPath();
          ctx.roundRect((w - tw) / 2, h * 0.08, tw, h * 0.84, h * 0.42);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(name, w / 2, h * 0.53, w * 0.9);
        }}
      />
    </Billboard>
  );
}
