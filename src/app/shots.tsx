import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useRef } from "react";
import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { DEFAULT_AVATAR } from "@/lib/store";
import { t } from "@/lib/t";
import {
  GateRow,
  HangingSign,
  LedBoard,
  StationNameBoard,
  TrainInterior,
} from "@/factory/station-parts";
import { CarSignal, PedSignal, Prop, PushButtonBox } from "@/factory/street-parts";
import { IcocaCard, Phone, Receipt } from "@/factory/small-parts";
import { Noren, VSign } from "@/factory/town-parts";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { Chibi } from "@/three/Chibi";
import { NexmaxModel } from "@/three/Nexmax";
import { Crowd } from "@/three/Crowd";
import { Lights } from "@/three/helpers";
import charactersJson from "@content/characters.json";
import type { AvatarConfig, HairStyle } from "@/lib/store";

const PLACES = placesJson as PlacesFile;
const north = PLACES.platforms[0]!.tracks[1]!;

/**
 * 豆知識の絵の撮影台（/factory?shot=<豆知識の id>）。グラフィック工場の部品を決まった角度で撮る。
 * scripts/shots.mjs がこのページを開き、背景を透明にして public/img/tips/<id>.webp に保存する。
 * 絵に重要な文は焼かない（カードの文はデータのまま。academy 01ガイドのやってはいけない例10）。
 */
export interface ShotDef {
  camera: { pos: [number, number, number]; look: [number, number, number]; fov: number };
  light: "day" | "room" | "underground" | "train";
  scene: () => React.ReactNode;
}

export const SHOTS: Record<string, ShotDef> = {
  nmchat: {
    camera: { pos: [0.35, 0.38, 0.55], look: [0, 0.14, 0], fov: 40 },
    light: "room",
    scene: () => (
      <>
        <Prop url="home/laptop" position={[0, 0, 0]} />
        <CanvasPanel
          width={0.28}
          height={0.17}
          ppm={1600}
          position={[0, 0.14, -0.08]}
          rotation={[-0.25, 0, 0]}
          emissive
          fontText={t("chat.title")}
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#1b2a5c";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(w * 0.32, h * 0.1, w * 0.62, h * 0.8);
            ctx.fillStyle = "#38e1ff";
            ctx.font = `800 ${h * 0.14}px sans-serif`;
            ctx.fillText("NMChat", w * 0.04, h * 0.2);
            ["#ffd23f", "#9fb4ff", "#9fb4ff"].forEach((c, i) => {
              ctx.fillStyle = c;
              ctx.fillRect(w * 0.04, h * (0.36 + i * 0.16), w * 0.24, h * 0.08);
            });
            ctx.fillStyle = "#c9d3e6";
            for (let i = 0; i < 5; i += 1)
              ctx.fillRect(w * 0.36, h * (0.2 + i * 0.13), w * (0.4 + (i % 2) * 0.12), h * 0.05);
          }}
        />
        <Phone position={[0.22, 0.01, 0.12]} rotation={[-Math.PI / 2, 0, 0.4]} />
      </>
    ),
  },
  suit: {
    camera: { pos: [0, 1.15, 3.3], look: [0, 0.95, 0], fov: 38 },
    light: "room",
    scene: () => (
      <>
        <group position={[-0.45, 0, 0]} rotation={[0, 0.25, 0]}>
          <Chibi config={{ ...DEFAULT_AVATAR, outfit: "suit", suit: "#232f52", tie: "#8a1c2b" }} />
        </group>
        <group position={[0.45, 0, 0]} rotation={[0, -0.25, 0]}>
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "suit",
              figure: "f",
              suit: "#1c1e24",
              hair: "#3a2618",
              skin: "#e0ac83",
              hairStyle: "long",
            }}
          />
        </group>
      </>
    ),
  },
  aoshingou: {
    camera: { pos: [-0.2, 2.9, 2.0], look: [0, 2.85, 0], fov: 32 },
    light: "day",
    scene: () => <PedSignal position={[0, 0, 0]} light="green" blinkOn />,
  },
  oshibotan: {
    camera: { pos: [0.12, 1.19, 0.62], look: [0, 1.14, 0], fov: 32 },
    light: "day",
    scene: () => <PushButtonBox position={[0, 1.15, 0]} waiting />,
  },
  yajirushi: {
    camera: { pos: [-1.8, 4.6, 2.6], look: [-1.95, 4.85, 0], fov: 32 },
    light: "day",
    scene: () => <CarSignal position={[0, 0, 0]} light="red-arrow" />,
  },
  ekibango: {
    camera: { pos: [0, 0, 3.4], look: [0, 0, 0], fov: 36 },
    light: "underground",
    scene: () => (
      <StationNameBoard position={[0, 0, 0]} station="tennoji" line="M" prev="dobutsuenmae" />
    ),
  },
  teikiken: {
    camera: { pos: [0, 0.35, 0.9], look: [0, 0, 0], fov: 30 },
    light: "room",
    scene: () => (
      <IcocaCard
        position={[0, 0, 0]}
        rotation={[-0.35, 0.15, 0.05]}
        sampleName={t("pass.sampleName")}
      />
    ),
  },
  koutsuhi: {
    camera: { pos: [0, 0.55, 0.75], look: [0, 0, 0], fov: 34 },
    light: "room",
    scene: () => (
      <>
        <Receipt position={[-0.09, 0, 0]} rotation={[-Math.PI / 2 + 0.3, 0, 0.12]} />
        <IcocaCard
          position={[0.12, 0.02, 0.04]}
          rotation={[-Math.PI / 2 + 0.3, 0, -0.2]}
          sampleName={t("pass.sampleName")}
        />
      </>
    ),
  },
  icoca: {
    camera: { pos: [1.4, 1.3, 2.4], look: [0, 0.95, 0], fov: 40 },
    light: "day",
    scene: () => (
      <>
        <Prop url="street/vending" position={[0, 0, 0]} />
        <IcocaCard position={[0.45, 1.0, 0.75]} rotation={[0, 0.5, 0.1]} pass={false} />
      </>
    ),
  },
  kaisatsu: {
    camera: { pos: [0.6, 1.6, 1.6], look: [0, 1.0, 0.4], fov: 40 },
    light: "underground",
    scene: () => (
      <>
        <GateRow position={[0, 0, 0]} count={2} open />
        <IcocaCard
          position={[-0.47, 1.18, 0.45]}
          rotation={[-Math.PI / 2 + 0.2, 0, 0]}
          pass={false}
        />
      </>
    ),
  },
  houmen: {
    camera: { pos: [0, 2.6, 3.3], look: [0, 2.6, 0], fov: 42 },
    light: "underground",
    scene: () => (
      <>
        <HangingSign
          position={[0, 3.25, 0]}
          width={3.8}
          height={0.5}
          spec={{
            lines: ["M"],
            text: `${north.track}${t("sign.track")} ${north.direction}`,
            en: north.en,
            arrow: "right",
            tone: "navy",
          }}
          doubleSide={false}
        />
        <LedBoard
          position={[0, 2.25, 0]}
          title={`${north.track}${t("sign.track")}`}
          rows={north.led.map((r) => ({ ...r, track: String(north.track) }))}
        />
      </>
    ),
  },
  rush: {
    camera: { pos: [0.15, 1.32, 3.4], look: [0, 1.05, -6], fov: 62 },
    light: "train",
    scene: () => (
      <>
        <TrainInterior lineId="M" next="" />
        <Crowd
          people={[
            [-0.45, 0, 1.9],
            [0.5, 0, 1.6],
            [-0.1, 0, 0.6],
            [0.55, 0, 0.2],
            [-0.6, 0, -0.4],
            [0.1, 0, -1.2],
            [0.6, 0, -2.1],
            [-0.5, 0, -2.6],
          ].map((p, i) => ({ pos: p as [number, number, number], yaw: i % 2 ? Math.PI : 0.3 }))}
        />
      </>
    ),
  },
  "densha-denwa": {
    camera: { pos: [0.15, 1.5, 1.2], look: [0, 1.3, -1], fov: 50 },
    light: "train",
    scene: () => (
      <>
        <TrainInterior lineId="M" next="" />
        <Crowd
          people={[
            { pos: [-0.35, 0, -0.6], yaw: 0.2 },
            { pos: [0.45, 0, -1.4], yaw: -0.3 },
          ]}
          stare
        />
        <Phone position={[0.12, 1.32, 0.45]} rotation={[-0.2, 0, 0.15]} />
      </>
    ),
  },
};

const HENDY = charactersJson.characters[0]!.look as AvatarConfig;
const STYLES: HairStyle[] = [
  "model",
  "spiky",
  "side",
  "wavy",
  "curly",
  "bob",
  "long",
  "ponytail",
  "twin",
  "bun",
];

/** 見本（豆知識ではない）: 髪型と身長の並び・ヘンディさん。/factory?shot=avatars */
SHOTS.avatars = {
  camera: { pos: [0.45, 0.95, 7.8], look: [0.45, 0.62, 0], fov: 42 },
  light: "day",
  scene: () => (
    <>
      {STYLES.map((hs, i) => (
        <group key={hs} position={[-4.05 + i * 0.9, 0, 0]}>
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "suit",
              figure: i % 2 ? "f" : "m",
              hairStyle: hs,
              suit: ["#2f3a5e", "#3a3d45", "#24283a", "#5b616c"][i % 4]!,
              tie: ["#c23a4a", "#1f6fb8", "#2d8a4a", "#c9a227"][i % 4]!,
              eyes: (["round", "smile", "sparkle", "calm"] as const)[i % 4]!,
              glasses: i === 3,
              height: 156 + i * 4,
              hair: i % 3 === 0 ? "#1d1612" : i % 3 === 1 ? "#3a2618" : "#5a3a22",
            }}
          />
        </group>
      ))}
      <group position={[4.95, 0, 0]}>
        <Chibi config={HENDY} />
      </group>
    </>
  ),
};

/** 撮影台の中身。数フレーム描いてから、撮ってよい合図（window.__shotReady）を出す。 */
export function ShotStage({ id }: { id: string }) {
  const def = SHOTS[id];
  return def ? (
    <>
      <Lights preset={def.light} />
      <Suspense fallback={null}>
        {def.scene()}
        <ShotCamera def={def} />
      </Suspense>
    </>
  ) : null;
}

function ShotCamera({ def }: { def: ShotDef }) {
  const frames = useRef(0);
  useEffect(() => {
    (window as unknown as { __shotReady?: boolean }).__shotReady = false;
  }, []);
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...def.camera.pos);
    cam.fov = def.camera.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(...def.camera.look);
    frames.current += 1;
    // 字体と動きの読みこみを待つ（はじめの数十フレームは捨てる）
    if (frames.current === 90) (window as unknown as { __shotReady?: boolean }).__shotReady = true;
  });
  return null;
}

/** 見本（開発用）: 町の看板（かなの字）を近くで見る。/factory?shot=town-signs */
SHOTS["town-signs"] = {
  camera: { pos: [0, 2.0, 6.5], look: [0, 1.6, 0], fov: 50 },
  light: "day",
  scene: () => (
    <>
      <group rotation={[0, -Math.PI / 2, 0]} position={[-3, 0, 0]}>
        <VSign position={[0, 1.6, 0]} text="town.soba" />
      </group>
      <group rotation={[0, -Math.PI / 2, 0]} position={[-1.8, 0, 0]}>
        <VSign position={[0, 1.6, 0]} text="town.cafe" bg="#2f5d3a" fg="#ffffff" />
      </group>
      <group rotation={[0, -Math.PI / 2, 0]} position={[-0.6, 0, 0]}>
        <VSign
          position={[0, 1.6, 0]}
          text="town.kusuri"
          bg="#1f5fa8"
          fg="#ffffff"
          frame="#e8e8e8"
        />
      </group>
      <Noren position={[1.2, 2.0, 0]} text="town.soba" />
      <Noren position={[3.0, 2.0, 0]} text="town.yu" />
    </>
  ),
};

/** 見本（開発用）: ネクマックスの 3D（lab の nexmax.glb）。/factory?shot=nexmax */
SHOTS.nexmax = {
  camera: { pos: [0, 0.75, 3.2], look: [0, 0.6, 0], fov: 32 },
  light: "day",
  scene: () => (
    <>
      <group position={[-0.7, 0, 0]}>
        <NexmaxModel motion="idle" face="happy" />
      </group>
      <group position={[0.7, 0, 0]}>
        <NexmaxModel motion="wave" face="surprised" />
      </group>
    </>
  ),
};

/** 見本（開発用）: Codex の参考の絵とならべる、スーツの男女とふだんの服。/factory?shot=avatars-ref */
SHOTS["avatars-ref"] = {
  camera: { pos: [0, 0.8, 4.2], look: [0, 0.6, 0], fov: 38 },
  light: "day",
  scene: () => (
    <>
      {(
        [
          { outfit: "suit", figure: "m", hairStyle: "side", tie: "#c23a4a" },
          { outfit: "suit", figure: "f", hairStyle: "bun", tie: "#1f2a5a", accessory: "flower" },
          { outfit: "casual", figure: "m", hairStyle: "side" },
          { outfit: "casual", figure: "f", hairStyle: "bun", accessory: "flower" },
        ] as const
      ).map((c, i) => (
        <group key={i} position={[-1.35 + i * 0.9, 0, 0]} rotation={[0, i % 2 ? -0.25 : 0.25, 0]}>
          <Chibi config={{ ...DEFAULT_AVATAR, suit: "#262d4a", ...c }} phase={0.15 + i * 0.2} />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: 表情4つ（ふつう・にこにこ・びっくり・考える）。/factory?shot=faces */
SHOTS.faces = {
  camera: { pos: [0, 0.95, 2.6], look: [0, 0.85, 0], fov: 34 },
  light: "day",
  scene: () => (
    <>
      {(["normal", "happy", "surprised", "thinking"] as const).map((e, i) => (
        <group key={e} position={[-1.05 + i * 0.7, 0, 0]}>
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "suit",
              figure: i % 2 ? "f" : "m",
              hairStyle: i % 2 ? "bob" : "side",
              hair: "#4a3326",
            }}
            expression={e}
            phase={0.3}
          />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: ふわふわ・くるくるの髪と、くつの色。/factory?shot=hair-new */
SHOTS["hair-new"] = {
  camera: { pos: [0, 0.8, 3.0], look: [0, 0.6, 0], fov: 38 },
  light: "day",
  scene: () => (
    <>
      {(
        [
          { hairStyle: "wavy", outfit: "casual", shoes: "#d94b4b" },
          { hairStyle: "curly", outfit: "casual", figure: "f", shoes: "#3b6ea5" },
          { hairStyle: "wavy", outfit: "suit", hair: "#5e4030" },
        ] as const
      ).map((c, i) => (
        <group key={i} position={[-0.75 + i * 0.75, 0, 0]} rotation={[0, (i - 1) * -0.3, 0]}>
          <Chibi config={{ ...DEFAULT_AVATAR, hair: "#4a3326", ...c }} phase={0.2 + i * 0.25} />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: 髪型10種を顔の高さで並べる（前と、ななめ後ろ）。/factory?shot=hair-styles */
SHOTS["hair-styles"] = {
  camera: { pos: [0, 1.35, 6.2], look: [0, 0.75, 0], fov: 34 },
  light: "day",
  scene: () => (
    <>
      {STYLES.map((hs, i) => (
        <group
          key={hs}
          position={[-2.4 + (i % 5) * 1.2, i < 5 ? 0.95 : -0.35, i < 5 ? 0 : 0.4]}
          rotation={[0, i < 5 ? 0 : 2.4, 0]}
        >
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "casual",
              hairStyle: hs,
              hair: "#5e4030",
              figure: i % 2 ? "f" : "m",
            }}
            phase={0.4 + i * 0.07}
          />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: 体の形3種（男性・ズボン／女性・スカート／女性・ズボン）を、スーツとふだんの服で並べる。/factory?shot=figures */
const FIGS = [
  { figure: "m", bottom: "pants", hairStyle: "side" },
  { figure: "f", bottom: "skirt", hairStyle: "bob" },
  { figure: "f", bottom: "pants", hairStyle: "ponytail" },
] as const;
SHOTS["figures"] = {
  camera: { pos: [0, 0.8, 6.4], look: [0, 0.55, 0], fov: 30 },
  light: "day",
  scene: () => (
    <>
      {(["suit", "casual"] as const).flatMap((outfit, row) =>
        FIGS.map((f, i) => (
          <group
            key={`${outfit}${i}`}
            position={[-2.15 + row * 2.7 + i * 0.8, 0, 0]}
            rotation={[0, -0.25, 0]}
          >
            <Chibi
              config={{
                ...DEFAULT_AVATAR,
                outfit,
                figure: f.figure,
                bottom: f.bottom,
                hairStyle: f.hairStyle,
                skin: ["#c68e64", "#e0ac83", "#a8714a"][i]!,
                coat: ["#8a8f98", "#d98c6a", "#6f8fb3"][i]!,
                pants: ["#3a3d44", "#5c4a6e", "#3d5570"][i]!,
              }}
              phase={0.3 + i * 0.2}
            />
          </group>
        )),
      )}
    </>
  ),
};
