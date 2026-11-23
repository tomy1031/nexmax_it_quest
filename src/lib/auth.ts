import { create } from "zustand";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Google ログイン（Supabase）。設定が無いときは何もしない（デモモード）。
 * supabase-js は大きいので、ログインを使うときだけ読みこむ。
 *
 * Supabase は academy と同じプロジェクト（学生の Google ログインと、管理者の印を共通にする。tomy さん 2026-11-23
 * 「supabaseでのGoogleログインを可能にして欲しい」「DBで管理者の場合は管理者画面の表示を可能としたい」）。
 * 管理者の印は academy と同じ public.profiles.is_admin（本人は自分の行だけ読める。書きかえは DB が止める）。
 */

interface AuthState {
  ready: boolean;
  session: Session | null;
  email: string | null;
  /** DB で管理者になっている人か（profiles.is_admin）。ログインしていないときは false。 */
  isAdmin: boolean;
  /** ログインの道（Supabase）が使えないとき、その理由（画面に出す）。 */
  problem: "unreachable" | null;
}

export const useAuth = create<AuthState>(() => ({
  ready: !isSupabaseConfigured,
  session: null,
  email: null,
  isAdmin: false,
  problem: null,
}));

let client: Promise<SupabaseClient> | null = null;

/** Supabase の口（ログインした人として DB を読み書きするときにも使う）。 */
export function supabaseClient(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    }),
  );
  return client;
}

async function refreshAdmin(session: Session | null): Promise<void> {
  if (!session) {
    useAuth.setState({ isAdmin: false });
    return;
  }
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();
    // 別の人に入れかわっていたら使わない
    if (useAuth.getState().session?.user.id !== session.user.id) return;
    useAuth.setState({ isAdmin: !error && data?.is_admin === true });
  } catch {
    useAuth.setState({ isAdmin: false });
  }
}

/**
 * ログインの道（Supabase の Auth）が答えるかを先に見る。止まっているとき（無料の枠を超えた など）に、
 * Google の画面へ飛んでから 英語のエラーの画面で止まる、ということが ないように。
 */
async function loginServiceOk(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function initAuth(): Promise<void> {
  if (!isSupabaseConfigured) return;
  void loginServiceOk().then((ok) => {
    if (!ok) useAuth.setState({ problem: "unreachable" });
  });
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase.auth.getSession();
    useAuth.setState({
      ready: true,
      session: data.session,
      email: data.session?.user.email ?? null,
      ...(error ? { problem: "unreachable" as const } : {}),
    });
    void refreshAdmin(data.session);
    supabase.auth.onAuthStateChange((_event, session) => {
      useAuth.setState({ session, email: session?.user.email ?? null });
      // onAuthStateChange の中で待つと supabase-js が止まることがあるので、外で読む
      window.setTimeout(() => void refreshAdmin(session), 0);
    });
  } catch {
    useAuth.setState({ ready: true, problem: "unreachable" });
  }
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await supabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}settings` },
  });
  if (error) useAuth.setState({ problem: "unreachable" });
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseClient();
  await supabase.auth.signOut();
  useAuth.setState({ isAdmin: false });
}
