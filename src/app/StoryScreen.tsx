import { useState } from "react";
import { useLocation } from "wouter";
import { t, type UiKey } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

const PAGES: { key: UiKey; pose: string }[] = [
  { key: "story.1", pose: "hello" },
  { key: "story.2", pose: "build" },
  { key: "story.3", pose: "guide" },
  { key: "story.4", pose: "guide" },
  { key: "story.5", pose: "cheer" },
];

/** ストーリー（はじめに読む話）。1画面1文。 */
export function StoryScreen() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);
  const p = PAGES[page] ?? PAGES[0]!;
  const last = page === PAGES.length - 1;
  return (
    <main className="bg-pastel-page relative grid h-full place-items-center overflow-hidden p-4">
      <div
        className="glass pop relative flex w-full max-w-2xl flex-col items-center gap-6 rounded-[32px] p-8 text-center"
        key={page}
      >
        <img
          src={`${import.meta.env.BASE_URL}img/nexmax/${p.pose}.webp`}
          alt=""
          className="bob h-40 w-40 drop-shadow-[0_6px_12px_rgba(74,52,38,0.18)]"
        />
        <p className="text-ink text-2xl leading-loose font-extrabold">
          <RubyText text={t(p.key)} />
        </p>
        <div className="flex gap-2.5">
          {PAGES.map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition ${i === page ? "scale-115 bg-[#1f9b6c]" : "bg-[#d9c5a3]"}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary min-w-44"
          onClick={() => (last ? navigate("/") : setPage(page + 1))}
        >
          <RubyText text={t(last ? "story.close" : "story.next")} />
        </button>
      </div>
    </main>
  );
}
