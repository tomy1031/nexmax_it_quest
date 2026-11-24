import type { AvatarConfig } from "@/lib/store";

/** 会議室の 席に 座る チームの 人（自分を のぞく。えらんだ 順）。 */
export interface SeatedMember {
  id: string;
  name: string;
  look: AvatarConfig;
}

/** チームの 人（チームの 部品が 入るまでは だれも いない）。 */
export function useSeatedTeam(): SeatedMember[] {
  return [];
}
