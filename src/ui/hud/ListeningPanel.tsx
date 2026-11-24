import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import type { ListeningFile, ListeningWork } from "@/content/schema";
import { SettingsScreen } from "@/app/SettingsScreen";
import { playSfx } from "@/lib/audio";
import { useFuriganaIndex } from "@/lib/furigana-index";
import {
  hiddenKeywords,
  hideableChar,
  isLineRevealed,
  keywordHint,
  lineStarts,
  newlyRevealed,
  remainingKeywords,
  revealRate,
  submitListening,
  type HitKind,
  type ListeningState,
} from "@/lib/listening/checks";
import { LISTENINGS, startListening } from "@/lib/listening/content";
import {
  initialListeningStage,
  useListeningSaves,
  useListeningStage,
} from "@/lib/listening/stage-store";
import { createLineVoice, type LineVoice } from "@/lib/listening/voice";
import { useSettings } from "@/lib/store";
import { annotateRuby } from "@/lib/text/furigana";
import { t, type UiKey } from "@/lib/t";
import { usePlay } from "@/stages/play-store";
import { RubyText } from "@/ui/RubyText";

const BASE = import.meta.env.BASE_URL;
const SPEEDS = [
  { rate: 0.7, key: "listen.speed70" },
  { rate: 0.85, key: "listen.speed85" },
  { rate: 1, key: "listen.speed100" },
] as const;
/** 当たり（点が 入る）の 種類。 */
const HITS: HitKind[] = ["keyword", "hiragana", "contains", "partial"];
/** 外れ（入れる 所が ゆれる）の 種類。 */
const SHAKES: HitKind[] = ["miss", "partway", "romaji", "tooShort", "close"];
const BADGE_COLOR: Record<HitKind, string> = {
  keyword: "bg-[#1f9b6c]",
  hiragana: "bg-[#1978c6]",
  contains: "bg-[#1f9b6c]",
  close: "bg-[#c47a14]",
  partial: "bg-[#7b5bc9]",
  tooShort: "bg-[#6e5648]",
  repeat: "bg-[#1978c6]",
  partway: "bg-[#c47a14]",
  romaji: "bg-[#c47a14]",
  miss: "bg-[#6e5648]",
};
/** 光る 時間（ms）。3D の 画面と そろえる。 */
const GLOW_MS = 900;

type VoiceErr = "noKey" | "key" | "model" | "network";

/**
 * リスニング（docs/design/02_リスニング.md）。聞こえた 言葉を 入れると、かくれた セリフが 浮かび上がる。
 * はじめ → 聞く → こたえあわせ → 意味の ワーク → おわり（メモに 足して 閉じる）。
 * 3D の 大きな 画面と 話す 人の 動きは useListeningStage を 読む（ListeningBoard3D）。
 */
export function ListeningPanel({
  listeningId,
  onDone,
}: {
  listeningId: string;
  onDone: () => void;
}) {
  const file = LISTENINGS[listeningId];
  if (!file) return null;
  return <ListeningRun key={file.id} file={file} onDone={onDone} />;
}

function ListeningRun({ file, onDone }: { file: ListeningFile; onDone: () => void }) {
  const [, navigate] = useLocation();
  const lines = useMemo(() => file.script.map((l) => l.text), [file]);
  const starts = useMemo(() => lineStarts(lines), [lines]);
  const saved = useListeningSaves((s) => s.inputs[file.id]);
  const [inputs, setInputs] = useState<string[]>(() => saved ?? []);
  const [state, setState] = useState<ListeningState>(() => startListening(file, saved ?? []));
  const [phase, setPhase] = useState<"intro" | "listen" | "review" | "works">("intro");
  const [line, setLine] = useState(0);
  const [rate, setRate] = useState(0.85);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [heardAll, setHeardAll] = useState(false);
  const [seenMax, setSeenMax] = useState(0);
  const [voiceErr, setVoiceErr] = useState<VoiceErr | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 声を 作り直す 合図（設定で キーを 入れたあと）。 */
  const [voiceKey, setVoiceKey] = useState(0);
  const voiceRef = useRef<LineVoice | null>(null);
  const runRef = useRef(0);
  const lastPlay = useRef<{ from: number; continuous: boolean }>({ from: 0, continuous: true });

  // ── 3D と 分ける 様子 ──
  const setStage = useListeningStage.setState;
  useEffect(() => {
    setStage({ ...initialListeningStage, id: file.id, phase: "intro" });
    usePlay.setState({
      objective: { text: t("listen.objective"), arrow: false, hints: [], lines: [] },
    });
    return () => {
      setStage(initialListeningStage);
      usePlay.setState({ objective: null });
    };
  }, [file.id, setStage]);
  useEffect(() => setStage({ revealed: state.revealed }), [state.revealed, setStage]);
  useEffect(
    () =>
      setStage({
        phase,
        line,
        speaker: file.script[line]?.speaker ?? null,
        showAll: phase === "review" || phase === "works",
      }),
    [phase, line, file, setStage],
  );

  // ── 声 ──
  useEffect(() => {
    const voices = Object.fromEntries(file.participants.map((p) => [p.id, p.voice]));
    const v = createLineVoice({
      lines: file.script,
      voices,
      apiKey: useSettings.getState().geminiKey,
      onState: (s) => {
        if (s.status === "preparing") setPreparing(true);
        if (s.status === "playing") {
          setPreparing(false);
          setStage({ speaking: true });
        }
        if (s.status === "ended" || s.status === "error") {
          setPreparing(false);
          setStage({ speaking: false });
        }
      },
    });
    voiceRef.current = v;
    return () => {
      runRef.current += 1;
      v.dispose();
      voiceRef.current = null;
    };
  }, [file, setStage, voiceKey]);
  useEffect(() => voiceRef.current?.setRate(rate), [rate]);

  const stop = useCallback(() => {
    runRef.current += 1;
    voiceRef.current?.stop();
    setPlaying(false);
    setPreparing(false);
    setStage({ speaking: false });
  }, [setStage]);

  /** from の 文から 鳴らす（continuous なら 最後の 文まで つづけて）。 */
  const playFrom = useCallback(
    async (from: number, continuous: boolean) => {
      const v = voiceRef.current;
      if (!v) return;
      stop();
      const run = runRef.current;
      lastPlay.current = { from, continuous };
      setVoiceErr(null);
      setPlaying(true);
      let i = from;
      try {
        while (i < file.script.length && run === runRef.current) {
          setLine(i);
          if (i + 1 < file.script.length) v.prefetch(i + 1);
          await v.play(i, rate);
          if (run !== runRef.current) return;
          if (i === file.script.length - 1) setHeardAll(true);
          if (!continuous) break;
          i += 1;
        }
      } catch (e) {
        if (run !== runRef.current) return;
        const reason = (e as { reason?: VoiceErr }).reason;
        if (reason) setVoiceErr(reason);
      }
      if (run === runRef.current) {
        setPlaying(false);
        setStage({ speaking: false });
      }
    },
    [file, rate, stop, setStage],
  );

  // ── 入れる ──
  const submit = useCallback(
    (value: string): { hit: boolean; shake: boolean } => {
      const next = submitListening(state, value);
      const entry = next.log[0];
      if (next === state || !entry) return { hit: false, shake: false };
      const opened = newlyRevealed(state, next);
      setState(next);
      if (HITS.includes(entry.kind)) {
        const list = [...inputs, value.trim()];
        setInputs(list);
        useListeningSaves.getState().setInputs(file.id, list);
        if (opened.length) {
          setStage({ flash: { positions: opened, at: performance.now() } });
          // その 文を 3D の 画面に 出す（読んでいない とき）
          if (!playing) {
            const at = starts.findIndex(
              (s, i) => opened[0]! >= s && opened[0]! < s + lines[i]!.length,
            );
            if (at >= 0) setLine(at);
          }
        }
        playSfx("ok");
        return { hit: true, shake: false };
      }
      return { hit: false, shake: SHAKES.includes(entry.kind) };
    },
    [state, inputs, file.id, playing, starts, lines, setStage],
  );

  const finish = useCallback(() => {
    stop();
    const list = usePlay.getState().memos;
    if (!list.some((m) => m.id === file.memo.id))
      usePlay.setState({ memos: [...list, { ...file.memo }] });
    playSfx("pi");
    onDone();
  }, [file, stop, onDone]);

  const voiceError = voiceErr && (
    <VoiceError
      reason={voiceErr}
      browserVoice={voiceRef.current?.hasBrowserVoice() ?? false}
      onSettings={() => setSettingsOpen(true)}
      onRetry={() => void playFrom(lastPlay.current.from, lastPlay.current.continuous)}
      onBrowser={() => {
        voiceRef.current?.useBrowserVoice(true);
        void playFrom(lastPlay.current.from, lastPlay.current.continuous);
      }}
      onLeave={() => navigate("/stages")}
    />
  );

  const settings = settingsOpen && (
    <div className="pointer-events-auto fixed inset-0 z-40">
      <SettingsScreen
        onClose={() => {
          setSettingsOpen(false);
          // 新しい キーで 声を 作り直す
          stop();
          setVoiceKey((k) => k + 1);
          setVoiceErr(null);
        }}
      />
    </div>
  );

  if (phase === "intro") {
    return (
      <Dock>
        <div
          className="glass pop text-ink mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[28px] p-5"
          data-testid="listen-intro"
        >
          <Title file={file} />
          <div className="cream-box rounded-2xl px-4 py-3">
            <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#c47a14] px-3 py-0.5 text-sm font-extrabold text-white">
              <span aria-hidden>👂</span>
              <RubyText text={t("listen.focus")} />
            </p>
            <p className="text-xl leading-[2.2] font-extrabold">
              <RubyText text={file.focus} />
            </p>
          </div>
          <p className="text-cocoa text-lg leading-[2.1] font-bold">
            <RubyText text={t("listen.introLead")} />
            <br />
            <RubyText text={t("listen.introLead2")} />
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary min-h-14 px-8 text-xl"
              onClick={() => {
                setPhase("listen");
                void playFrom(0, true);
              }}
              data-testid="listen-start"
            >
              ▶ <RubyText text={t(inputs.length ? "listen.resume" : "listen.start")} />
            </button>
          </div>
        </div>
      </Dock>
    );
  }

  if (phase === "works") {
    return (
      <>
        <Works
          file={file}
          playLine={(i) => playFrom(i, false)}
          speaking={playing}
          onDone={finish}
        />
        {voiceError && <Dock top>{voiceError}</Dock>}
        {settings}
      </>
    );
  }

  const rateNow = revealRate(state);
  return (
    <>
      <Dock>
        <div className="flex h-[46vh] max-h-[340px] min-h-[300px] w-full gap-3">
          {phase === "listen" ? (
            <MemoCard
              file={file}
              state={state}
              rateNow={rateNow}
              playing={playing}
              preparing={preparing}
              rate={rate}
              setRate={setRate}
              heardAll={heardAll}
              onPlay={() => (playing ? stop() : void playFrom(line, true))}
              onPrev={() => void playFrom(Math.max(0, line - 1), false)}
              onNext={() => void playFrom(Math.min(lines.length - 1, line + 1), false)}
              onRestart={() => void playFrom(0, true)}
              submit={submit}
              onReview={() => {
                stop();
                setLine(0);
                setPhase("review");
                void playFrom(0, false);
              }}
              voiceError={voiceError}
            />
          ) : (
            <ReviewCard
              file={file}
              line={line}
              seenMax={seenMax}
              playing={playing}
              onPlay={() => void playFrom(line, false)}
              onGo={(i) => {
                setSeenMax((m) => Math.max(m, i));
                setLine(i);
                void playFrom(i, false);
              }}
              onAgain={() => {
                stop();
                setPhase("listen");
              }}
              onNext={() => {
                stop();
                setPhase("works");
              }}
              voiceError={voiceError}
            />
          )}
          <NoteCard
            file={file}
            state={state}
            starts={starts}
            line={line}
            showLine={phase === "review" ? line : null}
            onPick={(i) => {
              if (phase === "review") {
                setSeenMax((m) => Math.max(m, i));
                setLine(i);
              }
              void playFrom(i, false);
            }}
          />
        </div>
      </Dock>
      {settings}
    </>
  );
}

/** 画面の 下に ならべる（3D は 上に 見える）。 */
function Dock({ children, top = false }: { children: React.ReactNode; top?: boolean }) {
  return (
    <div
      className={`pointer-events-auto absolute right-0 left-0 z-20 flex justify-center px-3 ${top ? "top-20" : "bottom-0 pb-3"}`}
      data-testid={top ? undefined : "listening-panel"}
    >
      {children}
    </div>
  );
}

function Title({ file }: { file: ListeningFile }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-[#d66838] px-3 py-0.5 text-sm font-extrabold text-white">
        <span aria-hidden>🎧</span> <RubyText text={t("listen.memo")} />
      </span>
      <h3 className="text-xl font-extrabold">
        <RubyText text={file.title} />
      </h3>
    </div>
  );
}

function speakerName(file: ListeningFile, id: string): string {
  const p = file.participants.find((x) => x.id === id);
  if (p?.name) return p.name;
  const key = `speaker.${id}` as UiKey;
  try {
    return t(key) ?? id;
  } catch {
    return id;
  }
}

// ── メモ（入れる 所） ─────────────────────────────────────

function MemoCard(props: {
  file: ListeningFile;
  state: ListeningState;
  rateNow: number;
  playing: boolean;
  preparing: boolean;
  rate: number;
  setRate: (r: number) => void;
  heardAll: boolean;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRestart: () => void;
  submit: (v: string) => { hit: boolean; shake: boolean };
  onReview: () => void;
  voiceError: React.ReactNode;
}) {
  const { file, state, rateNow } = props;
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(0);
  const [paste, setPaste] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([]);
  const [hint, setHint] = useState<{ word: string; level: 1 | 2 } | null>(null);
  const latest = state.log[0];
  const goal = file.revealGoal;
  const left = remainingKeywords(state);
  const hintOk = props.heardAll || state.misses >= file.check.maxMiss;

  const send = () => {
    const v = value.trim();
    if (!v) return;
    const r = props.submit(v);
    if (r.hit) {
      const id = performance.now();
      setFloats((f) => [...f, { id, text: v }]);
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
    }
    if (r.shake) setShake((n) => n + 1);
    setValue("");
  };

  const pressHint = () => {
    const hidden = hiddenKeywords(state);
    if (hint && hint.level === 1 && hidden.includes(hint.word)) {
      setHint({ word: hint.word, level: 2 });
      return;
    }
    const word = hidden[0];
    setHint(word ? { word, level: 1 } : null);
  };
  const hintText = (() => {
    if (!hint || !hiddenKeywords(state).includes(hint.word)) return null;
    const h = keywordHint(state, hint.word, hint.level);
    return hint.level === 1
      ? t("listen.hint1", { masked: h.masked, n: h.count })
      : t("listen.hint2", { reading: h.reading });
  })();

  const why = (() => {
    if (!latest) return null;
    if (latest.kind === "partway" && latest.hintHead)
      return t("listen.why.partway", { head: latest.hintHead });
    if (latest.kind === "romaji") return t("listen.why.romaji");
    if (latest.kind === "miss") return t("listen.why.miss");
    if (latest.kind === "tooShort") return t("listen.why.tooShort", { n: file.check.minLength });
    if (latest.kind === "close") return t("listen.why.close");
    return null;
  })();

  return (
    <section
      className="glass pop text-ink relative flex w-[44%] min-w-0 flex-col gap-1.5 overflow-visible rounded-[26px] px-4 py-2.5"
      data-testid="listen-memo"
    >
      <div className="flex items-center gap-2">
        <Title file={file} />
        {props.preparing && (
          <span
            className="text-cocoa ml-auto animate-pulse text-sm font-extrabold"
            data-testid="listen-preparing"
          >
            <RubyText text={t("listen.preparing")} />
          </span>
        )}
      </div>
      {props.voiceError ?? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-primary min-h-10 px-3 py-1 text-sm"
            onClick={props.onPlay}
            data-testid="listen-play"
          >
            {props.playing ? "■" : "▶"}{" "}
            <RubyText text={t(props.playing ? "listen.stop" : "listen.play")} />
          </button>
          <IconBtn label={t("listen.prev")} onClick={props.onPrev}>
            ⏮
          </IconBtn>
          <IconBtn label={t("listen.next")} onClick={props.onNext}>
            ⏭
          </IconBtn>
          <IconBtn label={t("listen.restart")} onClick={props.onRestart} testId="listen-restart">
            ⏪
          </IconBtn>
          <div
            className="ml-auto flex flex-col items-end gap-0.5"
            role="group"
            aria-label={t("listen.speed")}
          >
            <span className="text-cocoa text-[11px] leading-none font-extrabold">
              <RubyText text={t("listen.speed")} />
            </span>
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s.rate}
                  type="button"
                  className={`rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white ${props.rate === s.rate ? "border-[#18825a] bg-[#1f9b6c]" : "border-[#48362c] bg-[#6e5648] opacity-75"}`}
                  aria-pressed={props.rate === s.rate}
                  onClick={() => props.setRate(s.rate)}
                  data-testid={`listen-speed-${s.rate}`}
                >
                  <RubyText text={t(s.key)} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <form
        className="relative flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          key={shake}
          className={`input min-w-0 flex-1 py-2 ${shake ? "nudge" : ""}`}
          value={value}
          onChange={(e) => {
            setPaste(false);
            setValue(e.target.value);
          }}
          onPaste={(e) => {
            e.preventDefault();
            setPaste(true);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setPaste(true);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("listen.placeholder", { n: file.check.minLength })}
          aria-label={t("listen.placeholder", { n: file.check.minLength })}
          data-testid="listen-input"
        />
        <button type="submit" className="btn btn-primary px-4 py-2" data-testid="listen-submit">
          <RubyText text={t("listen.submit")} />
        </button>
        {floats.map((f) => (
          <span
            key={f.id}
            className="float-up pointer-events-none absolute top-0 left-4 rounded-full bg-[#f5bf3b] px-3 py-1 text-lg font-extrabold text-[#47352b] shadow-lg"
          >
            {f.text}
          </span>
        ))}
      </form>
      <div
        className="min-h-[2.2rem] text-sm font-bold"
        data-testid="listen-result"
        aria-live="polite"
      >
        {paste ? (
          <p className="text-[#b03a48]">
            <RubyText text={t("listen.paste")} />
          </p>
        ) : latest ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white ${BADGE_COLOR[latest.kind]}`}
              data-kind={latest.kind}
            >
              <RubyText text={t(`listen.badge.${latest.kind}` as UiKey)} />
            </span>
            <span className="text-ink">{latest.input}</span>
            {latest.points > 0 && (
              <span className="font-extrabold text-[#b8780f]">+{latest.points}</span>
            )}
            {why && (
              <span className="text-cocoa w-full text-xs">
                <RubyText text={why} />
              </span>
            )}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <span>
          <RubyText text={t("listen.opened")} /> {rateNow}%
        </span>
        <div
          className="relative h-3.5 flex-1 overflow-visible rounded-full border-2 border-[#e6d4b3] bg-[#f3e7cf]"
          role="progressbar"
          aria-valuenow={rateNow}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="listen-progress"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${rateNow >= goal ? "bg-[#1f9b6c]" : "bg-[#2d9ae8]"}`}
            style={{ width: `${Math.min(100, rateNow)}%` }}
          />
          <span
            className="absolute -top-3 text-sm"
            style={{ left: `calc(${goal}% - 0.4rem)` }}
            aria-hidden
          >
            🚩
          </span>
        </div>
        <span className="rounded-full bg-[#d66838] px-2 py-0.5 text-xs text-white">
          <RubyText text={t("listen.left", { n: left })} />
        </span>
      </div>
      {state.foundKeywords.length > 0 && (
        <p
          className="text-cocoa overflow-hidden text-xs leading-[2.1] font-bold text-ellipsis whitespace-nowrap"
          data-testid="listen-found"
        >
          <RubyText text={t("listen.found")} />:{" "}
          {state.foundKeywords.map((kw) => (
            <span key={kw} className="mr-1.5">
              <RubyText text={kw} />
            </span>
          ))}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          className="btn btn-sub min-h-10 px-3 py-1 text-sm"
          disabled={!hintOk}
          onClick={pressHint}
          title={hintOk ? undefined : t("listen.hintLocked")}
          data-testid="listen-hint"
        >
          💡 <RubyText text={t("listen.hint")} />
        </button>
        {hintText ? (
          <span
            className="text-ink min-w-0 flex-1 text-base font-extrabold"
            data-testid="listen-hint-text"
          >
            {hintText}
          </span>
        ) : (
          <span className="text-cocoa min-w-0 flex-1 text-[11px] leading-tight font-bold">
            <RubyText
              text={
                rateNow >= goal || hintOk ? t("listen.goalHelp", { goal }) : t("listen.hintLocked")
              }
            />
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary min-h-10 px-3 py-1 text-sm"
          disabled={rateNow < goal}
          onClick={props.onReview}
          data-testid="listen-review"
        >
          <RubyText text={t("listen.toReview")} /> ▶
        </button>
      </div>
    </section>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost min-h-10 min-w-10 px-2 py-1 text-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

// ── ノート（台本） ───────────────────────────────────────

function NoteCard({
  file,
  state,
  starts,
  line,
  showLine,
  onPick,
}: {
  file: ListeningFile;
  state: ListeningState;
  starts: number[];
  line: number;
  /** こたえあわせで 見ている 文（全部 開いて 出す）。 */
  showLine: number | null;
  onPick: (i: number) => void;
}) {
  const flash = useListeningStage((s) => s.flash);
  // 光った あとは 光を 消す（時間が 来たら、その 光の 時刻を「おわった」に する）
  const [endedAt, setEndedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setEndedAt(flash.at), GLOW_MS + 200);
    return () => window.clearTimeout(id);
  }, [flash]);
  const glow = useMemo<ReadonlySet<number>>(
    () => (flash && endedAt !== flash.at ? new Set(flash.positions) : new Set()),
    [flash, endedAt],
  );
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [line]);
  return (
    <section
      className="glass pop text-ink flex min-w-0 flex-1 flex-col gap-1.5 rounded-[26px] px-4 py-3"
      data-testid="listen-note"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#6e5648] px-3 py-0.5 text-sm font-extrabold text-white">
          <span aria-hidden>📒</span> <RubyText text={t("listen.note")} />
        </span>
        <span className="text-cocoa text-xs font-bold">
          <RubyText text={t("listen.noteHelp")} />
        </span>
      </div>
      <ol
        ref={listRef}
        className="cream-box flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl bg-[repeating-linear-gradient(180deg,#fffaf0_0,#fffaf0_2.95rem,#efe0c4_2.95rem,#efe0c4_3rem)] py-1"
      >
        {file.script.map((l, i) => {
          const done = isLineRevealed(state, starts[i]!, l.text);
          return (
            <li key={i} data-line={i}>
              <button
                type="button"
                className={`flex w-full items-start gap-2 rounded-xl px-2 text-left ${i === line ? "bg-[#dff3e6]" : "hover:bg-[#f6ebd5]"}`}
                onClick={() => onPick(i)}
                data-testid={`listen-line-${i}`}
              >
                <span className="text-cocoa mt-[0.85rem] w-8 shrink-0 text-xs font-extrabold">
                  {i === line ? "▶" : ""}
                  {i + 1}
                </span>
                <span className="text-cocoa min-w-0 flex-1 text-lg leading-[2.35] font-extrabold whitespace-pre-wrap">
                  <ClozeLine
                    text={l.text}
                    start={starts[i]!}
                    revealed={state.revealed}
                    glow={glow}
                    all={showLine === i}
                  />
                </span>
                {done && (
                  <span className="mt-[0.9rem] shrink-0 text-sm" aria-hidden>
                    ✨
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * 1つの 文を 虫食いで 出す。かくれた 字は □、開いた 字は こげ茶。
 * 漢字の 言葉が 丸ごと 開いたら ふりがなを 付ける（RubyText。ふりがなは 読み方の データから）。
 */
export function ClozeLine({
  text,
  start,
  revealed,
  glow,
  all = false,
}: {
  text: string;
  start: number;
  revealed: ReadonlySet<number>;
  glow: ReadonlySet<number>;
  all?: boolean;
}) {
  const index = useFuriganaIndex();
  const segments = useMemo(() => annotateRuby(text, index), [text, index]);
  const out: React.ReactNode[] = [];
  let at = 0;
  segments.forEach((seg, si) => {
    const s0 = at;
    at += seg.text.length;
    const open = (k: number) => all || !hideableChar(seg.text[k]) || revealed.has(start + s0 + k);
    const shining = [...seg.text].some((_, k) => glow.has(start + s0 + k));
    if (seg.reading && [...seg.text].every((_, k) => open(k))) {
      out.push(
        <span key={si} className={shining ? "glow-in" : undefined}>
          <RubyText text={seg.text} />
        </span>,
      );
      return;
    }
    for (let k = 0; k < seg.text.length; k += 1) {
      const ch = seg.text[k]!;
      if (open(k)) {
        out.push(
          <span key={`${si}-${k}`} className={glow.has(start + s0 + k) ? "glow-in" : undefined}>
            {ch}
          </span>,
        );
      } else {
        out.push(
          <span
            key={`${si}-${k}`}
            className="mx-[0.04em] inline-block h-[0.95em] w-[0.92em] translate-y-[0.12em] rounded-[5px] border-2 border-[#d9c29a] bg-[#fff3dc]"
            aria-hidden
          />,
        );
      }
    }
  });
  return <>{out}</>;
}

// ── こたえあわせ ─────────────────────────────────────────

function ReviewCard({
  file,
  line,
  seenMax,
  playing,
  onPlay,
  onGo,
  onAgain,
  onNext,
  voiceError,
}: {
  file: ListeningFile;
  line: number;
  /** こたえあわせで 見た いちばん 後ろの 文。 */
  seenMax: number;
  playing: boolean;
  onPlay: () => void;
  onGo: (i: number) => void;
  onAgain: () => void;
  onNext: () => void;
  voiceError: React.ReactNode;
}) {
  const last = file.script.length - 1;
  const seenLast = seenMax >= last;
  const l = file.script[line]!;
  const words = file.glossary.filter((g) => l.text.includes(g.word));
  return (
    <section
      className="glass pop text-ink flex w-[44%] min-w-0 flex-col gap-2 rounded-[26px] px-4 py-3"
      data-testid="listen-review-card"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#1f9b6c] px-3 py-0.5 text-sm font-extrabold text-white">
          <RubyText text={t("listen.review")} />
        </span>
        <span className="text-cocoa text-sm font-extrabold">
          {line + 1} / {file.script.length}
        </span>
        <span className="text-cocoa text-xs font-bold">
          <RubyText text={t("listen.reviewHelp")} />
        </span>
      </div>
      {voiceError ?? (
        <div className="cream-box flex items-start gap-2 rounded-2xl px-3 py-1">
          <button
            type="button"
            className="btn btn-primary mt-2 min-h-10 min-w-10 shrink-0 px-2 py-1"
            onClick={onPlay}
            aria-label={t("listen.play")}
            data-testid="listen-review-play"
          >
            {playing ? "♪" : "▶"}
          </button>
          <div className="min-w-0">
            <span className="rounded-full bg-[#d66838] px-2 py-0.5 text-[11px] font-extrabold text-white">
              <RubyText text={speakerName(file, l.speaker)} />
            </span>
            <p className="text-xl leading-[2.3] font-extrabold" data-testid="listen-review-line">
              <RubyText text={l.text} />
            </p>
          </div>
        </div>
      )}
      {words.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" data-testid="listen-glossary">
          {words.map((g) => (
            <li
              key={g.word}
              className="rounded-full border-2 border-[#e6d4b3] bg-white px-2.5 py-0.5 text-sm font-extrabold"
            >
              <RubyText text={g.word} /> <span className="text-cocoa text-xs">= {g.en}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-10 px-3 py-1 text-sm"
          disabled={line === 0}
          onClick={() => onGo(line - 1)}
          data-testid="listen-review-back"
        >
          ← <RubyText text={t("listen.back")} />
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-10 px-3 py-1 text-sm"
          disabled={line === last}
          onClick={() => onGo(line + 1)}
          data-testid="listen-review-forward"
        >
          <RubyText text={t("listen.forward")} /> →
        </button>
        <button
          type="button"
          className="btn btn-sub min-h-10 px-3 py-1 text-sm"
          onClick={onAgain}
          data-testid="listen-again"
        >
          <RubyText text={t("listen.again")} />
        </button>
        <button
          type="button"
          className="btn btn-primary ml-auto min-h-10 px-4 py-1 text-sm"
          disabled={!seenLast}
          onClick={onNext}
          data-testid="listen-to-works"
        >
          <RubyText text={t("listen.toWorks")} /> ▶
        </button>
      </div>
    </section>
  );
}

// ── 声が 作れない とき ──────────────────────────────────

function VoiceError({
  reason,
  browserVoice,
  onSettings,
  onRetry,
  onBrowser,
  onLeave,
}: {
  reason: VoiceErr;
  browserVoice: boolean;
  onSettings: () => void;
  onRetry: () => void;
  onBrowser: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl border-2 border-[#e9b4b4] bg-[#fff4f2] p-2.5"
      data-testid="listen-error"
    >
      <p className="text-sm font-extrabold text-[#b03a48]">
        <RubyText text={t(`talk.err.${reason}` as UiKey)} />
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(reason === "noKey" || reason === "key") && (
          <button
            type="button"
            className="btn btn-primary min-h-9 px-3 py-1 text-sm"
            onClick={onSettings}
          >
            <RubyText text={t("talk.openSettings")} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary min-h-9 px-3 py-1 text-sm"
          onClick={onRetry}
        >
          <RubyText text={t("listen.retry")} />
        </button>
        {browserVoice && (
          <button
            type="button"
            className="btn btn-sky min-h-9 px-3 py-1 text-sm"
            onClick={onBrowser}
          >
            <RubyText text={t("listen.browserVoice")} />
          </button>
        )}
        <button type="button" className="btn btn-ghost min-h-9 px-3 py-1 text-sm" onClick={onLeave}>
          <RubyText text={t("talk.leave")} />
        </button>
      </div>
    </div>
  );
}

// ── 意味の ワーク ────────────────────────────────────────

function Works({
  file,
  playLine,
  speaking,
  onDone,
}: {
  file: ListeningFile;
  playLine: (i: number) => Promise<void>;
  speaking: boolean;
  onDone: () => void;
}) {
  const [k, setK] = useState(0);
  const work = file.works[k];
  useEffect(() => {
    if (!work) onDone();
  }, [work, onDone]);
  if (!work) return null;
  const next = () => setK((x) => x + 1);
  return (
    <Dock>
      <section
        className="glass pop text-ink flex h-[46vh] max-h-[340px] min-h-[300px] w-full max-w-5xl flex-col gap-2 rounded-[26px] px-5 py-3"
        data-testid={`listen-work-${work.kind}`}
        key={k}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#7b5bc9] px-3 py-0.5 text-sm font-extrabold text-white">
            <RubyText text={t("listen.work")} /> {k + 1}/{file.works.length}
          </span>
          <h3 className="text-xl font-extrabold">
            <RubyText text={work.title} />
          </h3>
          <span className="text-cocoa text-sm font-bold">
            <RubyText text={work.lead} />
          </span>
        </div>
        <WorkBody work={work} file={file} playLine={playLine} speaking={speaking} onNext={next} />
      </section>
    </Dock>
  );
}

function WorkBody(props: {
  work: ListeningWork;
  file: ListeningFile;
  playLine: (i: number) => Promise<void>;
  speaking: boolean;
  onNext: () => void;
}) {
  const { work } = props;
  if (work.kind === "match") return <MatchWork {...props} work={work} />;
  if (work.kind === "situation") return <SituationWork {...props} work={work} />;
  return <SortWork {...props} work={work} />;
}

/** 絵（まだ 無い ときは ネクマックスの 絵）。 */
function WorkImage({ src, className }: { src: string; className?: string }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img
      src={`${BASE}${src.replace(/^\//, "")}`}
      alt=""
      className={`object-contain ${className ?? ""}`}
      onError={() => setOk(false)}
    />
  ) : (
    <img
      src={`${BASE}img/nexmax/guide.webp`}
      alt=""
      className={`object-contain p-3 ${className ?? ""}`}
    />
  );
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      className={`pop rounded-2xl border-2 px-3 py-1 text-base font-extrabold ${ok ? "border-[#23a86b] bg-[#ecfdf3] text-[#115235]" : "border-[#e25868] bg-[#fff2f2] text-[#7a1e28]"}`}
      data-testid={ok ? "work-ok" : "work-ng"}
    >
      {ok ? "✓ " : "× "}
      <RubyText text={text} />
    </p>
  );
}

function MatchWork({
  work,
  file,
  playLine,
  onNext,
}: {
  work: Extract<ListeningWork, { kind: "match" }>;
  file: ListeningFile;
  playLine: (i: number) => Promise<void>;
  onNext: () => void;
}) {
  // 札は 絵と ちがう 順に ならべる（1つ ずらす）
  const labels = useMemo(
    () => [...work.pairs.slice(1), work.pairs[0]!].map((p) => p.label),
    [work],
  );
  const [pick, setPick] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const all = matched.length === work.pairs.length;
  const tryImage = (label: string) => {
    if (!pick || matched.includes(label)) return;
    if (pick === label) {
      setMatched((m) => [...m, label]);
      setPick(null);
      playSfx("ok");
      setFb({ ok: true, text: t("listen.correct") });
      const i = file.script.findIndex((l) => l.text.includes(label));
      if (i >= 0) void playLine(i);
    } else {
      setFb({ ok: false, text: t("listen.wrong") });
      setShake(pick);
      window.setTimeout(() => setShake(null), 500);
    }
  };
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex w-44 shrink-0 flex-col gap-2">
        <p className="text-cocoa text-xs font-bold">
          <RubyText text={t("listen.matchHelp")} />
        </p>
        {labels.map((label) => {
          const done = matched.includes(label);
          return (
            <button
              key={label}
              type="button"
              disabled={done}
              className={`rounded-2xl border-2 px-3 py-2 text-xl font-extrabold text-white shadow-[0_3px_0_#3f2f26] ${pick === label ? "border-[#c47a14] bg-[#d68a1c]" : "border-[#48362c] bg-[#6e5648]"} ${done ? "opacity-35" : ""} ${shake === label ? "nudge" : ""}`}
              onClick={() => setPick(pick === label ? null : label)}
              data-testid={`match-label-${label}`}
            >
              <RubyText text={label} />
            </button>
          );
        })}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
        {work.pairs.map((p) => {
          const done = matched.includes(p.label);
          return (
            <button
              key={p.label}
              type="button"
              className={`flex min-h-0 flex-col items-center gap-1 rounded-2xl border-2 bg-white p-2 ${done ? "border-[#23a86b]" : pick ? "border-[#c47a14] hover:bg-[#fff6e3]" : "border-[#e6d4b3]"}`}
              onClick={() => tryImage(p.label)}
              data-testid={`match-image-${p.label}`}
            >
              <WorkImage src={p.image} className="min-h-0 w-full flex-1 rounded-xl" />
              <span className="min-h-[2.4rem] text-center text-lg leading-tight font-extrabold">
                {done ? (
                  <>
                    <RubyText text={p.label} />
                    <span className="text-cocoa block text-xs">{p.en}</span>
                  </>
                ) : (
                  "?"
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex w-48 shrink-0 flex-col justify-end gap-2">
        {fb && <Feedback ok={fb.ok} text={fb.text} />}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!all}
          onClick={onNext}
          data-testid="work-next"
        >
          <RubyText text={t("hud.next")} /> ▶
        </button>
      </div>
    </div>
  );
}

function SituationWork({
  work,
  playLine,
  speaking,
  onNext,
}: {
  work: Extract<ListeningWork, { kind: "situation" }>;
  playLine: (i: number) => Promise<void>;
  speaking: boolean;
  onNext: () => void;
}) {
  const [i, setI] = useState(0);
  const [result, setResult] = useState<"ok" | "ng" | null>(null);
  const item = work.items[i]!;
  const last = i === work.items.length - 1;
  return (
    <div className="flex min-h-0 flex-1 gap-4" key={item.id}>
      <div className="w-[30%] shrink-0 overflow-hidden rounded-2xl border-2 border-[#e6d4b3] bg-white">
        <WorkImage src={item.image} className="h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-cocoa text-sm font-extrabold">
          {i + 1} / {work.items.length}
        </p>
        <p className="text-2xl leading-[2.2] font-extrabold" data-testid="situation-text">
          <RubyText text={item.text} />
        </p>
        <div className="grid grid-cols-2 gap-3">
          {item.options.map((o, j) => (
            <button
              key={o.text}
              type="button"
              className="btn btn-ghost min-h-16 px-3 py-2 text-lg leading-snug"
              disabled={result === "ok" || (result === "ng" && speaking)}
              onClick={() => {
                if (o.correct) {
                  setResult("ok");
                  playSfx("ok");
                } else {
                  setResult("ng");
                  // まちがえたら、その 場面の 文を もう一度 聞いてから えらび直す
                  void playLine(item.line);
                }
              }}
              data-testid={`situation-option-${j}`}
              data-correct={o.correct ? "1" : undefined}
            >
              <RubyText text={o.text} />
            </button>
          ))}
        </div>
        <div className="mt-auto flex items-end gap-3">
          <div className="min-w-0 flex-1">
            {result && <Feedback ok={result === "ok"} text={result === "ok" ? item.ok : item.ng} />}
            {result === "ng" && speaking && (
              <p className="text-cocoa animate-pulse text-sm font-bold">
                <RubyText text={t("listen.listenAgain")} />
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={result !== "ok"}
            onClick={() => {
              if (last) onNext();
              else {
                setI(i + 1);
                setResult(null);
              }
            }}
            data-testid="work-next"
          >
            <RubyText text={t("hud.next")} /> ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function SortWork({
  work,
  onNext,
}: {
  work: Extract<ListeningWork, { kind: "sort" }>;
  onNext: () => void;
}) {
  const cards = useMemo(
    () => [...work.slots.slice(1), work.slots[0]!].map((s) => ({ id: s.id, text: s.answer })),
    [work],
  );
  const [pick, setPick] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const all = placed.length === work.slots.length;
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex w-[34%] shrink-0 flex-col gap-1.5 overflow-y-auto">
        <p className="text-cocoa text-xs font-bold">
          <RubyText text={t("listen.sortHelp")} />
        </p>
        {cards
          .filter((c) => !placed.includes(c.id))
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded-xl border-2 px-3 py-1.5 text-left text-base font-extrabold text-white ${pick === c.id ? "border-[#c47a14] bg-[#d68a1c]" : "border-[#48362c] bg-[#6e5648]"}`}
              onClick={() => setPick(pick === c.id ? null : c.id)}
              data-testid={`sort-card-${c.id}`}
            >
              <RubyText text={c.text} />
            </button>
          ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 rounded-2xl border-4 border-[#c9ced6] bg-white p-2">
        {work.slots.map((s) => {
          const done = placed.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`flex flex-col items-start gap-1 rounded-xl border-2 border-dashed p-2 text-left ${done ? "border-[#23a86b] bg-[#ecfdf3]" : "border-[#c9b48c]"}`}
              onClick={() => {
                if (!pick || done) return;
                if (pick === s.id) {
                  setPlaced((p) => [...p, s.id]);
                  setPick(null);
                  playSfx("ok");
                  setFb({ ok: true, text: t("listen.correct") });
                } else {
                  setFb({ ok: false, text: t("listen.wrong") });
                }
              }}
              data-testid={`sort-slot-${s.id}`}
            >
              <span className="text-sm font-extrabold">
                {s.icon} <RubyText text={s.label} />
              </span>
              {done && (
                <span className="text-base font-extrabold text-[#115235]">
                  <RubyText text={s.answer} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex w-44 shrink-0 flex-col justify-end gap-2">
        {fb && <Feedback ok={fb.ok} text={fb.text} />}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!all}
          onClick={onNext}
          data-testid="work-next"
        >
          <RubyText text={t("hud.next")} /> ▶
        </button>
      </div>
    </div>
  );
}
