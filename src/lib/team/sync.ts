import { supabaseClient, useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { TeamMember } from "@/lib/team/store";

/**
 * チームの 保存（docs/design/03_ステージ2.md §2「チームのデータの持ち方」）。
 * academy の quest_saves と 同じ 考え方: **端末には 毎回、DB には 節目だけ**。
 *
 * - save は いつも 端末（localStorage）に 置く。
 * - milestone が true で、メンバーが 全員 DB の 人で、ログインしている ときだけ、
 *   Supabase の itquest_team_saves に 丸ごと 書く（ステージ ＋ メンバーの 組で 1行。あとから 書いた 方が 勝つ）。
 * - ニックネームだけの 人が 入っている 組は、端末だけ。
 * - DB の エラー（表が まだ無い 42P01 / PGRST205 など）は すべて 飲みこむ。遊びは 止めない。
 *   同じ 組の 行が 先に できていた（23505）ときは、その 行を 引き直して 上書きする。
 * 段階2（べつべつの パソコン）では subscribe を 足す。
 */
export interface TeamSync<S> {
  load(key: string): Promise<S | null>;
  save(key: string, state: S, milestone: boolean): void;
}

const TABLE = "itquest_team_saves";
const LOCAL_PREFIX = "nexmax-it-quest:team-save:";

/** DB の 口の 最小の 形（テストで にせものに 入れかえる）。 */
export type TeamDbClient = Awaited<ReturnType<typeof supabaseClient>>;

export interface TeamSyncOptions<S> {
  /** 端末と DB の どちらを 使うか。返した ほうを 使う。無ければ log の 長い ほう（同じなら 端末）。 */
  prefer?: (local: S | null, remote: S | null) => S | null;
  /** テスト用: DB の 口。 */
  client?: () => Promise<TeamDbClient>;
  /** テスト用: ログインしている 人の id。 */
  userId?: () => string | null;
  /** テスト用: 端末の 保存先。 */
  storage?: Pick<Storage, "getItem" | "setItem">;
}

function logLength(s: unknown): number {
  if (s && typeof s === "object" && Array.isArray((s as { log?: unknown }).log)) {
    return (s as { log: unknown[] }).log.length;
  }
  return -1;
}

/** 決まりの 選び方: 両方 あれば log の 長い ほう（同じなら 端末）。log が 無ければ 端末。 */
export function preferFurther<S>(local: S | null, remote: S | null): S | null {
  if (!remote) return local;
  if (!local) return remote;
  return logLength(remote) > logLength(local) ? remote : local;
}

/** DB に 書いて よいか（節目・全員が DB の 人・ログインしていて 自分が 組に いる）。 */
export function canWriteRemote(
  members: TeamMember[],
  userId: string | null,
  milestone: boolean,
): boolean {
  return (
    milestone &&
    userId !== null &&
    members.length >= 1 &&
    members.length <= 4 &&
    members.every((m) => m.db) &&
    members.some((m) => m.id === userId)
  );
}

function sortedIds(ids: readonly string[]): string {
  return [...ids].sort().join(",");
}

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

export function createTeamSync<S>(
  stageId: string,
  members: TeamMember[],
  opts: TeamSyncOptions<S> = {},
): TeamSync<S> & { flush(): Promise<void> } {
  const storage = opts.storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  const getClient = opts.client ?? (isSupabaseConfigured ? supabaseClient : null);
  const userId = opts.userId ?? (() => useAuth.getState().session?.user.id ?? null);
  const prefer = opts.prefer ?? preferFurther;
  const ids = members.map((m) => m.id);
  const memberKey = sortedIds(ids);
  /** 表が 無いと 分かったら、もう 聞きに 行かない。 */
  let tableMissing = false;
  let rowId: string | null = null;
  /** DB への 書きこみを 1つずつ 順に（古い 状態が あとから 着かないように）。 */
  let chain: Promise<unknown> = Promise.resolve();

  const remoteOk = () =>
    Boolean(getClient) && !tableMissing && canWriteRemote(members, userId(), true);

  const readLocal = (key: string): S | null => {
    try {
      const raw = storage?.getItem(LOCAL_PREFIX + key);
      return raw ? (JSON.parse(raw) as S) : null;
    } catch {
      return null;
    }
  };

  async function findRow(): Promise<{ id: string; state: S } | null> {
    const supabase = await getClient!();
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, member_ids, state")
      .eq("stage_id", stageId)
      .contains("member_ids", ids);
    if (error) {
      if (MISSING_TABLE.has(error.code)) tableMissing = true;
      return null;
    }
    const row = ((data ?? []) as { id: string; member_ids: string[] | null; state: S }[]).find(
      (r) => sortedIds(r.member_ids ?? []) === memberKey,
    );
    return row ? { id: row.id, state: row.state } : null;
  }

  async function writeRemote(state: S): Promise<void> {
    const uid = userId();
    if (!uid) return;
    const supabase = await getClient!();
    const payload = {
      stage_id: stageId,
      member_ids: ids,
      state: state as unknown,
      updated_by: uid,
      updated_at: new Date().toISOString(),
    };
    if (!rowId) rowId = (await findRow())?.id ?? null;
    if (tableMissing) return;
    if (rowId) {
      const { error } = await supabase.from(TABLE).update(payload).eq("id", rowId);
      if (error) rowId = null;
      return;
    }
    const { data, error } = await supabase.from(TABLE).insert(payload).select("id").single();
    if (!error) {
      rowId = (data as { id: string } | null)?.id ?? null;
      return;
    }
    if (MISSING_TABLE.has(error.code)) {
      tableMissing = true;
      return;
    }
    if (error.code === "23505") {
      // 同じ 組の 誰かが 先に 作っていた → その 行を 上書き
      rowId = (await findRow())?.id ?? null;
      if (rowId) await supabase.from(TABLE).update(payload).eq("id", rowId);
    }
  }

  return {
    async load(key) {
      const local = readLocal(key);
      if (!remoteOk()) return local;
      let remote: S | null = null;
      try {
        const row = await findRow();
        if (row) {
          rowId = row.id;
          remote = row.state ?? null;
        }
      } catch {
        remote = null;
      }
      return prefer(local, remote);
    },
    save(key, state, milestone) {
      try {
        storage?.setItem(LOCAL_PREFIX + key, JSON.stringify(state));
      } catch {
        // 端末に 書けなくても 遊びは 続く
      }
      if (!milestone || !remoteOk()) return;
      chain = chain.then(() => writeRemote(state)).catch(() => undefined);
    },
    /** DB への 書きこみが 終わるのを 待つ（テスト・画面を 閉じる 前）。 */
    async flush() {
      await chain;
    },
  };
}
