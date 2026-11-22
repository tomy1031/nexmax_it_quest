import { useMemo } from "react";
import { FURIGANA } from "@/lib/furigana-index";
import { annotateRuby } from "@/lib/text/furigana";
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

export function RubyText({ text, className }: { text: string; className?: string }) {
  const show = useSettings((s) => s.furigana);
  const segments = useMemo(() => (show ? annotateRuby(text, FURIGANA) : [{ text }]), [text, show]);
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
