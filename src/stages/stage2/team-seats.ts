import { useMemo } from "react";
import type { AvatarConfig } from "@/lib/store";
import { ensureTeam, memberLook, useTeam } from "@/lib/team/store";

/** 会議室の 席に 座る チームの 人（自分を のぞく。えらんだ 順）。 */
export interface SeatedMember {
  id: string;
  name: string;
  look: AvatarConfig;
}

/** チームの 人（自分は プレイヤーとして 座るので のぞく）。チームの 画面で えらぶと すぐ 座る。 */
export function useSeatedTeam(): SeatedMember[] {
  const members = useTeam((s) => s.members);
  return useMemo(
    () =>
      ensureTeam()
        .slice(1)
        .map((m) => ({ id: m.id, name: m.name, look: { ...memberLook(m), bag: false } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members],
  );
}
