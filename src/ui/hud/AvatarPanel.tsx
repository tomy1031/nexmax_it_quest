import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/audio";
import {
  useGame,
  type AccessoryStyle,
  type AvatarConfig,
  type BagStyle,
  type CasualStyle,
  type CheekStyle,
  type EyebrowStyle,
  type FaceMark,
  type GlassesStyle,
  type HairStyle,
  type HatStyle,
  type Kigurumi,
  type MouthStyle,
  type NeckwearStyle,
  type NoseStyle,
} from "@/lib/store";
import { t, type UiKey } from "@/lib/t";
import {
  bagStyleOf,
  bottomOf,
  casualStyleOf,
  cheekOf,
  glassesStyleOf,
  shoeTypeOf,
} from "@/three/avatar-parts";
import {
  FREE_PRESETS,
  HAIR_GROUPS,
  SUIT_PRESETS,
  buildRandomAvatar,
  type AvatarPreset,
  type HairGroup,
} from "@/three/avatar-presets";
import { Chibi, type ChibiMotion } from "@/three/Chibi";
import type { Expression } from "@/three/chibi";
import {
  CHEEK_COLS,
  EYEBROW_COLS,
  EYE_SLOTS,
  FACE_ATLAS,
  MOUTH_SLOTS,
  NOSE_COLS,
  faceCell,
  faceSheetUrl,
} from "@/three/face-parts";
import { RubyText } from "@/ui/RubyText";
import { IconCheck } from "@/ui/icons";

/**
 * キャラクターメイキング（アバターづくり）。
 * どうぶつの森のような、明るくパステルな 着がえスタジオと、目・まゆ・鼻・口・ほっぺ・ぼうし・
 * めがね・クロマー・着ぐるみ・バッグ・ポーズ確認で、自分だけの個性を 楽しく作れる。
 *
 * mode="suit": 入社式の日。スーツでないと決定できない（企画メモ「スーツ着用とあるので、着替えをする」）。
 */

type Category = "presets" | "face" | "hair" | "outfit" | "items";

type SubTab =
  | "presets"
  | "skin"
  | "eyes"
  | "eyebrow"
  | "nose"
  | "mouth"
  | "cheek"
  | "hairStyle"
  | "hair"
  | "outfit"
  | "figure"
  | "colors"
  | "shoes"
  | "bag"
  | "hat"
  | "glasses"
  | "neckwear"
  | "accessory";

type BackdropId = "sakura" | "mint" | "sunset" | "cyber";

const BACKDROPS: Record<
  BackdropId,
  { label: UiKey; css: string; dot: string; mat: string; ring: string; rim: string }
> = {
  sakura: {
    label: "avatar.bg.sakura",
    css: "radial-gradient(circle at 50% 24%, #fff8fa 0%, #ffe1ee 46%, #d9eeff 100%)",
    dot: "#ffb7d5",
    mat: "#f7e3c4",
    ring: "#ff9fc5",
    rim: "#ffd6ea",
  },
  mint: {
    label: "avatar.bg.mint",
    css: "radial-gradient(circle at 50% 24%, #fffef5 0%, #dff7ea 50%, #cde9f7 100%)",
    dot: "#7ddbb0",
    mat: "#f0d8b2",
    ring: "#67c995",
    rim: "#d8ffea",
  },
  sunset: {
    label: "avatar.bg.sunset",
    css: "radial-gradient(circle at 50% 24%, #fff5df 0%, #ffd5b8 48%, #d9c8f2 100%)",
    dot: "#ffb07c",
    mat: "#f2d2a9",
    ring: "#ff9870",
    rim: "#ffe0b8",
  },
  cyber: {
    label: "avatar.bg.cyber",
    css: "radial-gradient(circle at 50% 28%, #3a7bff 0%, #0d327d 62%, #061842 100%)",
    dot: "#38e1ff",
    mat: "#1a4a9e",
    ring: "#38e1ff",
    rim: "#8ae8ff",
  },
};

const POSES: { id: ChibiMotion; label: UiKey; expr?: Expression }[] = [
  { id: "idle", label: "avatar.pose.idle" },
  { id: "wave", label: "avatar.pose.wave", expr: "happy" },
  { id: "cheer", label: "avatar.pose.cheer", expr: "happy" },
  { id: "walk", label: "avatar.pose.walk" },
  { id: "bow", label: "avatar.pose.bow" },
  { id: "twirl", label: "avatar.pose.twirl", expr: "happy" },
];

const EYES: [AvatarConfig["eyes"], UiKey][] = [
  ["round", "avatar.eyes.round"],
  ["sparkle", "avatar.eyes.sparkle"],
  ["bright", "avatar.eyes.bright"],
  ["jewel", "avatar.eyes.jewel"],
  ["droopy", "avatar.eyes.droopy"],
  ["cat", "avatar.eyes.cat"],
  ["sharp", "avatar.eyes.sharp"],
  ["cool", "avatar.eyes.cool"],
  ["wing", "avatar.eyes.wing"],
  ["teary", "avatar.eyes.teary"],
  ["heart", "avatar.eyes.heart"],
  ["star", "avatar.eyes.star"],
  ["starry", "avatar.eyes.starry"],
  ["jito", "avatar.eyes.jito"],
  ["wide", "avatar.eyes.wide"],
  ["wink", "avatar.eyes.wink"],
  ["smile", "avatar.eyes.smile"],
  ["laugh", "avatar.eyes.laugh"],
  ["sleepy", "avatar.eyes.sleepy"],
  ["peace", "avatar.eyes.peace"],
];

const EYE_COLORS: string[] = [
  "#2d1c16",
  "#5c3524",
  "#9a5a26",
  "#c48d36",
  "#3b84c8",
  "#2c9994",
  "#3d9b5c",
  "#8463bd",
  "#d46691",
  "#b83c4c",
];

const EYEBROWS: [EyebrowStyle, UiKey][] = [
  ["soft", "avatar.brow.soft"],
  ["thick", "avatar.brow.thick"],
  ["straight", "avatar.brow.straight"],
  ["gentle", "avatar.brow.gentle"],
  ["arch", "avatar.brow.arch"],
  ["sharp", "avatar.brow.sharp"],
];

const NOSES: [NoseStyle, UiKey][] = [
  ["dot", "avatar.nose.dot"],
  ["curve", "avatar.nose.curve"],
  ["triangle", "avatar.nose.triangle"],
  ["button", "avatar.nose.button"],
  ["dots", "avatar.nose.dots"],
  ["side", "avatar.nose.side"],
];

const MOUTHS: [MouthStyle, UiKey][] = [
  ["smile", "avatar.mouth.smile"],
  ["open", "avatar.mouth.open"],
  ["happy", "avatar.mouth.happy"],
  ["cat", "avatar.mouth.cat"],
  ["flat", "avatar.mouth.flat"],
  ["pout", "avatar.mouth.pout"],
  ["grin", "avatar.mouth.grin"],
  ["soft", "avatar.mouth.soft"],
];

const CHEEKS: [CheekStyle, UiKey][] = [
  ["none", "avatar.cheek.none"],
  ["round", "avatar.cheek.round"],
  ["oval", "avatar.cheek.oval"],
  ["lines", "avatar.cheek.lines"],
  ["freckles", "avatar.cheek.freckles"],
  ["gloss", "avatar.cheek.gloss"],
  ["heart", "avatar.cheek.heart"],
];

const FACE_MARKS: [FaceMark, UiKey][] = [
  ["none", "avatar.mark.none"],
  ["bandaid", "avatar.mark.bandaid"],
  ["star", "avatar.mark.star"],
  ["mole", "avatar.mark.mole"],
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

const HATS: [HatStyle, UiKey][] = [
  ["none", "avatar.hat.none"],
  ["cap", "avatar.hat.cap"],
  ["beanie", "avatar.hat.beanie"],
  ["beret", "avatar.hat.beret"],
  ["bucket", "avatar.hat.bucket"],
  ["headphones", "avatar.hat.headphones"],
  ["catears", "avatar.hat.catears"],
  ["crown", "avatar.hat.crown"],
  ["flowerCrown", "avatar.hat.flowerCrown"],
];

const GLASSES_LIST: [GlassesStyle, UiKey][] = [
  ["none", "avatar.gl.none"],
  ["round", "avatar.gl.round"],
  ["square", "avatar.gl.square"],
  ["sunglasses", "avatar.gl.sunglasses"],
  ["star", "avatar.gl.star"],
  ["visor", "avatar.gl.visor"],
];

const NECKWEARS: [NeckwearStyle, UiKey][] = [
  ["none", "avatar.neck.none"],
  ["krama", "avatar.neck.krama"],
  ["scarf", "avatar.neck.scarf"],
  ["bowtie", "avatar.neck.bowtie"],
  ["lanyard", "avatar.neck.lanyard"],
];

const ACCESSORIES: [AccessoryStyle, UiKey][] = [
  ["none", "avatar.acc.none"],
  ["flower", "avatar.acc.flower"],
  ["ribbon", "avatar.acc.ribbon"],
  ["starClip", "avatar.acc.starClip"],
  ["earrings", "avatar.acc.earrings"],
  ["sprout", "avatar.acc.sprout"],
];

const BAGS: [BagStyle, UiKey][] = [
  ["none", "avatar.bag.none"],
  ["backpack", "avatar.bag.backpack"],
  ["bearBag", "avatar.bag.bearBag"],
  ["wings", "avatar.bag.wings"],
  ["laptopBag", "avatar.bag.laptopBag"],
];

const CASUAL_STYLES: [CasualStyle, UiKey][] = [
  ["hoodie", "avatar.cs.hoodie"],
  ["cardigan", "avatar.cs.cardigan"],
  ["tshirt", "avatar.cs.tshirt"],
  ["jacket", "avatar.cs.jacket"],
];

const KIGURUMI: [Kigurumi, UiKey][] = [
  ["bear", "avatar.kig.bear"],
  ["cat", "avatar.kig.cat"],
  ["rabbit", "avatar.kig.rabbit"],
  ["panda", "avatar.kig.panda"],
  ["frog", "avatar.kig.frog"],
  ["shiba", "avatar.kig.shiba"],
];

const SKINS = [
  "#fff0e2",
  "#fde5d0",
  "#fae0c8",
  "#f5d5b8",
  "#f0c9a6",
  "#e8bc96",
  "#ddb086",
  "#d19e72",
  "#c28c62",
  "#ac7750",
  "#8d5d3e",
  "#6d4631",
];

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
const PAJAMAS = ["#a9cdeb", "#f4c7c3", "#cfe3c4", "#e6d8f2", "#f6e3a8", "#f2f2f2", "#9fb8d8"];
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
const ITEM_COLORS = [
  "#c83e4d",
  "#3b6ea5",
  "#2c3e70",
  "#2a2d35",
  "#e8965a",
  "#f4c7c3",
  "#6fbf9a",
  "#9b7fd1",
  "#f0c36a",
  "#ffffff",
  "#8a5a3b",
];

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

const FIGURES = [
  { label: "avatar.figureM", figure: "m", bottom: "pants" },
  { label: "avatar.figureF", figure: "f", bottom: "skirt" },
  { label: "avatar.figureFP", figure: "f", bottom: "pants" },
] as const satisfies readonly {
  label: UiKey;
  figure: AvatarConfig["figure"];
  bottom: "pants" | "skirt";
}[];

const CATEGORIES: { id: Category; label: UiKey }[] = [
  { id: "presets", label: "avatar.cat.presets" },
  { id: "face", label: "avatar.cat.face" },
  { id: "hair", label: "avatar.cat.hair" },
  { id: "outfit", label: "avatar.cat.outfit" },
  { id: "items", label: "avatar.cat.items" },
];

const SUB_TABS: Record<Category, { id: SubTab; label: UiKey }[]> = {
  presets: [{ id: "presets", label: "avatar.cat.presets" }],
  face: [
    { id: "skin", label: "avatar.skin" },
    { id: "eyes", label: "avatar.eyes" },
    { id: "eyebrow", label: "avatar.eyebrow" },
    { id: "nose", label: "avatar.nose" },
    { id: "mouth", label: "avatar.mouth" },
    { id: "cheek", label: "avatar.blush" },
  ],
  hair: [
    { id: "hairStyle", label: "avatar.hairStyle" },
    { id: "hair", label: "avatar.hair" },
  ],
  outfit: [
    { id: "outfit", label: "avatar.outfit" },
    { id: "figure", label: "avatar.figure" },
    { id: "colors", label: "avatar.colors" },
    { id: "shoes", label: "avatar.shoes" },
    { id: "bag", label: "avatar.bag" },
  ],
  items: [
    { id: "hat", label: "avatar.hat" },
    { id: "glasses", label: "avatar.glasses" },
    { id: "neckwear", label: "avatar.neckwear" },
    { id: "accessory", label: "avatar.accessory" },
  ],
};

/** サブタブごとの カメラの 寄り（体の高さ・距離）。 */
const FOCUS: Record<SubTab, { y: number; d: number }> = {
  presets: { y: 0.67, d: 2.75 },
  skin: { y: 0.88, d: 1.56 },
  eyes: { y: 0.87, d: 1.5 },
  eyebrow: { y: 0.9, d: 1.5 },
  nose: { y: 0.85, d: 1.5 },
  mouth: { y: 0.82, d: 1.5 },
  cheek: { y: 0.85, d: 1.52 },
  hairStyle: { y: 0.9, d: 1.95 },
  hair: { y: 0.9, d: 1.92 },
  outfit: { y: 0.67, d: 2.72 },
  figure: { y: 0.66, d: 2.8 },
  colors: { y: 0.64, d: 2.55 },
  shoes: { y: 0.22, d: 1.65 },
  bag: { y: 0.62, d: 2.3 },
  hat: { y: 0.97, d: 1.88 },
  glasses: { y: 0.87, d: 1.52 },
  neckwear: { y: 0.66, d: 1.72 },
  accessory: { y: 0.93, d: 1.76 },
};

export function AvatarEditor({ mode, onDone }: { mode: "suit" | "free"; onDone: () => void }) {
  const avatar = useGame((s) => s.avatar);
  const nickname = useGame((s) => s.profile.nickname);
  const setAvatar = useGame((s) => s.setAvatar);

  // 入社式（mode="suit"）は 服タブから 開く（e2e と 流れに 合わせる）。自由着がえは おすすめから！
  const [cat, setCat] = useState<Category>(mode === "suit" ? "outfit" : "presets");
  const [sub, setSub] = useState<SubTab>(mode === "suit" ? "outfit" : "presets");
  const [hairGroup, setHairGroup] = useState<HairGroup>("all");
  const [backdrop, setBackdrop] = useState<BackdropId>("sakura");
  const [pose, setPose] = useState<ChibiMotion>("idle");
  const [viewMode, setViewMode] = useState<"auto" | "face" | "full">("auto");
  const [yawTarget, setYawTarget] = useState<number>(0);
  const [sparkleTick, setSparkleTick] = useState(0);
  const [smileFlash, setSmileFlash] = useState(false);
  const [history, setHistory] = useState<AvatarConfig[]>([]);
  const [warn, setWarn] = useState<UiKey | null>(null);

  const smileTimer = useRef<number | null>(null);
  const poseTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (smileTimer.current) window.clearTimeout(smileTimer.current);
      if (poseTimer.current) window.clearTimeout(poseTimer.current);
    },
    [],
  );

  const triggerJoy = (withSmile = true) => {
    setSparkleTick((n) => n + 1);
    if (withSmile) {
      setSmileFlash(true);
      if (smileTimer.current) window.clearTimeout(smileTimer.current);
      smileTimer.current = window.setTimeout(() => setSmileFlash(false), 1100);
    } else {
      if (smileTimer.current) window.clearTimeout(smileTimer.current);
      setSmileFlash(false);
    }
  };

  const set = (patch: Partial<AvatarConfig>, opts?: { quiet?: boolean }) => {
    playSfx("click");
    setWarn(null);
    setHistory((h) => [...h.slice(-19), avatar]);
    setAvatar(patch);
    const isFaceEdit =
      "eyes" in patch ||
      "eyeColor" in patch ||
      "eyebrow" in patch ||
      "nose" in patch ||
      "mouth" in patch ||
      "cheek" in patch ||
      "faceMark" in patch;
    if (!opts?.quiet) triggerJoy(!isFaceEdit);
    if (patch.suit && SUITS_LOUD.includes(patch.suit)) setWarn("avatar.loudSuit");
  };

  const undo = () => {
    if (history.length === 0) return;
    playSfx("click");
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setAvatar(prev);
    setWarn(null);
  };

  const selectCategory = (next: Category) => {
    playSfx("click");
    setCat(next);
    const first = SUB_TABS[next][0]!.id;
    setSub(first);
    setViewMode("auto");
    setYawTarget(first === "bag" ? Math.PI : 0);
    if (next === "face") {
      if (smileTimer.current) window.clearTimeout(smileTimer.current);
      setSmileFlash(false);
    }
  };

  const selectSub = (next: SubTab) => {
    playSfx("click");
    setSub(next);
    setViewMode("auto");
    setYawTarget(next === "bag" ? Math.PI : 0);
  };

  const applyPreset = (p: AvatarPreset) => {
    playSfx("ok");
    setWarn(null);
    setHistory((h) => [...h.slice(-19), avatar]);
    setAvatar(p.patch);
    setPose("cheer");
    triggerJoy(true);
    if (poseTimer.current) window.clearTimeout(poseTimer.current);
    poseTimer.current = window.setTimeout(
      () => setPose((cur) => (cur === "cheer" ? "idle" : cur)),
      1400,
    );
  };

  const random = () => {
    playSfx("ok");
    setWarn(null);
    setHistory((h) => [...h.slice(-19), avatar]);
    setAvatar(
      buildRandomAvatar(
        mode,
        HAIR_STYLES.map(([hs]) => hs),
      ),
    );
    triggerJoy();
  };

  const finish = () => {
    if (mode === "suit" && avatar.outfit !== "suit") {
      setWarn("avatar.needSuit");
      setCat("outfit");
      setSub("outfit");
      playSfx("ng");
      return;
    }
    playSfx("ok");
    onDone();
  };

  const visibleHair = useMemo(() => {
    const grp = HAIR_GROUPS.find((g) => g.id === hairGroup);
    if (!grp?.styles) return HAIR_STYLES;
    const setIds = new Set(grp.styles);
    return HAIR_STYLES.filter(([id]) => setIds.has(id));
  }, [hairGroup]);

  const bg = BACKDROPS[backdrop];
  const poseMeta = POSES.find((p) => p.id === pose);
  const activeExpr: Expression = smileFlash ? "happy" : (poseMeta?.expr ?? "normal");
  const curGlasses = glassesStyleOf(avatar);
  const curBag = bagStyleOf(avatar);
  const curCheek = cheekOf(avatar);
  const curCasual = casualStyleOf(avatar);
  const presets = mode === "suit" ? SUIT_PRESETS : FREE_PRESETS;

  /** 色の見本＋自由カラーピッカー（はだ・スーツは 見本だけ）。 */
  const swatches = (
    values: string[],
    key: keyof AvatarConfig,
    opts: { custom?: boolean; fallback?: string; label?: UiKey } = {},
  ) => {
    const custom = opts.custom ?? true;
    const cur = String(avatar[key] ?? opts.fallback ?? "#888888");
    return (
      <div className="flex flex-col gap-2">
        {opts.label && (
          <div className="text-ink text-sm font-extrabold">
            <RubyText text={t(opts.label)} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {values.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-9 w-9 rounded-full border-[3px] shadow transition ${cur === c ? "scale-110 border-[#1f9b6c] ring-2 ring-[#47352b]" : "border-white hover:scale-105"}`}
              style={{ background: c }}
              onClick={() => set({ [key]: c })}
              aria-label={c}
            />
          ))}
          {custom && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#48362c] bg-[#6e5648] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#7d6253]">
              <input
                type="color"
                value={cur}
                onChange={(e) => set({ [key]: e.target.value }, { quiet: true })}
                className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent"
                data-testid={`avatar-${key}-custom`}
              />
              <RubyText text={t("avatar.colorCustom")} />
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="glass pop text-ink flex max-h-[92vh] w-full max-w-6xl flex-col gap-3 overflow-hidden rounded-[28px] p-3.5 md:flex-row md:p-4"
      data-testid="avatar-editor"
    >
      {/* 左: どう森ふう パステル着がえスタジオ */}
      <div
        className="relative h-72 shrink-0 overflow-hidden rounded-[22px] border-2 border-[#e6d4b3] shadow-inner md:h-auto md:min-h-[500px] md:w-[44%]"
        style={{ background: bg.css }}
      >
        <Canvas
          camera={{ fov: 34, position: [0, 0.9, 2.35] }}
          dpr={[1, 1.5]}
          gl={{ toneMapping: THREE.NoToneMapping, alpha: true }}
        >
          <hemisphereLight args={["#fffdf7", "#ffe4d4", 1.7]} />
          <directionalLight position={[2.2, 4, 3.2]} intensity={1.45} color="#fffcf5" />
          <directionalLight position={[-2.4, 2.2, -1.8]} intensity={0.65} color={bg.rim} />
          <Suspense fallback={null}>
            <Turntable targetYaw={yawTarget}>
              <Chibi
                config={avatar}
                motion={pose}
                expression={activeExpr}
                hopTrigger={sparkleTick}
              />
            </Turntable>
            <SparkleBurst trigger={sparkleTick} />
          </Suspense>
          {/* 足元の やわらかい影 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
            <circleGeometry args={[0.32, 32]} />
            <meshBasicMaterial color="#6a5248" transparent opacity={0.18} />
          </mesh>
          {/* どう森ふうの まるい ラグマット */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[0.72, 48]} />
            <meshBasicMaterial color={bg.mat} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[0.66, 0.72, 48]} />
            <meshBasicMaterial color={bg.ring} transparent opacity={0.85} />
          </mesh>
          <FocusCamera tab={sub} viewMode={viewMode} />
        </Canvas>

        {/* 左上: 名前・身長バッジ & カメラ切り替え */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-full bg-[#5c463a]/90 px-3 py-1 text-xs font-extrabold text-white shadow">
            {nickname && <span>{nickname}</span>}
            <span className="text-white">{avatar.height} cm</span>
          </div>
          <div className="pointer-events-auto flex flex-wrap gap-1">
            <button
              type="button"
              className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs transition ${yawTarget === 0 ? "bg-[#1f9b6c]" : "bg-[#5c463a]/85 hover:bg-[#705547]"}`}
              onClick={() => {
                playSfx("click");
                setYawTarget(0);
              }}
            >
              <RubyText text={t("avatar.viewFront")} />
            </button>
            <button
              type="button"
              className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs transition ${yawTarget === Math.PI ? "bg-[#1f9b6c]" : "bg-[#5c463a]/85 hover:bg-[#705547]"}`}
              onClick={() => {
                playSfx("click");
                setYawTarget(Math.PI);
              }}
            >
              <RubyText text={t("avatar.viewBack")} />
            </button>
            <button
              type="button"
              className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs transition ${viewMode === "face" ? "bg-[#1f9b6c]" : "bg-[#5c463a]/85 hover:bg-[#705547]"}`}
              onClick={() => {
                playSfx("click");
                setViewMode((v) => (v === "face" ? "auto" : "face"));
              }}
            >
              <RubyText text={t("avatar.viewFace")} />
            </button>
            <button
              type="button"
              className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs transition ${viewMode === "full" ? "bg-[#1f9b6c]" : "bg-[#5c463a]/85 hover:bg-[#705547]"}`}
              onClick={() => {
                playSfx("click");
                setViewMode((v) => (v === "full" ? "auto" : "full"));
              }}
            >
              <RubyText text={t("avatar.viewFull")} />
            </button>
          </div>
        </div>

        {/* 右上: スタジオの 背景テーマ 4つ */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-[#5c463a]/85 px-2.5 py-1.5 shadow">
          {(Object.keys(BACKDROPS) as BackdropId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`h-5 w-5 rounded-full border-2 transition ${backdrop === id ? "scale-115 border-white ring-2 ring-[#f5bf3b]" : "border-white/75 opacity-90 hover:opacity-100"}`}
              style={{ background: BACKDROPS[id].dot }}
              onClick={() => {
                playSfx("click");
                setBackdrop(id);
              }}
              title={t(BACKDROPS[id].label)}
              aria-label={t(BACKDROPS[id].label)}
            />
          ))}
        </div>

        {/* 下: ポーズ確認バー */}
        <div className="absolute right-2 bottom-2 left-2 flex flex-col items-center gap-1">
          <div className="rounded-full bg-[#5c463a]/80 px-2.5 py-0.5 text-[11px] font-bold text-white">
            <RubyText text={t("avatar.dragHint")} />
          </div>
          <div className="flex flex-wrap justify-center gap-1 rounded-2xl bg-[#5c463a]/90 p-1.5 shadow-lg">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`rounded-xl px-2.5 py-1 text-xs font-extrabold text-white transition ${pose === p.id ? "bg-[#1f9b6c] ring-1 ring-white" : "bg-white/15 hover:bg-white/25"}`}
                onClick={() => {
                  playSfx("click");
                  setPose(p.id);
                }}
              >
                <RubyText text={t(p.label)} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右: カテゴリ＆カスタマイズ パネル */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
        {/* ヘッダー */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-ink text-xl leading-tight font-extrabold md:text-2xl">
              <RubyText text={t("avatar.title")} />
            </h2>
            <p className="text-cocoa text-xs font-bold">
              <RubyText text={t("avatar.subtitle")} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost px-3 py-1.5 text-sm"
              onClick={undo}
              disabled={history.length === 0}
              data-testid="avatar-undo"
            >
              <RubyText text={t("avatar.undo")} />
            </button>
            <button
              type="button"
              className="btn btn-primary px-3.5 py-1.5 text-sm"
              onClick={random}
              data-testid="avatar-random"
            >
              <RubyText text={t("avatar.random")} />
            </button>
          </div>
        </div>

        {/* 第1階層: 大きな 5カテゴリ タブ */}
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORIES.map((c) => {
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-2 text-xs font-extrabold text-white transition md:flex-row md:gap-1.5 md:text-sm ${
                  active
                    ? "border-[#146e4c] bg-[#1f9b6c] shadow-[0_3px_0_#136848]"
                    : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"
                }`}
                onClick={() => selectCategory(c.id)}
                data-testid={`avatar-cat-${c.id}`}
              >
                <CategoryIcon id={c.id} className="h-4 w-4 shrink-0" />
                <RubyText text={t(c.label)} />
              </button>
            );
          })}
        </div>

        {/* 第2階層: カテゴリ内の サブタブ */}
        {SUB_TABS[cat].length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {SUB_TABS[cat].map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`rounded-xl border-2 px-3 py-1.5 text-sm font-extrabold text-white transition ${
                  sub === tb.id
                    ? "border-[#146e4c] bg-[#1f9b6c] shadow-xs"
                    : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"
                }`}
                onClick={() => selectSub(tb.id)}
                data-testid={`avatar-tab-${tb.id}`}
              >
                <RubyText text={t(tb.label)} />
              </button>
            ))}
          </div>
        )}

        {/* 選択エリア（スクロール可能） */}
        <div className="cream-box min-h-0 flex-1 overflow-y-auto rounded-[22px] p-3.5">
          {/* ── おすすめコーデ（プリセット） ── */}
          {sub === "presets" && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="text-ink group flex items-center gap-2.5 rounded-2xl border-2 border-[#e6d4b3] bg-white p-3 text-left font-extrabold shadow-[0_3px_0_#e2cfa9] transition hover:scale-[1.02] hover:border-[#1f9b6c] hover:bg-[#fffef8]"
                  onClick={() => applyPreset(p)}
                  data-testid={`avatar-preset-${p.id}`}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-white shadow"
                    style={{ background: p.accent }}
                  >
                    <CategoryIcon id="presets" className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-sm leading-snug">
                    <RubyText text={t(p.label)} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── 顔: はだ ── */}
          {sub === "skin" && swatches(SKINS, "skin", { custom: false })}

          {/* ── 顔: 目＋目の色 ── */}
          {sub === "eyes" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="text-ink text-sm font-extrabold">
                  <RubyText text={t("avatar.eyeColor")} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold text-white transition ${!avatar.eyeColor ? "border-[#146e4c] bg-[#1f9b6c]" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => set({ eyeColor: undefined })}
                  >
                    <RubyText text={t("avatar.eyeColorDefault")} />
                  </button>
                  {EYE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-8 w-8 rounded-full border-[3px] shadow transition ${avatar.eyeColor === c ? "scale-110 border-[#1f9b6c] ring-2 ring-[#47352b]" : "border-white hover:scale-105"}`}
                      style={{ background: c }}
                      onClick={() => set({ eyeColor: c })}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {EYES.map(([e, key]) => (
                  <button
                    key={e}
                    type="button"
                    className={`flex w-[92px] flex-col items-center gap-1 rounded-xl border-2 px-1 py-1.5 text-[12px] font-extrabold whitespace-nowrap text-white transition ${avatar.eyes === e ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => set({ eyes: e })}
                    data-testid={`avatar-eyes-${e}`}
                  >
                    <EyePair style={e} skin={avatar.skin} />
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 顔: まゆ ── */}
          {sub === "eyebrow" && (
            <div className="flex flex-wrap gap-2">
              {EYEBROWS.map(([b, key]) => (
                <button
                  key={b}
                  type="button"
                  className={`flex w-[96px] flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 text-xs font-extrabold text-white transition ${(avatar.eyebrow ?? "soft") === b ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                  onClick={() => set({ eyebrow: b })}
                  data-testid={`avatar-brow-${b}`}
                >
                  <FacePartPair
                    sheet="face_mouth"
                    col={EYEBROW_COLS[b]}
                    row={0}
                    skin={avatar.skin}
                    size={22}
                  />
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}

          {/* ── 顔: 鼻 ── */}
          {sub === "nose" && (
            <div className="flex flex-wrap gap-2">
              {NOSES.map(([n, key]) => (
                <button
                  key={n}
                  type="button"
                  className={`flex w-[92px] flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 text-xs font-extrabold text-white transition ${(avatar.nose ?? "dot") === n ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                  onClick={() => set({ nose: n })}
                  data-testid={`avatar-nose-${n}`}
                >
                  <FacePartSingle
                    sheet="face_mouth"
                    col={NOSE_COLS[n]}
                    row={1}
                    skin={avatar.skin}
                    size={24}
                  />
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}

          {/* ── 顔: 口 ── */}
          {sub === "mouth" && (
            <div className="flex flex-wrap gap-2">
              {MOUTHS.map(([m, key]) => {
                const [mc, mr] = MOUTH_SLOTS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    className={`flex w-[96px] flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 text-xs font-extrabold text-white transition ${(avatar.mouth ?? "smile") === m ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => set({ mouth: m })}
                    data-testid={`avatar-mouth-${m}`}
                  >
                    <FacePartSingle
                      sheet="face_mouth"
                      col={mc}
                      row={mr}
                      skin={avatar.skin}
                      size={28}
                    />
                    <RubyText text={t(key)} />
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 顔: ほっぺ＋ワンポイント ── */}
          {sub === "cheek" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {CHEEKS.map(([ch, key]) => (
                  <button
                    key={ch}
                    type="button"
                    className={`flex w-[96px] flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 text-xs font-extrabold text-white transition ${curCheek === ch ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => set({ cheek: ch, blush: ch !== "none" })}
                    data-testid={`avatar-cheek-${ch}`}
                  >
                    {ch === "none" ? (
                      <span
                        className="flex h-11 w-[76px] items-center justify-center rounded-lg text-xs font-extrabold text-[#3a2a24]"
                        style={{ background: avatar.skin }}
                      >
                        —
                      </span>
                    ) : (
                      <FacePartPair
                        sheet="face_cheeks"
                        col={CHEEK_COLS[ch]}
                        row={0}
                        skin={avatar.skin}
                        size={26}
                      />
                    )}
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-ink text-sm font-extrabold">
                  <RubyText text={t("avatar.faceMark")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {FACE_MARKS.map(([mk, key]) => (
                    <button
                      key={mk}
                      type="button"
                      className={`btn py-2 text-sm ${(avatar.faceMark ?? "none") === mk ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => set({ faceMark: mk })}
                      data-testid={`avatar-mark-${mk}`}
                    >
                      <RubyText text={t(key)} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 髪: 髪型（グループ絞り込み付き） ── */}
          {sub === "hairStyle" && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {HAIR_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold text-white transition ${hairGroup === g.id ? "border-[#146e4c] bg-[#1f9b6c]" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => {
                      playSfx("click");
                      setHairGroup(g.id);
                    }}
                  >
                    <RubyText text={t(g.label)} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleHair.map(([hs, key]) => (
                  <button
                    key={hs}
                    type="button"
                    className={`flex w-[92px] flex-col items-center rounded-xl border-2 px-1 pb-1.5 text-[12px] font-extrabold whitespace-nowrap text-white transition ${avatar.hairStyle === hs ? "border-[#146e4c] bg-[#1f9b6c] shadow-sm" : "border-[#48362c] bg-[#6e5648] hover:bg-[#7d6253]"}`}
                    onClick={() => set({ hairStyle: hs })}
                    data-testid={`avatar-hair-${hs}`}
                  >
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
            </div>
          )}

          {/* ── 髪: 髪の色 ── */}
          {sub === "hair" && swatches(HAIRS, "hair")}

          {/* ── 服: 種類・ふだんの服アレンジ・着ぐるみ種類・寝巻き色 ── */}
          {sub === "outfit" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
                {(["suit", "casual", "kigurumi", "pajama"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`btn ${avatar.outfit === o ? "btn-primary" : "btn-ghost"} text-base`}
                    onClick={() => set({ outfit: o })}
                    data-testid={`avatar-outfit-${o}`}
                  >
                    {avatar.outfit === o && <IconCheck className="h-5 w-5" />}
                    <RubyText text={t(OUTFIT_LABEL[o])} />
                  </button>
                ))}
              </div>

              {avatar.outfit === "casual" && (
                <div className="flex flex-col gap-2">
                  <div className="text-ink text-sm font-extrabold">
                    <RubyText text={t("avatar.casualStyle")} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CASUAL_STYLES.map(([cs, key]) => (
                      <button
                        key={cs}
                        type="button"
                        className={`btn py-2 text-sm ${curCasual === cs ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => set({ casualStyle: cs })}
                        data-testid={`avatar-casual-${cs}`}
                      >
                        <RubyText text={t(key)} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {avatar.outfit === "kigurumi" && (
                <div className="flex flex-col gap-2">
                  <div className="text-ink text-sm font-extrabold">
                    <RubyText text={t("avatar.kigurumiKind")} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {KIGURUMI.map(([k, key]) => (
                      <button
                        key={k}
                        type="button"
                        className={`btn py-2 text-sm ${(avatar.kigurumi ?? "bear") === k ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => set({ kigurumi: k })}
                        data-testid={`avatar-kigurumi-${k}`}
                      >
                        <RubyText text={t(key)} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {avatar.outfit === "pajama" &&
                swatches(PAJAMAS, "pajama", { label: "avatar.pajamaColor", fallback: "#a9cdeb" })}
            </div>
          )}

          {/* ── 服: 体の形・身長 ── */}
          {sub === "figure" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
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
              <div className="flex flex-col gap-2">
                <div className="text-ink text-sm font-extrabold">
                  <RubyText text={t("avatar.height")} />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <input
                    type="range"
                    min={150}
                    max={190}
                    step={1}
                    value={avatar.height}
                    onChange={(e) => set({ height: Number(e.target.value) }, { quiet: true })}
                    className="w-64 accent-[#1f9b6c]"
                    data-testid="avatar-height"
                  />
                  <span className="text-ink text-2xl font-extrabold">{avatar.height} cm</span>
                </div>
              </div>
            </div>
          )}

          {/* ── 服: 色をまとめて調整 ── */}
          {sub === "colors" && (
            <div className="flex flex-col gap-4">
              {avatar.outfit === "suit" && (
                <>
                  {swatches([...SUITS_OK, ...SUITS_LOUD], "suit", {
                    custom: false,
                    label: "avatar.suitColor",
                  })}
                  {swatches(TIES, "tie", {
                    label: avatar.figure === "f" ? "avatar.ribbon" : "avatar.tie",
                  })}
                  {swatches(SHIRTS, "shirt", { label: "avatar.shirt" })}
                </>
              )}
              {avatar.outfit === "casual" && (
                <>
                  {swatches(COATS, "coat", { label: "avatar.coat" })}
                  {swatches(PANTS, "pants", { label: "avatar.pants" })}
                  {(curCasual === "cardigan" || curCasual === "jacket") &&
                    swatches(SHIRTS, "shirt", { label: "avatar.shirt" })}
                </>
              )}
              {avatar.outfit === "pajama" &&
                swatches(PAJAMAS, "pajama", { label: "avatar.pajamaColor", fallback: "#a9cdeb" })}
              {avatar.outfit === "kigurumi" && (
                <div className="flex flex-wrap gap-2">
                  {KIGURUMI.map(([k, key]) => (
                    <button
                      key={k}
                      type="button"
                      className={`btn py-2 text-sm ${(avatar.kigurumi ?? "bear") === k ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => set({ kigurumi: k })}
                    >
                      <RubyText text={t(key)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 服: くつ ── */}
          {sub === "shoes" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {SHOE_TYPES.map(([st, key]) => (
                  <button
                    key={st}
                    type="button"
                    className={`btn py-2 text-sm ${shoeTypeOf(avatar) === st ? "btn-primary" : "btn-ghost"}`}
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

          {/* ── 服: バッグ ── */}
          {sub === "bag" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {BAGS.map(([b, key]) => (
                  <button
                    key={b}
                    type="button"
                    className={`btn py-2 text-sm ${curBag === b ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => {
                      set({ bagStyle: b, bag: b !== "none" });
                      if (b !== "none") setYawTarget(Math.PI);
                    }}
                    data-testid={`avatar-bag-${b}`}
                  >
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              {curBag !== "none" &&
                swatches(ITEM_COLORS, "bagColor", {
                  label: "avatar.bagColor",
                  fallback: "#2b2f37",
                })}
            </div>
          )}

          {/* ── 小物: ぼうし・ヘッドホン ── */}
          {sub === "hat" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {HATS.map(([h, key]) => (
                  <button
                    key={h}
                    type="button"
                    className={`btn py-2 text-sm ${(avatar.hat ?? "none") === h ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => set({ hat: h })}
                    data-testid={`avatar-hat-${h}`}
                  >
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              {avatar.hat &&
                avatar.hat !== "none" &&
                avatar.hat !== "crown" &&
                avatar.hat !== "flowerCrown" &&
                swatches(ITEM_COLORS, "hatColor", {
                  label: "avatar.hatColor",
                  fallback: "#3b6ea5",
                })}
            </div>
          )}

          {/* ── 小物: めがね ── */}
          {sub === "glasses" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {GLASSES_LIST.map(([g, key]) => (
                  <button
                    key={g}
                    type="button"
                    className={`btn py-2 text-sm ${curGlasses === g ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => set({ glassesStyle: g, glasses: g !== "none" })}
                    data-testid={`avatar-glasses-${g}`}
                  >
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              {curGlasses !== "none" &&
                swatches(ITEM_COLORS, "glassesColor", {
                  label: "avatar.glassesColor",
                  fallback: "#2a2d35",
                })}
            </div>
          )}

          {/* ── 小物: 首もと（クロマー・マフラー・ちょうネクタイ・社員証） ── */}
          {sub === "neckwear" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {NECKWEARS.map(([nw, key]) => (
                  <button
                    key={nw}
                    type="button"
                    className={`btn py-2 text-sm ${(avatar.neckwear ?? "none") === nw ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => set({ neckwear: nw })}
                    data-testid={`avatar-neck-${nw}`}
                  >
                    <RubyText text={t(key)} />
                  </button>
                ))}
              </div>
              {avatar.neckwear &&
                avatar.neckwear !== "none" &&
                swatches(ITEM_COLORS, "neckColor", {
                  label: "avatar.neckColor",
                  fallback: "#c83e4d",
                })}
            </div>
          )}

          {/* ── 小物: 髪・耳のかざり ── */}
          {sub === "accessory" && (
            <div className="flex flex-wrap gap-2">
              {ACCESSORIES.map(([a, key]) => (
                <button
                  key={a}
                  type="button"
                  className={`btn py-2 text-sm ${(avatar.accessory ?? "none") === a ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ accessory: a })}
                  data-testid={`avatar-acc-${a}`}
                >
                  <RubyText text={t(key)} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 注意メッセージ */}
        {warn && (
          <p
            className="pop rounded-2xl border-2 border-[#e0b248] bg-[#fff5d6] px-4 py-2.5 text-base font-extrabold text-[#6b4408]"
            data-testid="avatar-warn"
          >
            <RubyText text={t(warn)} />
          </p>
        )}

        {/* 決定ボタン */}
        <div className="flex justify-end">
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

// ── 3D スタジオ補助部品 ──────────────────────────────────

/** 見本の台。ドラッグで 360度 ぐるっと回せる。ボタンで 前・後ろへ なめらかに向く。 */
function Turntable({ children, targetYaw = 0 }: { children: React.ReactNode; targetYaw?: number }) {
  const ref = useRef<THREE.Group>(null);
  const drag = useRef<{ on: boolean; x: number; offset: number; lastTarget: number }>({
    on: false,
    x: 0,
    offset: 0,
    lastTarget: targetYaw,
  });
  useFrame((s, dt) => {
    const g = ref.current;
    if (!g) return;
    if (drag.current.lastTarget !== targetYaw) {
      drag.current.lastTarget = targetYaw;
      drag.current.offset = 0;
    }
    const sway = drag.current.on ? 0 : Math.sin(s.clock.elapsedTime * 0.7) * 0.14;
    const want = targetYaw + drag.current.offset + sway;
    g.rotation.y += (want - g.rotation.y) * Math.min(1, dt * 6);
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
        drag.current.offset += dx * 0.012;
      }}
    >
      {children}
    </group>
  );
}

function FocusCamera({ tab, viewMode }: { tab: SubTab; viewMode: "auto" | "face" | "full" }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.72, 0));
  useFrame((_, dt) => {
    const f =
      viewMode === "face"
        ? { y: 0.87, d: 1.52 }
        : viewMode === "full"
          ? { y: 0.67, d: 2.75 }
          : FOCUS[tab];
    const k = Math.min(1, dt * 5);
    camera.position.lerp(new THREE.Vector3(0, f.y + 0.08, f.d), k);
    look.current.lerp(new THREE.Vector3(0, f.y, 0), k);
    camera.lookAt(look.current);
  });
  return null;
}

const SPARKLE_COLORS = ["#ffe066", "#ff9ec4", "#6ce5ff", "#a7f3b0", "#fff4b8"];

/** 着がえたときに ふわっと 飛び出す キラキラ 3D パーティクル。 */
function SparkleBurst({ trigger }: { trigger: number }) {
  const group = useRef<THREE.Group>(null);
  const state = useRef({ last: trigger, t: 1 });
  const specs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return {
          dx: Math.cos(a) * (0.48 + (i % 3) * 0.12),
          dz: Math.sin(a) * (0.38 + (i % 2) * 0.1),
          y0: 0.45 + (i % 4) * 0.18,
          vy: 0.35 + (i % 3) * 0.14,
          color: SPARKLE_COLORS[i % SPARKLE_COLORS.length]!,
        };
      }),
    [],
  );

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (trigger !== state.current.last) {
      state.current.last = trigger;
      state.current.t = 0;
    }
    if (state.current.t >= 1) {
      g.visible = false;
      return;
    }
    state.current.t = Math.min(1, state.current.t + dt * 1.45);
    const p = state.current.t;
    const ease = 1 - (1 - p) ** 2;
    const sc = Math.sin(p * Math.PI) * 0.055;
    g.visible = true;
    g.children.forEach((child, i) => {
      const sp = specs[i]!;
      child.position.set(sp.dx * ease, sp.y0 + sp.vy * ease, sp.dz * ease);
      child.rotation.y += dt * 4;
      child.rotation.z += dt * 3;
      child.scale.setScalar(Math.max(0.001, sc));
    });
  });

  return (
    <group ref={group} visible={false}>
      {specs.map((sp, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={sp.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── 顔のパーツ プレビュー部品 ────────────────────────────

function EyePair({ style, skin }: { style: AvatarConfig["eyes"]; skin: string }) {
  const [name, row] = EYE_SLOTS[style] ?? ["face_eyes", 0];
  const leftCol = style === "smile" ? 2 : style === "peace" ? 1 : 0;
  const rightCol = style === "smile" || style === "wink" ? 2 : style === "peace" ? 1 : 0;
  const leftBox = faceCell(name, leftCol, row);
  const rightBox = faceCell(name, rightCol, row);
  const ref = faceCell("face_eyes", 0, 0);
  const sheet = FACE_ATLAS[name];
  if (!leftBox || !rightBox || !ref || !sheet) return null;
  const rb = faceCell(name, 0, row) ?? ref;
  const baseK = (30 / ref[3]) * (Math.sqrt(ref[2] * ref[3]) / Math.sqrt(rb[2] * rb[3])) ** 0.7;
  // 横に広い目（クール・ねこ目・ジト目など）も 76px の枠にすっきり収める
  const maxW = Math.max(leftBox[2], rightBox[2]);
  const maxH = Math.max(leftBox[3], rightBox[3]);
  const k = Math.min(baseK, 30 / maxW, 34 / maxH);
  const renderEye = (box: [number, number, number, number], flip: boolean) => (
    <span
      className="block shrink-0"
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
      className="flex h-11 w-[76px] items-center justify-center gap-1.5 rounded-lg"
      style={{ background: skin }}
    >
      {renderEye(leftBox, false)}
      {renderEye(rightBox, true)}
    </span>
  );
}

function FacePartSingle({
  sheet,
  col,
  row,
  skin,
  size,
}: {
  sheet: string;
  col: number;
  row: number;
  skin: string;
  size: number;
}) {
  const box = faceCell(sheet, col, row);
  const sh = FACE_ATLAS[sheet];
  if (!box || !sh) return null;
  const k = Math.min(size / Math.max(box[2], box[3]), 34 / box[3]);
  return (
    <span
      className="flex h-11 w-[76px] items-center justify-center rounded-lg"
      style={{ background: skin }}
    >
      <span
        className="block"
        style={{
          width: box[2] * k,
          height: box[3] * k,
          backgroundImage: `url(${faceSheetUrl(sheet)})`,
          backgroundSize: `${sh.w * k}px ${sh.h * k}px`,
          backgroundPosition: `${-box[0] * k}px ${-box[1] * k}px`,
        }}
      />
    </span>
  );
}

function FacePartPair({
  sheet,
  col,
  row,
  skin,
  size,
}: {
  sheet: string;
  col: number;
  row: number;
  skin: string;
  size: number;
}) {
  const box = faceCell(sheet, col, row);
  const sh = FACE_ATLAS[sheet];
  if (!box || !sh) return null;
  const k = Math.min(size / Math.max(box[2], box[3]), 28 / box[2]);
  const one = (flip: boolean) => (
    <span
      className="block"
      style={{
        width: box[2] * k,
        height: box[3] * k,
        backgroundImage: `url(${faceSheetUrl(sheet)})`,
        backgroundSize: `${sh.w * k}px ${sh.h * k}px`,
        backgroundPosition: `${-box[0] * k}px ${-box[1] * k}px`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
  return (
    <span
      className="flex h-11 w-[76px] items-center justify-center gap-3 rounded-lg"
      style={{ background: skin }}
    >
      {one(false)}
      {one(true)}
    </span>
  );
}

/** カテゴリタブの 小さな線のアイコン（UI記号）。 */
function CategoryIcon({ id, className }: { id: Category; className?: string }) {
  if (id === "presets") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6-5.1-4.4 6.7-.6z" />
      </svg>
    );
  }
  if (id === "face") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path d="M8.5 14.5c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "hair") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden
      >
        <path
          d="M5 15c0-6 3-10 7-10s7 4 7 10c0 2-1 4-3 4-1-3-2-5-4-5s-3 2-4 5c-2 0-3-2-3-4z"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "outfit") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden
      >
        <path d="M8 4l4 3 4-3 5 4-3 3v9H6v-9L3 8z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <circle cx="7.5" cy="14" r="3.5" />
      <circle cx="16.5" cy="14" r="3.5" />
      <path d="M11 14h2M4 13l1-5h2M20 13l-1-5h-2" strokeLinecap="round" />
    </svg>
  );
}
