import { useMemo } from "react";
import * as THREE from "three";
import type { AvatarConfig } from "@/lib/store";
import {
  bagStyleOf,
  casualStyleOf,
  glassesStyleOf,
  shade,
  softMaterial,
} from "@/three/avatar-parts";

/**
 * 3D アバターの わくわく追加パーツ（ぼうし・めがね・かざり・クロマー/マフラー・バッグ・新しい着ぐるみ・ふだんの服アレンジ）。
 * avatar.glb と同じ softMaterial（4だんの やわらかいパステル陰）で 統一感を 出す。
 */

const kramaTexCache = new Map<string, THREE.CanvasTexture>();

/** カンボジアの クロマー（格子柄の 布）テクスチャを Canvas で作る。 */
function kramaTexture(color: string): THREE.CanvasTexture {
  const hit = kramaTexCache.get(color);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#faf6ee";
    g.fillRect(0, 0, 128, 128);
    // たて・よこの 織りしま（格子）
    g.fillStyle = color;
    g.globalAlpha = 0.55;
    for (let i = 0; i < 128; i += 32) {
      g.fillRect(i, 0, 16, 128);
      g.fillRect(0, i, 128, 16);
    }
    // 交差する 濃いマス
    g.globalAlpha = 0.85;
    for (let x = 0; x < 128; x += 32) {
      for (let y = 0; y < 128; y += 32) {
        g.fillRect(x, y, 16, 16);
      }
    }
    // 細い アクセント線
    g.globalAlpha = 0.35;
    g.fillStyle = shade(color, 0.6);
    for (let i = 0; i < 128; i += 32) {
      g.fillRect(i + 2, 0, 2, 128);
      g.fillRect(0, i + 2, 128, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  kramaTexCache.set(color, tex);
  return tex;
}

const kramaMatCache = new Map<string, THREE.MeshToonMaterial>();
function kramaMaterial(color: string): THREE.MeshToonMaterial {
  const hit = kramaMatCache.get(color);
  if (hit) return hit;
  const base = softMaterial("#ffffff") as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    map: kramaTexture(color),
    gradientMap: base.gradientMap,
  });
  kramaMatCache.set(color, m);
  return m;
}

const lensCache = new Map<string, THREE.MeshStandardMaterial>();
function lensMaterial(
  color: string,
  opacity: number,
  emissive?: string,
): THREE.MeshStandardMaterial {
  const key = `${color}|${opacity}|${emissive ?? ""}`;
  const hit = lensCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.15,
    metalness: 0.1,
    emissive: emissive ? new THREE.Color(emissive) : new THREE.Color("#000000"),
    emissiveIntensity: emissive ? 0.55 : 0,
  });
  lensCache.set(key, m);
  return m;
}

/** 頭に付く 追加パーツ（めがね・ぼうし・ヘッドホン・かざり・追加の着ぐるみフード）。 */
export function AvatarHeadExtras({ config }: { config: AvatarConfig }) {
  const glasses = glassesStyleOf(config);
  const gColor = config.glassesColor ?? "#2a2d35";
  const hat = config.hat ?? "none";
  const hColor = config.hatColor ?? "#3b6ea5";
  const isKig = config.outfit === "kigurumi";
  const isPajama = config.outfit === "pajama";
  const kig = config.kigurumi ?? "bear";
  const acc = config.accessory ?? "none";

  // 着ぐるみ時は 頭の上に乗る小物（王冠・花かんむり・ヘッドホン）だけ 出せる
  const showHat =
    hat !== "none" && (!isKig || hat === "crown" || hat === "flowerCrown" || hat === "headphones");

  return (
    <group>
      {glasses !== "none" && <GlassesMesh style={glasses} color={gColor} />}
      {showHat && <HatMesh style={hat} color={hColor} lifted={isKig} />}
      {!isKig && !isPajama && acc !== "none" && <HeadAccessoryMesh style={acc} />}
      {isKig && kig === "panda" && <PandaHeadExtras />}
      {isKig && kig === "frog" && <FrogHoodMesh />}
      {isKig && kig === "shiba" && <ShibaHeadExtras />}
    </group>
  );
}

const NECK_GEO = new THREE.CylinderGeometry(0.056, 0.062, 0.085, 12);
const GLASSES_BRIDGE_GEO = new THREE.CapsuleGeometry(0.006, 0.05, 4, 6);
const GLASSES_TEMPLE_GEO = new THREE.BoxGeometry(0.009, 0.011, 0.25);
const GLASSES_ROUND_GEO = new THREE.TorusGeometry(0.058, 0.0082, 8, 20);
const GLASSES_SQ_TOP_GEO = new THREE.BoxGeometry(0.12, 0.014, 0.014);
const GLASSES_SQ_BOT_GEO = new THREE.BoxGeometry(0.114, 0.011, 0.012);
const GLASSES_SQ_SIDE_GEO = new THREE.BoxGeometry(0.012, 0.092, 0.012);

/** 体に付く 追加パーツ（首のつなぎ・ふだんの服アレンジ・寝巻きえり・クロマー/マフラー・バッグ・追加着ぐるみ）。 */
export function AvatarBodyExtras({ config }: { config: AvatarConfig }) {
  const isSuit = config.outfit === "suit";
  const isCasual = config.outfit === "casual";
  const isKig = config.outfit === "kigurumi";
  const isPajama = config.outfit === "pajama";
  const kig = config.kigurumi ?? "bear";
  const neck = config.neckwear ?? "none";
  const neckColor = config.neckColor ?? "#c83e4d";
  const bag = bagStyleOf(config);
  const bagColor = config.bagColor ?? "#2b2f37";
  const casual = casualStyleOf(config);

  const skinMat = softMaterial(config.skin, false, undefined, "skin");

  return (
    <group>
      {/* 頭と 胴を なめらかに つなぐ 首 */}
      {!isKig && <mesh position={[0, 0.605, 0]} geometry={NECK_GEO} material={skinMat} />}

      {/* ふだんの服の アレンジ（カーディガン・Tシャツ・ジャケット） */}
      {isCasual && casual !== "hoodie" && (
        <CasualDetails style={casual} topColor={config.coat} shirtColor={config.shirt} />
      )}

      {/* 寝巻きの かわいい えりと ボタン */}
      {isPajama && <PajamaDetails color={config.pajama ?? "#a9cdeb"} />}

      {/* 首もとの かざり（クロマー・マフラー・ちょうネクタイ・社員証） */}
      {!isKig && neck !== "none" && <NeckwearMesh style={neck} color={neckColor} />}

      {/* バッグ・せなかの かざり（くまポシェット・てんしの羽・パソコンバッグ） */}
      {!isSuit && !isKig && !isPajama && bag !== "none" && bag !== "backpack" && (
        <BagExtrasMesh style={bag} color={bagColor} />
      )}

      {/* 着ぐるみ パンダ・しば犬の 体の かざり */}
      {isKig && kig === "panda" && <PandaBodyExtras />}
      {isKig && kig === "shiba" && <ShibaTailMesh />}
    </group>
  );
}

// ── めがね ──────────────────────────────────────────────

function GlassesMesh({
  style,
  color,
}: {
  style: NonNullable<AvatarConfig["glassesStyle"]>;
  color: string;
}) {
  const frameMat = softMaterial(color, false, undefined, "cloth");
  const darkLens = lensMaterial("#1e2330", 0.86);
  const roseLens = lensMaterial("#ffd4e8", 0.35);
  const visorGlass = lensMaterial("#18325a", 0.84, "#1f8fff");
  const cyanGlow = lensMaterial("#42e8ff", 0.95, "#38e1ff");
  const goldMat = softMaterial("#f4c542", false, undefined, "cloth");
  const whiteMat = softMaterial("#ffffff", false, undefined, "skin");

  if (style === "visor") {
    return (
      <group position={[0, -0.04, 0.045]}>
        {/* サイバー VR ゴーグル本体（曲面） */}
        <mesh rotation={[0, -Math.PI * 0.34, 0]} material={frameMat}>
          <cylinderGeometry args={[0.295, 0.295, 0.11, 24, 1, true, 0, Math.PI * 0.68]} />
        </mesh>
        <mesh rotation={[0, -Math.PI * 0.31, 0]} material={visorGlass}>
          <cylinderGeometry args={[0.301, 0.301, 0.082, 24, 1, true, 0, Math.PI * 0.62]} />
        </mesh>
        {/* シアンの 光るライン */}
        <mesh rotation={[0, -Math.PI * 0.28, 0]} position={[0, 0.025, 0]} material={cyanGlow}>
          <cylinderGeometry args={[0.304, 0.304, 0.012, 24, 1, true, 0, Math.PI * 0.56]} />
        </mesh>
        {/* 横の バンド */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.045]} material={frameMat}>
          <torusGeometry args={[0.305, 0.014, 8, 28]} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, -0.042, 0.304]}>
      {/* ブリッジ（鼻の 前を ふんわり わたる） */}
      <mesh
        position={[0, 0.008, 0.012]}
        rotation={[0, 0, Math.PI / 2]}
        geometry={GLASSES_BRIDGE_GEO}
        material={frameMat}
      />
      {/* 左右の つる（フレーム外端から 耳へ のびる） */}
      {([-1, 1] as const).map((sx) => (
        <mesh
          key={`temple-${sx}`}
          position={[sx * 0.212, 0.008, -0.125]}
          rotation={[0.04, -sx * 0.42, 0]}
          geometry={GLASSES_TEMPLE_GEO}
          material={frameMat}
        />
      ))}

      {style === "round" &&
        ([-1, 1] as const).map((sx) => (
          <mesh
            key={`r-${sx}`}
            position={[sx * 0.102, 0, 0]}
            rotation={[0, sx * 0.16, 0]}
            geometry={GLASSES_ROUND_GEO}
            material={frameMat}
          />
        ))}

      {style === "square" &&
        ([-1, 1] as const).map((sx) => (
          <group key={`sq-${sx}`} position={[sx * 0.104, 0, 0]} rotation={[0, sx * 0.16, 0]}>
            <mesh position={[0, 0.044, 0]} geometry={GLASSES_SQ_TOP_GEO} material={frameMat} />
            <mesh position={[0, -0.042, 0]} geometry={GLASSES_SQ_BOT_GEO} material={frameMat} />
            <mesh position={[-0.055, 0, 0]} geometry={GLASSES_SQ_SIDE_GEO} material={frameMat} />
            <mesh position={[0.055, 0, 0]} geometry={GLASSES_SQ_SIDE_GEO} material={frameMat} />
          </group>
        ))}

      {style === "sunglasses" &&
        ([-1, 1] as const).map((sx) => (
          <group key={`sun-${sx}`} position={[sx * 0.104, 0, 0]} rotation={[0, sx * 0.17, 0]}>
            <mesh scale={[1.15, 0.9, 0.45]} material={frameMat}>
              <torusGeometry args={[0.057, 0.011, 10, 24]} />
            </mesh>
            <mesh scale={[1.12, 0.86, 1]} material={darkLens}>
              <circleGeometry args={[0.056, 22]} />
            </mesh>
            {/* キラッと 光る線 */}
            <mesh position={[-0.018, 0.014, 0.004]} rotation={[0, 0, -0.55]} material={whiteMat}>
              <planeGeometry args={[0.012, 0.042]} />
            </mesh>
          </group>
        ))}

      {style === "star" &&
        ([-1, 1] as const).map((sx) => (
          <group key={`st-${sx}`} position={[sx * 0.104, 0, 0]} rotation={[0, sx * 0.16, 0]}>
            <mesh material={frameMat}>
              <torusGeometry args={[0.06, 0.0085, 10, 24]} />
            </mesh>
            <mesh material={roseLens}>
              <circleGeometry args={[0.056, 20]} />
            </mesh>
            {/* 外がわの ほしアクセント */}
            <mesh position={[sx * 0.06, 0.036, 0.008]} rotation={[0, 0, 0.3]} material={goldMat}>
              <octahedronGeometry args={[0.022, 0]} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

// ── ぼうし・ヘッドホン ────────────────────────────────────

function HatMesh({
  style,
  color,
  lifted,
}: {
  style: NonNullable<AvatarConfig["hat"]>;
  color: string;
  lifted: boolean;
}) {
  const mainMat = softMaterial(color, false, undefined, "cloth");
  const doubleMainMat = useMemo(() => {
    const m = (mainMat as THREE.MeshToonMaterial).clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [mainMat]);
  const darkMat = softMaterial(shade(color, 0.78), false, undefined, "cloth");
  const lightMat = softMaterial(shade(color, 1.35), false, undefined, "cloth");
  const whiteMat = softMaterial("#ffffff", false, undefined, "skin");
  const pinkMat = softMaterial("#f9a8be", false, undefined, "cloth");
  const goldMat = softMaterial("#f4c542", false, undefined, "cloth");
  const leafMat = softMaterial("#65bd75", false, undefined, "cloth");
  const liftY = lifted ? 0.045 : 0;

  if (style === "cap") {
    return (
      <group position={[0, 0.145 + liftY, -0.02]} rotation={[-0.22, 0, 0]}>
        {/* クラウン */}
        <mesh scale={[1.08, 0.68, 1.03]} material={mainMat}>
          <sphereGeometry args={[0.34, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
        </mesh>
        {/* てっぺんの ボタン */}
        <mesh position={[0, 0.235, 0]} scale={[1, 0.5, 1]} material={darkMat}>
          <sphereGeometry args={[0.028, 14, 10]} />
        </mesh>
        {/* つば（前へ のびる） */}
        <mesh
          position={[0, 0.01, 0.27]}
          rotation={[0.14, 0, 0]}
          scale={[1.05, 0.22, 0.72]}
          material={darkMat}
        >
          <cylinderGeometry args={[0.25, 0.27, 0.08, 22, 1, false, -Math.PI * 0.5, Math.PI]} />
        </mesh>
        {/* まえの 白いワッペン */}
        <mesh position={[0, 0.11, 0.32]} rotation={[-0.28, 0, 0]} material={whiteMat}>
          <circleGeometry args={[0.045, 16]} />
        </mesh>
      </group>
    );
  }

  if (style === "beanie") {
    return (
      <group position={[0, 0.135 + liftY, -0.02]} rotation={[-0.2, 0, 0]}>
        <mesh scale={[1.08, 0.78, 1.03]} material={mainMat}>
          <sphereGeometry args={[0.342, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        </mesh>
        {/* 折り返しの リブ */}
        <mesh
          position={[0, 0.01, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.08, 1.03, 0.9]}
          material={darkMat}
        >
          <torusGeometry args={[0.328, 0.048, 12, 30]} />
        </mesh>
        {/* てっぺんの ポンポン */}
        <mesh position={[0, 0.295, -0.015]} material={lightMat}>
          <sphereGeometry args={[0.072, 18, 14]} />
        </mesh>
      </group>
    );
  }

  if (style === "beret") {
    return (
      <group position={[0.04, 0.24 + liftY, -0.02]} rotation={[-0.18, 0, -0.22]}>
        <mesh scale={[1.14, 0.42, 1.08]} material={mainMat}>
          <sphereGeometry args={[0.345, 28, 18]} />
        </mesh>
        {/* 縁の しまり */}
        <mesh
          position={[0, -0.07, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.05, 1.0, 0.8]}
          material={darkMat}
        >
          <torusGeometry args={[0.295, 0.025, 10, 26]} />
        </mesh>
        {/* てっぺんの ちょぼ */}
        <mesh position={[0, 0.155, 0]} rotation={[0.15, 0, 0.1]} material={darkMat}>
          <capsuleGeometry args={[0.015, 0.042, 6, 10]} />
        </mesh>
      </group>
    );
  }

  if (style === "bucket") {
    return (
      <group position={[0, 0.21 + liftY, -0.015]} rotation={[-0.18, 0, 0]}>
        {/* クラウン */}
        <mesh position={[0, 0.06, 0]} scale={[1.06, 1, 1.0]} material={mainMat}>
          <cylinderGeometry args={[0.27, 0.335, 0.17, 28]} />
        </mesh>
        {/* 帯 */}
        <mesh position={[0, -0.005, 0]} scale={[1.06, 1, 1.0]} material={darkMat}>
          <cylinderGeometry args={[0.326, 0.34, 0.036, 28]} />
        </mesh>
        {/* ひらいた つば（裏からも見えるように両面） */}
        <mesh position={[0, -0.065, 0]} scale={[1.07, 1, 1.02]} material={doubleMainMat}>
          <cylinderGeometry args={[0.335, 0.465, 0.1, 28, 1, true]} />
        </mesh>
      </group>
    );
  }

  if (style === "headphones") {
    const padMat = softMaterial("#2a2d35", false, undefined, "cloth");
    const glowMat = lensMaterial("#38e1ff", 1, "#38e1ff");
    return (
      <group position={[0, 0.01 + liftY * 0.4, 0.0]}>
        {/* 頭の 上を わたる バンド */}
        <mesh position={[0, 0.02, 0]} scale={[1.04, 1.0, 1]} material={mainMat}>
          <torusGeometry args={[0.355, 0.026, 10, 30, Math.PI]} />
        </mesh>
        {/* 頭頂の やわらかい クッション（横向きに バンドに沿う） */}
        <mesh
          position={[0, 0.372, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.85, 1.0, 1.05]}
          material={padMat}
        >
          <capsuleGeometry args={[0.027, 0.13, 6, 12]} />
        </mesh>
        {/* 左右の イヤーカップ */}
        {([-1, 1] as const).map((sx) => (
          <group key={`hp-${sx}`} position={[sx * 0.355, -0.025, 0.0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={padMat}>
              <cylinderGeometry args={[0.088, 0.088, 0.04, 20]} />
            </mesh>
            <mesh position={[sx * 0.024, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mainMat}>
              <cylinderGeometry args={[0.078, 0.084, 0.044, 20]} />
            </mesh>
            <mesh
              position={[sx * 0.048, 0, 0]}
              rotation={[0, sx * (Math.PI / 2), 0]}
              material={glowMat}
            >
              <torusGeometry args={[0.048, 0.008, 8, 20]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (style === "catears") {
    return (
      <group position={[0, 0.02 + liftY, 0.02]}>
        {/* カチューシャ */}
        <mesh scale={[1.05, 1.0, 1]} material={darkMat}>
          <torusGeometry args={[0.345, 0.015, 8, 28, Math.PI]} />
        </mesh>
        {([-1, 1] as const).map((sx) => (
          <group
            key={`ce-${sx}`}
            position={[sx * 0.18, 0.33, 0.02]}
            rotation={[0.08, 0, -sx * 0.35]}
          >
            <mesh scale={[1, 1.15, 0.58]} material={mainMat}>
              <coneGeometry args={[0.088, 0.16, 16]} />
            </mesh>
            <mesh position={[0, -0.01, 0.032]} scale={[0.62, 0.72, 0.35]} material={pinkMat}>
              <coneGeometry args={[0.082, 0.14, 14]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (style === "crown") {
    const gemRed = softMaterial("#ef5366", false, undefined, "cloth");
    const gemCyan = softMaterial("#38e1ff", false, undefined, "cloth");
    return (
      <group position={[0.04, 0.335 + liftY, 0.03]} rotation={[0.08, 0, -0.18]}>
        <mesh material={goldMat}>
          <cylinderGeometry args={[0.105, 0.082, 0.078, 16]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <group key={`cp-${i}`} position={[Math.sin(a) * 0.095, 0.056, Math.cos(a) * 0.095]}>
              <mesh material={goldMat}>
                <coneGeometry args={[0.028, 0.065, 8]} />
              </mesh>
              <mesh position={[0, 0.038, 0]} material={i % 2 === 0 ? gemRed : gemCyan}>
                <sphereGeometry args={[0.015, 10, 8]} />
              </mesh>
            </group>
          );
        })}
        <mesh position={[0, 0.0, 0.095]} material={gemRed}>
          <sphereGeometry args={[0.018, 12, 10]} />
        </mesh>
      </group>
    );
  }

  // flowerCrown（カンボジアの国花ロムドゥオル風の クリーム色・桜色・白の 花かんむり）
  const petals = ["#fff3c4", "#ffb7d5", "#ffffff", "#ffe194", "#ffd2e8"];
  return (
    <group position={[0, 0.175 + liftY, -0.01]} rotation={[-0.2, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.08, 1.02, 1]} material={leafMat}>
        <torusGeometry args={[0.335, 0.016, 8, 28]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const fx = Math.sin(a) * 0.365;
        const fz = Math.cos(a) * 0.345;
        const pMat = softMaterial(petals[i % petals.length]!, false, undefined, "cloth");
        return (
          <group key={`fl-${i}`} position={[fx, 0.01, fz]} rotation={[0, a, 0]}>
            {[0, 1, 2, 3, 4].map((p) => {
              const pa = (p / 5) * Math.PI * 2;
              return (
                <mesh
                  key={p}
                  position={[Math.cos(pa) * 0.026, Math.sin(pa) * 0.026, 0.01]}
                  material={pMat}
                >
                  <sphereGeometry args={[0.022, 10, 8]} />
                </mesh>
              );
            })}
            <mesh position={[0, 0, 0.018]} material={goldMat}>
              <sphereGeometry args={[0.015, 10, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── 髪・耳の かざり ────────────────────────────────────

function HeadAccessoryMesh({ style }: { style: NonNullable<AvatarConfig["accessory"]> }) {
  const goldMat = softMaterial("#f6c945", false, undefined, "cloth");
  const pinkMat = softMaterial("#ff8eb3", false, undefined, "cloth");
  const pearlMat = softMaterial("#fffdf7", false, undefined, "skin");
  const leafMat = softMaterial("#58c46b", false, undefined, "cloth");
  const stemMat = softMaterial("#449e55", false, undefined, "cloth");

  if (style === "starClip") {
    return (
      <group>
        <mesh
          position={[0.205, 0.135, 0.25]}
          rotation={[0.2, 0.55, 0.3]}
          scale={[1, 1, 0.45]}
          material={goldMat}
        >
          <octahedronGeometry args={[0.04, 0]} />
        </mesh>
        <mesh
          position={[0.255, 0.088, 0.205]}
          rotation={[0.2, 0.72, 0.1]}
          scale={[1, 1, 0.45]}
          material={pinkMat}
        >
          <octahedronGeometry args={[0.032, 0]} />
        </mesh>
      </group>
    );
  }

  if (style === "earrings") {
    return (
      <group>
        {([-1, 1] as const).map((sx) => (
          <group key={`er-${sx}`} position={[sx * 0.312, -0.072, -0.01]}>
            <mesh material={goldMat}>
              <sphereGeometry args={[0.014, 10, 8]} />
            </mesh>
            <mesh position={[0, -0.028, 0]} material={pearlMat}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (style === "sprout") {
    return (
      <group position={[0, 0.32, 0]}>
        <mesh position={[0, 0.04, 0]} material={stemMat}>
          <cylinderGeometry args={[0.01, 0.012, 0.09, 10]} />
        </mesh>
        <mesh
          position={[-0.048, 0.095, 0]}
          rotation={[0, 0, 0.58]}
          scale={[1.45, 0.65, 0.45]}
          material={leafMat}
        >
          <sphereGeometry args={[0.045, 14, 10]} />
        </mesh>
        <mesh
          position={[0.048, 0.095, 0]}
          rotation={[0, 0, -0.58]}
          scale={[1.45, 0.65, 0.45]}
          material={leafMat}
        >
          <sphereGeometry args={[0.045, 14, 10]} />
        </mesh>
      </group>
    );
  }

  return null;
}

// ── ふだんの服アレンジ & 寝巻きえり ──────────────────────

function CasualDetails({
  style,
  topColor,
  shirtColor,
}: {
  style: NonNullable<AvatarConfig["casualStyle"]>;
  topColor: string;
  shirtColor: string;
}) {
  const shirtMat = softMaterial(shirtColor, false, undefined, "cloth");
  const trimMat = softMaterial(shade(topColor, 0.72), false, undefined, "cloth");
  const accentMat = softMaterial(shade(topColor, 1.38), false, undefined, "cloth");
  const whiteMat = softMaterial("#ffffff", false, undefined, "skin");

  if (style === "cardigan") {
    return (
      <group>
        {/* 白い インナーの V */}
        <mesh
          position={[0, 0.525, 0.105]}
          rotation={[0.14, 0, Math.PI]}
          scale={[1, 1, 0.35]}
          material={shirtMat}
        >
          <coneGeometry args={[0.056, 0.13, 3]} />
        </mesh>
        {/* カーディガンの ボタン */}
        {[0.445, 0.395, 0.345].map((y) => (
          <mesh key={y} position={[0, y, 0.115]} material={trimMat}>
            <sphereGeometry args={[0.012, 10, 8]} />
          </mesh>
        ))}
        {/* すその リブ */}
        <mesh
          position={[0, 0.315, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.0, 0.84, 0.7]}
          material={trimMat}
        >
          <torusGeometry args={[0.122, 0.015, 8, 22]} />
        </mesh>
      </group>
    );
  }

  if (style === "tshirt") {
    return (
      <group>
        {/* 首まわりの リブ */}
        <mesh
          position={[0, 0.582, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 0.9, 1]}
          material={accentMat}
        >
          <torusGeometry args={[0.072, 0.013, 8, 22]} />
        </mesh>
        {/* むねの ストライプ */}
        <mesh position={[0, 0.48, 0]} scale={[1.01, 1, 0.83]} material={whiteMat}>
          <cylinderGeometry args={[0.136, 0.139, 0.048, 26, 1, true]} />
        </mesh>
        {/* 左むねの ワンポイント */}
        <mesh position={[0.06, 0.525, 0.108]} material={accentMat}>
          <circleGeometry args={[0.018, 12]} />
        </mesh>
      </group>
    );
  }

  // jacket（ストリートジャケット）
  return (
    <group>
      {/* 立てえり */}
      <mesh position={[0, 0.585, 0]} scale={[1, 1, 0.9]} material={trimMat}>
        <cylinderGeometry args={[0.082, 0.09, 0.042, 22, 1, true]} />
      </mesh>
      {/* 前の 白い インナー線 */}
      <mesh position={[0, 0.455, 0.112]} material={shirtMat}>
        <boxGeometry args={[0.044, 0.24, 0.012]} />
      </mesh>
      {/* ジッパー縁 */}
      {([-1, 1] as const).map((sx) => (
        <mesh key={sx} position={[sx * 0.026, 0.455, 0.115]} material={trimMat}>
          <boxGeometry args={[0.009, 0.24, 0.012]} />
        </mesh>
      ))}
      {/* すその リブ */}
      <mesh
        position={[0, 0.312, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1.02, 0.84, 0.7]}
        material={trimMat}
      >
        <torusGeometry args={[0.122, 0.016, 8, 22]} />
      </mesh>
    </group>
  );
}

function PajamaDetails({ color }: { color: string }) {
  const collarMat = softMaterial("#ffffff", false, undefined, "skin");
  const btnMat = softMaterial(shade(color, 0.7), false, undefined, "cloth");
  return (
    <group>
      {([-1, 1] as const).map((sx) => (
        <mesh
          key={sx}
          position={[sx * 0.052, 0.562, 0.092]}
          rotation={[0.3, sx * 0.25, -sx * 0.35]}
          scale={[1.1, 0.65, 0.35]}
          material={collarMat}
        >
          <sphereGeometry args={[0.036, 12, 10]} />
        </mesh>
      ))}
      {[0.5, 0.44, 0.38].map((y) => (
        <mesh key={y} position={[0, y, 0.115]} material={btnMat}>
          <sphereGeometry args={[0.012, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 首もとの かざり（クロマー・マフラー・ちょうネクタイ・社員証） ──

function NeckwearMesh({
  style,
  color,
}: {
  style: NonNullable<AvatarConfig["neckwear"]>;
  color: string;
}) {
  const mat =
    style === "krama" ? kramaMaterial(color) : softMaterial(color, false, undefined, "cloth");
  const darkMat = softMaterial(shade(color, 0.78), false, undefined, "cloth");
  const whiteMat = softMaterial("#ffffff", false, undefined, "skin");
  const cyanMat = softMaterial("#38e1ff", false, undefined, "cloth");

  if (style === "krama") {
    return (
      <group position={[0, 0.578, 0.005]}>
        {/* 首に ふんわり 巻いた クロマー */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.08, 0.94, 0.9]} material={mat}>
          <torusGeometry args={[0.102, 0.036, 12, 26]} />
        </mesh>
        {/* 前に たれる 2本の 布 */}
        <mesh position={[-0.036, -0.1, 0.114]} rotation={[0.08, 0, 0.1]} material={mat}>
          <boxGeometry args={[0.056, 0.17, 0.022]} />
        </mesh>
        <mesh position={[0.036, -0.075, 0.118]} rotation={[0.1, 0, -0.14]} material={mat}>
          <boxGeometry args={[0.052, 0.125, 0.022]} />
        </mesh>
        {/* はしの ふさ（白） */}
        <mesh position={[-0.045, -0.19, 0.121]} material={whiteMat}>
          <boxGeometry args={[0.052, 0.018, 0.018]} />
        </mesh>
        <mesh position={[0.044, -0.14, 0.124]} material={whiteMat}>
          <boxGeometry args={[0.048, 0.016, 0.018]} />
        </mesh>
      </group>
    );
  }

  if (style === "scarf") {
    return (
      <group position={[0, 0.575, 0.005]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.1, 0.95, 1.1]} material={mat}>
          <torusGeometry args={[0.105, 0.042, 12, 26]} />
        </mesh>
        <mesh position={[0.055, -0.095, 0.115]} rotation={[0.12, 0, -0.18]} material={darkMat}>
          <capsuleGeometry args={[0.03, 0.12, 6, 12]} />
        </mesh>
      </group>
    );
  }

  if (style === "bowtie") {
    return (
      <group position={[0, 0.56, 0.116]}>
        <mesh
          position={[-0.036, 0, 0]}
          rotation={[0, 0, 0.15]}
          scale={[1.25, 0.8, 0.55]}
          material={mat}
        >
          <sphereGeometry args={[0.03, 14, 10]} />
        </mesh>
        <mesh
          position={[0.036, 0, 0]}
          rotation={[0, 0, -0.15]}
          scale={[1.25, 0.8, 0.55]}
          material={mat}
        >
          <sphereGeometry args={[0.03, 14, 10]} />
        </mesh>
        <mesh position={[0, 0, 0.008]} material={darkMat}>
          <sphereGeometry args={[0.015, 12, 10]} />
        </mesh>
      </group>
    );
  }

  // lanyard（IT会社の 社員証ストラップ）
  return (
    <group>
      {/* 首からの ストラップ */}
      {([-1, 1] as const).map((sx) => (
        <mesh
          key={sx}
          position={[sx * 0.032, 0.52, 0.108]}
          rotation={[0.06, 0, sx * 0.28]}
          material={mat}
        >
          <boxGeometry args={[0.012, 0.155, 0.008]} />
        </mesh>
      ))}
      {/* 社員証ホルダー */}
      <group position={[0, 0.42, 0.122]}>
        <mesh material={whiteMat}>
          <boxGeometry args={[0.072, 0.052, 0.01]} />
        </mesh>
        <mesh position={[0, 0.015, 0.006]} material={cyanMat}>
          <planeGeometry args={[0.064, 0.012]} />
        </mesh>
        <mesh position={[-0.018, -0.006, 0.006]} material={darkMat}>
          <planeGeometry args={[0.02, 0.022]} />
        </mesh>
      </group>
    </group>
  );
}

// ── バッグ・せなかの かざり ──────────────────────────────

function BagExtrasMesh({
  style,
  color,
}: {
  style: NonNullable<AvatarConfig["bagStyle"]>;
  color: string;
}) {
  const mainMat = softMaterial(color, false, undefined, "cloth");
  const lightMat = softMaterial(shade(color, 1.38), false, undefined, "cloth");
  const darkMat = softMaterial(shade(color, 0.72), false, undefined, "cloth");
  const eyeMat = softMaterial("#2a1f1d", false, undefined, "skin");

  if (style === "bearBag") {
    return (
      <group position={[0, 0.47, -0.155]}>
        {/* くまの 顔バッグ */}
        <mesh scale={[1.05, 0.96, 0.65]} material={mainMat}>
          <sphereGeometry args={[0.105, 20, 14]} />
        </mesh>
        {/* くまの 耳 */}
        {([-1, 1] as const).map((sx) => (
          <group key={sx} position={[sx * 0.075, 0.085, -0.005]}>
            <mesh scale={[1, 1, 0.6]} material={mainMat}>
              <sphereGeometry args={[0.036, 14, 10]} />
            </mesh>
            <mesh position={[0, 0, -0.015]} scale={[0.6, 0.6, 0.4]} material={lightMat}>
              <sphereGeometry args={[0.032, 12, 8]} />
            </mesh>
          </group>
        ))}
        {/* マズルと 目 */}
        <mesh position={[0, -0.018, -0.062]} scale={[1.15, 0.85, 0.6]} material={lightMat}>
          <sphereGeometry args={[0.035, 14, 10]} />
        </mesh>
        <mesh position={[0, -0.006, -0.082]} material={eyeMat}>
          <sphereGeometry args={[0.01, 10, 8]} />
        </mesh>
        {([-1, 1] as const).map((sx) => (
          <mesh key={`be-${sx}`} position={[sx * 0.038, 0.016, -0.068]} material={eyeMat}>
            <sphereGeometry args={[0.01, 10, 8]} />
          </mesh>
        ))}
        {/* 肩ひも */}
        {([-1, 1] as const).map((sx) => (
          <mesh
            key={`bs-${sx}`}
            position={[sx * 0.1, 0.03, 0.14]}
            rotation={[0.2, 0, 0]}
            material={darkMat}
          >
            <capsuleGeometry args={[0.012, 0.14, 6, 8]} />
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "wings") {
    return (
      <group position={[0, 0.49, -0.125]}>
        {([-1, 1] as const).map((sx) => (
          <group
            key={`w-${sx}`}
            position={[sx * 0.055, 0, 0]}
            rotation={[0.12, -sx * 0.42, sx * 0.18]}
          >
            <mesh
              position={[sx * 0.09, 0.035, 0]}
              rotation={[0, 0, -sx * 0.25]}
              scale={[1.5, 0.72, 0.25]}
              material={mainMat}
            >
              <sphereGeometry args={[0.085, 16, 12]} />
            </mesh>
            <mesh
              position={[sx * 0.08, -0.025, 0]}
              rotation={[0, 0, -sx * 0.42]}
              scale={[1.2, 0.55, 0.22]}
              material={lightMat}
            >
              <sphereGeometry args={[0.072, 14, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // laptopBag（ITエンジニアの 斜めがけパソコンバッグ）
  const silverMat = softMaterial("#d8dee8", false, undefined, "cloth");
  return (
    <group>
      {/* 斜めがけ ストラップ */}
      <mesh
        position={[0, 0.455, 0.0]}
        rotation={[0, 0, 0.62]}
        scale={[1.02, 1.32, 0.85]}
        material={darkMat}
      >
        <torusGeometry args={[0.135, 0.013, 8, 28]} />
      </mesh>
      {/* 後ろ腰の パソコンバッグ本体 */}
      <group position={[-0.08, 0.38, -0.155]} rotation={[0.06, 0.25, -0.08]}>
        <mesh material={mainMat}>
          <boxGeometry args={[0.22, 0.16, 0.065]} />
        </mesh>
        <mesh position={[0, 0.032, -0.036]} material={darkMat}>
          <boxGeometry args={[0.21, 0.078, 0.012]} />
        </mesh>
        <mesh position={[0, -0.008, -0.044]} material={silverMat}>
          <boxGeometry args={[0.032, 0.022, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}

// ── 追加の着ぐるみ（パンダ・かえる・しば犬） ─────────────

/** ふっくら 厚みのある 着ぐるみフードの 共通ベース（パンダ・かえる）。 */
function PlushHoodShell({ color }: { color: string }) {
  const mat = useMemo(() => {
    const base = softMaterial(color, false, undefined, "cloth") as THREE.MeshToonMaterial;
    const m = base.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [color]);

  const backGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(
      0.34,
      32,
      22,
      -Math.PI * 0.2,
      Math.PI * 1.4,
      0,
      Math.PI * 0.85,
    );
    g.scale(1.08, 0.97, 1.03);
    g.rotateY(Math.PI);
    return g;
  }, []);

  return (
    <group>
      {/* 後頭部・よこを つつむ ふっくら フード */}
      <mesh geometry={backGeo} position={[0, 0.01, -0.015]} material={mat} />
      {/* 頭の上の 丸み */}
      <mesh position={[0, 0.092, -0.015]} scale={[1.09, 0.8, 1.04]} material={mat}>
        <sphereGeometry args={[0.336, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
      </mesh>
      {/* 顔の まわりの ふっくら 縁（厚み） */}
      <mesh position={[0, -0.012, 0.095]} scale={[1.07, 0.95, 0.68]} material={mat}>
        <torusGeometry args={[0.304, 0.036, 12, 32]} />
      </mesh>
    </group>
  );
}

function PandaHeadExtras() {
  const blackMat = softMaterial("#26282e", false, undefined, "cloth");
  return (
    <group>
      <PlushHoodShell color="#f8f7f3" />
      {/* まるい 黒い パンダ耳 */}
      {([-1, 1] as const).map((sx) => (
        <mesh
          key={`pe-${sx}`}
          position={[sx * 0.215, 0.292, 0.035]}
          rotation={[0.08, 0, -sx * 0.42]}
          scale={[1.04, 0.95, 0.62]}
          material={blackMat}
        >
          <sphereGeometry args={[0.102, 20, 14]} />
        </mesh>
      ))}
    </group>
  );
}

function PandaBodyExtras() {
  const blackMat = softMaterial("#26282e", false, undefined, "cloth");
  return (
    <mesh position={[0, 0.528, 0]} scale={[1.04, 1, 0.85]} material={blackMat}>
      {/* 上面が抜けた 帯にして、首元の 穴のように 見えない自然な パンダの肩ラインにする */}
      <cylinderGeometry args={[0.128, 0.144, 0.072, 24, 1, true]} />
    </mesh>
  );
}

function FrogHoodMesh() {
  const greenMat = softMaterial("#74c27c", false, undefined, "cloth");
  const whiteMat = softMaterial("#ffffff", false, undefined, "skin");
  const pupilMat = softMaterial("#231c1a", false, undefined, "skin");
  const blushMat = softMaterial("#ff9eb5", false, undefined, "cloth");

  return (
    <group>
      <PlushHoodShell color="#74c27c" />
      {/* ぴょこんと 出た 大きな かえるの 目 */}
      {([-1, 1] as const).map((sx) => (
        <group key={`fe-${sx}`} position={[sx * 0.16, 0.302, 0.09]}>
          <mesh material={greenMat}>
            <sphereGeometry args={[0.092, 18, 14]} />
          </mesh>
          <mesh position={[0, 0.005, 0.066]} material={whiteMat}>
            <sphereGeometry args={[0.056, 16, 12]} />
          </mesh>
          <mesh position={[0, 0.005, 0.108]} material={pupilMat}>
            <sphereGeometry args={[0.031, 14, 10]} />
          </mesh>
          <mesh position={[-0.011, 0.017, 0.132]} material={whiteMat}>
            <sphereGeometry args={[0.01, 10, 8]} />
          </mesh>
          {/* フードの ほっぺ */}
          <mesh position={[sx * 0.064, -0.052, 0.052]} scale={[1.2, 0.7, 0.5]} material={blushMat}>
            <sphereGeometry args={[0.024, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ShibaHeadExtras() {
  const creamMat = softMaterial("#fff4df", false, undefined, "cloth");
  return (
    <group>
      {/* しば犬の まろまゆ */}
      {([-1, 1] as const).map((sx) => (
        <mesh
          key={`sb-${sx}`}
          position={[sx * 0.092, 0.215, 0.285]}
          rotation={[0.25, sx * 0.25, sx * 0.2]}
          scale={[1.25, 0.75, 0.5]}
          material={creamMat}
        >
          <sphereGeometry args={[0.028, 12, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function ShibaTailMesh() {
  const tanMat = softMaterial("#e3a254", false, undefined, "cloth");
  const creamMat = softMaterial("#fff4df", false, undefined, "cloth");
  return (
    <group position={[0, 0.34, -0.145]} rotation={[0.15, Math.PI / 2, 0]}>
      {/* くるんと 丸まった しば犬の しっぽ */}
      <mesh material={tanMat}>
        <torusGeometry args={[0.055, 0.028, 10, 20, Math.PI * 1.45]} />
      </mesh>
      <mesh position={[-0.01, 0.052, 0]} material={creamMat}>
        <sphereGeometry args={[0.03, 12, 10]} />
      </mesh>
    </group>
  );
}
