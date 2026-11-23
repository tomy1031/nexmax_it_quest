import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { questEvents } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { Chibi, type ChibiMotion } from "@/three/Chibi";
import { insideWalk, useLayout } from "@/three/layout";
import { placePlayer, player } from "@/three/player";
import { cameraYaw } from "@/three/CameraRig";
import { fireInteractable, interactables } from "@/three/Interactable";
import type { Expression } from "@/three/chibi";
import { expressionOf } from "@/three/expression";

const SPEED = 2.1; // m/s（実際の歩く速さの 1.5 倍くらい。操作と操作の間の歩きを短くする）

/** 自分。クリックした所へ歩く。WASD・矢印キーでも歩ける。近づくと reach:<地点> を出す。 */
export function Player() {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<ChibiMotion>("idle");
  const avatar = useGame((s) => s.avatar);
  const spawn = usePlay((s) => s.spawn);
  const sceneKey = usePlay((s) => s.sceneKey);
  const showPlayer = useLayout((s) => s.showPlayer);
  // 自分のセリフに合わせた表情（びっくり・考える・にこにこ）。判定で「不正解」のときは考える顔
  const line = usePlay((s) => s.line);
  const verdict = usePlay((s) => s.verdict);
  const expression: Expression = verdict
    ? verdict.ok
      ? "happy"
      : "thinking"
    : line?.who === "me"
      ? expressionOf(line.text)
      : "normal";
  const keys = useRef(new Set<string>());
  const inside = useRef(new Set<string>());
  /** 十字キーで 物の前に入って 合図を出した物（出たら また出せる）。 */
  const touched = useRef<string | null>(null);

  // はじめに立つ所
  useEffect(() => {
    const place = () => {
      const a = useLayout.getState().anchors[spawn];
      if (a) placePlayer(a.pos[0], a.pos[2], a.yaw ?? 0);
      inside.current.clear();
    };
    place();
    return useLayout.subscribe((s, prev) => {
      if (s.anchors !== prev.anchors) place();
    });
  }, [spawn, sceneKey]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      keys.current.add(e.key.toLowerCase());
      // Enter・スペース: 近くの物を押す（セリフ・問題が出ている間は「つぎへ」なので、ここでは何もしない）
      if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON") {
        const p = usePlay.getState();
        if (p.line || p.panel || p.choice || p.tip || p.verdict || p.dream) return;
        const want = p.waitingFor?.startsWith("click:") ? p.waitingFor.slice(6) : null;
        const near = (a?: [number, number]) =>
          a ? Math.hypot(player.pos.x - a[0], player.pos.z - a[1]) : 0;
        const w = want ? interactables.get(want) : undefined;
        if (want && w && !w.disabled && (!w.approach || near(w.approach) < 1.6)) {
          e.preventDefault();
          fireInteractable(want);
          return;
        }
        let best: string | null = null;
        let bd = 1.2;
        for (const [id, it] of interactables) {
          if (it.disabled || !it.approach) continue;
          const d = near(it.approach);
          if (d < bd) {
            bd = d;
            best = id;
          }
        }
        if (best) {
          e.preventDefault();
          fireInteractable(best);
        }
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const tmp = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;
    const { walk, triggers, blocks } = useLayout.getState();
    const play = usePlay.getState();
    const blocked =
      player.frozen ||
      Boolean(player.pose) ||
      Boolean(play.line || play.panel || play.choice || play.tip || play.focus);

    // キーで歩く（カメラの向きに合わせる）
    const k = keys.current;
    let kx = 0;
    let kz = 0;
    if (k.has("w") || k.has("arrowup")) kz -= 1;
    if (k.has("s") || k.has("arrowdown")) kz += 1;
    if (k.has("a") || k.has("arrowleft")) kx -= 1;
    if (k.has("d") || k.has("arrowright")) kx += 1;
    let moving = false;
    if (!blocked && (kx || kz)) {
      player.target = null;
      player.path = [];
      player.onArrive = null;
      const yaw = cameraYaw.value;
      const dir = tmp.current
        .set(kx, 0, kz)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const nx = player.pos.x + dir.x * SPEED * dt;
      const nz = player.pos.z + dir.z * SPEED * dt;
      if (insideWalk(nx, nz, walk, blocks)) {
        player.pos.x = nx;
        player.pos.z = nz;
      } else if (insideWalk(nx, player.pos.z, walk, blocks)) player.pos.x = nx;
      else if (insideWalk(player.pos.x, nz, walk, blocks)) player.pos.z = nz;
      player.yaw = Math.atan2(dir.x, dir.z);
      moving = true;
    } else if (!blocked && player.target) {
      const d = tmp.current.copy(player.target).sub(player.pos).setY(0);
      const dist = d.length();
      if (dist < 0.06 && player.path.length) {
        // とちゅうの地点に着いた。次の地点へ
        player.target = player.path.shift()!;
      } else if (dist < 0.06) {
        player.target = null;
        const cb = player.onArrive;
        player.onArrive = null;
        cb?.();
      } else {
        const step = Math.min(dist, SPEED * dt);
        d.normalize();
        const nx = player.pos.x + d.x * step;
        const nz = player.pos.z + d.z * step;
        // 道は家具を よけて作ってあるので、ここでは 歩ける四角だけを見る（角で止まらないように）
        if (insideWalk(nx, nz, walk)) {
          player.pos.x = nx;
          player.pos.z = nz;
          const want = Math.atan2(d.x, d.z);
          let diff = want - player.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          player.yaw += diff * Math.min(1, dt * 10);
          moving = true;
        } else {
          player.target = null;
          player.path = [];
          player.onArrive = null;
        }
      }
    }
    player.moving = moving;
    // 十字キーで、待っている物の前に入ったら、そのまま押したことにする（ドア・階段・券売機など）
    if (!blocked && (kx !== 0 || kz !== 0)) {
      const want = play.waitingFor?.startsWith("click:") ? play.waitingFor.slice(6) : null;
      const it = want ? interactables.get(want) : undefined;
      if (want && it?.approach && !it.disabled) {
        const d = Math.hypot(player.pos.x - it.approach[0], player.pos.z - it.approach[1]);
        if (d < 0.45 && touched.current !== want) {
          touched.current = want;
          fireInteractable(want);
        } else if (d > 0.8 && touched.current === want) touched.current = null;
      }
    }
    if (player.pose?.kind === "sleep") {
      // ベッドで あおむけに寝ている（頭は yaw の向き。顔は上）
      motion.current = "sleep";
      g.position.set(...player.pose.pos);
      g.rotation.set(-Math.PI / 2, player.pose.yaw, 0, "YXZ");
      return;
    }
    motion.current = moving ? "walk" : "idle";
    g.position.copy(player.pos);
    g.rotation.set(0, player.yaw, 0);

    // 近づいたら reach:<id>
    for (const tr of triggers) {
      const inZone = Math.hypot(player.pos.x - tr.x, player.pos.z - tr.z) < tr.r;
      if (inZone && !inside.current.has(tr.id)) {
        inside.current.add(tr.id);
        questEvents.emit(`reach:${tr.id}`);
      } else if (!inZone) inside.current.delete(tr.id);
    }
  });

  return (
    <group ref={group} visible={showPlayer}>
      <Suspense fallback={null}>
        <Chibi config={avatar} motionRef={motion} expression={expression} />
      </Suspense>
    </group>
  );
}
