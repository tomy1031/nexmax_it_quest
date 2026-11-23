/** アプリ全体の設定の形と決まり（画面と テストで 同じものを使う）。 */
export interface AppSettings {
  teacherName: string;
  /** 先生の名前の読み（ひらがな。ふりがなに使う）。 */
  teacherReading: string;
}

/** 名前は 1〜20字（記号の < > は使わない）。読みは ひらがな（のばす音「ー」も よい）。 */
export function validateAppSettings(v: AppSettings): "teacherName" | "teacherReading" | null {
  const name = v.teacherName.trim();
  if (name.length === 0 || name.length > 20 || /[<>]/.test(name)) return "teacherName";
  if (!/^[ぁ-ゖー]{1,30}$/.test(v.teacherReading.trim())) return "teacherReading";
  return null;
}
