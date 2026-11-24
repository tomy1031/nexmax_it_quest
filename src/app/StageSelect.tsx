import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import stage1 from "@content/stages/stage1.json";
import stage2 from "@content/stages/stage2.json";
import { isDevTools } from "@/lib/env";
import { playSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import type { ChibiMotion } from "@/three/Chibi";
import type { Expression } from "@/three/chibi";
import { StageHubScene } from "@/three/StageHubScene";
import { AvatarEditor } from "@/ui/hud/AvatarPanel";
import { RubyText } from "@/ui/RubyText";
import { IconCheck, IconPlay, IconShirt } from "@/ui/icons";

const REACTIONS: ChibiMotion[] = ["wave", "cheer", "twirl"];

/**
 * ステージ選択（バーチャル大阪プラザ）。
 * ダイブ直後に広がる 3D 広場の中で、自分のアバターとネクマックスが出迎え、
 * 行き先ボード（ステージカード）から冒険へ出発できる（tomy さん 2026-11-24）。
 */
export function StageSelect() {
  const [, navigate] = useLocation();
  const progress = useGame((s) => s.stages.stage1);
  const avatar = useGame((s) => s.avatar);
  const profile = useGame((s) => s.profile);
  const resetStage = useGame((s) => s.resetStage);
  const [chapters, setChapters] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [reactionIdx, setReactionIdx] = useState(0);
  const [motion, setMotion] = useState<ChibiMotion>("wave");
  const [hoverStart, setHoverStart] = useState(false);
  const cleared = Boolean(progress?.cleared);
  const resume = progress?.section;
  const search = useSearch();
  const unlockParam = isDevTools && new URLSearchParams(search).get("unlock") === "1";
  const progress2 = useGame((s) => s.stages.stage2);
  const stage2Open = cleared || unlockParam || Boolean(progress2?.cleared || progress2?.section);
  const stage2New = stage2Open && !progress2;
  // 始めて いる ステージの タブを 開く（ステージ2を 始めて いれば 2）
  const [tab, setTab] = useState<1 | 2>(() => (progress2 ? 2 : 1));

  // 広場に着いた直後は手をふり、少ししたら自然な立ちポーズへ
  useEffect(() => {
    const id = window.setTimeout(() => setMotion("idle"), 2600);
    return () => window.clearTimeout(id);
  }, []);

  const triggerReaction = () => {
    playSfx("ok");
    const next = REACTIONS[reactionIdx % REACTIONS.length]!;
    setReactionIdx((n) => n + 1);
    setMotion(next);
  };

  const activeMotion: ChibiMotion = hoverStart ? "cheer" : motion;
  const activeExpr: Expression = hoverStart || motion !== "idle" ? "happy" : "normal";

  const go = (section?: string) =>
    navigate(section ? `/stage/stage1?from=${section}` : "/stage/stage1");

  return (
    <main className="bg-pastel-page relative h-full w-full overflow-hidden">
      {/* 3D バーチャル大阪プラザ（アバターづくりモーダル中は 1 コンテキストに絞るため一時非表示） */}
      {!avatarOpen && (
        <div className="absolute inset-0">
          <StageHubScene
            avatar={avatar}
            motion={activeMotion}
            expression={activeExpr}
            onAvatarClick={triggerReaction}
          />
        </div>
      )}

      {/* 画面の上のナビゲーションと行き先ボード */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        {/* 上部バー */}
        <header className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="glass flex items-center gap-2.5 rounded-full px-4 py-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#24b878]" />
              <span className="text-ink text-sm font-extrabold">
                <RubyText text={t("select.plazaBadge")} />
              </span>
            </div>
            <h1 className="text-ink text-2xl font-extrabold drop-shadow-[0_2px_0_rgba(255,255,255,0.95)] md:text-3xl">
              <RubyText text={t("select.title")} />
            </h1>
            {profile.nickname && (
              <span className="rounded-full border-2 border-[#fff8e6] bg-[#5c463a] px-3.5 py-1 text-sm font-extrabold text-white shadow">
                <RubyText text={t("select.player", { name: profile.nickname })} />
              </span>
            )}
          </div>

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

        {/* メイン領域：左に 3D アバターとネクマックスのふきだし、右に行き先ボード */}
        <div className="mx-auto my-auto grid w-full max-w-6xl items-end gap-4 py-3 lg:grid-cols-[1fr_minmax(360px,470px)]">
          {/* 左下：ネクマックスとアバターの案内ふきだし（3D キャラを見せるため余白を広く） */}
          <div className="pointer-events-auto flex flex-col items-start gap-2 pt-36 lg:pt-0">
            <div className="glass pop max-w-sm rounded-[24px] px-4 py-3">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#235d6e] px-3 py-0.5 text-xs font-extrabold text-white">
                <RubyText text={t("speaker.nexmax")} />
              </div>
              <p className="text-ink text-base font-extrabold">
                <RubyText text={t("select.welcome")} />
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border-2 border-[#fff8e6] bg-[#5c463a]/90 px-3.5 py-1.5 text-xs font-extrabold text-white shadow transition hover:bg-[#6e5648]"
              onClick={triggerReaction}
              data-testid="select-avatar-action"
            >
              <RubyText text={t("select.tapAvatar")} />
            </button>
          </div>

          {/* 右側：ステージの行き先チケットカード */}
          <div className="pointer-events-auto flex flex-col gap-3">
            {/* ステージの タブ（カードを 2まい ならべると 画面に 入らないので、1まいずつ 見せる） */}
            <div className="flex gap-2" role="tablist">
              {([1, 2] as const).map((no) => (
                <button
                  key={no}
                  type="button"
                  role="tab"
                  aria-selected={tab === no}
                  className={`btn ${tab === no ? "btn-primary" : "btn-ghost"} relative min-h-10 px-4 py-1.5 text-base`}
                  onClick={() => setTab(no)}
                  data-testid={`stage-tab-${no}`}
                >
                  <RubyText text={t("select.stage")} /> {no}
                  {no === 2 && stage2New && (
                    <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#e25868] text-xs text-white shadow">
                      ✦
                    </span>
                  )}
                  {no === 2 && !stage2Open && <span aria-hidden>🔒</span>}
                </button>
              ))}
            </div>
            {tab === 1 && (
              <article
                className="glass pop flex flex-col overflow-hidden rounded-[28px]"
                data-testid="stage-card-1"
              >
                {/* チケットヘッダー帯 */}
                <div className="relative flex items-center justify-between overflow-hidden bg-[linear-gradient(135deg,#ffd9e9_0%,#d4f1ff_54%,#d6f5e3_100%)] px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#5c463a] px-3.5 py-1 text-sm font-extrabold text-white shadow">
                      <RubyText text={t("select.stage")} /> 1
                    </span>
                    {cleared && (
                      <span className="flex items-center gap-1 rounded-full bg-[#1f9b6c] px-3 py-1 text-sm font-extrabold text-white shadow">
                        <IconCheck className="h-4 w-4" />
                        <RubyText text={t("select.cleared")} />
                      </span>
                    )}
                  </div>
                  <img
                    src={`${import.meta.env.BASE_URL}img/nexmax/guide.webp`}
                    alt=""
                    className="h-14 w-14 shrink-0 drop-shadow-[0_4px_8px_rgba(74,52,38,0.18)]"
                  />
                </div>

                <div className="text-ink flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h2 className="text-xl leading-relaxed font-extrabold">
                      <RubyText text={stage1.title} />
                    </h2>
                    <p className="text-ink/85 text-sm font-bold">
                      <RubyText text={stage1.subtitle} />
                    </p>
                  </div>

                  {/* ミニ路線バー（家 → 天王寺 → 本町 → 阿波座） */}
                  <div className="cream-box rounded-2xl px-3.5 py-2.5">
                    <p className="text-cocoa mb-1.5 text-xs font-extrabold">
                      <RubyText text={t("select.routeLabel")} />
                    </p>
                    <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
                      <RouteStop label={t("select.stopHome")} color="#f09c42" />
                      <RouteLine color="#e2c8a0" />
                      <RouteStop label={t("select.stopTennoji")} color="#e5171f" />
                      <RouteLine color="#e5171f" />
                      <RouteStop label={t("select.stopHommachi")} color="#019a66" ring="#e5171f" />
                      <RouteLine color="#019a66" />
                      <RouteStop label={t("select.stopAwaza")} color="#019a66" />
                    </div>
                  </div>

                  {/* 学ぶ量の目安 */}
                  <p className="text-cocoa text-sm font-bold" data-testid="stage1-info">
                    <RubyText
                      text={t("select.info", {
                        scenes: stage1.sections.length,
                        words: stage1.words.length,
                      })}
                    />
                  </p>

                  <div className="mt-1 flex flex-wrap gap-2">
                    {resume ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => go(resume)}
                          onMouseEnter={() => setHoverStart(true)}
                          onMouseLeave={() => setHoverStart(false)}
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
                        onMouseEnter={() => setHoverStart(true)}
                        onMouseLeave={() => setHoverStart(false)}
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
                        className="btn btn-sky"
                        onClick={() => navigate("/certificate/stage1")}
                      >
                        <RubyText text={t("select.certificate")} />
                      </button>
                    )}
                  </div>

                  {chapters && (
                    <div className="cream-box flex flex-col gap-2 rounded-2xl p-3">
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
                              <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-sm text-white">
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
            )}

            {/* ステージ2（ステージ1を クリアすると 開く。開発・自動テストでは ?unlock=1 で 開く） */}
            {tab === 2 && (
              <Stage2Card
                unlocked={stage2Open}
                onHover={setHoverStart}
                go={(section) =>
                  navigate(section ? `/stage/stage2?from=${section}` : "/stage/stage2")
                }
              />
            )}
          </div>
        </div>
      </div>

      {avatarOpen && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-[#3b2c23]/45 p-3">
          <AvatarEditor mode="free" onDone={() => setAvatarOpen(false)} />
        </div>
      )}
    </main>
  );
}

function RouteStop({ label, color, ring }: { label: string; color: string; ring?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm"
        style={{
          backgroundColor: color,
          boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
        }}
      />
      <span className="text-ink whitespace-nowrap">
        <RubyText text={label} />
      </span>
    </div>
  );
}

function RouteLine({ color }: { color: string }) {
  return <span className="mb-4 h-1 flex-1 rounded-full" style={{ backgroundColor: color }} />;
}

const STAGE2_STOPS = [
  { icon: "🏢", key: "s2.stop1" },
  { icon: "🤝", key: "s2.stop2" },
  { icon: "👂", key: "s2.stop3" },
  { icon: "🎤", key: "s2.stop4" },
] as const;

/** ステージ2「配属：お客さまと ミーティング！」の 行き先チケット（ステージ1と 同じ 形）。 */
function Stage2Card({
  unlocked,
  onHover,
  go,
}: {
  unlocked: boolean;
  onHover: (on: boolean) => void;
  go: (section?: string) => void;
}) {
  const [, navigate] = useLocation();
  const progress = useGame((s) => s.stages.stage2);
  const resetStage = useGame((s) => s.resetStage);
  const [chapters, setChapters] = useState(false);
  const cleared = Boolean(progress?.cleared);
  const resume = progress?.section;
  return (
    <article
      className={`glass pop flex flex-col overflow-hidden rounded-[28px] ${unlocked ? "" : "opacity-95"}`}
      data-testid="stage-card-2"
      data-locked={!unlocked}
    >
      <div className="relative flex items-center justify-between overflow-hidden bg-[linear-gradient(135deg,#d6f5e3_0%,#fff4d6_55%,#ffe0ec_100%)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#2f5d50] px-3.5 py-1 text-sm font-extrabold text-white shadow">
            <RubyText text={t("select.stage")} /> 2
          </span>
          {cleared && (
            <span className="flex items-center gap-1 rounded-full bg-[#1f9b6c] px-3 py-1 text-sm font-extrabold text-white shadow">
              <IconCheck className="h-4 w-4" />
              <RubyText text={t("select.cleared")} />
            </span>
          )}
          {!unlocked && (
            <span className="rounded-full bg-[#6b5344] px-3 py-1 text-sm font-extrabold text-white shadow">
              🔒 <RubyText text={t("s2.locked")} />
            </span>
          )}
        </div>
        <img
          src={`${import.meta.env.BASE_URL}img/nexmax/hello.webp`}
          alt=""
          className="h-12 w-12 shrink-0 drop-shadow-[0_4px_8px_rgba(74,52,38,0.18)]"
        />
      </div>
      <div className="text-ink flex flex-1 flex-col gap-2.5 p-5">
        <div>
          <h2 className="text-xl leading-relaxed font-extrabold">
            <RubyText text={stage2.title} />
          </h2>
          <p className="text-ink/85 text-sm font-bold">
            <RubyText text={stage2.subtitle} />
          </p>
        </div>
        <div className="cream-box rounded-2xl px-3.5 py-2">
          <p className="text-cocoa mb-1 text-xs font-extrabold">
            <RubyText text={t("s2.flowLabel")} />
          </p>
          <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
            {STAGE2_STOPS.map((stop, i) => (
              <span key={stop.key} className="contents">
                {i > 0 && <RouteLine color="#9fd3b6" />}
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-lg leading-none">{stop.icon}</span>
                  <span className="text-ink whitespace-nowrap">
                    <RubyText text={t(stop.key)} />
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>
        <p className="text-cocoa text-sm font-bold" data-testid="stage2-info">
          <RubyText
            text={t("select.info", {
              scenes: stage2.sections.length,
              words: stage2.words.length,
            })}
          />
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {resume && unlocked ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => go(resume)}
                onMouseEnter={() => onHover(true)}
                onMouseLeave={() => onHover(false)}
                data-testid="stage2-continue"
              >
                <IconPlay className="h-4 w-4" />
                <RubyText text={t("select.continue")} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  resetStage("stage2");
                  go();
                }}
              >
                <RubyText text={t("select.restart")} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary disabled:opacity-60"
              onClick={() => go()}
              onMouseEnter={() => onHover(unlocked)}
              onMouseLeave={() => onHover(false)}
              disabled={!unlocked}
              data-testid="stage2-start"
            >
              <IconPlay className="h-4 w-4" />
              <RubyText text={t("select.start")} />
            </button>
          )}
          {unlocked && (
            <button type="button" className="btn btn-ghost" onClick={() => setChapters(!chapters)}>
              <RubyText text={t("select.chapters")} />
            </button>
          )}
          {cleared && (
            <button
              type="button"
              className="btn btn-sky"
              onClick={() => navigate("/certificate/stage2")}
            >
              <RubyText text={t("select.certificate")} />
            </button>
          )}
        </div>
        {chapters && unlocked && (
          <div className="cream-box flex flex-col gap-2 rounded-2xl p-3">
            {stage2.chapters.map((c) => {
              const first = stage2.sections.find((x) => x.chapter === c.no);
              return (
                <button
                  key={c.no}
                  type="button"
                  className="btn btn-ghost justify-start"
                  onClick={() => first && go(first.id)}
                  data-testid={`stage2-chapter-${c.no}`}
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
  );
}
