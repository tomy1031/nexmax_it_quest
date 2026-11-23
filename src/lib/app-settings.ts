import { create } from "zustand";
import { supabaseClient } from "@/lib/auth";
import { setRuntimeReadings } from "@/lib/furigana-index";
import { t } from "@/lib/t";
import { validateAppSettings, type AppSettings } from "@/lib/app-settings-rules";

export { validateAppSettings, type AppSettings };
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * アプリ全体の設定（管理者が 管理者の画面で決める。DB の public.itquest_settings。1行だけ）。
 * いまは「今後の ことに ついては ○○先生から」の先生の名前と読み（tomy さん 2026-11-23。いまは 冨永先生）。
 *
 * 読むのは だれでも（ログインしていなくても）。Supabase の設定が無い・止まっているときは、下の はじめの値を使う。
 * supabase-js は大きいので、読むときは ふつうの fetch で読む（書くときだけ supabase-js を使う）。
 */

/** はじめの値（いまは 冨永先生。content/ui.json の default.teacher*）。 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  teacherName: t("default.teacherName"),
  teacherReading: t("default.teacherReading"),
};

export const useAppSettings = create<AppSettings & { loaded: boolean }>(() => ({
  ...DEFAULT_APP_SETTINGS,
  loaded: false,
}));

const TABLE = "itquest_settings";

interface Row {
  teacher_name: string;
  teacher_reading: string;
}

export async function loadAppSettings(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=teacher_name,teacher_reading&id=eq.true`,
      { headers: { apikey: SUPABASE_ANON_KEY } },
    );
    if (!res.ok) return;
    const rows = (await res.json()) as Row[];
    const row = rows[0];
    if (!row) return;
    const next = { teacherName: row.teacher_name, teacherReading: row.teacher_reading };
    if (validateAppSettings(next) === null) useAppSettings.setState({ ...next, loaded: true });
  } catch {
    // 読めないときは はじめの値のまま
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: "invalid" | "denied" | "network" };

/** 管理者だけが書ける（DB の行の権限で止まる。ここでは 管理者かどうかを見ない）。 */
export async function saveAppSettings(v: AppSettings): Promise<SaveResult> {
  if (validateAppSettings(v) !== null) return { ok: false, reason: "invalid" };
  const value = { teacherName: v.teacherName.trim(), teacherReading: v.teacherReading.trim() };
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ teacher_name: value.teacherName, teacher_reading: value.teacherReading })
      .eq("id", true)
      .select("teacher_name");
    // 行の権限で止まったときは、エラーではなく「0行」が返る
    if (error) return { ok: false, reason: error.code === "PGRST301" ? "denied" : "network" };
    if (!data || data.length === 0) return { ok: false, reason: "denied" };
    useAppSettings.setState({ ...value, loaded: true });
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** 先生の名前の読みを、画面のふりがなに足す（はじめの値も、DB から読んだ値も）。 */
export function syncTeacherReading(): void {
  const apply = (s: AppSettings) => setRuntimeReadings([[s.teacherName, s.teacherReading]]);
  apply(useAppSettings.getState());
  useAppSettings.subscribe(apply);
}
