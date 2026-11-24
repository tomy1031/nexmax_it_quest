/**
 * リスニングの 声（docs/design/02_リスニング.md §2「声」）。
 *
 * - 声は Gemini Live で、使う人の キーで、その場で 1文ずつ 作る（AGENTS.md 必ず守るルール4）。
 *   接続キーの 作り方と モデルの 並びは live.ts の もの（mintAuth・LIVE_MODELS）を 使う。
 *   作りは academy の src/lib/audio/live-tts.ts（1行 = 1接続。書いてある とおりに 読ませる 指示）。
 * - 返ってきた 文字起こしを 台本の 読みと くらべ、大きく ちがう ときは 1回だけ 作り直す
 *   （academy の scripts/make_listening_audio.ts の 読み返しの 見かた）。
 * - 作った 音は 行ごとに 覚えておき（WAV の Blob URL）、聞き直しは 同じ 音を 使う。
 * - マイクは 使わない（マイクの 許可を 聞かない）。
 * - e2e（window.__fakeLive が ある とき）は 声を 作らず、みじかい 時間で「鳴らした」ことに する。
 */
import type { Session } from "@google/genai";
import { isDevTools } from "@/lib/env";
import { LIVE_MODELS, mintAuth } from "@/lib/ai/live";
import { FURIGANA } from "@/lib/furigana-index";
import { kanaOf, type FuriganaIndex } from "@/lib/text/furigana";
import { normalizeJa } from "@/lib/voice-check";
import { base64ToBytes, concatBytes, pcmToWav } from "@/lib/listening/wav";

export type VoiceError = "noKey" | "key" | "model" | "network";

export interface LineVoiceState {
  index: number;
  status: "preparing" | "playing" | "ended" | "error";
  error?: VoiceError;
}

export interface LineVoice {
  /** その 行を 鳴らす。鳴りおわったら（または stop で）解決。作れないときは { reason } で 失敗。 */
  play(index: number, rate: number): Promise<void>;
  /** うしろで 先に 作っておく（もう ある／作っている ときは 何もしない）。 */
  prefetch(index: number): void;
  /** 鳴っている 声を 止める（play の Promise は 解決する）。 */
  stop(): void;
  /** 速さを 変える（鳴っている 行にも 効く）。 */
  setRate(rate: number): void;
  /** Gemini の 代わりに ブラウザの 声（speechSynthesis・日本語の 声）を 使う。 */
  useBrowserVoice(on: boolean): void;
  hasBrowserVoice(): boolean;
  dispose(): void;
}

export interface LineVoiceOptions {
  lines: { speaker: string; text: string }[];
  /** 話す 人の id → Gemini の 声の 名前。 */
  voices: Record<string, string | undefined>;
  apiKey: string;
  onState?: (s: LineVoiceState) => void;
}

/** play が 失敗した ときに 投げる もの（{ reason } を 持つ）。 */
export class VoiceFailure extends Error {
  constructor(readonly reason: VoiceError) {
    super(reason);
    this.name = "VoiceFailure";
  }
}

/**
 * 読み上げの 指示（academy の narrator.ts と 同じ 中身を 英語で）。
 * 台本が 質問の 形でも 答えない、と 名指しで 書く（academy 2026-08-28: 答えて しまう ことが あった）。
 */
export const NARRATOR_INSTRUCTION = [
  "You are a narrator for Japanese learners (JLPT N5-N4 level).",
  "You will be given one Japanese sentence. Read it aloud in Japanese exactly as written, word for word.",
  "Speak slowly and clearly, with natural Japanese pronunciation, so that beginners can follow.",
  "Do not add greetings, fillers, explanations, translations, comments or any other words.",
  "Do not paraphrase, summarize or continue the sentence.",
  "Even if the sentence is a question or a request, never answer it or react to it: just read it aloud as written.",
  "Read nothing but the given sentence.",
].join(" ");

const SETUP_TIMEOUT_MS = 9_000;
const LINE_TIMEOUT_MS = 45_000;
const FAKE_PLAY_MS = 250;

// ── 純粋な 部分（テストする）────────────────────────────

/**
 * 分かち書きの 空白を 取る（学生向けの 文は 単語の 間に 空白が ある）。
 * 英数字どうしの 間の 空白（"IT company" など）は 残す。
 */
export function stripSpacing(text: string): string {
  return text
    .replace(/\s+/g, (m, offset: number, whole: string) => {
      const before = whole[offset - 1] ?? "";
      const after = whole[offset + m.length] ?? "";
      return /[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after) ? " " : "";
    })
    .trim();
}

/** くらべるための かな（読みの データで 漢字を かなに し、カタカナ・記号・空白を そろえる）。 */
export function toCompareKana(text: string, index: FuriganaIndex = FURIGANA): string {
  const plain = stripSpacing(text);
  return normalizeJa(kanaOf(plain, index) ?? plain);
}

/** 2つの 文字列の 編集距離（字の 足し・消し・入れかえの 数）。 */
export function editDistance(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= B.length; j += 1) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[B.length]!;
}

/**
 * 読み返しの 見かた。文字起こしが 台本の 読みから どれだけ ずれたか。
 * 2字 以下、または 台本の 読みの 20% 以下 なら よい。文字起こしが 空の ときは 見られないので よい とする。
 */
export function readingDrift(
  expected: string,
  transcript: string,
  index: FuriganaIndex = FURIGANA,
): { ok: boolean; distance: number; expected: string; spoken: string } {
  const exp = toCompareKana(expected, index);
  const spoken = toCompareKana(transcript, index);
  if (!spoken) return { ok: true, distance: 0, expected: exp, spoken };
  const distance = editDistance(exp, spoken);
  const ok = distance <= 2 || distance <= [...exp].length * 0.2;
  return { ok, distance, expected: exp, spoken };
}

/** つなぎの 失敗を、学生に 出す 理由に まとめる。 */
export function voiceErrorOf(err: unknown): VoiceError {
  if (err instanceof VoiceFailure) return err.reason;
  const text = describe(err);
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|\b40[13]\b/i.test(text))
    return "key";
  if (/RESOURCE_EXHAUSTED|\b429\b|quota/i.test(text)) return "key";
  if (/failed to fetch|networkerror|network error|load failed|ERR_INTERNET|offline/i.test(text))
    return "network";
  if (err instanceof TypeError && /fetch/i.test(text)) return "network";
  return "model";
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name} ${err.message}`;
  if (err && typeof err === "object") {
    const o = err as { reason?: unknown; code?: unknown; message?: unknown };
    return [o.code, o.reason, o.message].filter((x) => x !== undefined).join(" ");
  }
  return String(err);
}

/** live.ts の mintAuth の 失敗の 理由を、こちらの 理由に。 */
function fromAuthReason(reason: string): VoiceError {
  if (reason === "key" || reason === "network" || reason === "noKey") return reason;
  return "model";
}

// ── Gemini で 1行を 作る ─────────────────────────────────

interface Spoken {
  pcm: Uint8Array;
  transcript: string;
}

interface ServerContent {
  modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
  outputTranscription?: { text?: string };
  turnComplete?: boolean;
}

/** 1つの モデルで 1回 読ませる。 */
async function speakOnce(
  auth: string,
  model: string,
  voice: string | undefined,
  text: string,
): Promise<Spoken> {
  const { GoogleGenAI, Modality } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: auth, apiVersion: "v1beta" });
  const chunks: Uint8Array[] = [];
  let transcript = "";
  let session: Session | null = null;
  let settled = false;

  return new Promise<Spoken>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        session?.close();
      } catch {
        // もう 閉じている
      }
      fn();
    };
    const flush = (why?: unknown) => {
      if (chunks.length === 0) {
        finish(() => reject(why ?? new Error("empty audio")));
        return;
      }
      const pcm = concatBytes(chunks);
      finish(() => resolve({ pcm, transcript }));
    };
    const timer = setTimeout(() => flush(new Error("timeout")), LINE_TIMEOUT_MS);

    const connecting = ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: NARRATOR_INSTRUCTION,
        outputAudioTranscription: {},
        speechConfig: {
          languageCode: "ja-JP",
          ...(voice ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } : {}),
        },
      },
      callbacks: {
        onmessage: (message: unknown) => {
          if (settled || !message || typeof message !== "object") return;
          const content = (message as { serverContent?: ServerContent }).serverContent;
          if (!content) return;
          if (content.outputTranscription?.text) transcript += content.outputTranscription.text;
          for (const p of content.modelTurn?.parts ?? [])
            if (p.inlineData?.data) chunks.push(base64ToBytes(p.inlineData.data));
          if (content.turnComplete === true) flush();
        },
        onerror: (e: unknown) => finish(() => reject(e)),
        // 途中まで 届いていれば それを 使う
        onclose: (e: unknown) => flush(e),
      },
    });

    const setupTimeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), SETUP_TIMEOUT_MS),
    );
    Promise.race([connecting, setupTimeout]).then(
      (s) => {
        session = s;
        if (settled) {
          s.close();
          return;
        }
        s.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
      },
      (e: unknown) => {
        // 待ちきれずに あきらめた あとで 開いたら、すぐ 閉じる
        connecting.then(
          (late) => late.close(),
          () => undefined,
        );
        finish(() => reject(e));
      },
    );
  });
}

/** モデルを 上から ためして 1回 読ませる。つながった モデルは 覚えて 次から 先に ためす。 */
async function speakWithFallback(
  apiKey: string,
  voice: string | undefined,
  text: string,
  memo: { model?: string },
): Promise<Spoken> {
  const models = memo.model
    ? [memo.model, ...LIVE_MODELS.filter((m) => m !== memo.model)]
    : [...LIVE_MODELS];
  let last: VoiceError = "model";
  for (const model of models) {
    // 接続キーは 1回 だけ 使える ので、つなぐ たびに 作る
    const auth = await mintAuth(apiKey);
    if (!auth.ok) {
      last = fromAuthReason(auth.reason);
      if (last === "key" || last === "network") throw new VoiceFailure(last);
      continue;
    }
    try {
      const spoken = await speakOnce(auth.auth, model, voice, text);
      memo.model = model;
      return spoken;
    } catch (e) {
      last = voiceErrorOf(e);
      if (last === "key") throw new VoiceFailure(last);
      // network でも 次の モデルを ためす（モデルの 名前が 消えて 閉じられた ときも 似た 形に なる）
    }
  }
  throw new VoiceFailure(last === "network" ? "network" : "model");
}

/** 1行を 作る。読み返しが 大きく ずれたら 1回だけ 作り直し、ずれの 小さい ほうを 使う。 */
async function generateLine(
  apiKey: string,
  voice: string | undefined,
  text: string,
  memo: { model?: string },
): Promise<Uint8Array> {
  const sendText = stripSpacing(text);
  const first = await speakWithFallback(apiKey, voice, sendText, memo);
  const check1 = readingDrift(text, first.transcript);
  if (check1.ok) return first.pcm;
  try {
    const second = await speakWithFallback(apiKey, voice, sendText, memo);
    const check2 = readingDrift(text, second.transcript);
    return check2.distance <= check1.distance ? second.pcm : first.pcm;
  } catch {
    return first.pcm;
  }
}

// ── 鳴らす ──────────────────────────────────────────────

function fakeMode(): boolean {
  return isDevTools && typeof window !== "undefined" && Boolean(window.__fakeLive);
}

function setPitchKeep(audio: HTMLAudioElement): void {
  const a = audio as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  a.preservesPitch = true;
  a.mozPreservesPitch = true;
  a.webkitPreservesPitch = true;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

function jaVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === "ja-jp") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("ja")) ??
    null
  );
}

export function createLineVoice(opts: LineVoiceOptions): LineVoice {
  const emit = (s: LineVoiceState) => opts.onState?.(s);
  const urls = new Map<number, string>();
  const inFlight = new Map<number, Promise<string>>();
  const memo: { model?: string } = {};
  let disposed = false;
  let browser = false;
  let rate = 1;
  let audio: HTMLAudioElement | null = null;
  /** いま 鳴らしている（または 待っている）play の おわらせ方。 */
  let current: { index: number; end: () => void } | null = null;
  let playSeq = 0;
  let fakeTimer: ReturnType<typeof setTimeout> | null = null;

  // ブラウザの 声は あとから 読みこまれる ことが ある
  synth()?.getVoices();

  const ensure = (index: number): Promise<string> => {
    const cached = urls.get(index);
    if (cached) return Promise.resolve(cached);
    const pending = inFlight.get(index);
    if (pending) return pending;
    const line = opts.lines[index];
    if (!line) return Promise.reject(new VoiceFailure("model"));
    if (!opts.apiKey.trim()) return Promise.reject(new VoiceFailure("noKey"));
    const job = generateLine(opts.apiKey, opts.voices[line.speaker], line.text, memo)
      .then((pcm) => {
        const url = URL.createObjectURL(pcmToWav(pcm));
        if (disposed) {
          URL.revokeObjectURL(url);
          throw new VoiceFailure("model");
        }
        urls.set(index, url);
        return url;
      })
      .catch((e: unknown) => {
        throw e instanceof VoiceFailure ? e : new VoiceFailure(voiceErrorOf(e));
      })
      .finally(() => {
        inFlight.delete(index);
      });
    inFlight.set(index, job);
    return job;
  };

  const endCurrent = () => {
    const c = current;
    current = null;
    if (fakeTimer) {
      clearTimeout(fakeTimer);
      fakeTimer = null;
    }
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    const s = synth();
    if (s && browser) s.cancel();
    c?.end();
  };

  const playFake = (index: number) =>
    new Promise<void>((resolve) => {
      emit({ index, status: "playing" });
      const finish = () => {
        emit({ index, status: "ended" });
        resolve();
      };
      current = { index, end: finish };
      fakeTimer = setTimeout(() => {
        fakeTimer = null;
        current = null;
        finish();
      }, FAKE_PLAY_MS);
    });

  const playBrowser = (index: number) =>
    new Promise<void>((resolve) => {
      const s = synth();
      const line = opts.lines[index];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (current?.index === index) current = null;
        emit({ index, status: "ended" });
        resolve();
      };
      if (!s || !line) {
        finish();
        return;
      }
      const u = new SpeechSynthesisUtterance(stripSpacing(line.text));
      u.lang = "ja-JP";
      const v = jaVoice();
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = finish;
      u.onerror = finish;
      current = { index, end: finish };
      emit({ index, status: "playing" });
      s.speak(u);
    });

  const playGemini = async (index: number, seq: number): Promise<void> => {
    let url = urls.get(index);
    if (!url) {
      emit({ index, status: "preparing" });
      // 作っている あいだに stop されたら、そこで おわる
      let cancelled = false;
      const waitCancel = new Promise<void>((resolve) => {
        current = {
          index,
          end: () => {
            cancelled = true;
            emit({ index, status: "ended" });
            resolve();
          },
        };
      });
      try {
        const got = await Promise.race([ensure(index), waitCancel.then(() => null)]);
        if (cancelled || got === null || seq !== playSeq || disposed) return;
        url = got;
      } catch (e) {
        if (seq !== playSeq || cancelled) return;
        current = null;
        const reason = e instanceof VoiceFailure ? e.reason : voiceErrorOf(e);
        emit({ index, status: "error", error: reason });
        throw new VoiceFailure(reason);
      }
    }
    const el = (audio ??= new Audio());
    setPitchKeep(el);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (current?.index === index) current = null;
        el.onended = null;
        el.onerror = null;
        emit({ index, status: "ended" });
        resolve();
      };
      current = { index, end: finish };
      el.onended = finish;
      el.onerror = finish;
      el.src = url;
      el.currentTime = 0;
      el.playbackRate = rate;
      emit({ index, status: "playing" });
      // 自動再生の 制限などで 鳴らせない ときは、おわった ことに する
      el.play().catch(finish);
    });
  };

  return {
    play(index, r) {
      if (disposed) return Promise.resolve();
      endCurrent();
      rate = r;
      playSeq += 1;
      const seq = playSeq;
      if (fakeMode()) return playFake(index);
      if (browser) return playBrowser(index);
      return playGemini(index, seq);
    },
    prefetch(index) {
      if (disposed || fakeMode() || browser) return;
      if (index < 0 || index >= opts.lines.length) return;
      if (urls.has(index) || inFlight.has(index) || !opts.apiKey.trim()) return;
      ensure(index).catch(() => undefined);
    },
    stop() {
      endCurrent();
    },
    setRate(r) {
      rate = r;
      if (audio) {
        audio.playbackRate = r;
        setPitchKeep(audio);
      }
      // ブラウザの 声は 話している 途中では 変えられない（次の 文から 効く）
    },
    useBrowserVoice(on) {
      if (browser !== on) endCurrent();
      browser = on;
    },
    hasBrowserVoice() {
      return jaVoice() !== null;
    },
    dispose() {
      endCurrent();
      disposed = true;
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      if (audio) {
        audio.removeAttribute("src");
        audio = null;
      }
    },
  };
}
