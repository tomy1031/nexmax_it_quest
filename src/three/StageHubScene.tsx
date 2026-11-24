import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettings, type AvatarConfig } from "@/lib/store";
import { Chibi, type ChibiMotion } from "@/three/Chibi";
import type { Expression } from "@/three/chibi";
import { NexmaxModel } from "@/three/Nexmax";

/**
 * ステージ選択の背景になる「バーチャル大阪プラザ（VR出発広場）」。
 * ダイブで光のポータルを抜けた先に広がる、春空と桜とVRテレポートパッドの広場。
 * 自分のアバターとネクマックスが並んで出迎え、クリックやボタンホバーで元気に反応する。
 */
export function StageHubScene({
  avatar,
  motion,
  expression,
  onAvatarClick,
}: {
  avatar: AvatarConfig;
  motion: ChibiMotion;
  expression: Expression;
  onAvatarClick: () => void;
}) {
  const low = useSettings((s) => s.quality) === "low";

  return (
    <Canvas
      camera={{ position: [0.4, 2.15, 5.6], fov: 38, near: 0.1, far: 120 }}
      dpr={low ? 1 : [1, 1.5]}
      gl={{ antialias: !low }}
    >
      <color attach="background" args={["#bfe8ff"]} />
      <fog attach="fog" args={["#d8f1ff", 14, 38]} />
      <ambientLight intensity={1.05} color="#fffaf2" />
      <hemisphereLight args={["#eef9ff", "#d4ebd0", 0.72]} />
      <directionalLight position={[5, 9, 6]} intensity={0.95} color="#fff7e6" />

      <HubCamera />
      <PlazaGround />
      <PortalArch />
      <SakuraTrees />
      <PastelSkyline />
      <FloatingClouds />
      {!low && <PlazaPetals />}

      {/* プレイヤーのアバター（左側プラザのVRパッドの上） */}
      <group
        position={[-1.25, 0.04, 0.25]}
        rotation={[0, 0.3, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onAvatarClick();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <Suspense fallback={null}>
          <Chibi config={avatar} motion={motion} expression={expression} />
        </Suspense>
      </group>

      {/* ネクマックス（アバターのとなりでふわふわ浮かぶ案内役） */}
      <FloatingNexmax position={[-0.08, 0.45, -0.1]} />
    </Canvas>
  );
}

function HubCamera() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.x = 0.48 + Math.sin(t * 0.35) * 0.1;
    state.camera.position.y = 2.02 + Math.sin(t * 0.5) * 0.05;
    state.camera.lookAt(-0.08, 1.08, -0.45);
  });
  return null;
}

function FloatingNexmax({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 2.1) * 0.09;
    ref.current.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.1;
  });
  return (
    <group ref={ref} position={position} scale={0.78}>
      <Suspense fallback={null}>
        <NexmaxModel motion="wave" face="happy" />
      </Suspense>
    </group>
  );
}

function PlazaGround() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.03;
    ringRef.current.scale.set(s, s, 1);
  });

  return (
    <group>
      {/* 広いパステル芝生 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <circleGeometry args={[34, 48]} />
        <meshStandardMaterial color="#b9e6b4" roughness={0.95} />
      </mesh>
      {/* あたたかい石だたみ広場 */}
      <mesh position={[-0.75, -0.01, -0.1]}>
        <cylinderGeometry args={[3.9, 4.1, 0.08, 40]} />
        <meshStandardMaterial color="#f6ead4" roughness={0.9} />
      </mesh>
      <mesh position={[-0.75, 0.005, -0.1]}>
        <cylinderGeometry args={[3.2, 3.2, 0.06, 36]} />
        <meshStandardMaterial color="#fff6e6" roughness={0.9} />
      </mesh>
      {/* 足もとの光る VR テレポートパッド */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.25, 0.045, 0.25]}>
        <ringGeometry args={[0.56, 0.7, 36]} />
        <meshBasicMaterial color="#58e0ff" toneMapped={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[-1.25, 0.046, 0.25]}>
        <ringGeometry args={[0.8, 0.89, 36]} />
        <meshBasicMaterial color="#9ef7c8" transparent opacity={0.75} toneMapped={false} />
      </mesh>
      {/* ネクマックスの下の小さな光の輪 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.08, 0.045, -0.1]}>
        <ringGeometry args={[0.35, 0.46, 32]} />
        <meshBasicMaterial color="#7aeaff" transparent opacity={0.8} toneMapped={false} />
      </mesh>

      {/* 花壇の花たち */}
      {[
        [-3.4, 1.3, "#ffb3d1"],
        [-3.1, 1.65, "#fff09c"],
        [-3.6, 0.85, "#b3e6ff"],
        [1.8, 1.6, "#ffb3d1"],
        [2.2, 1.25, "#fff09c"],
        [-2.7, -2.5, "#ffc2df"],
        [0.9, -2.6, "#b7f09a"],
      ].map(([x, z, col], i) => (
        <group key={i} position={[x as number, 0.08, z as number]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshStandardMaterial color="#87cf7c" roughness={0.9} />
          </mesh>
          <mesh position={[0.08, 0.17, 0.06]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={col as string} roughness={0.7} />
          </mesh>
          <mesh position={[-0.1, 0.15, -0.05]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 広場のおくに立つ、タイトル画像と同じ光の VR ポータルアーチ。 */
function PortalArch() {
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (inner.current) inner.current.rotation.z = state.clock.elapsedTime * 0.45;
  });

  return (
    <group position={[-0.85, 0.04, -3.5]}>
      {/* 外側の光の輪 */}
      <mesh position={[0, 1.62, 0]}>
        <torusGeometry args={[1.76, 0.1, 14, 64]} />
        <meshBasicMaterial color="#5ad8ff" toneMapped={false} />
      </mesh>
      {/* 内側のミントゴールドの光の輪 */}
      <mesh ref={inner} position={[0, 1.62, 0.04]}>
        <torusGeometry args={[1.52, 0.048, 10, 48]} />
        <meshBasicMaterial color="#e8ffaa" toneMapped={false} />
      </mesh>
      {/* ポータル内の淡い光膜 */}
      <mesh position={[0, 1.62, -0.05]}>
        <circleGeometry args={[1.5, 40]} />
        <meshBasicMaterial color="#d8f7ff" transparent opacity={0.34} toneMapped={false} />
      </mesh>
      {/* アーチの土台 */}
      <mesh position={[-1.68, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.32, 0.44, 16]} />
        <meshStandardMaterial color="#f5e6cc" roughness={0.85} />
      </mesh>
      <mesh position={[1.68, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.32, 0.44, 16]} />
        <meshStandardMaterial color="#f5e6cc" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** どう森ふうの まるくてかわいい 桜の木々。 */
function SakuraTrees() {
  const spots: [number, number, number, number][] = [
    [-4.8, 0, -2.2, 1.15],
    [-3.7, 0, -4.8, 1.0],
    [2.6, 0, -4.4, 1.1],
    [4.4, 0, -1.8, 0.95],
    [-6.5, 0, -5.8, 1.25],
    [5.8, 0, -5.4, 1.15],
  ];
  return (
    <group>
      {spots.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.16, 0.24, 1.7, 10]} />
            <meshStandardMaterial color="#9c7258" roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[1.05, 14, 12]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#ffc2dc" : "#ffd2e6"} roughness={0.9} />
          </mesh>
          <mesh position={[-0.65, 1.9, 0.25]}>
            <sphereGeometry args={[0.68, 12, 10]} />
            <meshStandardMaterial color="#ffb6d5" roughness={0.9} />
          </mesh>
          <mesh position={[0.65, 1.95, -0.15]}>
            <sphereGeometry args={[0.72, 12, 10]} />
            <meshStandardMaterial color="#ffd9ea" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 遠くに見える明るいパステルカラーの大阪の街並みシルエット。 */
function PastelSkyline() {
  const buildings: [number, number, number, number, string][] = [
    [-9.5, -13, 2.4, 5.2, "#ffe4ec"],
    [-6.6, -14, 2.8, 7.0, "#e2f2ff"],
    [-3.2, -15, 2.5, 5.8, "#fff4d9"],
    [0.5, -15.5, 3.0, 8.2, "#e4f5ea"],
    [4.2, -14.5, 2.6, 6.4, "#efe4fa"],
    [7.6, -13.5, 2.8, 5.5, "#ffe8d8"],
  ];
  return (
    <group>
      {buildings.map(([x, z, w, h, col], i) => (
        <mesh key={i} position={[x, h / 2 - 0.1, z]}>
          <boxGeometry args={[w, h, 2.0]} />
          <meshStandardMaterial color={col} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingClouds() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.9;
  });
  const clouds: [number, number, number, number][] = [
    [-5.5, 5.8, -11, 1.1],
    [0.4, 6.4, -13, 1.25],
    [5.8, 5.5, -10.5, 1.0],
  ];
  return (
    <group ref={ref}>
      {clouds.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.9, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.75, -0.15, 0]}>
            <sphereGeometry args={[0.62, 10, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.78, -0.12, 0]}>
            <sphereGeometry args={[0.68, 10, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const HUB_PETALS = Array.from({ length: 48 }, (_, i) => ({
  x: ((i * 1.93) % 11) - 5.5,
  y: ((i * 1.17) % 5) + 0.5,
  z: ((i * 1.61) % 7) - 4.2,
  speed: 0.35 + (i % 5) * 0.08,
  sway: (i % 7) * 0.4,
}));

function PlazaPetals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => HUB_PETALS.map((d) => ({ ...d })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    data.forEach((_, i) => {
      c.set(i % 2 === 0 ? "#ffb8d8" : "#ffe0ee");
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((state, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    data.forEach((p, i) => {
      p.y -= p.speed * dt;
      if (p.y < 0.05) p.y = 5.4;
      dummy.position.set(p.x + Math.sin(t * 1.2 + p.sway) * 0.35, p.y, p.z);
      dummy.rotation.set(t + p.sway, t * 0.8 + p.sway, 0.4);
      dummy.scale.set(0.085, 0.055, 0.02);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, data.length]}>
      <circleGeometry args={[1, 6]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}
