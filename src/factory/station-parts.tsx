import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { t } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { block, box, cyl, FLAT, glowMaterial, merge, shade } from "@/factory/kit";
import {
  drawLed,
  drawLineSign,
  drawRouteMap,
  drawStationName,
  LINE,
  type LedRow,
  type LineSignSpec,
} from "@/factory/signs";
import { drawRuby } from "@/factory/text-canvas";

/**
 * 駅の部品（グラフィック工場）。寸法は実物に近づける（改札機の高さ 約1m・券売機 約1.75m・ホームの高さ 約1.1m）。
 * どれも1つの形にまとめ、共通の素材 FLAT で描く。
 */

export function Mesh({
  geo,
  position,
  rotationY = 0,
}: {
  geo: THREE.BufferGeometry;
  position?: [number, number, number];
  rotationY?: number;
}) {
  return <mesh geometry={geo} material={FLAT} position={position} rotation={[0, rotationY, 0]} />;
}

/** きっぷだけの券売機（グレー）。 */
export function TicketMachineGray({ position }: { position: [number, number, number] }) {
  const geo = useMemo(
    () =>
      merge([
        box(0.85, 1.7, 0.6, "#c9ced6", { pos: [0, 0.85, 0] }),
        box(0.88, 0.1, 0.64, "#9aa2ad", { pos: [0, 1.75, 0] }),
        box(0.66, 0.42, 0.05, "#3b6aa0", { pos: [0, 1.2, 0.3], rot: [-0.18, 0, 0] }),
        box(0.3, 0.05, 0.05, "#1c1c22", { pos: [-0.2, 0.86, 0.31] }),
        box(0.5, 0.16, 0.04, "#ffffff", { pos: [0, 1.6, 0.31] }),
      ]),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={geo} material={FLAT} />
      <CanvasPanel
        width={0.5}
        height={0.12}
        ppm={700}
        position={[0, 1.6, 0.335]}
        fontText={t("sign.ticketMachine")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("sign.ticketMachine"), w / 2, h * 0.82, {
            size: h * 0.5,
            color: "#16264d",
            rubyColor: "#0a6bd6",
            align: "center",
          });
        }}
      />
    </group>
  );
}

/** 天井から下がる看板。 */
export function HangingSign({
  position,
  rotationY = 0,
  width = 2.6,
  height = 0.5,
  spec,
  doubleSide = true,
}: {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  spec: LineSignSpec;
  doubleSide?: boolean;
}) {
  const frame = useMemo(
    () =>
      merge([
        box(width + 0.08, height + 0.08, 0.06, "#2a2f3a"),
        box(0.04, 0.6, 0.04, "#666", { pos: [-width / 3, height / 2 + 0.3, 0] }),
        box(0.04, 0.6, 0.04, "#666", { pos: [width / 3, height / 2 + 0.3, 0] }),
      ]),
    [width, height],
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frame} material={FLAT} />
      <CanvasPanel
        width={width}
        height={height}
        ppm={360}
        position={[0, 0, 0.035]}
        emissive
        fontText={spec.text}
        deps={[spec.text, spec.lines.join(), spec.arrow]}
        draw={(ctx, w, h) => drawLineSign(ctx, w, h, spec)}
      />
      {doubleSide && (
        <CanvasPanel
          width={width}
          height={height}
          ppm={360}
          position={[0, 0, -0.035]}
          rotation={[0, Math.PI, 0]}
          emissive
          fontText={spec.text}
          deps={[spec.text, spec.lines.join(), spec.arrow]}
          draw={(ctx, w, h) => drawLineSign(ctx, w, h, spec)}
        />
      )}
    </group>
  );
}

/** 改札機の列。lineId の線の改札。 */
export function GateRow({
  position,
  count = 4,
  rotationY = 0,
  open = false,
}: {
  position: [number, number, number];
  count?: number;
  rotationY?: number;
  open?: boolean;
}) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const pitch = 0.95;
    for (let i = 0; i <= count; i += 1) {
      const x = (i - count / 2) * pitch;
      parts.push(block(0.22, 1.0, 1.5, "#d7dbe2", { pos: [x, 0, 0] }));
      parts.push(box(0.24, 0.05, 1.52, "#5b6372", { pos: [x, 1.02, 0] }));
      parts.push(box(0.2, 0.03, 0.22, "#3fb4ff", { pos: [x, 1.05, 0.45] }));
      parts.push(box(0.2, 0.06, 0.12, "#25303f", { pos: [x, 1.0, -0.6] }));
    }
    return merge(parts);
  }, [count]);
  const flaps = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = flaps.current;
    if (!g) return;
    g.children.forEach((c) => {
      const want = open ? Math.PI / 2 : 0;
      c.rotation.y += (want * (c.userData.side as number) - c.rotation.y) * Math.min(1, dt * 8);
    });
  });
  const flapGeo = useMemo(() => box(0.34, 0.3, 0.03, "#e85c7a", { pos: [0.17, 0, 0] }), []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geo} material={FLAT} />
      <group ref={flaps}>
        {Array.from({ length: count }, (_, i) => {
          const x = (i - count / 2) * 0.95;
          return (
            <group key={i}>
              <mesh
                geometry={flapGeo}
                material={FLAT}
                position={[x + 0.11, 0.75, 0.1]}
                userData={{ side: 1 }}
              />
              <mesh
                geometry={flapGeo}
                material={FLAT}
                position={[x + 0.84, 0.75, 0.1]}
                rotation={[0, Math.PI, 0]}
                userData={{ side: -1 }}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** かべの路線図。 */
export function RouteMapBoard({
  position,
  rotationY = 0,
  here,
}: {
  position: [number, number, number];
  rotationY?: number;
  here?: string;
}) {
  const frame = useMemo(() => box(3.3, 2.1, 0.08, "#20283a"), []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frame} material={FLAT} />
      <CanvasPanel
        width={3.2}
        height={2.0}
        ppm={420}
        position={[0, 0, 0.045]}
        emissive
        fontText={t("quiz.title")}
        draw={(ctx, w, h) => drawRouteMap(ctx, w, h, t("menu.routemap"), here)}
      />
    </group>
  );
}

/** 電光掲示板。 */
export function LedBoard({
  position,
  rotationY = 0,
  title,
  rows,
}: {
  position: [number, number, number];
  rotationY?: number;
  title: string;
  rows: LedRow[];
}) {
  const frame = useMemo(
    () =>
      merge([
        box(2.3, 0.78, 0.12, "#1a1a1e"),
        box(0.05, 0.8, 0.05, "#555", { pos: [-0.8, 0.79, 0] }),
        box(0.05, 0.8, 0.05, "#555", { pos: [0.8, 0.79, 0] }),
      ]),
    [],
  );
  const labels = {
    first: t("sign.first"),
    second: t("sign.second"),
    bound: t("sign.bound"),
    track: t("sign.track"),
  };
  const fontText =
    title + rows.map((r) => r.kind + r.dest).join("") + Object.values(labels).join("");
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frame} material={FLAT} />
      <CanvasPanel
        width={2.2}
        height={0.7}
        ppm={520}
        position={[0, 0, 0.065]}
        emissive
        fontText={fontText}
        deps={[title, JSON.stringify(rows)]}
        draw={(ctx, w, h) => drawLed(ctx, w, h, title, rows, labels)}
      />
    </group>
  );
}

/** 駅名標（ホームのかべ）。 */
export function StationNameBoard({
  position,
  rotationY = 0,
  station,
  line,
  prev,
  next,
}: {
  position: [number, number, number];
  rotationY?: number;
  station: string;
  line: string;
  prev?: string;
  next?: string;
}) {
  const frame = useMemo(() => box(2.5, 0.9, 0.08, "#c4c9d2"), []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frame} material={FLAT} />
      <CanvasPanel
        width={2.4}
        height={0.8}
        ppm={420}
        position={[0, 0, 0.045]}
        emissive
        fontText={station}
        draw={(ctx, w, h) => drawStationName(ctx, w, h, station, line, prev, next)}
      />
    </group>
  );
}

/** 地下の部屋（床・かべ・天井・柱・天井のあかり）。 */
export function Hall({
  width,
  depth,
  height = 3.4,
  floor = "#d9d4c8",
  wall = "#eef0f2",
  pillars = [],
}: {
  width: number;
  depth: number;
  height?: number;
  floor?: string;
  wall?: string;
  pillars?: [number, number][];
}) {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [
      box(width, 0.1, depth, floor, { pos: [0, -0.05, 0] }),
      box(width, 0.1, depth, "#f7f7f5", { pos: [0, height, 0] }),
      box(width, height, 0.2, wall, { pos: [0, height / 2, -depth / 2] }),
      box(width, height, 0.2, wall, { pos: [0, height / 2, depth / 2] }),
      box(0.2, height, depth, wall, { pos: [-width / 2, height / 2, 0] }),
      box(0.2, height, depth, wall, { pos: [width / 2, height / 2, 0] }),
      box(width, 0.3, 0.22, "#bfc6cf", { pos: [0, 0.15, -depth / 2 + 0.01] }),
    ];
    // 床のタイルの線
    for (let x = -width / 2 + 2; x < width / 2; x += 2)
      p.push(box(0.03, 0.005, depth, shade(floor, 0.9), { pos: [x, 0.003, 0] }));
    for (const [x, z] of pillars) p.push(block(0.7, height, 0.7, "#cfd5dc", { pos: [x, 0, z] }));
    return merge(p);
  }, [width, depth, height, floor, wall, pillars]);
  const lights = useMemo(() => {
    const p: THREE.BufferGeometry[] = [];
    for (let x = -width / 2 + 2; x < width / 2; x += 4)
      for (let z = -depth / 2 + 2; z < depth / 2; z += 4)
        p.push(box(1.4, 0.05, 0.25, "#ffffff", { pos: [x, height - 0.05, z] }));
    return merge(p);
  }, [width, depth, height]);
  const glow = useMemo(() => glowMaterial("#ffffff", 1.2), []);
  return (
    <>
      <mesh geometry={geo} material={FLAT} />
      <mesh geometry={lights} material={glow} />
    </>
  );
}

/** ホーム（片側か両側に線路）。z が長い方向。 */
export function PlatformSlab({
  width,
  length,
  tracks,
}: {
  width: number;
  length: number;
  tracks: ("left" | "right")[];
}) {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [
      box(width, 0.2, length, "#cfcac0", { pos: [0, -0.1, 0] }),
      box(width, 1.0, length, "#8d8a84", { pos: [0, -0.7, 0] }),
      box(width + 12, 0.1, length, "#3b3a38", { pos: [0, -1.25, 0] }),
      box(width + 12, 6, 0.2, "#d6d9de", { pos: [0, 1.5, -length / 2] }),
      box(width + 12, 6, 0.2, "#d6d9de", { pos: [0, 1.5, length / 2] }),
      box(width + 12, 0.15, length, "#eef0f2", { pos: [0, 3.6, 0] }),
    ];
    // 黄色の点字ブロックと白線
    for (const side of [-1, 1]) {
      p.push(box(0.3, 0.012, length, "#f2c230", { pos: [side * (width / 2 - 0.85), 0.006, 0] }));
      p.push(box(0.08, 0.01, length, "#ffffff", { pos: [side * (width / 2 - 0.12), 0.005, 0] }));
    }
    for (const side of tracks) {
      const sx = side === "left" ? -1 : 1;
      const cx = sx * (width / 2 + 1.6);
      p.push(box(0.08, 0.15, length, "#8a8f96", { pos: [cx - 0.55, -1.12, 0] }));
      p.push(box(0.08, 0.15, length, "#8a8f96", { pos: [cx + 0.55, -1.12, 0] }));
      for (let z = -length / 2; z < length / 2; z += 0.8)
        p.push(box(1.8, 0.08, 0.22, "#5a514a", { pos: [cx, -1.18, z] }));
      p.push(box(0.2, 6, length, "#c9ccd2", { pos: [sx * (width / 2 + 3.6), 1.5, 0] }));
    }
    for (let z = -length / 2 + 4; z < length / 2; z += 8)
      p.push(block(0.5, 3.6, 0.5, "#e7e9ec", { pos: [0, 0, z] }));
    return merge(p);
  }, [width, length, tracks]);
  return <mesh geometry={geo} material={FLAT} />;
}

/** 地下鉄の電車（外から見た形）。lineId の色の帯。z の向きに長い。 */
export function TrainExterior({
  lineId,
  cars = 3,
  doorsOpen = 0,
}: {
  lineId: string;
  cars?: number;
  doorsOpen?: number;
}) {
  const color = LINE[lineId]?.color ?? "#e5171f";
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [];
    const len = 18;
    for (let i = 0; i < cars; i += 1) {
      const z = (i - (cars - 1) / 2) * (len + 0.6);
      p.push(box(2.8, 3.0, len, "#c9ced6", { pos: [0, 1.5, z] }));
      p.push(box(2.82, 0.22, len, color, { pos: [0, 2.15, z] }));
      p.push(box(2.82, 0.12, len, color, { pos: [0, 0.75, z] }));
      p.push(box(2.6, 0.2, len - 0.2, "#7b818b", { pos: [0, 3.05, z] }));
      for (const side of [-1, 1]) {
        for (let w = -len / 2 + 1.6; w < len / 2 - 1; w += 4.4) {
          p.push(box(0.04, 0.85, 1.4, "#2a3442", { pos: [side * 1.41, 1.7, z + w + 2.2] }));
        }
      }
      // 前の顔
      if (i === 0 || i === cars - 1) {
        const fz = z + (i === 0 ? -1 : 1) * (len / 2 + 0.02);
        p.push(box(2.6, 1.0, 0.04, "#1d2530", { pos: [0, 2.0, fz] }));
        p.push(box(2.6, 0.3, 0.06, color, { pos: [0, 1.2, fz] }));
      }
    }
    return merge(p);
  }, [cars, color]);
  const doorGeo = useMemo(() => box(0.06, 1.95, 0.65, "#b5bcc6"), []);
  const doors = useMemo(() => {
    const list: [number, number][] = [];
    const len = 18;
    for (let i = 0; i < cars; i += 1) {
      const z = (i - (cars - 1) / 2) * (len + 0.6);
      for (const d of [-6, -2, 2, 6]) list.push([z + d, 0]);
    }
    return list;
  }, [cars]);
  return (
    <group>
      <mesh geometry={geo} material={FLAT} />
      {[-1, 1].map((side) =>
        doors.map(([dz], j) => (
          <group key={`${side}-${j}`}>
            <mesh
              geometry={doorGeo}
              material={FLAT}
              position={[side * 1.43, 1.05, dz - 0.33 - doorsOpen * 0.6]}
            />
            <mesh
              geometry={doorGeo}
              material={FLAT}
              position={[side * 1.43, 1.05, dz + 0.33 + doorsOpen * 0.6]}
            />
          </group>
        )),
      )}
    </group>
  );
}

/** 電車の中（座席・つり革・窓・ドアの上の画面）。 */
export function TrainInterior({
  lineId,
  next,
  len = 16,
}: {
  lineId: string;
  next: string;
  len?: number;
}) {
  const color = LINE[lineId]?.color ?? "#e5171f";
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [
      box(2.7, 0.08, len, "#9aa0a8", { pos: [0, -0.04, 0] }),
      box(2.7, 0.08, len, "#f2f3f5", { pos: [0, 2.35, 0] }),
      box(2.7, 2.4, 0.1, "#dfe3e8", { pos: [0, 1.2, -len / 2] }),
      box(2.7, 2.4, 0.1, "#dfe3e8", { pos: [0, 1.2, len / 2] }),
    ];
    for (const side of [-1, 1]) {
      p.push(box(0.08, 2.4, len, "#e6e9ed", { pos: [side * 1.35, 1.2, 0] }));
      for (let z = -len / 2 + 1.4; z < len / 2 - 1; z += 4) {
        p.push(block(0.5, 0.45, 2.6, color, { pos: [side * 1.05, 0, z + 1.2] }));
        p.push(box(0.1, 0.5, 2.6, shade(color, 0.85), { pos: [side * 1.28, 0.65, z + 1.2] }));
        p.push(box(0.03, 0.75, 2.2, "#1d2733", { pos: [side * 1.3, 1.45, z + 1.2] }));
      }
      // つり革のバー
      p.push(cyl(0.02, len, "#c0c4ca", { pos: [side * 0.75, 2.05, 0], rot: [Math.PI / 2, 0, 0] }));
      for (let z = -len / 2 + 0.6; z < len / 2; z += 0.6) {
        p.push(box(0.012, 0.22, 0.012, "#ddd", { pos: [side * 0.75, 1.93, z] }));
        p.push(box(0.12, 0.12, 0.02, "#f5f5f5", { pos: [side * 0.75, 1.78, z] }));
      }
    }
    p.push(box(2.7, 0.06, 0.4, color, { pos: [0, 2.3, 0] }));
    return merge(p);
  }, [len, color]);
  return (
    <group>
      <mesh geometry={geo} material={FLAT} />
      <DoorScreen position={[0, 2.12, -len / 2 + 0.07]} next={next} lineId={lineId} />
    </group>
  );
}

/** ドアの上の画面（つぎは ○○）。 */
export function DoorScreen({
  position,
  next,
  lineId,
  rotationY = 0,
}: {
  position: [number, number, number];
  next: string;
  lineId: string;
  rotationY?: number;
}) {
  const line = LINE[lineId];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <CanvasPanel
        width={1.1}
        height={0.32}
        ppm={700}
        emissive
        fontText={t("sign.next") + next}
        deps={[next]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#0e1a2c";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = line?.color ?? "#e5171f";
          ctx.fillRect(0, 0, w * 0.04, h);
          drawRuby(ctx, t("sign.next"), w * 0.07, h * 0.62, {
            size: h * 0.22,
            color: "#9fd8ff",
            rubyColor: "#5ff3ff",
          });
          drawRuby(ctx, next, w * 0.58, h * 0.78, {
            size: h * 0.42,
            color: "#ffffff",
            rubyColor: "#5ff3ff",
            align: "center",
          });
        }}
      />
    </group>
  );
}
