/**
 * 学生が自分の Gemini の API キーをためす（設定の画面）。
 *
 * academy と同じく、学生の道で叩くのは「短い時間だけ使える接続キー（auth_tokens）」の発行だけ。
 * generateContent や ListModels は使わない（無料の枠を別に減らすため。academy 2026-08-27）。
 * できた接続キーは使わずに捨てる（1回きり・30分で切れる）。
 */
const AUTH_TOKENS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

export type KeyCheckResult =
  { ok: true } | { ok: false; reason: "empty" | "rejected" | "network" | "rateLimited" };

export async function checkGeminiKey(apiKey: string, now = new Date()): Promise<KeyCheckResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, reason: "empty" };
  const expireTime = new Date(now.getTime() + 30 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now.getTime() + 2 * 60_000).toISOString();
  let res: Response;
  try {
    res = await fetch(AUTH_TOKENS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.status === 429) return { ok: false, reason: "rateLimited" };
  if (!res.ok) return { ok: false, reason: "rejected" };
  const data = (await res.json().catch(() => null)) as { name?: string } | null;
  return data?.name ? { ok: true } : { ok: false, reason: "rejected" };
}
