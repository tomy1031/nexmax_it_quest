import { useEffect, useMemo, useState } from "react";
import { playSfx } from "@/lib/audio";
import { placePlayer, player } from "@/three/player";
import { onFx } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/props";
import { drawWindowTrees } from "@/factory/season-parts";
import { drawRuby, FONT_FAMILY } from "@/factory/text-canvas";
import { currentSeason, gameDate } from "@/lib/season";
import { t } from "@/lib/t";
import { Poster } from "@/factory/subway-parts";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";

/**
 * 自宅（朝）。目覚まし・パソコン（NMChat）・クローゼット（着がえ）・ドア。
 * 操作の練習を兼ねる（物を押す・床を押して歩く。Fable 5.2 のレビュー）。
 */
/** ベッドで寝ているときの足の位置（ベッドの上。頭はまくらの方＝-z）。 */
const SLEEP_POS: [number, number, number] = [-1.62, 0.6, -0.15];

export function HomeScene() {
  useSceneLayout({
    anchors: {
      bed: { pos: [-0.9, 0, -0.2], yaw: Math.PI / 2 },
      desk: { pos: [1.4, 0, -0.6], yaw: Math.PI },
    },
    walk: [{ minX: -2.1, maxX: 2.1, minZ: -1.0, maxZ: 1.9 }],
    shots: {
      // 目覚まし時計のアップ（はじめに見せて、ここで押して止める）
      alarm: { pos: [-1.32, 0.84, 0.52], look: [-1.97, 0.57, 0.35], fov: 34 },
      pc: { pos: [1.55, 1.25, -0.75], look: [1.55, 0.88, -1.75], fov: 45 },
      mirror: { pos: [0.2, 1.45, 0.3], look: [1.6, 1.1, 0.9], fov: 50 },
    },
    camera: { mode: "fixed", shot: { pos: [0.75, 2.4, 2.12], look: [-0.45, 0.62, -1.0], fov: 70 } },
    showPlayer: true,
    triggers: [],
  });

  // ステージの途中から始めたとき（NMChat・着がえ）は、もう鳴っていない
  const [ringing, setRinging] = useState(() => usePlay.getState().sectionId === "s01-wake");
  const [blink, setBlink] = useState(true);
  useEffect(
    () =>
      onFx((id) => {
        if (id !== "alarm-off") return;
        setRinging(false);
        // 台本の sfx alarm-stop と同じ。音が鳴りつづけないよう、場面の側でも止める
        playSfx("alarm-stop");
      }),
    [],
  );
  const focus = usePlay((s) => s.focus);

  // はじめ（目覚まし）は、ベッドで寝ている。fx wake-up で起きて、ベッドの横に立つ
  const [sleeping, setSleeping] = useState(() => usePlay.getState().sectionId === "s01-wake");
  useEffect(() => {
    // 自分を立つ所に置く処理（Player）のあとで寝かせる
    const timer = window.setTimeout(() => {
      if (sleeping) player.pose = { kind: "sleep", pos: SLEEP_POS, yaw: 0 };
    }, 0);
    const off = onFx((id) => {
      if (id !== "wake-up") return;
      setSleeping(false);
      placePlayer(-0.9, -0.2, Math.PI / 2);
    });
    return () => {
      window.clearTimeout(timer);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ringing) return;
    const timer = window.setInterval(() => setBlink((b) => !b), 450);
    return () => window.clearInterval(timer);
  }, [ringing]);

  // 目覚まし時計（画面は +x＝部屋の中の方を向く。横はば 0.26・おく行き 0.12）
  const clockGeo = useMemo(
    () =>
      merge([
        block(0.12, 0.13, 0.27, "#2a2d33"),
        box(0.06, 0.02, 0.08, "#e9eef3", { pos: [-0.01, 0.14, 0] }),
      ]),
    [],
  );
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
        box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 2.12, -2.2] }),
        box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 0.98, -2.2] }),
        box(0.06, 1.1, 0.08, "#ffffff", { pos: [-0.3, 1.55, -2.18] }),
        // ベッドの横の台（目覚ましを置く）
        block(0.45, 0.5, 0.4, "#8a5a3a", { pos: [-2.0, 0, 0.35] }),
        // 鏡（クローゼットの横）
        box(0.04, 1.4, 0.6, "#cfe8f5", { pos: [2.42, 1.2, -0.6] }),
        box(0.05, 1.5, 0.7, "#c9b08a", { pos: [2.45, 1.2, -0.6] }),
        // 窓の上のカーテンレールと、短いカーテン
        box(2.1, 0.05, 0.08, "#d8d0c4", { pos: [-0.3, 2.22, -2.14] }),
        box(0.35, 1.25, 0.05, "#9fc7a8", { pos: [-1.28, 1.6, -2.12] }),
        box(0.35, 1.25, 0.05, "#9fc7a8", { pos: [0.68, 1.6, -2.12] }),
        // 床の板の目
        ...Array.from({ length: 11 }, (_, i) =>
          box(0.02, 0.004, 4.6, "#a3784f", { pos: [-2.25 + i * 0.45, 0.002, 0] }),
        ),
        // ドア
        box(1.0, 2.1, 0.06, "#9c7650", { pos: [0, 1.05, 2.28] }),
        box(0.08, 0.04, 0.06, "#e0c060", { pos: [0.35, 1.0, 2.22] }),
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
      <Prop url="home/rug" position={[0.25, 0, 0.55]} />
      <Prop url="home/plant" position={[-0.25, 0, -1.92]} scale={0.8} />
      <Prop url="home/table-lamp" position={[-2.1, 0.5, 0.58]} />
      <Prop url="home/wardrobe" position={[2.2, 0, 0.4]} rotationY={-Math.PI / 2} />
      <Prop url="home/wardrobe" position={[2.2, 0, 1.4]} rotationY={-Math.PI / 2} />
      <Prop url="home/basket" position={[2.2, 0, -1.08]} />
      <Prop url="home/laundry" position={[-1.45, 0, 2.0]} />
      <Prop url="home/cushion" position={[-1.95, 0.55, -1.6]} rotationY={0.3} />
      <Prop url="home/wall-art" position={[-2.42, 0.05, -0.3]} rotationY={Math.PI / 2} />
      <Poster kind="osaka" position={[2.42, 1.62, -1.65]} rotationY={-Math.PI / 2} />
      <WindowView />
      <Calendar />
      {sleeping && (
        // かけぶとん（寝ている間だけ。むねから足まで）
        <mesh position={[-1.62, 0.72, -0.55]} raycast={() => null}>
          <boxGeometry args={[1.25, 0.16, 1.05]} />
          <meshStandardMaterial color="#9cc3e6" roughness={0.9} />
        </mesh>
      )}
      <mesh position={[0, 2.66, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.32, 0.36, 0.06, 24]} />
        <meshBasicMaterial color="#fffdf4" toneMapped={false} />
      </mesh>

      {/* アップの間は歩けないので、その場で合図を出す（approach なし） */}
      <Interactable
        id="alarm"
        approach={focus === "alarm" ? undefined : [-1.35, 0.35]}
        marker={[-2.0, 0.85, 0.35]}
      >
        <mesh geometry={clockGeo} material={FLAT} position={[-2.0, 0.5, 0.35]} />
        <CanvasPanel
          width={0.22}
          height={0.08}
          ppm={1200}
          position={[-1.937, 0.565, 0.35]}
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
        <mesh position={[2.2, 1.05, 0.9]}>
          <boxGeometry args={[0.62, 2.1, 2.0]} />
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

/** 窓の外（朝の空と、遠くの家とビルと、手前の木）。窓のガラスの所に貼る（かべより前）。 */
function WindowView() {
  return (
    <CanvasPanel
      width={1.6}
      height={1.1}
      ppm={220}
      position={[-0.3, 1.55, -2.222]}
      emissive
      draw={(ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#7cc4f5");
        g.addColorStop(1, "#e3f4ff");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const cols = ["#c9ccd2", "#b8bec8", "#d8d2c6", "#a9b3bf"];
        for (let i = 0; i < 9; i += 1) {
          const bw = w * (0.08 + ((i * 7) % 5) * 0.02);
          const bh = h * (0.2 + ((i * 13) % 7) * 0.06);
          const x = (i / 9) * w + ((i * 17) % 11);
          ctx.fillStyle = cols[i % cols.length]!;
          ctx.fillRect(x, h * 0.78 - bh, bw, bh + h * 0.3);
          ctx.fillStyle = "rgba(60,80,110,0.35)";
          for (let y = h * 0.78 - bh + 8; y < h * 0.76; y += 14) ctx.fillRect(x + 4, y, bw - 8, 4);
        }
        ctx.fillStyle = "#e9c15a";
        ctx.beginPath();
        ctx.arc(w * 0.12, h * 0.6, w * 0.05, 0, Math.PI * 2);
        ctx.fill();
        // 手前の木（季節で色が変わる。春は桜）
        drawWindowTrees(ctx, w, h, currentSeason());
      }}
    />
  );
}

/** カレンダー（入社式の日に赤い丸。ゲームの中の日 = 4月1日）。 */
function Calendar() {
  const d = gameDate();
  return (
    <CanvasPanel
      width={0.5}
      height={0.6}
      ppm={600}
      position={[-2.41, 1.7, -1.2]}
      rotation={[0, Math.PI / 2, 0]}
      draw={(ctx, w, h) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        // 上の帯（月）。濃い地なので字とふりがなは白
        ctx.fillStyle = "#c8323c";
        ctx.fillRect(0, 0, w, h * 0.24);
        drawRuby(ctx, t("home.calMonth", { m: d.getMonth() + 1 }), w / 2, h * 0.19, {
          size: h * 0.11,
          color: "#ffffff",
          rubyColor: "#ffffff",
          align: "center",
        });
        // 日（大きく）と赤い丸
        ctx.fillStyle = "#2a2d35";
        ctx.font = `800 ${h * 0.34}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.fillText(String(d.getDate()), w / 2, h * 0.66);
        ctx.strokeStyle = "#e0323c";
        ctx.lineWidth = h * 0.02;
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.545, w * 0.27, h * 0.19, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 予定
        drawRuby(ctx, t("home.calNote"), w / 2, h * 0.92, {
          size: h * 0.085,
          color: "#c8323c",
          rubyColor: "#c8323c",
          align: "center",
        });
      }}
    />
  );
}
