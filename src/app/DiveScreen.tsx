import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";
import { playSfx } from "@/lib/audio";

const DURATION = 2.8;

/**
 * ダイブの演出（企画メモ「スタートを押すとダイブスタートのようなエフェクト」）。
 * タイトル画像の渦と同じ色（シアン・青・むらさき・白）の光の筋が手前に流れ、最後に白く光ってステージ選択へ。
 * 飛ばせる。動きを減らす設定のときは、すぐ次へ進む。
 */
export default function DiveScreen() {
  const [, navigate] = useLocation();
  const [flash, setFlash] = useState(false);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (reduced) {
      navigate("/stages");
      return;
    }
    playSfx("dive");
    const a = window.setTimeout(() => setFlash(true), (DURATION - 0.45) * 1000);
    const b = window.setTimeout(() => navigate("/stages"), DURATION * 1000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [navigate, reduced]);

  return (
    <main className="relative h-full w-full bg-black">
      <Canvas camera={{ position: [0, 0, 0], fov: 75, near: 0.1, far: 200 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#020818"]} />
        <fog attach="fog" args={["#020818", 30, 110]} />
        <Tunnel />
        <Portal />
      </Canvas>
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${flash ? "opacity-100" : "opacity-0"}`}
      />
      <button
        type="button"
        className="btn btn-ghost absolute right-4 bottom-4"
        onClick={() => navigate("/stages")}
      >
        <RubyText text={t("dive.skip")} />
      </button>
    </main>
  );
}

const COLORS = ["#38e1ff", "#1f8fff", "#8f7bff", "#ffffff", "#ffb7d5"];

/** 決まった種から作る乱数（毎回同じ光の筋になる。描画のたびに変わらない）。 */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(20261121);
const STREAKS = Array.from({ length: 900 }, () => ({
  angle: rand() * Math.PI * 2,
  radius: 2.2 + rand() * 5,
  z: -rand() * 120,
  len: 0.6 + rand() * 2.4,
  spin: (rand() - 0.5) * 0.6,
}));

function Tunnel() {
  const count = STREAKS.length;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => STREAKS.map((d) => ({ ...d })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    data.forEach((_, i) => {
      c.set(COLORS[i % COLORS.length] ?? "#38e1ff");
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= state.clock.elapsedTime;
    const tt = state.clock.elapsedTime - start.current;
    const speed = 20 + Math.pow(tt, 2.2) * 26;
    data.forEach((d, i) => {
      d.z += speed * delta;
      d.angle += d.spin * delta;
      if (d.z > 2) d.z -= 120;
      dummy.position.set(Math.cos(d.angle) * d.radius, Math.sin(d.angle) * d.radius, d.z);
      dummy.scale.set(0.03, 0.03, d.len * (1 + tt * 1.2));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    state.camera.rotation.z = tt * 0.35;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Portal() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const r = ring.current;
    if (!r) return;
    const tt = state.clock.elapsedTime;
    r.position.z = -60 + Math.min(58, tt * tt * 7.5);
    r.rotation.z = tt * 0.8;
  });
  return (
    <mesh ref={ring} position={[0, 0, -60]}>
      <torusGeometry args={[3.2, 0.08, 12, 96]} />
      <meshBasicMaterial color="#9ff3ff" toneMapped={false} />
    </mesh>
  );
}
