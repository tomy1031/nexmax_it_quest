import metroJson from "@content/metro.json";
import type { MetroFile } from "@/content/schema";
import { AR_RUBY, drawArrow, drawLineBadge, drawRuby, roundRect } from "@/factory/text-canvas";

/**
 * 看板の描き方（データ → Canvas）。駅の看板は本物と同じく日本語と英語を並べる。
 * 線は色だけでなく、必ずアルファベット（M・C）でも見分けられるようにする。
 */

export const METRO = metroJson as MetroFile;
export const LINE = Object.fromEntries(METRO.lines.map((l) => [l.id, l])) as Record<
  string,
  MetroFile["lines"][number]
>;
export const STATION = Object.fromEntries(METRO.stations.map((s) => [s.id, s])) as Record<
  string,
  MetroFile["stations"][number]
>;

export interface LineSignSpec {
  lines: string[];
  text: string;
  en: string;
  arrow?: "left" | "right" | "up" | "down";
  /** 黄色の地（出口）・紺の地（のりかえ）。 */
  tone?: "navy" | "yellow" | "white";
}

/** 天井から下がる案内の看板（線のマーク＋日本語＋英語＋矢印）。 */
export function drawLineSign(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: LineSignSpec,
): void {
  const bg = s.tone === "yellow" ? "#ffd23f" : s.tone === "white" ? "#f6f8fb" : "#16264d";
  const fg = s.tone === "yellow" || s.tone === "white" ? "#1a1a1a" : "#ffffff";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = H * 0.03;
  ctx.strokeRect(0, 0, W, H);
  const r = H * 0.28;
  let x = H * 0.45;
  if (s.arrow === "left") {
    drawArrow(ctx, x, H / 2, H * 0.6, "left", fg);
    x += H * 0.6;
  }
  for (const id of s.lines) {
    const line = LINE[id];
    if (line) drawLineBadge(ctx, x + r, H / 2, r, line.letter, line.color);
    x += r * 2.3;
  }
  drawRuby(ctx, s.text, x + H * 0.1, H * 0.66, {
    size: H * 0.34,
    color: fg,
    rubyColor: s.tone === "navy" || !s.tone ? AR_RUBY : "#0a6bd6",
  });
  ctx.font = `700 ${H * 0.16}px sans-serif`;
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.85;
  ctx.fillText(s.en, x + H * 0.1, H * 0.9);
  ctx.globalAlpha = 1;
  if (s.arrow && s.arrow !== "left") drawArrow(ctx, W - H * 0.5, H / 2, H * 0.6, s.arrow, fg);
}

/** 駅の名前の看板（駅名標）。 */
export function drawStationName(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  stationId: string,
  lineId: string,
  prev?: string,
  next?: string,
): void {
  const st = STATION[stationId];
  const line = LINE[lineId];
  if (!st || !line) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = line.color;
  ctx.fillRect(0, H * 0.72, W, H * 0.1);
  const number = st.numbers.find((n) => n.startsWith(line.letter)) ?? "";
  drawLineBadge(ctx, H * 0.36, H * 0.38, H * 0.22, line.letter, line.color);
  ctx.fillStyle = line.color;
  ctx.font = `900 ${H * 0.13}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(number.slice(1), H * 0.36, H * 0.68);
  ctx.textAlign = "left";
  drawRuby(ctx, st.name, W / 2, H * 0.48, {
    size: H * 0.3,
    color: "#111",
    rubyColor: "#0a6bd6",
    align: "center",
  });
  ctx.font = `700 ${H * 0.12}px sans-serif`;
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.fillText(st.en, W / 2, H * 0.66);
  ctx.textAlign = "left";
  const small = { size: H * 0.1, color: "#fff", rubyColor: "#e8fbff" };
  if (prev && STATION[prev]) drawRuby(ctx, `← ${STATION[prev]!.name}`, W * 0.03, H * 0.95, small);
  if (next && STATION[next])
    drawRuby(ctx, `${STATION[next]!.name} →`, W * 0.97, H * 0.95, { ...small, align: "right" });
}

export interface LedRow {
  kind: string;
  time: string;
  dest: string;
  track: string;
}

/** 電光掲示板（黒い地にオレンジの文字）。ふりがなはシアン（ネクマックスの AR 表示）。 */
export function drawLed(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  title: string,
  rows: LedRow[],
  labels: { first: string; second: string; bound: string; track: string },
): void {
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, W, H);
  // 点の すきま（LED らしさ）
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(0, 0, W, H * 0.22);
  drawRuby(ctx, title, W * 0.03, H * 0.18, {
    size: H * 0.12,
    color: "#ffffff",
    rubyColor: AR_RUBY,
  });
  const rowH = (H * 0.78) / rows.length;
  rows.forEach((r, i) => {
    const y = H * 0.22 + rowH * (i + 0.78);
    const size = rowH * 0.42;
    const tag = i === 0 ? labels.first : labels.second;
    drawRuby(ctx, tag, W * 0.03, y, { size: size * 0.8, color: "#9ef08a", rubyColor: AR_RUBY });
    drawRuby(ctx, r.kind, W * 0.17, y, { size, color: "#ff9d2e", rubyColor: AR_RUBY });
    ctx.font = `800 ${size}px monospace`;
    ctx.fillStyle = "#ff9d2e";
    ctx.fillText(r.time, W * 0.33, y);
    drawRuby(ctx, `${r.dest} ${labels.bound}`, W * 0.52, y, {
      size,
      color: "#ff9d2e",
      rubyColor: AR_RUBY,
    });
    drawRuby(ctx, `${r.track}${labels.track}`, W * 0.97, y, {
      size: size * 0.85,
      color: "#ffffff",
      rubyColor: AR_RUBY,
      align: "right",
    });
  });
}

/** 路線図（かべの大きな看板・メニューの路線図と同じデータ）。 */
export function drawRouteMap(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  title: string,
  here?: string,
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, W * 0.01, H * 0.01, W * 0.98, H * 0.98, H * 0.03);
  ctx.strokeStyle = "#16264d";
  ctx.lineWidth = H * 0.012;
  ctx.stroke();
  drawRuby(ctx, title, W * 0.04, H * 0.12, {
    size: H * 0.06,
    color: "#16264d",
    rubyColor: "#0a6bd6",
  });
  const px = (x: number) => W * (0.08 + (x / 100) * 0.84);
  const py = (y: number) => H * (0.2 + (y / 100) * 0.72);
  for (const line of METRO.lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = H * 0.018;
    ctx.lineJoin = "round";
    ctx.beginPath();
    line.stations.forEach((id, i) => {
      const s = STATION[id];
      if (!s) return;
      if (i === 0) ctx.moveTo(px(s.x), py(s.y));
      else ctx.lineTo(px(s.x), py(s.y));
    });
    ctx.stroke();
  }
  for (const s of METRO.stations) {
    const x = px(s.x);
    const y = py(s.y);
    const big = s.numbers.length > 1;
    ctx.beginPath();
    ctx.arc(x, y, H * (big ? 0.016 : 0.011), 0, Math.PI * 2);
    ctx.fillStyle = s.id === here ? "#ff3b6b" : "#ffffff";
    ctx.fill();
    ctx.lineWidth = H * 0.006;
    ctx.strokeStyle = "#16264d";
    ctx.stroke();
    const size = H * 0.032;
    const off = H * 0.03;
    const opt = { size, color: "#16264d", rubyColor: "#0a6bd6" } as const;
    if (s.label === "left")
      drawRuby(ctx, s.name, x - off, y + size * 0.35, { ...opt, align: "right" });
    else if (s.label === "right") drawRuby(ctx, s.name, x + off, y + size * 0.35, opt);
    else if (s.label === "top") drawRuby(ctx, s.name, x, y - off, { ...opt, align: "center" });
    else drawRuby(ctx, s.name, x, y + off + size * 1.1, { ...opt, align: "center" });
  }
  // 線の名前の一覧
  let lx = W * 0.62;
  METRO.lines.forEach((l, i) => {
    const ly = H * 0.75 + i * H * 0.065;
    drawLineBadge(ctx, lx, ly, H * 0.022, l.letter, l.color);
    drawRuby(ctx, l.name, lx + H * 0.04, ly + H * 0.012, {
      size: H * 0.034,
      color: "#16264d",
      rubyColor: "#0a6bd6",
    });
  });
  lx = 0;
}
