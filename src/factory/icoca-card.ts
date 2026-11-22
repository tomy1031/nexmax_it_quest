import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { t } from "@/lib/t";
import { STATION } from "@/factory/signs";
import { drawRuby, FONT_FAMILY, roundRect } from "@/factory/text-canvas";

/**
 * ICOCA 定期券の券面（3D のカードと、メニューの持ち物で同じ絵を使う）。
 * 並びは、大阪メトロで出す ICOCA 定期券の券面の見本（JR 西日本・大阪メトロの 2020-11-09 の発表資料）に合わせた:
 *   左上に会社名・券の種類（通勤定期◯か月）／右上に金額／大きく区間／経由／「〜から」と大きく「〜まで」／発行日／名前。
 * 水色の地に大きく薄い「ICOCA」の字。会社のロゴとキャラクターの絵は描かない（字だけ）。
 * 水色は明るい地なので、字とふりがなは紺（濃い背景の白のルールは当てはまらない）。
 */

const PLACES = placesJson as PlacesFile;
const NAVY = "#10316b";

export interface PassInfo {
  /** 定期券が入っているか（入っていなければ、ふつうの ICOCA）。 */
  pass: boolean;
  /** カタカナの名前。 */
  name: string;
  /** 買った日（YYYY-MM-DD）。無ければ今日。 */
  start?: string;
  months?: number;
}

function ymd(d: Date): string {
  return t("pass.date", { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

/** 「〜から」の日と「〜まで」の日（◯か月後の前の日）。 */
export function passPeriod(start: string | undefined, months: number): { from: Date; until: Date } {
  const from = start ? new Date(`${start}T00:00:00`) : new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + months);
  until.setDate(until.getDate() - 1);
  return { from, until };
}

export function passPrice(months = 3): number {
  return PLACES.passFare.commute[String(months)] ?? 0;
}

/** 券面に出る字（字体の読みこみ待ちに使う）。 */
export function passFontText(info: PassInfo): string {
  return [
    t("pass.kind"),
    t("pass.via"),
    t("pass.from"),
    t("pass.until"),
    t("pass.sama"),
    STATION.tennoji?.name ?? "",
    STATION.awaza?.name ?? "",
    info.name,
    ymd(new Date()),
    t("tm.yen"),
    "0123456789ICOCA",
  ].join("");
}

export function drawIcocaCard(ctx: CanvasRenderingContext2D, w: number, h: number, info: PassInfo) {
  const months = info.months ?? 3;
  // 地（水色）と右はしの灰色の帯
  ctx.save();
  roundRect(ctx, 0, 0, w, h, h * 0.07);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#5fd3ea");
  g.addColorStop(1, "#2fb8d6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#cfd4d9";
  ctx.fillRect(w * 0.94, 0, w * 0.06, h);
  // 左上の小さな三角（カードの向きのしるし）
  ctx.fillStyle = "#1d6fb8";
  ctx.beginPath();
  ctx.moveTo(w * 0.035, h * 0.06);
  ctx.lineTo(w * 0.065, h * 0.035);
  ctx.lineTo(w * 0.065, h * 0.085);
  ctx.closePath();
  ctx.fill();
  // 大きく薄い ICOCA の字
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = `italic 900 ${h * 0.44}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText("ICOCA", w * 0.48, h * 0.72);
  ctx.textAlign = "left";
  ctx.restore();

  if (!info.pass) {
    ctx.fillStyle = NAVY;
    ctx.font = `900 ${h * 0.1}px sans-serif`;
    ctx.fillText("ICOCA", w * 0.07, h * 0.2);
    return;
  }

  const ruby = { color: NAVY, rubyColor: NAVY };
  // 会社名・券の種類・金額
  ctx.fillStyle = NAVY;
  ctx.font = `800 ${h * 0.085}px sans-serif`;
  ctx.fillText("Osaka Metro", w * 0.06, h * 0.16);
  drawRuby(ctx, t("pass.kind"), w * 0.06, h * 0.29, { size: h * 0.065, ...ruby });
  drawRuby(ctx, `${passPrice(months)} ${t("tm.yen")}`, w * 0.9, h * 0.29, {
    size: h * 0.075,
    align: "right",
    ...ruby,
  });
  // 区間（大きく）
  const from = STATION.tennoji?.name ?? "";
  const to = STATION.awaza?.name ?? "";
  drawRuby(ctx, from, w * 0.06, h * 0.49, { size: h * 0.13, ...ruby });
  ctx.fillStyle = NAVY;
  ctx.fillRect(w * 0.4, h * 0.435, w * 0.1, h * 0.012);
  drawRuby(ctx, to, w * 0.55, h * 0.49, { size: h * 0.13, ...ruby });
  // 経由
  drawRuby(ctx, t("pass.via"), w * 0.06, h * 0.6, { size: h * 0.05, ...ruby });
  // 通用期間: 「〜から」と大きく「〜まで」
  const { from: d0, until: d1 } = passPeriod(info.start, months);
  drawRuby(ctx, `${ymd(d0)}${t("pass.from")}`, w * 0.06, h * 0.73, { size: h * 0.045, ...ruby });
  drawRuby(ctx, `${ymd(d1)}${t("pass.until")}`, w * 0.36, h * 0.75, { size: h * 0.085, ...ruby });
  // 発行日・名前・しるし
  drawRuby(ctx, ymd(d0), w * 0.06, h * 0.86, { size: h * 0.045, ...ruby });
  drawRuby(ctx, `${info.name || "-"} ${t("pass.sama")}`, w * 0.36, h * 0.93, {
    size: h * 0.055,
    ...ruby,
  });
  ctx.fillStyle = NAVY;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(w * (0.78 + i * 0.035), h * 0.915, h * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
}
