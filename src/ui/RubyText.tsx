import { useMemo } from "react";
import { FURIGANA } from "@/lib/furigana-index";
import { annotateRuby } from "@/lib/text/furigana";
import { useSettings } from "@/lib/store";

/**
 * 読み方のデータからふりがなを付けて出す。**ふりがなの HTML を手で書かない**ための入口（AGENTS.md 必ず守るルール2）。
 * 文字の色とふりがなの色はいつもそろう（rt の色は currentColor。src/styles/app.css）。
 */
export function RubyText({ text, className }: { text: string; className?: string }) {
  const show = useSettings((s) => s.furigana);
  const segments = useMemo(() => (show ? annotateRuby(text, FURIGANA) : [{ text }]), [text, show]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {seg.text}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
