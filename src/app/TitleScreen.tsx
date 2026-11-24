import { useLocation } from "wouter";
import { useSetupComplete } from "@/app/use-setup";
import { useSettings } from "@/lib/store";
import { t } from "@/lib/t";
import { KANJI } from "@/lib/text/furigana";
import { RubyText } from "@/ui/RubyText";
import { IconBookOpen, IconGearSolid, IconPlay } from "@/ui/icons";

/**
 * タイトル。tomy さんの新しいタイトル画像（1672×941）を背景にし、添付されたどう森ふうボタンのイメージに合わせて
 * 帯（ふりがな付き）と 3つのボタンを同じ大きさで重ねる（tomy さん 2026-11-24）。
 *
 * 画像の 16:9 の箱を画面いっぱいに置き、位置は箱に対する %（縦）と cqw（箱の横幅の 1%）で書く。
 * 新しいタイトル画像（1672×941）の帯の位置: x=559〜1061（中心 x=810）・y=376〜430（中心 y=403）。
 * ボタンの大きさは前と同じ（スタート 350×66、ストーリー・設定 313×52）で、帯の中心 x=810 にそろえる。
 * 最初は「設定」だけ押せる（企画メモ）。
 */
const px = (n: number) => `${(n / 1672) * 100}cqw`;
const py = (n: number) => `${(n / 941) * 100}%`;

export function TitleScreen() {
  const [, navigate] = useLocation();
  const ready = useSetupComplete();
  const furigana = useSettings((s) => s.furigana);

  return (
    <main className="bg-deep relative h-full w-full overflow-hidden">
      <div
        className="[container-type:inline-size] absolute top-1/2 left-1/2 aspect-[16/9] -translate-x-1/2 -translate-y-1/2"
        style={{ width: "max(100vw, calc(100vh * 16 / 9))", fontFamily: "var(--font-sans)" }}
      >
        <img
          src={`${import.meta.env.BASE_URL}img/title/title.webp`}
          alt="NEXMAX IT QUEST"
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />

        {/* 帯（画像の中の帯 x=559〜1098 と同じ位置に重ねて、漢字に白いふりがなを付ける。左右の葉っぱは画像のまま見える） */}
        <p
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-extrabold whitespace-nowrap text-white"
          style={{
            left: px(828.5),
            top: py(403),
            width: px(544),
            height: px(58),
            fontSize: px(25),
            lineHeight: 1.2,
            paddingTop: furigana ? px(6) : 0,
            background: "linear-gradient(180deg, #27a3e8 0%, #1688d6 100%)",
            border: `${px(2.4)} solid rgba(255, 255, 255, 0.94)`,
            boxShadow:
              "0 0.25cqw 0.8cqw rgba(16, 108, 186, 0.3), inset 0 0.12cqw 0.25cqw rgba(255, 255, 255, 0.45)",
          }}
          data-testid="title-sub"
        >
          <RubyText text={t("title.sub")} />
        </p>

        {/* スタート（ダイブする）— どう森ふうの クリーム＋みどり文字ピル（大きさは前と同じ 350×66） */}
        <button
          type="button"
          className="title-btn title-btn-start absolute flex items-center justify-center font-extrabold text-[#2d7a4c]"
          style={{ left: px(635), top: py(492), width: px(350), height: px(66), gap: px(8) }}
          disabled={!ready}
          onClick={() => navigate("/dive")}
          data-testid="title-start"
        >
          <IconPlay
            className="shrink-0 text-[#338a55]"
            style={{
              width: px(30),
              height: px(30),
              marginRight: px(4),
            }}
          />
          <span style={{ fontSize: px(27), letterSpacing: "0.02em" }}>
            <RubyText text={t("title.start")} />
          </span>
          <span style={{ fontSize: px(16), marginLeft: px(-6) }}>
            <RubyText text={t("title.startNote")} />
          </span>
          {/* 右上の きらっ（イメージの 3本線アクセント） */}
          <svg
            viewBox="0 0 36 32"
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              right: px(-24),
              top: px(-22),
              width: px(36),
              height: px(32),
              filter: "drop-shadow(0 1px 2px rgba(40, 120, 180, 0.35))",
            }}
          >
            <path
              d="M7 22 L12 7 M16 25 L26 14 M22 29 L33 25"
              stroke="#ffec82"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* ストーリー（大きさは前と同じ 313×52） */}
        <TitleButton
          top={582}
          icon={<IconBookOpen style={{ width: px(32), height: px(32) }} />}
          label={t("title.story")}
          disabled={!ready}
          onClick={() => navigate("/story")}
        />

        {/* 設定（大きさは前と同じ 313×52＋右下に小さな葉っぱ） */}
        <TitleButton
          top={652}
          icon={<IconGearSolid style={{ width: px(32), height: px(32) }} />}
          label={t("title.settings")}
          onClick={() => navigate("/settings")}
          highlight={!ready}
          leafAccent
          testId="title-settings"
        />

        {!ready && (
          <p
            className="absolute -translate-x-1/2 rounded-full font-extrabold whitespace-nowrap text-white"
            style={{
              left: px(810),
              top: py(724),
              fontSize: px(20),
              padding: `${px(6)} ${px(20)}`,
              background: "rgba(74, 53, 40, 0.9)",
              border: `${px(2)} solid rgba(255, 248, 228, 0.9)`,
              boxShadow: "0 0.25cqw 0.8cqw rgba(60, 40, 28, 0.28)",
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
  leafAccent,
  testId,
}: {
  top: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  leafAccent?: boolean;
  testId?: string;
}) {
  // ふりがなが付く文字は、ふりがなの分だけ上へずらして、漢字をボタンの真ん中に置く
  const furigana = useSettings((s) => s.furigana);
  const lift = furigana && [...label].some((c) => KANJI.test(c)) ? "0.28em" : "0em";
  return (
    <button
      type="button"
      className={`title-btn title-btn-sub absolute font-extrabold text-[#5a4234] ${highlight ? "title-btn-highlight" : ""}`}
      style={{ left: px(653.5), top: py(top), width: px(313), height: px(52) }}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      <span
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#6b4e3c]"
        style={{ left: px(74) }}
      >
        {icon}
      </span>
      <span
        className="absolute top-1/2 whitespace-nowrap"
        style={{
          left: px(182),
          fontSize: px(22),
          letterSpacing: "0.06em",
          transform: `translate(-50%, calc(-50% - ${lift}))`,
          lineHeight: 1.2,
        }}
      >
        <RubyText text={label} />
      </span>
      {leafAccent && (
        <svg
          viewBox="0 0 36 28"
          aria-hidden
          className="pointer-events-none absolute"
          style={{ right: px(12), bottom: px(4), width: px(32), height: px(24) }}
        >
          <path
            d="M15 24 C10 18 4 14 2 10 C8 9 14 11 17 17 Z"
            fill="#88cf59"
            stroke="#5a9e38"
            strokeWidth="1.2"
          />
          <path
            d="M17 23 C18 14 24 6 33 4 C32 13 27 20 18 24 Z"
            fill="#6fc048"
            stroke="#4c8c30"
            strokeWidth="1.2"
          />
        </svg>
      )}
    </button>
  );
}
