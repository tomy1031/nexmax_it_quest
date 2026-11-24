/**
 * PCM → WAV（リスニングの 声。academy の src/lib/audio/wav.ts から 移した）。
 *
 * Gemini Live が 返すのは 24kHz・16bit・モノラルの 生の PCM。<audio> は そのままでは
 * 鳴らせないので、WAV の 頭（44バイト）を 付ける。
 */

/** Gemini Live の 出力の 形。ここを 変えると 音が 半分の 速さに なったりする。 */
export const SAMPLE_RATE = 24_000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

/** 生の PCM に WAV の 頭を 付けた バイト列。 */
export function pcmToWavBytes(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const byteRate = sampleRate * CHANNELS * BYTES_PER_SAMPLE;
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt の かたまりの 長さ
  view.setUint16(20, 1, true); // 1 = 圧縮なしの PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** 生の PCM を、<audio> で 鳴らせる WAV の Blob に する。 */
export function pcmToWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Blob {
  return new Blob([pcmToWavBytes(pcm, sampleRate) as BlobPart], { type: "audio/wav" });
}

/** かけらを 1本に つなぐ。 */
export function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** base64（Live の inlineData）を バイト列に。 */
export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}
