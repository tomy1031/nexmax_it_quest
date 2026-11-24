import { useEffect, useMemo, useState } from "react";
import { fetchClassmates, type Classmate } from "@/lib/classmates";
import { ensureTeam, MAX_TEAM, useTeam, type TeamMember } from "@/lib/team/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

type Mode = "solo" | "multi";
const MORE = MAX_TEAM - 1;

/**
 * チームを 作る 画面（panel: team。docs/design/03_ステージ2.md §5）。
 * 「1人で」／「みんなで（2〜4人）」。1人目は 自分（かえられない）。
 * ログインしていて DB が 動いていれば 同じ 学校・期生の 一覧から えらぶ。それ以外は ニックネームを 入れる。
 * えらんだ 順が 質問の 順番。
 */
export function TeamPanel({ onDone }: { onDone: () => void }) {
  const setMembers = useTeam((s) => s.setMembers);
  const initial = useMemo(() => ensureTeam(), []);
  const me = initial[0]!;
  const [mode, setMode] = useState<Mode>(initial.length > 1 ? "multi" : "solo");
  const [classmates, setClassmates] = useState<Classmate[] | null>(null);
  const [picked, setPicked] = useState<TeamMember[]>(initial.slice(1).filter((m) => m.db));
  const [names, setNames] = useState<string[]>(() => {
    const local = initial.slice(1).filter((m) => !m.db);
    return Array.from({ length: MORE }, (_, i) => local[i]?.name ?? "");
  });

  useEffect(() => {
    let alive = true;
    void fetchClassmates().then((list) => {
      if (alive) setClassmates(list.filter((c) => c.id !== me.id));
    });
    return () => {
      alive = false;
    };
  }, [me.id]);

  const useList = (classmates?.length ?? 0) > 0;
  const others: TeamMember[] = useMemo(() => {
    if (mode === "solo") return [];
    if (useList) return picked;
    const seen = new Set<string>();
    const list: TeamMember[] = [];
    for (const raw of names) {
      const name = raw.normalize("NFKC").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      list.push({ id: `local:${name}`, name, db: false, gender: null, avatar: null });
    }
    return list;
  }, [mode, useList, picked, names]);
  const team = [me, ...others];
  const canDone = mode === "solo" || others.length >= 1;

  const toggle = (c: Classmate) =>
    setPicked((p) =>
      p.some((m) => m.id === c.id)
        ? p.filter((m) => m.id !== c.id)
        : p.length >= MORE
          ? p
          : [
              ...p,
              {
                id: c.id,
                name: c.name || t("team.noName"),
                db: true,
                gender: c.gender,
                avatar: c.avatar,
              },
            ],
    );

  const done = () => {
    if (!canDone) return;
    setMembers(team);
    onDone();
  };

  return (
    <div
      className="glass pop text-ink flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-[28px] p-5"
      data-testid="team-panel"
      role="dialog"
      aria-labelledby="team-title"
    >
      <div className="flex flex-col gap-1">
        <h2 id="team-title" className="text-2xl font-extrabold">
          <RubyText text={t("team.title")} />
        </h2>
        <p className="text-cocoa text-lg leading-[2.1] font-bold">
          <RubyText text={t("team.lead")} />
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("team.title")}>
        {(["solo", "multi"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            className={`btn min-h-12 px-6 text-lg ${mode === m ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode(m)}
            data-testid={`team-${m}`}
          >
            <RubyText text={t(m === "solo" ? "team.solo" : "team.multi")} />
          </button>
        ))}
      </div>

      {mode === "multi" && (
        <div className="cream-box flex flex-col gap-3 rounded-2xl p-4">
          {classmates === null ? (
            <p className="text-cocoa font-bold">
              <RubyText text={t("team.loading")} />
            </p>
          ) : useList ? (
            <>
              <p className="font-bold">
                <RubyText text={t("team.pickLead")} />
              </p>
              <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto p-1">
                {classmates.map((c) => {
                  const idx = picked.findIndex((m) => m.id === c.id);
                  const on = idx >= 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      // 4人に なっても 押せない 色には しない（うすい 地に 白い 字は 読めない）。押しても 何も 起きない
                      aria-disabled={!on && picked.length >= MORE}
                      className={`btn min-h-11 gap-2 px-4 ${on ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => toggle(c)}
                      data-testid={`team-pick-${c.id}`}
                    >
                      {on && (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-extrabold text-[#1f9b6c]">
                          {idx + 2}
                        </span>
                      )}
                      <span>{c.name || t("team.noName")}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="font-bold">
                <RubyText text={t("team.nameLead")} />
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {names.map((n, i) => (
                  <input
                    key={i}
                    className="input"
                    value={n}
                    placeholder={t("team.namePlaceholder", { n: i + 2 })}
                    aria-label={t("team.namePlaceholder", { n: i + 2 })}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNames((ns) => ns.map((x, j) => (j === i ? v : x)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") done();
                    }}
                    maxLength={20}
                    autoComplete="off"
                    data-testid={`team-name-${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-cocoa text-sm font-extrabold">
          <RubyText text={t("team.order")} />
        </span>
        <ol className="flex flex-wrap gap-2" data-testid="team-chips">
          {team.map((m, i) => (
            <li
              key={m.id}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#e6d4b3] bg-white py-1 pr-4 pl-1 font-extrabold"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d66838] text-sm text-white">
                {i + 1}
              </span>
              <span>{m.name || t("team.noName")}</span>
              {i === 0 && (
                <span className="text-cocoa text-sm">
                  <RubyText text={t("team.you")} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {mode === "multi" && !canDone && classmates !== null && (
          <p className="text-cocoa font-bold">
            <RubyText text={t("team.needMore")} />
          </p>
        )}
        {mode === "multi" && others.length >= MORE && (
          <p className="text-cocoa font-bold">
            <RubyText text={t("team.full")} />
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary min-h-12 px-7 text-lg"
          disabled={!canDone}
          onClick={done}
          data-testid="team-done"
        >
          <RubyText text={t("team.done")} />
        </button>
      </div>
    </div>
  );
}
