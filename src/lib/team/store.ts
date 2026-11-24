import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuth } from "@/lib/auth";
import { classmateLook } from "@/lib/classmates";
import { useGame, type AvatarConfig } from "@/lib/store";

/**
 * いっしょに 遊ぶ チーム（ステージ2。docs/design/03_ステージ2.md §2・§5）。
 * 1台の パソコンを 1〜4人で 囲む。1人目は いつも 自分。えらんだ 順が 質問の 順番。
 *
 * - DB の 人（同じ 学校・期生）: id は profiles の uuid、db は true。
 * - ニックネームを 入れた 人: id は "local:<ニックネーム>"、db は false（端末だけに 保存する）。
 *   名前を id に 入れるのは、ちがう 組が 同じ 保存の 鍵に ならないように するため。
 */
export interface TeamMember {
  id: string;
  name: string;
  db: boolean;
  gender?: "male" | "female" | null;
  avatar?: Partial<AvatarConfig> | null;
}

export const LOCAL_ME = "local:me";
export const MAX_TEAM = 4;

interface TeamState {
  members: TeamMember[];
  setMembers: (list: TeamMember[]) => void;
  reset: () => void;
}

export const useTeam = create<TeamState>()(
  persist(
    (set) => ({
      members: [],
      setMembers: (list) => set({ members: list.slice(0, MAX_TEAM) }),
      reset: () => set({ members: [] }),
    }),
    {
      name: "nexmax-it-quest:team",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ members: s.members }),
    },
  ),
);

/** 自分（1人目）。ログインしていれば profiles の id、していなければ "local:me"。 */
export function meMember(): TeamMember {
  const uid = useAuth.getState().session?.user.id ?? null;
  const { profile, avatar } = useGame.getState();
  return {
    id: uid ?? LOCAL_ME,
    name: profile.nickname.trim() || profile.name.trim(),
    db: Boolean(uid),
    gender: avatar.figure === "f" ? "female" : "male",
    avatar: null,
  };
}

function isMe(m: TeamMember): boolean {
  if (m.id === LOCAL_ME) return true;
  const uid = useAuth.getState().session?.user.id ?? null;
  return uid !== null && m.id === uid;
}

/**
 * いまの チーム。まだ えらんでいなければ [自分]。
 * 1人目は いつも いまの 自分に しなおす（ログインした・呼び名を かえた ときに 古い 自分が 残らない）。
 */
export function ensureTeam(): TeamMember[] {
  const me = meMember();
  const rest = useTeam
    .getState()
    .members.slice(1)
    .filter((m) => m.id !== me.id && m.id !== LOCAL_ME);
  return [me, ...rest].slice(0, MAX_TEAM);
}

function nameHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 会議室の 席に 座る ときの 見た目（スーツ）。
 * 自分 → いまの アバターを スーツに。DB の 人で アバターを 保存している → それを スーツに。
 * それ以外 → 決まった 見た目（DB の 人は id から、ニックネームの 人は 名前から）。
 */
export function memberLook(m: TeamMember): AvatarConfig {
  if (isMe(m)) {
    return classmateLook({
      id: m.id,
      name: m.name,
      gender: null,
      avatar: useGame.getState().avatar,
    });
  }
  if (m.db) {
    return classmateLook({
      id: m.id,
      name: m.name,
      gender: m.gender ?? null,
      avatar: m.avatar ?? null,
    });
  }
  const key = `name:${m.name.normalize("NFKC").trim()}`;
  const gender = m.gender ?? (nameHash(key) % 2 === 0 ? "male" : "female");
  return classmateLook({ id: key, name: m.name, gender, avatar: m.avatar ?? null });
}

/** 保存の 鍵。ステージ ＋ 並べ替えた メンバーの id（えらぶ 順が ちがっても 同じ 組なら 同じ 鍵）。 */
export function teamKey(stageId: string, members: TeamMember[]): string {
  return `${stageId}:${members
    .map((m) => m.id)
    .sort()
    .join(",")}`;
}
