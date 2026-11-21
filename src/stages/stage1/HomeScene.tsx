import { useEffect, useMemo, useState } from "react";
import { onFx } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/street-parts";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";

/**
 * 自宅（朝）。目覚まし・パソコン（NMChat）・クローゼット（着がえ）・ドア。
 * 操作の練習を兼ねる（物を押す・床を押して歩く。Fable 5.2 のレビュー）。
 */
export function HomeScene() {
  useSceneLayout({
    anchors: {
      bed: { pos: [-0.9, 0, -0.2], yaw: Math.PI / 2 },
      desk: { pos: [1.4, 0, -0.6], yaw: Math.PI },
    },
    walk: [{ minX: -2.1, maxX: 2.1, minZ: -1.0, maxZ: 1.9 }],
    shots: {
      pc: { pos: [1.55, 1.25, -0.75], look: [1.55, 0.88, -1.75], fov: 45 },
      mirror: { pos: [0.2, 1.45, 0.3], look: [1.6, 1.1, 0.9], fov: 50 },
    },
    camera: { mode: "fixed", shot: { pos: [1.9, 2.35, 2.0], look: [-0.6, 0.7, -0.9], fov: 68 } },
    showPlayer: true,
    triggers: [],
  });

  // ステージの途中から始めたとき（NMChat・着がえ）は、もう鳴っていない
  const [ringing, setRinging] = useState(() => usePlay.getState().sectionId === "s01-wake");
  const [blink, setBlink] = useState(true);
  useEffect(() => onFx((id) => id === "alarm-off" && setRinging(false)), []);
  useEffect(() => {
    if (!ringing) return;
    const timer = window.setInterval(() => setBlink((b) => !b), 450);
    return () => window.clearInterval(timer);
  }, [ringing]);

  const clockGeo = useMemo(() => block(0.26, 0.12, 0.1, "#2a2d33"), []);
  const room = useMemo(
    () =>
      merge([
        box(5.0, 0.1, 4.6, "#b98a5e", { pos: [0, -0.05, 0] }),
        box(5.0, 2.7, 0.15, "#efe3d0", { pos: [0, 1.35, -2.3] }),
        box(0.15, 2.7, 4.6, "#f3e9d8", { pos: [-2.5, 1.35, 0] }),
        box(0.15, 2.7, 4.6, "#f3e9d8", { pos: [2.5, 1.35, 0] }),
        box(1.6, 2.7, 0.15, "#efe3d0", { pos: [-1.7, 1.35, 2.3] }),
        box(1.6, 2.7, 0.15, "#efe3d0", { pos: [1.7, 1.35, 2.3] }),
        box(1.8, 0.6, 0.15, "#efe3d0", { pos: [0, 2.4, 2.3] }),
        box(5.0, 0.1, 4.6, "#fbf7f0", { pos: [0, 2.72, 0] }),
        // 窓（朝の光）
        box(1.6, 1.1, 0.05, "#bfe6ff", { pos: [-0.3, 1.55, -2.21] }),
        box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 2.12, -2.2] }),
        box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 0.98, -2.2] }),
        box(0.06, 1.1, 0.08, "#ffffff", { pos: [-0.3, 1.55, -2.18] }),
        // ラグ
        box(1.8, 0.01, 1.3, "#7fa8c9", { pos: [0.2, 0.005, 0.6] }),
        // ベッドの横の台
        block(0.45, 0.5, 0.4, "#8a5a3a", { pos: [-2.0, 0, 0.35] }),
        // クローゼット
        block(0.6, 2.2, 1.6, "#d9c2a0", { pos: [2.15, 0, 0.9] }),
        box(0.02, 2.0, 0.02, "#8a6a4a", { pos: [1.845, 1.1, 0.9] }),
        box(0.03, 0.25, 0.04, "#6a4a2a", { pos: [1.84, 1.1, 0.75] }),
        box(0.03, 0.25, 0.04, "#6a4a2a", { pos: [1.84, 1.1, 1.05] }),
        // 鏡
        box(0.04, 1.4, 0.6, "#cfe8f5", { pos: [2.42, 1.2, -0.6] }),
        // ドア
        box(1.0, 2.1, 0.06, "#9c7650", { pos: [0, 1.05, 2.28] }),
        box(0.08, 0.04, 0.06, "#e0c060", { pos: [0.35, 1.0, 2.22] }),
        // カレンダー
        box(0.5, 0.6, 0.02, "#ffffff", { pos: [-2.42, 1.7, -1.2], rot: [0, Math.PI / 2, 0] }),
      ]),
    [],
  );

  return (
    <>
      <Lights preset="room" />
      <color attach="background" args={["#cfe9ff"]} />
      <mesh geometry={room} material={FLAT} />
      <WalkSurface size={[5, 4.6]} />
      <Prop url="home/bed" position={[-1.6, 0, -1.1]} rotationY={0} />
      <Prop url="home/desk" position={[1.55, 0, -1.75]} />
      <Prop url="home/chair" position={[1.55, 0, -1.1]} rotationY={Math.PI} />
      <Prop url="home/coat-rack" position={[-2.1, 0, 1.8]} />
      <Prop url="home/mug" position={[1.0, 0.72, -1.75]} />

      <Interactable id="alarm" approach={[-1.35, 0.35]} marker={[-2.0, 0.85, 0.35]}>
        <mesh geometry={clockGeo} material={FLAT} position={[-2.0, 0.5, 0.35]} />
        <CanvasPanel
          width={0.22}
          height={0.08}
          ppm={1200}
          position={[-1.88, 0.56, 0.35]}
          rotation={[0, Math.PI / 2, 0]}
          emissive
          deps={[ringing, blink]}
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#0b0b0e";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = ringing && !blink ? "#4a1414" : "#ff3b2f";
            ctx.font = `800 ${h * 0.8}px monospace`;
            ctx.textAlign = "center";
            ctx.fillText("7:00", w / 2, h * 0.82);
          }}
        />
      </Interactable>

      <Interactable id="pc" approach={[1.4, -0.6]} marker={[1.55, 1.15, -1.75]}>
        <Prop url="home/laptop" position={[1.55, 0.72, -1.8]} />
        <CanvasPanel
          width={0.28}
          height={0.17}
          ppm={900}
          position={[1.55, 0.86, -1.88]}
          rotation={[-0.25, 0, 0]}
          emissive
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#1b2a5c";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(w * 0.32, h * 0.1, w * 0.62, h * 0.8);
            ctx.fillStyle = "#38e1ff";
            ctx.font = `800 ${h * 0.14}px sans-serif`;
            ctx.fillText("NMChat", w * 0.04, h * 0.2);
            ctx.fillStyle = "#ffd23f";
            ctx.fillRect(w * 0.04, h * 0.42, w * 0.24, h * 0.1);
          }}
        />
      </Interactable>

      <Interactable id="closet" approach={[1.45, 0.9]} marker={[2.15, 2.4, 0.9]}>
        <mesh position={[2.15, 1.1, 0.9]}>
          <boxGeometry args={[0.62, 2.2, 1.62]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      <Interactable id="door" approach={[0, 1.6]} marker={[0, 2.3, 2.2]}>
        <mesh position={[0, 1.05, 2.25]}>
          <boxGeometry args={[1.0, 2.1, 0.1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <Ready />
    </>
  );
}
