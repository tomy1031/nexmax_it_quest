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
  panel: { id: string; mode?: string } | null;
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

test("ステージ1を最初から修了証まで通す（第2章の 声の 会話は にせの 相手）", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByTestId("title-start")).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/01-title-locked.png` });

  await page.getByTestId("title-settings").click();
  await page.getByTestId("settings-name").fill("ソク ピセット");
  await page.getByTestId("settings-nickname").fill("ソク");
  // 学校と 期生（academy と 共有の ユーザーの 表に 書く。ここでは ログインしないので 端末だけ）
  await page.getByTestId("settings-school-AUPP").click();
  await page.getByTestId("settings-cohort-2").click();
  await expect(page.getByTestId("settings-school-AUPP")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("settings-cohort-2")).toHaveAttribute("aria-pressed", "true");
  // 会場の 席の メンバー（DB の 代わりに にせの メンバー。src/lib/classmates.ts）
  await page.addInitScript(() => {
    const names = [
      "ソピア",
      "ダラ",
      "チャンナ",
      "ソカ",
      "ビチカ",
      "ラタナ",
      "スレイ",
      "ボパ",
      "コサル",
      "リナ",
    ];
    (window as unknown as { __fakeClassmates: unknown }).__fakeClassmates = names.map((n, i) => ({
      id: `e2e-${i}`,
      name: n,
      gender: i % 3 === 1 ? "female" : "male",
      avatar: null,
    }));
  });
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
          // ① 今の 駅は？ ② 行きたい 駅は？（路線図の上で さがす）
          await page.getByTestId("station-tennoji").click();
          await page.waitForTimeout(1300);
          await page.getByTestId("station-awaza").click();
          await page.waitForTimeout(1300);
          // ③ まず 何線？（まちがえる → 不正解 → 正解）
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
        case "report":
          await page
            .getByTestId("report-input")
            .fill("おはようございます。阿波座駅に 着きました。");
          await page.getByTestId("report-send").click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOTS}/panel-report-sent.png` });
          await page.getByTestId("report-close").click();
          break;
        case "listening": {
          // ヘンディさんの お話（docs/design/02_リスニング.md）。声は にせ（1文を みじかい 時間で「再生した」ことに する）
          await page.evaluate(() => {
            const w = window as unknown as { __fakeLive?: unknown };
            w.__fakeLive ??= { answers: [] };
          });
          await expect(page.getByTestId("listen-intro")).toBeVisible();
          await expect(page.getByTestId("memo-box")).toHaveCount(0);
          await page.screenshot({ path: `${SHOTS}/listen-01-intro.png` });
          await page.getByTestId("listen-start").click();
          await page.waitForTimeout(700);
          await page.screenshot({ path: `${SHOTS}/listen-02-listen.png` });
          const input = page.getByTestId("listen-input");
          const send = async (word: string) => {
            await input.fill(word);
            await page.getByTestId("listen-submit").click();
            await page.waitForTimeout(150);
          };
          const badge = page.getByTestId("listen-result").locator("[data-kind]");
          // はずれ 1回
          await send("りんご");
          await expect(badge).toHaveAttribute("data-kind", "miss");
          await page.screenshot({ path: `${SHOTS}/listen-03-miss.png` });
          // 読みで 当てる（ひらがな）
          await send("じかん");
          await expect(badge).toHaveAttribute("data-kind", "hiragana");
          await page.waitForTimeout(150);
          await page.screenshot({ path: `${SHOTS}/listen-04-hit-glow.png` });
          // 漢字で 当てる
          await send("相談");
          await expect(badge).toHaveAttribute("data-kind", "keyword");
          // 貼り付けは できない
          await input.focus();
          await page.evaluate(() => {
            const el = document.querySelector("[data-testid=listen-input]")!;
            const data = new DataTransfer();
            data.setData("text/plain", "あいさつ");
            el.dispatchEvent(
              new ClipboardEvent("paste", { clipboardData: data, cancelable: true, bubbles: true }),
            );
          });
          await expect(input).toHaveValue("");
          await expect(page.getByTestId("listen-review")).toBeDisabled();
          for (const w of [
            "あいさつ",
            "大切",
            "れんらく",
            "先輩",
            "げんき",
            "ごふんまえ",
            "毎日",
            "日本",
            "会社",
            "おはよう",
          ]) {
            await send(w);
            if (await page.getByTestId("listen-review").isEnabled()) break;
          }
          // ヒント（1回 全部 聞いたあとで 使える）
          await expect(page.getByTestId("listen-hint")).toBeEnabled({ timeout: 20000 });
          await page.getByTestId("listen-hint").click();
          await page.screenshot({ path: `${SHOTS}/listen-05-goal.png` });
          await expect(page.getByTestId("listen-review")).toBeEnabled();
          await page.getByTestId("listen-review").click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOTS}/listen-06-review.png` });
          while (await page.getByTestId("listen-review-forward").isEnabled()) {
            await page.getByTestId("listen-review-forward").click();
            await page.waitForTimeout(60);
          }
          await page.getByTestId("listen-to-works").click();
          // ワーク1: ことばと 絵（わざと 1回 まちがえる）
          await expect(page.getByTestId("listen-work-match")).toBeVisible();
          await page.getByTestId("match-label-時間").click();
          await page.getByTestId("match-image-あいさつ").click();
          await expect(page.getByTestId("work-ng")).toBeVisible();
          await page.screenshot({ path: `${SHOTS}/listen-07-match-wrong.png` });
          for (const l of ["あいさつ", "時間", "相談"]) {
            await page.getByTestId(`match-label-${l}`).click();
            await page.getByTestId(`match-image-${l}`).click();
            await page.waitForTimeout(100);
          }
          await page.screenshot({ path: `${SHOTS}/listen-08-match-done.png` });
          await page.getByTestId("work-next").click();
          // ワーク2: こんな とき、どうする？（1問目で わざと まちがえる → もう一度 聞いて えらび直す）
          await expect(page.getByTestId("listen-work-situation")).toBeVisible();
          for (let i = 0; i < 4; i += 1) {
            if (i === 0) {
              await page.locator("[data-testid^=situation-option]:not([data-correct])").click();
              await expect(page.getByTestId("work-ng")).toBeVisible();
              await page.screenshot({ path: `${SHOTS}/listen-09-situation-ng.png` });
            }
            await expect(
              page.locator("[data-testid^=situation-option][data-correct]"),
            ).toBeEnabled();
            await page.locator("[data-testid^=situation-option][data-correct]").click();
            await expect(page.getByTestId("work-ok")).toBeVisible();
            if (i === 0) await page.screenshot({ path: `${SHOTS}/listen-10-situation-ok.png` });
            await page.getByTestId("work-next").click();
            await page.waitForTimeout(100);
          }
          // おわったら メモに 足して 閉じる
          await expect(page.getByTestId("listening-panel")).toHaveCount(0);
          await expect(page.getByTestId("memo-speech")).toBeVisible();
          break;
        }
        case "talk": {
          // 声の 会話（Gemini Live）。テストでは にせの 相手（src/lib/ai/live-fake.ts）に つなぐ。
          // 1回目は わざと まちがえる（受付: 大事な ことばが 足りない / ヘンディさん: あいさつが ちがう）
          const answers =
            p.panel.mode === "speech-check"
              ? ["わかりません", "あいさつです"]
              : p.panel.mode === "reception"
                ? [
                    "よろしくお願いします",
                    "わたくし、本日入社するソクピセットと申します。よろしくお願いいたします。",
                  ]
                : [
                    "こんにちは",
                    "おはようございます",
                    "ソクピセットです",
                    "カンボジアのプノンペンから来ました",
                    "ITを勉強しました",
                    "サッカーです",
                    "ラーメンが好きです",
                  ];
          await page.evaluate((a) => {
            (window as unknown as { __fakeLive: unknown }).__fakeLive = {
              answers: a,
              reply: "いいですね",
            };
          }, answers);
          await page.getByTestId("talk-start").click();
          for (let i = 0; i < 40; i += 1) {
            await page.waitForTimeout(500);
            if (await page.getByTestId("talk-next").isVisible()) break;
            const mic = page.getByTestId("talk-mic");
            if ((await mic.isVisible()) && (await mic.isEnabled())) {
              await mic.click();
              await page.waitForTimeout(300);
              await mic.click();
              await page.waitForTimeout(900);
              const shot = `talk-${p.panel.mode}-${i}`;
              if (!seen.has(shot) && i < 6) {
                seen.add(shot);
                await page.screenshot({ path: `${SHOTS}/${shot}.png` });
              }
            }
          }
          await page.screenshot({ path: `${SHOTS}/talk-${p.panel.mode}-done.png` });
          await page.getByTestId("talk-next").click();
          break;
        }
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
        "floor:7": "floor:wrong",
        "click:seat-front": "click:seat-back",
      };
      if (w === "emote:bow") {
        await page.screenshot({ path: `${SHOTS}/emote-bow.png` });
        await page.getByTestId("emote-bow").click();
        await page.waitForTimeout(1600);
        continue;
      }
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
