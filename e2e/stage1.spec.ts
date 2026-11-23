import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * ステージ1を最初から最後まで通す。
 * - タイトル → 設定（名前・ニックネーム）→ スタート → ダイブ → ステージ選択 → ステージ1
 * - 台本の待ち（クリック・到着）は、3D の画素をクリックする代わりに window.__quest.emit で合図を送る
 *   （ソフトウェアの描画は遅く、場所がずれやすいため。Fable 5.2 のレビュー）。画面の部品（NMChat・路線図・メモ・連絡）は本物をクリックする。
 * - まちがえる道（谷町線の改札・反対の電車・電話に出る）も1回ずつ通る。
 */

const SHOTS = "e2e-screens";
mkdirSync(SHOTS, { recursive: true });

type Play = {
  sectionId: string;
  scene: string | null;
  line: { text: string } | null;
  verdict: { ok: boolean } | null;
  dream: unknown[] | null;
  tip: string | null;
  choice: { options: string[] } | null;
  panel: { id: string } | null;
  waitingFor: string | null;
  chapterBanner: number | null;
  ended: boolean;
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

test("ステージ1を最初から修了証まで通す", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByTestId("title-start")).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/01-title-locked.png` });

  await page.getByTestId("title-settings").click();
  await page.getByTestId("settings-name").fill("ソク ピセット");
  await page.getByTestId("settings-nickname").fill("ソク");
  await expect(page.getByTestId("settings-status")).toContainText("スタート");
  await page.screenshot({ path: `${SHOTS}/02-settings.png` });

  await page.goto("/");
  await expect(page.getByTestId("title-start")).toBeEnabled();
  await page.evaluate(() => {
    const raw = localStorage.getItem("nexmax-it-quest:settings");
    const s = raw ? JSON.parse(raw) : { state: {}, version: 1 };
    s.state.sound = false;
    localStorage.setItem("nexmax-it-quest:settings", JSON.stringify(s));
  });
  await page.screenshot({ path: `${SHOTS}/03-title-ready.png` });
  await page.getByTestId("title-start").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/04-dive.png` });
  await page.waitForURL("**/stages", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/05-stages.png` });

  await page.goto("/stage/stage1?fast=1");
  await page.waitForFunction(() => Boolean((window as unknown as { __quest?: unknown }).__quest));

  const seen = new Set<string>();
  const wrongDone = new Set<string>();
  let lastSection = "";
  const deadline = Date.now() + 7 * 60 * 1000;

  while (Date.now() < deadline) {
    const p = await play(page);
    if (p.sectionId && p.sectionId !== lastSection && !p.chapterBanner) {
      lastSection = p.sectionId;
      // 場面の 3D の読みこみが終わり、台本が動き出してから写真をとる（読みこみ中の写真にしない）
      await page
        .waitForFunction(
          () => {
            const q = (window as unknown as { __quest?: { play: () => Record<string, unknown> } })
              .__quest;
            const s = q?.play();
            return Boolean(s && (s.line || s.objective || s.panel || s.choice || s.focus));
          },
          undefined,
          { timeout: 20000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(800);
      if (!seen.has(p.sectionId)) {
        seen.add(p.sectionId);
        await page.screenshot({ path: `${SHOTS}/stage-${p.sectionId}.png` });
      }
      continue;
    }
    if (p.panel) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/panel-${p.panel.id}.png` });
      switch (p.panel.id) {
        case "nmchat":
          await page.getByTestId("channel-onboarding").click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/panel-nmchat-onboarding.png` });
          await page.getByTestId("nmchat-close").click();
          break;
        case "avatar":
          await page.getByTestId("avatar-outfit-casual").click();
          await page.getByTestId("avatar-done").click();
          await expect(page.getByTestId("avatar-warn")).toBeVisible();
          await page.getByTestId("avatar-outfit-suit").click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: `${SHOTS}/panel-avatar-suit.png` });
          await page.getByTestId("avatar-done").click();
          break;
        case "routemap-quiz":
          await expect(page.getByTestId("quiz-problem")).toBeVisible();
          // ① まず 何線？（まちがえる → 不正解 → 正解）
          await page.getByTestId("line-T").click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/panel-routemap-wrong.png` });
          await page.getByTestId("line-M").click();
          await page.waitForTimeout(1300);
          // ② どこで 乗りかえる？
          await page.getByTestId("station-hommachi").click();
          await page.waitForTimeout(1300);
          // ③ 本町駅で 何線？
          await page.getByTestId("line-C").click();
          await page.waitForTimeout(1300);
          await page.screenshot({ path: `${SHOTS}/panel-routemap-done.png` });
          await page.getByTestId("quiz-close").click();
          break;
        case "memo":
          await page.getByTestId("memo-input").fill("天王寺 御堂筋線 M23");
          await page.getByTestId("memo-save").click();
          await page.waitForTimeout(900);
          break;
        case "report":
          await page
            .getByTestId("report-input")
            .fill("おはようございます。阿波座駅に 着きました。");
          await page.getByTestId("report-send").click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOTS}/panel-report-sent.png` });
          await page.getByTestId("report-close").click();
          break;
        case "certificate":
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${SHOTS}/zz-certificate.png` });
          await page.getByTestId("cert-close").click();
          await page.waitForURL("**/stages");
          await expect(page.getByTestId("stage-card-1")).toContainText("クリア");
          await page.screenshot({ path: `${SHOTS}/zz-stages-cleared.png` });
          expect(errors).toEqual([]);
          return;
      }
      await page.waitForTimeout(300);
      continue;
    }
    if (p.tip) {
      await page.waitForTimeout(250);
      if (!seen.has(`tip-${p.tip}`)) {
        seen.add(`tip-${p.tip}`);
        await page.screenshot({ path: `${SHOTS}/tip-${p.tip}.png` });
      }
      await page.getByTestId("tip-close").click();
      continue;
    }
    if (p.choice) {
      await page.screenshot({ path: `${SHOTS}/choice-${p.sectionId}.png` });
      const pickWrong = !wrongDone.has("phone");
      wrongDone.add("phone");
      await page.getByTestId(`choice-${pickWrong ? 0 : 1}`).click();
      if (pickWrong) {
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${SHOTS}/stare.png` });
      }
      continue;
    }
    if (p.verdict || p.line || p.dream) {
      if (p.verdict && !seen.has(`verdict-${p.sectionId}-${p.verdict.ok}`)) {
        seen.add(`verdict-${p.sectionId}-${p.verdict.ok}`);
        await page.screenshot({
          path: `${SHOTS}/verdict-${p.sectionId}-${p.verdict.ok ? "ok" : "ng"}.png`,
        });
      }
      if (p.dream) await page.screenshot({ path: `${SHOTS}/dream.png` });
      await quest(page, "advance");
      await page.waitForTimeout(60);
      continue;
    }
    if (p.waitingFor) {
      const w = p.waitingFor;
      // まちがえる道も1回ずつ通る
      const wrong: Record<string, string> = {
        "click:gate-M": "click:gate-T",
        "click:train-2": "click:train-1",
        "click:stairs-C": "click:stairs-Y",
      };
      const key = `${p.sectionId}:${w}`;
      if (wrong[w] && !wrongDone.has(key)) {
        wrongDone.add(key);
        await quest(page, "emit", wrong[w]);
      } else {
        if (w === "ticket:purchased") {
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${SHOTS}/ticket-machine.png` });
        }
        await quest(page, "emit", w);
      }
      await page.waitForTimeout(200);
      continue;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`時間切れ: 最後の場面 ${lastSection}`);
});
