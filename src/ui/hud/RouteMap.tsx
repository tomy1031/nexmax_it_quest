import { LINE, METRO, STATION } from "@/factory/signs";
import { RubyText } from "@/ui/RubyText";

/**
 * 路線図（画面の上に出すもの）。3D のかべの路線図と同じデータ（content/metro.json）。
 * 駅をクリックできる（路線図で調べる問題）。線は色とアルファベットの両方で見分けられる。
 */
export function RouteMap({
  onStation,
  marks = {},
  here,
}: {
  onStation?: (id: string) => void;
  marks?: Record<string, "ok" | "ng">;
  here?: string;
}) {
  const drawn = METRO.lines.filter((l) => l.stations.length > 0);
  return (
    <div
      className="text-ink relative mx-auto aspect-[16/10] w-full max-w-3xl"
      data-testid="routemap"
    >
      <svg viewBox="0 0 100 62.5" className="absolute inset-0 h-full w-full" aria-hidden>
        {drawn.map((l) => (
          <polyline
            key={l.id}
            points={l.stations
              .map((id) => STATION[id])
              .filter(Boolean)
              .map((s) => `${s!.x},${(s!.y / 100) * 56 + 3}`)
              .join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {METRO.stations.map((s) => {
        const left = `${s.x}%`;
        const top = `${((s.y / 100) * 56 + 3) * 1.6}%`;
        const big = s.numbers.length > 1;
        const mark = marks[s.id];
        const labelPos =
          s.label === "left"
            ? "right-full mr-1.5 top-1/2 -translate-y-1/2 text-right"
            : s.label === "right"
              ? "left-full ml-1.5 top-1/2 -translate-y-1/2"
              : s.label === "top"
                ? "bottom-full mb-1 left-1/2 -translate-x-1/2 text-center"
                : "top-full mt-0.5 left-1/2 -translate-x-1/2 text-center";
        return (
          <button
            key={s.id}
            type="button"
            disabled={!onStation}
            onClick={() => onStation?.(s.id)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left, top }}
            data-testid={`station-${s.id}`}
          >
            <span
              className={`border-ink block rounded-full border-2 ${big ? "h-4 w-4" : "h-3 w-3"} ${mark === "ok" ? "bg-leaf" : mark === "ng" ? "bg-coral" : s.id === here ? "bg-[#ff3b6b]" : "bg-white"} ${onStation ? "group-hover:scale-150" : ""} transition`}
            />
            <span
              className={`absolute text-[0.7rem] leading-tight font-extrabold whitespace-nowrap sm:text-sm ${labelPos}`}
            >
              <RubyText text={s.name} />
              <span className="block text-[0.55rem] font-bold text-slate-500 sm:text-[0.65rem]">
                {s.numbers.join(" ")}
              </span>
            </span>
          </button>
        );
      })}
      <div className="absolute right-1 bottom-1 flex flex-col gap-1 rounded-xl bg-white/90 p-2 text-sm">
        {drawn.map((l) => (
          <span key={l.id} className="flex items-center gap-2 font-bold">
            <span
              className="grid h-6 w-6 place-items-center rounded-full border-[3px] bg-white text-xs font-black"
              style={{ borderColor: l.color, color: l.color }}
            >
              {l.letter}
            </span>
            <RubyText text={LINE[l.id]!.name} />
          </span>
        ))}
      </div>
    </div>
  );
}
