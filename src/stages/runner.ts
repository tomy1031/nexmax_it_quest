import type { Beat, Section, StageFile } from "@/content/schema";
import { playSfx, stopAllSfx } from "@/lib/audio";
import { useGame } from "@/lib/store";
import { questEvents } from "@/stages/events";
import { initialPlay, usePlay, waits } from "@/stages/play-store";

/**
 * 台本（content/stages/*.json）を1こまずつ進める。
 *
 * - 場面（section）の始めで自動で保存する。途中でやめても、その場面の始めから再開できる。
 * - 「wait」は 3D の場面からの合図（click:<id> など）を待つ。ちがう合図には else の台本で答える。
 * - 「jump」は場面ごとやり直す（まちがえた電車 → 券売機の前から。企画メモ）。
 * - 合否と文は台本に書く。ここ（プログラム）は文を持たない。
 */

class Jump {
  constructor(readonly to: string) {}
}
class Stopped {}

/** ヒントを出すまでの時間（秒）。止まって考えている時間を取ってから、少しずつ出す。 */
const HINT_AFTER = [25, 45, 70];

export interface RunnerOptions {
  stage: StageFile;
  startSection?: string;
  /** テストのとき、待ち時間を縮める。 */
  fast?: boolean;
  onEnd?: () => void;
}

function addTodo(id: string, text: string): void {
  const list = usePlay.getState().todos;
  if (list.some((x) => x.id === id)) return;
  usePlay.setState({ todos: [...list, { id, text, done: false }] });
}

function addMemo(id: string, title: string, text: string): void {
  const list = usePlay.getState().memos;
  if (list.some((x) => x.id === id)) return;
  usePlay.setState({ memos: [...list, { id, title, text }] });
}

function doneTodo(id: string): void {
  usePlay.setState({
    todos: usePlay.getState().todos.map((x) => (x.id === id ? { ...x, done: true } : x)),
  });
}

export class StageRunner {
  private stopped = false;
  private hintTimer: number | null = null;
  private eventQueue: string[] = [];
  private eventWaiter: ((name: string) => void) | null = null;
  private offEvents: () => void;
  private sceneReady = false;
  private sceneWaiter: (() => void) | null = null;

  constructor(private readonly opts: RunnerOptions) {
    this.offEvents = questEvents.on((name) => {
      if (name === "scene:ready") {
        this.sceneReady = true;
        this.sceneWaiter?.();
        this.sceneWaiter = null;
        return;
      }
      if (name.startsWith("fx:")) return;
      // 待っていないときの合図は捨てる（関係のないクリックで先へ進まない）
      if (this.eventWaiter) {
        const w = this.eventWaiter;
        this.eventWaiter = null;
        w(name);
      } else if (name.startsWith("reach:") || name.startsWith("ticket:")) {
        // 到着と 券売機の「買った・チャージした」は、待つ前に 起きることがあるので取っておく
        // （定期券を買ったあと、説明の とちゅうで チャージすると 合図が すてられ、もう一度 チャージと言われた。tomy さん 2026-11-23）
        if (!this.eventQueue.includes(name)) this.eventQueue.push(name);
      }
    });
  }

  stop(): void {
    this.stopped = true;
    this.offEvents();
    this.clearHints();
    stopAllSfx();
    for (const k of Object.keys(waits) as (keyof typeof waits)[]) waits[k] = null;
  }

  async run(): Promise<void> {
    const { stage } = this.opts;
    usePlay.setState({ ...initialPlay, stageId: stage.id });
    let index = Math.max(
      0,
      stage.sections.findIndex((s) => s.id === this.opts.startSection),
    );
    // 最初の場面から始めるときは、前に遊んだときの 持ち物（定期券など）を消す
    // （「最初から」で定期券が残り、券売機で チャージしか えらべなかった。tomy さん 2026-11-23）
    if (index === 0) useGame.getState().resetRun();
    // 着がえ（スーツ）の場面より あとから始めたのに 寝巻きのままなら、スーツにする（駅で寝巻きにならないように）
    const dressAt = stage.sections.findIndex((sec) =>
      sec.beats.some((b) => b.t === "panel" && b.id === "avatar" && b.mode === "suit"),
    );
    if (dressAt >= 0 && index > dressAt && useGame.getState().avatar.outfit === "pajama")
      useGame.getState().setAvatar({ outfit: "suit" });
    // 途中から始めたときは、前の場面までの「やること」を そろえておく
    for (const s of stage.sections.slice(0, index)) {
      for (const b of s.beats) {
        if (b.t === "todo-add") addTodo(b.id, b.text);
        if (b.t === "todo-done") doneTodo(b.id);
        if (b.t === "memo-add") addMemo(b.id, b.title, b.text);
      }
    }
    let lastChapter = 0;
    while (index < stage.sections.length && !this.stopped) {
      const section = stage.sections[index]!;
      try {
        await this.enterSection(section, section.chapter !== lastChapter);
        lastChapter = section.chapter;
        await this.runBeats(section.beats);
        index += 1;
      } catch (e) {
        if (e instanceof Jump) {
          const to = stage.sections.findIndex((s) => s.id === e.to);
          index = to >= 0 ? to : index;
          lastChapter = 0;
          continue;
        }
        if (e instanceof Stopped) return;
        throw e;
      }
    }
  }

  private async enterSection(section: Section, newChapter: boolean): Promise<void> {
    const game = useGame.getState();
    game.setSection(this.opts.stage.id, section.id);
    for (const item of section.requires ?? []) game.give(item);
    this.eventQueue = [];
    const prev = usePlay.getState();
    const sameScene = prev.scene === section.scene && prev.spawn === section.spawn;
    usePlay.setState({
      sectionId: section.id,
      chapter: section.chapter,
      scene: section.scene,
      spawn: section.spawn,
      sceneKey: sameScene ? prev.sceneKey : prev.sceneKey + 1,
      objective: null,
      focus: null,
      line: null,
      chapterBanner: newChapter ? section.chapter : null,
    });
    if (!sameScene) {
      this.sceneReady = false;
      await this.waitScene();
    }
    if (newChapter) {
      await this.sleep(1600);
      usePlay.setState({ chapterBanner: null });
    }
  }

  private waitScene(): Promise<void> {
    if (this.sceneReady) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(), 15000);
      this.sceneWaiter = () => {
        window.clearTimeout(timer);
        resolve();
      };
    });
  }

  private check(): void {
    if (this.stopped) throw new Stopped();
  }

  private sleep(ms: number): Promise<void> {
    const real = this.opts.fast ? Math.min(ms, 50) : ms;
    return new Promise((r) => window.setTimeout(r, real));
  }

  private waitFor<K extends keyof typeof waits>(
    key: K,
  ): Promise<Parameters<NonNullable<(typeof waits)[K]>>[0]> {
    return new Promise((resolve) => {
      (waits as Record<string, unknown>)[key] = resolve;
    });
  }

  private nextEvent(want?: string): Promise<string> {
    // 待っている合図が 取っておいた中に あれば、それを先に使う。券売機の合図は、待つまで 取っておく
    const hit = want ? this.eventQueue.indexOf(want) : -1;
    if (hit >= 0) return Promise.resolve(this.eventQueue.splice(hit, 1)[0]!);
    const k = this.eventQueue.findIndex((e) => !e.startsWith("ticket:"));
    const queued = k >= 0 ? this.eventQueue.splice(k, 1)[0] : undefined;
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => {
      this.eventWaiter = resolve;
    });
  }

  private clearHints(): void {
    if (this.hintTimer !== null) window.clearInterval(this.hintTimer);
    this.hintTimer = null;
  }

  private startHints(count: number): void {
    this.clearHints();
    if (count === 0) return;
    const started = Date.now();
    const scale = this.opts.fast ? 0.01 : 1;
    this.hintTimer = window.setInterval(() => {
      const sec = (Date.now() - started) / 1000;
      const level = HINT_AFTER.filter((s) => sec >= s * scale).length;
      if (level > usePlay.getState().hintLevel)
        usePlay.setState({ hintLevel: Math.min(level, count) });
    }, 500);
  }

  private say(who: Beat & { t: "say" }): void {
    const line = { who: who.who, text: who.text, pose: who.pose };
    usePlay.setState((s) => ({ line, log: [...s.log.slice(-60), line] }));
  }

  async runBeats(beats: Beat[]): Promise<void> {
    for (const beat of beats) {
      this.check();
      await this.runBeat(beat);
    }
  }

  private async runBeat(beat: Beat): Promise<void> {
    switch (beat.t) {
      case "say": {
        this.say(beat);
        await this.waitFor("next");
        this.check();
        usePlay.setState({ line: null });
        return;
      }
      case "objective":
        usePlay.setState({
          objective: {
            text: beat.text,
            target: beat.target,
            arrow: beat.arrow ?? true,
            hints: beat.hints ?? [],
            lines: beat.lines ?? [],
          },
          hintLevel: 0,
        });
        this.startHints(beat.hints?.length ?? 0);
        return;
      case "clear-objective":
        this.clearHints();
        usePlay.setState({ objective: null, hintLevel: 0 });
        return;
      case "wait": {
        for (;;) {
          usePlay.setState({ waitingFor: beat.event });
          const name = await this.nextEvent(beat.event);
          usePlay.setState({ waitingFor: null });
          this.check();
          if (name === beat.event) return;
          const other = beat.else?.[name];
          if (other) {
            await this.runBeats(other);
          }
        }
      }
      case "tip": {
        usePlay.setState({ tip: beat.id });
        useGame.getState().seeTip(beat.id);
        playSfx("card");
        await this.waitFor("tip");
        this.check();
        usePlay.setState({ tip: null });
        return;
      }
      case "choice": {
        for (;;) {
          usePlay.setState({
            choice: { prompt: beat.prompt, options: beat.options.map((o) => o.text) },
          });
          const i = await this.waitFor("choice");
          this.check();
          usePlay.setState({ choice: null });
          const option = beat.options[i];
          if (!option) continue;
          if (option.then) await this.runBeats(option.then);
          if (option.correct) return;
        }
      }
      case "panel": {
        usePlay.setState({ panel: { id: beat.id, mode: beat.mode } });
        await this.waitFor("panel");
        this.check();
        usePlay.setState({ panel: null });
        return;
      }
      case "focus":
        usePlay.setState({ focus: beat.target });
        await this.sleep(500);
        return;
      case "unfocus":
        usePlay.setState({ focus: null });
        await this.sleep(300);
        return;
      case "goto":
        questEvents.emit(`goto:${beat.anchor}`);
        return;
      case "fx":
        questEvents.emit(`fx:${beat.id}`);
        return;
      case "sfx":
        playSfx(beat.id);
        return;
      case "pause":
        await this.sleep(beat.ms);
        return;
      case "give":
        useGame.getState().give(beat.item);
        return;
      case "flag":
        return;
      case "jump":
        throw new Jump(beat.to);
      case "todo-add":
        addTodo(beat.id, beat.text);
        if (!this.opts.fast) playSfx("pi");
        return;
      case "todo-done":
        doneTodo(beat.id);
        return;
      case "wear":
        useGame.getState().setAvatar({ outfit: beat.outfit });
        return;
      case "memo-add":
        addMemo(beat.id, beat.title, beat.text);
        if (!this.opts.fast) playSfx("pi");
        return;
      case "verdict": {
        usePlay.setState({ verdict: { ok: beat.ok, text: beat.text } });
        playSfx(beat.ok ? "ok" : "ng");
        await this.waitFor("next");
        this.check();
        usePlay.setState({ verdict: null });
        return;
      }
      case "dream": {
        usePlay.setState({ dream: beat.items });
        await this.waitFor("next");
        this.check();
        usePlay.setState({ dream: null });
        return;
      }
      case "end": {
        useGame.getState().clearStage(this.opts.stage.id);
        usePlay.setState({ ended: true });
        this.opts.onEnd?.();
        return;
      }
    }
  }
}
