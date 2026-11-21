import { useMemo } from "react";
import { t } from "@/lib/t";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { box, FLAT, merge } from "@/factory/kit";
import { STATION } from "@/factory/signs";
import { drawRuby, roundRect } from "@/factory/text-canvas";

/**
 * 小さな物（ICOCA のカード・電話・領収書）。豆知識の絵（scripts/shots.mjs）と場面で使う。
 * カードの絵柄は本物（商標）をまねない。青い地に名前だけ。
 */
export function IcocaCard({
  position,
  rotation,
  pass = true,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  pass?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <CanvasPanel
        width={0.0856 * 4}
        height={0.054 * 4}
        ppm={1600}
        doubleSide
        fontText={`${t("tm.section")}${STATION.tennoji?.name}${STATION.awaza?.name}`}
        draw={(ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, "#7ad7ff");
          g.addColorStop(1, "#2a6cff");
          roundRect(ctx, 0, 0, w, h, h * 0.08);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = `900 ${h * 0.22}px sans-serif`;
          ctx.fillText("ICOCA", w * 0.07, h * 0.3);
          if (pass) {
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            roundRect(ctx, w * 0.06, h * 0.45, w * 0.88, h * 0.44, h * 0.05);
            ctx.fill();
            drawRuby(ctx, `${STATION.tennoji?.name} ⇄ ${STATION.awaza?.name}`, w * 0.5, h * 0.8, {
              size: h * 0.17,
              color: "#16264d",
              rubyColor: "#0a6bd6",
              align: "center",
            });
          }
        }}
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
          drawRuby(ctx, `25,500 ${t("tm.yen")}`, w * 0.92, h * 0.8, {
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
