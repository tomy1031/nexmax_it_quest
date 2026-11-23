/**
 * 声で 言った ことの 見かた（第2章の 受付・ヘンディさんとの 会話）。
 * 聞きとった 文字（Gemini Live の 文字起こし）を、決まった ことばの 組と くらべる。
 * 漢字でも かなでも 聞きとられるので、組には 両方を 書く（content/talks.json）。
 */

/** カタカナを ひらがなに し、空白・記号を 取る（くらべやすく する）。 */
export function normalizeJa(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(
      /[\s\u3000\u3001\u3002\uff0c\uff0e,.!?\uff01\uff1f\u300c\u300d\u300e\u300f\uff08\uff09()\u30fb\u2026\u301c~\u30fc-]/g,
      "",
    )
    .toLowerCase();
}

/** 組の うち、いくつが 聞きとった 文に 入っているか。 */
export function matchedGroups(heard: string, groups: readonly (readonly string[])[]): number {
  const h = normalizeJa(heard);
  if (!h) return 0;
  return groups.filter((alts) => alts.some((a) => h.includes(normalizeJa(a)))).length;
}

/** 決まった セリフを 言えたか。 */
export function repeatOk(heard: string, groups: readonly (readonly string[])[], need: number) {
  return matchedGroups(heard, groups) >= Math.min(need, groups.length);
}

/** 日本語の 答えに なっているか（かな・漢字が 2字 以上）。中身の 正しさは 相手（AI）が 返事で 伝える。 */
export function looksJapanese(heard: string): boolean {
  const jp = heard.match(/[ぁ-ゖァ-ヺ㐀-鿿々]/g);
  return (jp?.length ?? 0) >= 2;
}
