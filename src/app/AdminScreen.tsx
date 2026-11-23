import { useState } from "react";
import { useLocation } from "wouter";
import {
  saveAppSettings,
  useAppSettings,
  validateAppSettings,
  type SaveResult,
} from "@/lib/app-settings";
import { useAuth } from "@/lib/auth";
import { t, type UiKey } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";

/**
 * 管理者の画面（DB で管理者になっている人だけ。academy と同じ印 = profiles.is_admin）。
 * tomy さん 2026-11-23「DBで管理者の場合は管理者画面の表示を可能としたい」
 * 「今後のことについては○○先生から（現在は冨永先生、今後管理者の設定画面で設定可）」
 *
 * 画面を出すかどうかは、ここで isAdmin を見る。保存できるかどうかは DB の行の権限が決める（画面を ごまかしても書けない）。
 */
export function AdminScreen() {
  const [, navigate] = useLocation();
  const isAdmin = useAuth((s) => s.isAdmin);
  const ready = useAuth((s) => s.ready);
  // DB の値が あとから届いたら、入れる所を作りなおす（はじめの値のまま 上書きしないように）
  const loaded = useAppSettings((s) => s.loaded);

  return (
    <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,#1f5fd1_0%,#071a46_55%)] px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold">
            <RubyText text={t("admin.title")} />
          </h1>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/settings")}
            data-testid="admin-back"
          >
            <RubyText text={t("admin.back")} />
          </button>
        </header>
        {!ready ? null : isAdmin ? (
          <TeacherSection key={String(loaded)} />
        ) : (
          <p className="glass rounded-2xl p-5 text-lg font-bold" data-testid="admin-denied">
            <RubyText text={t("admin.notAdmin")} />
          </p>
        )}
      </div>
    </main>
  );
}

function TeacherSection() {
  const saved = useAppSettings();
  const [name, setName] = useState(saved.teacherName);
  const [reading, setReading] = useState(saved.teacherReading);
  const [state, setState] = useState<"idle" | "saving" | SaveResult>("idle");
  const bad = validateAppSettings({ teacherName: name, teacherReading: reading });

  const save = async () => {
    setState("saving");
    setState(await saveAppSettings({ teacherName: name, teacherReading: reading }));
  };

  const message: UiKey | null =
    state === "idle" || state === "saving"
      ? null
      : state.ok
        ? "admin.saved"
        : state.reason === "invalid"
          ? "admin.errInvalid"
          : state.reason === "denied"
            ? "admin.errDenied"
            : "admin.errNetwork";

  return (
    <section className="glass flex flex-col gap-4 rounded-2xl p-5">
      <h2 className="text-xl font-extrabold text-white">
        <RubyText text={t("admin.teacherTitle")} />
      </h2>
      <p className="text-white">
        <RubyText text={t("admin.teacherHelp")} />
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-bold text-white">
          <RubyText text={t("admin.teacherName")} />
        </span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          data-testid="admin-teacher-name"
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold text-white">
          <RubyText text={t("admin.teacherReading")} />
        </span>
        <input
          className="input"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          maxLength={30}
          data-testid="admin-teacher-reading"
          autoComplete="off"
        />
      </label>
      {bad === null && (
        <div className="rounded-xl bg-[#0b2a66] p-3 text-white">
          <span className="text-sm font-bold">
            <RubyText text={t("admin.preview")} />
          </span>
          {/* 見本だけは、入れている途中の読みで ふりがなを出す（保存すると、アプリ全体の読みも かわる） */}
          <p className="text-xl leading-[2.2] font-bold">
            <RubyText
              text={t("admin.previewText", { teacher: name.trim() })}
              extra={[[name.trim(), reading.trim()]]}
            />
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={bad !== null || state === "saving"}
          onClick={() => void save()}
          data-testid="admin-save"
        >
          <RubyText text={state === "saving" ? t("admin.saving") : t("admin.save")} />
        </button>
        {message && (
          <span
            className={`font-bold ${message === "admin.saved" ? "text-leaf" : "text-coral"}`}
            data-testid="admin-message"
          >
            <RubyText text={t(message)} />
          </span>
        )}
        {bad !== null && (name || reading) && (
          <span className="text-coral font-bold">
            <RubyText text={t("admin.errInvalid")} />
          </span>
        )}
      </div>
    </section>
  );
}
