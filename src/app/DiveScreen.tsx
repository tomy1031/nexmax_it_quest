import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import { playSfx } from "@/lib/audio";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

const DURATION = 3.5;

type DivePhase = "visor" | "warp" | "arrive";

/**
 * ダイブの演出（tomy さん 2026-11-24「VR空間に移動するアニメーションやVR機器を被る演出など」）。
 * 1) 明るい春空の VR ゴーグル（バイザー）が画面の上から降りて装着・起動する
 * 2) タイトル画像の光の輪と同じ、水色・ミント・桜色のポータルを駆け抜ける（桜の花びら・葉っぱも舞う）
 * 3) あたたかい光につつまれて、バーチャル大阪プラザ（ステージ選択）へ到着する
 * 飛ばせる。動きを減らす設定のときは、すぐ次へ進む。
 */
export default function DiveScreen() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<DivePhase>("visor");
  const [flash, setFlash] = useState(false);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (reduced) {
      navigate("/stages");
      return;
    }
    playSfx("dive");
    const tWarp = window.setTimeout(() => setPhase("warp"), 1150);
    const tArrive = window.setTimeout(() => setPhase("arrive"), 2750);
    const tFlash = window.setTimeout(() => setFlash(true), (DURATION - 0.45) * 1000);
    const tDone = window.setTimeout(() => navigate("/stages"), DURATION * 1000);
    return () => {
      window.clearTimeout(tWarp);
      window.clearTimeout(tArrive);
      window.clearTimeout(tFlash);
      window.clearTimeout(tDone);
    };
  }, [navigate, reduced]);

  const statusKey =
    phase === "visor" ? "dive.visor" : phase === "warp" ? "dive.link" : "dive.arrive";

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#1572c6]" data-testid="dive-screen">
      <Canvas camera={{ position: [0, 0, 0], fov: 68, near: 0.1, far: 180 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#187cd0"]} />
        <fog attach="fog" args={["#1c8be0", 24, 105]} />
        <ambientLight intensity={1.1} color="#ffffff" />
        <LightTunnel />
        <PortalRings />
        <FloatingPetals />
      </Canvas>

      {/* 1) VR ゴーグル装着フレーム（上からすっと降りて装着し、ワープ開始で画面外へ広がる） */}
      <div className="dive-visor pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 1280 720"
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="visorShell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fdf8eb" />
              <stop offset="55%" stopColor="#efe4cc" />
              <stop offset="100%" stopColor="#d8c6a5" />
            </linearGradient>
            <linearGradient id="visorRim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6be6ff" />
              <stop offset="50%" stopColor="#8ef2b8" />
              <stop offset="100%" stopColor="#6be6ff" />
            </linearGradient>
            {/* ゴーグルのレンズ窓（中央のまあるい双眼鏡シルエットを切り抜く） */}
            <mask id="visorLensMask">
              <rect width="1280" height="720" fill="white" />
              <path
                d="M175 110 H1105 C1168 110 1212 156 1212 220 V495 C1212 560 1164 606 1098 606 H760 C724 606 702 582 686 556 C672 534 656 524 640 524 C624 524 608 534 594 556 C578 582 556 606 520 606 H182 C116 606 68 560 68 495 V220 C68 156 112 110 175 110 Z"
                fill="black"
              />
            </mask>
          </defs>
          {/* 外枠のやさしいクリームホワイト VR ヘッドセット本体 */}
          <rect width="1280" height="720" fill="url(#visorShell)" mask="url(#visorLensMask)" />
          {/* レンズの内側の発光ミントシアンリム */}
          <path
            d="M175 110 H1105 C1168 110 1212 156 1212 220 V495 C1212 560 1164 606 1098 606 H760 C724 606 702 582 686 556 C672 534 656 524 640 524 C624 524 608 534 594 556 C578 582 556 606 520 606 H182 C116 606 68 560 68 495 V220 C68 156 112 110 175 110 Z"
            fill="none"
            stroke="url(#visorRim)"
            strokeWidth="11"
          />
          {/* 起動ランプ */}
          <circle cx="1142" cy="64" r="10" fill="#4ce39c" />
          <circle
            cx="1142"
            cy="64"
            r="16"
            fill="none"
            stroke="#4ce39c"
            strokeWidth="3"
            opacity="0.55"
          />
        </svg>

        {/* レンズ中央の VR リンク照準リング */}
        <div className="absolute flex flex-col items-center justify-center">
          <svg viewBox="0 0 220 220" className="spin-slow h-44 w-44 opacity-90" aria-hidden>
            <circle
              cx="110"
              cy="110"
              r="96"
              fill="none"
              stroke="#b6f6ff"
              strokeWidth="3.5"
              strokeDasharray="24 14 8 14"
            />
            <circle
              cx="110"
              cy="110"
              r="76"
              fill="none"
              stroke="#fff4a8"
              strokeWidth="2.5"
              strokeDasharray="44 26"
            />
          </svg>
          <span className="absolute rounded-full bg-[#135c9c]/90 px-4 py-1 text-sm font-extrabold tracking-widest text-white shadow">
            VR LINK
          </span>
        </div>
      </div>

      {/* 上部ステータス表示（濃い空色の地に白い文字＋白いふりがな） */}
      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
        <div
          className="flex items-center gap-3 rounded-full border-2 border-[#c4f4ff] bg-[#135c9c]/92 px-6 py-2.5 text-lg font-extrabold text-white shadow-[0_6px_20px_rgba(12,64,120,0.35)]"
          data-testid="dive-status"
        >
          <span className="inline-block h-3 w-3 rounded-full bg-[#7ef7b8] shadow-[0_0_8px_#7ef7b8]" />
          <RubyText text={t(statusKey)} />
        </div>
      </div>

      {/* 到着時のあたたかいパステルホワイトのフラッシュ */}
      <div
        className={`pointer-events-none absolute inset-0 bg-[#f6fcff] transition-opacity duration-300 ${flash ? "opacity-100" : "opacity-0"}`}
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

const STREAK_COLORS = ["#8ff4ff", "#ffffff", "#a8f7c6", "#fff2a6", "#ffc4df", "#5ed2ff"];

/** 決まった種から作る乱数（毎回同じ光の筋になる）。 */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261124);
const STREAKS = Array.from({ length: 650 }, () => ({
  angle: rand() * Math.PI * 2,
  radius: 2.3 + rand() * 5.2,
  z: -rand() * 115,
  len: 0.7 + rand() * 2.4,
  spin: (rand() - 0.5) * 0.55,
}));

const PETALS = Array.from({ length: 120 }, (_, i) => ({
  angle: rand() * Math.PI * 2,
  radius: 1.4 + rand() * 4.4,
  z: -rand() * 90,
  spin: (rand() - 0.5) * 1.4,
  rx: rand() * Math.PI,
  ry: rand() * Math.PI,
  leaf: i % 3 === 0,
}));

function LightTunnel() {
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
      c.set(STREAK_COLORS[i % STREAK_COLORS.length] ?? "#8ff4ff");
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((state, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const delta = Math.min(rawDelta, 0.05);
    start.current ??= state.clock.elapsedTime;
    const tt = state.clock.elapsedTime - start.current;
    // ゴーグル装着中（〜1s）はゆったり、その後一気にワープ加速
    const warp = Math.max(0, tt - 0.85);
    const speed = 12 + Math.pow(warp, 2.0) * 30;
    data.forEach((d, i) => {
      d.z += speed * delta;
      d.angle += d.spin * delta;
      if (d.z > 2) d.z -= 115;
      dummy.position.set(Math.cos(d.angle) * d.radius, Math.sin(d.angle) * d.radius, d.z);
      dummy.rotation.set(0, 0, d.angle);
      dummy.scale.set(0.036, 0.036, d.len * (0.9 + warp * 1.35));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    state.camera.rotation.z = Math.sin(tt * 0.7) * 0.08 + warp * 0.24;
    if (state.camera instanceof THREE.PerspectiveCamera) {
      const targetFov = 68 + Math.min(34, warp * 18);
      if (Math.abs(state.camera.fov - targetFov) > 0.1) {
        state.camera.fov = targetFov;
        state.camera.updateProjectionMatrix();
      }
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const RING_COLORS = ["#9ef7ff", "#b8f7a6", "#ffffff", "#ffd0e6", "#fff2a8", "#7be8ff", "#ffffff"];

function PortalRings() {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);

  useFrame((state, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDelta, 0.05);
    start.current ??= state.clock.elapsedTime;
    const tt = state.clock.elapsedTime - start.current;
    const warp = Math.max(0, tt - 0.85);
    const speed = 9 + warp * 24;
    g.children.forEach((child, i) => {
      child.position.z += speed * dt;
      child.rotation.z += (i % 2 === 0 ? 0.5 : -0.5) * dt;
      if (child.position.z > 4) child.position.z -= 84;
    });
  });

  return (
    <group ref={group}>
      {RING_COLORS.map((color, i) => (
        <mesh key={i} position={[0, 0, -10 - i * 12]}>
          <torusGeometry args={[3.4 + (i % 2) * 0.45, 0.09, 12, 72]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingPetals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => PETALS.map((d) => ({ ...d })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    data.forEach((d, i) => {
      c.set(d.leaf ? "#b7f07a" : i % 2 === 0 ? "#ffc2df" : "#ffe0ef");
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((state, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDelta, 0.05);
    start.current ??= state.clock.elapsedTime;
    const tt = state.clock.elapsedTime - start.current;
    const warp = Math.max(0, tt - 0.85);
    const speed = 7 + warp * 22;
    data.forEach((d, i) => {
      d.z += speed * dt;
      d.angle += d.spin * 0.4 * dt;
      d.rx += 2.2 * dt;
      d.ry += 1.6 * dt;
      if (d.z > 2) d.z -= 90;
      dummy.position.set(Math.cos(d.angle) * d.radius, Math.sin(d.angle) * d.radius, d.z);
      dummy.rotation.set(d.rx, d.ry, d.angle);
      dummy.scale.set(d.leaf ? 0.16 : 0.13, d.leaf ? 0.09 : 0.11, 0.02);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PETALS.length]}>
      <circleGeometry args={[1, 6]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}
