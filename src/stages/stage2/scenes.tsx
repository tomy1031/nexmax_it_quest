import type { SceneId } from "@/content/schema";
import { MeetingRoomScene } from "@/stages/stage2/MeetingRoomScene";
import { OfficeFloorScene } from "@/stages/stage2/OfficeFloorScene";

/** 台本の scene の名前 → 3D の場面（ステージ2）。 */
export function Stage2Scene({ id }: { id: SceneId }) {
  switch (id) {
    case "office-floor":
      return <OfficeFloorScene />;
    case "meeting-room":
      return <MeetingRoomScene />;
    default:
      return null;
  }
}
