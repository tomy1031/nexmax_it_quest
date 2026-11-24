import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { SettingsScreen } from "@/app/SettingsScreen";
import { openLive, LiveError, type LiveConn, type LiveEvent } from "@/lib/ai/live";
import { playSfx } from "@/lib/audio";
import {
  applyTurn,
  askedCount,
  cardById,
  currentMember,
  deepNote,
  feedbackText,
  initMeeting,
  judgeQuestion,
  judgeReply,
  meetingContent,
  memoText,
  minutesLeft,
  missedCards,
  replyText,
  slotsLeft,
  stars,
  type Judgement,
  type MeetingFile,
  type TeamMeetingState,
  type TurnResult,
} from "@/lib/meeting";
import { useSettings } from "@/lib/store";
import { t, type UiKey } from "@/lib/t";
import { createTeamSync } from "@/lib/team/sync";
import { ensureTeam, teamKey } from "@/lib/team/store";
import { usePlay } from "@/stages/play-store";
import { useBoard } from "@/stages/stage2/board-store";
import { RubyText } from "@/ui/RubyText";

const BASE = import.meta.env.BASE_URL;

/**
 * 質問の 時間（ステージ2。docs/design/03_ステージ2.md §4）。中身は content/meetings/<mode>.json。
 * コツ → 「これは いい 質問ですか」5問（読む 確認なので えらぶ 形）→ 質問（自分の 声。えらぶ 形に しない。ルール3）→ 結果。
 *
 * - お客さまの 声は Gemini Live（使う人の キー。声は content の client.voice）。事実は persona に ある。
 * - 見かたは 端末の 中で 決める（src/lib/meeting。AI には 決めさせない）。会話に 出す お客さまの 文は content の 文（ふりがなが 付く）。
 * - 3D は ホワイトボードと 山本社長が 上に 見える 向き（台本の focus: board）。この 画面は 下に カードを 2つ 出す。
 * - チームの 状態は 1回ごとに 端末へ、おわりに DB へ（src/lib/team/sync.ts）。
 */

type Phase = "tips" | "quiz" | "rounds" | "result";
type Status = "idle" | "connecting" | "live" | "error";
type Mic = "listen" | "talking" | "judging" | "partner";
type ErrKey = "noKey" | "noMic" | "key" | "model" | "network" | "closed";

interface LogLine {
  who: "client" | "member" | "note";
  name?: string;
  text: string;
  result?: TurnResult;
}

const RESULT_ICON: Record<TurnResult, string> = {
  new: "✨",
  bonus: "⭐",
  known: "🗒️",
  unclear: "✏️",
  offTopic: "🧭",
  undecided: "⏳",
};
const RESULT_COLOR: Record<TurnResult, string> = {
  new: "text-[#157a4e]",
  bonus: "text-[#a8620c]",
  known: "text-[#6e5648]",
  unclear: "text-[#b45a0c]",
  offTopic: "text-[#b45a0c]",
  undecided: "text-[#4d5fa8]",
};

export function MeetingPanel({ meetingId, onDone }: { meetingId: string; onDone: () => void }) {
  const m = useMemo(() => meetingContent(meetingId), [meetingId]);
  if (!m) return null;
  return <Meeting m={m} onDone={onDone} />;
}

function Meeting({ m, onDone }: { m: MeetingFile; onDone: () => void }) {
  const [, navigate] = useLocation();
  const team = useMemo(() => ensureTeam(), []);
  const members = useMemo(() => team.map((x) => ({ id: x.id, name: x.name })), [team]);
  const key = `${teamKey("stage2", team)}:${m.id}`;
  const sync = useMemo(() => createTeamSync<TeamMeetingState>("stage2", team), [team]);

  const [phase, setPhase] = useState<Phase>("tips");
  const [state, setState] = useState<TeamMeetingState>(() => initMeeting(m.id, members));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [log, setLog] = useState<LogLine[]>([]);

  // 前の つづき（同じ チームで おわって いない ミーティング）が あれば、質問から 始める
  useEffect(() => {
    let alive = true;
    void sync.load(key).then((saved) => {
      if (!alive || !saved || saved.done || saved.meetingId !== m.id || saved.log.length === 0)
        return;
      setState(saved);
      setLog(rebuildLog(m, saved));
      setPhase("rounds");
    });
    return () => {
      alive = false;
    };
  }, [sync, key, m]);

  // ホワイトボード（3D）に 開いた カードと えらべるかを 伝える
  useEffect(() => {
    useBoard.setState({ opened: Object.keys(state.opened) });
  }, [state.opened]);
  useEffect(() => {
    const live = phase === "rounds" && !state.done;
    useBoard.setState({
      pickable: live,
      turnId: live ? (state.members[state.turn % state.members.length]?.id ?? null) : null,
    });
  }, [phase, state.done, state.turn, state.members]);
  useEffect(
    () => () => useBoard.setState({ pickable: false, selected: null, talking: null, turnId: null }),
    [],
  );

  const finish = () => {
    const memo = memoText(stateRef.current, m);
    usePlay.setState((s) => ({ vars: { ...s.vars, heard: memo || t("meet.memoNone") } }));
    sync.save(key, stateRef.current, true);
    onDone();
  };

  return (
    <>
      {phase === "tips" && <Tips m={m} onNext={() => setPhase("quiz")} />}
      {phase === "quiz" && <Quiz m={m} onNext={() => setPhase("rounds")} />}
      {phase === "rounds" && (
        <Rounds
          m={m}
          state={state}
          log={log}
          onTurn={(next, lines) => {
            setState(next);
            setLog((l) => [...l, ...lines]);
            sync.save(key, next, next.done);
          }}
          onOpening={(line) => setLog((l) => (l.length === 0 ? [line] : l))}
          onResult={() => setPhase("result")}
          onLeave={() => navigate("/stages")}
        />
      )}
      {phase === "result" && (
        <Result
          m={m}
          state={state}
          onAgain={() => {
            const fresh = initMeeting(m.id, members);
            setState(fresh);
            setLog([]);
            sync.save(key, fresh, false);
            setPhase("rounds");
          }}
          onNext={finish}
        />
      )}
    </>
  );
}

/** 保存から 会話の 記録を 作りなおす（つづきから 始めた とき）。 */
function rebuildLog(m: MeetingFile, s: TeamMeetingState): LogLine[] {
  const name = (id: string) => s.members.find((x) => x.id === id)?.name ?? "";
  const out: LogLine[] = [{ who: "client", text: m.opening }];
  for (const l of s.log) {
    out.push({ who: "member", name: name(l.by), text: l.q });
    if (l.a) out.push({ who: "client", text: l.a });
    out.push({ who: "note", text: m.feedback[l.result], result: l.result });
  }
  return out;
}

// ── コツ ─────────────────────────────────────────────

function Dock({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      className="pointer-events-auto absolute right-0 bottom-0 left-0 z-20 flex justify-center p-3 sm:p-4"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function Tips({ m, onNext }: { m: MeetingFile; onNext: () => void }) {
  return (
    <Dock testId="meeting-tips">
      <div className="glass pop text-ink flex w-full max-w-5xl flex-col gap-3 rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#c47a14] px-3 py-0.5 text-sm font-extrabold text-white">
            <RubyText text={m.lesson.title} />
          </span>
          <p className="text-lg leading-[2.1] font-extrabold">
            <RubyText text={m.lesson.lead} />
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {m.lesson.tips.map((tip) => (
            <div key={tip.id} className="cream-box flex items-start gap-3 rounded-2xl p-3">
              <span className="text-4xl leading-none">{tip.icon}</span>
              <div>
                <p className="text-lg font-extrabold">
                  <RubyText text={tip.title} />
                </p>
                <p className="text-cocoa text-base leading-[2] font-bold">
                  <RubyText text={tip.text} />
                </p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary self-end"
          onClick={onNext}
          data-testid="meeting-lesson-go"
        >
          <RubyText text={t("meet.lessonGo")} /> ▶
        </button>
      </div>
    </Dock>
  );
}

function Quiz({ m, onNext }: { m: MeetingFile; onNext: () => void }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const ex = m.lesson.examples[i]!;
  const tip = m.lesson.tips.find((x) => x.id === ex.tip);
  const last = i === m.lesson.examples.length - 1;
  const ok = answer !== null && answer === ex.good;
  return (
    <Dock testId="meeting-quiz">
      <div className="glass pop text-ink flex w-full max-w-4xl flex-col gap-3 rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#c47a14] px-3 py-0.5 text-sm font-extrabold text-white">
            <RubyText text={m.lesson.prompt} />
          </span>
          <span className="text-cocoa text-sm font-extrabold">
            {t("meet.quizCount", { n: i + 1, total: m.lesson.examples.length })}
          </span>
        </div>
        <div className="cream-box flex items-center gap-3 rounded-2xl p-3">
          <span
            className={`shrink-0 rounded-full px-3 py-0.5 text-sm font-extrabold text-white ${ex.who === "hendy" ? "bg-[#d66838]" : "bg-[#6e5648]"}`}
          >
            <RubyText text={t(`speaker.${ex.who}` as UiKey)} />
          </span>
          <p className="text-2xl leading-[2.2] font-extrabold" data-testid="meeting-quiz-text">
            <RubyText text={`「${ex.text}」`} />
          </p>
        </div>
        {answer === null ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary min-h-14 px-6 text-xl"
              onClick={() => {
                setAnswer(true);
                playSfx(ex.good ? "ok" : "card");
              }}
              data-testid="meeting-quiz-good"
            >
              <RubyText text={t("meet.good")} />
            </button>
            <button
              type="button"
              className="btn btn-sub min-h-14 px-6 text-xl"
              onClick={() => {
                setAnswer(false);
                playSfx(!ex.good ? "ok" : "card");
              }}
              data-testid="meeting-quiz-bad"
            >
              <RubyText text={t("meet.bad")} />
            </button>
          </div>
        ) : (
          <div
            className="flex flex-wrap items-center gap-3"
            data-testid="meeting-quiz-verdict"
            data-ok={ok}
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl font-black text-white ${ok ? "bg-[#1f9b6c]" : "bg-[#d94f61]"}`}
            >
              {ok ? "○" : "×"}
            </span>
            <p
              className={`min-w-0 flex-1 text-lg leading-[2.1] font-extrabold ${ok ? "text-[#157a4e]" : "text-[#b4323f]"}`}
            >
              {/* 正解・不正解は 学生の 答えで 決める（文は「よい 質問か」の 理由） */}
              <RubyText text={t(ok ? "hud.correct" : "hud.wrong")} />
              {" — "}
              <RubyText text={ex.reason.replace(/^(正解！?|不正解。)\s*/, "")} />
            </p>
            {tip && (
              <span className="cream-box flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold">
                {tip.icon} <RubyText text={t("meet.tipLabel")} />: <RubyText text={tip.title} />
              </span>
            )}
            <button
              type="button"
              className="btn btn-primary ml-auto"
              onClick={() => {
                if (last) onNext();
                else {
                  setI(i + 1);
                  setAnswer(null);
                }
              }}
              data-testid="meeting-quiz-next"
            >
              <RubyText text={t(last ? "meet.toQuestions" : "meet.quizNext")} /> ▶
            </button>
          </div>
        )}
      </div>
    </Dock>
  );
}

// ── 質問 ─────────────────────────────────────────────

function Rounds({
  m,
  state,
  log,
  onTurn,
  onOpening,
  onResult,
  onLeave,
}: {
  m: MeetingFile;
  state: TeamMeetingState;
  log: LogLine[];
  onTurn: (next: TeamMeetingState, lines: LogLine[]) => void;
  onOpening: (line: LogLine) => void;
  onResult: () => void;
  onLeave: () => void;
}) {
  const selected = useBoard((s) => s.selected);
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<ErrKey | null>(null);
  const [mic, setMic] = useState<Mic>("listen");
  const [heard, setHeard] = useState("");
  // ヒントの 段（えらんだ カードが かわったら はじめから）
  const [hintFor, setHintFor] = useState<{ card: string | null; n: number }>({
    card: null,
    n: 0,
  });
  const hint = hintFor.card === selected ? hintFor.n : 0;
  const [speaking, setSpeaking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [last, setLast] = useState<{ j: Judgement; fb: string; deep: string | null } | null>(null);

  const conn = useRef<LiveConn | null>(null);
  const micRef = useRef<Mic>("listen");
  const heardRef = useRef("");
  const replyRef = useRef("");
  const judgeTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const logEnd = useRef<HTMLDivElement>(null);

  const setMicBoth = (x: Mic) => {
    micRef.current = x;
    setMic(x);
  };

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  const close = useCallback(() => {
    conn.current?.close();
    conn.current = null;
  }, []);
  useEffect(() => close, [close]);
  useEffect(
    () => () => {
      if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    },
    [],
  );

  /** 1回の 質問を 見る（お客さまの 返事が おわった あと）。 */
  const judge = useCallback(() => {
    if (micRef.current !== "judging") return;
    const s = stateRef.current;
    const q = heardRef.current.trim();
    const opened = Object.keys(s.opened);
    let j = judgeQuestion(m, q, { selected: useBoard.getState().selected, opened });
    if (j.result === "pending")
      j = { ...judgeReply(m, replyRef.current, { opened }), deep: j.deep };
    const a = replyText(m, j);
    const who = currentMember(s);
    const next = applyTurn(s, m, { q, a, j });
    const fb = feedbackText(m, j);
    const deep = deepNote(m, j);
    const lines: LogLine[] = [{ who: "member", name: who.name, text: q || "…" }];
    if (a) lines.push({ who: "client", text: a });
    const result = j.result === "pending" ? "unclear" : j.result;
    lines.push({ who: "note", text: fb, result });
    if (deep) lines.push({ who: "note", text: deep, result: "new" });
    setLast({ j, fb, deep });
    if (result === "new" || result === "bonus") playSfx("ok");
    if (result !== "unclear") useBoard.setState({ selected: null });
    useBoard.setState({ talking: null });
    setMicBoth("listen");
    onTurn(next, lines);
  }, [m, onTurn]);

  const onEvent = useCallback(
    (e: LiveEvent) => {
      switch (e.type) {
        case "heard":
          heardRef.current += e.text;
          setHeard(heardRef.current);
          return;
        case "said":
          replyRef.current += e.text;
          return;
        case "speaking":
          setSpeaking(e.on);
          useBoard.setState({ talking: e.on ? "yamamoto" : null });
          return;
        case "turn":
          if (micRef.current === "judging") {
            // 聞きとった 文字が 返事より あとに 届く ことが あるので、少し 待ってから 見る
            if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
            judgeTimer.current = window.setTimeout(judge, 500);
          } else if (micRef.current === "partner") {
            setMicBoth("listen");
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
    setErr(null);
    setStatus("connecting");
    try {
      conn.current = await openLive({
        apiKey: useSettings.getState().geminiKey,
        system: m.persona,
        voice: m.client.voice,
        onEvent,
      });
      setStatus("live");
      // はじめの ひとこと（「では、聞きたい ことから どうぞ。」）
      onOpening({ who: "client", text: m.opening });
      setMicBoth("partner");
      conn.current.prompt(
        `The meeting starts now. Say exactly this sentence to the new employees, then stop and wait: 「${m.opening}」`,
      );
    } catch (e) {
      setErr(e instanceof LiveError ? e.reason : "network");
      setStatus("error");
    }
  }, [m, onEvent, onOpening]);

  const talkStart = useCallback(() => {
    if (status !== "live" || !conn.current || stateRef.current.done) return;
    if (micRef.current !== "listen" && micRef.current !== "partner") return;
    heardRef.current = "";
    replyRef.current = "";
    setHeard("");
    setLast(null);
    conn.current.talkStart();
    setMicBoth("talking");
    useBoard.setState({ talking: currentMember(stateRef.current).id });
  }, [status]);

  const talkEnd = useCallback(() => {
    if (micRef.current !== "talking" || !conn.current) return;
    conn.current.talkEnd();
    setMicBoth("judging");
    useBoard.setState({ talking: null });
    // 返事が 来ない ときも 止まらない ように
    if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    judgeTimer.current = window.setTimeout(judge, 9000);
  }, [judge]);

  // スペースを 押して いる 間だけ 話す（TalkPanel と 同じ）
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

  const who = currentMember(state);
  const card = selected ? cardById(m, selected) : undefined;
  const errKey: UiKey | null = err ? (`talk.err.${err}` as UiKey) : null;
  const left = slotsLeft(state, m);
  const turnResult = last ? (last.j.result === "pending" ? "unclear" : last.j.result) : null;

  return (
    <>
      {/* のこりの 回数（上の まん中） */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2">
        <div
          className={`glass pop flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-extrabold ${left <= 3 ? "text-[#b4323f]" : "text-ink"}`}
          data-testid="meeting-meter"
        >
          <RubyText text={t("meet.meter", { n: left, min: minutesLeft(state, m) })} />
          <span className="flex gap-0.5" aria-hidden>
            {Array.from({ length: m.slots }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-2.5 w-2.5 rounded-full ${i < left ? "bg-[#1f9b6c]" : "bg-[#d8cbb6]"}`}
              />
            ))}
          </span>
        </div>
      </div>

      <div
        className="pointer-events-auto absolute right-0 bottom-0 left-0 z-20 flex justify-center gap-3 p-3"
        data-testid="meeting-panel"
      >
        {/* 左: 質問する 人 */}
        <div className="glass pop text-ink flex w-[40%] max-w-[520px] min-w-0 flex-col gap-2 rounded-[26px] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full bg-[#1f9b6c] px-3 py-0.5 text-base font-extrabold text-white"
              data-testid="meeting-turn"
            >
              <RubyText text={t("meet.turn", { name: who.name })} />
            </span>
            {state.members.length > 1 &&
              state.members.map((x, i) => (
                <span
                  key={x.id}
                  className={`rounded-full px-2.5 py-0.5 text-sm font-extrabold ${i === state.turn ? "bg-[#d66838] text-white" : "bg-[#efe2c6] text-[#5c463a]"}`}
                >
                  {x.name}
                  {i === state.turn ? " ●" : ""}
                </span>
              ))}
          </div>

          {/* 聞く こと（ホワイトボードと 同じ 札） */}
          <div className="flex flex-wrap items-center gap-2" data-testid="meeting-topic">
            <span className="text-cocoa text-sm font-extrabold">
              <RubyText text={t("meet.topic")} />:
            </span>
            {card ? (
              <>
                <span className="text-lg font-extrabold">
                  {card.icon} <RubyText text={card.label} />
                </span>
                <button
                  type="button"
                  className="rounded-full bg-[#6e5648] px-2.5 py-0.5 text-xs font-extrabold text-white"
                  onClick={() => useBoard.setState({ selected: null })}
                >
                  <RubyText text={t("meet.change")} />
                </button>
              </>
            ) : (
              <span className="text-cocoa text-base font-bold">
                <RubyText text={t("meet.topicNone")} />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {m.cards.map((c) => {
              const open = Boolean(state.opened[c.id]);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={open}
                  title={c.label}
                  onClick={() => useBoard.setState({ selected: selected === c.id ? null : c.id })}
                  className={`grid h-10 w-10 place-items-center rounded-xl border-2 text-xl ${open ? "border-[#16704a] bg-[#1f8a5c]" : selected === c.id ? "border-[#e08a1e] bg-[#fff3c4]" : "border-[#e2cfae] bg-[#fff8ea] hover:bg-[#fff1d0]"}`}
                  data-testid={`meeting-card-${c.id}`}
                >
                  {open ? "✓" : c.icon}
                </button>
              );
            })}
          </div>

          {/* ヒント（押した 分だけ 出る。点は へらさない） */}
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              className="btn btn-sub min-h-9 shrink-0 px-3 py-1 text-sm"
              onClick={() => setHintFor({ card: selected, n: Math.min(3, hint + 1) })}
              disabled={!card || hint >= 3}
              data-testid="meeting-hint"
            >
              💡 <RubyText text={t("meet.hint")} /> {card ? `${hint}/3` : ""}
            </button>
            <div
              className="min-w-0 flex-1 text-base leading-[1.9] font-bold"
              data-testid="meeting-hint-text"
            >
              {!card && (
                <span className="text-cocoa">
                  <RubyText text={t("meet.hintNoCard")} />
                </span>
              )}
              {card && hint >= 1 && (
                <p>
                  {card.icon} <RubyText text={card.label} />{" "}
                  <span className="text-cocoa/80 text-sm">({card.en})</span>
                </p>
              )}
              {card && hint >= 2 && card.frame && (
                <p>
                  <RubyText text={`${t("meet.hintFrame")} ${card.frame}`} />
                </p>
              )}
              {card && hint >= 3 && card.example && (
                <p className="text-[#157a4e]">
                  <RubyText text={`${t("meet.hintExample")} ${card.example}`} />
                </p>
              )}
            </div>
          </div>

          {/* マイク */}
          <div className="flex flex-wrap items-center gap-2">
            {status === "idle" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void connect()}
                data-testid="meeting-start"
              >
                🎤 <RubyText text={t("talk.start")} />
              </button>
            )}
            {status === "connecting" && (
              <p className="text-cocoa animate-pulse font-extrabold">
                <RubyText text={t("talk.connecting")} />
              </p>
            )}
            {status === "live" && !state.done && (
              <button
                type="button"
                className={`flex min-h-14 min-w-40 items-center justify-center gap-2 rounded-full border-2 px-5 text-lg font-extrabold text-white shadow-lg ${
                  mic === "talking"
                    ? "animate-pulse border-[#a83245] bg-[#d94f61] shadow-[0_4px_0_#8f2838]"
                    : mic === "judging"
                      ? "border-[#48362c] bg-[#6e5648]"
                      : "border-[#18825a] bg-[linear-gradient(180deg,#32bd86,#1f9b6c)] shadow-[0_4px_0_#136848]"
                }`}
                disabled={mic === "judging"}
                onClick={() => (mic === "talking" ? talkEnd() : talkStart())}
                data-testid="meeting-mic"
              >
                🎤
                <RubyText
                  text={
                    mic === "talking"
                      ? t("talk.talking")
                      : mic === "judging"
                        ? t("talk.judging")
                        : t("talk.mic")
                  }
                />
              </button>
            )}
            {status === "live" && state.done && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={speaking}
                onClick={() => {
                  close();
                  onResult();
                }}
                data-testid="meeting-show-result"
              >
                <RubyText text={t("meet.showResult")} /> ▶
              </button>
            )}
            {status === "live" && mic === "talking" && heard && (
              <span className="text-cocoa text-sm font-bold">
                <RubyText text={heard} />
              </span>
            )}
            {status === "error" && errKey && (
              <div className="flex w-full flex-col gap-2" data-testid="meeting-error">
                <p className="font-extrabold text-[#c43a4b]">
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
                  <button type="button" className="btn btn-ghost" onClick={onLeave}>
                    <RubyText text={t("talk.leave")} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右: 会話 */}
        <div className="glass pop text-ink flex w-[58%] max-w-[740px] min-w-0 flex-col gap-1.5 rounded-[26px] p-3.5">
          <div className="flex items-center gap-2">
            <img
              src={`${BASE}img/people/yamamoto.webp`}
              alt=""
              className="h-9 w-9 rounded-xl border-2 border-[#e6d4b3] bg-[#f8efdc] object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <span className="rounded-full bg-[#2f6b4f] px-3 py-0.5 text-sm font-extrabold text-white">
              <RubyText text={t("speaker.yamamoto")} />
            </span>
            <span className="text-cocoa text-sm font-extrabold">
              <RubyText text={t("meet.log")} />
            </span>
            {speaking && (
              <span className="animate-pulse text-sm font-extrabold text-[#157a4e]">
                <RubyText text={t("talk.partnerSpeaking")} />
              </span>
            )}
          </div>
          <div
            className="flex max-h-[min(30vh,230px)] min-h-[120px] flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1"
            data-testid="meeting-log"
          >
            {log.map((l, i) =>
              l.who === "note" ? (
                <p
                  key={i}
                  className={`text-base leading-[2] font-extrabold ${RESULT_COLOR[l.result ?? "new"]}`}
                  data-testid="meeting-feedback"
                  data-result={l.result}
                >
                  {RESULT_ICON[l.result ?? "new"]} <RubyText text={l.text} />
                </p>
              ) : (
                <p key={i} className="text-lg leading-[2.1] font-bold">
                  <span
                    className={`mr-1.5 inline-flex rounded-full px-2 py-0 text-xs font-extrabold text-white ${l.who === "client" ? "bg-[#2f6b4f]" : "bg-[#d66838]"}`}
                  >
                    {l.who === "client" ? <RubyText text={t("speaker.yamamoto")} /> : l.name}
                  </span>
                  <RubyText text={l.text} />
                </p>
              ),
            )}
            <div ref={logEnd} />
          </div>
          {turnResult && last && (
            <span className="sr-only" data-testid="meeting-last" data-result={turnResult}>
              {last.fb}
            </span>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div className="pointer-events-auto fixed inset-0 z-40">
          <SettingsScreen
            onClose={() => {
              setSettingsOpen(false);
              void connect();
            }}
          />
        </div>
      )}
    </>
  );
}

// ── 結果 ─────────────────────────────────────────────

function Result({
  m,
  state,
  onAgain,
  onNext,
}: {
  m: MeetingFile;
  state: TeamMeetingState;
  onAgain: () => void;
  onNext: () => void;
}) {
  const n = stars(state, m);
  const missed = missedCards(state, m);
  const openedMust = m.cards.filter((c) => state.opened[c.id]);
  const bonus = m.bonus.filter((c) => state.opened[c.id]);
  const undecided = m.undecided.filter((u) => state.undecided.includes(u.id));
  const counts = askedCount(state);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-[#3b2c23]/35 p-3">
      <div
        className="glass pop text-ink flex max-h-[94vh] w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded-[28px] p-5"
        data-testid="meeting-result"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-extrabold">
            <RubyText text={t("meet.result")} />
          </h2>
          <span className="text-3xl tracking-wider" data-testid="meeting-stars" data-stars={n}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < n ? "text-[#f0b429]" : "text-[#d8cbb6]"}>
                ★
              </span>
            ))}
          </span>
          <span className="rounded-full bg-[#1f8a5c] px-3 py-0.5 font-extrabold text-white">
            <RubyText text={t("meet.opened", { n: openedMust.length, total: m.cards.length })} />
          </span>
        </div>
        <p className="text-lg leading-[2.1] font-extrabold">
          <RubyText text={missed.length === 0 ? m.result.allFound : m.result.someLeft} />
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="cream-box flex flex-col gap-1.5 rounded-2xl p-3">
            {openedMust.map((c) => (
              <p key={c.id} className="text-base leading-[1.9] font-bold">
                ✅ {c.icon} <RubyText text={`${c.label}: ${c.short}`} />
              </p>
            ))}
            {bonus.length > 0 && (
              <>
                <p className="mt-1 text-sm font-extrabold text-[#a8620c]">
                  ⭐ <RubyText text={t("meet.bonus")} />
                </p>
                {bonus.map((c) => (
                  <p key={c.id} className="text-base leading-[1.9] font-bold">
                    {c.icon} <RubyText text={`${c.label}: ${c.short}`} />
                  </p>
                ))}
              </>
            )}
          </section>
          <section className="flex flex-col gap-3">
            {missed.length > 0 && (
              <div
                className="cream-box flex flex-col gap-1.5 rounded-2xl p-3"
                data-testid="meeting-missed"
                data-missed={missed.map((c) => c.id).join(",")}
              >
                <p className="text-sm font-extrabold text-[#b4323f]">
                  <RubyText text={t("meet.missed")} />
                </p>
                {missed.map((c) => (
                  <p key={c.id} className="text-base leading-[1.9] font-bold">
                    {c.icon} <RubyText text={c.label} />{" "}
                    <span className="text-[#157a4e]">
                      → <RubyText text={`${t("meet.tryThis")} 「${c.example}」`} />
                    </span>
                  </p>
                ))}
              </div>
            )}
            {undecided.length > 0 && (
              <div className="cream-box flex flex-col gap-1 rounded-2xl p-3">
                <p className="text-sm font-extrabold text-[#4d5fa8]">
                  ⏳ <RubyText text={t("meet.nextMeeting")} />
                </p>
                <p className="text-base font-bold">
                  {undecided.map((u) => (
                    <span key={u.id} className="mr-3 inline-block">
                      {u.icon} <RubyText text={u.label} />
                    </span>
                  ))}
                </p>
              </div>
            )}
            <div className="cream-box flex flex-col gap-1 rounded-2xl p-3">
              <p className="text-cocoa text-sm font-extrabold">
                <RubyText text={t("meet.who")} />
              </p>
              <div className="flex flex-wrap gap-2">
                {state.members.map((x) => (
                  <span
                    key={x.id}
                    className="rounded-full bg-[#6e5648] px-3 py-0.5 text-sm font-extrabold text-white"
                  >
                    {x.name} <RubyText text={t("meet.times", { n: counts[x.id] ?? 0 })} />
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onAgain}
            data-testid="meeting-again"
          >
            <RubyText text={t("meet.again")} />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNext}
            data-testid="meeting-next"
          >
            <RubyText text={t("meet.next")} /> ▶
          </button>
        </div>
      </div>
    </div>
  );
}
