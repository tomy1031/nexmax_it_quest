import { useEffect, useRef } from "react";
import { useGame, useSettings } from "@/lib/store";
import { drawIcocaCard, passFontText } from "@/factory/icoca-card";
import { ensureFont } from "@/factory/text-canvas";

/** 持ち物の ICOCA 定期券（3D のカードと同じ券面の絵を、画面に出す）。 */
export function IcocaPassImage({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const name = useGame((s) => s.profile.name);
  const start = useGame((s) => s.passStart);
  const furigana = useSettings((s) => s.furigana);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const info = { pass: true, name, start };
    const paint = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      drawIcocaCard(ctx, c.width, c.height, info);
    };
    paint();
    let alive = true;
    void ensureFont(passFontText(info)).then(() => alive && paint());
    return () => {
      alive = false;
    };
  }, [name, start, furigana]);
  return (
    <canvas
      ref={ref}
      width={856}
      height={540}
      className={className}
      style={{ aspectRatio: "856 / 540" }}
      data-testid="icoca-pass-image"
    />
  );
}
