import { create } from "zustand";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Google ログイン（Supabase）。設定が無いときは何もしない（デモモード）。
 * supabase-js は大きいので、ログインを使うときだけ読みこむ。
 */

interface AuthState {
  ready: boolean;
  session: Session | null;
  email: string | null;
}

export const useAuth = create<AuthState>(() => ({
  ready: !isSupabaseConfigured,
  session: null,
  email: null,
}));

let client: Promise<SupabaseClient> | null = null;

function getClient(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    }),
  );
  return client;
}

export async function initAuth(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  useAuth.setState({ ready: true, session: data.session, email: data.session?.user.email ?? null });
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, email: session?.user.email ?? null });
  });
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await getClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}settings` },
  });
}

export async function signOut(): Promise<void> {
  const supabase = await getClient();
  await supabase.auth.signOut();
}
