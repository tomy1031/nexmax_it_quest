import { useState } from "react";
import chatJson from "@content/nmchat.json";
import type { ChatFile } from "@/content/schema";
import { useGame } from "@/lib/store";
import { fill, t, todayJa } from "@/lib/t";
import { questEvents } from "@/stages/events";
import { RubyText } from "@/ui/RubyText";
import { usePhotoUrl } from "@/ui/use-photo";

const CHAT = chatJson as ChatFile;
const BASE = import.meta.env.BASE_URL;

/**
 * NMChat（Slack のような会社のチャット。企画メモ）。
 * mode="onboarding" のときは、#onboarding を開くまで「とじる」を出さない（読まずに先へ進まない）。
 */
export function NMChat({ mode, onDone }: { mode: "onboarding" | "view"; onDone: () => void }) {
  const [channel, setChannel] = useState<string | null>(mode === "view" ? "onboarding" : null);
  const nickname = useGame((s) => s.profile.nickname);
  const [read, setRead] = useState(mode === "view");
  const current = CHAT.channels.find((c) => c.id === channel);
  const vars = { nickname, date: todayJa() };

  const open = (id: string) => {
    setChannel(id);
    if (id === "onboarding") {
      setRead(true);
      questEvents.emit("nmchat:read-onboarding");
    }
  };

  return (
    <div
      className="text-ink flex h-[min(70vh,560px)] w-full overflow-hidden rounded-2xl bg-white shadow-xl"
      data-testid="nmchat"
    >
      <aside className="flex w-44 shrink-0 flex-col gap-1 bg-[#1b2a5c] p-3 text-white sm:w-56">
        <p className="mb-2 text-lg font-black tracking-wide">
          <RubyText text={t("chat.title")} />
        </p>
        <p className="text-xs font-bold text-white/60">
          <RubyText text={t("chat.channels")} />
        </p>
        {CHAT.channels.map((c) => {
          const unread = mode === "onboarding" && c.id === "onboarding" && !read;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => open(c.id)}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left font-bold ${channel === c.id ? "bg-cyan text-ink" : "hover:bg-white/10"} ${unread ? "ring-sun ring-2" : ""}`}
              data-testid={`channel-${c.id}`}
            >
              <span># {c.name}</span>
              {unread && (
                <span className="bg-coral rounded-full px-1.5 text-xs text-white">
                  <RubyText text={t("chat.unread")} />
                </span>
              )}
            </button>
          );
        })}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        {current ? (
          <>
            <header className="border-b border-slate-200 px-4 py-3">
              <p className="text-lg font-extrabold"># {current.name}</p>
              <p className="text-sm text-slate-500">
                <RubyText text={current.topic} />
              </p>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {current.messages.map((m, i) => (
                <div key={i} className="mb-4 flex gap-3">
                  <Avatar who={m.from} />
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="font-extrabold">
                        <RubyText
                          text={m.from === "hendy" ? t("speaker.hendy") : t("speaker.nexmax")}
                        />
                      </span>
                      <span className="text-xs text-slate-400">{m.time}</span>
                    </p>
                    {m.lines.map((l, j) => (
                      <p key={j} className="text-lg leading-[2.2]">
                        <RubyText text={fill(l, vars)} />
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-xl font-bold text-slate-500">
            <RubyText text={t("chat.readHint")} />
          </div>
        )}
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <span className="text-sm font-bold text-slate-500">
            {mode === "onboarding" && read && <RubyText text={t("chat.readDone")} />}
          </span>
          {read && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onDone}
              data-testid="nmchat-close"
            >
              <RubyText text={t("hud.close")} />
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

export function Avatar({ who }: { who: string }) {
  const photo = usePhotoUrl();
  const src =
    who === "hendy"
      ? `${BASE}img/people/hendy.webp`
      : who === "me"
        ? (photo ?? `${BASE}img/nexmax/hello.webp`)
        : `${BASE}img/nexmax/guide.webp`;
  return <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-sky-100 object-cover" />;
}
