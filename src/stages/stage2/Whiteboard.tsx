import meetingJson from "@content/meetings/aoba-kickoff.json";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { drawRuby, FONT_FAMILY, measureRuby, roundRect } from "@/factory/text-canvas";
import { t } from "@/lib/t";
import { pickCard, useBoard } from "@/stages/stage2/board-store";

/**
 * 会議室A の かべの ホワイトボード（3D。VR でも 読める ように、質問に 要る ことは ここにも 出す。AGENTS.md ルール10）。
 * 左「わかった こと」（緑。fx: board-known で 入る）・右「まだ わからない こと」（「？」の カード 8まい）。
 * カードは 押すと えらべる（CanvasPanel の onPick。VR では コントローラーの 光線）。開くと 絵文字と 短い 答えに なる。
 */

interface CardLike {
  id: string;
  icon: string;
  label: string;
  short?: string;
  answer?: string;
}
const MEETING = meetingJson as unknown as {
  known: CardLike[];
  cards: CardLike[];
  bonus: CardLike[];
};

export const BOARD_W = 3.2;
export const BOARD_H = 1.7;
const PPM = 400;

/** 右の カードの 並び（4列 × 2行）。押した 所の 判定にも 使う（px）。 */
function cardRects(w: number, h: number) {
  const x0 = w * 0.385;
  const y0 = h * 0.19;
  const gap = w * 0.012;
  const cw = (w * 0.6 - gap * 3) / 4;
  const ch = (h * 0.77 - gap) / 2;
  return MEETING.cards.map((c, i) => ({
    id: c.id,
    x: x0 + (i % 4) * (cw + gap),
    y: y0 + Math.floor(i / 4) * (ch + gap),
    w: cw,
    h: ch,
  }));
}

/** 分かち書きの 空白（と「・」「→」の あと）で 切って、幅に 入る 行に わける。 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) {
  const tokens = text
    .replace(/([・→])/g, "$1 ")
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    const joint = cur && !/[・→]$/.test(cur) ? " " : "";
    const next = cur ? `${cur}${joint}${tok}` : tok;
    if (cur && measureRuby(ctx, next, { size, color: "" }) > maxW) {
      lines.push(cur);
      cur = tok;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 幅に 入る まで 字を 小さく して、何行かで 描く。 */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  maxW: number,
  maxH: number,
  size: number,
  color: string,
  align: "center" | "left" = "center",
) {
  let s = size;
  let lines = wrapLines(ctx, text, maxW, s);
  while (
    s > 14 &&
    (lines.length * s * 1.75 > maxH ||
      lines.some((l) => measureRuby(ctx, l, { size: s, color }) > maxW))
  ) {
    s -= 2;
    lines = wrapLines(ctx, text, maxW, s);
  }
  lines.forEach((l, i) =>
    drawRuby(ctx, l, cx, top + s * 1.25 + i * s * 1.75, { size: s, color, align }),
  );
}

function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  h: number,
  bg: string,
) {
  const size = h * 0.48;
  const w = measureRuby(ctx, text, { size, color: "#fff" }) + h * 0.9;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  drawRuby(ctx, text, x + h * 0.45, y + h * 0.78, { size, color: "#ffffff" });
}

function emoji(ctx: CanvasRenderingContext2D, e: string, cx: number, cy: number, size: number) {
  ctx.font = `${size}px "Noto Color Emoji", ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, cx, cy);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

export function Whiteboard({ position }: { position: [number, number, number] }) {
  const known = useBoard((s) => s.known);
  const opened = useBoard((s) => s.opened);
  const selected = useBoard((s) => s.selected);
  const pickable = useBoard((s) => s.pickable);
  const fontText = [
    t("s2.boardKnown"),
    t("s2.boardUnknown"),
    t("s2.boardWaiting"),
    t("s2.boardBonus"),
    ...MEETING.known.map((k) => k.label + (k.answer ?? "")),
    ...MEETING.cards.map((c) => c.label + (c.short ?? "")),
    ...MEETING.bonus.map((c) => c.label + (c.short ?? "")),
  ].join("");

  return (
    <group position={position}>
      {/* 枠と 下の ペン置き */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[BOARD_W + 0.12, BOARD_H + 0.12, 0.04]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, -BOARD_H / 2 - 0.06, 0.05]}>
        <boxGeometry args={[BOARD_W * 0.9, 0.04, 0.1]} />
        <meshStandardMaterial color="#b8bec7" />
      </mesh>
      <CanvasPanel
        width={BOARD_W}
        height={BOARD_H}
        ppm={PPM}
        fontText={fontText}
        deps={[known, opened.join(","), selected, pickable]}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#fdfdfb";
          ctx.fillRect(0, 0, w, h);
          const pad = w * 0.018;
          // ── 左: わかった こと ──
          const lw = w * 0.35;
          pill(ctx, t("s2.boardKnown"), pad, h * 0.04, h * 0.1, "#1f8a5c");
          if (!known) {
            drawBlock(
              ctx,
              t("s2.boardWaiting"),
              pad + lw / 2,
              h * 0.3,
              lw - pad,
              h * 0.4,
              34,
              "#7a6a5e",
            );
          } else {
            const rowH = h * 0.135;
            MEETING.known.forEach((k, i) => {
              const y = h * 0.17 + i * rowH;
              ctx.fillStyle = "#e3f5ea";
              roundRect(ctx, pad, y, lw - pad, rowH - h * 0.015, 18);
              ctx.fill();
              emoji(ctx, k.icon, pad + rowH * 0.45, y + rowH * 0.46, rowH * 0.5);
              drawBlock(
                ctx,
                k.answer ?? k.label,
                pad + rowH * 0.95,
                y - 4,
                lw - pad - rowH * 1.0,
                rowH - 6,
                30,
                "#16543a",
                "left",
              );
            });
          }
          // ボーナス（カードに 無い ことを 聞き出した とき）
          const bonus = MEETING.bonus.filter((b) => opened.includes(b.id));
          if (bonus.length > 0) {
            const by = h * 0.72;
            pill(ctx, `⭐ ${t("s2.boardBonus")}`, pad, by, h * 0.075, "#b8741a");
            const chipH = (h * 0.95 - by - h * 0.09) / Math.max(1, Math.ceil(bonus.length / 2));
            bonus.forEach((b, i) => {
              const cw = (lw - pad) / 2 - 6;
              const x = pad + (i % 2) * (cw + 12);
              const y = by + h * 0.09 + Math.floor(i / 2) * chipH;
              ctx.fillStyle = "#fff1d6";
              roundRect(ctx, x, y, cw, chipH - 6, 14);
              ctx.fill();
              emoji(ctx, b.icon, x + chipH * 0.35, y + chipH * 0.45, chipH * 0.45);
              drawBlock(
                ctx,
                b.short ?? b.label,
                x + chipH * 0.7,
                y - 6,
                cw - chipH * 0.75,
                chipH - 6,
                22,
                "#6b3f0a",
                "left",
              );
            });
          }
          // 区切りの 線
          ctx.fillStyle = "#d9dde3";
          ctx.fillRect(w * 0.37, h * 0.05, 3, h * 0.9);
          // ── 右: まだ わからない こと ──
          pill(ctx, t("s2.boardUnknown"), w * 0.385, h * 0.04, h * 0.1, "#5c463a");
          for (const r of cardRects(w, h)) {
            const c = MEETING.cards.find((x) => x.id === r.id)!;
            const open = opened.includes(c.id);
            const sel = selected === c.id && !open;
            ctx.fillStyle = open ? "#1f8a5c" : sel ? "#fff3c4" : "#fff8ea";
            roundRect(ctx, r.x, r.y, r.w, r.h, 22);
            ctx.fill();
            ctx.lineWidth = sel ? 10 : 4;
            ctx.strokeStyle = sel ? "#e08a1e" : open ? "#16704a" : "#e2cfae";
            ctx.stroke();
            emoji(ctx, c.icon, r.x + r.w / 2, r.y + r.h * 0.2, r.h * 0.22);
            if (open) {
              drawBlock(
                ctx,
                c.short ?? c.label,
                r.x + r.w / 2,
                r.y + r.h * 0.34,
                r.w - 20,
                r.h * 0.64,
                30,
                "#ffffff",
              );
            } else {
              drawBlock(
                ctx,
                c.label,
                r.x + r.w / 2,
                r.y + r.h * 0.34,
                r.w - 20,
                r.h * 0.4,
                30,
                "#47352b",
              );
              ctx.font = `900 ${r.h * 0.2}px ${FONT_FAMILY}`;
              ctx.fillStyle = sel ? "#e08a1e" : "#c9a56a";
              ctx.textAlign = "center";
              ctx.fillText("？", r.x + r.w / 2, r.y + r.h * 0.93);
              ctx.textAlign = "left";
            }
          }
        }}
        onPick={(x, y) => {
          const w = BOARD_W * PPM;
          const h = BOARD_H * PPM;
          const hit = cardRects(w, h).find(
            (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
          );
          if (hit) pickCard(hit.id);
        }}
      />
    </group>
  );
}
