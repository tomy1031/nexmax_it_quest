import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import talksJson from "@content/talks.json";
import type { Talk, TalkStep } from "@/content/schema";
import { SettingsScreen } from "@/app/SettingsScreen";
import { openLive, LiveError, type LiveConn, type LiveEvent } from "@/lib/ai/live";
import { useAppSettings } from "@/lib/app-settings";
import { playSfx } from "@/lib/audio";
import { useGame, useSettings } from "@/lib/store";
import { fill, t, type UiKey } from "@/lib/t";
import { looksJapanese, repeatOk } from "@/lib/voice-check";
import { RubyText } from "@/ui/RubyText";

const TALKS = (talksJson as unknown as { talks: Talk[] }).talks;
const BASE = import.meta.env.BASE_URL;

type Status = "idle" | "connecting" | "live" | "error" | "done";
/** listen: 学生の 番 / talking: マイクが 開いている / judging: 聞きとり中 / partner: 相手が 質問・しめくくりを 言っている */
type Phase = "listen" | "talking" | "judging" | "partner";
type ErrKey = "noKey" | "noMic" | "key" | "model" | "network" | "closed";

/**
 * 声で 話す 練習（第2章）。相手は Gemini Live（使う人の キー）。
 * tomy さん 2026-11-23「スペースを押す間、またはマイククリックしてもう一度クリックするまで」
 *
 * - 決まった セリフ（repeat）: 聞きとった 文字に 大事な ことばが 入っていれば 合格。入っていなければ「不正解」ではなく、
 *   何が 大事かを 1つ 伝えて もう一度（必ず守るルール1: 次に する ことを 1つ 添える）。
 * - 質問（answer）: 相手の 質問に 自分の ことばで 答える（選択式に しない。ルール3）。日本語で 答えていれば 次へ。
 *   中身が 合わないときは、相手（AI）が 正しい 言い方の 見本を 返事で 言う。
 * 質問は 台本（content/talks.json）の 文を 相手に「そのまま 言って」と 頼み、画面には 台本の 文を 出す（ふりがなが 付く）。
 */
export function TalkPanel({ talkId, onDone }: { talkId: string; onDone: () => void }) {
  const talk = TALKS.find((x) => x.id === talkId);
  const [, navigate] = useLocation();
  const profile = useGame((s) => s.profile);
  const teacher = useAppSettings((s) => s.teacherName);
  const vars = { name: profile.name, nickname: profile.nickname, teacher };
  const varsRef = useRef(vars);
  varsRef.current = vars;

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<ErrKey | null>(null);
  const [phase, setPhase] = useState<Phase>("listen");
  const [stepIndex, setStepIndex] = useState(0);
  const [heard, setHeard] = useState("");
  /** 相手の ことば（新しい ものが 下。画面には 2つまで 出す）。 */
  const [partnerLines, setPartnerLines] = useState<string[]>([]);
  const [result, setResult] = useState<"ok" | "retry" | "unclear" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conn = useRef<LiveConn | null>(null);
  const heardRef = useRef("");
  const phaseRef = useRef<Phase>("listen");
  const stepRef = useRef(0);
  /** 相手の 返事を 字幕に 出すか（質問・しめくくりは 台本の 文を 出すので、文字起こしは 使わない）。 */
  const freeReply = useRef(false);
  /** 相手の 返事の 1つめの かけらか（新しい 行に する）。 */
  const replyFresh = useRef(true);
  const judgeTimer = useRef<number | null>(null);
  const closingRef = useRef(false);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const close = useCallback(() => {
    conn.current?.close();
    conn.current = null;
  }, []);
  useEffect(() => close, [close]);

  /** 台本の 文を 相手に そのまま 言ってもらう（質問・しめくくり）。 */
  const partnerSays = useCallback((text: string, english: string) => {
    const line = fill(text, varsRef.current);
    freeReply.current = false;
    setPartnerLines((ls) => [...ls, line].slice(-2));
    setPhaseBoth("partner");
    conn.current?.prompt(`${english} 「${line}」`);
  }, []);

  const goStep = useCallback(
    (i: number) => {
      if (!talk) return;
      setHint(false);
      setHeard("");
      heardRef.current = "";
      if (i >= talk.steps.length) {
        if (talk.closing) {
          closingRef.current = true;
          partnerSays(
            talk.closing,
            "Now say exactly this sentence to the new employee, then stop:",
          );
        } else {
          setStatus("done");
        }
        return;
      }
      stepRef.current = i;
      setStepIndex(i);
      const step = talk.steps[i]!;
      if (step.kind === "answer") {
        const q = step.lead ? `${step.lead} ${step.ask}` : step.ask;
        partnerSays(q, "Now ask the new employee exactly this, in Japanese, then stop and wait:");
      } else {
        setPhaseBoth("listen");
      }
    },
    [talk, partnerSays],
  );

  /** 1回の 発言を 見る（相手の 返事が おわった あと）。 */
  const judge = useCallback(() => {
    if (!talk || phaseRef.current !== "judging") return;
    const step = talk.steps[stepRef.current]!;
    const said = heardRef.current;
    if (step.kind === "repeat") {
      if (repeatOk(said, step.check, step.need)) {
        setResult("ok");
        playSfx("ok");
        goStep(stepRef.current + 1);
      } else {
        setResult("retry");
        setPhaseBoth("listen");
      }
      return;
    }
    if (looksJapanese(said)) {
      setResult("ok");
      goStep(stepRef.current + 1);
    } else {
      setResult("unclear");
      partnerSays(
        fill(step.ask, varsRef.current),
        "The answer was not clear. Kindly ask the same question again, slowly:",
      );
    }
  }, [talk, goStep, partnerSays]);

  const onEvent = useCallback(
    (e: LiveEvent) => {
      switch (e.type) {
        case "heard":
          heardRef.current += e.text;
          setHeard(heardRef.current);
          return;
        case "said":
          if (!freeReply.current) return;
          if (replyFresh.current) {
            replyFresh.current = false;
            setPartnerLines((ls) => [...ls, e.text].slice(-2));
          } else {
            setPartnerLines((ls) => [...ls.slice(0, -1), (ls[ls.length - 1] ?? "") + e.text]);
          }
          return;
        case "speaking":
          setSpeaking(e.on);
          return;
        case "turn":
          if (phaseRef.current === "judging") {
            // 聞きとった 文字が 返事より あとに 届くことが あるので、少し 待ってから 見る
            if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
            judgeTimer.current = window.setTimeout(judge, 500);
          } else if (phaseRef.current === "partner") {
            if (closingRef.current) setStatus("done");
            else setPhaseBoth("listen");
          }
          return;
        case "closed":
          setErr("closed");
          setStatus("error");
          conn.current = null;
          return;
      }
    },
    [judge],
  );

  const connect = useCallback(async () => {
    if (!talk) return;
    setErr(null);
    setStatus("connecting");
    try {
      conn.current = await openLive({
        apiKey: useSettings.getState().geminiKey,
        system: fill(talk.persona, varsRef.current),
        voice: talk.voice,
        onEvent,
      });
      setStatus("live");
      closingRef.current = false;
      goStep(stepRef.current);
    } catch (e) {
      setErr(e instanceof LiveError ? e.reason : "network");
      setStatus("error");
    }
  }, [talk, onEvent, goStep]);

  const talkStart = useCallback(() => {
    if (status !== "live" || !conn.current) return;
    if (phaseRef.current !== "listen" && phaseRef.current !== "partner") return;
    // 相手が 質問を 言っている とちゅうでも、話しはじめたら 相手の 声は 止める
    heardRef.current = "";
    setHeard("");
    setResult(null);
    freeReply.current = true;
    replyFresh.current = true;
    conn.current.talkStart();
    setPhaseBoth("talking");
  }, [status]);

  const talkEnd = useCallback(() => {
    if (phaseRef.current !== "talking" || !conn.current) return;
    conn.current.talkEnd();
    setPhaseBoth("judging");
    // 返事が 来ないときも 止まらないように
    if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    judgeTimer.current = window.setTimeout(judge, 9000);
  }, [judge]);

  // スペースを 押している 間だけ 話す
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== " " || settingsOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) talkStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== " " || settingsOpen) return;
      e.preventDefault();
      e.stopPropagation();
      talkEnd();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, [talkStart, talkEnd, settingsOpen]);

  useEffect(
    () => () => {
      if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    },
    [],
  );

  if (!talk) return null;
  const step: TalkStep | undefined = talk.steps[stepIndex];
  const face = talk.partner === "hendy" ? `${BASE}img/people/hendy.webp` : null;
  const errKey: UiKey | null = err ? (`talk.err.${err}` as UiKey) : null;

  return (
    <div
      className="pointer-events-auto absolute right-0 bottom-0 left-0 z-20 flex justify-center p-3 sm:p-5"
      data-testid="talk-panel"
    >
      <div className="glass pop text-ink flex w-full max-w-4xl flex-col gap-3 rounded-[28px] p-4 sm:p-5">
        {/* 相手 */}
        <div className="flex items-start gap-3">
          {face ? (
            <img
              src={face}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border-2 border-[#e6d4b3] bg-[#f8efdc] object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
              <span className="inline-flex items-center rounded-full bg-[#d66838] px-3 py-0.5 text-white">
                <RubyText text={t(`speaker.${talk.partner}` as UiKey)} />
              </span>
              {speaking && (
                <span className="animate-pulse text-[#157a4e]">
                  <RubyText text={t("talk.partnerSpeaking")} />
                </span>
              )}
            </p>
            <div className="flex min-h-[2.4em] flex-col" data-testid="talk-partner">
              {partnerLines.map((line, i) => (
                <p
                  key={`${partnerLines.length}-${i}`}
                  className={
                    i === partnerLines.length - 1
                      ? "text-ink text-xl leading-[2.3] font-extrabold sm:text-2xl"
                      : "text-cocoa text-base leading-[2.1] font-bold"
                  }
                >
                  <RubyText text={line} />
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* すること */}
        {status === "live" && step && (
          <div className="cream-box rounded-2xl p-3.5">
            {step.kind === "repeat" ? (
              <>
                <p className="mb-1 inline-flex rounded-full bg-[#c47a14] px-2.5 py-0.5 text-xs font-extrabold text-white">
                  <RubyText text={t("talk.say")} />
                </p>
                <p
                  className="text-ink text-2xl leading-[2.3] font-extrabold"
                  data-testid="talk-line"
                >
                  <RubyText text={fill(step.say, vars)} />
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="inline-flex items-center gap-2 rounded-full bg-[#c47a14] px-3 py-0.5 text-sm font-extrabold text-white">
                  <RubyText text={t("talk.answer")} />
                  <span>
                    {stepIndex + 1 - talk.steps.filter((s) => s.kind === "repeat").length}/
                    {talk.steps.filter((s) => s.kind === "answer").length}
                  </span>
                </p>
                <button
                  type="button"
                  className="btn btn-ghost min-h-9 px-3 py-1 text-sm"
                  onClick={() => setHint((h) => !h)}
                  data-testid="talk-hint"
                >
                  <RubyText text={t("talk.hint")} />
                </button>
                {hint && (
                  <p className="text-ink w-full text-lg font-bold">
                    <RubyText text={`${t("talk.hintLead")} ${fill(step.hint, vars)}`} />
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 聞きとった ことば・見かた */}
        {status === "live" && (heard || result) && (
          <div className="flex flex-col gap-1" data-testid="talk-heard">
            {heard && (
              <p className="text-ink text-lg font-bold">
                <span className="mr-2 inline-flex rounded-full bg-[#6e5648] px-2.5 py-0.5 text-xs font-extrabold text-white">
                  <RubyText text={t("talk.heard")} />
                </span>
                <RubyText text={heard} />
              </p>
            )}
            {result === "ok" && phase !== "judging" && (
              <p className="text-lg font-extrabold text-[#157a4e]" data-testid="talk-ok">
                <RubyText text={t("talk.ok")} />
              </p>
            )}
            {result === "retry" && step?.kind === "repeat" && (
              <p className="text-lg font-extrabold text-[#b45a0c]" data-testid="talk-retry">
                <RubyText text={step.retry} />
              </p>
            )}
            {result === "unclear" && (
              <p className="text-lg font-extrabold text-[#b45a0c]" data-testid="talk-retry">
                <RubyText text={t("talk.unclear")} />
              </p>
            )}
          </div>
        )}

        {/* ボタン */}
        <div className="flex flex-wrap items-center gap-3">
          {status === "idle" && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void connect()}
                data-testid="talk-start"
              >
                <MicIcon /> <RubyText text={t("talk.start")} />
              </button>
              <span className="text-cocoa text-sm font-bold">
                <RubyText text={t("talk.startHelp")} />
              </span>
            </>
          )}
          {status === "connecting" && (
            <p className="text-cocoa animate-pulse font-extrabold">
              <RubyText text={t("talk.connecting")} />
            </p>
          )}
          {status === "live" && (
            <>
              <button
                type="button"
                className={`flex min-h-16 min-w-44 items-center justify-center gap-2 rounded-full border-2 px-6 text-xl font-extrabold text-white shadow-lg ${
                  phase === "talking"
                    ? "animate-pulse border-[#a83245] bg-[#d94f61] shadow-[0_4px_0_#8f2838]"
                    : phase === "judging"
                      ? "border-[#48362c] bg-[#6e5648]"
                      : "border-[#18825a] bg-[linear-gradient(180deg,#32bd86,#1f9b6c)] shadow-[0_4px_0_#136848]"
                }`}
                disabled={phase === "judging"}
                onClick={() => (phase === "talking" ? talkEnd() : talkStart())}
                data-testid="talk-mic"
              >
                <MicIcon />
                <RubyText
                  text={
                    phase === "talking"
                      ? t("talk.talking")
                      : phase === "judging"
                        ? t("talk.judging")
                        : t("talk.mic")
                  }
                />
              </button>
              <span className="text-cocoa max-w-md text-sm font-bold">
                <RubyText text={t("talk.micHelp")} />
              </span>
            </>
          )}
          {status === "error" && errKey && (
            <div className="flex w-full flex-col gap-2" data-testid="talk-error">
              <p className="text-lg font-extrabold text-[#c43a4b]">
                <RubyText text={t(errKey)} />
              </p>
              <div className="flex flex-wrap gap-2">
                {(err === "noKey" || err === "key") && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <RubyText text={t("talk.openSettings")} />
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => void connect()}>
                  <RubyText text={t("talk.retry")} />
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate("/stages")}>
                  <RubyText text={t("talk.leave")} />
                </button>
              </div>
            </div>
          )}
          {status === "done" && (
            <>
              <p className="font-extrabold text-[#157a4e]">
                <RubyText text={t("talk.done")} />
              </p>
              <button
                type="button"
                className="btn btn-primary ml-auto"
                // 相手が まだ 話している 間は 待つ（とちゅうで 声を 切らない）
                disabled={speaking}
                onClick={() => {
                  close();
                  onDone();
                }}
                data-testid="talk-next"
              >
                <RubyText text={t("talk.next")} /> ▶
              </button>
            </>
          )}
        </div>
      </div>
      {settingsOpen && (
        <div className="fixed inset-0 z-40">
          <SettingsScreen
            onClose={() => {
              setSettingsOpen(false);
              void connect();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
