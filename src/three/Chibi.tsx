import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarConfig } from "@/lib/store";
import { useGLTF } from "@react-three/drei";
import { faceTexture, type Expression } from "@/three/chibi";
import { AVATAR_URL, DRACO_URL, pickParts, softMaterial } from "@/three/avatar-parts";
import { AvatarBodyExtras, AvatarHeadExtras } from "@/three/avatar-extras";

/** 頭の半径（tools/blender/build_avatar.py の R と同じ）。 */
const HEAD_R = 0.29;

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
  | "phone"
  | "wave"
  | "cheer"
  | "twirl"
  | "writing"
  | "calling"
  | "raise"
  | "point";

/** 手に持つ物（まわりの人の くらしの様子）。notebook は左手に小さいノート・右手にペン（writing の動きと使う）。 */
export type ChibiHolding = "phone" | "briefcase" | "coffee" | "notebook";

/** 動きの中で、腕を止めておく角度（持つ物の向きを、この角度から逆に計算する）。 */
const POSE = {
  /** writing: 左手でノートを胸の前に持つ。 */
  writeL: { z: -0.15, x: -1.1 },
  /** calling: 右手でスマホを耳（ほっぺの横）に当てる。 */
  callR: { z: -2.3, x: 0.45 },
};

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
  hopTrigger = 0,
  seated = false,
}: {
  config: AvatarConfig;
  motion?: ChibiMotion;
  motionRef?: React.RefObject<ChibiMotion>;
  phase?: number;
  holding?: ChibiHolding;
  /** 表情（セリフや場面に合わせて変える）。 */
  expression?: Expression;
  /** 値が増えるたびに、着がえた時の ぴょんっと よろこぶ動きをする。 */
  hopTrigger?: number;
  /** すわっている（足だけ いすに すわった形にする。腕と頭は motion のまま）。 */
  seated?: boolean;
}) {
  const key = JSON.stringify(config);
  // ブレンダーで作った部品（public/models/avatar/avatar.glb）から、設定に合うものを選ぶ
  const gltf = useGLTF(AVATAR_URL, DRACO_URL);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parts = useMemo(() => pickParts(gltf.scene, config), [gltf, key]);
  const J = parts.joints;
  const headGeo = getHeadGeo();

  const faceOpen = useMemo(() => faceTexture(config, true, expression), [config, expression]);
  const faceClosed = useMemo(
    () => faceTexture(config, false, expression === "happy" ? "happy" : "normal"),
    [config, expression],
  );
  const faceMat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        map: faceOpen,
        gradientMap: (softMaterial("#ffffff") as THREE.MeshToonMaterial).gradientMap,
      }),
    [faceOpen],
  );
  useEffect(() => () => faceMat.dispose(), [faceMat]);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const blink = useRef({ next: 2 + phase * 3, until: 0 });
  const t0 = useRef(phase * 10);
  const hop = useRef({ last: hopTrigger, t: 1 });

  useFrame((s, dt) => {
    const m = motionRef?.current ?? motion;
    const tt = s.clock.elapsedTime + t0.current;
    const b = body.current;
    const h = head.current;
    if (!b || !h || !armL.current || !armR.current || !legL.current || !legR.current) return;
    if (hopTrigger !== hop.current.last) {
      hop.current.last = hopTrigger;
      hop.current.t = 0;
    }
    if (hop.current.t < 1) {
      hop.current.t = Math.min(1, hop.current.t + dt * 2.8);
    }
    const hopArc = hop.current.t < 1 ? Math.sin(hop.current.t * Math.PI) : 0;

    const k = Math.min(1, dt * 12);
    const lerp = (o: THREE.Object3D, axis: "x" | "y" | "z", v: number) => {
      o.rotation[axis] += (v - o.rotation[axis]) * k;
    };
    let bodyY = 0;
    let rootY = 0;
    let bodyPitch = 0;
    let headPitch = 0;
    let headRoll = Math.sin(tt * 1.3) * 0.03;
    let aL = 0.08;
    let aR = -0.08;
    let aLx = 0;
    let aRx = 0;
    let lLx = 0;
    let lRx = 0;
    let rootSpin = 0;
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
        rootY = Math.abs(Math.cos(tt * f)) * 0.028;
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
        rootY = Math.max(0, Math.sin(tt * 9)) * 0.055;
        aL = 0.9;
        aR = -0.9;
        aLx = -0.4;
        aRx = -0.4;
        headPitch = -0.12;
        break;
      case "wave":
        // 元気に 手をふる
        aR = -2.25 + Math.sin(tt * 8.5) * 0.35;
        aRx = -0.35;
        aL = 0.15;
        headRoll = -0.08 + Math.sin(tt * 4.2) * 0.04;
        rootY = Math.abs(Math.sin(tt * 4.2)) * 0.015;
        break;
      case "cheer":
        // うれしくて ぴょんぴょん ばんざい（全身で 跳ねて 胴と足が 離れないようにする）
        rootY = Math.abs(Math.sin(tt * 6.5)) * 0.075;
        aL = 2.35 + Math.sin(tt * 6.5) * 0.2;
        aR = -2.35 - Math.sin(tt * 6.5) * 0.2;
        headPitch = -0.08;
        headRoll = Math.sin(tt * 6.5) * 0.09;
        lLx = Math.sin(tt * 6.5) * 0.2;
        lRx = -Math.sin(tt * 6.5) * 0.2;
        break;
      case "twirl":
        // くるっと 1回転して 服を 見せる
        rootSpin = tt * 2.2;
        aL = 0.65;
        aR = -0.65;
        rootY = Math.abs(Math.sin(tt * 4.4)) * 0.025;
        break;
      case "writing":
        // メモを取る: 左手でノートを持ち、右手のペンを小さく動かす。頭は少し下
        aL = POSE.writeL.z;
        aLx = POSE.writeL.x;
        aR = 0.35 + Math.sin(tt * 13) * 0.05;
        aRx = -1.0 + Math.sin(tt * 9) * 0.06;
        headPitch = 0.12;
        break;
      case "calling":
        // 電話をかける: 右手のスマホを耳に当て、頭を少し そちらへ かたむける
        aR = POSE.callR.z;
        aRx = POSE.callR.x;
        aL = 0.12;
        headRoll = -0.1;
        bodyY = Math.sin(tt * 2.2) * 0.006;
        break;
      case "raise":
        // 質問する: 右手を 上げる（腕が短いので、頭に かくれないよう 横に 開いて 少し前へ）
        aR = -2.35 + Math.sin(tt * 3) * 0.05;
        aRx = -0.45;
        aL = 0.1;
        headPitch = -0.08;
        headRoll = -0.06;
        break;
      case "point":
        // 少し前に かがんで、右手で前の物（画面など）を指す
        bodyPitch = 0.22;
        headPitch = -0.12;
        aRx = -1.25;
        aR = 0.2;
        aL = 0.1;
        break;
      default:
        bodyY = Math.sin(tt * 2.2) * 0.006;
        aL = 0.08 + Math.sin(tt * 2.2) * 0.03;
        aR = -0.08 - Math.sin(tt * 2.2) * 0.03;
    }

    if (seated) {
      lLx = -1.45;
      lRx = -1.45;
    }

    if (hopArc > 0) {
      rootY += hopArc * 0.09;
      aL += hopArc * 0.45;
      aR -= hopArc * 0.45;
    }

    if (root.current) {
      root.current.position.y += (rootY - root.current.position.y) * k;
      if (m === "twirl") root.current.rotation.y = rootSpin;
      else root.current.rotation.y += (0 - root.current.rotation.y) * k;
    }

    const baseY = J.hipL.y;
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

  const scale = (config.height ?? 168) / 168;
  const hipY = J.hipL.y;
  // 肩を 少し 内がわへ寄せて、胴と腕の すきまを 無くす（やわらかい どう森ふうの ライン）
  const shoulderL: [number, number, number] = [J.shoulderL.x * 0.84, J.shoulderL.y, J.shoulderL.z];
  const shoulderR: [number, number, number] = [J.shoulderR.x * 0.84, J.shoulderR.y, J.shoulderR.z];
  const meshes = (list: THREE.Mesh[]) => list.map((m) => <primitive key={m.name} object={m} />);

  return (
    <group ref={root} scale={scale}>
      {/* 腰を中心に曲げる（おじぎ）ため、体は腰の高さに置き、中身を下げる */}
      <group ref={body} position={[0, hipY, 0]}>
        <group position={[0, -hipY, 0]}>
          {meshes(parts.body)}
          <AvatarBodyExtras config={config} />
          <group ref={head} position={J.head.toArray()}>
            <mesh geometry={headGeo} material={faceMat} />
            {meshes(parts.head)}
            <AvatarHeadExtras config={config} />
          </group>
          <group ref={armL} position={shoulderL}>
            {meshes(parts.armL)}
            {holding === "notebook" && <Notebook />}
          </group>
          <group ref={armR} position={shoulderR}>
            {meshes(parts.armR)}
            {holding && <Held kind={holding} calling={motion === "calling"} />}
          </group>
        </group>
      </group>
      <group ref={legL} position={J.hipL.toArray()}>
        {meshes(parts.legL)}
      </group>
      <group ref={legR} position={J.hipR.toArray()}>
        {meshes(parts.legR)}
      </group>
    </group>
  );
}

/**
 * 頭の形（顔のライン）。tomy さんの参考の絵（codex_out/hair_ref_cute_*.png。2026-11-23「送った顔のラインも参考にして」）に合わせ、
 * ほっぺを ふっくら横に広げ、あごは まるく少し平らにする（おもちのような顔）。上の半分は 今までの まるい頭のまま
 * （髪は この上に かぶせて作ってあるので、上は変えない）。
 */
let sharedHeadGeo: THREE.BufferGeometry | null = null;
function getHeadGeo(): THREE.BufferGeometry {
  sharedHeadGeo ??= faceShape();
  return sharedHeadGeo;
}

function faceShape(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(HEAD_R, 48, 32);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const v = y / HEAD_R; // -1（あご）〜 1（頭の上）
    // ほっぺ: 目の高さより下を 横に広げる（いちばん広いのは v=-0.35 あたり）
    const cheek = Math.exp(-(((v + 0.35) / 0.38) ** 2));
    const front = Math.max(0, z / HEAD_R); // 顔の前の方だけ
    const wx = 1.08 * (1 + 0.075 * cheek);
    const wz = 1 + 0.05 * cheek * front;
    // あご: 下を少し平らに（まるいまま）
    const ny = v < -0.55 ? y * (1 - 0.1 * ((-v - 0.55) / 0.45) ** 1.5) : y;
    p.setXYZ(i, x * wx, ny * 0.95, z * wz);
  }
  g.computeVertexNormals();
  return g;
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
  cover: new THREE.MeshToonMaterial({ color: "#f29b8f" }),
  paper: new THREE.MeshToonMaterial({ color: "#fffdf6" }),
  line: new THREE.MeshToonMaterial({ color: "#9fb4d8" }),
  pen: new THREE.MeshToonMaterial({ color: "#3f6fc4" }),
  phoneCase: new THREE.MeshToonMaterial({ color: "#6fa8dc" }),
};
const noteGeo = {
  cover: new THREE.BoxGeometry(0.17, 0.008, 0.12),
  page: new THREE.BoxGeometry(0.078, 0.006, 0.11),
  line: new THREE.BoxGeometry(0.06, 0.002, 0.006),
  pen: new THREE.CylinderGeometry(0.007, 0.004, 0.11, 8),
};

/**
 * 腕の回転を打ち消す入れもの（中身は 体の向きのまま置ける）。arm は肩の回転（z・x）。
 * 手の位置（肩から 約0.2m 下）に置く。
 */
function Upright({ arm, children }: { arm: { z: number; x: number }; children: React.ReactNode }) {
  return (
    <group position={[0, -0.2, 0]}>
      <group rotation={[-arm.x, 0, -arm.z, "ZYX"]}>{children}</group>
    </group>
  );
}

/** 左手に持つ 開いた小さいノート（ページに 書いた線）。 */
function Notebook() {
  return (
    <Upright arm={POSE.writeL}>
      <group position={[-0.075, 0.015, 0.03]} rotation={[0.55, 0, 0]}>
        <mesh geometry={noteGeo.cover} material={heldMat.cover} />
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.041, 0.006, 0]}>
            <mesh geometry={noteGeo.page} material={heldMat.paper} />
            {[-0.03, -0.01, 0.01, 0.03].map((z) => (
              <mesh
                key={z}
                geometry={noteGeo.line}
                material={heldMat.line}
                position={[0, 0.004, z]}
                scale={[sx < 0 || z < 0.02 ? 1 : 0.5, 1, 1]}
              />
            ))}
          </group>
        ))}
      </group>
    </Upright>
  );
}

/** 右手に持つ物（手の位置は、肩から 約0.19m 下）。 */
function Held({ kind, calling }: { kind: ChibiHolding; calling: boolean }) {
  if (kind === "notebook")
    // 右手のペン（先を ノートの方へ 向ける）
    return (
      <group position={[0, -0.2, 0.02]} rotation={[0.9, 0, 0.3]}>
        <mesh geometry={noteGeo.pen} material={heldMat.pen} />
      </group>
    );
  if (kind === "phone" && calling)
    // 耳に当てたスマホ（たてに持ち、画面を ほっぺに向ける）
    return (
      <Upright arm={POSE.callR}>
        <group position={[0.02, 0.05, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <group rotation={[0, 0, Math.PI / 2]} scale={1.25}>
            <mesh geometry={heldGeo.phone} material={heldMat.phoneCase} />
          </group>
        </group>
      </Upright>
    );
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

useGLTF.preload(AVATAR_URL, DRACO_URL);
