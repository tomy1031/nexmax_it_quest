import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/audio";
import { useGame, type AvatarConfig, type HairStyle } from "@/lib/store";
import { t, type UiKey } from "@/lib/t";
import { bottomOf } from "@/three/avatar-parts";
import { Chibi } from "@/three/Chibi";
import { FACE_ATLAS, faceCell, faceSheetUrl } from "@/three/face-parts";
import { RubyText } from "@/ui/RubyText";
import { IconCheck } from "@/ui/icons";

/**
 * キャラクターメイキング（着がえ）。r3f-ultimate-character-configurator の使い方（下に分類のタブ・色のパレット・
 * 選んだ所にカメラが寄る・おまかせ）をまねて作った。モデルは polyfork の人（スーツは男女の体型）。
 * 参考のリポジトリのモデルはライセンスの記載が無いので使わない（AGENTS.md 必ず守るルール9）。
 *
 * mode="suit": 入社式の日。スーツでないと決定できない（企画メモ「スーツ着用とあるので、着替えをする」）。
 */

type Tab =
  | "outfit"
  | "figure"
  | "height"
  | "skin"
  | "eyes"
  | "hair"
  | "hairStyle"
  | "glasses"
  | "suit"
  | "tie"
  | "shirt"
  | "coat"
  | "pants"
  | "accessory"
  | "bag"
  | "shoes";

const EYES: [AvatarConfig["eyes"], UiKey][] = [
  ["round", "avatar.eyes.round"],
  ["smile", "avatar.eyes.smile"],
  ["sparkle", "avatar.eyes.sparkle"],
  ["calm", "avatar.eyes.calm"],
  ["small", "avatar.eyes.small"],
];

const BASE = import.meta.env.BASE_URL;

const HAIR_STYLES: [HairStyle, UiKey][] = [
  ["model", "avatar.hs.model"],
  ["spiky", "avatar.hs.spiky"],
  ["side", "avatar.hs.side"],
  ["wavy", "avatar.hs.wavy"],
  ["curly", "avatar.hs.curly"],
  ["buzz", "avatar.hs.buzz"],
  ["center", "avatar.hs.center"],
  ["bob", "avatar.hs.bob"],
  ["long", "avatar.hs.long"],
  ["ponytail", "avatar.hs.ponytail"],
  ["twin", "avatar.hs.twin"],
  ["bun", "avatar.hs.bun"],
  ["halfup", "avatar.hs.halfup"],
  ["braid", "avatar.hs.braid"],
  ["twinbun", "avatar.hs.twinbun"],
];

const ACCESSORIES: [NonNullable<AvatarConfig["accessory"]>, UiKey][] = [
  ["none", "avatar.acc.none"],
  ["flower", "avatar.acc.flower"],
  ["ribbon", "avatar.acc.ribbon"],
];

const SKINS = ["#f1c9a5", "#e0ac83", "#c68e64", "#a8714a", "#8a5a3b", "#6b4430"];
// 髪の色は、参考の絵（codex_out/）のような明るめのこげ茶を多めに
const HAIRS = ["#2e211b", "#4a3326", "#5e4030", "#7a5236", "#9a7452", "#a3a3a3", "#2c3e70"];
const SUITS_OK = ["#1c1e24", "#232f52", "#3a3d45", "#5b616c"];
const SUITS_LOUD = ["#b8312f", "#e8e8e8", "#3f7f4f"];
const TIES = ["#1f3f7a", "#8a1c2b", "#2d5e3a", "#5a3e8a", "#c9a227", "#222222"];
const SHIRTS = ["#f4f6f8", "#dfefff", "#fff2f7"];
const COATS = ["#8a8f98", "#3b6ea5", "#9c3b3b", "#4e7d4e", "#d8c3a5", "#2b2b2b"];
const PANTS = ["#3a3d44", "#2a3550", "#6b5a45", "#20232a"];
const SHOES_SUIT = ["#24201f", "#4a2e20", "#2a2f3a"];
const SHOES_CASUAL = ["#f4f4f2", "#24201f", "#d94b4b", "#3b6ea5", "#e8c547"];

const LABEL: Record<Tab, UiKey> = {
  outfit: "avatar.outfit",
  figure: "avatar.figure",
  height: "avatar.height",
  skin: "avatar.skin",
  eyes: "avatar.eyes",
  hair: "avatar.hair",
  hairStyle: "avatar.hairStyle",
  glasses: "avatar.glasses",
  suit: "avatar.suitColor",
  tie: "avatar.tie",
  shirt: "avatar.shirt",
  coat: "avatar.coat",
  pants: "avatar.pants",
  accessory: "avatar.accessory",
  bag: "avatar.bag",
  shoes: "avatar.shoes",
};

/** タブごとのカメラの寄り（体の高さ・距離）。 */
const FOCUS: Record<Tab, { y: number; d: number }> = {
  outfit: { y: 0.62, d: 2.2 },
  figure: { y: 0.55, d: 2.2 },
  height: { y: 0.62, d: 2.4 },
  skin: { y: 0.9, d: 1.1 },
  eyes: { y: 0.86, d: 1.35 },
  hair: { y: 0.85, d: 1.8 },
  hairStyle: { y: 0.8, d: 2.0 },
  glasses: { y: 0.92, d: 1.0 },
  suit: { y: 0.6, d: 1.8 },
  tie: { y: 0.66, d: 1.3 },
  shirt: { y: 0.62, d: 1.3 },
  coat: { y: 0.6, d: 1.8 },
  pants: { y: 0.35, d: 1.6 },
  accessory: { y: 0.95, d: 1.6 },
  bag: { y: 0.6, d: 1.9 },
  shoes: { y: 0.12, d: 1.4 },
};

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

/** 体の形（男性・ズボン／女性・スカート／女性・ズボン）。 */
const FIGURES = [
  { label: "avatar.figureM", figure: "m", bottom: "pants" },
  { label: "avatar.figureF", figure: "f", bottom: "skirt" },
  { label: "avatar.figureFP", figure: "f", bottom: "pants" },
] as const satisfies readonly {
  label: UiKey;
  figure: AvatarConfig["figure"];
  bottom: "pants" | "skirt";
}[];

export function AvatarEditor({ mode, onDone }: { mode: "suit" | "free"; onDone: () => void }) {
  const avatar = useGame((s) => s.avatar);
  const setAvatar = useGame((s) => s.setAvatar);
  const [tab, setTab] = useState<Tab>("outfit");
  const [warn, setWarn] = useState<UiKey | null>(null);

  const tabs: Tab[] =
    avatar.outfit === "suit"
      ? [
          "outfit",
          "figure",
          "height",
          "skin",
          "eyes",
          "hairStyle",
          "hair",
          "accessory",
          "glasses",
          "suit",
          "tie",
          "shirt",
          "shoes",
        ]
      : [
          "outfit",
          "figure",
          "height",
          "skin",
          "eyes",
          "hairStyle",
          "hair",
          "accessory",
          "glasses",
          "coat",
          "pants",
          "shoes",
          "bag",
        ];

  const set = (a: Partial<AvatarConfig>) => {
    playSfx("click");
    setWarn(null);
    setAvatar(a);
    if (a.suit && SUITS_LOUD.includes(a.suit)) setWarn("avatar.loudSuit");
  };

  const random = () => {
    const fig = pick<(typeof FIGURES)[number]>([...FIGURES]);
    set({
      figure: fig.figure,
      bottom: fig.bottom,
      hairStyle: pick<HairStyle>(HAIR_STYLES.map(([hs]) => hs)),
      height: 155 + Math.round(Math.random() * 30),
      eyes: pick<AvatarConfig["eyes"]>(EYES.map(([e]) => e)),
      skin: pick(SKINS),
      hair: pick(HAIRS),
      suit: pick(SUITS_OK),
      tie: pick(TIES),
      shirt: pick(SHIRTS),
      coat: pick(COATS),
      pants: pick(PANTS),
      accessory: pick<NonNullable<AvatarConfig["accessory"]>>(["none", "none", "flower", "ribbon"]),
    });
  };

  const finish = () => {
    if (mode === "suit" && avatar.outfit !== "suit") {
      setWarn("avatar.needSuit");
      setTab("outfit");
      playSfx("ng");
      return;
    }
    playSfx("ok");
    onDone();
  };

  const swatches = (values: string[], key: keyof AvatarConfig) => (
    <div className="flex flex-wrap gap-3">
      {values.map((c) => (
        <button
          key={c}
          type="button"
          className={`h-12 w-12 rounded-full border-4 shadow transition ${avatar[key] === c ? "border-cyan scale-110" : "border-white"}`}
          style={{ background: c }}
          onClick={() => set({ [key]: c })}
          aria-label={c}
        />
      ))}
    </div>
  );

  return (
    <div
      className="glass pop flex w-full max-w-5xl flex-col gap-3 overflow-hidden rounded-3xl p-4 md:flex-row"
      data-testid="avatar-editor"
    >
      <div className="relative h-72 shrink-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_30%,#3a7bff_0%,#0a2a6b_70%)] md:h-auto md:w-[44%]">
        <Canvas
          camera={{ fov: 35, position: [0, 1.2, 3] }}
          dpr={[1, 1.5]}
          gl={{ toneMapping: THREE.NoToneMapping }}
        >
          <hemisphereLight args={["#ffffff", "#556677", 1.8]} />
          <directionalLight position={[2, 4, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <Turntable back={tab === "bag"}>
              <Chibi config={avatar} />
            </Turntable>
          </Suspense>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[0.7, 48]} />
            <meshBasicMaterial color="#38e1ff" transparent opacity={0.35} toneMapped={false} />
          </mesh>
          <FocusCamera tab={tab} />
        </Canvas>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-2xl font-extrabold">
            <RubyText text={t("avatar.title")} />
          </h2>
          <button type="button" className="btn btn-ghost" onClick={random}>
            <RubyText text={t("avatar.random")} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tb) => (
            <button
              key={tb}
              type="button"
              className={`rounded-xl px-3 py-2 font-extrabold transition ${tab === tb ? "bg-[#0a63d6] text-white" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setTab(tb)}
              data-testid={`avatar-tab-${tb}`}
            >
              <RubyText
                text={t(tb === "tie" && avatar.figure === "f" ? "avatar.ribbon" : LABEL[tb])}
              />
            </button>
          ))}
        </div>
        <div className="min-h-32 rounded-2xl bg-white/5 p-4">
          {tab === "outfit" && (
            <div className="flex flex-wrap gap-3">
              {(["suit", "casual"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`btn ${avatar.outfit === o ? "btn-primary" : "btn-ghost"} text-lg`}
                  onClick={() => set({ outfit: o })}
                  data-testid={`avatar-outfit-${o}`}
                >
                  {avatar.outfit === o && <IconCheck className="h-5 w-5" />}
                  <RubyText text={t(o === "suit" ? "avatar.suit" : "avatar.casual")} />
                </button>
              ))}
            </div>
          )}
          {tab === "figure" && (
            <div className="flex flex-wrap gap-3">
              {FIGURES.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={`btn ${avatar.figure === f.figure && bottomOf(avatar) === f.bottom ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ figure: f.figure, bottom: f.bottom })}
                >
                  <RubyText text={t(f.label)} />
                </button>
              ))}
            </div>
          )}
          {tab === "height" && (
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="range"
                min={150}
                max={190}
                step={1}
                value={avatar.height}
                onChange={(e) => set({ height: Number(e.target.value) })}
                className="w-64 accent-cyan-400"
                data-testid="avatar-height"
              />
              <span className="text-2xl font-extrabold">{avatar.height} cm</span>
            </div>
          )}
          {tab === "eyes" && (
            <div className="flex flex-wrap gap-2">
              {EYES.map(([e, key]) => (
                <button
                  key={e}
                  type="button"
                  className={`flex w-[92px] flex-col items-center gap-1 rounded-xl border-2 px-1 py-1.5 text-[12px] font-extrabold whitespace-nowrap transition ${avatar.eyes === e ? "border-white bg-[#0a63d6] text-white" : "border-transparent bg-white/10 hover:bg-white/20"}`}
                  onClick={() => set({ eyes: e })}
                  data-testid={`avatar-eyes-${e}`}
                >
                  <EyePair style={e} skin={avatar.skin} />
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}
          {tab === "hairStyle" && (
            <div className="flex flex-wrap gap-2">
              {HAIR_STYLES.map(([hs, key]) => (
                <button
                  key={hs}
                  type="button"
                  className={`flex w-[92px] flex-col items-center rounded-xl border-2 px-1 pb-1.5 text-[12px] font-extrabold whitespace-nowrap transition ${avatar.hairStyle === hs ? "border-white bg-[#0a63d6] text-white" : "border-transparent bg-white/10 hover:bg-white/20"}`}
                  onClick={() => set({ hairStyle: hs })}
                  data-testid={`avatar-hair-${hs}`}
                >
                  {/* 髪型の絵（tools/blender/render_hair_icons.py で作る） */}
                  <img
                    src={`${BASE}img/hair/${hs}.png`}
                    alt=""
                    className="h-16 w-16"
                    draggable={false}
                  />
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}
          {tab === "glasses" && (
            <div className="flex flex-wrap gap-3">
              {([true, false] as const).map((g) => (
                <button
                  key={String(g)}
                  type="button"
                  className={`btn ${avatar.glasses === g ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ glasses: g })}
                >
                  <RubyText text={t(g ? "settings.on" : "settings.off")} />
                </button>
              ))}
            </div>
          )}
          {tab === "accessory" && (
            <div className="flex flex-wrap gap-3">
              {ACCESSORIES.map(([a, key]) => (
                <button
                  key={a}
                  type="button"
                  className={`btn ${(avatar.accessory ?? "none") === a ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ accessory: a })}
                  data-testid={`avatar-acc-${a}`}
                >
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}
          {tab === "bag" && (
            <div className="flex flex-wrap gap-3">
              {([true, false] as const).map((b) => (
                <button
                  key={String(b)}
                  type="button"
                  className={`btn ${(avatar.bag ?? true) === b ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ bag: b })}
                >
                  <RubyText text={t(b ? "settings.on" : "settings.off")} />
                </button>
              ))}
            </div>
          )}
          {tab === "skin" && swatches(SKINS, "skin")}
          {tab === "hair" && swatches(HAIRS, "hair")}
          {tab === "suit" && swatches([...SUITS_OK, ...SUITS_LOUD], "suit")}
          {tab === "tie" && swatches(TIES, "tie")}
          {tab === "shirt" && swatches(SHIRTS, "shirt")}
          {tab === "coat" && swatches(COATS, "coat")}
          {tab === "pants" && swatches(PANTS, "pants")}
          {tab === "shoes" &&
            swatches(avatar.outfit === "suit" ? SHOES_SUIT : SHOES_CASUAL, "shoes")}
        </div>
        {warn && (
          <p
            className="pop bg-sun text-ink rounded-2xl px-4 py-3 text-lg font-extrabold"
            data-testid="avatar-warn"
          >
            <RubyText text={t(warn)} />
          </p>
        )}
        <div className="mt-auto flex justify-end">
          <button
            type="button"
            className="btn btn-primary px-8 text-lg"
            onClick={finish}
            data-testid="avatar-done"
          >
            <RubyText text={t("avatar.done")} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 見本の台。ふだんは正面を中心に左右へゆっくりゆれる（いつも顔が見える）。
 * ドラッグで回した向きは、はなすと ゆっくり正面へもどる。リュックのタブでは背中を見せる。
 */
function Turntable({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const drag = useRef<{ on: boolean; x: number; offset: number }>({ on: false, x: 0, offset: 0 });
  useFrame((s, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!drag.current.on) drag.current.offset *= 1 - Math.min(1, dt * 0.8);
    const base = (back ? Math.PI * 0.85 : 0) + Math.sin(s.clock.elapsedTime * 0.6) * 0.45;
    const want = base + drag.current.offset;
    g.rotation.y += (want - g.rotation.y) * Math.min(1, dt * 4);
  });
  return (
    <group
      ref={ref}
      onPointerDown={(e) => {
        drag.current.on = true;
        drag.current.x = e.clientX;
      }}
      onPointerUp={() => (drag.current.on = false)}
      onPointerLeave={() => (drag.current.on = false)}
      onPointerMove={(e) => {
        if (!drag.current.on) return;
        const dx = e.clientX - drag.current.x;
        drag.current.x = e.clientX;
        drag.current.offset += dx * 0.01;
      }}
    >
      {children}
    </group>
  );
}

function FocusCamera({ tab }: { tab: Tab }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1, 0));
  useFrame((_, dt) => {
    const f = FOCUS[tab];
    const k = Math.min(1, dt * 4);
    camera.position.lerp(new THREE.Vector3(0, f.y + 0.1, f.d), k);
    look.current.lerp(new THREE.Vector3(0, f.y, 0), k);
    camera.lookAt(look.current);
  });
  return null;
}

/** 目の形の絵（顔のパーツの表 face_eyes から。見る人の左の目と、反転した右の目）。 */
function EyePair({ style, skin }: { style: AvatarConfig["eyes"]; skin: string }) {
  const row = { round: 0, smile: 0, sparkle: 1, calm: 2, small: 3 }[style] ?? 0;
  const col = style === "smile" ? 2 : 0;
  const box = faceCell("face_eyes", col, row);
  const ref = faceCell("face_eyes", 0, 0);
  const sheet = FACE_ATLAS.face_eyes;
  if (!box || !ref || !sheet) return null;
  // まるい目の高さを 30px に。形ごとの大きさは、顔に貼るときと同じく面積で近づける（chibi.ts の paintFaceParts）
  const rb = faceCell("face_eyes", 0, row) ?? ref;
  const k = (30 / ref[3]) * (Math.sqrt(ref[2] * ref[3]) / Math.sqrt(rb[2] * rb[3])) ** 0.7;
  const eye = (flip: boolean) => (
    <span
      className="block"
      style={{
        width: box[2] * k,
        height: box[3] * k,
        backgroundImage: `url(${faceSheetUrl("face_eyes")})`,
        backgroundSize: `${sheet.w * k}px ${sheet.h * k}px`,
        backgroundPosition: `${-box[0] * k}px ${-box[1] * k}px`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
  return (
    <span
      className="flex h-11 w-[76px] items-center justify-center gap-2 rounded-lg"
      style={{ background: skin }}
    >
      {eye(false)}
      {eye(true)}
    </span>
  );
}
