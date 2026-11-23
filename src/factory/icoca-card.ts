import placesJson from "@content/places.json";
import type { PlacesFile } from "@/content/schema";
import { gameDate } from "@/lib/season";
import { t } from "@/lib/t";
import { STATION } from "@/factory/signs";
import { drawRuby, FONT_FAMILY, roundRect } from "@/factory/text-canvas";

/**
 * ICOCA 定期券の券面（3D のカードと、メニューの持ち物で同じ絵を使う）。
 * 並びは、大阪メトロで出す ICOCA 定期券の券面の見本（JR 西日本・大阪メトロの 2020-11-09 の発表資料）に合わせた:
 *   左上に会社名・券の種類（通勤定期◯か月）／右上に金額／大きく区間／経由／「〜から」と大きく「〜まで」／発行日／名前。
 * 水色の地に大きく薄い「ICOCA」の字。会社のロゴとキャラクターの絵は描かない（字だけ）。
 * 水色は明るい地なので、字とふりがなは紺（濃い背景の白のルールは当てはまらない）。
 * 水色は 左上と 右下の角が ななめに切れ、そこは白っぽい地になる（見本の券面）。
 */

const PLACES = placesJson as PlacesFile;
const NAVY = "#10316b";

export interface PassInfo {
  /** 定期券が入っているか（入っていなければ、ふつうの ICOCA）。 */
  pass: boolean;
  /** カタカナの名前。 */
  name: string;
  /** 買った日（YYYY-MM-DD）。無ければ ゲームの中の日（4月1日）。 */
  start?: string;
  months?: number;
}

function ymd(d: Date): string {
  return t("pass.date", { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

/** 「〜から」の日と「〜まで」の日（◯か月後の前の日）。 */
export function passPeriod(start: string | undefined, months: number): { from: Date; until: Date } {
  const from = start ? new Date(`${start}T00:00:00`) : gameDate();
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
    t("pass.cardKind", { n: 3 }),
    t("pass.issuer"),
    t("pass.via"),
    t("pass.from"),
    t("pass.until"),
    t("pass.sama"),
    STATION.tennoji?.name ?? "",
    STATION.awaza?.name ?? "",
    info.name,
    ymd(gameDate()),
    t("tm.yen"),
    "0123456789ICOCA",
  ].join("");
}

/** 券面の日付（2026.11.22。1けたの月・日は「-2」のように前に「-」を付ける。本物の券面の書き方）。 */
function dot(d: Date): string {
  const pad = (n: number) => (n < 10 ? `-${n}` : String(n));
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * 券面。tomy さんの見本（JR 西日本の ICOCA 定期券の券面。2026-11-22）の並びに合わせる:
 *   左上に下線つきの券の種類（通勤3箇月）・右上に番号／大きく区間（天王寺 ↔ 阿波座）／経由／
 *   とても大きく有効期限（2027.-2.21 まで）／左下に金額と発行日／下のまん中に発行した会社・駅と名前。
 *   地は水色、外わくだけの大きな「ICOCA」の字。キャラクターの絵は描かない。
 */
export function drawIcocaCard(ctx: CanvasRenderingContext2D, w: number, h: number, info: PassInfo) {
  const months = info.months ?? 3;
  // 地（白っぽい灰色と水色）・うすい灰色のふち
  ctx.save();
  roundRect(ctx, 0, 0, w, h, h * 0.06);
  ctx.clip();
  // 地は白っぽい灰色。水色は 左上の角と 右下の角が ななめに切れている
  // （tomy さんの見本の券面を はかった: 左上は 上のはし 26% → 左のはし 46%、右下は 右のはし 70% → 下のはし 82%）
  ctx.fillStyle = "#eceef0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#5cc7e3";
  ctx.beginPath();
  ctx.moveTo(w * 0.257, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.7);
  ctx.lineTo(w * 0.82, h);
  ctx.lineTo(0, h);
  ctx.lineTo(0, h * 0.457);
  ctx.closePath();
  ctx.fill();
  // 左上の小さな三角（カードの向きのしるし。白い角の中に水色で）
  ctx.fillStyle = "#5cc7e3";
  ctx.beginPath();
  ctx.moveTo(w * 0.018, h * 0.05);
  ctx.lineTo(w * 0.045, h * 0.025);
  ctx.lineTo(w * 0.045, h * 0.075);
  ctx.closePath();
  ctx.fill();
  // 外わくだけの大きな ICOCA の字
  ctx.font = `800 ${h * 0.32}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  // 見本の「ICOCA」は うすい白で ぬった字に、白い ふち（字の上に ほかの字が かさなる）
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillText("ICOCA", w * 0.515, h * 0.585);
  ctx.lineWidth = h * 0.012;
  ctx.strokeStyle = "rgba(240,250,255,0.9)";
  ctx.strokeText("ICOCA", w * 0.515, h * 0.585);
  ctx.textAlign = "left";
  ctx.restore();
  ctx.lineWidth = h * 0.006;
  ctx.strokeStyle = "#c3ccd2";
  roundRect(ctx, h * 0.003, h * 0.003, w - h * 0.006, h - h * 0.006, h * 0.06);
  ctx.stroke();

  if (!info.pass) return;

  const ink = { color: NAVY, rubyColor: NAVY, weight: 500 };
  // 左上: 券の種類（下線つき）・右上: 番号
  const kind = t("pass.cardKind", { n: months });
  const kw = drawRuby(ctx, kind, w * 0.035, h * 0.15, { size: h * 0.058, ...ink });
  ctx.fillStyle = NAVY;
  ctx.fillRect(w * 0.035, h * 0.165, kw, h * 0.006);
  ctx.font = `500 ${h * 0.065}px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.fillText("00000", w * 0.95, h * 0.1);
  ctx.textAlign = "left";
  // 区間（大きく。左に 乗る駅・まん中に ↔・右に 降りる駅。見本の並び）
  const from = STATION.tennoji?.name ?? "";
  const to = STATION.awaza?.name ?? "";
  const big = { size: h * 0.15, ...ink };
  drawRuby(ctx, from, w * 0.03, h * 0.36, big);
  drawRuby(ctx, "\u2194", w * 0.5, h * 0.36, { ...big, align: "center" });
  drawRuby(ctx, to, w * 0.95, h * 0.36, { ...big, align: "right" });
  // 経由
  drawRuby(ctx, t("pass.via"), w * 0.03, h * 0.47, { size: h * 0.05, ...ink });
  // 有効期限（とても大きく）と「まで」
  const { from: d0, until: d1 } = passPeriod(info.start, months);
  const [yy, ...md] = dot(d1).split(".");
  ctx.fillStyle = NAVY;
  ctx.font = `400 ${h * 0.16}px ${FONT_FAMILY}`;
  ctx.fillText(`${yy}.`, w * 0.03, h * 0.69);
  const yw = ctx.measureText(`${yy}.`).width;
  ctx.font = `400 ${h * 0.32}px ${FONT_FAMILY}`;
  ctx.fillText(md.join("."), w * 0.03 + yw, h * 0.69);
  drawRuby(ctx, t("pass.until"), w * 0.8, h * 0.7, { size: h * 0.05, ...ink });
  // 左下: 金額・発行日
  ctx.font = `500 ${h * 0.068}px ${FONT_FAMILY}`;
  ctx.fillText(`\u00a5${passPrice(months).toLocaleString()}`, w * 0.03, h * 0.84);
  ctx.font = `500 ${h * 0.058}px ${FONT_FAMILY}`;
  ctx.fillText(dot(d0), w * 0.05, h * 0.94);
  // 下のまん中: 発行した会社・駅と、名前
  drawRuby(
    ctx,
    `${t("pass.issuer")}  ${STATION.tennoji?.name ?? ""}${t("sign.station")}#1`,
    w * 0.38,
    h * 0.84,
    { size: h * 0.052, ...ink },
  );
  drawRuby(ctx, `${info.name || "-"}${t("pass.sama")}  *00`, w * 0.43, h * 0.94, {
    size: h * 0.054,
    ...ink,
  });
}
