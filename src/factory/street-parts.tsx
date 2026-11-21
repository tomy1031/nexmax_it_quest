import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { t } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { box, cyl, FLAT, glowMaterial, merge } from "@/factory/kit";
import { drawRuby } from "@/factory/text-canvas";

const BASE = import.meta.env.BASE_URL;

/** polyfork のモデルを置く（素材は共通の FLAT にそろえる）。 */
export function Prop({
  url,
  position,
  rotationY = 0,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const gltf = useGLTF(`${BASE}models/${url}.glb`);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.material = FLAT;
    });
    return o;
  }, [gltf]);
  return <primitive object={obj} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

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

/** 押しボタンの箱（「おしてください」・押すと「おまちください」が光る）。 */
export function PushButtonBox({
  position,
  rotationY = 0,
  waiting,
}: {
  position: [number, number, number];
  rotationY?: number;
  waiting: boolean;
}) {
  const body = useMemo(
    () =>
      merge([
        box(0.26, 0.4, 0.12, "#f2f2ee"),
        box(0.12, 0.12, 0.05, "#e9e3c4", { pos: [0, -0.06, 0.07] }),
      ]),
    [],
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={FLAT} />
      <mesh position={[0, -0.06, 0.1]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 16]} />
        <meshStandardMaterial
          color="#f7d24a"
          emissive="#f7a800"
          emissiveIntensity={waiting ? 0.2 : 0.8}
        />
      </mesh>
      <CanvasPanel
        width={0.22}
        height={0.15}
        ppm={1400}
        position={[0, 0.11, 0.062]}
        emissive
        fontText={t("sign.pushButton") + t("sign.wait")}
        deps={[waiting]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#f7f7f2";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("sign.pushButton"), w / 2, h * 0.36, {
            size: h * 0.2,
            color: "#1b3f8f",
            align: "center",
          });
          ctx.fillStyle = waiting ? "#ff5a3c" : "#e9e1dc";
          ctx.fillRect(w * 0.08, h * 0.52, w * 0.84, h * 0.38);
          drawRuby(ctx, t("sign.wait"), w / 2, h * 0.8, {
            size: h * 0.19,
            color: waiting ? "#ffffff" : "#c9bdb6",
            align: "center",
          });
        }}
      />
    </group>
  );
}
