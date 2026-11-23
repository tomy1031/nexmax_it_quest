import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { t } from "@/lib/t";
import { onFx, questEvents } from "@/stages/events";
import { cameraAim, player } from "@/three/player";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, cyl, FLAT, merge } from "@/factory/kit";
import { Clouds, SkyDome } from "@/factory/props";
import { drawLineBadge, drawRuby } from "@/factory/text-canvas";
import {
  CarSignal,
  PedSignal,
  Prop,
  PushButtonBox,
  type CarLight,
  type PedLight,
} from "@/factory/street-parts";
import { LINE, STATION } from "@/factory/signs";
import { Interactable } from "@/three/Interactable";
import { Walkers, type WalkerSpec } from "@/three/Crowd";
import { Town } from "@/stages/stage1/town";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import { useLayout, type Rect } from "@/three/layout";

/**
 * 家の前〜押しボタンの信号〜メトロの入口（企画メモ「家を出たら左にまっすぐ。途中信号がある」）。
 *
 * 座標: 歩道は x の方向（家 x=0 → 交差点 x=27）。横断歩道は x=28〜36 の道を渡る。メトロの入口は x=40。
 * 信号の動き（台本の fx）:
 *   はじめ 歩行者=青・車=赤 → ped-blink（点滅→赤、車=青で車が流れる）→ button-pressed（おまちください）
 *   → car-yellow → car-arrow（赤＋左折の矢印 ←。手前から来る車が3台 つづけて左に曲がる）→ car-red → ped-green（渡れる）
 * 実際の押しボタンの信号に矢印が付くのはめずらしい。教材として「家の近くの交差点」にまとめた（docs/design/01_ステージ1.md）。
 */

/** 家の駅（天王寺）。入口の看板に出す。 */
const HOME_STATION = STATION.tennoji?.name ?? "";

/** メトロの入口のまん中（横断歩道を渡った先の正面。入口は -x を向く）。 */
const ENTRANCE = { x: 44.7, z: 1.7 };

const SIDEWALK: Rect = { minX: -2, maxX: 27.3, minZ: 0.5, maxZ: 2.65 };
const CROSSING: Rect = { minX: 27.3, maxX: 37.2, minZ: 0.7, maxZ: 2.7 };
const FAR_SIDE: Rect = { minX: 37.2, maxX: 42.4, minZ: 0.5, maxZ: 3.2 };

/**
 * 通りを行き来する人（朝の通勤・通学）。自分の歩く線（z=1.7）からは少しはなす。
 * 物（自動販売機・自転車・木・ガードレール・角の店）に めりこまない線を歩く（tomy さん 2026-11-23）。
 */
const WALKERS: WalkerSpec[] = [
  { from: [-12, 1.15], to: [24, 1.15], speed: 1.0, at: 0.3 },
  // ガードレール（z=3.0）に めりこまないよう、少し内がわを歩く（tomy さん 2026-11-23）
  { from: [3, 2.35], to: [21, 2.35], speed: 1.25, at: 0.7 },
  { from: [-16, 12.25], to: [6, 12.25], speed: 1.1, at: 0.2 },
  { from: [8, 12.25], to: [24, 12.25], speed: 0.9, at: 0.8, casual: true },
  { from: [25.65, -30], to: [25.65, -1], speed: 1.15, at: 0.5 },
  { from: [25.65, 18.4], to: [25.65, 34], speed: 1.0, at: 0.1, casual: true },
  { from: [37.4, -26], to: [37.4, -1], speed: 1.2, at: 0.6 },
  { from: [37.6, 4.6], to: [37.6, 30], speed: 1.0, at: 0.4 },
  { from: [48, 2.4], to: [58, 2.4], speed: 0.95, at: 0.5, casual: true },
];

export function StreetScene() {
  useSceneLayout({
    anchors: {
      "home-door": { pos: [0, 0, 1.3], yaw: Math.PI / 2 },
      "crosswalk-stop": { pos: [26.4, 0, 1.7] },
      across: { pos: [38.2, 0, 1.7] },
    },
    walk: [SIDEWALK],
    shots: {
      "ped-signal": { pos: [25.2, 1.9, 2.4], look: [36.9, 2.9, 0.25], fov: 26 },
      "push-button": { pos: [26.62, 1.24, 0.58], look: [27.18, 1.14, 0.25], fov: 30 },
      // 車の信号と、矢印の方向へ曲がる車が いっしょに見える（tomy さん 2026-11-23）
      "car-signal": { pos: [34.5, 4.8, 19], look: [30.5, 1.0, 6.5], fov: 50 },
      // 渡り終えたら、正面のメトロの入口を見せる
      metro: { pos: [37.6, 1.9, 3.1], look: [43.2, 2.3, 1.7], fov: 48 },
    },
    triggers: [
      { id: "crosswalk-stop", x: 26.4, z: 1.7, r: 1.3 },
      { id: "across", x: 38.2, z: 1.7, r: 1.2 },
    ],
    // 少し高く・はなれて、まわりが見やすいように（tomy さん 2026-11-23「カメラの視点のせいか、操作がしにくい」）
    camera: { mode: "follow", distance: 5.2, height: 3.2 },
    showPlayer: true,
  });

  const [ped, setPed] = useState<PedLight>("green");
  const [car, setCar] = useState<CarLight>("red");
  const [waiting, setWaiting] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(
    () =>
      onFx((id) => {
        switch (id) {
          case "ped-blink":
            setPed("blink");
            window.setTimeout(() => {
              setPed("red");
              window.setTimeout(() => setCar("green"), 700);
            }, 2400);
            break;
          case "button-pressed":
            setWaiting(true);
            break;
          case "car-yellow":
            setCar("yellow");
            break;
          case "car-arrow":
            setCar("red-arrow");
            break;
          case "car-red":
            setCar("red");
            break;
          case "ped-green":
            setPed("green");
            setWaiting(false);
            useLayout.setState((s) => ({
              walk: [...s.walk.filter((r) => r !== CROSSING && r !== FAR_SIDE), CROSSING, FAR_SIDE],
            }));
            break;
        }
      }),
    [],
  );

  // 横断歩道を渡り終えたら、正面（+x）のメトロの入口が見える向きにする
  useEffect(
    () =>
      questEvents.on((name) => {
        if (name !== "reach:across") return;
        player.yaw = Math.PI / 2;
        cameraAim.yaw = Math.PI / 2;
      }),
    [],
  );

  useEffect(() => {
    if (ped !== "blink") return;
    const timer = window.setInterval(() => setBlinkOn((b) => !b), 300);
    return () => window.clearInterval(timer);
  }, [ped]);

  const ground = useMemo(
    () =>
      merge([
        // 横断歩道
        ...Array.from({ length: 9 }, (_, i) =>
          box(0.5, 0.05, 2.2, "#f4f4f2", { pos: [28.4 + i * 0.95, 0.01, 1.7] }),
        ),
        // 押しボタンの柱（手前）
        cyl(0.07, 3.2, "#5d6168", { pos: [27.3, 1.6, 0.25] }),
      ]),
    [],
  );

  return (
    <>
      <Lights preset="day" />
      <color attach="background" args={["#d9f0fb"]} />
      <fog attach="fog" args={["#e8f5fb", 40, 165]} />
      <SkyDome />
      <Clouds />
      <mesh geometry={ground} material={FLAT} />
      <WalkSurface size={[60, 20]} center={[20, 2]} />

      <Town />
      <Walkers people={WALKERS} />

      <CrossTraffic light={car} />

      <CarSignal position={[36.6, 0, 4.4]} light={car} />
      <CarSignal position={[27.6, 0, -1.4]} rotationY={Math.PI} light={car} />
      <PedSignal
        position={[36.9, 0, 0.25]}
        rotationY={-Math.PI / 2}
        light={ped}
        blinkOn={blinkOn}
      />
      <PedSignal position={[27.3, 0, 0.25]} rotationY={Math.PI / 2} light={ped} blinkOn={blinkOn} />

      <Interactable id="push-button" marker={[27.17, 1.45, 0.25]}>
        <PushButtonBox position={[27.18, 1.15, 0.25]} rotationY={-Math.PI / 2} waiting={waiting} />
      </Interactable>

      <MetroEntrance />
      <Ready />
    </>
  );
}

/** メトロの入口（階段で地下へ）。会社のロゴは描かず、線のマークと「地下鉄」の文字だけにする。 */
function MetroEntrance() {
  // 入口の形は、まん中を原点・入口が +z を向く形で作り、横断歩道を渡った先の正面（道なりにまっすぐ）に置く。
  // 入口と看板は、渡ってくる人の方（-x）を向く（tomy さん 2026-11-22「位置が分かりにくい」）。
  const geo = useMemo(
    () =>
      merge([
        block(3.2, 0.12, 4.2, "#9aa1ab", { pos: [0, 0, 0] }),
        block(0.25, 2.6, 4.2, "#d9dde3", { pos: [-1.5, 0, 0] }),
        block(0.25, 2.6, 4.2, "#d9dde3", { pos: [1.5, 0, 0] }),
        block(3.2, 2.6, 0.25, "#d9dde3", { pos: [0, 0, -2.0] }),
        box(3.6, 0.2, 4.6, "#3c4250", { pos: [0, 2.7, 0] }),
        box(3.2, 0.08, 4.0, "#2a2e36", { pos: [0, 0.1, 0] }),
        // 手すり
        box(0.06, 0.06, 3.6, "#b9bec6", { pos: [-1.3, 0.95, 0] }),
        box(0.06, 0.06, 3.6, "#b9bec6", { pos: [1.3, 0.95, 0] }),
        ...Array.from({ length: 6 }, (_, i) =>
          box(2.7, 0.05, 0.3, "#d0d4da", { pos: [0, 0.08 - i * 0.18, 1.3 - i * 0.4] }),
        ),
      ]),
    [],
  );
  const m = LINE.M;
  return (
    <Interactable
      id="metro-entrance"
      approach={[ENTRANCE.x - 2.4, ENTRANCE.z]}
      marker={[ENTRANCE.x - 2.2, 3.6, ENTRANCE.z]}
    >
      <group position={[ENTRANCE.x, 0, ENTRANCE.z]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={geo} material={FLAT} />
        <CanvasPanel
          width={3.0}
          height={0.6}
          ppm={300}
          position={[0, 3.15, 2.32]}
          emissive
          fontText={t("sign.metro") + HOME_STATION + t("sign.station")}
          draw={(ctx, w, h) => {
            // 入口の看板: 線のマーク・駅の名前（天王寺駅）・「地下鉄 Subway」。字とふりがなは白（濃い背景のルール）
            ctx.fillStyle = "#16264d";
            ctx.fillRect(0, 0, w, h);
            if (m) drawLineBadge(ctx, h * 0.6, h / 2, h * 0.32, m.letter, m.color);
            const tt = LINE.T;
            if (tt) drawLineBadge(ctx, h * 1.4, h / 2, h * 0.32, tt.letter, tt.color);
            drawRuby(ctx, `${HOME_STATION}${t("sign.station")}`, h * 2.0, h * 0.76, {
              size: h * 0.44,
              color: "#fff",
              rubyColor: "#fff",
            });
            drawRuby(ctx, t("sign.metro"), w - h * 0.25, h * 0.5, {
              size: h * 0.2,
              color: "#fff",
              rubyColor: "#fff",
              align: "right",
            });
            ctx.font = `700 ${h * 0.17}px sans-serif`;
            ctx.fillStyle = "#fff";
            ctx.textAlign = "right";
            ctx.fillText("Subway", w - h * 0.25, h * 0.84);
            ctx.textAlign = "left";
          }}
        />
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[3, 2.6, 4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </Interactable>
  );
}

/**
 * 交差する道の車。信号が青のときは流れ、黄・赤で止まる。
 * 赤＋左折の矢印（←）のときは、手前（+z）から来る車（x=30・南へ）が、家の前の道へ 1台ずつ つづけて左に曲がる（3台）。
 * 左に曲がる車は 横断歩道（z=0.7〜2.7）より手前で曲がるので、歩く人の道を通らない（tomy さん 2026-11-23「手前側から左折する車を写して」）。
 */
type TrafficCar = {
  lane: number;
  dir: 1 | -1;
  z: number;
  speed: number;
  kind: string;
  /** 曲がっている とちゅう（0〜1）。曲がったあとは まっすぐ -x へ。null なら曲がっていない。 */
  turn: number | null;
  /** 曲がったあと、-x へ進んだ きょり。 */
  away: number;
};

/** 左折: 南へ行く車（x=30）が、家の前の道（z=9 の車線。-x へ）に入る。 */
const TURN_R = 2.4;
const TURN_END_Z = 8.8;
const TURN_START_Z = TURN_END_Z + TURN_R;

function CrossTraffic({ light }: { light: CarLight }) {
  const cars = useRef<THREE.Group[]>([]);
  const state = useRef<TrafficCar[]>([
    { lane: 30, dir: -1, z: 22, speed: 0, kind: "street/taxi", turn: null, away: 0 },
    { lane: 30, dir: -1, z: 30, speed: 0, kind: "street/kei-van", turn: null, away: 0 },
    { lane: 30, dir: -1, z: 38, speed: 0, kind: "street/taxi", turn: null, away: 0 },
    { lane: 34, dir: 1, z: -12, speed: 0, kind: "street/taxi", turn: null, away: 0 },
    { lane: 34, dir: 1, z: -22, speed: 0, kind: "street/kei-van", turn: null, away: 0 },
  ]);
  const turned = useRef(0);

  useEffect(() => {
    if (light !== "red-arrow") return;
    turned.current = 0;
    // 矢印が出たら、南へ行く車を 曲がる所の手前に ならべなおす。もう通りすぎた車・遠くの車は、
    // カメラの うしろ（見えない所。z ≥ 23）から また来るようにする（矢印の間に 必ず3台 曲がるように。tomy さん 2026-11-23）
    const south = state.current
      .filter((c) => c.dir < 0 && c.turn === null)
      .sort((a, b) => a.z - b.z);
    let next = TURN_START_Z;
    for (const c of south) {
      if (c.z >= next + 0.5 && c.z < 19) {
        next = c.z + 7;
        continue;
      }
      c.z = Math.max(next + 7, 23);
      c.speed = 6;
      next = c.z;
    }
  }, [light]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const go = light === "green";
    const arrow = light === "red-arrow";
    // 南へ行く車の ならび（前＝z が小さい順）
    const queue = state.current
      .filter((c) => c.dir < 0 && c.turn === null)
      .sort((a, b) => a.z - b.z);
    const turning = state.current.some((c) => c.turn !== null && c.turn < 0.5);
    state.current.forEach((c, i) => {
      const g = cars.current[i];
      if (!g) return;
      if (c.turn !== null) {
        // 左に曲がる（南向き → 西向き）。曲がったら まっすぐ進み、見えない所で うしろへ もどる
        if (c.turn < 1) {
          c.turn = Math.min(1, c.turn + dt * 0.5);
          const a = (c.turn * Math.PI) / 2;
          g.position.set(30 - TURN_R * (1 - Math.cos(a)), 0, TURN_START_Z - TURN_R * Math.sin(a));
          g.rotation.y = Math.PI + a;
        } else {
          c.away += dt * 7;
          g.position.set(30 - TURN_R - c.away, 0, TURN_END_Z);
          g.rotation.y = -Math.PI / 2;
          if (c.away > 45) {
            c.turn = null;
            c.away = 0;
            c.z = 46 + i * 4;
            c.speed = 0;
          }
        }
        return;
      }
      const order = c.dir < 0 ? queue.indexOf(c) : 0;
      // 南へ行く車は、左に曲がる所（TURN_START_Z）の手前で止まる。北へ行く車は 交差点の手前（z=-2.4）
      const stopZ = c.dir < 0 ? TURN_START_Z + Math.max(0, order) * 5.5 : -2.4;
      const beforeStop = c.dir < 0 ? c.z > stopZ - 0.01 : c.z < stopZ;
      // 矢印: 南へ行く車は 止まらずに 進み、曲がる所に着いたら 左に曲がる（3台まで）。前の車とは あいだを あける
      if (arrow && c.dir < 0 && turned.current < 3) {
        if (order === 0 && !turning && c.z <= TURN_START_Z + 0.3) {
          c.turn = 0;
          turned.current += 1;
          return;
        }
        const ahead = order > 0 ? queue[order - 1]!.z : turning ? TURN_START_Z : -Infinity;
        const room = c.z - ahead - 7;
        const want = order === 0 && !turning ? 6 : Math.max(0, Math.min(6, room * 1.5));
        c.speed += (want - c.speed) * Math.min(1, dt * 2);
        c.z = Math.max(order === 0 && !turning ? -100 : ahead + 6.5, c.z - c.speed * dt);
        g.position.set(c.lane, 0, c.z);
        g.rotation.y = Math.PI;
        return;
      }
      const free = go || !beforeStop;
      c.speed += ((free ? 9 : 0) - c.speed) * Math.min(1, dt * 1.5);
      if (!free) {
        const dist = Math.abs(c.z - stopZ);
        c.speed = Math.min(c.speed, dist * 1.4 + (arrow && c.dir < 0 && order <= 2 ? 1.5 : 0));
        if (c.dir < 0 && c.z <= stopZ) c.speed = 0;
        if (c.dir > 0 && c.z >= stopZ) c.speed = 0;
      }
      c.z += c.dir * c.speed * dt;
      if (c.dir < 0 && c.z < -40) c.z = 45;
      if (c.dir > 0 && c.z > 45) c.z = -40;
      g.position.set(c.lane, 0, c.z);
      g.rotation.y = c.dir < 0 ? Math.PI : 0;
    });
  });

  return (
    <>
      {state.current.map((c, i) => (
        <group key={i} ref={(g) => void (g && (cars.current[i] = g))}>
          <Prop url={c.kind} position={[0, 0, 0]} />
        </group>
      ))}
    </>
  );
}
