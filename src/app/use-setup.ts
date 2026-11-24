import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isSetupComplete, useGame } from "@/lib/store";

/**
 * 必須の設定（名前・ニックネーム・ログイン）がそろったか。
 * ログインが 必須なのは、Supabase の 設定が あって、ログインの サーバーが 答える ときだけ。
 * サーバーが 止まっている（無料の 枠を 超えた など）ときは、名前と ニックネームだけで 進める
 * （tomy さん 2026-11-24「ログイン実装されてない状態の時は情報入れたら進めるようにできますか？」）。
 */
export function useLoginRequired(): boolean {
  const problem = useAuth((s) => s.problem);
  return isSupabaseConfigured && problem === null;
}

export function useSetupComplete(): boolean {
  const profile = useGame((s) => s.profile);
  const session = useAuth((s) => s.session);
  const loginRequired = useLoginRequired();
  return isSetupComplete(profile, { loginRequired, loggedIn: Boolean(session) });
}
