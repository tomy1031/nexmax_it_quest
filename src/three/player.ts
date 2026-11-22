import * as THREE from "three";
import { clampToWalk, useLayout } from "@/three/layout";

/**
 * 自分（プレイヤー）の位置と行き先。毎フレーム変わるので React の状態には入れない。
 * クリックした所へ歩く・クリックした物の前まで歩いてから合図を出す、をここで受け持つ。
 */
export const player = {
  pos: new THREE.Vector3(),
  yaw: 0,
  target: null as THREE.Vector3 | null,
  onArrive: null as (() => void) | null,
  moving: false,
  /** 場面の切りかえ・アップの間は歩かない。 */
  frozen: false,
  /** ふつうと ちがう姿勢（ベッドで寝ている など）。null なら立っている。 */
  pose: null as null | { kind: "sleep"; pos: [number, number, number]; yaw: number },
};

export function walkTo(x: number, z: number, onArrive?: () => void): void {
  if (player.frozen) return;
  const [cx, cz] = clampToWalk(x, z, useLayout.getState().walk);
  player.target = new THREE.Vector3(cx, 0, cz);
  player.onArrive = onArrive ?? null;
}

/**
 * カメラを、ある向き（自分の後ろから見る向き）へ合わせてほしいとき（場面の側から頼む）。
 * yaw は「自分が向く向き」。CameraRig が次のフレームで受け取り、なめらかに回りこむ。
 */
export const cameraAim = { yaw: null as number | null };

/** 自分を置きなおしたとき、カメラもすぐ後ろへ移す（なめらかに追いかけない）。 */
export const cameraSnap = { pending: true };

export function placePlayer(x: number, z: number, yaw = 0): void {
  player.pose = null;
  player.pos.set(x, 0, z);
  player.yaw = yaw;
  player.target = null;
  player.onArrive = null;
  player.moving = false;
  cameraSnap.pending = true;
}
