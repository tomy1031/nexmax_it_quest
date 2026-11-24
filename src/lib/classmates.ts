import { supabaseClient, useAuth } from "@/lib/auth";
import { isDevTools } from "@/lib/env";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/lib/store";

/**
 * 同じ 学校・期生の メンバー（入社式の 会場の 席に 座らせる。tomy さん 2026-11-23）。
 * DB の 関数 itquest_classmates() が、呼び名・せいべつ・アバターだけを 返す（メールなどは 返さない）。
 * ログインしていない・学校と 期生を えらんでいない・DB が 止まっている ときは 空（会場は 名前の 無い 人で うめる）。
 */
export interface Classmate {
  id: string;
  name: string;
  gender: "male" | "female" | null;
  avatar: Partial<AvatarConfig> | null;
}

declare global {
  interface Window {
    /** e2e の テスト・開発の 道具が 置く、にせの メンバー（ログインせずに 席の 見た目を ためす）。 */
    __fakeClassmates?: Classmate[];
  }
}

export async function fetchClassmates(): Promise<Classmate[]> {
  if (isDevTools && typeof window !== "undefined" && window.__fakeClassmates) {
    return window.__fakeClassmates;
  }
  if (!useAuth.getState().session) return [];
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase.rpc("itquest_classmates");
    if (error || !Array.isArray(data)) return [];
    return (
      data as { id: string; display_name: string | null; gender: string | null; avatar: unknown }[]
    ).map((r) => ({
      id: r.id,
      name: (r.display_name ?? "").trim(),
      gender: r.gender === "male" || r.gender === "female" ? r.gender : null,
      avatar: r.avatar && typeof r.avatar === "object" ? (r.avatar as Partial<AvatarConfig>) : null,
    }));
  } catch {
    return [];
  }
}

const SKINS = ["#fde5d0", "#f5d5b8", "#f0c9a6", "#e8bc96", "#ddb086", "#d19e72"];
const HAIRS = ["#2e211b", "#4a3326", "#3a2820", "#5e4030"];
const SUITS = ["#1c1e24", "#232f52", "#3a3d45", "#2f3a5e"];
const M_STYLES: AvatarConfig["hairStyle"][] = ["model", "side", "spiky", "twoblock", "center"];
const F_STYLES: AvatarConfig["hairStyle"][] = ["bob", "long", "ponytail", "bun", "halfup", "lob"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * 席に 座る ときの 見た目。アバターを 保存している 人は それを 使い、入社式なので スーツに する。
 * 保存していない 人は、id から 決まった 見た目（せいべつに 合わせる）。
 */
export function classmateLook(c: Classmate): AvatarConfig {
  if (c.avatar)
    return {
      ...DEFAULT_AVATAR,
      ...c.avatar,
      outfit: "suit",
      bag: false,
      bagStyle: "none",
      hat: "none",
      neckwear: "none",
    };
  const h = hash(c.id);
  const female = c.gender === "female";
  const styles = female ? F_STYLES : M_STYLES;
  return {
    ...DEFAULT_AVATAR,
    outfit: "suit",
    bag: false,
    figure: female ? "f" : "m",
    hairStyle: styles[h % styles.length]!,
    skin: SKINS[(h >>> 3) % SKINS.length]!,
    hair: HAIRS[(h >>> 6) % HAIRS.length]!,
    suit: SUITS[(h >>> 9) % SUITS.length]!,
    height: female ? 156 + ((h >>> 12) % 10) : 164 + ((h >>> 12) % 14),
    eyes: (["round", "smile", "calm", "sparkle"] as const)[(h >>> 15) % 4]!,
    glasses: (h >>> 18) % 6 === 0,
  };
}

/**
 * 席の 割りふり。後ろの 列から 前へ うめる（前の 席は あきやすい。前に 座ると「やる気が ある」の 豆知識）。
 * seats は 後ろから 前の 順に ならべて 渡す。人が 足りなければ 残りの 席は あく。
 */
export function assignSeats<S, P>(
  seats: readonly S[],
  people: readonly P[],
): { seat: S; who: P }[] {
  return people.slice(0, seats.length).map((who, i) => ({ seat: seats[i]!, who }));
}
