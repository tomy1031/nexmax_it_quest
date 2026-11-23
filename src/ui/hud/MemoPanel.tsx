import { useState } from "react";
import { useSettings } from "@/lib/store";
import { t } from "@/lib/t";
import { usePlay, type MemoItem } from "@/stages/play-store";
import { RubyText } from "@/ui/RubyText";

/**
 * メモ（自動で書く）。tomy さん 2026-11-23「メモは自分でするのではなく、参考としていつでもみれるように自動生成させて」
 * 「メモは右上にして。（数個表示。もっと見るで大きくなる）」「タイトルクリックで詳細が出る」。
 * 台本の memo-add で足す（入社式・家の駅・行き方・定期券・ホーム）。学生は書かない。
 */

/** 1つのメモ（タイトルを押すと、くわしい文が出る）。 */
function MemoRow({ m, open, onToggle }: { m: MemoItem; open: boolean; onToggle: () => void }) {
  return (
    <li className="pop rounded-xl bg-white/10">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[15px] font-extrabold text-white hover:bg-white/10"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={`memo-${m.id}`}
      >
        <span className="text-xs opacity-80">{open ? "▼" : "▶"}</span>
        <RubyText text={m.title} />
      </button>
      {open && (
        <p className="px-3 pb-2 text-[15px] leading-relaxed font-bold text-white">
          <RubyText text={m.text} />
        </p>
      )}
    </li>
  );
}

/** 右上の小さなメモ（新しい順に いくつか）。「もっと 見る」で 全部を大きく出す。 */
export function MemoBox() {
  const memos = usePlay((s) => s.memos);
  const big = useSettings((s) => s.memoBig ?? false);
  const setSettings = useSettings((s) => s.setSettings);
  const [open, setOpen] = useState<string | null>(null);
  if (memos.length === 0) return null;
  const shown = big ? memos : memos.slice(-3);
  return (
    <div
      className={`glass pointer-events-auto absolute top-[68px] right-3 rounded-2xl px-3 py-2 ${big ? "max-h-[70vh] w-[min(80vw,440px)] overflow-y-auto" : "w-[min(60vw,280px)]"}`}
      data-testid="memo-box"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-white">
          <RubyText text={t("memo.title")} />
          <span className="ml-1.5 text-xs opacity-80">{memos.length}</span>
        </span>
        {(memos.length > 3 || big) && (
          <button
            type="button"
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-white/25"
            onClick={() => setSettings({ memoBig: !big })}
            data-testid="memo-more"
          >
            <RubyText text={t(big ? "memo.less" : "memo.more")} />
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {shown.map((m) => (
          <MemoRow
            key={m.id}
            m={m}
            open={big || open === m.id}
            onToggle={() => setOpen(open === m.id ? null : m.id)}
          />
        ))}
      </ul>
    </div>
  );
}

/** メニューの「メモ」（全部を ひらいて出す）。 */
export function MemoList() {
  const memos = usePlay((s) => s.memos);
  if (memos.length === 0)
    return (
      <p className="text-white">
        <RubyText text={t("memo.empty")} />
      </p>
    );
  return (
    <ul className="flex flex-col gap-2">
      {memos.map((m) => (
        <MemoRow key={m.id} m={m} open onToggle={() => undefined} />
      ))}
    </ul>
  );
}
