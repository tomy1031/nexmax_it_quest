import { useEffect, useState } from "react";
import tipsJson from "@content/tips.json";
import type { Tip } from "@/content/schema";
import { useGame, useSettings } from "@/lib/store";
import { fill, t, type UiKey } from "@/lib/t";
import { useAppSettings } from "@/lib/app-settings";
import { playActions, usePlay } from "@/stages/play-store";
import { questEvents } from "@/stages/events";
import { player } from "@/three/player";
import { RubyText } from "@/ui/RubyText";
import { IconBulb, IconCheck, IconClose, IconMenu } from "@/ui/icons";
import { usePhotoUrl } from "@/ui/use-photo";
import { Menu } from "@/ui/hud/Menu";
import { LineMark } from "@/ui/LineMark";
import { Panels } from "@/ui/hud/Panels";
import { MemoBox } from "@/ui/hud/MemoPanel";

const TIPS = (tipsJson.tips as Tip[]).reduce<Record<string, Tip>>(
  (m, tip) => ((m[tip.id] = tip), m),
  {},
);
const BASE = import.meta.env.BASE_URL;

/**
 * 3D の上に重ねる表示。いま する こと（上）・セリフ（下）・選択肢・豆知識・判定・メニュー。
 * 中身はどれも台本のデータ。VR では同じデータを 3D の板に描く（docs/design/00_全体設計.md）。
 */
export function Hud() {
  const [menu, setMenu] = useState(false);
  const line = usePlay((s) => s.line);
  const verdict = usePlay((s) => s.verdict);
  const dream = usePlay((s) => s.dream);

  // スペース・エンターで「つぎへ」
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu) return;
      if ((e.key === " " || e.key === "Enter") && (line || verdict || dream)) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        e.preventDefault();
        playActions.advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [line, verdict, dream, menu]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* 左上: いま する こと と、やる ことの リスト（たてに ならべる） */}
      <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
        <ObjectiveBar />
        <TodoList />
      </div>
      {/* メニューは、問題・パネル・豆知識が出ている間も押せる（その上に出す。閉じたら問題にもどる。tomy さん 2026-11-22） */}
      <button
        type="button"
        className="btn btn-ghost pointer-events-auto absolute top-3 right-3 z-[25] px-3"
        onClick={() => setMenu(true)}
        data-testid="hud-menu"
      >
        <IconMenu className="h-5 w-5" />
        <RubyText text={t("hud.menu")} />
      </button>
      <MemoBox />
      <HintBubble />
      <ChapterBanner />
      <Dialogue />
      <EmoteButton />
      <Choice />
      <Verdict />
      <Dream />
      <TipCard />
      <Panels />
      {menu && <Menu onClose={() => setMenu(false)} />}
    </div>
  );
}

/**
 * おじぎの ボタン（企画メモ「お辞儀のエモートボタンクリック」）。台本が「おじぎ」を 待っている ときに出る。
 * 押すと 自分が おじぎを して、おわったら 台本へ 合図を 出す。
 */
function EmoteButton() {
  const waiting = usePlay((s) => s.waitingFor === "emote:bow" && !s.line && !s.panel);
  const [busy, setBusy] = useState(false);
  if (!waiting) return null;
  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2">
      <button
        type="button"
        className="btn btn-primary pop min-h-16 px-8 text-2xl"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          player.emote = { kind: "bow", until: performance.now() + 1400 };
          window.setTimeout(() => {
            setBusy(false);
            questEvents.emit("emote:bow");
          }, 1300);
        }}
        data-testid="emote-bow"
      >
        🙇 <RubyText text={t("emote.bow")} />
      </button>
    </div>
  );
}

function ObjectiveBar() {
  const objective = usePlay((s) => s.objective);
  // ヒントを ひらいた「いま すること」（ちがう目的に かわったら、自然に とじる）
  const [hintFor, setHintFor] = useState<unknown>(null);
  if (!objective) return null;
  const hintOpen = hintFor === objective;
  const hint = objective.hints[0];
  return (
    <div
      className={`glass pop flex max-w-[min(70vw,560px)] flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 ${hint ? "pointer-events-auto cursor-pointer" : ""}`}
      data-testid="objective"
      // 押すと ヒントを1つ出す（Codex の UI の相談 3）
      onClick={() => hint && setHintFor(hintOpen ? null : objective)}
    >
      <span className="shrink-0 rounded-full bg-[#0a63d6] px-2.5 py-0.5 text-xs font-extrabold text-white">
        <RubyText text={t("hud.objective")} />
      </span>
      {objective.lines.map((id) => (
        <LineMark key={id} id={id} />
      ))}
      <span className="text-xl font-extrabold">
        <RubyText text={objective.text} />
      </span>
      {hint && !hintOpen && (
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white">
          <RubyText text={t("hud.objectiveTap")} />
        </span>
      )}
      {hint && hintOpen && (
        <span className="w-full text-[17px] font-bold text-white">
          <span className="bg-sun text-ink mr-2 inline-flex items-center gap-1 rounded-full px-2 text-xs">
            <IconBulb className="h-3.5 w-3.5" />
            <RubyText text={t("hud.hint")} />
          </span>
          <RubyText text={hint} />
        </span>
      )}
    </div>
  );
}

/**
 * やることリスト（tomy さん 2026-11-23「やることが発生した場合にリストを作って表示してください」
 * 「やったらよこせん。完了したタスクを非表示にする小さいボタン」）。
 * 台本の todo-add で足し、todo-done で横線。かくすかどうかは この端末に保存する。
 */
function TodoList() {
  const todos = usePlay((s) => s.todos);
  const hide = useSettings((s) => s.hideDoneTodos ?? false);
  const setSettings = useSettings((s) => s.setSettings);
  if (todos.length === 0) return null;
  const shown = hide ? todos.filter((x) => !x.done) : todos;
  const doneCount = todos.filter((x) => x.done).length;
  return (
    <div
      className="glass pointer-events-auto w-[min(60vw,300px)] rounded-2xl px-3 py-2"
      data-testid="todo-list"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-white">
          <RubyText text={t("hud.todo")} />
          <span className="ml-1.5 text-xs opacity-80">
            {doneCount}/{todos.length}
          </span>
        </span>
        {doneCount > 0 && (
          <button
            type="button"
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-white/25"
            onClick={() => setSettings({ hideDoneTodos: !hide })}
            data-testid="todo-toggle"
          >
            <RubyText text={t(hide ? "hud.todoShow" : "hud.todoHide")} />
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {shown.map((x) => (
          <li
            key={x.id}
            className={`pop flex items-center gap-2 text-[15px] font-bold text-white ${x.done ? "opacity-60" : ""}`}
            data-testid={`todo-${x.id}`}
            data-done={x.done}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${x.done ? "border-[#7ee0a6] bg-[#2f9d63]" : "border-white/70"}`}
              aria-label={x.done ? t("hud.todoDone") : undefined}
            >
              {x.done && <IconCheck className="h-3.5 w-3.5 text-white" />}
            </span>
            <span className={x.done ? "line-through decoration-2" : ""}>
              <RubyText text={x.text} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HintBubble() {
  const objective = usePlay((s) => s.objective);
  const level = usePlay((s) => s.hintLevel);
  const line = usePlay((s) => s.line);
  if (!objective || level === 0 || line) return null;
  const hint = objective.hints[level - 1];
  if (!hint) return null;
  return (
    <div className="pop absolute bottom-6 left-4 flex items-end gap-2" key={level}>
      <img src={`${BASE}img/nexmax/guide.webp`} alt="" className="bob h-24 w-24" />
      <div className="glass-light max-w-sm rounded-2xl rounded-bl-sm px-4 py-3 text-lg font-bold">
        <span className="bg-sun text-ink mr-2 inline-flex items-center gap-1 rounded-full px-2 text-xs">
          <IconBulb className="h-3.5 w-3.5" />
          <RubyText text={t("hud.hint")} />
        </span>
        <RubyText text={hint} />
      </div>
    </div>
  );
}

function ChapterBanner() {
  const no = usePlay((s) => s.chapterBanner);
  const stageId = usePlay((s) => s.stageId);
  if (!no) return null;
  return (
    <div className="bg-deep/40 absolute inset-0 grid place-items-center">
      <div className="pop glass rounded-3xl px-12 py-6 text-center" data-testid="chapter-banner">
        <p className="text-sm font-bold tracking-widest text-white">{stageId.toUpperCase()}</p>
        <p className="text-4xl font-extrabold">
          <RubyText text={t("hud.chapter", { no })} />
        </p>
      </div>
    </div>
  );
}

function speakerName(who: string, nickname: string): string {
  if (who === "me") return nickname;
  return t(`speaker.${who}` as UiKey);
}

function Dialogue() {
  const line = usePlay((s) => s.line);
  const nickname = useGame((s) => s.profile.nickname);
  const name = useGame((s) => s.profile.name);
  const teacher = useAppSettings((s) => s.teacherName);
  const photo = usePhotoUrl();
  if (!line) return null;
  const text = fill(line.text, { nickname, name, teacher });
  const face =
    line.who === "nexmax"
      ? `${BASE}img/nexmax/${line.pose ?? "guide"}.webp`
      : line.who === "hendy"
        ? `${BASE}img/people/hendy.webp`
        : line.who === "me"
          ? photo
          : null;
  const announce = line.who === "announce";
  return (
    <div className="pointer-events-auto absolute right-0 bottom-0 left-0 flex justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={() => playActions.advance()}
        className={`pop flex w-full max-w-4xl items-end gap-4 rounded-3xl p-4 text-left sm:p-5 ${announce ? "glass border-sun/70" : "glass"}`}
        data-testid="dialogue"
        key={text}
      >
        {face ? (
          <img
            src={face}
            alt=""
            className={`h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24 ${line.who === "nexmax" ? "bob" : "border-cyan/60 border-2"}`}
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-extrabold text-white">
            <RubyText text={speakerName(line.who, nickname)} />
          </span>
          <span className="text-2xl leading-[2.4] font-bold sm:text-[1.7rem]">
            <RubyText text={text} />
          </span>
        </span>
        {/* つぎへ（大きめ。パネルの どこを押しても 進む） */}
        <span className="flex min-h-11 min-w-28 shrink-0 items-center justify-center gap-1 self-end rounded-2xl bg-[#0a63d6] px-4 py-2 text-base font-extrabold text-white shadow-[0_0_12px_rgba(56,216,255,0.5)]">
          <RubyText text={t("hud.next")} /> ▶
        </span>
      </button>
    </div>
  );
}

function Choice() {
  const choice = usePlay((s) => s.choice);
  if (!choice) return null;
  return (
    <div className="bg-deep/40 pointer-events-auto absolute inset-0 grid place-items-center p-4">
      <div
        className="glass pop flex w-full max-w-xl flex-col gap-4 rounded-3xl p-6"
        data-testid="choice"
      >
        <p className="text-center text-2xl leading-loose font-extrabold">
          <RubyText text={choice.prompt} />
        </p>
        {choice.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className="btn btn-ghost py-4 text-xl"
            onClick={() => playActions.choose(i)}
            data-testid={`choice-${i}`}
          >
            <RubyText text={o} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Verdict() {
  const verdict = usePlay((s) => s.verdict);
  if (!verdict) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-[18%] flex justify-center p-4">
      <button
        type="button"
        className={`pop flex max-w-2xl items-center gap-4 rounded-3xl border-4 px-6 py-5 text-left shadow-2xl ${verdict.ok ? "border-leaf bg-[#eafff1] text-[#0b4a25]" : "border-coral bg-[#fff1ee] text-[#7a1f12]"}`}
        onClick={() => playActions.advance()}
        data-testid="verdict"
      >
        <span
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl font-black text-white ${verdict.ok ? "bg-leaf" : "bg-coral"}`}
        >
          {verdict.ok ? <IconCheck className="h-9 w-9" /> : <IconClose className="h-8 w-8" />}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">
            <RubyText text={t(verdict.ok ? "hud.correct" : "hud.wrong")} />
          </span>
          <span className="text-2xl leading-loose font-extrabold">
            <RubyText text={verdict.text} />
          </span>
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-black/10 px-3 py-1 text-sm font-extrabold">
          <RubyText text={t("hud.next")} /> ▶
        </span>
      </button>
    </div>
  );
}

function Dream() {
  const dream = usePlay((s) => s.dream);
  const dreamImage = usePlay((s) => s.dreamImage);
  const [imgOk, setImgOk] = useState(true);
  if (!dream) return null;
  const showImg = Boolean(dreamImage) && imgOk;
  // 絵があり、位置の決まった名前は絵の中に。それ以外は下に絵文字つきで並べる。
  const placed = showImg ? dream.filter((d) => d.x !== undefined && d.y !== undefined) : [];
  const rest = dream.filter((d) => !placed.includes(d));
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgba(255,183,213,0.35),rgba(7,26,70,0.6))] p-4">
      <button
        type="button"
        className="pop text-ink flex flex-col items-center gap-5 rounded-[3rem] bg-white/95 px-10 py-8 shadow-2xl"
        onClick={() => playActions.advance()}
        data-testid="dream"
      >
        <p className="text-xl font-extrabold">
          <RubyText text={t("hud.dream")} />
        </p>
        {showImg && dreamImage && (
          <div className="@container relative w-[min(80vw,760px,calc((100vh-15rem)*1.5))]">
            <img
              src={`${BASE}${dreamImage.replace(/^\//, "")}`}
              alt=""
              className="block aspect-[3/2] w-full rounded-[2rem] object-contain"
              onError={() => setImgOk(false)}
              data-testid="dream-image"
            />
            {/* 絵の中の丸の すぐ下に、どこで 何をするかを重ねる */}
            {placed.map((d) => (
              <span
                key={d.text}
                className="absolute -translate-x-1/2 rounded-full border-2 border-[#0a63d6]/30 bg-white px-[1.6cqw] py-[0.6cqw] text-[clamp(0.7rem,2.1cqw,1rem)] leading-tight font-extrabold whitespace-nowrap shadow-md"
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
                data-testid="dream-label"
              >
                <RubyText text={d.text} />
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-5">
          {rest.map((d) => (
            <div
              key={d.text}
              className="flex w-40 flex-col items-center gap-2 rounded-3xl bg-sky-50 p-4"
            >
              <span className="text-6xl">{d.icon}</span>
              <span className="text-center text-lg font-extrabold">
                <RubyText text={d.text} />
              </span>
            </div>
          ))}
        </div>
        <span className="rounded-full bg-[#0a63d6] px-4 py-1 font-extrabold text-white">
          <RubyText text={t("hud.next")} /> ▶
        </span>
      </button>
    </div>
  );
}

export function TipView({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  const [more, setMore] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  return (
    <div
      className="glass-light pop flex w-full max-w-2xl flex-col gap-4 rounded-3xl p-6"
      data-testid="tip"
    >
      <div className="flex items-center gap-2">
        <span className="bg-sun flex items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold">
          <IconBulb className="h-4 w-4" />
          <RubyText text={t("hud.tip")} />
        </span>
        <h3 className="text-2xl font-extrabold">
          <RubyText text={tip.title} />
        </h3>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative grid h-48 w-full shrink-0 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#dff4ff,#ffffff)] sm:w-64">
          {imgOk ? (
            <img
              src={`${BASE}${tip.image.slice(1)}`}
              alt=""
              className="h-full w-full object-contain"
              onError={() => setImgOk(false)}
            />
          ) : (
            <img
              src={`${BASE}img/nexmax/${tip.pose ?? "guide"}.webp`}
              alt=""
              className="bob h-40 w-40"
            />
          )}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xl leading-[2.3] font-bold">
            <RubyText text={tip.text} />
          </p>
          {more && tip.more && (
            <p className="text-ink/80 text-lg leading-[2.2] font-bold">
              <RubyText text={tip.more} />
            </p>
          )}
          <p className="text-ink/60 text-sm">{tip.en}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {tip.more && !more && (
          <button type="button" className="btn btn-sub" onClick={() => setMore(true)}>
            <RubyText text={t("hud.more")} />
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose} data-testid="tip-close">
          <RubyText text={t("hud.ok")} />
        </button>
      </div>
    </div>
  );
}

function TipCard() {
  const id = usePlay((s) => s.tip);
  const tip = id ? TIPS[id] : undefined;
  if (!tip) return null;
  return (
    <div className="bg-deep/50 pointer-events-auto absolute inset-0 grid place-items-center p-4">
      <TipView key={tip.id} tip={tip} onClose={() => playActions.closeTip()} />
    </div>
  );
}

export { TIPS };
