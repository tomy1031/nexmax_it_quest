import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarConfig } from "@/lib/store";
import {
  buildClip,
  dress,
  instantiate,
  loadRawClip,
  MODEL_URL,
  modelFor,
  recolor,
  type ModelKey,
} from "@/three/avatar-model";

const BASE = import.meta.env.BASE_URL;

export type Motion = "idle" | "walk" | "run" | "sitting" | "talking" | "agree";

/**
 * 人（自分・まわりの人）。motion を変えると、なめらかに動きが切りかわる。
 * motionRef を渡すと、毎フレームそこから読む（歩く・止まるを React を通さずに切りかえる）。
 */
export function Avatar({
  config,
  model,
  motion = "idle",
  motionRef,
  phase = 0,
  timeScale = 1,
}: {
  config: AvatarConfig;
  model?: ModelKey;
  motion?: Motion;
  motionRef?: React.RefObject<Motion>;
  phase?: number;
  timeScale?: number;
}) {
  const key = model ?? modelFor(config);
  const gltf = useGLTF(`${BASE}${MODEL_URL[key]}`);
  const colorsKey = JSON.stringify(config);
  const root = useMemo(() => {
    const r = instantiate(gltf);
    recolor(r, config);
    dress(r, config);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, colorsKey]);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const actions = useRef(new Map<Motion, THREE.AnimationAction>());
  const current = useRef<Motion | null>(null);

  useEffect(() => {
    let alive = true;
    const map = actions.current;
    map.clear();
    current.current = null;
    const wanted: Motion[] = ["idle", "walk", "run", "sitting", "talking", "agree"];
    void Promise.all(wanted.map((m) => loadRawClip(m).then((raw) => [m, raw] as const))).then(
      (loaded) => {
        if (!alive) return;
        for (const [m, raw] of loaded) {
          const action = mixer.clipAction(buildClip(raw, root, m));
          action.timeScale = timeScale;
          map.set(m, action);
        }
      },
    );
    return () => {
      alive = false;
      mixer.stopAllAction();
    };
  }, [mixer, root, timeScale]);

  useFrame((_, dt) => {
    const want = motionRef?.current ?? motion;
    if (want !== current.current) {
      const next = actions.current.get(want);
      if (next) {
        const prev = current.current ? actions.current.get(current.current) : undefined;
        next.reset().play();
        if (current.current === null) next.time = phase * next.getClip().duration;
        if (prev) prev.crossFadeTo(next, 0.25, false);
        current.current = want;
      }
    }
    mixer.update(Math.min(dt, 0.1));
  });

  // polyfork の人は 約1.71m で作られている。身長に合わせて全体の大きさを変える（骨の動きはそのまま）
  const scale = (config.height ?? 171) / 171;
  return <primitive object={root} scale={scale} />;
}

for (const url of Object.values(MODEL_URL)) useGLTF.preload(`${BASE}${url}`);
