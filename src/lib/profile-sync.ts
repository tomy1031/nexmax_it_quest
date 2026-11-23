import { supabaseClient, useAuth } from "@/lib/auth";
import { isCohort, isUniversity } from "@/lib/school";
import { DEFAULT_AVATAR, isKatakanaName, useGame, type AvatarConfig } from "@/lib/store";

/**
 * ログインしている人の 設定を、academy と 共有の ユーザーの 表（public.profiles）と そろえる。
 * tomy さん 2026-11-23「ユーザーテーブルは旧のシステムと共有でお願いします」。
 *
 * - ログインしたら、DB の 名前（苗字＋名前）・呼び名・学校・期生を この端末に 写す（DB が 正）。
 *   DB が 空で この端末に ある ものは、DB へ 書く。
 * - この端末で 設定を かえたら、少し 待ってから DB へ 書く。
 * - 3D の アバターは このアプリだけの 表（itquest_avatars）に 置く（同じ 期生の 人の 席に 出すため）。
 *
 * academy の 決まりに 合わせる: 名前は カタカナ、カンボジアは 苗字が 先、呼び名（display_name）は
 * 呼んでほしい名前 → 名前 → 苗字 の 順（academy の src/lib/name.ts）。DB が 止まっているときは 何もしない。
 */

interface ProfileRow {
  family_name: string | null;
  given_name: string | null;
  nickname: string | null;
  university: string | null;
  cohort: number | null;
}

let pulledFor: string | null = null;
/** DB から 写している 間は、その 変化を DB へ 書きもどさない。 */
let applying = false;
let profileTimer: number | null = null;
let avatarTimer: number | null = null;

/** 「ソク ピセット」→ 苗字 ソク・名前 ピセット（カンボジアは 苗字が 先）。 */
export function splitName(full: string): { family: string; given: string } | null {
  const parts = full.normalize("NFKC").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { family: parts[0]!, given: parts.slice(1).join(" ") };
}

export function startProfileSync(): void {
  const uid = () => useAuth.getState().session?.user.id ?? null;
  const onSession = () => {
    const id = uid();
    if (id && id !== pulledFor) void pull(id);
    if (!id) pulledFor = null;
  };
  onSession();
  useAuth.subscribe((s, prev) => {
    if (s.session?.user.id !== prev.session?.user.id) onSession();
  });
  useGame.subscribe((s, prev) => {
    const id = uid();
    if (!id || id !== pulledFor || applying) return;
    if (s.profile !== prev.profile) {
      if (profileTimer) window.clearTimeout(profileTimer);
      profileTimer = window.setTimeout(() => void pushProfile(id), 900);
    }
    if (s.avatar !== prev.avatar) {
      if (avatarTimer) window.clearTimeout(avatarTimer);
      avatarTimer = window.setTimeout(() => void pushAvatar(id), 1500);
    }
  });
}

async function pull(id: string): Promise<void> {
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("family_name, given_name, nickname, university, cohort")
      .eq("id", id)
      .maybeSingle<ProfileRow>();
    if (error || useAuth.getState().session?.user.id !== id) return;
    const game = useGame.getState();
    const local = game.profile;
    const next = { ...local };
    let needPush = false;
    const dbName = [data?.family_name, data?.given_name].filter((x) => x?.trim()).join(" ");
    if (dbName) next.name = dbName;
    else if (splitName(local.name)) needPush = true;
    const dbNick = data?.nickname?.trim() || data?.given_name?.trim() || "";
    if (dbNick) next.nickname = dbNick;
    else if (isKatakanaName(local.nickname)) needPush = true;
    if (isUniversity(data?.university) && isCohort(data?.cohort)) {
      next.university = data.university;
      next.cohort = data.cohort;
    } else if (isUniversity(local.university) && isCohort(local.cohort)) needPush = true;

    applying = true;
    game.setProfile(next);
    applying = false;
    pulledFor = id;
    if (needPush) await pushProfile(id);

    // アバター（このアプリだけの 表）
    const av = await supabase
      .from("itquest_avatars")
      .select("avatar")
      .eq("profile_id", id)
      .maybeSingle<{ avatar: Partial<AvatarConfig> }>();
    if (av.error) return;
    if (av.data?.avatar && typeof av.data.avatar === "object") {
      applying = true;
      game.setAvatar({ ...DEFAULT_AVATAR, ...av.data.avatar });
      applying = false;
    } else {
      await pushAvatar(id);
    }
  } catch {
    applying = false;
  }
}

async function pushProfile(id: string): Promise<void> {
  const p = useGame.getState().profile;
  const row: Record<string, string | number> = {};
  const names = splitName(p.name);
  if (names && isKatakanaName(names.family) && isKatakanaName(names.given)) {
    row.family_name = names.family;
    row.given_name = names.given;
  }
  const nick = p.nickname.normalize("NFKC").trim();
  if (isKatakanaName(nick)) row.nickname = nick;
  const display = (row.nickname as string) || (row.given_name as string) || "";
  if (display) row.display_name = display;
  if (isUniversity(p.university) && isCohort(p.cohort)) {
    row.university = p.university;
    row.cohort = p.cohort;
  }
  if (Object.keys(row).length === 0) return;
  try {
    const supabase = await supabaseClient();
    await supabase.from("profiles").update(row).eq("id", id);
  } catch {
    // DB が 止まっているときは あとで（次に かえたときに）書く
  }
}

async function pushAvatar(id: string): Promise<void> {
  try {
    const supabase = await supabaseClient();
    await supabase.from("itquest_avatars").upsert({
      profile_id: id,
      avatar: useGame.getState().avatar,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // DB が 止まっているときは 何もしない
  }
}
