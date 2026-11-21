/**
 * 環境変数の入口（AGENTS.md「環境変数は import.meta.env を直接読まず、ここを通す」）。
 * VITE_ で始まる値はビルドしたファイルに文字のまま入り、ブラウザから見える。秘密の値は置かない。
 */
const env = import.meta.env;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY ?? "";

/** Supabase の設定があるか。無ければログインなし（デモモード）で動く。 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** 開発・テストのときだけ使う道具（window.__quest）を出すか。 */
export const isDevTools = env.DEV || env.MODE === "test" || env.VITE_E2E === "1";

/**
 * アプリを置く場所の頭（GitHub Pages なら "/nexmax_it_quest/"、Cloudflare なら "/"）。ビルドのときの VITE_BASE で決まる。
 * ページの切りかえ（wouter）は、末尾の "/" を取ったものを使う。
 */
export const BASE_URL: string = env.BASE_URL;
export const ROUTER_BASE: string = BASE_URL.replace(/\/$/, "");
