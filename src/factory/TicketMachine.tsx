import { useMemo, useState } from "react";
import { playSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { questEvents } from "@/stages/events";
import { CanvasPanel } from "@/factory/CanvasPanel";
import { box, FLAT, merge, shade } from "@/factory/kit";
import { LINE, METRO, STATION } from "@/factory/signs";
import { drawLineBadge, drawRuby, roundRect } from "@/factory/text-canvas";

/**
 * 定期券・チャージの券売機（ピンク）。画面は 3D の中に Canvas で描き、押した所で操作する
 * （VR でもそのまま押せる。Fable 5.2 のレビュー「券売機は最初から 3D の中に」）。
 *
 * 流れ: 定期券 → 新しく買う → 通勤 → 出発駅（線 → 駅）→ 到着駅（線 → 駅）→ 経由 → 期間 → たしかめる → お金 → ICOCA
 * 買ったあとは チャージ → 金額 → お金 → 残高。
 * 正しい答え（天王寺・阿波座・3か月・通勤）は台本と同じ設定（docs/design/00_全体設計.md 3.1）。
 */

type Screen =
  | "top"
  | "new"
  | "kind"
  | "from-line"
  | "from-station"
  | "to-line"
  | "to-station"
  | "via"
  | "months"
  | "confirm"
  | "pay"
  | "issuing"
  | "take"
  | "charge"
  | "charge-pay"
  | "charged";

interface Btn {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: "primary" | "ghost" | "line" | "back" | "off";
  line?: string;
}

const W = 1200;
const H = 900;
const SCREEN_W = 0.56;
const SCREEN_H = 0.42;

/** 正しい答え。 */
const ANSWER = { from: "tennoji", fromLine: "M", to: "awaza", toLine: "C", months: 3 };
const PRICE = 25000;

function grid(
  ids: { id: string; label: string; line?: string; tone?: Btn["tone"] }[],
  cols: number,
  top = 250,
): Btn[] {
  const gap = 24;
  const bw = (W - 120 - gap * (cols - 1)) / cols;
  const bh = 118;
  return ids.map((b, i) => ({
    ...b,
    x: 60 + (i % cols) * (bw + gap),
    y: top + Math.floor(i / cols) * (bh + gap),
    w: bw,
    h: bh,
    tone: b.tone ?? "ghost",
  }));
}

const back: Btn = { id: "back", label: "tm.back", x: 60, y: H - 130, w: 260, h: 90, tone: "back" };

export function TicketMachine({
  position,
  rotationY = 0,
  active,
}: {
  position: [number, number, number];
  rotationY?: number;
  /** 台本でこの券売機がアップになっている間だけ、画面を押せる。 */
  active: boolean;
}) {
  const [screen, setScreen] = useState<Screen>("top");
  const [fromLine, setFromLine] = useState("");
  const [toLine, setToLine] = useState("");
  const [amount, setAmount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const bought = useGame((s) => s.inventory.includes("icoca-pass"));
  const balance = useGame((s) => s.icocaBalance);
  const charge = useGame((s) => s.charge);

  const buttons = useMemo((): Btn[] => {
    switch (screen) {
      case "top":
        return grid(
          [
            { id: "pass", label: "tm.pass", tone: bought ? "off" : "primary" },
            { id: "charge", label: "tm.charge", tone: bought ? "primary" : "off" },
          ],
          2,
          320,
        );
      case "new":
        return [
          ...grid(
            [
              { id: "new", label: "tm.new", tone: "primary" },
              { id: "renew", label: "tm.renew", tone: "off" },
            ],
            2,
            320,
          ),
          back,
        ];
      case "kind":
        return [
          ...grid(
            [
              { id: "commute", label: "tm.commute", tone: "primary" },
              { id: "school", label: "tm.school" },
            ],
            2,
            320,
          ),
          back,
        ];
      case "from-line":
      case "to-line":
        return [
          ...grid(
            METRO.lines.map((l) => ({
              id: `line:${l.id}`,
              label: l.name,
              line: l.id,
              tone: "line" as const,
            })),
            1,
            230,
          ),
          back,
        ];
      case "from-station":
      case "to-station": {
        const lineId = screen === "from-station" ? fromLine : toLine;
        const line = LINE[lineId];
        const ids = (line?.stations ?? []).map((id) => ({
          id: `st:${id}`,
          label: STATION[id]?.name ?? id,
        }));
        return [...grid(ids, 3, 220), back];
      }
      case "via":
        return [
          { id: "ok", label: "tm.ok", x: W / 2 - 180, y: 560, w: 360, h: 120, tone: "primary" },
          back,
        ];
      case "months":
        return [
          ...grid(
            [
              { id: "m1", label: "tm.m1" },
              { id: "m3", label: "tm.m3" },
              { id: "m6", label: "tm.m6" },
            ],
            3,
            320,
          ),
          back,
        ];
      case "confirm":
        return [
          { id: "ok", label: "tm.ok", x: W - 420, y: H - 150, w: 360, h: 110, tone: "primary" },
          { ...back, y: H - 150, h: 110 },
        ];
      case "pay":
      case "charge-pay":
        return [
          {
            id: "insert",
            label: "tm.insert",
            x: W / 2 - 260,
            y: 520,
            w: 520,
            h: 140,
            tone: "primary",
          },
        ];
      case "charge":
        return [
          ...grid(
            [1000, 2000, 3000, 5000, 10000].map((y) => ({
              id: `yen:${y}`,
              label: `${y.toLocaleString()}`,
            })),
            3,
            260,
          ),
          back,
        ];
      default:
        return [];
    }
  }, [screen, bought, fromLine, toLine]);

  const say = (key: Parameters<typeof t>[0]) => {
    setFlash(t(key));
    playSfx("ng");
    window.setTimeout(() => setFlash(null), 2200);
  };

  const press = (id: string) => {
    playSfx("button");
    setFlash(null);
    if (id === "back") {
      const prev: Partial<Record<Screen, Screen>> = {
        new: "top",
        kind: "new",
        "from-line": "kind",
        "from-station": "from-line",
        "to-line": "from-station",
        "to-station": "to-line",
        via: "to-station",
        months: "via",
        confirm: "months",
        charge: "top",
      };
      setScreen(prev[screen] ?? "top");
      return;
    }
    switch (screen) {
      case "top":
        if (id === "pass" && !bought) setScreen("new");
        if (id === "charge" && bought) setScreen("charge");
        return;
      case "new":
        if (id === "new") setScreen("kind");
        return;
      case "kind":
        if (id === "commute") setScreen("from-line");
        else say("tm.wrongCommute");
        return;
      case "from-line":
        setFromLine(id.slice(5));
        setScreen("from-station");
        return;
      case "from-station":
        if (id === `st:${ANSWER.from}` && fromLine === ANSWER.fromLine) setScreen("to-line");
        else say("tm.wrongStation");
        return;
      case "to-line":
        setToLine(id.slice(5));
        setScreen("to-station");
        return;
      case "to-station":
        if (id === `st:${ANSWER.to}` && toLine === ANSWER.toLine) setScreen("via");
        else say("tm.wrongStation");
        return;
      case "via":
        setScreen("months");
        return;
      case "months":
        if (id === "m3") setScreen("confirm");
        else say("tm.wrongMonths");
        return;
      case "confirm":
        setScreen("pay");
        return;
      case "pay":
        playSfx("chime");
        setScreen("issuing");
        window.setTimeout(() => {
          setScreen("take");
          playSfx("pi");
          window.setTimeout(() => {
            questEvents.emit("ticket:purchased");
            setScreen("top");
          }, 1400);
        }, 1300);
        return;
      case "charge":
        setAmount(Number(id.slice(4)));
        setScreen("charge-pay");
        return;
      case "charge-pay":
        playSfx("chime");
        charge(amount);
        setScreen("charged");
        window.setTimeout(() => {
          questEvents.emit("ticket:charged", amount);
          setScreen("top");
        }, 1800);
        return;
    }
  };

  const onPick = (x: number, y: number) => {
    const b = buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (b && b.tone !== "off") press(b.id);
  };

  const draw = (ctx: CanvasRenderingContext2D) =>
    drawScreen(ctx, screen, buttons, { fromLine, toLine, amount, balance, flash });

  const body = useMemo(() => {
    const pink = "#f28bb3";
    return merge([
      box(0.9, 1.75, 0.62, pink, { pos: [0, 0.875, 0] }),
      box(0.92, 0.12, 0.66, shade(pink, 0.8), { pos: [0, 1.81, 0] }),
      box(0.8, 0.5, 0.06, "#2b2f3a", { pos: [0, 1.22, 0.31], rot: [-0.18, 0, 0] }),
      box(0.3, 0.05, 0.05, "#1c1c22", { pos: [-0.2, 0.86, 0.32] }),
      box(0.18, 0.12, 0.05, "#3a8dde", { pos: [0.22, 0.86, 0.32] }),
      box(0.6, 0.18, 0.04, "#ffffff", { pos: [0, 1.64, 0.32] }),
    ]);
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={FLAT} />
      <CanvasPanel
        width={0.55}
        height={0.13}
        ppm={800}
        position={[0, 1.64, 0.345]}
        fontText={t("sign.passMachine")}
        draw={(ctx, w, h) => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          drawRuby(ctx, t("sign.passMachine"), w / 2, h * 0.82, {
            size: h * 0.48,
            color: "#c2185b",
            rubyColor: "#0a6bd6",
            align: "center",
          });
        }}
      />
      <CanvasPanel
        width={SCREEN_W}
        height={SCREEN_H}
        ppm={W / SCREEN_W}
        position={[0, 1.235, 0.345]}
        rotation={[-0.18, 0, 0]}
        emissive
        fontText={buttons.map((b) => b.label).join("") + t("tm.top")}
        deps={[screen, buttons, flash, balance, amount]}
        draw={draw}
        onPick={active ? onPick : undefined}
      />
    </group>
  );
}

function label(key: string): string {
  return key.startsWith("tm.") ? t(key as Parameters<typeof t>[0]) : key;
}

function drawScreen(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  buttons: Btn[],
  st: { fromLine: string; toLine: string; amount: number; balance: number; flash: string | null },
): void {
  // 地
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#eaf6ff");
  g.addColorStop(1, "#cfe6ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#c2185b";
  ctx.fillRect(0, 0, W, 120);
  const titleKey: Partial<Record<Screen, Parameters<typeof t>[0]>> = {
    top: "tm.top",
    new: "tm.pass",
    kind: "tm.kind",
    "from-line": "tm.from",
    "from-station": "tm.fromStation",
    "to-line": "tm.to",
    "to-station": "tm.toStation",
    via: "tm.via",
    months: "tm.months",
    confirm: "tm.confirm",
    pay: "tm.pay",
    issuing: "tm.issuing",
    take: "tm.take",
    charge: "tm.chargeTitle",
    "charge-pay": "tm.pay",
    charged: "tm.charged",
  };
  const title = titleKey[screen];
  if (title) drawRuby(ctx, t(title), 50, 95, { size: 46, color: "#ffffff", rubyColor: "#fff3f8" });
  if (screen === "top") {
    drawRuby(ctx, t("tm.passOnly"), W / 2, 230, {
      size: 40,
      color: "#16264d",
      rubyColor: "#0a6bd6",
      align: "center",
    });
  }

  if (screen === "via") {
    drawRoute(ctx, 260);
  }
  if (screen === "confirm") {
    drawRoute(ctx, 190);
    const rows: [string, string][] = [
      [t("tm.period"), t("tm.m3")],
      [t("tm.kind"), t("tm.commute")],
      [t("tm.price"), `${(PRICE + 500).toLocaleString()} ${t("tm.yen")}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 470 + i * 92;
      drawRuby(ctx, k, 90, y, { size: 40, color: "#16264d", rubyColor: "#0a6bd6" });
      drawRuby(ctx, v, 460, y, { size: 44, color: "#16264d", rubyColor: "#0a6bd6" });
    });
    drawRuby(ctx, `${t("tm.deposit")}（${t("tm.priceNote")}）`, 90, 720, {
      size: 28,
      color: "#6a3a52",
      rubyColor: "#0a6bd6",
    });
  }
  if (screen === "pay" || screen === "charge-pay") {
    const yen = screen === "pay" ? PRICE + 500 : st.amount;
    drawRuby(ctx, `${yen.toLocaleString()} ${t("tm.yen")}`, W / 2, 380, {
      size: 90,
      color: "#16264d",
      rubyColor: "#0a6bd6",
      align: "center",
    });
  }
  if (screen === "issuing" || screen === "take") {
    roundRect(ctx, W / 2 - 200, 300, 400, 250, 24);
    const cg = ctx.createLinearGradient(W / 2 - 200, 300, W / 2 + 200, 550);
    cg.addColorStop(0, "#7ad7ff");
    cg.addColorStop(1, "#2a6cff");
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 72px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ICOCA", W / 2, 455);
    ctx.textAlign = "left";
  }
  if (screen === "charged") {
    drawRuby(ctx, `+${st.amount.toLocaleString()} ${t("tm.yen")}`, W / 2, 380, {
      size: 80,
      color: "#1b8a4a",
      rubyColor: "#0a6bd6",
      align: "center",
    });
    drawRuby(ctx, `${t("tm.balance")} ${st.balance.toLocaleString()} ${t("tm.yen")}`, W / 2, 520, {
      size: 56,
      color: "#16264d",
      rubyColor: "#0a6bd6",
      align: "center",
    });
    drawRuby(ctx, t("tm.chargeNote"), W / 2, 640, {
      size: 40,
      color: "#16264d",
      rubyColor: "#0a6bd6",
      align: "center",
    });
  }

  for (const b of buttons) {
    roundRect(ctx, b.x, b.y, b.w, b.h, 22);
    const fill =
      b.tone === "primary"
        ? "#1aa6ff"
        : b.tone === "back"
          ? "#6b7385"
          : b.tone === "off"
            ? "#c9ced8"
            : "#ffffff";
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = b.tone === "line" && b.line ? (LINE[b.line]?.color ?? "#16264d") : "#16264d";
    ctx.stroke();
    const color =
      b.tone === "primary" || b.tone === "back"
        ? "#ffffff"
        : b.tone === "off"
          ? "#7d8594"
          : "#16264d";
    const size = Math.min(52, b.h * 0.4);
    if (b.line && LINE[b.line]) {
      const line = LINE[b.line]!;
      drawLineBadge(ctx, b.x + b.h * 0.6, b.y + b.h / 2, b.h * 0.32, line.letter, line.color);
      drawRuby(ctx, line.name, b.x + b.h * 1.15, b.y + b.h * 0.72, {
        size,
        color,
        rubyColor: "#0a6bd6",
      });
      ctx.font = "700 30px sans-serif";
      ctx.fillStyle = "#56607a";
      ctx.fillText(line.en, b.x + b.w - 330, b.y + b.h * 0.65);
    } else {
      drawRuby(ctx, label(b.label), b.x + b.w / 2, b.y + b.h * 0.72, {
        size,
        color,
        rubyColor: b.tone === "primary" || b.tone === "back" ? "#ffffff" : "#0a6bd6",
        align: "center",
      });
    }
  }

  if (st.flash) {
    roundRect(ctx, 80, H / 2 - 90, W - 160, 180, 28);
    ctx.fillStyle = "rgba(255,240,236,0.97)";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ff7a6b";
    ctx.stroke();
    drawRuby(ctx, st.flash, W / 2, H / 2 + 25, {
      size: 46,
      color: "#7a1f12",
      rubyColor: "#0a6bd6",
      align: "center",
    });
  }
}

function drawRoute(ctx: CanvasRenderingContext2D, y: number) {
  const m = LINE.M!;
  const c = LINE.C!;
  drawRuby(ctx, t("tm.section"), 90, y + 40, { size: 40, color: "#16264d", rubyColor: "#0a6bd6" });
  drawLineBadge(ctx, 330, y + 25, 34, m.letter, m.color);
  drawRuby(ctx, `${STATION.tennoji!.name}`, 380, y + 45, {
    size: 54,
    color: "#16264d",
    rubyColor: "#0a6bd6",
  });
  drawRuby(ctx, "→", 640, y + 45, { size: 54, color: "#16264d" });
  drawLineBadge(ctx, 740, y + 25, 34, c.letter, c.color);
  drawRuby(ctx, `${STATION.awaza!.name}`, 790, y + 45, {
    size: 54,
    color: "#16264d",
    rubyColor: "#0a6bd6",
  });
  drawRuby(ctx, t("tm.via"), 380, y + 150, { size: 40, color: "#16264d", rubyColor: "#0a6bd6" });
}
