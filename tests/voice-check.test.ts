import { describe, expect, it } from "vitest";
import talksJson from "../content/talks.json";
import { talksFile } from "../src/content/schema";
import { looksJapanese, matchedGroups, normalizeJa, repeatOk } from "../src/lib/voice-check";
import { validateAppSettings } from "../src/lib/app-settings-rules";

const talks = talksFile.parse(talksJson).talks;
const reception = talks.find((x) => x.id === "reception")!.steps[0]!;
const greet = talks.find((x) => x.id === "hendy")!.steps[0]!;

describe("声の 見かた", () => {
  it("カタカナと 記号を そろえる", () => {
    expect(normalizeJa("ソク、ピセット。")).toBe("そくぴせっと");
  });

  it("受付の あいさつ: 漢字でも かなでも 合格", () => {
    if (reception.kind !== "repeat") throw new Error("repeat のはず");
    const kanji = "私、本日入社するソクピセットと申します。よろしくお願いいたします。";
    const kana = "わたくし ほんじつ にゅうしゃする ソクと もうします よろしく おねがいいたします";
    expect(repeatOk(kanji, reception.check, reception.need)).toBe(true);
    expect(repeatOk(kana, reception.check, reception.need)).toBe(true);
  });

  it("受付の あいさつ: 大事な ことばが 足りないと もう一度", () => {
    if (reception.kind !== "repeat") throw new Error("repeat のはず");
    expect(matchedGroups("よろしくお願いします", reception.check)).toBe(2);
    expect(repeatOk("よろしくお願いします", reception.check, reception.need)).toBe(false);
  });

  it("おはようございます", () => {
    if (greet.kind !== "repeat") throw new Error("repeat のはず");
    expect(repeatOk("おはようございます！", greet.check, greet.need)).toBe(true);
    expect(repeatOk("こんにちは", greet.check, greet.need)).toBe(false);
  });

  it("日本語で 答えているか", () => {
    expect(looksJapanese("ソクです")).toBe(true);
    expect(looksJapanese("hello")).toBe(false);
    expect(looksJapanese("")).toBe(false);
  });
});

describe("管理者の 設定の 決まり", () => {
  it("名前と ひらがなの 読み", () => {
    expect(validateAppSettings({ teacherName: "冨永", teacherReading: "とみなが" })).toBeNull();
    expect(validateAppSettings({ teacherName: "", teacherReading: "とみなが" })).toBe(
      "teacherName",
    );
    expect(validateAppSettings({ teacherName: "冨永", teacherReading: "トミナガ" })).toBe(
      "teacherReading",
    );
    expect(validateAppSettings({ teacherName: "<b>", teacherReading: "とみなが" })).toBe(
      "teacherName",
    );
  });
});
