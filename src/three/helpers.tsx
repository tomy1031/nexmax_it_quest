import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { questEvents } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { isDrag } from "@/three/Interactable";
import { emptyLayout, useLayout, type Layout } from "@/three/layout";
import { player, walkTo } from "@/three/player";
import { NexmaxModel, type NexmaxFace, type NexmaxMotion } from "@/three/Nexmax";

/**
 * 場面の地図を書く。useLayoutEffect は、子の部品の useEffect（クリックできる物が自分の位置を足す）より先に動くので、
 * ここで地図を丸ごと書きかえても、子が足した位置は消えない。
 */
export function useSceneLayout(layout: Partial<Layout>): void {
  useLayoutEffect(() => {
    useLayout.setState({ ...emptyLayout, ...layout, targets: { ...(layout.targets ?? {}) } }, true);
    // 場面ごとに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** 場面の 3D がそろったら「scene:ready」を出す（Suspense の中に置く）。 */
export function Ready() {
  useEffect(() => {
    const id = window.setTimeout(() => questEvents.emit("scene:ready"), 60);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

/** 床。クリックした所へ歩く。 */
export function WalkSurface({
  size = [60, 60],
  y = 0,
  center = [0, 0],
}: {
  size?: [number, number];
  y?: number;
  center?: [number, number];
}) {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (isDrag(e)) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
    usePlay.setState({});
    clickRing.set(e.point.x, e.point.z);
  };
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[center[0], y + 0.002, center[1]]}
      onClick={onClick}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** クリックした所に出る輪（タイトル画像の、ネクマックスの足元の輪と同じ形）。 */
const clickRing = {
  x: 0,
  z: 0,
  t: -10,
  set(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.t = performance.now() / 1000;
  },
};

export function ClickRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const age = performance.now() / 1000 - clickRing.t;
    m.visible = age < 0.6;
    m.position.set(clickRing.x, 0.03, clickRing.z);
    const s = 0.3 + age * 0.9;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - age * 1.5);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[0.8, 1, 40]} />
      <meshBasicMaterial color="#7ff6ff" transparent toneMapped={false} />
    </mesh>
  );
}

/** いま する ことの目印（矢印と床の輪）。改札・ホームを選ぶ場面では台本が arrow:false にして出さない。 */
export function ObjectiveMarker() {
  const objective = usePlay((s) => s.objective);
  const targets = useLayout((s) => s.targets);
  const anchors = useLayout((s) => s.anchors);
  const arrow = useRef<THREE.Group>(null);
  const target =
    objective?.arrow && objective.target
      ? (targets[objective.target] ?? anchors[objective.target]?.pos)
      : undefined;

  useFrame((s) => {
    const a = arrow.current;
    if (!a || !target) return;
    a.position.set(
      target[0],
      target[1] + 0.45 + Math.sin(s.clock.elapsedTime * 3) * 0.08,
      target[2],
    );
    a.rotation.y = s.clock.elapsedTime * 1.5;
  });

  if (!target) return null;
  const onGround = target[1] < 0.2;
  return (
    <>
      <group ref={arrow}>
        <mesh rotation={[Math.PI, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.16, 0.34, 4]} />
          <meshBasicMaterial color="#ffd84d" toneMapped={false} />
        </mesh>
      </group>
      {onGround && <GroundBeacon x={target[0]} z={target[2]} />}
    </>
  );
}

function GroundBeacon({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const k = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.12;
    m.scale.set(k, k, k);
  });
  return (
    <mesh
      ref={ref}
      position={[x, 0.03, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        if (isDrag(e)) return;
        e.stopPropagation();
        walkTo(x, z);
      }}
    >
      <ringGeometry args={[0.45, 0.62, 40]} />
      <meshBasicMaterial color="#38e1ff" transparent opacity={0.85} toneMapped={false} />
    </mesh>
  );
}

/**
 * ネクマックス（いつも自分の近くに浮かぶ）。3D のモデルは tomy1031/lab の nexmax.glb（src/three/Nexmax.tsx）。
 * 台本の pose で動きと表情を変える（hello＝手をふる・cheer＝ジャンプ・ほかは待機）。いつもカメラの方を向く。
 */
const POSE_MOTION: Record<string, { motion: NexmaxMotion; face: NexmaxFace }> = {
  hello: { motion: "wave", face: "happy" },
  cheer: { motion: "jump", face: "happy" },
  guide: { motion: "idle", face: "happy" },
  book: { motion: "idle", face: "determined" },
  listen: { motion: "idle", face: "determined" },
  build: { motion: "idle", face: "determined" },
};
const COMPANION_SCALE = 0.42;

export function Companion() {
  const line = usePlay((s) => s.line);
  // アップ（券売機・時計・信号など）の間は出さない。前に出て、見たい物をかくしてしまうため（tomy さん 2026-11-22）
  const focus = usePlay((s) => s.focus);
  const pose = line?.who === "nexmax" ? (line.pose ?? "guide") : null;
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3());
  const showPlayer = useLayout((s) => s.showPlayer);
  const walking = useRef(false);
  const [moving, setMoving] = useState(false);

  useFrame((s, dt) => {
    const g = ref.current;
    if (!g) return;
    const side = new THREE.Vector3(0.7, 0.72, 0.2).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      player.yaw,
    );
    const want = player.pos.clone().add(side);
    if (!showPlayer) {
      const cam = s.camera;
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      want
        .copy(cam.position)
        .add(fwd.multiplyScalar(2.2))
        .add(new THREE.Vector3(0.9, -0.6, 0).applyQuaternion(cam.quaternion));
    }
    pos.current.lerp(want, Math.min(1, dt * 3));
    g.position.copy(pos.current);
    g.position.y += Math.sin(s.clock.elapsedTime * 2) * 0.04;
    // カメラの方を向く
    const to = s.camera.position.clone().sub(g.position);
    const yaw = Math.atan2(to.x, to.z);
    let diff = yaw - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, dt * 5);
    if (player.moving !== walking.current) {
      walking.current = player.moving;
      setMoving(player.moving);
    }
  });

  const pm = pose ? (POSE_MOTION[pose] ?? POSE_MOTION.guide!) : null;
  const motion: NexmaxMotion = pm ? pm.motion : moving ? "walk" : "idle";
  const face: NexmaxFace = pm ? pm.face : "happy";
  return (
    <group ref={ref} scale={COMPANION_SCALE} visible={!focus}>
      <Suspense fallback={null}>
        <NexmaxModel motion={motion} face={face} />
      </Suspense>
    </group>
  );
}

export type LightPreset = "day" | "room" | "underground" | "train";

/** 光の決まり。polyfork の色は強い色調補正なしで作られているので、補正をかけずに明るさで合わせる。 */
export function Lights({ preset }: { preset: LightPreset }) {
  switch (preset) {
    case "day":
      return (
        <>
          <hemisphereLight args={["#dff1ff", "#8c8a7a", 1.9]} />
          <directionalLight position={[8, 14, 6]} intensity={2.2} color="#fff6e8" />
          <ambientLight intensity={0.25} />
        </>
      );
    case "room":
      return (
        <>
          <hemisphereLight args={["#fff4e6", "#7a6a5a", 1.5]} />
          <directionalLight position={[-3, 5, 2]} intensity={1.6} color="#fff1d8" />
          <pointLight position={[0, 2.4, 0]} intensity={6} distance={9} color="#fff3e0" />
        </>
      );
    case "underground":
      return (
        <>
          <hemisphereLight args={["#f3f8ff", "#6c7480", 1.7]} />
          <directionalLight position={[2, 8, 4]} intensity={1.2} color="#ffffff" />
          <ambientLight intensity={0.35} />
        </>
      );
    case "train":
      return (
        <>
          <hemisphereLight args={["#ffffff", "#7a8090", 1.8]} />
          <directionalLight position={[0, 6, 2]} intensity={1} />
          <ambientLight intensity={0.4} />
        </>
      );
  }
}
