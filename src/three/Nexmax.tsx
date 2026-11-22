import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const BASE = import.meta.env.BASE_URL;
export const NEXMAX_URL = `${BASE}models/nexmax/nexmax.glb`;

/**
 * ネクマックスの 3D モデル（tomy1031/lab の yokohama-roll/nexmax/nexmax.glb。tomy さんの指示 2026-11-22）。
 * 身長 1.2m・足もとが原点・正面が +z。りんかく線つき。動き10種と表情4つが入っている。
 *   動き: idle walk run dash wave sit（くりかえす）・jump punch punchL hurt（1回）
 *   表情: happy determined worried surprised（face_* のクリップで切りかえる）
 */
export type NexmaxMotion =
  "idle" | "walk" | "run" | "dash" | "wave" | "sit" | "jump" | "punch" | "punchL" | "hurt";
export type NexmaxFace = "happy" | "determined" | "worried" | "surprised";

const ONCE = new Set<NexmaxMotion>(["jump", "punch", "punchL", "hurt"]);

export function NexmaxModel({
  motion = "idle",
  face = "happy",
}: {
  motion?: NexmaxMotion;
  face?: NexmaxFace;
}) {
  const gltf = useGLTF(NEXMAX_URL);
  const model = useMemo(() => {
    const m = gltf.scene.clone(true);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = () => {};
      mesh.frustumCulled = false;
    });
    return m;
  }, [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const clips = useMemo(() => {
    const map = new Map<string, THREE.AnimationClip>();
    for (const c of gltf.animations) map.set(c.name, c);
    return map;
  }, [gltf]);
  const body = useRef<THREE.AnimationAction | null>(null);
  const faceAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  // 動き（なめらかに切りかえる。1回の動きは終わったら待機にもどる）
  useEffect(() => {
    const clip = clips.get(motion) ?? clips.get("idle");
    if (!clip) return;
    const a = mixer.clipAction(clip);
    a.reset();
    a.setLoop(ONCE.has(motion) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = true;
    if (body.current && body.current !== a) a.crossFadeFrom(body.current, 0.25, false);
    a.play();
    body.current = a;
    if (!ONCE.has(motion)) return;
    const done = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== a) return;
      const idle = clips.get("idle");
      if (!idle) return;
      const b = mixer.clipAction(idle).reset().play();
      b.crossFadeFrom(a, 0.25, false);
      body.current = b;
    };
    mixer.addEventListener("finished", done);
    return () => mixer.removeEventListener("finished", done);
  }, [motion, clips, mixer]);

  // 表情（目と口の部品の大きさを切りかえるクリップ）
  useEffect(() => {
    const clip = clips.get(`face_${face}`);
    if (!clip) return;
    faceAction.current?.stop();
    const a = mixer.clipAction(clip);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    faceAction.current = a;
  }, [face, clips, mixer]);

  useFrame((_, dt) => mixer.update(Math.min(dt, 0.05)));

  return <primitive object={model} />;
}

useGLTF.preload(NEXMAX_URL);
