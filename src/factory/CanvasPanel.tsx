import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettings } from "@/lib/store";
import { ensureFont, makeCanvas, toTexture } from "@/factory/text-canvas";

/**
 * Canvas に描いた板（看板・電光掲示板・券売機の画面）。
 * draw はデータから毎回描き直す。onPick を渡すと、押した所を Canvas の座標（px）で返す
 * （券売機の画面のボタン。VR ではコントローラーの光線で同じように押せる）。
 */
export function CanvasPanel({
  width,
  height,
  ppm = 300,
  draw,
  fontText = "",
  deps = [],
  onPick,
  emissive = false,
  position,
  rotation,
  doubleSide = false,
}: {
  width: number;
  height: number;
  ppm?: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** 先に読みこむ字（看板に出る字）。 */
  fontText?: string;
  deps?: unknown[];
  onPick?: (x: number, y: number, e: ThreeEvent<MouseEvent>) => void;
  emissive?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  doubleSide?: boolean;
}) {
  const W = Math.round(width * ppm);
  const H = Math.round(height * ppm);
  const [canvas, ctx] = useMemo(() => makeCanvas(W, H), [W, H]);
  const texture = useMemo(() => toTexture(canvas), [canvas]);
  const furigana = useSettings((s) => s.furigana);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let alive = true;
    const paint = () => {
      ctx.clearRect(0, 0, W, H);
      drawRef.current(ctx, W, H);
      texture.needsUpdate = true;
    };
    paint();
    void ensureFont(fontText).then(() => alive && paint());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, W, H, texture, fontText, furigana, ...deps]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={
        onPick
          ? (e) => {
              if (!e.uv) return;
              e.stopPropagation();
              onPick(e.uv.x * W, (1 - e.uv.y) * H, e);
            }
          : undefined
      }
    >
      <planeGeometry args={[width, height]} />
      {emissive ? (
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
        />
      ) : (
        <meshStandardMaterial
          map={texture}
          roughness={0.7}
          side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
        />
      )}
    </mesh>
  );
}
