import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarConfig } from "@/lib/store";
import {
  buildChibi,
  chibiMaterial,
  chibiOutlineMaterial,
  CHIBI_JOINTS,
  faceTexture,
  HEAD,
  type Expression,
} from "@/three/chibi";
import { useSettings } from "@/lib/store";

export type ChibiMotion =
  | "idle"
  | "walk"
  | "run"
  | "sitting"
  | "talking"
  | "agree"
  | "bow"
  | "surprised"
  | "sleep"
  | "phone";

/** 手に持つ物（まわりの人の くらしの様子）。 */
export type ChibiHolding = "phone" | "briefcase" | "coffee";

/**
 * ちびキャラ（自分・主要キャラ・まわりの人）。骨を使わず、体・頭・腕・足の部品を回して動かす。
 * motionRef を渡すと、毎フレームそこから動きを読む（歩く・止まるを React を通さずに切りかえる）。
 */
export function Chibi({
  config,
  motion = "idle",
  motionRef,
  phase = 0,
  holding,
  expression = "normal",
}: {
  config: AvatarConfig;
  motion?: ChibiMotion;
  motionRef?: React.RefObject<ChibiMotion>;
  phase?: number;
  holding?: ChibiHolding;
  /** 表情（セリフや場面に合わせて変える）。 */
  expression?: Expression;
}) {
  const key = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parts = useMemo(() => buildChibi(config), [key]);
  useEffect(
    () => () => {
      Object.values(parts).forEach((g) => g.dispose());
    },
    [parts],
  );

  const faceOpen = useMemo(() => faceTexture(config, true, expression), [config, expression]);
  const faceClosed = useMemo(
    () => faceTexture(config, false, expression === "happy" ? "happy" : "normal"),
    [config, expression],
  );
  const faceMat = useMemo(
    () => new THREE.MeshToonMaterial({ map: faceOpen, gradientMap: chibiMaterial().gradientMap }),
    [faceOpen],
  );
  useEffect(() => () => faceMat.dispose(), [faceMat]);

  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const blink = useRef({ next: 2 + phase * 3, until: 0 });
  const t0 = useRef(phase * 10);

  useFrame((s, dt) => {
    const m = motionRef?.current ?? motion;
    const tt = s.clock.elapsedTime + t0.current;
    const b = body.current;
    const h = head.current;
    if (!b || !h || !armL.current || !armR.current || !legL.current || !legR.current) return;
    const k = Math.min(1, dt * 12);
    const lerp = (o: THREE.Object3D, axis: "x" | "y" | "z", v: number) => {
      o.rotation[axis] += (v - o.rotation[axis]) * k;
    };
    let bodyY = 0;
    let bodyPitch = 0;
    let headPitch = 0;
    let headRoll = Math.sin(tt * 1.3) * 0.03;
    let aL = 0.12;
    let aR = -0.12;
    let aLx = 0;
    let aRx = 0;
    let lLx = 0;
    let lRx = 0;
    switch (m) {
      case "walk":
      case "run": {
        const f = m === "run" ? 13 : 9;
        const sw = Math.sin(tt * f);
        const amp = m === "run" ? 0.9 : 0.6;
        lLx = sw * amp;
        lRx = -sw * amp;
        aLx = -sw * amp * 1.1;
        aRx = sw * amp * 1.1;
        bodyY = Math.abs(Math.cos(tt * f)) * 0.035;
        headRoll = sw * 0.05;
        break;
      }
      case "sitting":
        lLx = -1.45;
        lRx = -1.45;
        aLx = -0.5;
        aRx = -0.5;
        break;
      case "talking":
        headPitch = Math.sin(tt * 6) * 0.06;
        aRx = -0.6 + Math.sin(tt * 4) * 0.25;
        aR = -0.3;
        bodyY = Math.sin(tt * 2) * 0.008;
        break;
      case "agree":
        headPitch = Math.max(0, Math.sin(tt * 5)) * 0.25;
        break;
      case "bow":
        bodyPitch = 0.55;
        headPitch = 0.15;
        aL = 0.05;
        aR = -0.05;
        break;
      case "phone":
        // スマホを見る: 右手を胸の前に上げ、下を向く
        aRx = -1.25;
        aR = 0.25;
        aLx = -0.35;
        headPitch = 0.28;
        bodyY = Math.sin(tt * 2.2) * 0.006;
        break;
      case "sleep":
        // 寝ている: 手と足をまっすぐ、ゆっくり息をする
        aL = 0.08;
        aR = -0.08;
        bodyY = Math.sin(tt * 1.2) * 0.006;
        headRoll = 0.15;
        break;
      case "surprised":
        bodyY = Math.max(0, Math.sin(tt * 9)) * 0.05;
        aL = 0.9;
        aR = -0.9;
        aLx = -0.4;
        aRx = -0.4;
        headPitch = -0.12;
        break;
      default:
        bodyY = Math.sin(tt * 2.2) * 0.008;
        aL = 0.12 + Math.sin(tt * 2.2) * 0.03;
        aR = -0.12 - Math.sin(tt * 2.2) * 0.03;
    }
    const baseY = CHIBI_JOINTS.HIP.y;
    b.position.y += (baseY + bodyY - b.position.y) * k;
    lerp(b, "x", bodyPitch);
    lerp(h, "x", headPitch);
    lerp(h, "z", headRoll);
    lerp(armL.current, "z", aL);
    lerp(armR.current, "z", aR);
    lerp(armL.current, "x", aLx);
    lerp(armR.current, "x", aRx);
    lerp(legL.current, "x", lLx);
    lerp(legR.current, "x", lRx);

    // まばたき
    const bl = blink.current;
    if (tt > bl.next) {
      bl.until = tt + 0.12;
      bl.next = tt + 2.5 + ((tt * 7.3) % 3);
    }
    const want = m === "sleep" || tt < bl.until ? faceClosed : faceOpen;
    if (faceMat.map !== want) {
      faceMat.map = want;
      faceMat.needsUpdate = true;
    }
  });

  const mat = chibiMaterial();
  // ふちの線（「かるい」設定では描かない）
  const lowQuality = useSettings((st) => st.quality) === "low";
  const ol = lowQuality ? null : chibiOutlineMaterial();
  const part = (g: THREE.BufferGeometry, m: THREE.Material) => (
    <>
      <mesh geometry={g} material={m} />
      {ol && <mesh geometry={g} material={ol} raycast={() => null} />}
    </>
  );
  const { SHOULDER, HIP } = CHIBI_JOINTS;
  const scale = (config.height ?? 168) / 168;

  return (
    <group scale={scale}>
      {/* 腰を中心に曲げる（おじぎ）ため、体は腰の高さに置き、中身を下げる */}
      <group ref={body} position={[0, HIP.y, 0]}>
        <group position={[0, -HIP.y, 0]}>
          {part(parts.body, mat)}
          <group ref={head} position={[0, HEAD.y, 0]}>
            {part(parts.head, faceMat)}
            {part(parts.headExtras, mat)}
          </group>
          <group ref={armL} position={[SHOULDER.x, SHOULDER.y, 0]}>
            {part(parts.armL, mat)}
          </group>
          <group ref={armR} position={[-SHOULDER.x, SHOULDER.y, 0]}>
            {part(parts.armR, mat)}
            {holding && <Held kind={holding} />}
          </group>
        </group>
      </group>
      <group ref={legL} position={[HIP.x, HIP.y, 0]}>
        {part(parts.legL, mat)}
      </group>
      <group ref={legR} position={[-HIP.x, HIP.y, 0]}>
        {part(parts.legR, mat)}
      </group>
    </group>
  );
}

const heldGeo = {
  phone: new THREE.BoxGeometry(0.07, 0.012, 0.13),
  screen: new THREE.PlaneGeometry(0.058, 0.11),
  case: new THREE.BoxGeometry(0.2, 0.15, 0.05),
  handle: new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI),
  cup: new THREE.CylinderGeometry(0.03, 0.024, 0.08, 14),
  lid: new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14),
};
const heldMat = {
  dark: new THREE.MeshToonMaterial({ color: "#23262d" }),
  screen: new THREE.MeshBasicMaterial({ color: "#8fd6ff" }),
  leather: new THREE.MeshToonMaterial({ color: "#3a2a20" }),
  cup: new THREE.MeshToonMaterial({ color: "#f4efe6" }),
  sleeve: new THREE.MeshToonMaterial({ color: "#8a5a36" }),
};

/** 右手に持つ物（手の位置は、肩から 約0.19m 下）。 */
function Held({ kind }: { kind: ChibiHolding }) {
  if (kind === "phone")
    return (
      <group position={[0, -0.2, 0.06]} rotation={[0.5, 0, 0]}>
        <mesh geometry={heldGeo.phone} material={heldMat.dark} />
        <mesh
          geometry={heldGeo.screen}
          material={heldMat.screen}
          position={[0, 0.007, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </group>
    );
  if (kind === "briefcase")
    return (
      <group position={[0, -0.3, 0.01]}>
        <mesh geometry={heldGeo.case} material={heldMat.leather} rotation={[0, Math.PI / 2, 0]} />
        <mesh
          geometry={heldGeo.handle}
          material={heldMat.dark}
          position={[0, 0.075, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
      </group>
    );
  return (
    <group position={[0, -0.21, 0.05]}>
      <mesh geometry={heldGeo.cup} material={heldMat.cup} />
      <mesh geometry={heldGeo.cup} material={heldMat.sleeve} scale={[1.04, 0.45, 1.04]} />
      <mesh geometry={heldGeo.lid} material={heldMat.dark} position={[0, 0.045, 0]} />
    </group>
  );
}
