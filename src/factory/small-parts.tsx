import { useMemo } from "react";
import { t } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { drawIcocaCard, passFontText, passPrice } from "@/factory/icoca-card";
import { useGame } from "@/lib/store";
import { box, FLAT, merge } from "@/factory/kit";
import { STATION } from "@/factory/signs";
import { drawRuby } from "@/factory/text-canvas";

/**
 * 小さな物（ICOCA のカード・電話・領収書）。豆知識の絵（scripts/shots.mjs）と場面で使う。
 * ICOCA の券面は本物の並びに合わせ、ロゴとキャラクターの絵は描かない（src/factory/icoca-card.ts）。
 */
/** ICOCA（定期券入り）。券面は src/factory/icoca-card.ts（本物の券面の並びに合わせた絵）。 */
export function IcocaCard({
  position,
  rotation,
  pass = true,
  sampleName,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  pass?: boolean;
  /** 豆知識の絵などで使う見本の名前（無ければ、学生の名前）。 */
  sampleName?: string;
}) {
  const own = useGame((s) => s.profile.name);
  const name = sampleName ?? own;
  const start = useGame((s) => s.passStart);
  const info = { pass, name, start };
  return (
    <group position={position} rotation={rotation}>
      <CanvasPanel
        width={0.0856 * 4}
        height={0.054 * 4}
        ppm={1800}
        doubleSide
        emissive
        transparent
        fontText={passFontText(info)}
        deps={[pass, name, start]}
        draw={(ctx, w, h) => drawIcocaCard(ctx, w, h, info)}
      />
    </group>
  );
}

export function Phone({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const geo = useMemo(() => merge([box(0.075, 0.155, 0.009, "#22262e")]), []);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} material={FLAT} />
      <CanvasPanel
        width={0.066}
        height={0.138}
        ppm={3000}
        position={[0, 0, 0.0051]}
        emissive
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#13324f";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#3ccf7a";
          ctx.beginPath();
          ctx.arc(w * 0.3, h * 0.82, w * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ff5a4a";
          ctx.beginPath();
          ctx.arc(w * 0.7, h * 0.82, w * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = `${w * 0.4}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("📞", w / 2, h * 0.4);
        }}
      />
    </group>
  );
}

export function Receipt({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <CanvasPanel
        width={0.16}
        height={0.24}
        ppm={2400}
        doubleSide
        fontText={`${t("tm.section")}${t("tm.yen")}${t("tm.m3")}`}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#fbfbf6";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#16264d";
          ctx.font = `900 ${h * 0.08}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("RECEIPT", w / 2, h * 0.14);
          ctx.textAlign = "left";
          drawRuby(ctx, `${STATION.tennoji?.name} ⇄ ${STATION.awaza?.name}`, w * 0.08, h * 0.38, {
            size: h * 0.07,
            color: "#16264d",
            rubyColor: "#0a6bd6",
          });
          drawRuby(ctx, t("tm.m3"), w * 0.08, h * 0.55, {
            size: h * 0.07,
            color: "#16264d",
            rubyColor: "#0a6bd6",
          });
          ctx.fillRect(w * 0.08, h * 0.65, w * 0.84, h * 0.005);
          // 金額は 券売機と同じ データ（content/places.json の passFare）から
          drawRuby(ctx, `${passPrice(3).toLocaleString()} ${t("tm.yen")}`, w * 0.92, h * 0.8, {
            size: h * 0.09,
            color: "#16264d",
            rubyColor: "#0a6bd6",
            align: "right",
          });
        }}
      />
    </group>
  );
}

/**
 * ノートパソコン（polyfork の laptop）と、その画面の絵。
 * 画面の位置・かたむきは モデルの ふた（lid）から計算した: ふたは うしろへ 約17度 かたむき（-0.297 rad）、
 * ふたの大きさは 0.312 x 0.208m、中心は 置いた所から 上へ 0.123m・うしろへ 0.134m。
 * 絵は ふたの面より 6mm 前に、ふちを少し残して 0.27 x 0.17m で貼る（はみ出さない）。
 */
export const LAPTOP_SCREEN = {
  offset: [0, 0.1248, -0.1287] as [number, number, number],
  rotation: [-0.297, 0, 0] as [number, number, number],
  width: 0.27,
  height: 0.17,
};

export function LaptopScreen({
  position,
  draw,
  ppm = 1200,
  fontText,
}: {
  /** ノートパソコンを置いた所（Prop の position と同じ）。 */
  position: [number, number, number];
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  ppm?: number;
  fontText?: string;
}) {
  const [ox, oy, oz] = LAPTOP_SCREEN.offset;
  return (
    <CanvasPanel
      width={LAPTOP_SCREEN.width}
      height={LAPTOP_SCREEN.height}
      ppm={ppm}
      position={[position[0] + ox, position[1] + oy, position[2] + oz]}
      rotation={LAPTOP_SCREEN.rotation}
      emissive
      fontText={fontText}
      draw={draw}
    />
  );
}
