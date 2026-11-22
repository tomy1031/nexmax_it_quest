import { LINE } from "@/factory/signs";

/** 線のマーク（白い丸に線の色のふちとアルファベット。駅の看板と同じ形）。 */
export function LineMark({ id, size = 30 }: { id: string; size?: number }) {
  const line = LINE[id];
  if (!line) return null;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border-[3px] bg-white font-black"
      style={{
        width: size,
        height: size,
        borderColor: line.color,
        color: line.color,
        fontSize: size * 0.5,
      }}
      aria-label={line.name}
      data-testid={`line-mark-${id}`}
    >
      {line.letter}
    </span>
  );
}
