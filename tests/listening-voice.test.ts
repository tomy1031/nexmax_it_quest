import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFuriganaIndex } from "../src/lib/text/furigana";
import { pcmToWavBytes, SAMPLE_RATE } from "../src/lib/listening/wav";
import {
  createLineVoice,
  editDistance,
  readingDrift,
  stripSpacing,
  VoiceFailure,
  voiceErrorOf,
  type LineVoiceState,
} from "../src/lib/listening/voice";

describe("PCM → WAV", () => {
  it("44バイトの 頭（24kHz・16bit・モノラル）を 付ける", () => {
    const pcm = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const wav = pcmToWavBytes(pcm);
    const view = new DataView(wav.buffer);
    const ascii = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect(wav.length).toBe(50);
    expect(ascii(0)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(ascii(8)).toBe("WAVE");
    expect(ascii(12)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(SAMPLE_RATE * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
    expect([...wav.slice(44)]).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("読み返しの 見かた", () => {
  const index = buildFuriganaIndex([
    ["会議", "かいぎ"],
    ["始", "はじ"],
  ]);

  it("分かち書きの 空白を 取る（英数字の 間は 残す）", () => {
    expect(stripSpacing("会議は 10時に 始まります。")).toBe("会議は10時に始まります。");
    expect(stripSpacing("IT company です")).toBe("IT companyです");
  });

  it("編集距離", () => {
    expect(editDistance("かいぎ", "かいぎ")).toBe(0);
    expect(editDistance("かいぎ", "かいき")).toBe(1);
    expect(editDistance("", "あいう")).toBe(3);
  });

  it("漢字と かなの ちがい・カタカナ・記号は ずれに しない", () => {
    const r = readingDrift("会議が 始まります。", "かいぎがハジマリマス", index);
    expect(r.ok).toBe(true);
    expect(r.distance).toBe(0);
  });

  it("2字 までの ずれは よい", () => {
    expect(readingDrift("会議が 始まります。", "かいぎは はじまります", index).ok).toBe(true);
  });

  it("答えて しまった・言いかえた ときは ずれと 見る", () => {
    const r = readingDrift("会議が 始まります。", "はいわかりましたすぐいきます", index);
    expect(r.ok).toBe(false);
  });

  it("長い 文は 20% まで よい", () => {
    const expected = "あいうえおかきくけこさしすせそたちつてと"; // 20字
    expect(readingDrift(expected, "あいうえおかきくけこさしすせそたちつ", index).ok).toBe(true); // 2字
    expect(readingDrift(expected, "あいうえおかきくけこさしすせそ", index).ok).toBe(false); // 5字 > 4
  });

  it("文字起こしが 空なら 見られないので よい", () => {
    expect(readingDrift("会議", "", index).ok).toBe(true);
  });
});

describe("失敗の 理由", () => {
  it("キー・ネットワーク・モデルに 分ける", () => {
    expect(voiceErrorOf(new VoiceFailure("noKey"))).toBe("noKey");
    expect(voiceErrorOf(new Error("API key not valid. API_KEY_INVALID"))).toBe("key");
    expect(voiceErrorOf({ code: 1008, reason: "PERMISSION_DENIED" })).toBe("key");
    expect(voiceErrorOf(new Error("status 403"))).toBe("key");
    expect(voiceErrorOf(new TypeError("Failed to fetch"))).toBe("network");
    expect(voiceErrorOf({ code: 1008, reason: "models/x is not found" })).toBe("model");
    expect(voiceErrorOf(new Error("timeout"))).toBe("model");
  });
});

describe("にせの 声（e2e）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { __fakeLive: { answers: [] } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const lines = [
    { speaker: "hendy", text: "a" },
    { speaker: "hendy", text: "b" },
  ];

  it("つながずに 250ms ほどで 鳴りおわる", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const states: LineVoiceState[] = [];
    const voice = createLineVoice({
      lines,
      voices: { hendy: "Puck" },
      apiKey: "",
      onState: (s) => states.push(s),
    });
    voice.prefetch(1);
    let done = false;
    const p = voice.play(0, 1).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(done).toBe(true);
    expect(states).toEqual([
      { index: 0, status: "playing" },
      { index: 0, status: "ended" },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    voice.dispose();
  });

  it("stop で すぐ おわる", async () => {
    const voice = createLineVoice({ lines, voices: {}, apiKey: "" });
    const p = voice.play(1, 0.8);
    voice.stop();
    await expect(p).resolves.toBeUndefined();
    voice.dispose();
  });
});

describe("キーが ない", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("noKey で 失敗し、error を 知らせる", async () => {
    vi.stubGlobal("window", {});
    const states: LineVoiceState[] = [];
    const voice = createLineVoice({
      lines: [{ speaker: "hendy", text: "a" }],
      voices: {},
      apiKey: "  ",
      onState: (s) => states.push(s),
    });
    await expect(voice.play(0, 1)).rejects.toMatchObject({ reason: "noKey" });
    expect(states.at(-1)).toEqual({ index: 0, status: "error", error: "noKey" });
    expect(voice.hasBrowserVoice()).toBe(false);
    voice.dispose();
  });
});
