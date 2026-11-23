import ui from "@content/ui.json";

/** 画面の言葉のキー。content/ui.json にあるものだけが使える（型で止まる）。 */
export type UiKey = keyof typeof ui.text;

const TEXT = ui.text as Record<UiKey, string>;

/** 画面の言葉を出す。%name% のような印は vars で置きかえる。 */
export function t(key: UiKey, vars?: Record<string, string | number>): string {
  let s = TEXT[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`%${k}%`, String(v));
  return s;
}

/** 台本・チャットの文の中の %nickname% などを置きかえる。 */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/%([a-z]+)%/g, (m, k: string) => vars[k] ?? m);
}

/** 日付（例: 4月1日 木曜日）。NMChat の入社式の日時に使う。
 * 企画メモでは「日付はnowDate」だったが、tomy さんの指示（2026-11-23「入社式は4月1日にして」）で、ゲームの中の日（gameDate）を渡す。 */
export function dateJa(d = new Date()): string {
  const week = t(`date.week${d.getDay()}` as UiKey);
  return t("date.format", { m: d.getMonth() + 1, d: d.getDate(), w: week });
}
