import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import charactersJson from "@content/characters.json";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/props";
import { drawRuby } from "@/factory/text-canvas";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/lib/store";
import { t } from "@/lib/t";
import { onFx } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { ListeningBoard3D } from "@/factory/ListeningBoard3D";
import { useListeningStage } from "@/lib/listening/stage-store";
import { NameTag } from "@/stages/stage1/OfficeScenes";
import { useBoard } from "@/stages/stage2/board-store";
import { useSeatedTeam } from "@/stages/stage2/team-seats";
import { Whiteboard } from "@/stages/stage2/Whiteboard";
import { Chibi, type ChibiMotion } from "@/three/Chibi";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import type { Rect, V3 } from "@/three/layout";
import { LEFT_X, RIGHT_X, ROWS, SEATS, TABLE } from "@/stages/stage2/meeting-seats";

/**
 * 会議室A（docs/design/03_ステージ2.md §6）。長い テーブル・キャスターの 無い いす 8つ・かべの ホワイトボードと モニター。
 * 席: ホワイトボードに 近い 側に 山本社長（左）と ヘンディさん（右）が 向かい合う。手前に 自分と チームの 人。
 * 山本社長は fx: yamamoto-enter で 戸から 入って くる。話して いる 人は「話す 動き」に なる。
 */

const LOOKS = charactersJson.characters as unknown as { id: string; look: AvatarConfig }[];
const HENDY = { ...DEFAULT_AVATAR, ...LOOKS.find((c) => c.id === "hendy")!.look, bag: false };
const YAMAMOTO = {
  ...DEFAULT_AVATAR,
  ...LOOKS.find((c) => c.id === "yamamoto")!.look,
  bag: false,
  bagStyle: "none" as const,
};

const DOOR: V3 = [-3.0, 0, 3.3];
const YAMAMOTO_STAND: V3 = [-1.9, 0, 2.4];

const WALK: Rect[] = [{ minX: -3.7, maxX: 3.7, minZ: -3.2, maxZ: 3.2 }];
const BLOCKS: Rect[] = [
  TABLE,
  { minX: LEFT_X - 0.25, maxX: LEFT_X + 0.25, minZ: -1.8, maxZ: 1.5 },
  { minX: RIGHT_X - 0.25, maxX: RIGHT_X + 0.25, minZ: -1.8, maxZ: 1.5 },
];

function useWaiting(id: string): boolean {
  return usePlay((s) => s.waitingFor === `click:${id}`);
}

export function MeetingRoomScene() {
  useSceneLayout({
    anchors: {
      door: { pos: [2.4, 0, 0.6], yaw: Math.PI },
      "my-seat": { pos: SEATS.me!.pos, yaw: SEATS.me!.yaw },
      "my-seat-stand": { pos: [1.65, 0, ROWS[2]!], yaw: -Math.PI / 2 },
    },
    walk: WALK,
    blocks: BLOCKS,
    shots: {
      yamamoto: { pos: [0.5, 1.45, 3.15], look: [-1.9, 0.95, 2.2], fov: 50 },
      "yamamoto-seat": { pos: [0.7, 1.45, 0.3], look: [-1.0, 0.65, -1.55], fov: 52 },
      "talk-view": { pos: [-0.2, 1.85, 2.9], look: [0.7, 1.15, -2.6], fov: 55 },
      // 2まいの カードが 下に 出るので、ホワイトボードと 山本社長が 画面の 上の 55% に 入る 向き
      board: { pos: [0.1, 1.45, 1.1], look: [-0.75, 0.5, -3.47], fov: 58 },
    },
    camera: { mode: "follow", distance: 3.6, height: 2.4 },
    bounds: { minX: -3.85, maxX: 3.85, minZ: -3.3, maxZ: 3.35, maxY: 2.85 },
    showPlayer: true,
  });

  const sectionId = usePlay((s) => s.sectionId);
  // アップの 間は 名前の 札を 出さない（手前の 人の 札が 大きく なって ホワイトボードを かくすため）
  const showTags = usePlay((s) => !s.focus);
  const line = usePlay((s) => s.line);
  const talking = useBoard((s) => s.talking);
  const turnId = useBoard((s) => s.turnId);
  // リスニングの 間は、チームの 人が ノートに メモする
  const listening = usePlay((s) => s.panel?.id === "listening");
  // リスニングで 声が 鳴っている 人（ヘンディさん・山本社長）は 話す 動きに する
  const listenSpeaker = useListeningStage((s) => (s.speaking ? s.speaker : null));
  const listenActive = useListeningStage((s) => s.id !== null);
  const team = useSeatedTeam();

  // 山本社長: まだ いない → 戸から 入って くる → 立って あいさつ → 席に 座る
  const [entered, setEntered] = useState(() => usePlay.getState().sectionId !== "s02-team");
  useEffect(() => {
    useBoard.setState({ known: usePlay.getState().sectionId === "s04-question" });
    return onFx((id) => {
      if (id === "yamamoto-enter") setEntered(true);
      if (id === "board-known") useBoard.setState({ known: true });
    });
  }, []);
  const seated = sectionId !== "s02-team";

  const showYamamoto = useWaiting("yamamoto");
  const showSeat = useWaiting("my-seat");

  const geo = useMemo(
    () =>
      merge([
        box(8, 0.1, 7, "#d9cbb4", { pos: [0, -0.05, 0] }),
        box(8, 0.1, 7, "#f7f4ee", { pos: [0, 3.0, 0] }),
        box(8, 3.0, 0.2, "#eef1ec", { pos: [0, 1.5, -3.6] }),
        box(0.2, 3.0, 7, "#eef1ec", { pos: [4.1, 1.5, 0] }),
        // 左の かべ（窓）
        box(0.2, 0.85, 7, "#eef1ec", { pos: [-4.1, 0.42, 0] }),
        box(0.2, 0.55, 7, "#eef1ec", { pos: [-4.1, 2.72, 0] }),
        ...[-2.4, 0, 2.4].map((z) => box(0.22, 1.6, 0.18, "#dfe3dc", { pos: [-4.1, 1.65, z] })),
        // 戸の ある かべ（左の 手前に 戸）
        box(6.5, 3.0, 0.2, "#eef1ec", { pos: [0.75, 1.5, 3.6] }),
        box(0.5, 3.0, 0.2, "#eef1ec", { pos: [-3.85, 1.5, 3.6] }),
        box(1.1, 0.8, 0.2, "#eef1ec", { pos: [-3.05, 2.6, 3.6] }),
        // 床の じゅうたん
        box(3.4, 0.01, 5.2, "#c8d8c4", { pos: [0, 0.005, -0.2] }),
        // 長い テーブル
        block(TABLE.maxX - TABLE.minX, 0.05, TABLE.maxZ - TABLE.minZ, "#c79a6c", {
          pos: [0, 0.68, (TABLE.minZ + TABLE.maxZ) / 2],
        }),
        block(0.16, 0.68, 0.16, "#8c6646", { pos: [0, 0, TABLE.minZ + 0.4] }),
        block(0.16, 0.68, 0.16, "#8c6646", { pos: [0, 0, TABLE.maxZ - 0.4] }),
        block(0.08, 0.05, TABLE.maxZ - TABLE.minZ - 0.8, "#8c6646", {
          pos: [0, 0.3, (TABLE.minZ + TABLE.maxZ) / 2],
        }),
        // テーブルの 上の 紙
        ...[...ROWS.map((z) => [-0.3, z] as const), ...ROWS.map((z) => [0.3, z] as const)].map(
          ([x, z]) => box(0.24, 0.006, 0.32, "#ffffff", { pos: [x, 0.735, z] }),
        ),
      ]),
    [],
  );

  const yamamotoTalking =
    line?.who === "yamamoto" || talking === "yamamoto" || listenSpeaker === "yamamoto";
  const hendyTalking = line?.who === "hendy" || talking === "hendy" || listenSpeaker === "hendy";

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#e6f1f5"]} />
      <mesh geometry={geo} material={FLAT} />
      <WalkSurface size={[8, 7]} center={[0, 0]} />

      {/* 窓の 外（春の 空） */}
      <mesh position={[-4.22, 1.65, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 1.6]} />
        <meshBasicMaterial color="#bfe3fb" />
      </mesh>
      {/* 戸 */}
      <mesh position={[-3.05, 1.1, 3.62]}>
        <boxGeometry args={[1.0, 2.2, 0.06]} />
        <meshStandardMaterial color="#b88b5e" />
      </mesh>

      <Whiteboard position={[-0.8, 1.6, -3.47]} />

      {/*
        かべの モニター（会議の 題）。リスニングの 間は、ヘンディさんと 山本社長の 会話の いまの 文（虫食い）を 出す。
      */}
      <group position={[2.55, 1.65, -3.47]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[1.62, 0.96, 0.05]} />
          <meshStandardMaterial color="#2a2f38" />
        </mesh>
        {listenActive ? (
          <ListeningBoard3D width={1.5} height={0.85} />
        ) : (
          <CanvasPanel
            width={1.5}
            height={0.85}
            emissive
            fontText={t("s2.monitorTitle") + t("s2.monitorSub")}
            draw={(ctx, w, h) => {
              const g = ctx.createLinearGradient(0, 0, w, h);
              g.addColorStop(0, "#1f6a4f");
              g.addColorStop(1, "#2f8a66");
              ctx.fillStyle = g;
              ctx.fillRect(0, 0, w, h);
              drawRuby(ctx, t("s2.monitorTitle"), w / 2, h * 0.5, {
                size: h * 0.16,
                color: "#ffffff",
                align: "center",
              });
              drawRuby(ctx, t("s2.monitorSub"), w / 2, h * 0.78, {
                size: h * 0.1,
                color: "#ffffff",
                align: "center",
              });
            }}
          />
        )}
      </group>

      <Prop url="home/plant" position={[3.6, 0, -3.1]} />
      <Prop url="home/plant" position={[-3.6, 0, -3.1]} scale={0.8} />
      <Prop url="station/wall-clock" position={[3.98, 0, 0.5]} rotationY={-Math.PI / 2} />

      {/* いす（キャスターの 無い いす。入社式と 同じ） */}
      {ROWS.flatMap((z) => [
        <Prop
          key={`l${z}`}
          url="office/seminar-chair"
          position={[LEFT_X, 0, z]}
          rotationY={Math.PI / 2}
        />,
        <Prop
          key={`r${z}`}
          url="office/seminar-chair"
          position={[RIGHT_X, 0, z]}
          rotationY={-Math.PI / 2}
        />,
      ])}

      {/* ヘンディさん（はじめから 席に いる） */}
      <Seated seat={SEATS.hendy!} look={HENDY} talking={hendyTalking} />

      {/* 山本社長 */}
      {entered && (
        <Interactable
          id="yamamoto"
          approach={[-0.9, 2.5]}
          marker={[YAMAMOTO_STAND[0], 1.5, YAMAMOTO_STAND[2]]}
          disabled={!showYamamoto}
        >
          {seated ? (
            <Seated seat={SEATS.yamamoto!} look={YAMAMOTO} talking={yamamotoTalking} />
          ) : (
            <Walker from={DOOR} to={YAMAMOTO_STAND} look={YAMAMOTO} talking={yamamotoTalking} />
          )}
        </Interactable>
      )}

      {/* チームの 人（えらんだ 順。頭の 上に 名前） */}
      {team.map((m, i) => {
        const seat = SEATS[`team${i + 1}`];
        if (!seat) return null;
        return (
          <Seated
            key={m.id}
            seat={seat}
            look={m.look}
            talking={talking === m.id}
            raise={turnId === m.id}
            writing={listening}
            name={showTags ? m.name : undefined}
            phase={i * 0.41}
          />
        );
      })}

      {/* 自分の 席 */}
      <Interactable
        id="my-seat"
        approach={[1.65, ROWS[2]!]}
        marker={[RIGHT_X, 1.25, ROWS[2]!]}
        disabled={!showSeat}
      >
        <mesh position={[RIGHT_X, 0.5, ROWS[2]!]}>
          <boxGeometry args={[0.6, 1.0, 0.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <Ready />
    </>
  );
}

function Seated({
  seat,
  look,
  talking,
  name,
  phase = 0,
  raise = false,
  writing = false,
}: {
  seat: { pos: V3; yaw: number };
  look: AvatarConfig;
  talking: boolean;
  name?: string;
  phase?: number;
  /** 質問の 番（手を あげる）。 */
  raise?: boolean;
  /** リスニングの 間（ノートに メモする）。 */
  writing?: boolean;
}) {
  const motion: ChibiMotion = talking ? "talking" : raise ? "raise" : writing ? "writing" : "idle";
  return (
    <group position={[seat.pos[0], seat.pos[1], seat.pos[2]]}>
      <group rotation={[0, seat.yaw, 0]}>
        <Suspense fallback={null}>
          <Chibi
            config={look}
            motion={motion}
            seated
            holding={writing && !talking ? "notebook" : undefined}
            phase={phase}
            expression="happy"
          />
        </Suspense>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.6, 1.2, 0.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {name && <NameTag name={name} />}
    </group>
  );
}

/** 戸から 決まった 所まで 歩いて、こちらを 向いて 立つ（山本社長が 入って くる）。 */
function Walker({
  from,
  to,
  look,
  talking,
}: {
  from: V3;
  to: V3;
  look: AvatarConfig;
  talking: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const dir = Math.atan2(to[0] - from[0], to[2] - from[2]);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    t0.current ??= s.clock.elapsedTime;
    const k = Math.min(1, (s.clock.elapsedTime - t0.current) / 1.8);
    g.position.set(from[0] + (to[0] - from[0]) * k, 0, from[2] + (to[2] - from[2]) * k);
    // 着いたら 右（自分が いる 方）を 向く
    g.rotation.y = k < 1 ? dir : Math.PI / 2;
    if (k >= 1 && !arrived) setArrived(true);
  });
  return (
    <group ref={ref} position={from}>
      <Suspense fallback={null}>
        <Chibi
          config={look}
          motion={!arrived ? "walk" : talking ? "talking" : "idle"}
          expression="happy"
        />
      </Suspense>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.6, 1.5, 0.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
