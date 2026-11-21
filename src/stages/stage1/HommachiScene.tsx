import { useMemo } from "react";
import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { box, FLAT, merge, stairs } from "@/factory/kit";
import {
  HangingSign,
  PlatformSlab,
  StationNameBoard,
  TrainExterior,
} from "@/factory/station-parts";
import { LINE } from "@/factory/signs";
import { Prop } from "@/factory/props";
import { Interactable } from "@/three/Interactable";
import { Crowd, Walkers } from "@/three/Crowd";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";

const PLACES = placesJson as PlacesFile;

/**
 * 本町（御堂筋線のホーム）。中央線へののりかえ口・四つ橋線へののりかえ口・出口の3つから、看板を見て選ぶ
 * （ここは矢印もヒントも少なめの「本番」。Fable 5.2 のレビュー）。
 */
export function HommachiScene() {
  useSceneLayout({
    anchors: { "train-door": { pos: [2.4, 0, 4], yaw: Math.PI } },
    walk: [{ minX: -3.5, maxX: 3.5, minZ: -19, maxZ: 19 }],
    shots: {},
    triggers: [],
    camera: { mode: "follow", distance: 4.6, height: 2.6 },
    bounds: { minX: -3.7, maxX: 3.7, minZ: -21.5, maxZ: 21.5, maxY: 3.3 },
    showPlayer: true,
  });

  const [signC, signY, exit] = ["stairs-C", "stairs-Y", "exit"].map((id) =>
    PLACES.transfer.find((s) => s.id === id)!,
  );
  const geo = useMemo(
    () =>
      merge([
        stairs(10, 2.4, 0.24, 0.32, "#c9cdd3", { pos: [-2.2, 0, -16.5] }),
        stairs(10, 2.4, 0.24, 0.32, "#c9cdd3", { pos: [2.2, 0, -16.5] }),
        stairs(10, 2.6, 0.24, 0.32, "#c9cdd3", { pos: [0, 0, 17.0], rot: [0, Math.PI, 0] }),
        box(0.2, 3.4, 4, "#e3e6ea", { pos: [0, 1.7, -18.5] }),
      ]),
    [],
  );

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#cfd6df"]} />
      <PlatformSlab
        width={8}
        length={44}
        tracks={["right"]}
        lineColor={LINE.M?.color}
        pillars={[-8, 0, 8].flatMap((z) => [
          [-2.55, z] as [number, number],
          [2.55, z] as [number, number],
        ])}
      />
      <Prop url="station/bench" position={[-1.4, 0, 4]} rotationY={Math.PI / 2} />
      <Prop url="station/extinguisher" position={[2.55, 0, 0.4]} />
      <Prop url="station/lockers" position={[-3.65, 0, 11]} rotationY={Math.PI / 2} />
      <Prop url="station/lockers" position={[-3.65, 0, 12]} rotationY={Math.PI / 2} />
      <mesh geometry={geo} material={FLAT} />
      <WalkSurface size={[8, 44]} />
      <group position={[5.6, -1.1, 0]}>
        <TrainExterior lineId="M" cars={3} doorsOpen={0} />
      </group>
      <StationNameBoard
        position={[-3.8, 1.6, -3]}
        rotationY={Math.PI / 2}
        station="hommachi"
        line="M"
        prev="shinsaibashi"
        next="yodoyabashi"
      />

      {signC && (
        <Interactable id="stairs-C" approach={[-2.2, -14.6]} marker={[-2.2, 1.8, -16]}>
          <HangingSign
            position={[-2.2, 2.9, -13]}
            width={3.6}
            spec={{
              lines: signC.lines,
              text: signC.text,
              en: signC.en,
              arrow: signC.arrow,
              tone: signC.tone,
            }}
          />
          <mesh position={[-2.2, 1.2, -16.5]}>
            <boxGeometry args={[2.4, 2.4, 3.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Interactable>
      )}
      {signY && (
        <Interactable id="stairs-Y" approach={[2.2, -14.6]} marker={[2.2, 1.8, -16]}>
          <HangingSign
            position={[2.2, 2.9, -13]}
            width={3.6}
            spec={{
              lines: signY.lines,
              text: signY.text,
              en: signY.en,
              arrow: signY.arrow,
              tone: signY.tone,
            }}
          />
          <mesh position={[2.2, 1.2, -16.5]}>
            <boxGeometry args={[2.4, 2.4, 3.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Interactable>
      )}
      {exit && (
        <Interactable id="exit" approach={[0, 14.6]} marker={[0, 1.8, 16]}>
          <HangingSign
            position={[0, 2.9, 13]}
            rotationY={Math.PI}
            width={3}
            spec={{
              lines: exit.lines,
              text: exit.text,
              en: exit.en,
              arrow: exit.arrow,
              tone: exit.tone,
              number: exit.number,
            }}
          />
          <mesh position={[0, 1.2, 16.5]}>
            <boxGeometry args={[2.6, 2.4, 3.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Interactable>
      )}
      <Crowd
        people={[
          { pos: [-1.5, 0, -6], yaw: Math.PI },
          { pos: [1.2, 0, -9], yaw: Math.PI, casual: true },
          { pos: [-0.6, 0, 6], yaw: 0 },
          { pos: [2.6, 0, 9.4], yaw: -Math.PI / 2, casual: true },
          { pos: [2.2, 0, -4], yaw: Math.PI / 2 },
        ]}
      />
      <Walkers
        people={[
          { from: [0.6, -14], to: [0.6, 14], speed: 1.0, at: 0.6 },
          {
            from: [-1.0, 12],
            to: [-1.0, -12],
            speed: 0.85,
            at: 0.2,
            look: { hairStyle: "side", suit: "#4b505a", height: 176, eyes: "calm" },
          },
        ]}
      />
      <Ready />
    </>
  );
}
