import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { questEvents } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { Avatar, type Motion } from "@/three/Avatar";
import { insideWalk, useLayout } from "@/three/layout";
import { placePlayer, player } from "@/three/player";
import { cameraYaw } from "@/three/CameraRig";

const SPEED = 2.1; // m/s（実際の歩く速さの 1.5 倍くらい。操作と操作の間の歩きを短くする）

/** 自分。クリックした所へ歩く。WASD・矢印キーでも歩ける。近づくと reach:<地点> を出す。 */
export function Player() {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>("idle");
  const avatar = useGame((s) => s.avatar);
  const spawn = usePlay((s) => s.spawn);
  const sceneKey = usePlay((s) => s.sceneKey);
  const showPlayer = useLayout((s) => s.showPlayer);
  const keys = useRef(new Set<string>());
  const inside = useRef(new Set<string>());

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
    const { walk, triggers } = useLayout.getState();
    const play = usePlay.getState();
    const blocked =
      player.frozen || Boolean(play.line || play.panel || play.choice || play.tip || play.focus);

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
      player.onArrive = null;
      const yaw = cameraYaw.value;
      const dir = tmp.current
        .set(kx, 0, kz)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const nx = player.pos.x + dir.x * SPEED * dt;
      const nz = player.pos.z + dir.z * SPEED * dt;
      if (insideWalk(nx, nz, walk)) {
        player.pos.x = nx;
        player.pos.z = nz;
      } else if (insideWalk(nx, player.pos.z, walk)) player.pos.x = nx;
      else if (insideWalk(player.pos.x, nz, walk)) player.pos.z = nz;
      player.yaw = Math.atan2(dir.x, dir.z);
      moving = true;
    } else if (!blocked && player.target) {
      const d = tmp.current.copy(player.target).sub(player.pos).setY(0);
      const dist = d.length();
      if (dist < 0.06) {
        player.target = null;
        const cb = player.onArrive;
        player.onArrive = null;
        cb?.();
      } else {
        const step = Math.min(dist, SPEED * dt);
        d.normalize();
        const nx = player.pos.x + d.x * step;
        const nz = player.pos.z + d.z * step;
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
          player.onArrive = null;
        }
      }
    }
    player.moving = moving;
    motion.current = moving ? "walk" : "idle";
    g.position.copy(player.pos);
    g.rotation.y = player.yaw;

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
        <Avatar config={avatar} motionRef={motion} />
      </Suspense>
    </group>
  );
}
