import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FLAT } from "@/factory/kit";

const BASE = import.meta.env.BASE_URL;

/**
 * polyfork の部品をたくさん置くための道具。
 * - Many: 同じ部品をまとめて置く（InstancedMesh。何十本置いても描画は部品の形の数だけ）。
 * - recolor: 頂点の色を置きかえる（イチョウを秋の黄色に、など。模型そのものは変えない）。
 */

export type Recolor = (r: number, g: number, b: number) => [number, number, number] | null;

/** 秋の色: 緑の葉を黄色（イチョウ）に。 */
export const AUTUMN_GINKGO: Recolor = (r, g, b) => {
  if (g > r * 1.08 && g > b * 1.15) {
    const v = (r + g + b) / 3;
    const k = 0.55 + v * 1.4;
    return [Math.min(1, 0.95 * k), Math.min(1, 0.68 * k), 0.06 * k];
  }
  return null;
};

/** 秋の色: 桜の花（ピンク）を、紅葉の赤とだいだいに。 */
export const AUTUMN_MAPLE: Recolor = (r, g, b) => {
  if (r > g * 1.15 && r > b * 0.95 && r > 0.35) {
    const v = (r + g + b) / 3;
    return v > 0.55 ? [0.95, 0.42, 0.08] : [0.78, 0.16, 0.06];
  }
  return null;
};

function applyRecolor(obj: THREE.Object3D, recolor: Recolor): void {
  const c = new THREE.Color();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry = m.geometry.clone();
    const col = m.geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!col) return;
    for (let i = 0; i < col.count; i += 1) {
      // 頂点の色は linear。判定は見た目の色（sRGB）で行う
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).convertLinearToSRGB();
      const out = recolor(c.r, c.g, c.b);
      if (!out) continue;
      c.setRGB(out[0], out[1], out[2]).convertSRGBToLinear();
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  });
}

/** 部品を1つ置く（素材は共通の FLAT）。 */
export function Prop({
  url,
  position,
  rotationY = 0,
  scale = 1,
  recolor,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
  recolor?: Recolor;
}) {
  const gltf = useGLTF(`${BASE}models/${url}.glb`);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.material = FLAT;
    });
    if (recolor) applyRecolor(o, recolor);
    return o;
  }, [gltf, recolor]);
  return <primitive object={obj} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

export interface Place {
  p: [number, number, number];
  r?: number;
  s?: number;
}

/** 同じ部品をたくさん置く（タイル・木・電柱・看板など）。 */
export function Many({ url, at, recolor }: { url: string; at: Place[]; recolor?: Recolor }) {
  const gltf = useGLTF(`${BASE}models/${url}.glb`);
  const parts = useMemo(() => {
    const src = gltf.scene.clone(true);
    if (recolor) applyRecolor(src, recolor);
    src.updateMatrixWorld(true);
    const list: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) list.push({ geo: m.geometry, matrix: m.matrixWorld.clone() });
    });
    return list;
  }, [gltf, recolor]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const key = JSON.stringify(at);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    parts.forEach((part, i) => {
      const im = refs.current[i];
      if (!im) return;
      at.forEach((pl, j) => {
        e.set(0, pl.r ?? 0, 0);
        q.setFromEuler(e);
        const s = pl.s ?? 1;
        m.compose(new THREE.Vector3(...pl.p), q, new THREE.Vector3(s, s, s)).multiply(part.matrix);
        im.setMatrixAt(j, m);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, key]);
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh
          key={i}
          ref={(r) => void (refs.current[i] = r)}
          args={[part.geo, FLAT, at.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/** 空（上が青く、地平線が白っぽい大きな球）。 */
export function SkyDome({
  top = "#5aa8f0",
  bottom = "#e8f4ff",
}: {
  top?: string;
  bottom?: string;
}) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(180, 32, 16);
    const pos = g.getAttribute("position");
    const cols = new Float32Array(pos.count * 3);
    const a = new THREE.Color(top).convertSRGBToLinear();
    const b = new THREE.Color(bottom).convertSRGBToLinear();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const y = Math.max(0, pos.getY(i) / 180);
      c.copy(b).lerp(a, Math.pow(y, 0.6));
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    return g;
  }, [top, bottom]);
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshBasicMaterial
        vertexColors
        side={THREE.BackSide}
        fog={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** ゆっくり流れる雲（白い平たい箱のかたまり）。 */
export function Clouds({ count = 8, y = 45 }: { count?: number; y?: number }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: -90 + ((i * 173) % 180),
        z: -70 + ((i * 97) % 140),
        s: 6 + (i % 3) * 3,
      })),
    [count],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((c) => {
      c.position.x += dt * 0.8;
      if (c.position.x > 100) c.position.x = -100;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, y + (i % 4) * 3, c.z]} scale={c.s}>
          <mesh position={[0, 0, 0]} raycast={() => null}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffffff" fog={false} />
          </mesh>
          <mesh position={[1.1, -0.2, 0.2]} raycast={() => null}>
            <sphereGeometry args={[0.8, 8, 6]} />
            <meshBasicMaterial color="#ffffff" fog={false} />
          </mesh>
          <mesh position={[-1.1, -0.25, -0.1]} raycast={() => null}>
            <sphereGeometry args={[0.75, 8, 6]} />
            <meshBasicMaterial color="#f4f8ff" fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
