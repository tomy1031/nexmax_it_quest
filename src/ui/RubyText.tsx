import { useMemo } from "react";
import { useFuriganaIndex } from "@/lib/furigana-index";
import { annotateRuby, buildFuriganaIndex, type FuriganaEntry } from "@/lib/text/furigana";
import { useSettings } from "@/lib/store";

/**
 * 読み方のデータからふりがなを付けて出す。**ふりがなの HTML を手で書かない**ための入口（AGENTS.md 必ず守るルール2）。
 * 文字の色とふりがなの色はいつもそろう（rt の色は currentColor。src/styles/app.css）。
 */
/**
 * ふりがなが漢字より長いとき（入社式＝にゅうしゃしき など）、ふりがなの字の間を少しつめて、
 * 漢字の間が広がらない（「入 社 式」にならない）ようにする。ふりがなは漢字の半分の大きさ。
 */
function squeeze(base: string, reading: string): React.CSSProperties | undefined {
  const n = [...reading].length;
  const m = [...base].length;
  if (n * 0.5 <= m) return undefined;
  const ls = Math.max(-0.3, -(1 - (2 * m) / n));
  return { letterSpacing: `${ls.toFixed(3)}em` };
}

export function RubyText({
  text,
  className,
  extra,
}: {
  text: string;
  className?: string;
  /** この文だけに足す読み（管理者の画面の見本で、入れている途中の読みを見せる）。 */
  extra?: FuriganaEntry[];
}) {
  const show = useSettings((s) => s.furigana);
  const base = useFuriganaIndex();
  const extraKey = extra ? JSON.stringify(extra) : "";
  const index = useMemo(
    () =>
      extra?.length
        ? buildFuriganaIndex([...base.entries, ...extra.filter(([b, r]) => b && r)])
        : base,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, extraKey],
  );
  const segments = useMemo(
    () => (show ? annotateRuby(text, index) : [{ text }]),
    [text, show, index],
  );
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rt style={squeeze(seg.text, seg.reading)}>{seg.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
