import { expect, test } from "@playwright/test";

test("ステージ選択からアバターづくりスタジオを開き、おすすめ・顔・髪・服・小物を変えて保存できる", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "nexmax-it-quest:game",
      JSON.stringify({
        state: {
          profile: { name: "ソク ピセット", nickname: "ソク", hasPhoto: false },
          avatar: {
            outfit: "pajama",
            pajama: "#a9cdeb",
            figure: "m",
            skin: "#c68e64",
            hair: "#4a3326",
            hairStyle: "model",
            glasses: false,
            height: 168,
            eyes: "round",
            blush: true,
            accessory: "none",
            bag: true,
            suit: "#2f3a5e",
            shirt: "#f4f6f8",
            tie: "#1f3f7a",
            coat: "#8a8f98",
            pants: "#3a3d44",
          },
          stages: {},
          inventory: [],
          icocaBalance: 0,
          memo: "",
          tipsSeen: [],
          reportText: "",
        },
        version: 3,
      }),
    );
    localStorage.setItem(
      "nexmax-it-quest:settings",
      JSON.stringify({
        state: {
          sound: false,
          furigana: true,
          quality: "normal",
          textScale: 1,
          geminiKey: "",
          geminiOk: false,
        },
        version: 1,
      }),
    );
  });

  await page.goto("/stages");
  await page.getByTestId("select-avatar").click();
  await expect(page.getByTestId("avatar-editor")).toBeVisible();

  // おすすめコーデ（クロマー風・ITエンジニア・パステル・かえる・パンダ・しば犬）を試して写真に残す
  await page.getByTestId("avatar-preset-krama").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-krama.png" });

  await page.getByTestId("avatar-preset-engineer").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-engineer.png" });

  await page.getByTestId("avatar-preset-pastel").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-pastel.png" });

  await page.getByTestId("avatar-preset-campus").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-campus.png" });

  await page.getByTestId("avatar-preset-frog").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-frog.png" });

  await page.getByTestId("avatar-preset-panda").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-panda.png" });

  await page.getByTestId("avatar-preset-shiba").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "e2e-screens/avatar-preset-shiba.png" });

  await page.getByTestId("avatar-undo").click();

  // 顔タブ: 目・まゆ・鼻・口・ほっぺ・ワンポイント
  await page.getByTestId("avatar-cat-face").click();
  await page.getByTestId("avatar-tab-eyes").click();
  await page.getByTestId("avatar-eyes-sparkle").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e-screens/avatar-tab-eyes.png" });
  await page.getByTestId("avatar-tab-eyebrow").click();
  await page.getByTestId("avatar-brow-arch").click();
  await page.getByTestId("avatar-tab-nose").click();
  await page.getByTestId("avatar-nose-triangle").click();
  await page.getByTestId("avatar-tab-mouth").click();
  await page.getByTestId("avatar-mouth-cat").click();
  await page.getByTestId("avatar-tab-cheek").click();
  await page.getByTestId("avatar-cheek-heart").click();
  await page.getByTestId("avatar-mark-bandaid").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e-screens/avatar-tab-face-done.png" });

  // 小物タブ: ぼうし・めがね・首もと（クロマー）・かざり
  await page.getByTestId("avatar-cat-items").click();
  await page.getByTestId("avatar-tab-hat").click();
  await page.getByTestId("avatar-hat-beret").click();
  await page.getByTestId("avatar-tab-glasses").click();
  await page.getByTestId("avatar-glasses-visor").click();
  await page.getByTestId("avatar-tab-neckwear").click();
  await page.getByTestId("avatar-neck-krama").click();
  await page.getByTestId("avatar-tab-accessory").click();
  await page.getByTestId("avatar-acc-sprout").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e-screens/avatar-tab-items.png" });

  // 決定して保存されることを確かめる
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("avatar-editor")).toBeHidden();

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem("nexmax-it-quest:game");
    return raw ? JSON.parse(raw).state.avatar : null;
  });
  expect(saved.eyes).toBe("sparkle");
  expect(saved.eyebrow).toBe("arch");
  expect(saved.nose).toBe("triangle");
  expect(saved.mouth).toBe("cat");
  expect(saved.cheek).toBe("heart");
  expect(saved.faceMark).toBe("bandaid");
  expect(saved.hat).toBe("beret");
  expect(saved.glassesStyle).toBe("visor");
  expect(saved.neckwear).toBe("krama");
  expect(saved.accessory).toBe("sprout");
  expect(errors).toEqual([]);
});
