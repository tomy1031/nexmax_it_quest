import { useLocation } from "wouter";
import { useSetupComplete } from "@/app/use-setup";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";
import { IconBook, IconGear, IconPlay } from "@/ui/icons";

/**
 * タイトル。tomy さんのタイトル画像を背景にし、ボタンのイメージの配置（スタート・ストーリー・設定）を重ねる。
 * 画像の 16:9 の箱を画面いっぱいに置き、文字とボタンはその箱に対する位置（%）で置く（ロゴとずれない）。
 * 最初は「設定」だけ押せる（企画メモ）。
 */
export function TitleScreen() {
  const [, navigate] = useLocation();
  const ready = useSetupComplete();
  const nickname = useGame((s) => s.profile.nickname);

  return (
    <main className="bg-deep relative h-full w-full overflow-hidden">
      <div
        className="[container-type:inline-size] absolute top-1/2 left-1/2 aspect-[16/9] -translate-x-1/2 -translate-y-1/2"
        style={{ width: "max(100vw, calc(100vh * 16 / 9))" }}
      >
        <img
          src={`${import.meta.env.BASE_URL}img/title/title.webp`}
          alt="NEXMAX IT QUEST"
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />

        <p className="absolute top-[4.5%] left-1/2 flex -translate-x-1/2 items-center gap-[1.2cqw] text-[1.5cqw] font-bold tracking-[0.3em] whitespace-nowrap text-white drop-shadow-[0_0_8px_rgba(56,225,255,0.8)]">
          <span className="h-px w-[6cqw] bg-white/70" />
          <RubyText text={t("title.tagline")} />
          <span className="h-px w-[6cqw] bg-white/70" />
        </p>

        <p className="bg-navy/60 absolute top-[40%] left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/70 px-[2.4cqw] py-[0.6cqw] text-[1.7cqw] font-bold whitespace-nowrap text-white shadow-[0_0_20px_rgba(56,225,255,0.45)]">
          <RubyText text={t("title.sub")} />
        </p>

        <nav className="absolute top-[53%] left-1/2 flex w-[25cqw] -translate-x-1/2 flex-col items-stretch gap-[1.3cqw]">
          <button
            type="button"
            className="btn btn-primary py-[1.1cqw] text-[2cqw] whitespace-nowrap"
            disabled={!ready}
            onClick={() => navigate("/dive")}
            data-testid="title-start"
          >
            <IconPlay className="h-[1.8cqw] w-[1.8cqw]" />
            <RubyText text={t("title.start")} />
            <span className="text-[1.05cqw]">
              <RubyText text={t("title.startNote")} />
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost py-[0.8cqw] text-[1.5cqw]"
            disabled={!ready}
            onClick={() => navigate("/story")}
          >
            <IconBook className="h-[1.6cqw] w-[1.6cqw]" />
            <RubyText text={t("title.story")} />
          </button>
          <button
            type="button"
            className={`btn btn-ghost py-[0.8cqw] text-[1.5cqw] ${ready ? "" : "ring-sun ring-2"}`}
            onClick={() => navigate("/settings")}
            data-testid="title-settings"
          >
            <IconGear className="h-[1.6cqw] w-[1.6cqw]" />
            <RubyText text={t("title.settings")} />
          </button>
          <p className="text-center text-[1.15cqw] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <RubyText text={ready ? t("title.hello", { nickname }) : t("title.locked")} />
          </p>
        </nav>
      </div>
      <a
        href={`${import.meta.env.BASE_URL}credits.txt`}
        className="absolute right-3 bottom-2 text-xs text-white/60 underline"
      >
        <RubyText text={t("title.credits")} />
      </a>
    </main>
  );
}
