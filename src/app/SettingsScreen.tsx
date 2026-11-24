import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useLoginRequired, useSetupComplete } from "@/app/use-setup";
import { checkGeminiKey } from "@/lib/ai/key-check";
import { signInWithGoogle, signOut, useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { deletePhoto, savePhoto, shrinkToSquare } from "@/lib/photo";
import { isKatakanaName, useGame, useSettings } from "@/lib/store";
import { COHORTS, UNIVERSITIES } from "@/lib/school";
import { t, type UiKey } from "@/lib/t";
import { usePhotoUrl } from "@/ui/use-photo";
import { RubyText } from "@/ui/RubyText";
import { IconCamera, IconCheck } from "@/ui/icons";

/**
 * 設定。名前（カタカナ）・ニックネーム・顔写真・Google ログイン・Gemini のキー・画面の設定。
 * 入れたものはその場で保存する（「保存」を押し忘れて消えないように）。
 * onClose を渡すと、ステージの上に重ねて開く形になり、「もどる」で同じ場面にもどる
 * （メニューから開いたとき。タイトルへ移ると、ステージがやり直しになるため。tomy さん 2026-11-22）。
 */
export function SettingsScreen({ onClose }: { onClose?: () => void } = {}) {
  const [, navigate] = useLocation();
  const ready = useSetupComplete();
  const loginRequired = useLoginRequired();
  const profile = useGame((s) => s.profile);
  const setProfile = useGame((s) => s.setProfile);
  const nameOk = profile.name.length === 0 || isKatakanaName(profile.name);

  return (
    <main className="bg-pastel-page h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="text-ink text-3xl font-extrabold drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]">
            <RubyText text={t("settings.title")} />
          </h1>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => (onClose ? onClose() : navigate("/"))}
            data-testid="settings-back"
          >
            <RubyText text={onClose ? t("settings.back") : t("settings.toTitle")} />
          </button>
        </header>

        <Section title={t("settings.profile")}>
          <Field label={t("settings.name")} badge="required">
            <input
              className="input"
              value={profile.name}
              placeholder={t("settings.namePlaceholder")}
              onChange={(e) => setProfile({ name: e.target.value })}
              data-testid="settings-name"
              autoComplete="off"
            />
            {!nameOk && (
              <p className="mt-1 text-sm font-extrabold text-[#c43a4b]">
                <RubyText text={t("settings.nameError")} />
              </p>
            )}
          </Field>
          <Field label={t("settings.nickname")} badge="required" help={t("settings.nicknameHelp")}>
            <input
              className="input"
              value={profile.nickname}
              placeholder={t("settings.nicknamePlaceholder")}
              onChange={(e) => setProfile({ nickname: e.target.value })}
              data-testid="settings-nickname"
              autoComplete="off"
            />
          </Field>
          <SchoolField />
          <PhotoField />
        </Section>

        <LoginSection />
        <GeminiSection />
        <ViewSection />

        <div
          className={`rounded-[24px] border-2 p-4 text-center text-lg font-extrabold shadow-md ${
            ready
              ? "border-[#23a86b] bg-[#e9fbf1] text-[#146e48]"
              : "border-[#e2b238] bg-[#fff7dc] text-[#7a4f0a]"
          }`}
          data-testid="settings-status"
        >
          <RubyText
            text={
              ready
                ? t("settings.ready")
                : loginRequired
                  ? t("settings.notReadyLogin")
                  : t("settings.notReady")
            }
          />
          {ready && (
            <div className="mt-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => (onClose ? onClose() : navigate("/"))}
              >
                <RubyText text={onClose ? t("settings.back") : t("settings.toTitle")} />
              </button>
            </div>
          )}
        </div>
        <a
          href={`${import.meta.env.BASE_URL}credits.txt`}
          className="text-cocoa self-center text-sm font-bold underline"
        >
          <RubyText text={t("title.credits")} />
        </a>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass text-ink rounded-[26px] p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
        <span className="inline-block h-3 w-3 rounded-full bg-[#24a878]" aria-hidden />
        <RubyText text={title} />
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  badge,
  help,
  children,
}: {
  label: string;
  badge?: "required" | "optional";
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 font-extrabold">
        <RubyText text={label} />
        {badge && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white ${badge === "required" ? "bg-[#d94f61]" : "bg-[#6e5648]"}`}
          >
            <RubyText text={t(badge === "required" ? "settings.required" : "settings.optional")} />
          </span>
        )}
      </span>
      {help && (
        <span className="text-cocoa text-sm font-bold">
          <RubyText text={help} />
        </span>
      )}
      {children}
    </label>
  );
}

function PhotoField() {
  const setProfile = useGame((s) => s.setProfile);
  const url = usePhotoUrl();
  const [camera, setCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const store = async (blob: Blob) => {
    await savePhoto(blob);
    setProfile({ hasPhoto: true });
    window.dispatchEvent(new Event("nexmax-photo"));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const img = await createImageBitmap(file);
    await store(await shrinkToSquare(img, img.width, img.height));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 font-extrabold">
        <RubyText text={t("settings.photo")} />
        <span className="rounded-full bg-[#6e5648] px-2.5 py-0.5 text-xs font-extrabold text-white">
          <RubyText text={t("settings.optional")} />
        </span>
      </span>
      <span className="text-cocoa text-sm font-bold">
        <RubyText text={t("settings.photoHelp")} />
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="cream-box grid h-28 w-28 place-items-center overflow-hidden rounded-2xl">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconCamera className="text-cocoa/50 h-10 w-10" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setCamera(true)}>
            <IconCamera className="h-5 w-5" />
            <RubyText text={t("settings.photoTake")} />
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <RubyText text={t("settings.photoUpload")} />
          </button>
          {url && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await deletePhoto();
                setProfile({ hasPhoto: false });
                window.dispatchEvent(new Event("nexmax-photo"));
              }}
            >
              <RubyText text={t("settings.photoDelete")} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      </div>
      <p className="text-cocoa text-xs font-bold">
        <RubyText text={t("settings.photoNote")} />
      </p>
      {camera && <CameraModal onClose={() => setCamera(false)} onShot={store} />}
    </div>
  );
}

function CameraModal({
  onClose,
  onShot,
}: {
  onClose: () => void;
  onShot: (b: Blob) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(() => !navigator.mediaDevices);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 960, height: 720 } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
      })
      .catch(() => setError(true));
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, []);

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    await onShot(await shrinkToSquare(v, v.videoWidth, v.videoHeight));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#3b2c23]/55 p-4">
      <div className="glass pop flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] p-5">
        {error ? (
          <p className="font-extrabold text-[#c43a4b]">
            <RubyText text={t("settings.cameraError")} />
          </p>
        ) : (
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="h-full w-full scale-x-[-1] object-cover"
              playsInline
              muted
            />
          </div>
        )}
        <div className="flex gap-3">
          {!error && (
            <button type="button" className="btn btn-primary" onClick={() => void shoot()}>
              <IconCamera className="h-5 w-5" />
              <RubyText text={t("settings.photoShoot")} />
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <RubyText text={t("settings.cancel")} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 学校（AUPP・CADT）と 期生（1〜5）。academy と 同じ ユーザーの 表に 書く（ログインしているとき）。 */
function SchoolField() {
  const profile = useGame((s) => s.profile);
  const setProfile = useGame((s) => s.setProfile);
  return (
    // ボタンを ならべるので label で つつまない（文字を おすと 1つめの ボタンが 押されてしまう）
    <div className="flex flex-col gap-1.5">
      <span className="font-extrabold">
        <RubyText text={t("settings.school")} />
      </span>
      <span className="text-cocoa text-sm font-bold">
        <RubyText text={t("settings.schoolHelp")} />
      </span>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.school")}>
          {UNIVERSITIES.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={profile.university === u}
              className={`btn min-h-11 px-5 ${profile.university === u ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setProfile({ university: u })}
              data-testid={`settings-school-${u}`}
            >
              {u}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.cohort")}>
          {COHORTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={profile.cohort === c}
              className={`btn min-h-11 px-4 ${profile.cohort === c ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setProfile({ cohort: c })}
              data-testid={`settings-cohort-${c}`}
            >
              <RubyText text={t("settings.cohortN", { n: c })} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginSection() {
  const [, navigate] = useLocation();
  const session = useAuth((s) => s.session);
  const email = useAuth((s) => s.email);
  const isAdmin = useAuth((s) => s.isAdmin);
  const problem = useAuth((s) => s.problem);
  return (
    <Section title={t("settings.loginTitle")}>
      {!isSupabaseConfigured ? (
        <p className="text-cocoa font-bold">
          <RubyText text={t("settings.loginDemo")} />
        </p>
      ) : problem && !session ? (
        <p className="font-extrabold text-[#b45a0c]" data-testid="login-down">
          <RubyText text={t("settings.loginDown")} />
        </p>
      ) : session ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 font-extrabold text-[#157a4e]">
            <IconCheck className="h-5 w-5" />
            <RubyText text={t("settings.loggedIn")} />
          </span>
          <span className="text-cocoa text-sm font-bold">{email}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            <RubyText text={t("settings.logout")} />
          </button>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/admin")}
              data-testid="settings-admin"
            >
              <RubyText text={t("settings.admin")} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() => void signInWithGoogle()}
        >
          <RubyText text={t("settings.login")} />
        </button>
      )}
    </Section>
  );
}

function GeminiSection() {
  const geminiKey = useSettings((s) => s.geminiKey);
  const geminiOk = useSettings((s) => s.geminiOk);
  const setSettings = useSettings((s) => s.setSettings);
  const [state, setState] = useState<"idle" | "checking" | UiKey>("idle");

  const check = async () => {
    setState("checking");
    const r = await checkGeminiKey(geminiKey);
    setSettings({ geminiOk: r.ok });
    if (r.ok) setState("settings.geminiOk");
    else
      setState(
        r.reason === "network"
          ? "settings.geminiNetwork"
          : r.reason === "rateLimited"
            ? "settings.geminiRate"
            : "settings.geminiRejected",
      );
  };

  return (
    <Section title={t("settings.gemini")}>
      <Field label={t("settings.gemini")} badge="optional" help={t("settings.geminiHelp")}>
        <input
          className="input font-mono"
          type="password"
          value={geminiKey}
          placeholder={t("settings.geminiPlaceholder")}
          onChange={(e) => setSettings({ geminiKey: e.target.value.trim(), geminiOk: false })}
          autoComplete="off"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!geminiKey || state === "checking"}
          onClick={() => void check()}
        >
          <RubyText
            text={t(state === "checking" ? "settings.geminiChecking" : "settings.geminiCheck")}
          />
        </button>
        {(geminiOk || (state !== "idle" && state !== "checking")) && (
          <span className={`font-extrabold ${geminiOk ? "text-[#157a4e]" : "text-[#c43a4b]"}`}>
            <RubyText text={t(geminiOk ? "settings.geminiOk" : (state as UiKey))} />
          </span>
        )}
        <a
          className="text-sm font-extrabold text-[#157a4e] underline"
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
        >
          <RubyText text={t("settings.geminiHowto")} />
        </a>
      </div>
      <p className="text-cocoa text-xs font-bold">
        <RubyText text={t("settings.geminiNote")} />
      </p>
    </Section>
  );
}

function ViewSection() {
  const s = useSettings();
  return (
    <Section title={t("settings.view")}>
      <Toggle
        label={t("settings.furigana")}
        options={[
          [true, t("settings.on")],
          [false, t("settings.off")],
        ]}
        value={s.furigana}
        onChange={(v) => s.setSettings({ furigana: v })}
      />
      <Toggle
        label={t("settings.quality")}
        options={[
          ["normal", t("settings.qualityNormal")],
          ["low", t("settings.qualityLow")],
        ]}
        value={s.quality}
        onChange={(v) => s.setSettings({ quality: v })}
      />
      <Toggle
        label={t("settings.textSize")}
        options={[
          [1, "A"],
          [1.15, "A+"],
          [1.3, "A++"],
        ]}
        value={s.textScale}
        onChange={(v) => s.setSettings({ textScale: v })}
      />
      <Toggle
        label={t("settings.sound")}
        options={[
          [true, t("settings.on")],
          [false, t("settings.off")],
        ]}
        value={s.sound}
        onChange={(v) => s.setSettings({ sound: v })}
      />
    </Section>
  );
}

function Toggle<V extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [V, string][];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-extrabold">
        <RubyText text={label} />
      </span>
      <div className="cream-box flex gap-1.5 rounded-2xl p-1">
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            className={`rounded-xl px-3.5 py-1.5 font-extrabold text-white transition ${
              v === value ? "bg-[#1f9b6c] shadow-sm" : "bg-[#6e5648] hover:bg-[#7d6253]"
            }`}
            onClick={() => onChange(v)}
          >
            <RubyText text={l} />
          </button>
        ))}
      </div>
    </div>
  );
}
