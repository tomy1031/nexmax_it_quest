import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playSfx } from "@/lib/audio";
import { questEvents } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { useLayout, type V3 } from "@/three/layout";
import { player, walkTo } from "@/three/player";

/** ドラッグ（カメラを回す）と、クリックを見分ける（動いた量が多ければクリックにしない）。 */
export function isDrag(e: ThreeEvent<MouseEvent>): boolean {
  return e.delta > 6;
}

/**
 * クリックできる物。クリックすると、approach の地点まで歩いてから「click:<id>」を出す。
 * R3F の onClick だけで作る（VR ではコントローラーの光線が同じ合図になる。docs/design/00_全体設計.md）。
 * 光の玉（クリックできる印）を上に出す。marker の位置は目印（矢印）にも使う。
 */
export function Interactable({
  id,
  approach,
  marker,
  children,
  disabled,
}: {
  id: string;
  /** ここまで歩いてから合図を出す（XZ）。無ければその場で合図を出す。 */
  approach?: [number, number];
  /** 印を出す位置（世界の座標）。 */
  marker: V3;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);

  useEffect(() => {
    useLayout.setState((s) => ({ targets: { ...s.targets, [id]: marker } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, marker[0], marker[1], marker[2]]);

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (disabled || isDrag(e)) return;
    e.stopPropagation();
    if (usePlay.getState().line || usePlay.getState().panel) return;
    playSfx("click");
    const fire = () => questEvents.emit(`click:${id}`);
    if (approach) {
      const d = Math.hypot(player.pos.x - approach[0], player.pos.z - approach[1]);
      if (d < 0.25) fire();
      else walkTo(approach[0], approach[1], fire);
    } else fire();
  };

  return (
    <group
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!disabled) setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {children}
      {!disabled && <Sparkle position={marker} hot={hover} />}
    </group>
  );
}

const sparkleGeo = new THREE.OctahedronGeometry(0.07, 0);
const sparkleMat = new THREE.MeshBasicMaterial({
  color: "#7ff6ff",
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

function Sparkle({ position, hot }: { position: V3; hot: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const tt = s.clock.elapsedTime;
    m.rotation.y = tt * 2;
    m.position.y = position[1] + Math.sin(tt * 3) * 0.04;
    const k = hot ? 1.8 : 1 + Math.sin(tt * 4) * 0.15;
    m.scale.setScalar(k);
  });
  return (
    <mesh
      ref={ref}
      geometry={sparkleGeo}
      material={sparkleMat}
      position={position}
      raycast={() => null}
    />
  );
}
