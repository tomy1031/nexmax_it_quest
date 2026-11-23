import { useState } from "react";
import { playSfx } from "@/lib/audio";
import { t, type UiKey } from "@/lib/t";
import { LINE, METRO } from "@/factory/signs";
import { RubyText } from "@/ui/RubyText";
import { RouteMap } from "@/ui/hud/RouteMap";

/**
 * 路線図で調べる。はじめに「天王寺から 阿波座まで」を問題として出し、
 * ①今の駅は どこか ②行きたい駅は どこか（路線図の上で さがす。tomy さん 2026-11-23）
 * ③まず 何線に 乗るか ④どこで 乗りかえるか ⑤本町駅で 何線に 乗るか、の順に聞く（tomy さん 2026-11-22）。
 * 読む・調べる確認なので、選ぶ形（駅をクリック・線をえらぶ）でよい（必ず守るルール3）。
 * まちがえたら「不正解。」とヒントを出し、もう一度えらぶ。
 */
type Q =
  | { key: UiKey; hint: UiKey; kind: "station"; answer: string }
  | { key: UiKey; hint: UiKey; kind: "line"; answer: string; options: string[] };

const QUESTIONS: Q[] = [
  // まず 路線図の上で 今の駅と 行きたい駅を さがす（tomy さん 2026-11-23）
  { key: "quiz.qFrom", hint: "quiz.qFromHint", kind: "station", answer: "tennoji" },
  { key: "quiz.qTo", hint: "quiz.qToHint", kind: "station", answer: "awaza" },
  { key: "quiz.q1", hint: "quiz.q1hint", kind: "line", answer: "M", options: ["M", "T"] },
  { key: "quiz.q2", hint: "quiz.q2hint", kind: "station", answer: "hommachi" },
  { key: "quiz.q3", hint: "quiz.q3hint", kind: "line", answer: "C", options: ["M", "C", "Y"] },
];

export function RouteMapQuiz({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [result, setResult] = useState<"ok" | "ng" | null>(null);
  // 今の駅・行きたい駅は、学生が さがして クリックしてから 印を付ける
  const [marks, setMarks] = useState<Record<string, "ok" | "ng">>({});
  const q = QUESTIONS[i];
  const done = i >= QUESTIONS.length;

  const answer = (id: string) => {
    if (!q || result === "ok") return;
    if (id === q.answer) {
      playSfx("ok");
      setResult("ok");
      if (q.kind === "station") setMarks((m) => ({ ...m, [id]: "ok" }));
      window.setTimeout(() => {
        setResult(null);
        setI(i + 1);
      }, 1100);
    } else {
      playSfx("ng");
      setResult("ng");
      if (q.kind === "station") {
        setMarks((m) => ({ ...m, [id]: "ng" }));
        window.setTimeout(
          () =>
            setMarks((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v === "ok"))),
          1200,
        );
      }
    }
  };

  return (
    <div
      className="glass-light pop flex w-full max-w-4xl flex-col gap-3 rounded-3xl p-5"
      data-testid="routemap-quiz"
    >
      <h2 className="text-xl font-extrabold">
        <RubyText text={t("quiz.title")} />
      </h2>
      {/* 問題: 天王寺から 阿波座まで */}
      <div
        className="bg-navy flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-white"
        data-testid="quiz-problem"
      >
        <span className="text-xl leading-loose font-extrabold">
          <RubyText text={t("quiz.problem")} />
        </span>
      </div>
      {!done && q && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3">
          <span className="bg-navy rounded-full px-3 py-1 text-sm font-extrabold text-white">
            Q{i + 1}
          </span>
          <span className="text-2xl leading-loose font-extrabold">
            <RubyText text={t(q.key)} />
          </span>
          {result === "ok" && (
            <span className="bg-leaf rounded-full px-3 py-1 font-extrabold text-white">
              <RubyText text={t("quiz.correct")} />
            </span>
          )}
          {result === "ng" && (
            <span className="text-coral font-extrabold">
              <RubyText text={`${t("quiz.wrong")} ${t(q.hint)}`} />
            </span>
          )}
        </div>
      )}
      {!done && q?.kind === "line" && (
        <div className="flex flex-wrap gap-3">
          {METRO.lines
            .filter((l) => q.options.includes(l.id))
            .map((l) => (
              <button
                key={l.id}
                type="button"
                className="btn btn-sub"
                style={{ borderColor: l.color }}
                onClick={() => answer(l.id)}
                data-testid={`line-${l.id}`}
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-full border-[3px] bg-white text-sm font-black"
                  style={{ borderColor: l.color, color: l.color }}
                >
                  {l.letter}
                </span>
                <RubyText text={LINE[l.id]!.name} />
              </button>
            ))}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <RouteMap onStation={!done && q?.kind === "station" ? answer : undefined} marks={marks} />
      </div>
      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#eafff1] px-4 py-3">
          <span className="text-xl font-extrabold text-[#0b4a25]">
            <RubyText text={`${t("quiz.done")} ${t("quiz.summary")}`} />
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onDone}
            data-testid="quiz-close"
          >
            <RubyText text={t("hud.close")} />
          </button>
        </div>
      )}
    </div>
  );
}
