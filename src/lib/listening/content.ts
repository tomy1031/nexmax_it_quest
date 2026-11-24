import { listeningFile, type ListeningFile } from "@/content/schema";
import { FURIGANA } from "@/lib/furigana-index";
import { KANA_WORDS_IN_KANJI } from "@/lib/text/kana-tables";
import type { FuriganaIndex } from "@/lib/text/furigana";
import {
  buildSoundsIndex,
  createListening,
  LINE_JOIN,
  preOpenListening,
  replayListening,
  type ListeningState,
} from "@/lib/listening/checks";

/** content/listenings/*.json を 全部 読む（1つの リスニングに 1ファイル）。 */
const FILES = import.meta.glob<unknown>("../../../content/listenings/*.json", {
  eager: true,
  import: "default",
});

export const LISTENINGS: Record<string, ListeningFile> = Object.fromEntries(
  Object.values(FILES).map((raw) => {
    const file = listeningFile.parse(raw);
    return [file.id, file];
  }),
);

export function transcriptOf(file: ListeningFile): string {
  return file.script.map((l) => l.text).join(LINE_JOIN);
}

/** 始めの 状態（虫食い）。入れた 言葉が あれば 流しこむ（つづきから）。 */
export function startListening(
  file: ListeningFile,
  inputs: readonly string[] = [],
  furigana: FuriganaIndex = FURIGANA,
): ListeningState {
  const fresh = createListening(
    transcriptOf(file),
    file.keywords,
    file.check,
    furigana,
    buildSoundsIndex([...file.sounds, ...KANA_WORDS_IN_KANJI]),
  );
  const opened = preOpenListening(fresh, file.preOpen);
  return inputs.length ? replayListening(opened, inputs) : opened;
}
