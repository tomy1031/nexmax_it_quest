import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * ステージ2「配属：お客さまと ミーティング！」を 最初から 修了証まで 通す（docs/design/03_ステージ2.md §8）。
 * - チーム（2人）→ ヘンディさんに あいさつ → NMChat → 会議室A → 山本社長に あいさつ（1回 まちがえる）→ おじぎ → 席
 *   → リスニング → コツの 5問（1回 まちがえる）→ 質問（新しい・もう 聞いた・短い・ボーナス・相談中 …）→ 結果 → お礼 → 修了証
 * - 声の 会話は にせの 相手（src/lib/ai/live-fake.ts。window.__fakeLive）。3D の クリックは window.__quest.emit で 合図を 送る
 *   （ホワイトボードの カードは 1回だけ 本当に 3D を クリックする）。
 */

const SHOTS = "e2e-screens";
mkdirSync(SHOTS, { recursive: true });

type Play = {
  sectionId: string;
  line: { text: string } | null;
  verdict: { ok: boolean } | null;
  tip: string | null;
  choice: unknown;
  panel: { id: string; mode?: string } | null;
  waitingFor: string | null;
  chapterBanner: number | null;
  memos: { id: string; text: string }[];
};

const play = (page: Page) =>
  page.evaluate(() => (window as unknown as { __quest: { play: () => Play } }).__quest.play());
const quest = (page: Page, fn: string, arg?: unknown) =>
  page.evaluate(
    ([f, a]) =>
      (window as unknown as { __quest: Record<string, (x?: unknown) => void> }).__quest[
        f as string
      ]?.(a),
    [fn, arg] as const,
  );
const fakeLive = (page: Page, answers: string[]) =>
  page.evaluate((a) => {
    (window as unknown as { __fakeLive: unknown }).__fakeLive = { answers: a };
  }, answers);

/** 質問の 時間で 言う こと（2人で 交代。① 自分 ② ソピア ③ 自分 …）。 */
const QUESTIONS: { say: string; card?: string; expect: string; shot?: string; board?: boolean }[] =
  [
    { say: "給料はいくらですか", card: "pay", expect: "new", shot: "q1-new" },
    { say: "新しい店はどこですか", expect: "known", shot: "q2-known" },
    { say: "いつ", expect: "unclear", shot: "q3-unclear" },
    { say: "ページの予算はいくらですか", card: "budget", board: true, expect: "new" },
    { say: "なぜプノンペンに店を出しますか", expect: "bonus", shot: "q5-bonus" },
    { say: "写真はありますか", expect: "undecided" },
    { say: "このページの目的は何ですか", card: "purpose", expect: "new" },
    { say: "茶道の先生はどんな仕事をしますか", expect: "new" },
    { say: "応募の条件は何ですか", expect: "new" },
    { say: "いつから働きますか", expect: "new" },
    { say: "ページはいつまでに作りますか", expect: "new", shot: "q11-last" },
  ];

/** ホワイトボードの カードの まん中（3D の 座標。src/stages/stage2/Whiteboard.tsx の 並びと 同じ）。 */
function boardCardWorld(index: number): [number, number, number] {
  const BW = 3.2;
  const BH = 1.7;
  const w = BW * 400;
  const h = BH * 400;
  const gap = w * 0.012;
  const cw = (w * 0.6 - gap * 3) / 4;
  const ch = (h * 0.77 - gap) / 2;
  const px = w * 0.385 + (index % 4) * (cw + gap) + cw / 2;
  const py = h * 0.19 + Math.floor(index / 4) * (ch + gap) + ch * 0.6;
  return [-0.8 - BW / 2 + px / 400, 1.6 + BH / 2 - py / 400, -3.47 + 0.01];
}
const CARD_ORDER = ["purpose", "job1", "job2", "cond", "start", "pay", "budget", "deadline"];

async function runMeeting(page: Page) {
  // コツ
  await expect(page.getByTestId("meeting-tips")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/s2-meeting-tips.png` });
  await page.getByTestId("meeting-lesson-go").click();
  // これは いい 質問ですか（1問目は わざと まちがえる: 山田さんの「新しい 店は どこですか。」に 👍）
  for (let i = 0; i < 5; i += 1) {
    await expect(page.getByTestId("meeting-quiz")).toBeVisible();
    const text = (await page.getByTestId("meeting-quiz-text").innerText()).replace(/\s/g, "");
    const good = /いつまで|給料/.test(text);
    const pick = i === 0 ? "good" : good ? "good" : "bad";
    await page.getByTestId(`meeting-quiz-${pick}`).click();
    await page.waitForTimeout(250);
    if (i === 0) {
      await expect(page.getByTestId("meeting-quiz-verdict")).toHaveAttribute("data-ok", "false");
      await page.screenshot({ path: `${SHOTS}/s2-meeting-quiz-wrong.png` });
    } else {
      await expect(page.getByTestId("meeting-quiz-verdict")).toHaveAttribute("data-ok", "true");
      if (i === 2) await page.screenshot({ path: `${SHOTS}/s2-meeting-quiz-right.png` });
    }
    await page.getByTestId("meeting-quiz-next").click();
  }

  // 質問
  await fakeLive(
    page,
    QUESTIONS.map((q) => q.say),
  );
  await expect(page.getByTestId("meeting-panel")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/s2-meeting-start.png` });
  await page.getByTestId("meeting-start").click();
  const mic = page.getByTestId("meeting-mic");
  await expect(mic).toBeEnabled({ timeout: 10000 });
  await page.waitForTimeout(600);

  for (const [i, q] of QUESTIONS.entries()) {
    if (q.card) {
      if (q.board) {
        // ホワイトボード（3D）の カードを 押して えらぶ
        const at = await page.evaluate(
          (p) =>
            (
              window as unknown as {
                __quest: { project: (x: number, y: number, z: number) => { x: number; y: number } };
              }
            ).__quest.project(p[0], p[1], p[2]),
          boardCardWorld(CARD_ORDER.indexOf(q.card)),
        );
        await page.mouse.click(at.x, at.y);
        await page.waitForTimeout(500);
        const topic = await page.getByTestId("meeting-topic").innerText();
        if (!topic.includes("予算")) await page.getByTestId(`meeting-card-${q.card}`).click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SHOTS}/s2-meeting-board-pick.png` });
      } else {
        await page.getByTestId(`meeting-card-${q.card}`).click();
      }
      if (i === 0) {
        for (let h = 1; h <= 3; h += 1) {
          await page.getByTestId("meeting-hint").click();
          await page.waitForTimeout(200);
          await page.screenshot({ path: `${SHOTS}/s2-meeting-hint-${h}.png` });
        }
      }
    }
    const before = await page.getByTestId("meeting-feedback").count();
    await expect(mic).toBeEnabled({ timeout: 10000 });
    await mic.click();
    await page.waitForTimeout(250);
    await mic.click();
    await expect
      .poll(() => page.getByTestId("meeting-feedback").count(), { timeout: 15000 })
      .toBeGreaterThan(before);
    await expect(page.getByTestId("meeting-last")).toHaveAttribute("data-result", q.expect);
    await page.waitForTimeout(900);
    if (q.shot) await page.screenshot({ path: `${SHOTS}/s2-meeting-${q.shot}.png` });
  }

  await page.getByTestId("meeting-show-result").click();
  await expect(page.getByTestId("meeting-result")).toBeVisible();
  await expect(page.getByTestId("meeting-stars")).toHaveAttribute("data-stars", "2");
  await expect(page.getByTestId("meeting-missed")).toHaveAttribute("data-missed", "job2");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/s2-meeting-result.png` });
  await page.getByTestId("meeting-next").click();
}

test("ステージ2を チーム（2人）で 最初から 修了証まで 通す", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(() => {
    const names = ["ソピア", "ダラ", "チャンナ"];
    (window as unknown as { __fakeClassmates: unknown }).__fakeClassmates = names.map((n, i) => ({
      id: `e2e-${i}`,
      name: n,
      gender: i % 2 === 0 ? "female" : "male",
      avatar: null,
    }));
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "nexmax-it-quest:settings",
      JSON.stringify({ state: { sound: false, furigana: true, quality: "normal" }, version: 1 }),
    );
    const raw = localStorage.getItem("nexmax-it-quest:game");
    const g = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    g.state.profile = { name: "ソク ピセット", nickname: "ソク", hasPhoto: false };
    localStorage.setItem("nexmax-it-quest:game", JSON.stringify(g));
  });

  // ステージ選択（ステージ1を クリアする 前は 2は 開かない。開発の ?unlock=1 で 開く）
  await page.goto("/stages");
  await page.getByTestId("stage-tab-2").click();
  await expect(page.getByTestId("stage-card-2")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("stage2-start")).toBeDisabled();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/s2-stages-locked.png` });
  await page.goto("/stages?unlock=1");
  await page.getByTestId("stage-tab-2").click();
  await expect(page.getByTestId("stage2-start")).toBeEnabled();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/s2-stages-unlocked.png` });

  await page.goto("/stage/stage2?fast=1");
  await page.waitForFunction(() => Boolean((window as unknown as { __quest?: unknown }).__quest));

  const seen = new Set<string>();
  let lastSection = "";
  let greetWrong = false;
  const deadline = Date.now() + 9 * 60 * 1000;

  while (Date.now() < deadline) {
    const p = await play(page);
    if (p.sectionId && p.sectionId !== lastSection && !p.chapterBanner) {
      lastSection = p.sectionId;
      await page
        .waitForFunction(
          () => {
            const s = (
              window as unknown as { __quest?: { play: () => Record<string, unknown> } }
            ).__quest?.play();
            return Boolean(s && (s.line || s.objective || s.panel || s.focus));
          },
          undefined,
          { timeout: 20000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SHOTS}/s2-stage-${p.sectionId}.png` });
      continue;
    }
    if (p.panel) {
      await page.waitForTimeout(500);
      if (!seen.has(`panel-${p.panel.id}-${p.panel.mode}`)) {
        seen.add(`panel-${p.panel.id}-${p.panel.mode}`);
        await page.screenshot({
          path: `${SHOTS}/s2-panel-${p.panel.id}-${p.panel.mode ?? ""}.png`,
        });
      }
      switch (p.panel.id) {
        case "nmchat":
          await page.getByTestId("channel-aoba-project").click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/s2-panel-nmchat-aoba.png` });
          await page.getByTestId("nmchat-close").click();
          break;
        case "team":
          await page.getByTestId("team-multi").click();
          await page.getByTestId("team-pick-e2e-0").click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/s2-panel-team-picked.png` });
          await page.getByTestId("team-done").click();
          break;
        case "listening": {
          // ヘンディさんと 山本社長の 話（content/listenings/aoba-kickoff.json）。声は にせ
          await page.evaluate(() => {
            const w = window as unknown as { __fakeLive?: unknown };
            w.__fakeLive ??= { answers: [] };
          });
          await expect(page.getByTestId("listen-intro")).toBeVisible();
          await page.getByTestId("listen-start").click();
          await page.waitForTimeout(700);
          await page.screenshot({ path: `${SHOTS}/s2-listen-01.png` });
          const input = page.getByTestId("listen-input");
          for (const w of [
            "プノンペン",
            "採用ページ",
            "ぼしゅう",
            "二人",
            "茶道",
            "てんちょう",
            "カンボジア",
            "応募",
            "新しい",
            "店",
            "働く",
            "人",
            "ページ",
          ]) {
            await input.fill(w);
            await page.getByTestId("listen-submit").click();
            await page.waitForTimeout(120);
            if (await page.getByTestId("listen-review").isEnabled()) break;
          }
          await page.screenshot({ path: `${SHOTS}/s2-listen-02-goal.png` });
          await expect(page.getByTestId("listen-review")).toBeEnabled();
          await page.getByTestId("listen-review").click();
          while (await page.getByTestId("listen-review-forward").isEnabled()) {
            await page.getByTestId("listen-review-forward").click();
            await page.waitForTimeout(60);
          }
          await page.getByTestId("listen-to-works").click();
          // ワーク: わかった ことを ホワイトボードの 所に 置く（わざと 1回 まちがえる）
          await expect(page.getByTestId("listen-work-sort")).toBeVisible();
          await page.getByTestId("sort-card-who").click();
          await page.getByTestId("sort-slot-where").click();
          await expect(page.getByTestId("work-ng")).toBeVisible();
          await page.screenshot({ path: `${SHOTS}/s2-listen-03-sort-ng.png` });
          for (const id of ["where", "who", "kind", "goal"]) {
            await page.getByTestId(`sort-card-${id}`).click();
            await page.getByTestId(`sort-slot-${id}`).click();
            await page.waitForTimeout(80);
          }
          await page.screenshot({ path: `${SHOTS}/s2-listen-04-sort-done.png` });
          await page.getByTestId("work-next").click();
          await expect(page.getByTestId("listening-panel")).toHaveCount(0);
          break;
        }
        case "meeting":
          await runMeeting(page);
          break;
        case "talk": {
          const answers =
            p.panel.mode === "morning"
              ? ["おはようございます"]
              : p.panel.mode === "yamamoto-greet"
                ? [
                    "こんにちは",
                    "はじめまして。ネクストメイクのソクピセットと申します。よろしくお願いいたします。",
                  ]
                : ["本日はありがとうございました。会社で整理して、また、ご連絡します。"];
          await fakeLive(page, answers);
          await page.getByTestId("talk-start").click();
          for (let i = 0; i < 30; i += 1) {
            await page.waitForTimeout(500);
            if (await page.getByTestId("talk-next").isVisible()) break;
            const mic = page.getByTestId("talk-mic");
            if ((await mic.isVisible()) && (await mic.isEnabled())) {
              await mic.click();
              await page.waitForTimeout(300);
              await mic.click();
              await page.waitForTimeout(900);
              if (p.panel.mode === "yamamoto-greet" && !greetWrong) {
                greetWrong = true;
                await expect(page.getByTestId("talk-retry")).toBeVisible();
                await page.screenshot({ path: `${SHOTS}/s2-talk-greet-retry.png` });
              }
            }
          }
          await page.screenshot({ path: `${SHOTS}/s2-talk-${p.panel.mode}-done.png` });
          await page.getByTestId("talk-next").click();
          break;
        }
        case "certificate": {
          const memo = p.memos.find((x) => x.id === "aoba-heard");
          expect(memo?.text).toContain("給料");
          await page.waitForTimeout(800);
          await expect(page.getByTestId("certificate")).toContainText("contract development");
          await page.screenshot({ path: `${SHOTS}/s2-zz-certificate.png` });
          await page.getByTestId("cert-close").click();
          await page.waitForURL("**/stages");
          await expect(page.getByTestId("stage-card-2")).toContainText("クリア");
          await page.waitForTimeout(1500);
          await page.screenshot({ path: `${SHOTS}/s2-zz-stages-cleared.png` });
          expect(errors).toEqual([]);
          return;
        }
      }
      await page.waitForTimeout(300);
      continue;
    }
    if (p.tip) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/s2-tip-${p.tip}.png` });
      await page.getByTestId("tip-close").click();
      continue;
    }
    if (p.verdict || p.line) {
      const key = `line-${p.sectionId}-${p.line?.text ?? ""}`;
      if (!seen.has(key) && /山本|ホワイトボード|はじめまして/.test(p.line?.text ?? "")) {
        seen.add(key);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SHOTS}/s2-line-${seen.size}.png` });
      }
      await quest(page, "advance");
      await page.waitForTimeout(60);
      continue;
    }
    if (p.waitingFor) {
      const w = p.waitingFor;
      if (w === "emote:bow") {
        await page.screenshot({ path: `${SHOTS}/s2-emote-bow-${p.sectionId}.png` });
        await page.getByTestId("emote-bow").click();
        await page.waitForTimeout(1600);
        continue;
      }
      if (!seen.has(`wait-${w}`)) {
        seen.add(`wait-${w}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/s2-wait-${w.replace(":", "-")}.png` });
      }
      await quest(page, "emit", w);
      await page.waitForTimeout(200);
      continue;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`時間切れ: 最後の場面 ${lastSection}`);
});
