import { useState } from "react";
import stage1 from "@content/stages/stage1.json";
import { playSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { drawRuby, ensureFont, makeCanvas, roundRect } from "@/factory/text-canvas";
import { RubyText } from "@/ui/RubyText";
import { usePhotoUrl } from "@/ui/use-photo";

const BASE = import.meta.env.BASE_URL;

function dateText(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 修了証（企画メモ「修了証を表示する」）。名前・顔写真・きょうの ことば。
 * 「画像で保存」は端末の中で絵を作って保存する（サーバーに送らない）。
 */
export function Certificate({ stageId, onClose }: { stageId: string; onClose: () => void }) {
  const profile = useGame((s) => s.profile);
  const progress = useGame((s) => s.stages[stageId]);
  const photo = usePhotoUrl();
  const [saving, setSaving] = useState(false);
  const date = dateText(progress?.clearedAt);

  const save = async () => {
    setSaving(true);
    try {
      const url = await renderCertificate({
        name: profile.name,
        nickname: profile.nickname,
        photo,
        date,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexmax-it-quest-${stageId}.png`;
      a.click();
      playSfx("ok");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="pop text-ink w-full max-w-3xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#fffdf6,#eef7ff)] shadow-2xl ring-8 ring-[#c9a227]/60"
      data-testid="certificate"
    >
      <div className="relative flex flex-col items-center gap-4 p-6 sm:p-8">
        <img
          src={`${BASE}img/title/title-small.webp`}
          alt=""
          className="absolute inset-x-0 top-0 h-24 w-full object-cover opacity-25"
        />
        <p className="relative text-sm font-extrabold tracking-[0.4em] text-[#9a7a12]">
          NEXMAX IT QUEST
        </p>
        <h2 className="relative text-5xl font-black tracking-widest text-[#16264d]">
          <RubyText text={t("cert.title")} />
        </h2>
        <div className="flex w-full flex-col items-center gap-5 sm:flex-row">
          <div className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-[#c9a227] bg-sky-100">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <img src={`${BASE}img/nexmax/hello.webp`} alt="" className="h-28 w-28" />
            )}
          </div>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <p className="text-lg font-bold text-[#16264d]/70">
              <RubyText text={t("cert.company")} />
            </p>
            <p className="text-3xl font-black">{profile.name}</p>
            <p className="text-lg font-extrabold text-[#0a6bd6]">
              <RubyText text={t("cert.stage")} />
            </p>
            <p className="text-lg leading-[2.2] font-bold">
              <RubyText text={t("cert.body")} />
            </p>
          </div>
        </div>
        <div className="w-full rounded-2xl bg-white/80 p-4">
          <p className="mb-2 font-extrabold text-[#9a7a12]">
            <RubyText text={t("cert.words")} />
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stage1.words.map((w) => (
              <div key={w.word} className="rounded-xl bg-sky-50 px-3 py-2">
                <p className="text-lg font-extrabold">
                  <RubyText text={w.word} />
                </p>
                <p className="text-ink/60 text-sm">{w.en}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-ink/70 font-bold">
            <RubyText text={t("cert.date")} /> {date}
          </p>
          <img src={`${BASE}img/nexmax/cheer.webp`} alt="" className="bob h-20 w-20" />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost !text-ink"
              onClick={() => void save()}
              disabled={saving}
            >
              <RubyText text={t("cert.save")} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              data-testid="cert-close"
            >
              <RubyText text={t("cert.back")} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 修了証の絵（1600×1000）。ふりがなは画面と同じ読み方のデータで描く。 */
async function renderCertificate(o: {
  name: string;
  nickname: string;
  photo: string | null;
  date: string;
}): Promise<string> {
  const W = 1600;
  const H = 1000;
  const [canvas, ctx] = makeCanvas(W, H);
  const texts = [
    t("cert.title"),
    t("cert.company"),
    t("cert.stage"),
    t("cert.body"),
    t("cert.words"),
    ...stage1.words.map((w) => w.word),
  ];
  await ensureFont(texts.join(""));
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fffdf6");
  g.addColorStop(1, "#eef7ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 24;
  ctx.strokeStyle = "#d9b64a";
  roundRect(ctx, 20, 20, W - 40, H - 40, 40);
  ctx.stroke();
  const title = await loadImage(`${BASE}img/title/title-small.webp`);
  if (title) {
    ctx.globalAlpha = 0.25;
    ctx.drawImage(title, 32, 32, W - 64, 200);
    ctx.globalAlpha = 1;
  }
  const ink = "#16264d";
  const ruby = "#0a6bd6";
  ctx.font = "800 28px sans-serif";
  ctx.fillStyle = "#9a7a12";
  ctx.textAlign = "center";
  ctx.fillText("NEXMAX IT QUEST", W / 2, 110);
  ctx.textAlign = "left";
  drawRuby(ctx, t("cert.title"), W / 2, 220, {
    size: 96,
    color: ink,
    rubyColor: ruby,
    align: "center",
  });
  const photo = o.photo
    ? await loadImage(o.photo)
    : await loadImage(`${BASE}img/nexmax/hello.webp`);
  if (photo) {
    ctx.save();
    roundRect(ctx, 120, 300, 260, 260, 36);
    ctx.clip();
    ctx.drawImage(photo, 120, 300, 260, 260);
    ctx.restore();
  }
  drawRuby(ctx, t("cert.company"), 440, 360, { size: 34, color: "#4a5a7a", rubyColor: ruby });
  ctx.font = "900 72px sans-serif";
  ctx.fillStyle = ink;
  ctx.fillText(o.name, 440, 450);
  drawRuby(ctx, t("cert.stage"), 440, 530, { size: 40, color: "#0a6bd6", rubyColor: ruby });
  drawRuby(ctx, t("cert.body"), 120, 650, { size: 38, color: ink, rubyColor: ruby });
  drawRuby(ctx, t("cert.words"), 120, 750, { size: 32, color: "#9a7a12", rubyColor: ruby });
  stage1.words.forEach((w, i) => {
    const x = 120 + (i % 3) * 440;
    const y = 830 + Math.floor(i / 3) * 90;
    drawRuby(ctx, `${w.word}（${w.en}）`, x, y, { size: 34, color: ink, rubyColor: ruby });
  });
  ctx.font = "700 30px sans-serif";
  ctx.fillStyle = "#4a5a7a";
  ctx.textAlign = "right";
  ctx.fillText(o.date, W - 90, H - 80);
  ctx.textAlign = "left";
  return canvas.toDataURL("image/png");
}
