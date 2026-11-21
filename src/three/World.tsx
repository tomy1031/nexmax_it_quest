import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { useSettings } from "@/lib/store";
import { usePlay } from "@/stages/play-store";
import { Stage1Scene } from "@/stages/stage1/scenes";
import { CameraRig } from "@/three/CameraRig";
import { ClickRing, Companion, ObjectiveMarker } from "@/three/helpers";
import { Player } from "@/three/Player";

/**
 * 3D の画面（1つの Canvas を使い回し、場面だけを入れかえる）。
 * 光の色調補正はかけない（polyfork の色は補正なしで作られている。補正をかけると暗くにごる）。
 * 「かるい」設定では解像度を下げる。
 */
export function World() {
  const scene = usePlay((s) => s.scene);
  const sceneKey = usePlay((s) => s.sceneKey);
  const quality = useSettings((s) => s.quality);

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={quality === "low" ? [0.75, 1] : [1, 1.5]}
      gl={{
        antialias: quality !== "low",
        toneMapping: THREE.NoToneMapping,
        preserveDrawingBuffer: true,
      }}
      camera={{ fov: 55, near: 0.05, far: 300, position: [0, 2, 5] }}
      data-testid="world"
    >
      <Suspense fallback={null}>
        {scene && <Stage1Scene key={sceneKey} id={scene} />}
        <Player />
        <Companion />
      </Suspense>
      <ObjectiveMarker />
      <ClickRing />
      <CameraRig />
    </Canvas>
  );
}
