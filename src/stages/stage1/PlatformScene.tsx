import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { t } from "@/lib/t";
import { playSfx } from "@/lib/audio";
import { onFx, questEvents } from "@/stages/events";
import {
  HangingSign,
  LedBoard,
  PlatformSlab,
  StationNameBoard,
  TrainExterior,
} from "@/factory/station-parts";
import { Prop } from "@/factory/street-parts";
import { Interactable } from "@/three/Interactable";
import { Crowd } from "@/three/Crowd";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import { placePlayer, player } from "@/three/player";
import { useLayout } from "@/three/layout";

const PLACES = placesJson as PlacesFile;
const WIDTH = 8;
const LENGTH = 44;
const TRACK_X = WIDTH / 2 + 1.6;

/**
 * 島式のホーム（左右に線路）。看板と電光掲示板の中身は content/places.json。
 * 「trains-arrive」で両方の電車が入ってきてドアが開く。電車をクリックすると、その電車に乗る（台本が正解かどうかを決める）。
 * 「board」「board-wrong」で乗って、ドアが閉まって出ていく。
 */
export function PlatformScene({ placeId }: { placeId: string }) {
  const place = PLACES.platforms.find((p) => p.id === placeId)!;
  const arrival = placeId === "awaza";

  useSceneLayout({
    anchors: {
      stairs: { pos: [0, 0, 15], yaw: Math.PI },
      "train-door": { pos: [2.4, 0, 2], yaw: Math.PI },
    },
    walk: [
      {
        minX: -WIDTH / 2 + 0.5,
        maxX: WIDTH / 2 - 0.5,
        minZ: -LENGTH / 2 + 2,
        maxZ: LENGTH / 2 - 3,
      },
    ],
    shots: {
      "led-boards": { pos: [0, 1.9, 9.5], look: [0, 2.55, 4], fov: 42 },
      "station-name": { pos: [1.2, 1.7, -3], look: [TRACK_X + 1.85, 1.5, -6], fov: 50 },
    },
    triggers: [],
    camera: { mode: "follow", distance: 4.6, height: 2.5 },
    bounds: { minX: -3.7, maxX: 3.7, minZ: -21.5, maxZ: 21.5, maxY: 3.3 },
    showPlayer: true,
  });

  const [trainsIn, setTrainsIn] = useState(arrival);
  const [boarded, setBoarded] = useState<"left" | "right" | null>(null);
  const lastClicked = useRef<"left" | "right">("right");

  // どちらの電車をクリックしたか（台本より先に、合図そのものを見る）
  useEffect(
    () =>
      questEvents.on((name) => {
        const m = /^click:train-(\d)$/.exec(name);
        const tr = m ? place.tracks.find((x) => x.track === Number(m[1])) : undefined;
        if (tr) lastClicked.current = tr.side;
      }),
    [place],
  );

  useEffect(
    () =>
      onFx((id) => {
        if (id === "trains-arrive") {
          window.setTimeout(() => playSfx("chime"), 300);
          setTrainsIn(true);
        }
        if (id === "board" || id === "board-wrong") {
          const side = lastClicked.current;
          const x = side === "left" ? -TRACK_X : TRACK_X;
          placePlayer(x, player.pos.z, side === "left" ? -Math.PI / 2 : Math.PI / 2);
          useLayout.setState({ showPlayer: false });
          window.setTimeout(() => setBoarded(side), 600);
        }
      }),
    [],
  );

  const [led1, led2] = [
    place.tracks.find((tr) => tr.side === "left"),
    place.tracks.find((tr) => tr.side === "right"),
  ];

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#cfd6df"]} />
      <PlatformSlab
        width={WIDTH}
        length={LENGTH}
        tracks={arrival ? ["right"] : ["left", "right"]}
      />
      <WalkSurface size={[WIDTH, LENGTH]} />
      {place.tracks.map((tr) => {
        const sx = tr.side === "left" ? -1 : 1;
        return (
          <group key={tr.side}>
            <HangingSign
              position={[sx * 2.1, 2.85, 6]}
              width={3.8}
              height={0.5}
              spec={{
                lines: [place.line],
                text: `${tr.track}${t("sign.track")} ${tr.direction}`,
                en: `Track ${tr.track} ${tr.en}`,
                arrow: tr.side === "left" ? "left" : "right",
                tone: "navy",
              }}
            />
            <StationNameBoard
              position={[sx * (TRACK_X + 1.85), 1.6, -6]}
              rotationY={(-sx * Math.PI) / 2}
              station={place.station}
              line={place.line}
              prev={sx < 0 ? place.next : place.prev}
              next={sx < 0 ? place.prev : place.next}
            />
            <Train
              side={tr.side}
              lineId={place.line}
              trainsIn={trainsIn}
              departing={boarded === tr.side || (boarded !== null && !arrival)}
              id={`train-${tr.track}`}
            />
          </group>
        );
      })}
      {led1 && (
        <LedBoard
          position={[-1.25, 2.55, 4]}
          title={`${led1.track}${t("sign.track")}`}
          rows={led1.led.map((r) => ({ ...r, track: String(led1.track) }))}
        />
      )}
      {led2 && (
        <LedBoard
          position={[led1 ? 1.25 : 0, 2.55, 4]}
          title={`${led2.track}${t("sign.track")}`}
          rows={led2.led.map((r) => ({ ...r, track: String(led2.track) }))}
        />
      )}
      <Prop url="station/bench" position={[-1.6, 0, -10]} rotationY={Math.PI / 2} />
      <Prop url="station/bench" position={[1.6, 0, -16]} rotationY={-Math.PI / 2} />
      <Prop url="station/clock" position={[0, 0, -4]} />
      {!arrival && (
        <Crowd
          people={[
            { pos: [-2.4, 0, -2], yaw: -Math.PI / 2 },
            { pos: [-2.4, 0, -8], yaw: -Math.PI / 2 },
            { pos: [2.4, 0, -5], yaw: Math.PI / 2 },
            { pos: [2.4, 0, -11], yaw: Math.PI / 2, model: "hoodie" },
            { pos: [2.4, 0, 2.5], yaw: Math.PI / 2, model: "school" },
          ]}
        />
      )}
      <Ready />
    </>
  );
}

function Train({
  side,
  lineId,
  trainsIn,
  departing,
  id,
}: {
  side: "left" | "right";
  lineId: string;
  trainsIn: boolean;
  departing: boolean;
  id: string;
}) {
  const group = useRef<THREE.Group>(null);
  const sx = side === "left" ? -1 : 1;
  const z = useRef(trainsIn ? 0 : -90);
  const doors = useRef(trainsIn ? 1 : 0);
  const [doorsOpen, setDoorsOpen] = useState(trainsIn ? 1 : 0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;
    if (departing) {
      doors.current = Math.max(0, doors.current - dt * 1.5);
      if (doors.current === 0) z.current += dt * Math.min(18, (z.current + 1) * 2.5);
    } else if (trainsIn) {
      z.current += (0 - z.current) * Math.min(1, dt * 0.9);
      if (Math.abs(z.current) < 0.3) doors.current = Math.min(1, doors.current + dt * 1.5);
    }
    g.position.set(sx * TRACK_X, -1.1, z.current);
    if (Math.abs(doors.current - doorsOpen) > 0.04) setDoorsOpen(doors.current);
  });

  const ready = trainsIn && !departing;
  return (
    <group ref={group}>
      <TrainExterior lineId={lineId} cars={3} doorsOpen={doorsOpen} />
      {ready && (
        <Interactable id={id} approach={[sx * 2.9, 2]} marker={[-sx * 1.2, 3.4, 2]}>
          <mesh position={[-sx * 1.3, 2.1, 2]}>
            <boxGeometry args={[0.4, 2.2, 18]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Interactable>
      )}
    </group>
  );
}
