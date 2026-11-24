import { useState } from "react";
import { useLocation } from "wouter";
import stage1 from "@content/stages/stage1.json";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { AvatarEditor } from "@/ui/hud/AvatarPanel";
import { RubyText } from "@/ui/RubyText";
import { IconCheck, IconPlay, IconShirt } from "@/ui/icons";

/**
 * ステージ選択。ステージ1「入社初日」は、第1章（家から会社の駅まで）が遊べる。
 * 第2章（会社に着いてから・入社式）は準備中（tomy さん 2026-11-22「第二章は会社ついてから」）。
 */
export function StageSelect() {
  const [, navigate] = useLocation();
  const progress = useGame((s) => s.stages.stage1);
  const resetStage = useGame((s) => s.resetStage);
  const [chapters, setChapters] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const cleared = Boolean(progress?.cleared);
  const resume = progress?.section;

  const go = (section?: string) =>
    navigate(section ? `/stage/stage1?from=${section}` : "/stage/stage1");

  return (
    <main className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_50%_-10%,#2a7bff_0%,#0a2a6b_40%,#030c26_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold drop-shadow-[0_0_12px_rgba(56,225,255,0.6)]">
            <RubyText text={t("select.title")} />
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAvatarOpen(true)}
              data-testid="select-avatar"
            >
              <IconShirt className="h-5 w-5" />
              <RubyText text={t("select.avatar")} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/")}>
              <RubyText text={t("select.back")} />
            </button>
          </div>
        </header>

        {avatarOpen && (
          <div className="bg-deep/65 fixed inset-0 z-30 grid place-items-center overflow-y-auto p-3">
            <AvatarEditor mode="free" onDone={() => setAvatarOpen(false)} />
          </div>
        )}

        <div className="mx-auto grid w-full max-w-2xl gap-6">
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
                <div className="absolute top-4 left-32 flex items-center gap-1 rounded-full bg-[#1b8a4a] px-3 py-1 text-sm font-extrabold text-white">
                  <IconCheck className="h-4 w-4" />
                  <RubyText text={t("select.cleared")} />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <h2 className="text-xl leading-relaxed font-extrabold">
                <RubyText text={stage1.title} />
              </h2>
              <p className="text-white">
                <RubyText text={stage1.subtitle} />
              </p>
              {/* 学ぶ量の目安（Codex の UI の相談 10） */}
              <p className="text-base font-bold text-white/90" data-testid="stage1-info">
                <RubyText
                  text={t("select.info", {
                    scenes: stage1.sections.length,
                    words: stage1.words.length,
                  })}
                />
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
                        className="btn btn-ghost justify-start disabled:opacity-60"
                        onClick={() => first && go(first.id)}
                        disabled={!first}
                        data-testid={`chapter-${c.no}`}
                      >
                        <RubyText text={t("hud.chapter", { no: c.no })} />
                        <RubyText text={c.title} />
                        {!first && (
                          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-sm">
                            <RubyText text={t("select.soon")} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
