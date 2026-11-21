import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { usePlay } from "@/stages/play-store";
import { useLayout } from "@/three/layout";
import { cameraSnap, player } from "@/three/player";

/** カメラの左右の向き（キーで歩くときの向きにも使う）。 */
export const cameraYaw = { value: 0 };

/**
 * カメラ。ふだんは自分の後ろから追う。台本の focus（アップ）では決まった位置へ寄る。
 * ドラッグで左右を少し見回せる（はなすと、ゆっくり後ろへもどる）。ゲームに慣れていない人が迷わないように、
 * カメラは自分で大きく回さなくてよい作りにする（Fable 5.2 のレビュー）。
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  const focus = usePlay((s) => s.focus);
  const look = useRef(new THREE.Vector3(0, 1.4, 0));
  const drag = useRef({ active: false, x: 0, y: 0, yawOffset: 0, pitch: 0 });
  const baseYaw = useRef(0);

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
      drag.current.yawOffset = THREE.MathUtils.clamp(
        drag.current.yawOffset - dx * 0.006,
        -1.6,
        1.6,
      );
      drag.current.pitch = THREE.MathUtils.clamp(drag.current.pitch + dy * 0.003, -0.25, 0.45);
    };
    const up = () => {
      drag.current.active = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
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
      if (!drag.current.active) drag.current.yawOffset *= 1 - Math.min(1, dt * 1.2);
      // 決まったカメラでも、ドラッグで少し見回せる
      const off = desiredLook.current.clone().sub(desired.current);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), drag.current.yawOffset * 0.5);
      desiredLook.current.copy(desired.current).add(off);
    } else {
      // 歩いている向きへ、ゆっくり回りこむ
      if (player.moving) {
        let diff = player.yaw + Math.PI - baseYaw.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        baseYaw.current += diff * Math.min(1, dt * 1.6);
      }
      if (!drag.current.active) {
        drag.current.yawOffset *= 1 - Math.min(1, dt * 0.6);
        drag.current.pitch *= 1 - Math.min(1, dt * 0.6);
      }
      const yaw = baseYaw.current + drag.current.yawOffset;
      cameraYaw.value = yaw + Math.PI;
      const dist = layout.camera.distance ?? 4.2;
      const height = (layout.camera.height ?? 2.4) + drag.current.pitch * 3;
      desired.current.set(
        player.pos.x + Math.sin(yaw) * dist,
        player.pos.y + height,
        player.pos.z + Math.cos(yaw) * dist,
      );
      desiredLook.current.set(player.pos.x, player.pos.y + 1.35, player.pos.z);
    }
    if (layout.bounds) {
      const b = layout.bounds;
      desired.current.x = THREE.MathUtils.clamp(desired.current.x, b.minX, b.maxX);
      desired.current.z = THREE.MathUtils.clamp(desired.current.z, b.minZ, b.maxZ);
      desired.current.y = Math.min(desired.current.y, b.maxY);
    }
    if (cameraSnap.pending) {
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
