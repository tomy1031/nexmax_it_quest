import type { Expression } from "@/three/chibi";

/**
 * セリフの文から表情を決める（台本に表情を書かなくても、文の形で変わる）。
 * 「あっ」「えっ」「あれ？」→ びっくり、「？」「……」→ 考える、「！」→ にこにこ。
 */
export function expressionOf(text: string): Expression {
  const s = text.trim();
  if (/^(\u3042\u3063|\u3048\u3063|\u3042\u308c)/.test(s) || s.includes("\uff01\uff1f"))
    return "surprised";
  if (s.includes("\uff1f") || s.includes("\u2026\u2026")) return "thinking";
  if (s.includes("\uff01")) return "happy";
  return "normal";
}
