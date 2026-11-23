import { useMemo } from "react";
import { block, box, FLAT, merge, shade } from "@/factory/kit";
import {
  AUTUMN_GINKGO,
  AUTUMN_MAPLE,
  Many,
  pastelWall,
  Prop,
  WALL_PASTELS,
  SPRING_PETALS,
  SUMMER_CHERRY,
  type Place,
} from "@/factory/props";
import { PetalFall } from "@/factory/season-parts";
import { currentSeason } from "@/lib/season";
import { Noren, VSign } from "@/factory/town-parts";

/**
 * 町なみ（polyfork の Little Tokyo の部品で組む）。
 * 駅前の通りの「家の前〜交差点〜メトロの入口」のまわりに、店・看板・電柱・イチョウ並木・遠くのビルを置く。
 * 進行に関わる物（信号・押しボタン・入口）は StreetScene.tsx にある。ここは見た目だけ。
 *
 * 決まり（Little Tokyo の部品の約束）: 4m のます目・1階 3m・正面は +z。
 *   手前の列（家の側）   … 正面 z=-0.4（中心 z=-2.4・向き 0）
 *   向かいの列           … 正面 z=13.7（中心 z=15.7・向き π）
 *   交差する道の西の列   … 正面 x=25.2（中心 x=23.2・向き π/2）
 *   交差する道の東の列   … 正面 x=38.8（中心 x=40.8・向き -π/2）
 *   メトロの入口のある通り … 南の列は正面 z=-0.4、北の列は正面 z=3.6（向き π）
 * 木は季節で入れかわる（SeasonTrees。季節は src/lib/season.ts。入社式の 4月1日は春）:
 *   春 … 並木も桜にし、花びらが散って地面にもつもる／夏 … イチョウと桜の緑の葉／
 *   秋 … イチョウは黄色・桜は紅葉（頂点の色を置きかえる）／冬 … 葉の落ちた木。
 */

const R0 = 0;
const RPI = Math.PI;
const RW = Math.PI / 2; // 正面が +x
const RE = -Math.PI / 2; // 正面が -x

type B = [url: string, x: number, z: number, r: number];

const BUILDINGS: B[] = [
  // 手前の列（家の側）
  ["street/shop2", -18, -2.4, R0],
  ["street/shop2", -14, -2.4, R0],
  ["street/shop3", -10, -2.4, R0],
  ["street/apartment", 0, -2.4, R0],
  ["street/shop2", 8, -2.4, R0],
  ["street/shop3", 12, -2.4, R0],
  ["street/shop-wide", 18, -2.4, R0],
  ["street/shop-corner", 25, -2.4, R0],
  // 向かいの列
  ["street/shop3", -18, 15.7, RPI],
  ["street/shop2", -14, 15.7, RPI],
  ["street/shop2", -10, 15.7, RPI],
  ["street/shop-wide", -4, 15.7, RPI],
  ["street/shop-wide", 4, 15.7, RPI],
  ["street/sento", 12, 17.7, RPI],
  ["street/shop2", 18, 15.7, RPI],
  ["street/shop3", 22, 15.7, RPI],
  ["street/shop-corner", 25.7, 15.7, RPI],
  // 交差する道の西の列
  ["street/shop3", 23.2, -8.4, RW],
  ["street/shop2", 23.2, -12.4, RW],
  ["street/shop3", 23.2, -16.4, RW],
  ["street/shop-wide", 23.2, -22.4, RW],
  ["street/shop2", 23.2, -28.4, RW],
  ["street/shop3", 23.2, -32.4, RW],
  ["street/shop2", 23.2, 19.7, RW],
  ["street/shop3", 23.2, 23.7, RW],
  ["street/shop-wide", 23.2, 29.7, RW],
  ["street/shop2", 23.2, 35.7, RW],
  // 交差する道の東の列
  ["street/shop2", 40.8, -8.4, RE],
  ["street/shop3", 40.8, -12.4, RE],
  ["street/shop-wide", 40.8, -18.4, RE],
  ["street/shop2", 40.8, -24.4, RE],
  ["street/shop3", 40.8, -28.4, RE],
  ["street/shop2", 40.8, 9.6, RE],
  ["street/shop3", 40.8, 13.6, RE],
  ["street/shop-wide", 40.8, 19.6, RE],
  ["street/shop2", 40.8, 25.6, RE],
  ["street/shop3", 40.8, 29.6, RE],
  // メトロの入口のある通り（南の列・北の列）
  ["street/shop2", 42, -2.4, R0],
  ["street/konbini", 48, -2.4, R0],
  ["street/shop2", 54, -2.4, R0],
  ["street/shop3", 58, -2.4, R0],
  ["street/shop-corner", 40.8, 5.6, RPI],
  ["street/shop2", 44.8, 5.6, RPI],
  ["street/shop3", 48.8, 5.6, RPI],
  ["street/shop-wide", 54.8, 5.6, RPI],
];

/** 地面（歩道・道・点字ブロック・タイルの目地）。 */
function Ground() {
  const geo = useMemo(() => {
    const walk = "#d9d3c5";
    const curb = "#a19d94";
    const road = "#4a4b4f";
    const parts = [
      box(260, 0.1, 200, "#bdb8aa", { pos: [20, -0.06, 0] }),
      // 道
      box(48, 0.04, 7.4, road, { pos: [3.7, -0.02, 7.0] }),
      box(8.6, 0.04, 92, "#45464a", { pos: [32, -0.02, 0] }),
      box(44, 0.05, 0.12, "#f2f2f2", { pos: [3.7, 0.0, 7.0] }),
      box(0.12, 0.05, 34, "#f2f2f2", { pos: [32, 0.0, 28] }),
      box(0.12, 0.05, 40, "#f2f2f2", { pos: [32, 0.0, -24] }),
      // 停止線
      box(4, 0.05, 0.3, "#f2f2f2", { pos: [30, 0.0, 4.6] }),
      box(4, 0.05, 0.3, "#f2f2f2", { pos: [34, 0.0, -1.2] }),
      // 歩道
      box(48, 0.14, 3.6, walk, { pos: [3.7, 0.0, 1.4] }),
      box(48, 0.14, 3.0, walk, { pos: [3.7, 0.0, 12.2] }),
      box(2.5, 0.14, 46, walk, { pos: [26.45, 0.0, -23.4] }),
      box(2.5, 0.14, 32, walk, { pos: [26.45, 0.0, 29.7] }),
      box(2.5, 0.14, 46, walk, { pos: [37.55, 0.0, -23.4] }),
      box(2.5, 0.14, 42, walk, { pos: [37.55, 0.0, 24.6] }),
      box(26, 0.14, 4.0, walk, { pos: [49.3, 0.0, 1.6] }),
      // 縁石
      box(48, 0.18, 0.15, curb, { pos: [3.7, 0.02, 3.22] }),
      box(48, 0.18, 0.15, curb, { pos: [3.7, 0.02, 10.72] }),
    ];
    // 歩道のタイルの目地（手前の歩道だけ。いちばん目に入る）
    for (let x = -20; x <= 27; x += 1.2) {
      parts.push(box(0.04, 0.02, 3.5, shade(walk, 0.86), { pos: [x, 0.075, 1.4] }));
    }
    parts.push(box(48, 0.02, 0.04, shade(walk, 0.86), { pos: [3.7, 0.075, 0.2] }));
    parts.push(box(48, 0.02, 0.04, shade(walk, 0.86), { pos: [3.7, 0.075, 2.6] }));
    // 点字ブロック（黄色い線）: 手前の歩道 → 横断歩道 → 向こう → メトロの入口へ
    const yellow = "#f2c21b";
    const strip = (x0: number, x1: number, z: number) => {
      parts.push(box(x1 - x0, 0.03, 0.3, yellow, { pos: [(x0 + x1) / 2, 0.08, z] }));
      for (let k = -1; k <= 1; k += 1) {
        parts.push(
          box(x1 - x0, 0.015, 0.03, shade(yellow, 0.8), {
            pos: [(x0 + x1) / 2, 0.1, z + k * 0.09],
          }),
        );
      }
    };
    const dots = (x: number, z: number) => {
      parts.push(box(0.6, 0.03, 0.6, yellow, { pos: [x, 0.08, z] }));
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          parts.push(
            box(0.05, 0.02, 0.05, shade(yellow, 0.8), {
              pos: [x - 0.21 + i * 0.14, 0.105, z - 0.21 + j * 0.14],
            }),
          );
        }
      }
    };
    strip(-19, 26.6, 1.2);
    dots(26.9, 1.2);
    dots(37.6, 1.2);
    strip(37.9, 41.9, 1.2);
    dots(42.2, 1.2);
    return merge(parts);
  }, []);
  return <mesh geometry={geo} material={FLAT} raycast={() => null} />;
}

/** 遠くのビル（霞の向こうに見える高い建物）。数を決めて毎回同じ並びにする。 */
function Skyline() {
  const geo = useMemo(() => {
    let s = 7;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const colors = ["#c9ccd2", "#b8bec8", "#d8d2c6", "#a9b3bf", "#e2ddd2", "#9aa5b1", "#cfc6b8"];
    const parts = [];
    for (let i = 0; i < 70; i += 1) {
      const ang = (i / 70) * Math.PI * 2 + rnd() * 0.05;
      const dist = 62 + rnd() * 60;
      const cx = 20 + Math.cos(ang) * dist;
      const cz = 4 + Math.sin(ang) * dist;
      const w = 8 + rnd() * 12;
      const d = 8 + rnd() * 10;
      const h = 14 + rnd() * rnd() * 70;
      const c = colors[Math.floor(rnd() * colors.length)]!;
      parts.push(block(w, h, d, c, { pos: [cx, 0, cz] }));
      // 窓の帯
      for (let y = 3; y < h - 1.5; y += 3.2) {
        parts.push(box(w + 0.12, 1.1, d + 0.12, shade(c, 0.72), { pos: [cx, y + 0.9, cz] }));
      }
      // 屋上の機械
      if (rnd() > 0.4)
        parts.push(block(w * 0.3, 2, d * 0.3, shade(c, 0.85), { pos: [cx + w * 0.15, h, cz] }));
    }
    return merge(parts);
  }, []);
  return <mesh geometry={geo} material={FLAT} raycast={() => null} />;
}

const GINKGO: Place[] = [
  // 向かいの歩道（イチョウ並木）
  ...[-18, -10, -2, 6, 14, 22].map((x) => ({
    p: [x, 0, 11.6] as [number, number, number],
    s: 0.72,
    r: x,
  })),
  // 手前の歩道（車道がわ）
  { p: [10, 0, 2.95], s: 0.62, r: 1 },
  { p: [20, 0, 2.95], s: 0.62, r: 2 },
  // 交差する道
  ...[-12, -20, -28, 20, 28].map((z) => ({
    p: [26.3, 0, z] as [number, number, number],
    s: 0.7,
    r: z,
  })),
  ...[-12, -20, -28, 16, 24, 32].map((z) => ({
    p: [37.7, 0, z] as [number, number, number],
    s: 0.7,
    r: z,
  })),
];

/** 落ち葉（木の下に散らす）。 */
const LITTER: Place[] = GINKGO.flatMap((g, i) =>
  [0, 1, 2, 3].map((k) => ({
    p: [
      g.p[0] + Math.cos(i * 2.1 + k * 1.7) * (0.6 + k * 0.45),
      0.075,
      g.p[2] + Math.sin(i * 1.3 + k * 2.3) * (0.5 + k * 0.3),
    ] as [number, number, number],
    r: i + k,
    s: 1.2,
  })),
);

/** 2本の桜（向かいの歩道）。 */
const CHERRY: Place[] = [
  { p: [16.6, 0, 12.4], s: 0.8, r: 0 },
  { p: [-7.2, 0, 12.6], s: 0.7, r: 0 },
];

/** 季節の木。並木（GINKGO の場所）と 2本の桜と、木の下の地面。 */
function SeasonTrees() {
  const season = currentSeason();
  if (season === "spring") {
    // 桜並木（桜の模型はイチョウより小さいので、大きめに置く）
    const rows = [
      ...GINKGO.map((g) => ({ ...g, s: (g.s ?? 1) * 1.75 })),
      ...CHERRY.map((c) => ({ ...c, s: (c.s ?? 1) * 1.3 })),
    ];
    return (
      <>
        <Many url="street/cherry" at={rows} />
        <Many url="street/ginkgo-litter" at={LITTER} recolor={SPRING_PETALS} />
        <PetalFall trees={rows.map((r) => r.p)} />
      </>
    );
  }
  if (season === "winter") {
    return (
      <Many
        url="street/bare-tree"
        at={[
          ...GINKGO.map((g) => ({ ...g, s: (g.s ?? 1) * 1.5 })),
          ...CHERRY.map((c) => ({ ...c, s: 1 })),
        ]}
      />
    );
  }
  const autumn = season === "autumn";
  return (
    <>
      <Many url="street/ginkgo" at={GINKGO} recolor={autumn ? AUTUMN_GINKGO : undefined} />
      {autumn && <Many url="street/ginkgo-litter" at={LITTER} recolor={AUTUMN_GINKGO} />}
      <Many url="street/cherry" at={CHERRY} recolor={autumn ? AUTUMN_MAPLE : SUMMER_CHERRY} />
    </>
  );
}

export function Town() {
  return (
    <>
      <Ground />
      <Skyline />
      {BUILDINGS.map(([url, x, z, r], i) => (
        <Prop
          key={i}
          url={url}
          position={[x, 0, z]}
          rotationY={r}
          recolor={pastelWall(WALL_PASTELS[(i * 5) % WALL_PASTELS.length]!)}
        />
      ))}

      {/* 木（季節で入れかわる） */}
      <SeasonTrees />

      {/* 電柱と電線（8m おき） */}
      <Many
        url="street/pole"
        at={[
          ...[-18, -10, -2, 6, 14, 22].map((x) => ({
            p: [x, 0, 3.45] as [number, number, number],
            r: Math.PI / 2,
          })),
          ...[-14, -6, 2, 10, 18].map((x) => ({
            p: [x, 0, 10.95] as [number, number, number],
            r: Math.PI / 2,
          })),
          ...[-34, -26, -18, -10].map((z) => ({
            p: [27.45, 0, z] as [number, number, number],
            r: 0,
          })),
          ...[12, 20, 28].map((z) => ({ p: [36.6, 0, z] as [number, number, number], r: 0 })),
          ...[44, 52].map((x) => ({ p: [x, 0, 3.3] as [number, number, number], r: Math.PI / 2 })),
        ]}
      />
      <Many
        url="street/lamp"
        at={[
          { p: [2, 0, 3.3], r: Math.PI },
          { p: [16, 0, 3.3], r: Math.PI },
          { p: [-6, 0, 10.9], r: 0 },
          { p: [8, 0, 10.9], r: 0 },
          { p: [37.8, 0, 3.4], r: Math.PI },
        ]}
      />
      <Many
        url="street/guardrail"
        at={[4, 8, 12, 16, 20, 24].map((x) => ({ p: [x, 0.07, 3.0] as [number, number, number] }))}
      />
      <Many
        url="street/bollard"
        at={[
          { p: [26.3, 0.07, 3.0] },
          { p: [27.1, 0.07, 3.0] },
          { p: [37.1, 0.07, 3.0] },
          { p: [37.9, 0.07, 3.0] },
        ]}
      />

      {/* 手前の列の店先 */}
      <StoreFronts />

      {/* 道の上の物 */}
      <Prop url="street/kei-van" position={[8, 0, 5.2]} rotationY={Math.PI / 2} />
      <Prop url="street/taxi" position={[-9, 0, 8.8]} rotationY={-Math.PI / 2} />
      <Many
        url="street/manhole"
        at={[{ p: [14, 0, 7.6] }, { p: [-4, 0, 5.4] }, { p: [32, 0, 18] }]}
      />
    </>
  );
}

/** 店先の小物（のれん・日よけ・たて看板・室外機・自転車・ごみ箱など）。 */
function StoreFronts() {
  return (
    <>
      {/* 家（アパート）の前 */}
      <Prop url="street/shrub" position={[-2.2, 0.07, 0.1]} />
      <Prop url="street/shrub" position={[2.2, 0.07, 0.1]} />
      <Prop url="street/meter" position={[-4.5, 1.0, -0.38]} />
      <Prop url="street/post-box" position={[-7.0, 0.07, 0.2]} />
      {/* 家とならびの路地（-8〜-6） */}
      <Prop url="street/block-wall" position={[-7, 0, -4.2]} />
      <Prop url="street/drum" position={[-7.5, 0.07, -1.2]} />
      <Prop url="street/crate" position={[-6.6, 0.07, -0.9]} />
      <Prop url="street/crate" position={[-6.6, 0.43, -0.9]} rotationY={0.3} />

      {/* 自動販売機（2台ならび） */}
      <Prop url="street/vending" position={[6.65, 0.07, 0.05]} />
      <Prop url="street/vending" position={[7.8, 0.07, 0.05]} />
      <Prop url="street/bin" position={[8.75, 0.07, 0.1]} />

      {/* 2階建ての店（x=8）: のれんと、たての看板 */}
      <Noren position={[9.0, 2.05, -0.3]} text="town.soba" />
      <VSign position={[6.35, 3.9, 0.05]} text="town.soba" />
      <Prop url="street/aircon" position={[9.2, 3.6, -0.2]} />

      {/* 3階建ての店（x=12）: 朝なのでシャッターが閉まっている */}
      <Prop url="street/shutter" position={[12, 0.07, -0.25]} />
      <Prop url="street/aircon" position={[11.0, 3.6, -0.2]} />
      <Prop url="street/aircon" position={[13.0, 6.6, -0.2]} />
      <Prop url="street/post-box" position={[13.9, 0.07, 0.25]} />

      {/* 広い店（x=18）: 日よけ・たて看板・プランター・自転車 */}
      <VSign position={[14.35, 3.9, 0.05]} text="town.cafe" bg="#2f5d3a" fg="#ffffff" />
      <Prop url="street/awning" position={[16, 2.45, 0.1]} />
      <Prop url="street/awning" position={[20, 2.45, 0.1]} />
      <Prop url="street/sandwich-board" position={[17.4, 1.07, 0.55]} rotationY={0.2} />
      <Many url="street/planter" at={[{ p: [14.9, 0.07, 0.0] }, { p: [21.2, 0.07, 0.0] }]} />
      <Prop url="street/bike-rack" position={[19.0, 0.07, 0.25]} />
      <Many
        url="street/bicycle"
        at={[18.2, 18.75, 19.3, 19.85].map((x, i) => ({
          p: [x, 0.38, 0.35] as [number, number, number],
          r: i % 2 ? 0.08 : -0.06,
        }))}
      />
      <Prop url="street/moped" position={[22.4, 0.46, 0.35]} rotationY={0.15} />

      {/* 店のすき間の路地（x=22〜23） */}
      <Prop url="street/bin" position={[22.5, 0.07, -1.0]} />
      <Prop url="street/drum" position={[22.5, 0.07, -2.0]} />

      {/* 角のカーブミラー */}
      <Prop url="street/mirror" position={[25.4, 0.07, 3.0]} rotationY={Math.PI * 0.85} />

      {/* 角の店（x=25） */}
      <VSign
        position={[27.42, 3.9, -1.2]}
        rotationY={Math.PI / 2}
        text="town.kusuri"
        bg="#1f5fa8"
        fg="#ffffff"
        frame="#e8e8e8"
      />
      <Prop url="street/aircon" position={[24, 3.6, -0.2]} />
      <Prop url="street/meter" position={[24.4, 1.0, -0.38]} />

      {/* 向かいの列（道の向こう） */}
      <Prop url="street/vending" position={[9.6, 0.07, 13.2]} rotationY={Math.PI} />
      <Prop url="street/vending" position={[10.75, 0.07, 13.2]} rotationY={Math.PI} />
      <Noren position={[18, 2.05, 13.6]} rotationY={Math.PI} text="town.sushi" />
      <Noren position={[12, 2.05, 13.6]} rotationY={Math.PI} text="town.yu" />
      <VSign
        position={[2.2, 3.9, 13.25]}
        rotationY={Math.PI}
        text="town.cafe"
        bg="#2f5d3a"
        fg="#ffffff"
      />
      <VSign
        position={[-15.8, 3.9, 13.25]}
        rotationY={Math.PI}
        text="town.pan"
        bg="#f6e7c8"
        fg="#8a4b14"
      />
      <Prop url="street/awning" position={[4, 2.45, 13.2]} rotationY={Math.PI} />
      <Prop url="street/shutter" position={[22, 0.07, 13.45]} rotationY={Math.PI} />
      <Prop url="street/shutter" position={[-14, 0.07, 13.45]} rotationY={Math.PI} />
      <Prop url="street/bike-rack" position={[-1, 0.07, 13.0]} rotationY={Math.PI} />
      <Many
        url="street/bicycle"
        at={[-1.8, -1.25, -0.7, -0.15].map((x, i) => ({
          p: [x, 0.38, 12.95] as [number, number, number],
          r: Math.PI + (i % 2 ? 0.08 : -0.06),
        }))}
      />
      <Many
        url="street/aircon"
        at={[-18, -14, -10, 18, 22].map((x) => ({
          p: [x + 1, 3.6, 13.5] as [number, number, number],
          r: Math.PI,
        }))}
      />

      {/* メトロの入口のある通り */}
      <Prop url="street/vending" position={[38.9, 0.07, -0.0]} />
      <Prop url="street/bin" position={[39.7, 0.07, 0.1]} />
      <Prop url="street/sandwich-board" position={[40.4, 1.07, 0.05]} rotationY={-0.3} />
      <Prop url="street/bike-rack" position={[52, 0.07, 0.3]} />
      <Many
        url="street/bicycle"
        at={[51.2, 51.75, 52.3].map((x) => ({ p: [x, 0.38, 0.4] as [number, number, number] }))}
      />
      <Noren position={[44.8, 2.05, 3.5]} rotationY={Math.PI} text="town.soba" />
      <VSign
        position={[48.6, 3.9, 3.15]}
        rotationY={Math.PI}
        text="town.cafe"
        bg="#2f5d3a"
        fg="#ffffff"
      />
    </>
  );
}
