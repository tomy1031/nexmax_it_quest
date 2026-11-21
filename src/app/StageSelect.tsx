import { useState } from "react";
import { useLocation } from "wouter";
import stage1 from "@content/stages/stage1.json";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";
import { IconCheck, IconPlay } from "@/ui/icons";

/** ステージ選択。ステージ1は遊べる。ステージ2（入社式）は準備中。 */
export function StageSelect() {
  const [, navigate] = useLocation();
  const progress = useGame((s) => s.stages.stage1);
  const resetStage = useGame((s) => s.resetStage);
  const [chapters, setChapters] = useState(false);
  const cleared = Boolean(progress?.cleared);
  const resume = progress?.section;

  const go = (section?: string) =>
    navigate(section ? `/stage/stage1?from=${section}` : "/stage/stage1");

  return (
    <main className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_50%_-10%,#2a7bff_0%,#0a2a6b_40%,#030c26_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold drop-shadow-[0_0_12px_rgba(56,225,255,0.6)]">
            <RubyText text={t("select.title")} />
          </h1>
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/")}>
            <RubyText text={t("select.back")} />
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <article
            className="glass pop flex flex-col overflow-hidden rounded-3xl"
            data-testid="stage-card-1"
          >
            <div className="relative h-44 overflow-hidden bg-[linear-gradient(135deg,#38e1ff_0%,#1f8fff_45%,#8f7bff_100%)]">
              <img
                src={`${import.meta.env.BASE_URL}img/nexmax/guide.webp`}
                alt=""
                className="bob absolute right-4 bottom-0 h-40 w-40"
              />
              <div className="text-ink absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-sm font-extrabold">
                <RubyText text={t("select.stage")} /> 1
              </div>
              {cleared && (
                <div className="bg-leaf text-ink absolute top-4 left-32 flex items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold">
                  <IconCheck className="h-4 w-4" />
                  <RubyText text={t("select.cleared")} />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <h2 className="text-xl leading-relaxed font-extrabold">
                <RubyText text={stage1.title} />
              </h2>
              <p className="text-white/80">
                <RubyText text={stage1.subtitle} />
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {resume ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => go(resume)}
                      data-testid="stage1-continue"
                    >
                      <IconPlay className="h-4 w-4" />
                      <RubyText text={t("select.continue")} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        resetStage("stage1");
                        go();
                      }}
                    >
                      <RubyText text={t("select.restart")} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => go()}
                    data-testid="stage1-start"
                  >
                    <IconPlay className="h-4 w-4" />
                    <RubyText text={t("select.start")} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setChapters(!chapters)}
                >
                  <RubyText text={t("select.chapters")} />
                </button>
                {cleared && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate("/certificate/stage1")}
                  >
                    <RubyText text={t("select.certificate")} />
                  </button>
                )}
              </div>
              {chapters && (
                <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-3">
                  {stage1.chapters.map((c) => {
                    const first = stage1.sections.find((s) => s.chapter === c.no);
                    return (
                      <button
                        key={c.no}
                        type="button"
                        className="btn btn-ghost justify-start"
                        onClick={() => first && go(first.id)}
                      >
                        <RubyText text={t("hud.chapter", { no: c.no })} />
                        <RubyText text={c.title} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </article>

          <article className="glass flex flex-col overflow-hidden rounded-3xl opacity-70">
            <div className="relative h-44 bg-[linear-gradient(135deg,#ffb7d5_0%,#8f7bff_55%,#1f3f9a_100%)]">
              <img
                src={`${import.meta.env.BASE_URL}img/nexmax/hello.webp`}
                alt=""
                className="absolute right-4 bottom-0 h-40 w-40 grayscale-[30%]"
              />
              <div className="text-ink absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-sm font-extrabold">
                <RubyText text={t("select.stage")} /> 2
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <h2 className="text-xl font-extrabold">
                <RubyText text={t("select.stage2")} />
              </h2>
              <p className="text-white/80">
                <RubyText text={t("select.stage2sub")} />
              </p>
              <span className="mt-auto self-start rounded-full bg-white/15 px-3 py-1 font-bold">
                <RubyText text={t("select.soon")} />
              </span>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
