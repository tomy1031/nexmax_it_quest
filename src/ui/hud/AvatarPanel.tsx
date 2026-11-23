import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/audio";
import { useGame, type AvatarConfig, type HairStyle, type Kigurumi } from "@/lib/store";
import { t, type UiKey } from "@/lib/t";
import { bottomOf, shoeTypeOf } from "@/three/avatar-parts";
import { Chibi } from "@/three/Chibi";
import { EYE_SLOTS, FACE_ATLAS, faceCell, faceSheetUrl } from "@/three/face-parts";
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
  | "kigurumi"
  | "pajama"
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
  ["gloss", "avatar.eyes.gloss"],
  ["flick", "avatar.eyes.flick"],
  ["twinkle", "avatar.eyes.twinkle"],
  ["heart", "avatar.eyes.heart"],
  ["egg", "avatar.eyes.egg"],
  ["lashes", "avatar.eyes.lashes"],
  ["roly", "avatar.eyes.roly"],
  ["dot", "avatar.eyes.dot"],
  ["sharp", "avatar.eyes.sharp"],
  ["bright", "avatar.eyes.bright"],
  ["star", "avatar.eyes.star"],
  ["sleepy", "avatar.eyes.sleepy"],
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
  ["shichisan", "avatar.hs.shichisan"],
  ["allback", "avatar.hs.allback"],
  ["twoblock", "avatar.hs.twoblock"],
  ["mohawk", "avatar.hs.mohawk"],
  ["afro", "avatar.hs.afro"],
  ["sidetail", "avatar.hs.sidetail"],
  ["lowpony", "avatar.hs.lowpony"],
  ["hime", "avatar.hs.hime"],
  ["longwave", "avatar.hs.longwave"],
  ["osage", "avatar.hs.osage"],
  ["swirl", "avatar.hs.swirl"],
  ["messy", "avatar.hs.messy"],
  ["topknot", "avatar.hs.topknot"],
  ["mash", "avatar.hs.mash"],
  ["wolf", "avatar.hs.wolf"],
  ["tucked", "avatar.hs.tucked"],
  ["pixie", "avatar.hs.pixie"],
  ["lob", "avatar.hs.lob"],
  ["budtail", "avatar.hs.budtail"],
  ["crown", "avatar.hs.crown"],
  ["perm", "avatar.hs.perm"],
  ["lowpuff", "avatar.hs.lowpuff"],
  ["clipbob", "avatar.hs.clipbob"],
  ["headband", "avatar.hs.headband"],
];

const ACCESSORIES: [NonNullable<AvatarConfig["accessory"]>, UiKey][] = [
  ["none", "avatar.acc.none"],
  ["flower", "avatar.acc.flower"],
  ["ribbon", "avatar.acc.ribbon"],
];

const SKINS = [
  "#fbe0c8",
  "#f1c9a5",
  "#e0ac83",
  "#d49a6a",
  "#c68e64",
  "#b98258",
  "#a8714a",
  "#8a5a3b",
  "#6b4430",
  "#56352a",
];
// 髪の色は、参考の絵（codex_out/）のような明るめのこげ茶を多めに
/** 髪の色（tomy さん 2026-11-23「髪の色を選べるようにして」）。黒・茶・金・灰色・白と、パステルや はっきりした色。 */
const HAIRS = [
  "#1f1a19",
  "#2e211b",
  "#4a3326",
  "#5e4030",
  "#7a5236",
  "#9a7452",
  "#c9a46c",
  "#e8d29a",
  "#a3a3a3",
  "#ece8e2",
  "#9c3d2c",
  "#e07a5f",
  "#f2a0b8",
  "#9b7fd1",
  "#5b8fd6",
  "#2c3e70",
  "#6fbf9a",
  "#3b2a24",
  "#b07a4a",
  "#f0c36a",
  "#c43c5a",
  "#7fc8e8",
];
const SUITS_OK = ["#1c1e24", "#232f52", "#3a3d45", "#5b616c"];
const SUITS_LOUD = ["#b8312f", "#e8e8e8", "#3f7f4f"];
const TIES = [
  "#1f3f7a",
  "#8a1c2b",
  "#2d5e3a",
  "#5a3e8a",
  "#c9a227",
  "#222222",
  "#e85c7a",
  "#3a8fb7",
  "#d9773b",
];
const SHIRTS = ["#f4f6f8", "#dfefff", "#fff2f7", "#e8f6ea", "#fdf3dc", "#ece6f7"];
const COATS = [
  "#8a8f98",
  "#3b6ea5",
  "#9c3b3b",
  "#4e7d4e",
  "#d8c3a5",
  "#2b2b2b",
  "#f4c7c3",
  "#cfe3c4",
  "#c7dbef",
  "#e6d8f2",
  "#f6e3a8",
  "#ffffff",
  "#7a5a8c",
  "#e8965a",
];
const PANTS = [
  "#3a3d44",
  "#2a3550",
  "#6b5a45",
  "#20232a",
  "#4a6a8a",
  "#c9b79c",
  "#5a6b4a",
  "#8a3a3a",
  "#f2efe8",
];
const SHOES_SUIT = ["#24201f", "#4a2e20", "#2a2f3a", "#6b4430", "#8a5a3b"];
const SHOES_CASUAL = [
  "#f4f4f2",
  "#24201f",
  "#d94b4b",
  "#3b6ea5",
  "#e8c547",
  "#f6a6b8",
  "#7fc8a0",
  "#8a5a3b",
];

const LABEL: Record<Tab, UiKey> = {
  outfit: "avatar.outfit",
  kigurumi: "avatar.kigurumiKind",
  pajama: "avatar.pajamaColor",
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
  kigurumi: { y: 0.7, d: 2.0 },
  pajama: { y: 0.6, d: 1.9 },
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

/** 寝巻きの色（パステル）。 */
const PAJAMAS = ["#a9cdeb", "#f4c7c3", "#cfe3c4", "#e6d8f2", "#f6e3a8", "#f2f2f2", "#9fb8d8"];

/** くつの形。 */
const SHOE_TYPES: [NonNullable<AvatarConfig["shoeType"]>, UiKey][] = [
  ["leather", "avatar.shoe.leather"],
  ["sneaker", "avatar.shoe.sneaker"],
  ["sandal", "avatar.shoe.sandal"],
];

const OUTFIT_LABEL: Record<AvatarConfig["outfit"], UiKey> = {
  suit: "avatar.suit",
  casual: "avatar.casual",
  kigurumi: "avatar.kigurumi",
  pajama: "avatar.pajama",
};

/** 着ぐるみの どうぶつ。 */
const KIGURUMI: [Kigurumi, UiKey][] = [
  ["bear", "avatar.kig.bear"],
  ["cat", "avatar.kig.cat"],
  ["rabbit", "avatar.kig.rabbit"],
];

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
    avatar.outfit === "kigurumi"
      ? ["outfit", "kigurumi", "figure", "height", "skin", "eyes", "glasses"]
      : avatar.outfit === "pajama"
        ? ["outfit", "pajama", "figure", "height", "skin", "eyes", "hairStyle", "hair", "glasses"]
        : avatar.outfit === "suit"
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

  /** 色の見本（多めに ならべる）と「ほかの 色を えらぶ」（自由に えらべる。tomy さん「カラー多い方がいい」2026-11-23）。 */
  const swatches = (values: string[], key: keyof AvatarConfig, custom = true) => (
    <div className="flex flex-col gap-3">
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
      {custom && (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-extrabold hover:bg-white/20">
          <input
            type="color"
            value={String(avatar[key] ?? "#888888")}
            onChange={(e) => set({ [key]: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
            data-testid={`avatar-${key}-custom`}
          />
          <RubyText text={t("avatar.colorCustom")} />
        </label>
      )}
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
              {(["suit", "casual", "kigurumi", "pajama"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`btn ${avatar.outfit === o ? "btn-primary" : "btn-ghost"} text-lg`}
                  onClick={() => set({ outfit: o })}
                  data-testid={`avatar-outfit-${o}`}
                >
                  {avatar.outfit === o && <IconCheck className="h-5 w-5" />}
                  <RubyText text={t(OUTFIT_LABEL[o])} />
                </button>
              ))}
            </div>
          )}
          {tab === "kigurumi" && (
            <div className="flex flex-wrap gap-3">
              {KIGURUMI.map(([k, key]) => (
                <button
                  key={k}
                  type="button"
                  className={`btn ${(avatar.kigurumi ?? "bear") === k ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ kigurumi: k })}
                  data-testid={`avatar-kigurumi-${k}`}
                >
                  <RubyText text={t(key)} />
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
            <div className="flex max-h-[318px] flex-wrap gap-2 overflow-y-auto pr-1">
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
            // 髪型が多いので、3だんより多い分は中だけ動かして見る
            <div className="flex max-h-[318px] flex-wrap gap-2 overflow-y-auto pr-1">
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
          {/* はだは 見本だけ（自由な色にしない） */}
          {tab === "skin" && swatches(SKINS, "skin", false)}
          {tab === "hair" && swatches(HAIRS, "hair")}
          {tab === "pajama" && swatches(PAJAMAS, "pajama")}
          {/* スーツは 見本だけ（入社式に安心な色を教えるため。自由な色にしない） */}
          {tab === "suit" && swatches([...SUITS_OK, ...SUITS_LOUD], "suit", false)}
          {tab === "tie" && swatches(TIES, "tie")}
          {tab === "shirt" && swatches(SHIRTS, "shirt")}
          {tab === "coat" && swatches(COATS, "coat")}
          {tab === "pants" && swatches(PANTS, "pants")}
          {tab === "shoes" && (
            <div className="flex flex-col gap-3">
              {/* くつの形（革ぐつ・スニーカー・サンダル） */}
              <div className="flex flex-wrap gap-2">
                {SHOE_TYPES.map(([st, key]) => (
                  <button
                    key={st}
                    type="button"
                    className={`btn ${shoeTypeOf(avatar) === st ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => {
                      set({ shoeType: st });
                      if (avatar.outfit === "suit" && st !== "leather") setWarn("avatar.shoeSuit");
                    }}
                    data-testid={`avatar-shoe-${st}`}
                  >
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              {swatches(shoeTypeOf(avatar) === "leather" ? SHOES_SUIT : SHOES_CASUAL, "shoes")}
            </div>
          )}
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
  const [name, row] = EYE_SLOTS[style] ?? ["face_eyes", 0];
  const col = style === "smile" ? 2 : 0;
  const box = faceCell(name, col, row);
  const ref = faceCell("face_eyes", 0, 0);
  const sheet = FACE_ATLAS[name];
  if (!box || !ref || !sheet) return null;
  // まるい目の高さを 30px に。形ごとの大きさは、顔に貼るときと同じく面積で近づける（chibi.ts の paintFaceParts）
  const rb = faceCell(name, 0, row) ?? ref;
  const k = (30 / ref[3]) * (Math.sqrt(ref[2] * ref[3]) / Math.sqrt(rb[2] * rb[3])) ** 0.7;
  const eye = (flip: boolean) => (
    <span
      className="block"
      style={{
        width: box[2] * k,
        height: box[3] * k,
        backgroundImage: `url(${faceSheetUrl(name)})`,
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
