import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettings } from "@/lib/store";
import type { Season } from "@/lib/season";

/**
 * 季節の小物（src/lib/season.ts の季節で使い分ける）。
 * - PetalFall: 春に、桜の木のまわりで花びらが ひらひら散る。
 * - drawWindowTrees: 家の窓から見える木（2D の絵。季節で色が変わる）。
 */

const petalGeo = (() => {
  const g = new THREE.CircleGeometry(0.035, 6);
  g.scale(1, 0.62, 1);
  return g;
})();
const petalMat = new THREE.MeshBasicMaterial({ color: "#ffd3df", side: THREE.DoubleSide });

/** 桜の花びらが散る（木の上から落ちて、地面に着いたら また上から）。 */
export function PetalFall({ trees }: { trees: [number, number, number][] }) {
  const low = useSettings((s) => s.quality) === "low";
  const perTree = low ? 10 : 24;
  const count = trees.length * perTree;
  const ref = useRef<THREE.InstancedMesh>(null);
  // 1枚ごとの もとの位置・落ちる速さ・ゆれ
  const petals = useMemo(() => {
    const list: { x: number; z: number; y: number; v: number; ph: number; spin: number }[] = [];
    trees.forEach((p, i) => {
      for (let k = 0; k < perTree; k += 1) {
        const a = (k * 2.39996 + i) % (Math.PI * 2);
        const r = 0.6 + ((k * 37) % 23) / 10;
        list.push({
          x: p[0] + Math.cos(a) * r,
          z: p[2] + Math.sin(a) * r,
          y: ((k * 53 + i * 17) % 50) / 10,
          v: 0.35 + ((k * 13) % 7) / 20,
          ph: k * 1.7 + i,
          spin: 1 + ((k * 7) % 5) / 2,
        });
      }
    });
    return list;
  }, [trees, perTree]);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame((s, dt) => {
    const im = ref.current;
    if (!im) return;
    const t = s.clock.elapsedTime;
    const step = Math.min(dt, 0.05);
    petals.forEach((p, i) => {
      p.y -= p.v * step;
      if (p.y < 0.02) p.y = 4.8 + (i % 7) * 0.12;
      const sway = Math.sin(t * 1.3 + p.ph) * 0.35;
      tmp.position.set(p.x + sway, p.y, p.z + Math.cos(t * 0.9 + p.ph) * 0.25);
      tmp.rotation.set(t * p.spin + p.ph, t * 0.7 + p.ph, 0);
      tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[petalGeo, petalMat, count]} frustumCulled={false} />;
}

/** 窓の外の木（手前に2本）。季節で葉の色が変わる（冬は枝だけ）。 */
export function drawWindowTrees(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  season: Season,
) {
  const leaves: Record<Season, string[]> = {
    spring: ["#ffc4d4", "#ffd9e3", "#f7a9c0"],
    summer: ["#5f9e4a", "#78b45c", "#4b8a3c"],
    autumn: ["#e8a22a", "#d9622b", "#f0c14a"],
    winter: [],
  };
  for (const [cx, s] of [
    [w * 0.2, 1],
    [w * 0.86, 0.85],
  ] as const) {
    const base = h * 1.02;
    // みき と えだ
    ctx.strokeStyle = "#6b4a35";
    ctx.lineCap = "round";
    ctx.lineWidth = w * 0.022 * s;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx, h * 0.58);
    ctx.stroke();
    ctx.lineWidth = w * 0.009 * s;
    for (const [dx, dy] of [
      [-0.09, -0.2],
      [0.08, -0.22],
      [-0.05, -0.33],
      [0.06, -0.34],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, h * 0.66);
      ctx.lineTo(cx + dx * w * s, h * 0.66 + dy * h * s);
      ctx.stroke();
    }
    // 葉・花（まるい かたまり）
    const cols = leaves[season];
    if (!cols.length) continue;
    const blobs = [
      [0, -0.3, 0.12],
      [-0.09, -0.22, 0.09],
      [0.09, -0.24, 0.09],
      [-0.05, -0.4, 0.08],
      [0.06, -0.39, 0.085],
      [0, -0.16, 0.08],
    ] as const;
    blobs.forEach(([dx, dy, r], i) => {
      ctx.fillStyle = cols[i % cols.length]!;
      ctx.beginPath();
      ctx.ellipse(
        cx + dx * w * s,
        h * 0.66 + dy * h * s,
        r * w * s,
        r * w * s * 0.85,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }
}
