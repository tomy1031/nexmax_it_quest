import { useState } from "react";
import { playSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";
import { Avatar } from "@/ui/hud/NMChat";

/** 着いたことが書けているか（「着きました」「つきました」「着いた」など。学生に有利に見る）。 */
export function reportOk(text: string): boolean {
  const s = text.replace(/\s/g, "");
  return s.length >= 4 && /着|つき|つい|ツキ|arrive/i.test(s);
}

/**
 * ヘンディさんへの連絡（NMChat の DM）。自分で書く（選択式にしない。必ず守るルール3）。
 * 書けたら、ヘンディさんが返事をくれる。
 */
export function ReportPanel({ onDone }: { onDone: () => void }) {
  const nickname = useGame((s) => s.profile.nickname);
  const setReport = useGame((s) => s.setReport);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const send = () => {
    if (!reportOk(text)) {
      setError(true);
      playSfx("ng");
      return;
    }
    setSent(text);
    setReport(text);
    playSfx("ok");
  };

  return (
    <div
      className="text-ink flex h-[min(72vh,560px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
      data-testid="report"
    >
      <header className="flex items-center gap-3 bg-[#1b2a5c] px-4 py-3 text-white">
        <Avatar who="hendy" />
        <span className="text-lg font-extrabold">
          <RubyText text={t("speaker.hendy")} />
        </span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 rounded-2xl bg-sky-50 p-3">
          <p className="text-lg font-extrabold">
            <RubyText text={t("report.title")} />
          </p>
          <p>
            <RubyText text={t("report.help")} />
          </p>
          <p className="text-ink/70">
            <RubyText text={t("report.example")} />
          </p>
        </div>
        {sent && (
          <>
            <div className="mb-3 flex justify-end">
              <p className="bg-cyan/30 max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 text-lg">
                {sent}
              </p>
            </div>
            <div className="pop mb-3 flex gap-2">
              <Avatar who="hendy" />
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-lg leading-[2.2]">
                <RubyText text={t("report.hendy1", { nickname })} />
                <br />
                <RubyText text={t("report.hendy2")} />
              </div>
            </div>
          </>
        )}
      </div>
      <footer className="flex flex-col gap-2 border-t border-slate-200 p-3">
        {error && (
          <p className="text-coral font-extrabold">
            <RubyText text={t("report.short")} />
          </p>
        )}
        {sent ? (
          <button
            type="button"
            className="btn btn-primary self-end"
            onClick={onDone}
            data-testid="report-close"
          >
            <RubyText text={t("hud.close")} />
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={text}
              placeholder={t("chat.inputPlaceholder")}
              onChange={(e) => {
                setText(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
              data-testid="report-input"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={send}
              data-testid="report-send"
            >
              <RubyText text={t("chat.send")} />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
