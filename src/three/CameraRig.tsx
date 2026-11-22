import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { usePlay } from "@/stages/play-store";
import { useLayout } from "@/three/layout";
import { cameraAim, cameraSnap, player } from "@/three/player";

/** カメラの左右の向き（キーで歩くときの向きにも使う）。 */
export const cameraYaw = { value: 0 };

/**
 * カメラ。ふだんは自分の後ろから追う。台本の focus（アップ）では決まった位置へ寄る。
 * ドラッグで向きを変えられ、変えた向きはそのまま保つ（勝手に元へ戻さない。tomy さん 2026-11-22）。
 * 歩いても、カメラの向きは勝手に回さない。向きを戻すのは、場面が変わって自分を置きなおしたときだけ。
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  const focus = usePlay((s) => s.focus);
  const look = useRef(new THREE.Vector3(0, 1.4, 0));
  const drag = useRef({ active: false, x: 0, y: 0, yawOffset: 0, pitch: 0 });
  const baseYaw = useRef(0);
  const turnKeys = useRef(new Set<string>());

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      // 決まったカメラ（家・電車の中）は少し見回せるだけ。追うカメラはぐるりと回せる
      const fixed = useLayout.getState().camera.mode === "fixed";
      const next = drag.current.yawOffset - dx * 0.006;
      drag.current.yawOffset = fixed ? THREE.MathUtils.clamp(next, -1.6, 1.6) : next;
      drag.current.pitch = THREE.MathUtils.clamp(drag.current.pitch + dy * 0.003, -0.25, 0.45);
    };
    const up = () => {
      drag.current.active = false;
    };
    // Q・E キーでもカメラを回せる（十字キーと WASD は歩くだけ。tomy さん 2026-11-22）
    const keyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "q" || k === "e") turnKeys.current.add(k);
    };
    const keyUp = (e: KeyboardEvent) => turnKeys.current.delete(e.key.toLowerCase());
    const blur = () => turnKeys.current.clear();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  const desired = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const layout = useLayout.getState();
    const cam = camera as THREE.PerspectiveCamera;
    // 場面から「この向きを見せて」と頼まれたとき（例: 横断歩道を渡ったら、正面のメトロの入口）
    if (cameraAim.yaw !== null) {
      baseYaw.current = cameraAim.yaw + Math.PI;
      drag.current.yawOffset = 0;
      drag.current.pitch = 0;
      cameraAim.yaw = null;
    }
    // Q で左へ、E で右へ回す（ドラッグと同じ向き）
    const turn = (turnKeys.current.has("q") ? 1 : 0) - (turnKeys.current.has("e") ? 1 : 0);
    if (turn) {
      const next = drag.current.yawOffset + turn * dt * 1.8;
      drag.current.yawOffset =
        layout.camera.mode === "fixed" ? THREE.MathUtils.clamp(next, -1.6, 1.6) : next;
    }
    let fov = 55;
    const shot = focus ? layout.shots[focus] : undefined;
    if (shot) {
      desired.current.set(...shot.pos);
      desiredLook.current.set(...shot.look);
      fov = shot.fov ?? 45;
    } else if (layout.camera.mode === "fixed") {
      desired.current.set(...layout.camera.shot.pos);
      desiredLook.current.set(...layout.camera.shot.look);
      fov = layout.camera.shot.fov ?? 55;
      // 決まったカメラでも、ドラッグで少し見回せる（はなしても、その向きのまま）
      const off = desiredLook.current.clone().sub(desired.current);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), drag.current.yawOffset * 0.5);
      desiredLook.current.copy(desired.current).add(off);
    } else {
      const yaw = baseYaw.current + drag.current.yawOffset;
      cameraYaw.value = yaw + Math.PI;
      const dist = layout.camera.distance ?? 4.2;
      const height = (layout.camera.height ?? 2.4) + drag.current.pitch * 3;
      desired.current.set(
        player.pos.x + Math.sin(yaw) * dist,
        player.pos.y + height,
        player.pos.z + Math.cos(yaw) * dist,
      );
      desiredLook.current.set(player.pos.x, player.pos.y + 0.95, player.pos.z);
    }
    if (layout.bounds) {
      const b = layout.bounds;
      desired.current.x = THREE.MathUtils.clamp(desired.current.x, b.minX, b.maxX);
      desired.current.z = THREE.MathUtils.clamp(desired.current.z, b.minZ, b.maxZ);
      desired.current.y = Math.min(desired.current.y, b.maxY);
    }
    if (cameraSnap.pending) {
      // 場面が変わって自分を置きなおしたときだけ、見回した向きを戻す
      drag.current.yawOffset = 0;
      drag.current.pitch = 0;
      camera.position.copy(desired.current);
      look.current.copy(desiredLook.current);
      if (!shot && layout.camera.mode === "follow") {
        baseYaw.current = player.yaw + Math.PI;
        const yaw = baseYaw.current;
        const dist = layout.camera.distance ?? 4.2;
        camera.position.set(
          player.pos.x + Math.sin(yaw) * dist,
          layout.camera.height ?? 2.4,
          player.pos.z + Math.cos(yaw) * dist,
        );
        if (layout.bounds) {
          const b = layout.bounds;
          camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX, b.maxX);
          camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ, b.maxZ);
          camera.position.y = Math.min(camera.position.y, b.maxY);
        }
      }
      cameraSnap.pending = false;
    } else {
      const k = 1 - Math.exp(-dt * (shot ? 4.5 : 4.5));
      camera.position.lerp(desired.current, k);
      look.current.lerp(desiredLook.current, k);
    }
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
    camera.lookAt(look.current);
  });

  return null;
}
