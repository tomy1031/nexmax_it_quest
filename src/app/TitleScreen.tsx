import { useLocation } from "wouter";
import { useSetupComplete } from "@/app/use-setup";
import { useSettings } from "@/lib/store";
import { t } from "@/lib/t";
import { KANJI } from "@/lib/text/furigana";
import { RubyText } from "@/ui/RubyText";
import { IconBookOpen, IconGearSolid, IconPlay } from "@/ui/icons";

/**
 * タイトル。tomy さんのタイトル画像を背景にし、ボタンのイメージ（docs/企画メモ/2026-11-21_ボタンのイメージ.png）の
 * 文字とボタンを、その画像と同じ位置・大きさ・色で重ねる。
 *
 * 画像の 16:9 の箱を画面いっぱいに置き、位置は箱に対する %（縦）と cqw（箱の横幅の 1%）で書く。
 * 数字はボタンのイメージ（1672×941）を測った値:
 *   タグライン 中心 y=80 ／ 帯 x=563〜1107・中心 y=415・高さ 52
 *   スタート x=678〜1028・y=522〜588 ／ ストーリー・設定 x=697〜1010・y=618〜670・692〜744（アイコン x=768・文字の中心 x≈888）
 * 字体はボタンのイメージと同じ角ゴシック（Noto Sans JP の太字）。ふりがなは必ず付ける（AGENTS.md 必ず守るルール2）。
 * 最初は「設定」だけ押せる（企画メモ）。
 */
const px = (n: number) => `${(n / 1672) * 100}cqw`;
const py = (n: number) => `${(n / 941) * 100}%`;

export function TitleScreen() {
  const [, navigate] = useLocation();
  const ready = useSetupComplete();

  return (
    <main className="bg-deep relative h-full w-full overflow-hidden">
      <div
        className="[container-type:inline-size] absolute top-1/2 left-1/2 aspect-[16/9] -translate-x-1/2 -translate-y-1/2"
        style={{ width: "max(100vw, calc(100vh * 16 / 9))", fontFamily: "var(--font-title)" }}
      >
        <img
          src={`${import.meta.env.BASE_URL}img/title/title.webp`}
          alt="NEXMAX IT QUEST"
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />

        {/* タグライン（左右に細い線） */}
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap text-white"
          style={{ left: "50%", top: py(80), gap: px(30) }}
          data-testid="title-tagline"
        >
          <span className="block bg-white/75" style={{ width: px(110), height: 1 }} />
          <span
            className="font-bold"
            style={{
              fontSize: px(22),
              letterSpacing: "0.36em",
              marginRight: "-0.36em",
              textShadow: "0 0 10px rgba(56,225,255,0.55)",
            }}
          >
            <RubyText text={t("title.tagline")} />
          </span>
          <span className="block bg-white/75" style={{ width: px(110), height: 1 }} />
        </div>

        {/* 帯 */}
        <p
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold whitespace-nowrap text-white"
          style={{
            left: "50%",
            top: py(415),
            width: px(544),
            height: px(52),
            fontSize: px(27),
            background: "linear-gradient(180deg, rgba(10,44,118,0.78), rgba(8,36,100,0.82))",
            border: "1.5px solid rgba(120,200,255,0.8)",
            boxShadow: "0 0 14px rgba(56,170,255,0.35), inset 0 0 10px rgba(56,170,255,0.25)",
          }}
          data-testid="title-sub"
        >
          <RubyText text={t("title.sub")} />
        </p>

        {/* スタート（ダイブする） */}
        <button
          type="button"
          className="title-btn title-btn-start absolute flex items-center justify-center font-bold text-white"
          style={{ left: px(678), top: py(522), width: px(350), height: px(66), gap: px(10) }}
          disabled={!ready}
          onClick={() => navigate("/dive")}
          data-testid="title-start"
        >
          <IconPlay
            className="shrink-0 text-[#c4f4ff]"
            style={{
              width: px(36),
              height: px(36),
              marginRight: px(6),
              filter: "drop-shadow(0 0 4px rgba(150,240,255,0.8))",
            }}
          />
          <span style={{ fontSize: px(27), letterSpacing: "0.02em" }}>
            <RubyText text={t("title.start")} />
          </span>
          <span style={{ fontSize: px(16), marginLeft: px(-10) }}>
            <RubyText text={t("title.startNote")} />
          </span>
        </button>

        {/* ストーリー */}
        <TitleButton
          top={618}
          icon={<IconBookOpen style={{ width: px(40), height: px(40) }} />}
          label={t("title.story")}
          disabled={!ready}
          onClick={() => navigate("/story")}
        />

        {/* 設定 */}
        <TitleButton
          top={692}
          icon={<IconGearSolid style={{ width: px(44), height: px(44) }} />}
          label={t("title.settings")}
          onClick={() => navigate("/settings")}
          highlight={!ready}
          testId="title-settings"
        />

        {!ready && (
          <p
            className="absolute -translate-x-1/2 rounded-full font-bold whitespace-nowrap text-white"
            style={{
              left: "50%",
              top: py(762),
              fontSize: px(17),
              padding: `${px(4)} ${px(16)}`,
              background: "rgba(8,36,100,0.7)",
            }}
            data-testid="title-locked"
          >
            <RubyText text={t("title.locked")} />
          </p>
        )}
      </div>
    </main>
  );
}

function TitleButton({
  top,
  icon,
  label,
  onClick,
  disabled,
  highlight,
  testId,
}: {
  top: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  testId?: string;
}) {
  // ふりがなが付く文字は、ふりがなの分だけ上へずらして、漢字をボタンの真ん中に置く
  const furigana = useSettings((s) => s.furigana);
  const lift = furigana && [...label].some((c) => KANJI.test(c)) ? "0.32em" : "0em";
  return (
    <button
      type="button"
      className={`title-btn title-btn-sub absolute font-bold text-white ${highlight ? "title-btn-highlight" : ""}`}
      style={{ left: px(697), top: py(top), width: px(313), height: px(52) }}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: px(71) }}>
        {icon}
      </span>
      <span
        className="absolute top-1/2 whitespace-nowrap"
        style={{
          left: px(191),
          fontSize: px(22),
          letterSpacing: "0.08em",
          transform: `translate(-50%, calc(-50% - ${lift}))`,
          lineHeight: 1.2,
        }}
      >
        <RubyText text={label} />
      </span>
    </button>
  );
}
