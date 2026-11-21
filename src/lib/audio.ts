import { useSettings } from "@/lib/store";

/**
 * 音（WebAudio でその場で作る。音のファイルは使わない）。
 * 叱る音・ブザーは作らない（academy 01ガイド）。まちがえたときの音も、やわらかい音にする。
 */

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!useSettings.getState().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.12,
) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

let alarmTimer: number | null = null;
let vibrateTimer: number | null = null;

export type SfxId =
  | "alarm"
  | "alarm-stop"
  | "vibrate"
  | "vibrate-stop"
  | "pi"
  | "click"
  | "ok"
  | "ng"
  | "dive"
  | "chime"
  | "button"
  | "card";

export function playSfx(id: SfxId | string): void {
  switch (id) {
    case "alarm":
      stopLoop("alarm");
      alarmTimer = window.setInterval(() => {
        for (let i = 0; i < 4; i += 1) tone(1760, i * 0.12, 0.08, "square", 0.05);
      }, 900);
      return;
    case "alarm-stop":
      stopLoop("alarm");
      return;
    case "vibrate":
      stopLoop("vibrate");
      vibrateTimer = window.setInterval(() => {
        tone(70, 0, 0.35, "sawtooth", 0.06);
        tone(72, 0.45, 0.35, "sawtooth", 0.06);
      }, 1300);
      if (navigator.vibrate) navigator.vibrate([350, 100, 350]);
      return;
    case "vibrate-stop":
      stopLoop("vibrate");
      return;
    case "pi":
      tone(2200, 0, 0.12, "sine", 0.12);
      return;
    case "click":
      tone(880, 0, 0.05, "triangle", 0.06);
      return;
    case "button":
      tone(660, 0, 0.08, "triangle", 0.08);
      tone(990, 0.08, 0.1, "triangle", 0.08);
      return;
    case "ok":
      tone(784, 0, 0.12);
      tone(1047, 0.1, 0.2);
      return;
    case "ng":
      tone(392, 0, 0.18, "triangle", 0.08);
      tone(330, 0.16, 0.25, "triangle", 0.08);
      return;
    case "chime":
      [659, 523, 587, 392].forEach((f, i) => tone(f, i * 0.32, 0.5, "sine", 0.08));
      return;
    case "card":
      tone(523, 0, 0.1, "triangle", 0.07);
      tone(784, 0.08, 0.14, "triangle", 0.07);
      return;
    case "dive": {
      const a = ac();
      if (!a) return;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(80, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(900, a.currentTime + 2.6);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, a.currentTime + 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 2.8);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + 2.9);
      return;
    }
    default:
      return;
  }
}

function stopLoop(which: "alarm" | "vibrate") {
  if (which === "alarm" && alarmTimer !== null) {
    window.clearInterval(alarmTimer);
    alarmTimer = null;
  }
  if (which === "vibrate" && vibrateTimer !== null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
}

export function stopAllSfx(): void {
  stopLoop("alarm");
  stopLoop("vibrate");
}
