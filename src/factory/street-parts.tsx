import { useMemo } from "react";
import * as THREE from "three";
import { t } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { box, cyl, FLAT, glowMaterial, merge } from "@/factory/kit";
import { drawRuby } from "@/factory/text-canvas";

/** polyfork の部品を置く道具は props.tsx へ移した（ここからも使えるように出しておく）。 */
export { Prop } from "@/factory/props";

export type CarLight = "green" | "yellow" | "red" | "red-arrow";

const lampGeo = new THREE.CircleGeometry(0.13, 20);
const off = new THREE.MeshStandardMaterial({ color: "#2a2b2e", roughness: 0.6 });
const mats = {
  green: glowMaterial("#33e0b0", 2.2),
  yellow: glowMaterial("#ffc21a", 2.2),
  red: glowMaterial("#ff3b2f", 2.2),
  arrow: glowMaterial("#33e0b0", 2.2),
};

/** 車の信号（日本の横長の3つの灯と、下の緑の矢印）。 */
export function CarSignal({
  position,
  rotationY = 0,
  light,
}: {
  position: [number, number, number];
  rotationY?: number;
  light: CarLight;
}) {
  const body = useMemo(
    () =>
      merge([
        cyl(0.09, 5.2, "#5d6168", { pos: [0, 2.6, 0] }),
        box(2.4, 0.08, 0.08, "#5d6168", { pos: [-1.1, 5.0, 0] }),
        box(1.15, 0.42, 0.26, "#3a3d44", { pos: [-2.0, 5.0, 0] }),
        box(0.42, 0.36, 0.2, "#3a3d44", { pos: [-1.63, 4.62, 0] }),
      ]),
    [],
  );
  const arrowShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.1, -0.035);
    s.lineTo(0.03, -0.035);
    s.lineTo(0.03, -0.08);
    s.lineTo(0.11, 0);
    s.lineTo(0.03, 0.08);
    s.lineTo(0.03, 0.035);
    s.lineTo(-0.1, 0.035);
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={FLAT} />
      <mesh
        geometry={lampGeo}
        position={[-2.38, 5.0, 0.135]}
        material={light === "green" ? mats.green : off}
      />
      <mesh
        geometry={lampGeo}
        position={[-2.0, 5.0, 0.135]}
        material={light === "yellow" ? mats.yellow : off}
      />
      <mesh
        geometry={lampGeo}
        position={[-1.62, 5.0, 0.135]}
        material={light === "red" || light === "red-arrow" ? mats.red : off}
      />
      <mesh
        geometry={arrowShape}
        position={[-1.63, 4.62, 0.105]}
        material={light === "red-arrow" ? mats.arrow : off}
      />
    </group>
  );
}

export type PedLight = "green" | "blink" | "red";

/** 歩行者の信号（人の形の絵は記号なので、Canvas に描いてよい）。 */
export function PedSignal({
  position,
  rotationY = 0,
  light,
  blinkOn,
}: {
  position: [number, number, number];
  rotationY?: number;
  light: PedLight;
  blinkOn: boolean;
}) {
  const body = useMemo(
    () =>
      merge([
        cyl(0.07, 2.9, "#5d6168", { pos: [0, 1.45, 0] }),
        box(0.42, 0.82, 0.22, "#3a3d44", { pos: [0, 2.85, 0] }),
      ]),
    [],
  );
  const greenOn = light === "green" || (light === "blink" && blinkOn);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={FLAT} />
      <CanvasPanel
        width={0.34}
        height={0.34}
        ppm={400}
        position={[0, 3.05, 0.115]}
        emissive
        deps={[light === "red"]}
        draw={(ctx, w, h) => drawPerson(ctx, w, h, "stand", light === "red")}
      />
      <CanvasPanel
        width={0.34}
        height={0.34}
        ppm={400}
        position={[0, 2.66, 0.115]}
        emissive
        deps={[greenOn]}
        draw={(ctx, w, h) => drawPerson(ctx, w, h, "walk", greenOn)}
      />
    </group>
  );
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: "stand" | "walk",
  on: boolean,
) {
  ctx.fillStyle = "#15161a";
  ctx.fillRect(0, 0, w, h);
  const color = on ? (kind === "stand" ? "#ff3b2f" : "#33e0b0") : "#2c2e33";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = w * 0.09;
  const cx = w / 2;
  ctx.beginPath();
  ctx.arc(cx, h * 0.2, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  if (kind === "stand") {
    ctx.moveTo(cx, h * 0.32);
    ctx.lineTo(cx, h * 0.62);
    ctx.moveTo(cx - w * 0.06, h * 0.62);
    ctx.lineTo(cx - w * 0.06, h * 0.88);
    ctx.moveTo(cx + w * 0.06, h * 0.62);
    ctx.lineTo(cx + w * 0.06, h * 0.88);
    ctx.moveTo(cx - w * 0.16, h * 0.36);
    ctx.lineTo(cx - w * 0.16, h * 0.6);
    ctx.moveTo(cx + w * 0.16, h * 0.36);
    ctx.lineTo(cx + w * 0.16, h * 0.6);
  } else {
    ctx.moveTo(cx, h * 0.32);
    ctx.lineTo(cx - w * 0.02, h * 0.6);
    ctx.lineTo(cx - w * 0.18, h * 0.88);
    ctx.moveTo(cx - w * 0.02, h * 0.6);
    ctx.lineTo(cx + w * 0.16, h * 0.86);
    ctx.moveTo(cx, h * 0.38);
    ctx.lineTo(cx - w * 0.18, h * 0.55);
    ctx.moveTo(cx, h * 0.38);
    ctx.lineTo(cx + w * 0.16, h * 0.52);
  }
  ctx.stroke();
}

/**
 * 押しボタンの箱（本物の形: 黄色い箱・角のねじ・上に黒い窓・まん中に銀のふちの赤い丸ボタン・
 * 下に赤く光る「おしてください」。押すと上の窓に「おまちください」が赤く光る。tomy さんの写真 2026-11-22）。
 * 正面は +z。position は箱のまん中。
 */
export function PushButtonBox({
  position,
  rotationY = 0,
  waiting,
}: {
  position: [number, number, number];
  rotationY?: number;
  waiting: boolean;
}) {
  const W = 0.22;
  const H = 0.25;
  const D = 0.1;
  const body = useMemo(() => {
    const p: THREE.BufferGeometry[] = [
      // 黄色い箱（ふたのふちを少し明るく）
      box(W, H, D, "#f7c81e"),
      // 上の窓・下の字の帯の黒いわく
      box(0.17, 0.052, 0.008, "#16171a", { pos: [0, 0.072, D / 2 + 0.004] }),
      box(0.17, 0.04, 0.008, "#16171a", { pos: [0, -0.085, D / 2 + 0.004] }),
      // ボタンの銀のふち
      cyl(0.036, 0.014, "#c9cdd2", { pos: [0, -0.006, D / 2 + 0.008], rot: [Math.PI / 2, 0, 0] }),
      cyl(0.03, 0.016, "#8d9299", { pos: [0, -0.006, D / 2 + 0.01], rot: [Math.PI / 2, 0, 0] }),
      // 右がわのちょうつがい
      box(0.012, 0.07, 0.02, "#d9ab16", { pos: [W / 2 + 0.004, 0.06, 0] }),
      box(0.012, 0.07, 0.02, "#d9ab16", { pos: [W / 2 + 0.004, -0.06, 0] }),
    ];
    // 角のねじ
    for (const [x, y] of [
      [-0.093, 0.105],
      [0.093, 0.105],
      [-0.093, -0.035],
      [0.093, -0.035],
    ] as [number, number][]) {
      p.push(
        cyl(0.007, 0.008, "#d6d9dd", { pos: [x, y, D / 2 + 0.006], rot: [Math.PI / 2, 0, 0] }),
      );
    }
    return merge(p);
  }, []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={FLAT} />
      {/* 黄色いふた（日かげでも本物のように明るい黄色に見えるよう、少しだけ自分で光らせる） */}
      <mesh position={[0, 0, D / 2 + 0.001]}>
        <boxGeometry args={[W - 0.012, H - 0.012, 0.006]} />
        <meshStandardMaterial
          color="#ffd21f"
          emissive="#ffb800"
          emissiveIntensity={0.32}
          roughness={0.55}
        />
      </mesh>
      {/* 赤い丸ボタン（押したあとは少し光る） */}
      <mesh position={[0, -0.006, D / 2 + 0.019]} scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.024, 20, 12]} />
        <meshStandardMaterial
          color="#d9262c"
          emissive="#ff2a2a"
          emissiveIntensity={waiting ? 0.9 : 0.15}
          roughness={0.35}
        />
      </mesh>
      {/* 上の窓: 押すと「おまちください」が赤く光る */}
      <CanvasPanel
        width={0.16}
        height={0.042}
        ppm={2400}
        position={[0, 0.072, D / 2 + 0.0085]}
        emissive
        fontText={t("sign.wait")}
        deps={[waiting]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#0b0b0d";
          ctx.fillRect(0, 0, w, h);
          if (!waiting) return;
          drawRuby(ctx, t("sign.wait"), w / 2, h * 0.74, {
            size: Math.min(h * 0.6, (w * 0.9) / [...t("sign.wait")].length),
            color: "#ff3b2a",
            align: "center",
            shadow: "rgba(255,60,40,0.8)",
          });
        }}
      />
      {/* 下の帯: 「おしてください」がいつも赤く光る */}
      <CanvasPanel
        width={0.16}
        height={0.032}
        ppm={2400}
        position={[0, -0.085, D / 2 + 0.0085]}
        emissive
        fontText={t("sign.pushButton")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#0b0b0d";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("sign.pushButton"), w / 2, h * 0.78, {
            size: Math.min(h * 0.7, (w * 0.9) / [...t("sign.pushButton")].length),
            color: "#ff3b2a",
            align: "center",
            shadow: "rgba(255,60,40,0.7)",
          });
        }}
      />
    </group>
  );
}
