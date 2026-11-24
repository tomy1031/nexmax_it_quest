import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

const BASE = import.meta.env.BASE_URL;

/**
 * 3D の読みこみ中の おおい（Codex の UI の相談 1「何も表示されない時間をなくす」）。
 * 読みこみが 0.2 秒より長いときだけ出す。10 秒より長いときは「もう一度」を出す。
 */
export function LoadingCover() {
  const { active, progress } = useProgress();
  const [shown, setShown] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      const id = window.setTimeout(() => {
        setShown(false);
        setSlow(false);
      }, 200);
      return () => window.clearTimeout(id);
    }
    const a = window.setTimeout(() => setShown(true), 200);
    const b = window.setTimeout(() => setSlow(true), 10000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [active]);
  if (!shown) return null;
  return (
    <div
      className={`bg-pastel-page/95 absolute inset-0 z-30 grid place-items-center transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
      data-testid="loading-cover"
    >
      <div className="glass pop flex flex-col items-center gap-4 rounded-[32px] px-10 py-8">
        <img src={`${BASE}img/nexmax/hello.webp`} alt="" className="bob h-32 w-32" />
        <p className="text-ink text-2xl font-extrabold">
          <RubyText text={t("loading.scene")} />
        </p>
        <div className="h-3 w-[280px] overflow-hidden rounded-full bg-[#e6d4b3]">
          <div
            className="h-full rounded-full bg-[#24a878] transition-[width] duration-200"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        {slow && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            <RubyText text={t("loading.retry")} />
          </button>
        )}
      </div>
    </div>
  );
}
