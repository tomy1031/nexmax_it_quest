import { useState } from "react";
import { playSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

/** 書いた文に、家の駅の名前が入っているか（漢字・ひらがな・カタカナ・ローマ字のどれでもよい。判定は学生に有利に）。 */
export function memoHasStation(text: string): boolean {
  const s = text.toLowerCase().replace(/\s/g, "");
  return /天王寺|てんのうじ|テンノウジ|tennoji|tennouji|m23/.test(s);
}

/**
 * メモ（企画メモ「何線？メモを促す」）。自由に書く（選択式にしない。必ず守るルール3）。
 * 家の駅の名前が入っていれば保存できる。
 */
export function MemoEditor({
  onSaved,
  required = false,
}: {
  onSaved: () => void;
  required?: boolean;
}) {
  const memo = useGame((s) => s.memo);
  const setMemo = useGame((s) => s.setMemo);
  const [text, setText] = useState(memo);
  const [error, setError] = useState(false);
  const [ok, setOk] = useState(false);

  const save = () => {
    if (required && !memoHasStation(text)) {
      setError(true);
      playSfx("ng");
      return;
    }
    setMemo(text);
    setOk(true);
    playSfx("ok");
    window.setTimeout(onSaved, 700);
  };

  return (
    <div
      className="glass-light pop flex w-full max-w-xl flex-col gap-3 rounded-3xl p-5"
      data-testid="memo"
    >
      <h2 className="text-xl font-extrabold">
        <RubyText text={t("memo.title")} />
      </h2>
      <p className="text-lg font-bold">
        <RubyText text={t("memo.help")} />
      </p>
      <p className="text-ink/70">
        <RubyText text={t("memo.example")} />
      </p>
      <textarea
        className="input min-h-28 resize-none text-xl"
        value={text}
        placeholder={t("memo.placeholder")}
        onChange={(e) => {
          setText(e.target.value);
          setError(false);
        }}
        data-testid="memo-input"
      />
      {error && (
        <p className="text-coral font-extrabold">
          <RubyText text={t("memo.needStation")} />
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        {ok && (
          <span className="text-leaf font-extrabold">
            <RubyText text={t("memo.ok")} />
          </span>
        )}
        <button type="button" className="btn btn-primary" onClick={save} data-testid="memo-save">
          <RubyText text={t("memo.save")} />
        </button>
      </div>
    </div>
  );
}
