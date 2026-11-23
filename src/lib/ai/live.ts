/**
 * Gemini Live と 声で 話す（第2章の 受付・ヘンディさんとの 会話）。
 * tomy さん 2026-11-23「ここからはGeminiLiveを利用した会話を行います。…マイクをつかって答えます」
 *
 * 作りは 姉妹アプリ academy（src/components/meeting/use-live-voice.ts）と そろえる:
 * - キーは 使う人の 端末にだけ ある（AGENTS.md 必ず守るルール4）。その キーで、端末の中で
 *   「1回だけ・30分で 切れる 接続キー」を 作って つなぐ（作れない キーのときだけ キーで 直接 つなぐ）。
 * - 送る 音は 16kHz・16bit・モノラル。返る 音は 24kHz。
 * - 区切りは こちらで 決める（自動の 声の 検出を 切る）。押している あいだ／もう一度 押すまで が 1回の 発言。
 * - モデルは 上から 順に ためす（preview の 名前は 消えることが ある）。
 *
 * テスト（e2e）では マイクも キーも 使えないので、開発の道具（window.__fakeLive）があるときは
 * にせの 相手（live-fake.ts）に つなぐ。
 */
import type { GoogleGenAI as GoogleGenAIType, Session } from "@google/genai";
import { isDevTools } from "@/lib/env";
import { openFakeLive, type FakeLiveScript } from "@/lib/ai/live-fake";

/** 返事の 声（つなぐ モデル）。上から ためす。academy の LIVE_TALK_MODELS と 同じ 並び。 */
export const LIVE_MODELS = [
  "gemini-3.8-live",
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
] as const;

const IN_RATE = 16_000;
const OUT_RATE = 24_000;
const SETUP_TIMEOUT_MS = 9_000;
const AUTH_TOKENS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

export type LiveEvent =
  /** 自分が 話した ことの 文字（細切れで 届く）。 */
  | { type: "heard"; text: string }
  /** 相手が 話した ことの 文字（細切れで 届く）。 */
  | { type: "said"; text: string }
  /** 相手が 話し おわった（1つの 返事の おわり）。 */
  | { type: "turn" }
  /** 相手の 声が 鳴っているか。 */
  | { type: "speaking"; on: boolean }
  /** つなぎが 切れた。 */
  | { type: "closed" };

export interface LiveConn {
  /** 話しはじめる（ここから 音を 送る）。 */
  talkStart(): void;
  /** 話しおわる（ここで 相手が 返事を 作りはじめる）。 */
  talkEnd(): void;
  /** 進行の 合図を 文字で 送る（学生の ことばでは ないので 字幕に 出さない）。 */
  prompt(text: string): void;
  /** 鳴っている 声を 止める。 */
  hush(): void;
  close(): void;
}

export type LiveFailReason = "noKey" | "noMic" | "key" | "model" | "network";

export class LiveError extends Error {
  constructor(readonly reason: LiveFailReason) {
    super(reason);
  }
}

export interface LiveOptions {
  apiKey: string;
  /** 相手の 役（指示文）。 */
  system: string;
  /** 相手の 声（Gemini の 声の 名前）。ヘンディさんは academy と 同じ Puck。 */
  voice?: string;
  onEvent: (e: LiveEvent) => void;
}

declare global {
  interface Window {
    /** e2e の テストが 置く、にせの 相手の 台本。 */
    __fakeLive?: FakeLiveScript;
  }
}

export async function openLive(opts: LiveOptions): Promise<LiveConn> {
  if (isDevTools && typeof window !== "undefined" && window.__fakeLive) {
    return openFakeLive(window.__fakeLive, opts.onEvent);
  }
  if (!opts.apiKey.trim()) throw new LiveError("noKey");

  // 1. マイク（はじめに 聞く。だめなら つながない）
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new LiveError("noMic");
  }

  // 2. 声を 鳴らす 所（ボタンを 押した ときに 作るので、自動再生の 制限に かからない）
  const out = new AudioContext();
  if (out.state === "suspended") await out.resume().catch(() => undefined);
  const player = makePlayer(out, opts.onEvent);

  // 3. モデルを 上から ためす
  const { GoogleGenAI, Modality } = await import("@google/genai");
  let session: Session | null = null;
  let lastReason: LiveFailReason = "model";
  let closedByUs = false;
  for (const model of LIVE_MODELS) {
    const auth = await mintAuth(opts.apiKey);
    if (!auth.ok) {
      lastReason = auth.reason;
      if (auth.reason === "key" || auth.reason === "network") break;
      continue;
    }
    const ai: GoogleGenAIType = new GoogleGenAI({ apiKey: auth.auth, apiVersion: "v1beta" });
    let ready = false;
    // 待ちきれずに あきらめた つなぎ（あとから 開いても 使わない・閉じる）
    let abandoned = false;
    try {
      const connecting: Promise<Session> = ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: opts.system,
          // 学生の 声は 日本語として 文字にする（academy 2026-10-14。書かないと 韓国語の 字で 返ることが あった）
          inputAudioTranscription: { languageCodes: ["ja-JP"] } as object,
          outputAudioTranscription: {},
          // 1回 押す ＝ 1つの 発言（自動の 検出を 切る。academy 2026-08-20）
          realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
          speechConfig: {
            languageCode: "ja-JP",
            ...(opts.voice
              ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } } }
              : {}),
          },
        },
        callbacks: {
          onmessage: (message: unknown) => {
            if (abandoned) return;
            handleMessage(message, opts.onEvent, player);
          },
          onclose: () => {
            if (ready && !abandoned && !closedByUs) opts.onEvent({ type: "closed" });
          },
          onerror: () => undefined,
        },
      });
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("timeout")), SETUP_TIMEOUT_MS),
      );
      // 待ちきれずに あきらめた あとで 開いたら、すぐ 閉じる
      connecting.then(
        (late) => {
          if (abandoned) late.close();
        },
        () => undefined,
      );
      session = await Promise.race([connecting, timeout]);
      ready = true;
      break;
    } catch {
      abandoned = true;
      lastReason = "model";
      session = null;
    }
  }
  if (!session) {
    stream.getTracks().forEach((tr) => tr.stop());
    void out.close();
    throw new LiveError(lastReason);
  }

  // 4. マイク → 16kHz の PCM → 送る（押している あいだだけ）
  let talking = false;
  const live = session;
  const capture = await startMicCapture(stream, (pcm) => {
    if (!talking) return;
    live.sendRealtimeInput({
      audio: {
        data: bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)),
        mimeType: `audio/pcm;rate=${IN_RATE}`,
      },
    });
  });

  return {
    talkStart() {
      if (talking) return;
      // 相手が 話している ときに マイクを 開けると、スピーカーの 音が 回りこむので 止める
      player.clear();
      void out.resume();
      talking = true;
      live.sendRealtimeInput({ activityStart: {} });
    },
    talkEnd() {
      if (!talking) return;
      talking = false;
      live.sendRealtimeInput({ activityEnd: {} });
    },
    prompt(text: string) {
      live.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
    },
    hush() {
      player.clear();
    },
    close() {
      closedByUs = true;
      talking = false;
      capture.stop();
      stream.getTracks().forEach((tr) => tr.stop());
      player.clear();
      try {
        live.close();
      } catch {
        // もう 閉じている
      }
      void out.close();
    },
  };
}

// ── 接続キー ──────────────────────────────────────────

type Auth = { ok: true; auth: string } | { ok: false; reason: LiveFailReason };

/** 本人の キーで、1回だけ・30分で 切れる 接続キーを 作る。作れない キー（400）のときは キーで 直接 つなぐ。 */
async function mintAuth(apiKey: string, now = new Date()): Promise<Auth> {
  const expireTime = new Date(now.getTime() + 30 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now.getTime() + 2 * 60_000).toISOString();
  let res: Response;
  try {
    res = await fetch(AUTH_TOKENS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.status === 400) {
    // キーが まちがっている（API_KEY_INVALID）なら そう伝える。それ以外の 400 は、接続キーを 作れない 形の キー
    // （新しい 形の キーで 起きる。academy）なので、キーで 直接 つなぐ
    const body = await res.text().catch(() => "");
    if (body.includes("API_KEY_INVALID")) return { ok: false, reason: "key" };
    return { ok: true, auth: apiKey };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "key" };
  if (!res.ok) return { ok: false, reason: res.status === 429 ? "key" : "network" };
  const data = (await res.json().catch(() => null)) as { name?: string } | null;
  return data?.name ? { ok: true, auth: data.name } : { ok: false, reason: "network" };
}

// ── 届いた ものを 読む ──────────────────────────────────

interface Player {
  play(pcm: Uint8Array): void;
  clear(): void;
}

function handleMessage(message: unknown, emit: (e: LiveEvent) => void, player: Player): void {
  if (!message || typeof message !== "object") return;
  const content = (message as { serverContent?: Record<string, unknown> }).serverContent;
  if (!content) return;
  const input = content.inputTranscription as { text?: string } | undefined;
  if (input?.text) emit({ type: "heard", text: input.text });
  const output = content.outputTranscription as { text?: string } | undefined;
  if (output?.text) emit({ type: "said", text: output.text });
  const parts = (content.modelTurn as { parts?: { inlineData?: { data?: string } }[] } | undefined)
    ?.parts;
  for (const p of parts ?? [])
    if (p.inlineData?.data) player.play(base64ToBytes(p.inlineData.data));
  if (content.interrupted === true) player.clear();
  if (content.turnComplete === true) emit({ type: "turn" });
}

/** 届いた 声の かけらを、前の 音の おわりに 継いで 鳴らす。 */
function makePlayer(ctx: AudioContext, emit: (e: LiveEvent) => void): Player {
  let sources: AudioBufferSourceNode[] = [];
  let playAt = 0;
  let busy = false;
  const setBusy = (on: boolean) => {
    if (busy === on) return;
    busy = on;
    emit({ type: "speaking", on });
  };
  return {
    play(pcm) {
      if (ctx.state === "suspended") void ctx.resume();
      const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
      const buffer = ctx.createBuffer(1, samples.length, OUT_RATE);
      const ch = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) ch[i] = samples[i]! / 0x8000;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const at = Math.max(ctx.currentTime, playAt);
      src.start(at);
      playAt = at + buffer.duration;
      sources.push(src);
      setBusy(true);
      src.onended = () => {
        sources = sources.filter((s) => s !== src);
        if (sources.length === 0) setBusy(false);
      };
    },
    clear() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // もう 鳴りおわった
        }
      }
      sources = [];
      playAt = 0;
      setBusy(false);
    },
  };
}

// ── マイク ──────────────────────────────────────────

/**
 * マイク → 16kHz・16bit の PCM。ブラウザの 本当の サンプリングレートを 読んで、こちらで 落とす
 * （AudioContext に 16000 を 頼んでも 守らない ブラウザが ある。academy の mic-capture.ts）。
 * AudioWorklet は 音の スレッドで 動くので、画面が いそがしくても 音が 落ちない。
 */
const WORKLET_SOURCE = `
class PcmPump extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = options.processorOptions.inRate / options.processorOptions.outRate;
    this.frame = options.processorOptions.frame;
    this.buffer = new Float32Array(0);
    this.out = new Int16Array(this.frame);
    this.filled = 0;
    this.position = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    const merged = new Float32Array(this.buffer.length + input.length);
    merged.set(this.buffer, 0);
    merged.set(input, this.buffer.length);
    let at = this.position;
    while (at < merged.length - 1) {
      const index = Math.floor(at);
      const fraction = at - index;
      const sample = merged[index] * (1 - fraction) + merged[index + 1] * fraction;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.out[this.filled] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.filled += 1;
      if (this.filled === this.frame) {
        const copy = this.out.slice(0);
        this.port.postMessage(copy.buffer, [copy.buffer]);
        this.filled = 0;
      }
      at += this.ratio;
    }
    const keep = Math.floor(at);
    this.buffer = merged.slice(keep);
    this.position = at - keep;
    return true;
  }
}
registerProcessor("pcm-pump", PcmPump);
`;

async function startMicCapture(
  stream: MediaStream,
  onChunk: (pcm: Int16Array) => void,
): Promise<{ stop: () => void }> {
  const ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  const source = ctx.createMediaStreamSource(stream);
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "text/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const node = new AudioWorkletNode(ctx, "pcm-pump", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: { inRate: ctx.sampleRate, outRate: IN_RATE, frame: 2048 },
  });
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(new Int16Array(e.data));
  source.connect(node);
  return {
    stop: () => {
      node.port.onmessage = null;
      node.disconnect();
      source.disconnect();
      void ctx.close();
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}
