import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { onFx } from "@/stages/events";
import { box, merge } from "@/factory/kit";
import { DoorScreen, TrainInterior } from "@/factory/station-parts";
import { Interactable } from "@/three/Interactable";
import { Crowd, type NpcSpec } from "@/three/Crowd";
import { Lights, Ready, useSceneLayout } from "@/three/helpers";

const PLACES = placesJson as PlacesFile;

/**
 * 電車の中。カメラは自分の目の高さ（立っている）。混んでいるときは、まわりに人が立つ。
 * fx: ride（ドアの上の画面が、つぎの駅へ進む）・stare（みんながこちらを見る）・stare-end。
 */
export function TrainScene({ line, crowded }: { line: "midosuji" | "chuo"; crowded: boolean }) {
  const lineId = line === "midosuji" ? "M" : "C";
  const stops = PLACES.trainNext[line] ?? [];
  const [stop, setStop] = useState(0);
  const [stare, setStare] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);

  useSceneLayout({
    anchors: { inside: { pos: [0, 0, 3.2], yaw: Math.PI } },
    walk: [{ minX: -0.6, maxX: 0.6, minZ: 2.8, maxZ: 3.6 }],
    shots: {},
    triggers: [],
    camera: { mode: "fixed", shot: { pos: [0.15, 1.32, 3.4], look: [0, 1.05, -6], fov: 62 } },
    showPlayer: false,
  });

  useEffect(
    () =>
      onFx((id) => {
        if (id === "stare") setStare(true);
        if (id === "stare-end") setStare(false);
        if (id === "ride") {
          let i = 0;
          const tick = () => {
            i += 1;
            if (i < stops.length) {
              setStop(i);
              window.setTimeout(tick, 1100);
            } else {
              window.setTimeout(() => setDoorOpen(true), 400);
            }
          };
          window.setTimeout(tick, 900);
          if (stops.length <= 1) window.setTimeout(() => setDoorOpen(true), 1800);
        }
      }),
    [stops.length],
  );

  const people = useMemo<NpcSpec[]>(() => {
    if (!crowded) {
      return [
        { pos: [-1.05, 0, -2.8], yaw: Math.PI / 2, motion: "sitting" },
        { pos: [1.05, 0, -6.2], yaw: -Math.PI / 2, motion: "sitting" },
        { pos: [0.3, 0, -4], yaw: 0.3 },
      ];
    }
    const list: NpcSpec[] = [];
    const spots: [number, number, number][] = [
      [-0.45, 0, 1.9],
      [0.5, 0, 1.6],
      [-0.1, 0, 0.6],
      [0.55, 0, 0.2],
      [-0.6, 0, -0.4],
      [0.1, 0, -1.2],
      [0.6, 0, -2.1],
      [-0.5, 0, -2.6],
      [0.0, 0, -3.6],
      [0.55, 0, -4.4],
      [-0.55, 0, -5.2],
      [0.2, 0, -6.2],
      [0.9, 0, 2.6],
      [-0.9, 0, 2.4],
    ];
    spots.forEach((p, i) =>
      list.push({ pos: p, yaw: (i % 2 ? 1 : -1) * 0.4 + (i % 3 === 0 ? Math.PI : 0) }),
    );
    return list;
  }, [crowded]);

  return (
    <>
      <Lights preset="train" />
      <color attach="background" args={["#101418"]} />
      <Sway>
        <TrainInterior lineId={lineId} next={stops[stop] ?? ""} />
        <DoorScreen
          position={[1.0, 2.12, 4.2]}
          rotationY={Math.PI}
          next={stops[stop] ?? ""}
          lineId={lineId}
        />
        <Crowd people={people} stare={stare} />
        <TunnelLights />
        <Interactable id="door" marker={[1.2, 2.0, 1.2]}>
          <Door open={doorOpen} />
        </Interactable>
      </Sway>
      <Ready />
    </>
  );
}

/** 電車のゆれ。 */
function Sway({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const tt = s.clock.elapsedTime;
    g.rotation.z = Math.sin(tt * 1.3) * 0.006;
    g.position.x = Math.sin(tt * 0.9) * 0.01;
  });
  return <group ref={ref}>{children}</group>;
}

/** 窓の外を流れるトンネルのあかり。 */
function TunnelLights() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 24;
  const geo = useMemo(() => new THREE.BoxGeometry(0.05, 0.25, 0.8), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const tt = s.clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 ? 1 : -1;
      const z = ((i * 3 + tt * 22) % 40) - 20;
      dummy.position.set(side * 2.2, 1.6, -z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} raycast={() => null} />;
}

/** 降りるドア（右がわ）。開くと、外が明るく見える。 */
function Door({ open }: { open: boolean }) {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const geo = useMemo(
    () =>
      merge([
        box(0.05, 1.95, 0.62, "#b5bcc6"),
        box(0.06, 0.8, 0.4, "#33404f", { pos: [0, 0.35, 0] }),
      ]),
    [],
  );
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    if (left.current)
      left.current.position.z += ((open ? 0.55 : 0.88) - left.current.position.z) * k;
    if (right.current)
      right.current.position.z += ((open ? 2.05 : 1.52) - right.current.position.z) * k;
  });
  return (
    <group position={[1.32, 0.98, 0]}>
      <mesh ref={left} geometry={geo} position={[0, 0, 0.88]}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
      <mesh ref={right} geometry={geo} position={[0, 0, 1.52]}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
      <mesh position={[0.08, 0, 1.2]}>
        <planeGeometry args={[1.2, 1.95]} />
        <meshBasicMaterial
          color={open ? "#e8eef5" : "#1a222c"}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
