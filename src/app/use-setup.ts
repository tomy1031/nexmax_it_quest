import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isSetupComplete, useGame } from "@/lib/store";

/** 必須の設定（名前・ニックネーム・ログイン）がそろったか。 */
export function useSetupComplete(): boolean {
  const profile = useGame((s) => s.profile);
  const session = useAuth((s) => s.session);
  return isSetupComplete(profile, {
    loginRequired: isSupabaseConfigured,
    loggedIn: Boolean(session),
  });
}
