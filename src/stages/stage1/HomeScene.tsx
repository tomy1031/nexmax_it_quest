import { useEffect, useMemo, useState } from "react";
import { playSfx } from "@/lib/audio";
import { placePlayer, player } from "@/three/player";
import { onFx } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, cyl, FLAT, merge } from "@/factory/kit";
import { Prop } from "@/factory/props";
import { LaptopScreen } from "@/factory/small-parts";
import { drawWindowTrees } from "@/factory/season-parts";
import { drawRuby, FONT_FAMILY } from "@/factory/text-canvas";
import { currentSeason, gameDate } from "@/lib/season";
import { t } from "@/lib/t";
import { Poster } from "@/factory/subway-parts";
import { Interactable } from "@/three/Interactable";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import type { Rect } from "@/three/layout";

/**
 * 自宅（朝）。1K の部屋（tomy さん 2026-11-23「ソファ、テレビ、簡易キッチン、風呂やトイレ、玄関があったり、生活感のあるように」）。
 *
 *   x: -3.2 ………………………… 0.6 | 0.6 …… 1.9 | 1.9 …… 3.2
 *   z=-2.8 ┌──── 窓 ─────────────┬─────────────┬───────────┐
 *          │ ベッド  台  つくえ    │ 冷蔵庫 せんたく機│ おふろ     │
 *          │                      ドア   ろうか   ドア          │
 *          │ クローゼット・かがみ  │ キッチン     ├── トイレ ──┤
 *          │ ソファ  テーブル  テレビ│            │ 玄関 → ドア（東のかべ）
 *   z= 2.2 └──（手前のかべは ひくい。カメラから中が見えるように）───────┘
 *
 * カメラは 手前（+z）の上から ななめに見下ろす（向きは かえない。ドラッグで少し回せる）。
 * 手前の かべと、へやの あいだの かべは ひくくして、中が見えるようにする（ゲームの 間取りの見せ方）。
 * 家具には 入れない四角（blocks）を付け、体が めりこまないようにする。
 */
/** ベッドで寝ているときの足の位置（ベッドの上。頭はまくらの方＝-z）。 */
const BED: [number, number] = [-2.45, -1.65];
const SLEEP_POS: [number, number, number] = [BED[0] - 0.02, 0.6, BED[1] + 0.95];

const WALL = 2.5;
const LOW = 1.15;

/** 歩ける所（かべから 体の太さ分 はなす）。部屋・ろうか・おふろ・トイレ・玄関と、それをつなぐ ドアの所。 */
const WALK: Rect[] = [
  { minX: -2.95, maxX: 0.35, minZ: -2.55, maxZ: 1.95 },
  { minX: 0.85, maxX: 1.65, minZ: -2.55, maxZ: 1.95 },
  { minX: 0.3, maxX: 0.9, minZ: -1.35, maxZ: -0.65 },
  { minX: 2.15, maxX: 2.95, minZ: -2.55, maxZ: -1.15 },
  { minX: 1.6, maxX: 2.2, minZ: -2.0, maxZ: -1.6 },
  { minX: 2.15, maxX: 2.95, minZ: -0.65, maxZ: 0.25 },
  { minX: 1.6, maxX: 2.2, minZ: -0.4, maxZ: 0.0 },
  { minX: 2.15, maxX: 2.95, minZ: 0.75, maxZ: 1.95 },
  { minX: 1.6, maxX: 2.2, minZ: 0.85, maxZ: 1.9 },
];

/** 家具（入れない四角）。 */
const BLOCKS: Rect[] = [
  { minX: -3.2, maxX: -1.7, minZ: -2.8, maxZ: -0.53 }, // ベッド
  { minX: -1.67, maxX: -1.23, minZ: -2.8, maxZ: -2.33 }, // ベッドの横の台
  { minX: -1.1, maxX: 0.5, minZ: -2.8, maxZ: -2.0 }, // つくえ
  { minX: -0.6, maxX: 0.0, minZ: -2.05, maxZ: -1.45 }, // いす
  { minX: -3.2, maxX: -2.6, minZ: -0.5, maxZ: 0.5 }, // クローゼット
  { minX: -1.68, maxX: -0.92, minZ: 0.15, maxZ: 1.65 }, // ソファ
  { minX: -0.58, maxX: -0.12, minZ: 0.5, maxZ: 1.3 }, // テーブル
  { minX: 0.2, maxX: 0.6, minZ: 0.4, maxZ: 1.4 }, // テレビ台
  { minX: 0.6, maxX: 1.3, minZ: -2.8, maxZ: -2.0 }, // 冷蔵庫
  { minX: 1.25, maxX: 1.9, minZ: -2.8, maxZ: -2.15 }, // せんたく機
  { minX: 0.6, maxX: 1.15, minZ: 0.3, maxZ: 1.7 }, // キッチン
  { minX: 1.95, maxX: 3.2, minZ: -2.8, maxZ: -2.05 }, // おふろ（湯ぶね）
  { minX: 2.6, maxX: 3.2, minZ: -0.5, maxZ: 0.1 }, // トイレ
  { minX: 2.1, maxX: 3.0, minZ: 0.5, maxZ: 0.85 }, // くつばこ
];

export function HomeScene() {
  useSceneLayout({
    anchors: {
      bed: { pos: [-1.35, 0, -1.3], yaw: Math.PI / 2 },
      desk: { pos: [-0.3, 0, -1.1], yaw: Math.PI },
    },
    walk: WALK,
    blocks: BLOCKS,
    shots: {
      // 目覚まし時計のアップ（はじめに見せて、ここで押して止める）
      alarm: { pos: [-1.38, 0.86, -1.95], look: [-1.45, 0.57, -2.6], fov: 34 },
      pc: { pos: [-0.3, 1.25, -1.35], look: [-0.3, 0.88, -2.45], fov: 45 },
      mirror: { pos: [-1.6, 1.5, 0.2], look: [-3.1, 1.15, 0.0], fov: 50 },
    },
    // 手前の上から ななめに見下ろす（向きは かえない）
    camera: { mode: "follow", distance: 3.4, height: 4.4, yaw: 0 },
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
      placePlayer(-1.35, -1.3, Math.PI / 2);
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
  const room = useMemo(() => {
    const p = [
      // 床（部屋・ろうかは 木、おふろ・トイレは 明るい灰色、玄関は タイル）
      box(3.8, 0.1, 5.0, "#c99a6b", { pos: [-1.3, -0.05, -0.3] }),
      box(1.3, 0.1, 5.0, "#d1a878", { pos: [1.25, -0.05, -0.3] }),
      box(1.3, 0.1, 1.9, "#dfe8ec", { pos: [2.55, -0.05, -1.85] }),
      box(1.3, 0.1, 1.4, "#eef0ea", { pos: [2.55, -0.05, -0.2] }),
      box(1.3, 0.1, 1.7, "#b9b4ab", { pos: [2.55, -0.09, 1.35] }),
      box(1.3, 0.04, 0.06, "#8f8a80", { pos: [2.55, 0.0, 0.52] }),
      // 外の かべ（おく・左・右は 高く、手前は ひくい）
      box(6.55, WALL, 0.15, "#f7eee0", { pos: [0, WALL / 2, -2.875] }),
      box(0.15, WALL, 5.15, "#f9f1e4", { pos: [-3.275, WALL / 2, -0.3] }),
      box(0.15, WALL, 5.15, "#f9f1e4", { pos: [3.275, WALL / 2, -0.3] }),
      box(6.55, 0.32, 0.15, "#f2e6d4", { pos: [0, 0.16, 2.275] }),
      // 部屋と ろうかの あいだ（x=0.6。ドアの所は あける）
      box(0.12, LOW, 1.3, "#f3e8d8", { pos: [0.6, LOW / 2, -2.15] }),
      box(0.12, LOW, 3.55, "#f3e8d8", { pos: [0.6, LOW / 2, 0.475] }),
      // おふろ・トイレの かべ（x=1.9。ドアの所は あける）
      box(0.12, LOW, 0.75, "#eef2f4", { pos: [1.9, LOW / 2, -2.42] }),
      box(0.12, LOW, 1.15, "#eef2f4", { pos: [1.9, LOW / 2, -1.02] }),
      box(0.12, LOW, 0.4, "#eef2f4", { pos: [1.9, LOW / 2, 0.3] }),
      box(1.3, LOW, 0.12, "#eef2f4", { pos: [2.55, LOW / 2, -0.9] }),
      box(1.3, LOW, 0.12, "#eef2f4", { pos: [2.55, LOW / 2, 0.5] }),
      // 窓（おくの かべ。つくえの上）と カーテン
      box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 2.12, -2.78] }),
      box(1.7, 0.08, 0.1, "#ffffff", { pos: [-0.3, 0.98, -2.78] }),
      box(0.06, 1.1, 0.08, "#ffffff", { pos: [-0.3, 1.55, -2.76] }),
      box(2.1, 0.05, 0.08, "#d8d0c4", { pos: [-0.3, 2.22, -2.72] }),
      box(0.35, 1.25, 0.05, "#b9dcc3", { pos: [-1.28, 1.6, -2.7] }),
      box(0.35, 1.25, 0.05, "#b9dcc3", { pos: [0.68 - 0.1, 1.6, -2.7] }),
      // ベッドの横の台（目覚ましを置く）
      block(0.44, 0.5, 0.42, "#a8754e", { pos: [-1.45, 0, -2.56] }),
      // かがみ（クローゼットの横）
      box(0.04, 1.4, 0.55, "#d8eef8", { pos: [-3.17, 1.2, 0.85] }),
      box(0.05, 1.5, 0.65, "#d6bb93", { pos: [-3.19, 1.2, 0.85] }),
      // テレビ台
      block(0.38, 0.4, 1.0, "#b98a5e", { pos: [0.4, 0, 0.9] }),
      // せんたく機（白い箱と まるい ふた）
      block(0.6, 0.85, 0.6, "#f4f4f2", { pos: [1.57, 0, -2.47] }),
      cyl(0.2, 0.04, "#cfe3ee", { pos: [1.57, 0.87, -2.47] }),
      // おふろ: 湯ぶね・お湯・せんめん台
      block(1.2, 0.55, 0.72, "#ffffff", { pos: [2.57, 0, -2.42] }),
      box(1.05, 0.04, 0.58, "#a8dcf0", { pos: [2.57, 0.5, -2.42] }),
      block(0.4, 0.75, 0.3, "#ffffff", { pos: [3.0, 0, -1.25] }),
      box(0.03, 0.5, 0.36, "#d8eef8", { pos: [3.18, 1.3, -1.25] }),
      // トイレの紙
      cyl(0.06, 0.1, "#ffffff", { pos: [3.15, 0.7, 0.15], rot: [Math.PI / 2, 0, 0] }),
      // 玄関: くつばこ・くつ・ドア（東の かべ）
      block(0.9, 0.85, 0.32, "#c9a37a", { pos: [2.55, -0.05, 0.68] }),
      block(0.12, 0.08, 0.26, "#ffffff", { pos: [2.45, -0.05, 1.7] }),
      block(0.12, 0.08, 0.26, "#ffffff", { pos: [2.6, -0.05, 1.7] }),
      block(0.11, 0.07, 0.24, "#3b2a24", { pos: [2.9, -0.05, 1.05] }),
      block(0.11, 0.07, 0.24, "#3b2a24", { pos: [3.03, -0.05, 1.05] }),
      box(0.07, 2.05, 0.95, "#8a6a4e", { pos: [3.17, 1.0, 1.4] }),
      box(0.05, 0.05, 0.14, "#e0c060", { pos: [3.12, 1.0, 1.08] }),
      // 床の板の目（部屋）
      ...Array.from({ length: 8 }, (_, i) =>
        box(0.02, 0.004, 5.0, "#b5875b", { pos: [-3.0 + i * 0.48, 0.002, -0.3] }),
      ),
    ];
    return merge(p);
  }, []);

  return (
    <>
      <Lights preset="room" />
      <color attach="background" args={["#e8f2f6"]} />
      <mesh geometry={room} material={FLAT} />
      <WalkSurface size={[6.4, 5.0]} center={[0, -0.3]} />
      <Prop url="home/bed" position={[BED[0], 0, BED[1]]} />
      <Prop url="home/desk" position={[-0.3, 0, -2.4]} />
      <Prop url="home/chair" position={[-0.3, 0, -1.75]} rotationY={Math.PI} />
      <Prop url="home/mug" position={[-0.95, 0.72, -2.45]} />
      <Prop url="home/plant" position={[0.35, 0, -1.75]} scale={0.7} />
      <Prop url="home/table-lamp" position={[-1.55, 0.5, -2.62]} scale={0.8} />
      <Prop url="home/cushion" position={[-2.95, 0.55, -2.25]} rotationY={0.3} />
      <Prop url="home/wall-art" position={[-3.18, 0.05, -1.6]} rotationY={Math.PI / 2} />
      <Prop url="home/wardrobe" position={[-2.9, 0, 0]} rotationY={Math.PI / 2} />
      <Prop url="home/basket" position={[-2.95, 0, 1.75]} />
      <Prop url="home/laundry" position={[-2.3, 0, 1.85]} />
      {/* ソファ・テーブル・テレビ（テレビは 部屋の 右の かべの前） */}
      <Prop url="home/rug" position={[-0.55, 0, 0.9]} rotationY={Math.PI / 2} scale={0.95} />
      <Prop url="home/sofa" position={[-1.3, 0, 0.9]} rotationY={Math.PI / 2} scale={0.75} />
      <Prop
        url="home/coffee-table"
        position={[-0.35, 0, 0.9]}
        rotationY={Math.PI / 2}
        scale={0.68}
      />
      <Prop url="home/tv" position={[0.42, 0.4, 0.9]} rotationY={-Math.PI / 2} scale={0.85} />
      {/* ろうか: 冷蔵庫と電子レンジ・キッチン */}
      <Prop url="home/fridge" position={[0.92, 0, -2.4]} rotationY={Math.PI / 2} scale={0.8} />
      <Prop
        url="home/microwave"
        position={[0.92, 1.52, -2.4]}
        rotationY={Math.PI / 2}
        scale={0.8}
      />
      <Prop url="home/kitchen" position={[0.86, 0, 1.0]} rotationY={Math.PI / 2} scale={0.85} />
      <Prop url="home/toilet" position={[2.95, 0, -0.2]} rotationY={-Math.PI / 2} />
      <Poster kind="osaka" position={[-2.45, 1.75, -2.79]} />
      <WindowView />
      <Calendar />
      {sleeping && (
        // かけぶとん（寝ている間だけ。むねから足まで）
        <mesh position={[SLEEP_POS[0], 0.72, BED[1] + 0.55]} raycast={() => null}>
          <boxGeometry args={[1.25, 0.16, 1.05]} />
          <meshStandardMaterial color="#9cc3e6" roughness={0.9} />
        </mesh>
      )}

      {/* 目覚まし時計（画面は 手前 +z を向く）。アップの間は歩けないので、その場で合図を出す */}
      <Interactable
        id="alarm"
        approach={focus === "alarm" ? undefined : [-1.45, -1.95]}
        marker={[-1.45, 0.9, -2.6]}
      >
        <group position={[-1.38, 0.5, -2.6]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh geometry={clockGeo} material={FLAT} />
          <CanvasPanel
            width={0.22}
            height={0.08}
            ppm={1200}
            position={[0.063, 0.065, 0]}
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
        </group>
      </Interactable>

      <Interactable id="pc" approach={[-0.3, -1.1]} marker={[-0.3, 1.15, -2.45]}>
        <Prop url="home/laptop" position={[-0.3, 0.72, -2.45]} />
        <LaptopScreen
          position={[-0.3, 0.72, -2.45]}
          ppm={900}
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#1b2a5c";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(w * 0.32, h * 0.1, w * 0.62, h * 0.8);
            ctx.fillStyle = "#38e1ff";
            ctx.font = `800 ${h * 0.1}px sans-serif`;
            ctx.fillText("NMChat", w * 0.035, h * 0.2);
            ctx.fillStyle = "#ffd23f";
            ctx.fillRect(w * 0.04, h * 0.42, w * 0.24, h * 0.1);
          }}
        />
      </Interactable>

      <Interactable id="closet" approach={[-2.25, 0]} marker={[-2.9, 2.45, 0]}>
        <mesh position={[-2.9, 1.05, 0]}>
          <boxGeometry args={[0.62, 2.1, 1.0]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      {/* 玄関の ドア（東の かべ。カメラから見える向き） */}
      <Interactable id="door" approach={[2.7, 1.4]} marker={[3.0, 2.35, 1.4]}>
        <mesh position={[3.15, 1.02, 1.4]}>
          <boxGeometry args={[0.12, 2.05, 0.95]} />
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
      position={[-0.3, 1.55, -2.797]}
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
      position={[-1.45, 1.75, -2.797]}
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
