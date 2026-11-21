import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { t } from "@/lib/t";
import { onFx } from "@/stages/events";
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
import { LINE } from "@/factory/signs";
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
 *   → car-yellow → car-arrow（赤＋右折の矢印、1台だけ曲がる）→ car-red → ped-green（渡れる）
 * 実際の押しボタンの信号に矢印が付くのはめずらしい。教材として「家の近くの交差点」にまとめた（docs/design/01_ステージ1.md）。
 */

const SIDEWALK: Rect = { minX: -2, maxX: 27.3, minZ: 0.5, maxZ: 2.9 };
const CROSSING: Rect = { minX: 27.3, maxX: 37.2, minZ: 0.7, maxZ: 2.7 };
const FAR_SIDE: Rect = { minX: 37.2, maxX: 44, minZ: 0.5, maxZ: 3.2 };

/** 通りを行き来する人（朝の通勤・通学）。自分の歩く線（z=1.7）からは少しはなす。 */
const WALKERS: WalkerSpec[] = [
  { from: [-12, 0.55], to: [24, 0.55], speed: 1.0, at: 0.3 },
  { from: [3, 2.85], to: [21, 2.85], speed: 1.25, at: 0.7 },
  { from: [-16, 12.0], to: [26, 12.0], speed: 1.1, at: 0.2 },
  { from: [-10, 12.7], to: [24, 12.7], speed: 0.9, at: 0.8, casual: true },
  { from: [26.6, -30], to: [26.6, -1], speed: 1.15, at: 0.5 },
  { from: [26.4, 14], to: [26.4, 34], speed: 1.0, at: 0.1, casual: true },
  { from: [37.4, -26], to: [37.4, -1], speed: 1.2, at: 0.6 },
  { from: [37.6, 4], to: [37.6, 30], speed: 1.0, at: 0.4 },
  { from: [43, 2.6], to: [58, 2.6], speed: 0.95, at: 0.5, casual: true },
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
      "push-button": { pos: [26.55, 1.3, 0.75], look: [27.25, 1.12, 0.25], fov: 34 },
      "car-signal": { pos: [31.5, 3.6, 13], look: [34.2, 4.6, 4.6], fov: 40 },
    },
    triggers: [
      { id: "crosswalk-stop", x: 26.4, z: 1.7, r: 1.3 },
      { id: "across", x: 38.2, z: 1.7, r: 1.2 },
    ],
    camera: { mode: "follow", distance: 4.4, height: 2.5 },
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
      <color attach="background" args={["#cfe6f7"]} />
      <fog attach="fog" args={["#dcecf7", 45, 175]} />
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

      <Interactable id="push-button" marker={[27.25, 1.55, 0.25]}>
        <PushButtonBox position={[27.25, 1.15, 0.25]} rotationY={-Math.PI / 2} waiting={waiting} />
      </Interactable>

      <MetroEntrance />
      <Ready />
    </>
  );
}

/** メトロの入口（階段で地下へ）。会社のロゴは描かず、線のマークと「地下鉄」の文字だけにする。 */
function MetroEntrance() {
  const geo = useMemo(
    () =>
      merge([
        block(3.2, 0.12, 4.2, "#9aa1ab", { pos: [41.5, 0, -1.6] }),
        block(0.25, 2.6, 4.2, "#d9dde3", { pos: [40.0, 0, -1.6] }),
        block(0.25, 2.6, 4.2, "#d9dde3", { pos: [43.0, 0, -1.6] }),
        box(3.6, 0.2, 4.6, "#3c4250", { pos: [41.5, 2.7, -1.6] }),
        box(3.2, 0.08, 4.0, "#2a2e36", { pos: [41.5, 0.1, -1.6] }),
        ...Array.from({ length: 6 }, (_, i) =>
          box(2.7, 0.05, 0.3, "#d0d4da", { pos: [41.5, 0.08 - i * 0.18, -0.3 - i * 0.4] }),
        ),
      ]),
    [],
  );
  const m = LINE.M;
  return (
    <Interactable id="metro-entrance" approach={[41.5, 0.9]} marker={[41.5, 3.6, 0.6]}>
      <mesh geometry={geo} material={FLAT} />
      <CanvasPanel
        width={3.0}
        height={0.6}
        ppm={300}
        position={[41.5, 3.15, 0.72]}
        emissive
        fontText={t("sign.metro")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#16264d";
          ctx.fillRect(0, 0, w, h);
          if (m) drawLineBadge(ctx, h * 0.6, h / 2, h * 0.32, m.letter, m.color);
          const tt = LINE.T;
          if (tt) drawLineBadge(ctx, h * 1.4, h / 2, h * 0.32, tt.letter, tt.color);
          drawRuby(ctx, t("sign.metro"), h * 2.0, h * 0.72, {
            size: h * 0.42,
            color: "#fff",
            rubyColor: "#5ff3ff",
          });
          ctx.font = `700 ${h * 0.22}px sans-serif`;
          ctx.fillStyle = "#cfe0ff";
          ctx.fillText("Subway", w - h * 1.8, h * 0.62);
        }}
      />
      <mesh position={[41.5, 1.3, -1.6]}>
        <boxGeometry args={[3, 2.6, 4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </Interactable>
  );
}

/**
 * 交差する道の車。信号が青のときは流れ、黄・赤で止まる。赤＋矢印のときは1台だけ右へ曲がる。
 */
function CrossTraffic({ light }: { light: CarLight }) {
  const cars = useRef<THREE.Group[]>([]);
  const state = useRef([
    { lane: 30, dir: -1, z: 30, speed: 0, kind: "street/taxi" },
    { lane: 30, dir: -1, z: 48, speed: 0, kind: "street/kei-van" },
    { lane: 34, dir: 1, z: -20, speed: 0, kind: "street/taxi" },
  ]);
  const turn = useRef({ active: false, t: 0 });

  useEffect(() => {
    if (light === "red-arrow") turn.current = { active: true, t: 0 };
  }, [light]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    state.current.forEach((c, i) => {
      const g = cars.current[i];
      if (!g) return;
      const go = light === "green";
      const stopZ = c.dir < 0 ? 5.8 : -2.4;
      const beforeStop = c.dir < 0 ? c.z > stopZ : c.z < stopZ;
      const target = go || !beforeStop ? 9 : 0;
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
      if (!go && beforeStop) {
        const dist = Math.abs(c.z - stopZ);
        c.speed = Math.min(c.speed, dist * 1.2);
      }
      // 矢印のときは、北へ行く車が交差点で右（-x）へ曲がる
      if (i === 2 && turn.current.active) {
        turn.current.t += dt * 0.35;
        const tt = Math.min(1, turn.current.t);
        const x = 34 - Math.sin((tt * Math.PI) / 2) * 6;
        const z = -2 + (1 - Math.cos((tt * Math.PI) / 2)) * 0 + Math.sin((tt * Math.PI) / 2) * 8.5;
        g.position.set(x, 0, z);
        g.rotation.y = (-tt * Math.PI) / 2;
        if (tt >= 1) {
          turn.current.active = false;
          c.z = -40;
        }
        return;
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
