import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { useSearch } from "wouter";
import { ShotStage } from "@/app/shots";
import * as THREE from "three";
import { DEFAULT_AVATAR } from "@/lib/store";
import {
  GateRow,
  LedBoard,
  RouteMapBoard,
  StationNameBoard,
  TicketMachineGray,
  TrainExterior,
} from "@/factory/station-parts";
import { CarSignal, PedSignal, PushButtonBox } from "@/factory/street-parts";
import { TicketMachine } from "@/factory/TicketMachine";
import { Chibi } from "@/three/Chibi";
import { Lights } from "@/three/helpers";

/**
 * グラフィック工場の見本の部屋（/factory）。工場で作った部品と polyfork の人を並べて、見た目と大きさをそろえる。
 * 豆知識の絵を撮るときもここを使う（scripts/shots.mjs）。学生は使わない画面。
 */
export default function FactoryScreen() {
  const shot = new URLSearchParams(useSearch()).get("shot");
  if (shot) {
    return (
      <main className="h-full w-full" style={{ background: "transparent" }}>
        <Canvas
          dpr={2}
          gl={{
            toneMapping: THREE.NoToneMapping,
            preserveDrawingBuffer: true,
            alpha: true,
            antialias: true,
          }}
          camera={{ position: [0, 1, 3], fov: 40 }}
          data-testid="shot"
        >
          <ShotStage id={shot} />
        </Canvas>
      </main>
    );
  }
  return (
    <main className="bg-deep h-full w-full">
      <Canvas
        camera={{ position: [0, 4, 12], fov: 50 }}
        gl={{ toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#dfe7f1"]} />
        <Lights preset="underground" />
        <Suspense fallback={null}>
          <group position={[-8, 0, 0]}>
            <Chibi config={{ ...DEFAULT_AVATAR, outfit: "suit" }} />
          </group>
          <group position={[-6.8, 0, 0]}>
            <Chibi config={{ ...DEFAULT_AVATAR, outfit: "suit", figure: "f", hair: "#3a2618" }} />
          </group>
          <group position={[-5.6, 0, 0]}>
            <Chibi config={DEFAULT_AVATAR} />
          </group>
          <TicketMachineGray position={[-4, 0, 0]} />
          <TicketMachine position={[-3, 0, 0]} active />
          <GateRow position={[0, 0, 0]} count={3} />
          <CarSignal position={[6, 0, 0]} light="red-arrow" />
          <PedSignal position={[7, 0, 0]} light="green" blinkOn />
          <PushButtonBox position={[7.4, 1.1, 0.2]} waiting={false} />
          <LedBoard
            position={[0, 3, -2]}
            title="2"
            rows={[{ kind: "1", time: "8:13", dest: "Senri", track: "2" }]}
          />
          <RouteMapBoard position={[-6, 3, -3]} here="tennoji" />
          <StationNameBoard
            position={[5, 3, -3]}
            station="awaza"
            line="C"
            prev="kujo"
            next="hommachi"
          />
          <group position={[0, 0, -12]} rotation={[0, Math.PI / 2, 0]}>
            <TrainExterior lineId="M" cars={1} />
          </group>
        </Suspense>
        <OrbitControls target={[0, 1.2, 0]} />
      </Canvas>
    </main>
  );
}
