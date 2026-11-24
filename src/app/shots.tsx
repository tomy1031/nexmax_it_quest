import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef } from "react";
import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { DEFAULT_AVATAR } from "@/lib/store";
import { t } from "@/lib/t";
import {
  GateRow,
  HangingSign,
  LedBoard,
  StationNameBoard,
  TrainExterior,
  TrainInterior,
} from "@/factory/station-parts";
import { CarSignal, PedSignal, Prop, PushButtonBox } from "@/factory/street-parts";
import { IcocaCard, LaptopScreen, Phone, Receipt } from "@/factory/small-parts";
import { Noren, VSign } from "@/factory/town-parts";
import { Chibi } from "@/three/Chibi";
import { FLAT, block, box, cyl, merge, paint } from "@/factory/kit";
import { EYE_SLOTS } from "@/three/face-parts";
import { NexmaxModel } from "@/three/Nexmax";
import { Crowd } from "@/three/Crowd";
import { Lights } from "@/three/helpers";
import charactersJson from "@content/characters.json";
import { CarPanel } from "@/stages/stage1/OfficeScenes";
import { npcLook } from "@/three/Crowd";
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
  /** 背景の色（無ければ透明）。顔の絵（public/img/people/）は hendy.webp に合わせて色を付ける。 */
  bg?: string;
}

export const SHOTS: Record<string, ShotDef> = {
  nmchat: {
    camera: { pos: [0.35, 0.38, 0.55], look: [0, 0.14, 0], fov: 40 },
    light: "room",
    scene: () => (
      <>
        <Prop url="home/laptop" position={[0, 0, 0]} />
        <LaptopScreen
          position={[0, 0, 0]}
          ppm={1600}
          fontText={t("chat.title")}
          draw={(ctx, w, h) => {
            ctx.fillStyle = "#1b2a5c";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(w * 0.32, h * 0.1, w * 0.62, h * 0.8);
            ctx.fillStyle = "#38e1ff";
            ctx.font = `800 ${h * 0.1}px sans-serif`;
            ctx.fillText("NMChat", w * 0.035, h * 0.2);
            ["#ffd23f", "#9fb4ff", "#9fb4ff"].forEach((c, i) => {
              ctx.fillStyle = c;
              ctx.fillRect(w * 0.04, h * (0.36 + i * 0.16), w * 0.24, h * 0.08);
            });
            ctx.fillStyle = "#c9d3e6";
            for (let i = 0; i < 5; i += 1)
              ctx.fillRect(w * 0.36, h * (0.2 + i * 0.13), w * (0.4 + (i % 2) * 0.12), h * 0.05);
          }}
        />
        <Phone position={[0.24, 0.008, -0.1]} rotation={[-Math.PI / 2, 0, 0.35]} />
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
    camera: { pos: [0, 0.62, 0.86], look: [-0.02, 0, 0], fov: 34 },
    light: "room",
    scene: () => (
      <>
        {/* 領収書（左）と定期券（右）。かさねない（金額が かくれないように） */}
        <Receipt position={[-0.17, 0, 0]} rotation={[-Math.PI / 2 + 0.3, 0, 0.1]} />
        <IcocaCard
          position={[0.12, 0.01, 0.03]}
          rotation={[-Math.PI / 2 + 0.3, 0, -0.15]}
          sampleName={t("pass.sampleName")}
        />
      </>
    ),
  },
  icoca: {
    camera: { pos: [1.5, 1.25, 3.6], look: [0.05, 0.92, 0], fov: 38 },
    light: "day",
    scene: () => (
      <>
        <Prop url="street/vending" position={[0, 0, 0]} />
        {/* 自動販売機の読み取り機（右下）に カードを かざしている所。前に少し はなす */}
        <IcocaCard position={[0.3, 0.82, 0.5]} rotation={[0, 0.15, 0.08]} pass={false} />
      </>
    ),
  },
  kaisatsu: {
    camera: { pos: [1.0, 1.75, 2.3], look: [0, 0.9, 0.25], fov: 40 },
    light: "underground",
    scene: () => (
      <>
        <GateRow position={[0, 0, 0]} count={2} open />
        {/* まん中の改札の読み取り機（x=0・z=0.45）の上に カードを かざす */}
        <IcocaCard position={[0, 1.13, 0.45]} rotation={[-Math.PI / 2 + 0.2, 0, 0]} pass={false} />
      </>
    ),
  },
  houmen: {
    camera: { pos: [0, 2.75, 4.6], look: [0, 2.75, 0], fov: 42 },
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
  "buzz",
  "center",
  "bob",
  "long",
  "ponytail",
  "twin",
  "bun",
  "halfup",
  "braid",
  "twinbun",
  "shichisan",
  "allback",
  "twoblock",
  "mohawk",
  "afro",
  "sidetail",
  "lowpony",
  "hime",
  "longwave",
  "osage",
  "swirl",
  "messy",
  "topknot",
  "mash",
  "wolf",
  "tucked",
  "pixie",
  "lob",
  "budtail",
  "crown",
  "perm",
  "lowpuff",
  "clipbob",
  "headband",
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
      {def.bg && <color attach="background" args={[def.bg]} />}
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
          { outfit: "casual", figure: "f", hairStyle: "bob", accessory: "ribbon" },
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
/** 見本（開発用）: 目の形5つ（まる・にこにこ・キラキラ・おだやか・小さい）。/factory?shot=eyes */
SHOTS.eyes = {
  camera: { pos: [0, 0.95, 3.1], look: [0, 0.82, 0], fov: 34 },
  light: "day",
  scene: () => (
    <>
      {(["round", "smile", "sparkle", "calm", "small"] as const).map((e, i) => (
        <group key={e} position={[-1.4 + i * 0.7, 0, 0]}>
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "casual",
              eyes: e,
              figure: i % 2 ? "f" : "m",
              hairStyle: (["side", "bob", "center", "twinbun", "model"] as const)[i]!,
              skin: ["#c68e64", "#e0ac83", "#a8714a", "#d49a6a", "#b98258"][i]!,
            }}
            phase={0.3 + i * 0.4}
          />
        </group>
      ))}
    </>
  ),
};

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

/** 見本（開発用）: 髪型10種を顔の高さで並べる。/factory?shot=hair-styles（前から）・hair-back（ななめ後ろから） */
function hairRows(yaw: number) {
  return (
    <>
      {STYLES.map((hs, i) => (
        <group
          key={hs}
          position={[-3.0 + (i % 6) * 1.2, 4.0 - Math.floor(i / 6) * 1.25, 0]}
          rotation={[0, yaw, 0]}
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
  );
}
SHOTS["hair-styles"] = {
  camera: { pos: [0, 0.9, 12.5], look: [0, 0.9, 0], fov: 42 },
  light: "day",
  scene: () => hairRows(0.25),
};
SHOTS["hair-back"] = {
  camera: { pos: [0, 0.9, 12.5], look: [0, 0.9, 0], fov: 42 },
  light: "day",
  scene: () => hairRows(2.5),
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

/** 見本（開発用）: 布の模様（スーツのツイル・パーカーのニット・デニム・チェックのスカート）を近くで。/factory?shot=fabrics */
SHOTS.fabrics = {
  camera: { pos: [0, 0.5, 2.6], look: [0, 0.5, 0], fov: 36 },
  light: "day",
  scene: () => (
    <>
      {(
        [
          { outfit: "suit", figure: "m", bottom: "pants" },
          { outfit: "casual", figure: "m", bottom: "pants", coat: "#7d8ea8", pants: "#3f5f8f" },
          { outfit: "casual", figure: "f", bottom: "skirt", coat: "#e8b4a0", pants: "#4c6a5a" },
        ] as const
      ).map((c, i) => (
        <group key={i} position={[-0.62 + i * 0.62, 0, 0]} rotation={[0, (i - 1) * 0.3, 0]}>
          <Chibi config={{ ...DEFAULT_AVATAR, hairStyle: "side", ...c }} phase={0.2 + i * 0.3} />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: 目の形 全部（頭だけ。上の段から順に）。/factory?shot=eyes-all */
SHOTS["eyes-all"] = {
  camera: { pos: [0, 1.05, 6.2], look: [0, 0.75, 0], fov: 34 },
  light: "day",
  scene: () => (
    <>
      {(Object.keys(EYE_SLOTS) as AvatarConfig["eyes"][]).map((e, i) => (
        <group key={e} position={[-2.4 + (i % 6) * 0.96, 1.05 - Math.floor(i / 6) * 0.95, 0]}>
          <Chibi
            config={{
              ...DEFAULT_AVATAR,
              outfit: "casual",
              eyes: e,
              hairStyle: "buzz",
              skin: ["#c68e64", "#e0ac83", "#a8714a"][i % 3]!,
            }}
            phase={0.15}
          />
        </group>
      ))}
    </>
  ),
};

/** 見本（開発用）: 着ぐるみ（くま・ねこ・うさぎ。前と後ろ）。/factory?shot=kigurumi */
SHOTS.kigurumi = {
  camera: { pos: [0, 0.8, 3.6], look: [0, 0.6, 0], fov: 36 },
  light: "day",
  scene: () => (
    <>
      {(["bear", "cat", "rabbit"] as const).flatMap((k, i) =>
        [0, 1].map((back) => (
          <group
            key={`${k}${back}`}
            position={[-1.5 + i * 1.05 + back * 0.5, 0, back * -0.3]}
            rotation={[0, back ? 2.6 : 0.2, 0]}
          >
            <Chibi
              config={{
                ...DEFAULT_AVATAR,
                outfit: "kigurumi",
                kigurumi: k,
                figure: i === 1 ? "f" : "m",
              }}
              phase={0.2 + i * 0.3}
            />
          </group>
        )),
      )}
    </>
  ),
};

/** 見本（開発用）: くつの形3つ（革ぐつ・スニーカー・サンダル）。/factory?shot=shoes */
SHOTS.shoes = {
  camera: { pos: [0.5, 0.45, 1.6], look: [0, 0.12, 0], fov: 34 },
  light: "day",
  scene: () => (
    <>
      {(["leather", "sneaker", "sandal"] as const).map((st, i) => (
        <group key={st} position={[-0.42 + i * 0.42, 0, 0]} rotation={[0, 0.5, 0]}>
          <Chibi config={{ ...DEFAULT_AVATAR, outfit: "casual", shoeType: st }} phase={0.1} />
        </group>
      ))}
    </>
  ),
};

/** 豆知識「日本の エレベーター」: 1階の 下は B1。「G」が 無い ボタン。 */
SHOTS["no-g"] = {
  camera: { pos: [0, 0, 1.05], look: [0, 0, 0], fov: 42 },
  light: "underground",
  scene: () => <CarPanel floor={1} lit="1" position={[0, 0, 0]} rotation={[0, 0, 0]} />,
};

/** 豆知識「前の 席に 座る」: 前の 列に すわった 自分と、うしろの 列。 */
SHOTS["mae-no-seki"] = {
  camera: { pos: [0.5, 1.45, -2.3], look: [-0.15, 0.6, 0.9], fov: 46 },
  light: "room",
  scene: () => (
    <>
      {[0, 1, 2].flatMap((r) =>
        [-1.2, -0.4, 0.4, 1.2].map((x) => (
          <Prop
            key={`${r},${x}`}
            url="office/seminar-chair"
            position={[x, 0, r * 1.2]}
            rotationY={Math.PI}
          />
        )),
      )}
      {[1, 2].flatMap((r) =>
        [-1.2, -0.4, 0.4, 1.2].map((x, i) => (
          <group key={`p${r},${x}`} position={[x, 0, r * 1.2 + 0.05]} rotation={[0, Math.PI, 0]}>
            <Chibi config={{ ...npcLook(r * 4 + i, "suit"), bag: false }} motion="sitting" />
          </group>
        )),
      )}
      <group position={[-0.4, 0, 0.05]} rotation={[0, Math.PI, 0]}>
        <Chibi
          config={{ ...DEFAULT_AVATAR, outfit: "suit", bag: false }}
          motion="sitting"
          expression="happy"
        />
      </group>
    </>
  ),
};

/* ここから ステージ2・ヘンディさんのお話の 仮の絵（Codex の絵が届いたら 同じ名前で置きかえる）。
 * 豆知識でない絵の保存先と大きさは scripts/shot-outputs.json に書く。 */

/** 山本社長（Aoba の社長）の見た目。content/characters.json の look に そのまま写せる形。 */
export const YAMAMOTO_LOOK: AvatarConfig = {
  outfit: "suit",
  figure: "f",
  bottom: "skirt",
  skin: "#f1c9a5",
  hair: "#3b2a20",
  hairStyle: "bob",
  glasses: false,
  height: 162,
  eyes: "lashes",
  mouth: "smile",
  blush: true,
  suit: "#2f5d50",
  shirt: "#ffffff",
  tie: "#9cc9a8",
  coat: "#2f5d50",
  pants: "#2f5d50",
  bag: false,
  accessory: "none",
};

/** 新しい社員（自分）。カンボジアの 若い社員の はだと 髪。 */
const NEWBIE: AvatarConfig = {
  ...DEFAULT_AVATAR,
  outfit: "suit",
  skin: "#d49a6a",
  hair: "#2a1d17",
  hairStyle: "mash",
  suit: "#2f3a5e",
  tie: "#c23a4a",
  eyes: "round",
  // 新しい社員の しるし（社員証）
  neckwear: "lanyard",
  neckColor: "#4a90d9",
  bag: false,
};

/** 先輩（やさしく 教えてくれる人）。 */
const SENIOR: AvatarConfig = { ...HENDY, bag: false };

/** 壁の時計（数字なし。目もりと針だけ）。r は文字盤の半径。8時55分（少し早い）を指す。 */
function WallClock({ position, r = 0.32 }: { position: [number, number, number]; r?: number }) {
  const geo = useMemo(() => {
    const p = [
      cyl(r * 1.1, 0.05, "#7fb8a4", { rot: [Math.PI / 2, 0, 0] }, 32),
      cyl(r, 0.06, "#fffdf6", { rot: [Math.PI / 2, 0, 0] }, 32),
    ];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const big = i % 3 === 0;
      p.push(
        box(r * (big ? 0.07 : 0.045), r * (big ? 0.2 : 0.13), 0.01, "#4a4f63", {
          pos: [Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.8, 0.035],
          rot: [0, 0, -a],
        }),
      );
    }
    const hand = (len: number, w: number, a: number, z: number) =>
      box(w, len, 0.01, "#3a3f52", {
        pos: [(Math.sin(a) * len) / 2, (Math.cos(a) * len) / 2, z],
        rot: [0, 0, -a],
      });
    p.push(hand(r * 0.5, r * 0.08, ((8 + 55 / 60) / 12) * Math.PI * 2, 0.045));
    p.push(hand(r * 0.75, r * 0.05, (55 / 60) * Math.PI * 2, 0.055));
    p.push(cyl(r * 0.07, 0.02, "#e2725b", { pos: [0, 0, 0.06], rot: [Math.PI / 2, 0, 0] }, 12));
    return merge(p);
  }, [r]);
  return <mesh geometry={geo} material={FLAT} position={position} />;
}

/** 床（うすい板）。line を付けると、ホームの 黄色い線（x の位置）も引く。 */
function Floor({
  w,
  d,
  color,
  position = [0, 0, 0],
  line,
}: {
  w: number;
  d: number;
  color: string;
  position?: [number, number, number];
  line?: number;
}) {
  const geo = useMemo(() => {
    const p = [block(w, 0.04, d, color, { pos: [0, -0.04, 0] })];
    if (line !== undefined) p.push(block(0.3, 0.006, d, "#f2c94c", { pos: [line, 0, 0] }));
    return merge(p);
  }, [w, d, color, line]);
  return <mesh geometry={geo} material={FLAT} position={position} />;
}

/** 紙（ウェブページの 下書きの絵）。 */
function Paper({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const geo = useMemo(
    () =>
      merge([
        box(0.2, 0.27, 0.005, "#fffdf6"),
        box(0.16, 0.05, 0.004, "#9fd3c7", { pos: [0, 0.09, 0.004] }),
        box(0.07, 0.07, 0.004, "#f6c28b", { pos: [-0.04, 0.0, 0.004] }),
        box(0.06, 0.012, 0.004, "#b9c3d9", { pos: [0.045, 0.02, 0.004] }),
        box(0.06, 0.012, 0.004, "#b9c3d9", { pos: [0.045, -0.01, 0.004] }),
        box(0.16, 0.03, 0.004, "#f29b8f", { pos: [0, -0.09, 0.004] }),
      ]),
    [],
  );
  return <mesh geometry={geo} material={FLAT} position={position} rotation={rotation} />;
}

/** ノートパソコン（page で 画面に 作りかけのページ）。 */
function Laptop({
  position,
  rotationY = 0,
  page = false,
}: {
  position: [number, number, number];
  rotationY?: number;
  page?: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Prop url="home/laptop" position={[0, 0, 0]} />
      <LaptopScreen
        position={[0, 0, 0]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#eaf4ff";
          ctx.fillRect(0, 0, w, h);
          if (page) {
            ctx.fillStyle = "#9fd3c7";
            ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.2);
            ctx.fillStyle = "#f6c28b";
            ctx.fillRect(w * 0.08, h * 0.36, w * 0.35, h * 0.32);
            ctx.fillStyle = "#f29b8f";
            ctx.fillRect(w * 0.08, h * 0.76, w * 0.84, h * 0.14);
          }
          ctx.fillStyle = "#b9c3d9";
          for (let i = 0; i < 4; i += 1)
            ctx.fillRect(
              page ? w * 0.5 : w * 0.1,
              h * (0.38 + i * 0.08),
              w * (page ? 0.4 : 0.6 - (i % 2) * 0.2),
              h * 0.04,
            );
        }}
      />
    </group>
  );
}

/** 机（ちびキャラの 大きさに 合わせて 低くした 机）。 */
const DESK_SCALE: [number, number, number] = [0.75, 0.68, 0.75];
const DESK_TOP = 0.72 * DESK_SCALE[1];
function Desk({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return <Prop url="home/desk" position={position} rotationY={rotationY} scale={DESK_SCALE} />;
}

/** お店の エプロン（胸から ひざまで）。 */
function Apron() {
  const geo = useMemo(
    () =>
      merge([
        box(0.26, 0.36, 0.012, "#5b8f6e", { pos: [0, 0.36, 0.165] }),
        box(0.12, 0.08, 0.008, "#7fb08f", { pos: [0, 0.3, 0.175] }),
      ]),
    [],
  );
  return <mesh geometry={geo} material={FLAT} />;
}

/** 豆知識「メモを 取る」: 前の列で ノートに 書きながら、話す人を 見る。 */
SHOTS["memo-wo-toru"] = {
  camera: { pos: [0.45, 1.15, 1.9], look: [0, 0.62, -0.3], fov: 36 },
  light: "room",
  scene: () => (
    <>
      <Prop url="office/seminar-chair" position={[0, 0, 0]} />
      {[-0.6, 0.6].map((x, i) => (
        <group key={`p${x}`}>
          <Prop url="office/seminar-chair" position={[x, 0, -1.0]} />
          <group position={[x, 0, -0.95]}>
            <Chibi
              config={{ ...npcLook(i * 4 + 2, "suit"), bag: false }}
              motion="writing"
              holding="notebook"
              seated
              phase={i}
            />
          </group>
        </group>
      ))}
      <group position={[0, 0, 0.05]} rotation={[0, 0.25, 0]}>
        <Chibi config={{ ...NEWBIE, eyes: "sparkle" }} motion="writing" holding="notebook" seated />
      </group>
    </>
  ),
};

/** ヘンディさんのお話「あいさつ」: 朝、新しい社員が 元気に あいさつし、先輩も 手を上げて 返す。 */
SHOTS["listening-aisatsu"] = {
  camera: { pos: [0, 0.85, 2.7], look: [0, 0.62, 0], fov: 34 },
  light: "room",
  scene: () => (
    <>
      <Floor w={2.4} d={1.6} color="#f3e6cf" />
      <Prop url="home/plant" position={[0.95, 0, -0.6]} scale={0.6} />
      <group position={[-0.42, 0, 0.1]} rotation={[0, 0.55, 0]}>
        <Chibi config={NEWBIE} motion="wave" expression="happy" />
      </group>
      <group position={[0.45, 0, -0.05]} rotation={[0, -0.55, 0]}>
        <Chibi config={SENIOR} motion="wave" expression="happy" phase={0.6} />
      </group>
    </>
  ),
};

/** ヘンディさんのお話「時間」: 会議の前に もう すわって 待っている。ほかの いすは まだ 空いている。 */
SHOTS["listening-jikan"] = {
  camera: { pos: [0.2, 1.25, 2.6], look: [0, 0.85, -0.3], fov: 40 },
  light: "room",
  scene: () => (
    <>
      <WallClock position={[0, 1.55, -1.1]} r={0.3} />
      <Prop url="home/coffee-table" position={[0, 0, 0]} scale={[1.2, 1.05, 1.3]} />
      <Prop url="office/seminar-chair" position={[0, 0, -0.62]} />
      {[-0.75, 0.75].flatMap((x) =>
        [-0.2, 0.25].map((z) => (
          <Prop
            key={`${x},${z}`}
            url="office/seminar-chair"
            position={[x, 0, z]}
            rotationY={x < 0 ? Math.PI / 2 : -Math.PI / 2}
          />
        )),
      )}
      <group position={[0, 0, -0.57]}>
        <Chibi config={NEWBIE} motion="writing" holding="notebook" seated />
      </group>
    </>
  ),
};

/** ヘンディさんのお話「連絡」: 電車が 止まった ホームで、会社に 電話する。 */
SHOTS["listening-renraku"] = {
  camera: { pos: [1.3, 1.05, 2.2], look: [-0.1, 0.75, 0], fov: 40 },
  light: "underground",
  scene: () => (
    <>
      <Floor w={6} d={8} color="#d9d4cc" position={[1.0, 0, 0]} line={-1.7} />
      <group position={[-2.4, 0, -4]}>
        <TrainExterior lineId="M" cars={1} />
      </group>
      <Prop url="station/bench" position={[1.0, 0, -1.4]} />
      <group rotation={[0, 0.2, 0]}>
        <Chibi config={NEWBIE} motion="calling" holding="phone" expression="thinking" />
      </group>
    </>
  ),
};

/** ヘンディさんのお話「相談」: パソコンの前で 新しい社員が 聞き、先輩が かがんで 画面を 指す。 */
SHOTS["listening-soudan"] = {
  camera: { pos: [-0.3, 1.25, -2.0], look: [-0.25, 0.62, 0.35], fov: 40 },
  light: "room",
  scene: () => (
    <>
      <Desk position={[0, 0, 0]} />
      <Prop url="office/seminar-chair" position={[0, 0, 0.5]} rotationY={Math.PI} />
      <Laptop position={[0, DESK_TOP, 0.05]} />
      <Prop url="home/mug" position={[-0.35, DESK_TOP, 0.05]} />
      <group position={[0.12, 0, 0.55]} rotation={[0, Math.PI + 0.1, 0]}>
        <Chibi config={NEWBIE} motion="raise" seated expression="thinking" />
      </group>
      <group position={[-0.68, 0, 0.36]} rotation={[0, Math.PI - 1.0, 0]}>
        <Chibi config={SENIOR} motion="point" expression="happy" />
      </group>
    </>
  ),
};

/** 豆知識「受託開発」: お客さんが 頼み、会社の エンジニアが 作る。 */
SHOTS["jutaku-kaihatsu"] = {
  camera: { pos: [0.1, 1.3, 2.6], look: [0.1, 0.6, 0], fov: 38 },
  light: "room",
  scene: () => (
    <>
      <group position={[-0.7, 0, 0.3]} rotation={[0, 0.8, 0]}>
        <Chibi config={CLIENT_SHOP} motion="point" expression="happy" />
        <Apron />
      </group>
      <Paper position={[-0.45, 0.5, 0.5]} rotation={[-0.25, 0.5, 0]} />
      <DottedArc from={[-0.35, 0.72, 0.45]} to={[0.25, 0.62, -0.25]} lift={0.35} />
      <Desk position={[0.65, 0, -0.3]} />
      {[0.35, 0.95].map((x, i) => (
        <group key={x}>
          <Laptop position={[x, DESK_TOP, -0.35]} rotationY={Math.PI} page />
          <Prop url="office/seminar-chair" position={[x, 0, -0.9]} />
          <group position={[x, 0, -0.85]}>
            <Chibi
              config={{ ...(i ? npcLook(7, "suit") : NEWBIE), bag: false }}
              motion="phone"
              seated
              expression="happy"
              phase={i}
            />
          </group>
        </group>
      ))}
    </>
  ),
};

/** お店の人（エプロンを つける）。 */
const CLIENT_SHOP: AvatarConfig = {
  ...DEFAULT_AVATAR,
  outfit: "casual",
  casualStyle: "tshirt",
  coat: "#f6c28b",
  figure: "f",
  hairStyle: "ponytail",
  hair: "#3a2618",
  skin: "#e0ac83",
  bag: false,
};

/** 玉（まるい形）。pos は中心。 */
function ball(r: number, color: string, pos: [number, number, number]): THREE.BufferGeometry {
  const g = paint(new THREE.SphereGeometry(r, 28, 20), color);
  g.translate(...pos);
  return g;
}

/** カウンターの高さ（ちびキャラの 胸の高さ）。 */
const COUNTER_H = 0.42;

/** Aoba の カウンター（深い緑と白）・抹茶の飲み物・植物・南の国の 窓の外。 */
function MatchaCounter() {
  const geo = useMemo(() => {
    const top = COUNTER_H + 0.04;
    const p = [
      block(2.4, COUNTER_H, 0.5, "#2f6b4f"),
      block(2.5, 0.04, 0.6, "#fbfaf4", { pos: [0, COUNTER_H, 0] }),
      // 前の たての線
      ...[-0.9, -0.45, 0, 0.45, 0.9].map((x) =>
        box(0.03, COUNTER_H - 0.06, 0.01, "#3f8063", { pos: [x, COUNTER_H / 2, 0.255] }),
      ),
      // うしろの 白い壁と 緑の帯・たな
      block(3.4, 2.0, 0.08, "#fbfaf4", { pos: [0, 0, -1.0] }),
      block(3.4, 0.1, 0.09, "#2f6b4f", { pos: [0, 0.75, -0.99] }),
      block(1.0, 0.04, 0.22, "#d8c3a0", { pos: [-0.75, 1.3, -0.9] }),
      // 窓（空と ヤシの木）
      block(0.9, 0.75, 0.02, "#2f6b4f", { pos: [0.85, 0.95, -0.95] }),
      block(0.82, 0.67, 0.02, "#bfe6f5", { pos: [0.85, 0.99, -0.94] }),
      cyl(0.025, 0.5, "#b08a5a", { pos: [0.95, 1.2, -0.92], rot: [0, 0, -0.15] }, 6),
      ...[0, 1.2, 2.4, 3.6, 4.8].map((a) =>
        box(0.26, 0.03, 0.01, "#5fb36a", {
          pos: [0.99 + Math.cos(a) * 0.12, 1.47 + Math.sin(a) * 0.06 - 0.02, -0.91],
          rot: [0, 0, Math.sin(a) * 0.5 - 0.25],
        }),
      ),
    ];
    // カップ（白い カップに 明るい緑の 飲み物）
    const cup = (x: number, z: number, r: number, h: number, y = top) => {
      p.push(cyl(r, h, "#fffdf6", { pos: [x, y + h / 2, z] }, 16));
      p.push(cyl(r * 0.88, 0.012, "#7ccf3a", { pos: [x, y + h + 0.002, z] }, 16));
    };
    cup(-0.62, 0.12, 0.055, 0.11);
    cup(-0.45, 0.02, 0.05, 0.13);
    cup(0.55, 0.1, 0.05, 0.13);
    // 茶わん（ひくく 広い）と 茶せん
    cup(0.05, 0.12, 0.09, 0.06);
    p.push(cyl(0.03, 0.05, "#e6d29a", { pos: [0.28, top + 0.025, 0.14] }, 10));
    p.push(cyl(0.01, 0.06, "#c9b27a", { pos: [0.28, top + 0.08, 0.14] }, 6));
    // たなの 上の カップ
    for (let i = 0; i < 4; i += 1)
      p.push(
        cyl(0.05, 0.09, i % 2 ? "#cfe9d4" : "#fffdf6", { pos: [-1.1 + i * 0.22, 1.365, -0.9] }, 12),
      );
    return merge(p);
  }, []);
  return <mesh geometry={geo} material={FLAT} />;
}

/** カフェの店員。 */
const BARISTA: AvatarConfig = {
  ...DEFAULT_AVATAR,
  outfit: "casual",
  casualStyle: "tshirt",
  coat: "#fbfaf4",
  figure: "f",
  hairStyle: "bun",
  hair: "#3a2618",
  skin: "#e0ac83",
  bag: false,
};

/** 豆知識「Aoba」: 落ち着いた 抹茶の カフェの カウンター。 */
SHOTS.aoba = {
  camera: { pos: [0.1, 1.2, 2.4], look: [0.05, 0.7, -0.3], fov: 40 },
  light: "room",
  scene: () => (
    <>
      <MatchaCounter />
      <group position={[-0.2, 0, -0.45]} rotation={[0, 0.15, 0]}>
        <Chibi config={BARISTA} motion="talking" expression="happy" />
        <Apron />
      </group>
      <Prop url="home/plant" position={[-1.3, 0, 0.15]} scale={0.6} />
      <Prop url="home/plant" position={[1.35, 0, -0.5]} scale={0.5} />
    </>
  ),
};

/**
 * 考えの ふきだし（白い 玉の 雲）。中に お金・カレンダー（数字なし）・やることの表。
 * 下へ 小さい玉が 続く（tail の向き）。
 */
function ThoughtBubble({ position }: { position: [number, number, number] }) {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [];
    [
      [0, 0, 0.2],
      [-0.2, -0.02, 0.15],
      [0.2, -0.02, 0.15],
      [-0.1, 0.1, 0.15],
      [0.1, 0.1, 0.15],
      [-0.1, -0.1, 0.14],
      [0.1, -0.1, 0.14],
    ].forEach(([x, y, r]) => p.push(ball(r!, "#ffffff", [x!, y!, -0.08])));
    p.push(ball(0.04, "#ffffff", [0.16, -0.27, 0]));
    p.push(ball(0.025, "#ffffff", [0.22, -0.35, 0]));
    // お金（金色の まる）
    p.push(cyl(0.06, 0.02, "#f2c94c", { pos: [-0.2, 0, 0.1], rot: [Math.PI / 2, 0, 0] }, 16));
    p.push(cyl(0.035, 0.022, "#e0b23a", { pos: [-0.2, 0, 0.11], rot: [Math.PI / 2, 0, 0] }, 16));
    // カレンダー（赤い上と 目もり）
    p.push(box(0.13, 0.13, 0.01, "#fffdf6", { pos: [0, 0.02, 0.12] }));
    p.push(box(0.13, 0.035, 0.012, "#e2725b", { pos: [0, 0.07, 0.125] }));
    for (let r = 0; r < 2; r += 1)
      for (let c = 0; c < 3; c += 1)
        p.push(
          box(0.022, 0.022, 0.012, r === 1 && c === 1 ? "#e2725b" : "#b9c3d9", {
            pos: [-0.035 + c * 0.035, 0.015 - r * 0.04, 0.127],
          }),
        );
    // やることの表（緑の しるしと 線）
    p.push(box(0.11, 0.14, 0.01, "#fffdf6", { pos: [0.2, 0, 0.1] }));
    for (let i = 0; i < 3; i += 1) {
      p.push(box(0.02, 0.02, 0.012, "#5fb36a", { pos: [0.165, 0.04 - i * 0.04, 0.106] }));
      p.push(box(0.05, 0.012, 0.012, "#b9c3d9", { pos: [0.215, 0.04 - i * 0.04, 0.106] }));
    }
    return merge(p);
  }, []);
  return <mesh geometry={geo} material={FLAT} position={position} />;
}

/** 点線（質問が 相手の 考えへ とどく）。from から to へ 小さい玉を ならべる。 */
function DottedArc({
  from,
  to,
  lift = 0.25,
}: {
  from: [number, number, number];
  to: [number, number, number];
  lift?: number;
}) {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = [];
    const n = 9;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      p.push(
        ball(0.018, "#f29b8f", [
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * lift,
          from[2] + (to[2] - from[2]) * t,
        ]),
      );
    }
    return merge(p);
  }, [from, to, lift]);
  return <mesh geometry={geo} material={FLAT} />;
}

/** 豆知識「聞かないと わからない」: 会議の机で、お客さん（山本社長）に 新しい社員が 手を上げて 聞く。 */
SHOTS["kikanai-to"] = {
  camera: { pos: [0, 1.2, 2.7], look: [0, 0.85, 0], fov: 40 },
  light: "room",
  scene: () => (
    <>
      <Prop url="home/coffee-table" position={[0, 0, 0]} scale={[1.2, 1.05, 1.3]} />
      <Prop url="office/seminar-chair" position={[-0.72, 0, 0]} rotationY={Math.PI / 2} />
      <Prop url="office/seminar-chair" position={[0.72, 0, 0]} rotationY={-Math.PI / 2} />
      <group position={[0.68, 0, 0]} rotation={[0, -Math.PI / 2 + 0.5, 0]}>
        <Chibi config={YAMAMOTO_LOOK} motion="sitting" seated expression="normal" />
      </group>
      <group position={[-0.68, 0, 0]} rotation={[0, Math.PI / 2 - 0.5, 0]}>
        <Chibi config={NEWBIE} motion="raise" seated expression="happy" />
      </group>
      <ThoughtBubble position={[0.45, 1.5, 0.1]} />
      <DottedArc from={[-0.45, 1.0, 0.35]} to={[0.05, 1.45, 0.2]} />
    </>
  ),
};

/** 山本社長の顔（セリフの枠・会話の所）。頭と肩。 */
SHOTS.yamamoto = {
  camera: { pos: [0, 0.84, 2.0], look: [0, 0.8, 0], fov: 30 },
  light: "day",
  bg: "#fdf6ea",
  scene: () => (
    <group rotation={[0, -0.3, 0]}>
      <Chibi config={YAMAMOTO_LOOK} phase={0.2} />
    </group>
  ),
};
