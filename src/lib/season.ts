import stage1Json from "@content/stages/stage1.json";

/**
 * ゲームの中の日と季節。
 * 入社式の日は 4月1日（tomy さん 2026-11-23「入社式は4月1日にして、その日は桜の多い季節にしましょう」）。
 * 日は台本（content/stages/stage1.json の day）で決め、季節はその月から決まる。
 * 季節で、町の木・落ち葉・花びら・家の窓の外が入れかわる（src/stages/stage1/town.tsx など）。
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

const DAY = (stage1Json as { day?: string }).day ?? "04-01";

/** ゲームの中の日（今日から見て、次に来る その日。今日がその日なら今日）。 */
export function gameDate(now = new Date()): Date {
  const [m, d] = DAY.split("-").map(Number) as [number, number];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(now.getFullYear(), m - 1, d);
  return day < today ? new Date(now.getFullYear() + 1, m - 1, d) : day;
}

/** YYYY-MM-DD（その土地の日付で）。 */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 月から季節（3〜5月 春・6〜8月 夏・9〜11月 秋・12〜2月 冬）。 */
export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/** いまの季節。URL に ?season=autumn のように付けると、その季節で見られる（見た目を確かめるため）。 */
export function currentSeason(): Season {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("season");
    if (q && (SEASONS as string[]).includes(q)) return q as Season;
  }
  return seasonOf(gameDate());
}
