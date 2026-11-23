import type { SceneId } from "@/content/schema";
import { HomeScene } from "@/stages/stage1/HomeScene";
import { StreetScene } from "@/stages/stage1/StreetScene";
import { ConcourseScene } from "@/stages/stage1/ConcourseScene";
import { PlatformScene } from "@/stages/stage1/PlatformScene";
import { TrainScene } from "@/stages/stage1/TrainScene";
import { HommachiScene } from "@/stages/stage1/HommachiScene";
import { OfficeHallScene, OfficeLobbyScene } from "@/stages/stage1/OfficeScenes";

/** 台本の scene の名前 → 3D の場面。 */
export function Stage1Scene({ id }: { id: SceneId }) {
  switch (id) {
    case "home":
      return <HomeScene />;
    case "street":
      return <StreetScene />;
    case "tennoji-concourse":
      return <ConcourseScene />;
    case "tennoji-platform":
      return <PlatformScene placeId="tennoji" />;
    case "train-midosuji":
      return <TrainScene line="midosuji" crowded />;
    case "hommachi":
      return <HommachiScene />;
    case "hommachi-chuo":
      return <PlatformScene placeId="hommachi-chuo" />;
    case "train-chuo":
      return <TrainScene line="chuo" crowded={false} />;
    case "awaza":
      return <PlatformScene placeId="awaza" />;
    case "office-lobby":
      return <OfficeLobbyScene />;
    case "office-hall":
      return <OfficeHallScene />;
  }
}
