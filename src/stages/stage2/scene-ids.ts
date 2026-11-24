import type { SceneId } from "@/content/schema";

/** ステージ2の 場面の 名前。 */
const STAGE2_SCENES = ["office-floor", "meeting-room"] as const;

export function isStage2Scene(id: SceneId): boolean {
  return (STAGE2_SCENES as readonly string[]).includes(id);
}
