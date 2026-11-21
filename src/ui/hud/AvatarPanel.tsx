import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/audio";
import { useGame, type AvatarConfig, type HairStyle } from "@/lib/store";
import { t, type UiKey } from "@/lib/t";
import { Avatar } from "@/three/Avatar";
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
  | "hair"
  | "hairStyle"
  | "glasses"
  | "suit"
  | "tie"
  | "shirt"
  | "coat"
  | "pants";

const HAIR_STYLES: [HairStyle, UiKey][] = [
  ["model", "avatar.hs.model"],
  ["spiky", "avatar.hs.spiky"],
  ["side", "avatar.hs.side"],
  ["bob", "avatar.hs.bob"],
  ["long", "avatar.hs.long"],
  ["ponytail", "avatar.hs.ponytail"],
  ["twin", "avatar.hs.twin"],
  ["bun", "avatar.hs.bun"],
];

const SKINS = ["#f1c9a5", "#e0ac83", "#c68e64", "#a8714a", "#8a5a3b", "#6b4430"];
const HAIRS = ["#1d1612", "#3a2618", "#5a3a22", "#7a5230", "#a3a3a3", "#2c3e70"];
const SUITS_OK = ["#1c1e24", "#232f52", "#3a3d45", "#5b616c"];
const SUITS_LOUD = ["#b8312f", "#e8e8e8", "#3f7f4f"];
const TIES = ["#1f3f7a", "#8a1c2b", "#2d5e3a", "#5a3e8a", "#c9a227", "#222222"];
const SHIRTS = ["#f4f6f8", "#dfefff", "#fff2f7"];
const COATS = ["#8a8f98", "#3b6ea5", "#9c3b3b", "#4e7d4e", "#d8c3a5", "#2b2b2b"];
const PANTS = ["#3a3d44", "#2a3550", "#6b5a45", "#20232a"];

const LABEL: Record<Tab, UiKey> = {
  outfit: "avatar.outfit",
  figure: "avatar.figure",
  height: "avatar.height",
  skin: "avatar.skin",
  hair: "avatar.hair",
  hairStyle: "avatar.hairStyle",
  glasses: "avatar.glasses",
  suit: "avatar.suitColor",
  tie: "avatar.tie",
  shirt: "avatar.shirt",
  coat: "avatar.coat",
  pants: "avatar.pants",
};

/** タブごとのカメラの寄り（体の高さ・距離）。 */
const FOCUS: Record<Tab, { y: number; d: number }> = {
  outfit: { y: 0.95, d: 3.0 },
  figure: { y: 0.95, d: 3.0 },
  height: { y: 0.95, d: 3.2 },
  skin: { y: 1.55, d: 1.2 },
  hair: { y: 1.6, d: 1.15 },
  hairStyle: { y: 1.55, d: 1.3 },
  glasses: { y: 1.6, d: 0.9 },
  suit: { y: 1.1, d: 2.2 },
  tie: { y: 1.3, d: 1.3 },
  shirt: { y: 1.3, d: 1.4 },
  coat: { y: 1.15, d: 2.0 },
  pants: { y: 0.6, d: 2.0 },
};

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

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
          "hairStyle",
          "hair",
          "glasses",
          "suit",
          "tie",
          "shirt",
        ]
      : [
          "outfit",
          "figure",
          "height",
          "skin",
          "hairStyle",
          "hair",
          "glasses",
          "coat",
          "shirt",
          "pants",
        ];

  const set = (a: Partial<AvatarConfig>) => {
    playSfx("click");
    setWarn(null);
    setAvatar(a);
    if (a.suit && SUITS_LOUD.includes(a.suit)) setWarn("avatar.loudSuit");
  };

  const random = () => {
    set({
      figure: pick(["m", "f"]),
      hairStyle: pick<HairStyle>([
        "model",
        "spiky",
        "side",
        "bob",
        "long",
        "ponytail",
        "twin",
        "bun",
      ]),
      height: 155 + Math.round(Math.random() * 30),
      skin: pick(SKINS),
      hair: pick(HAIRS),
      suit: pick(SUITS_OK),
      tie: pick(TIES),
      shirt: pick(SHIRTS),
      coat: pick(COATS),
      pants: pick(PANTS),
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
            <Turntable>
              <Avatar config={avatar} />
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
              className={`rounded-xl px-3 py-2 font-extrabold transition ${tab === tb ? "bg-cyan text-ink" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setTab(tb)}
              data-testid={`avatar-tab-${tb}`}
            >
              <RubyText text={t(LABEL[tb])} />
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
              {(["m", "f"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn ${avatar.figure === f ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ figure: f })}
                >
                  <RubyText text={t(f === "m" ? "avatar.figureM" : "avatar.figureF")} />
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
          {tab === "hairStyle" && (
            <div className="flex flex-wrap gap-3">
              {HAIR_STYLES.map(([hs, key]) => (
                <button
                  key={hs}
                  type="button"
                  className={`btn ${avatar.hairStyle === hs ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => set({ hairStyle: hs })}
                >
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
          {tab === "skin" && swatches(SKINS, "skin")}
          {tab === "hair" && swatches(HAIRS, "hair")}
          {tab === "suit" && swatches([...SUITS_OK, ...SUITS_LOUD], "suit")}
          {tab === "tie" && swatches(TIES, "tie")}
          {tab === "shirt" && swatches(SHIRTS, "shirt")}
          {tab === "coat" && swatches(COATS, "coat")}
          {tab === "pants" && swatches(PANTS, "pants")}
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

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const drag = useRef<{ on: boolean; x: number; v: number }>({ on: false, x: 0, v: 0 });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!drag.current.on) g.rotation.y += dt * 0.35 + drag.current.v;
    drag.current.v *= 0.92;
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
        if (!drag.current.on || !ref.current) return;
        const dx = e.clientX - drag.current.x;
        drag.current.x = e.clientX;
        ref.current.rotation.y += dx * 0.01;
        drag.current.v = dx * 0.002;
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
