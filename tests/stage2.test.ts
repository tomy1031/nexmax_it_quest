import { describe, expect, it } from "vitest";
import stage2Json from "../content/stages/stage2.json";
import talksJson from "../content/talks.json";
import chatJson from "../content/nmchat.json";
import tipsJson from "../content/tips.json";
import charactersJson from "../content/characters.json";
import { stageFile, type Beat } from "../src/content/schema";
import { meetingContent } from "../src/lib/meeting";
import { isStage2Scene } from "../src/stages/stage2/scene-ids";
import { SEATS, speakerSeat } from "../src/stages/stage2/meeting-seats";

/** ステージ2の 台本が 指す もの（声の 会話・NMChat・豆知識・質問の 時間・人）が そろって いるか。 */
const stage = stageFile.parse(stage2Json);
const beats: Beat[] = stage.sections.flatMap((s) => s.beats);
type PanelBeat = Extract<Beat, { t: "panel" }>;
const panels: PanelBeat[] = beats.filter((b): b is PanelBeat => b.t === "panel");

describe("ステージ2の 台本", () => {
  it("4つの 章と 場面（配属・準備・聞く・質問）", () => {
    expect(stage.sections.map((s) => s.id)).toEqual([
      "s01-haizoku",
      "s02-team",
      "s03-listen",
      "s04-question",
    ]);
    expect(stage.sections.every((s) => isStage2Scene(s.scene))).toBe(true);
  });

  it("声の 会話の 相手が content/talks.json に ある", () => {
    const ids = new Set(talksJson.talks.map((x) => x.id));
    const modes = panels.filter((b) => b.id === "talk").map((b) => b.mode);
    expect(modes).toEqual(["morning", "yamamoto-greet", "yamamoto-close"]);
    for (const m of modes) expect(ids.has(m!)).toBe(true);
  });

  it("NMChat の #aoba-project と 豆知識 3つが ある", () => {
    expect(chatJson.channels.some((c) => c.id === "aoba-project")).toBe(true);
    const tips = new Set(tipsJson.tips.map((x) => x.id));
    const used = beats.filter((b) => b.t === "tip").map((b) => (b as { id: string }).id);
    expect(used).toEqual(["jutaku-kaihatsu", "aoba", "kikanai-to"]);
    for (const id of used) expect(tips.has(id)).toBe(true);
  });

  it("質問の 時間の 中身が ある・リスニングは 別の 画面", () => {
    const list = panels.map((b) => `${b.id}:${b.mode ?? ""}`);
    expect(list).toContain("meeting:aoba-kickoff");
    expect(list).toContain("listening:aoba-kickoff");
    expect(list).toContain("team:");
    expect(meetingContent("aoba-kickoff")).toBeDefined();
  });

  it("「聞いた こと」の メモは 質問の 時間の あとで 書く", () => {
    const i = beats.findIndex((b) => b.t === "memo-add" && b.id === "aoba-heard");
    const j = beats.findIndex((b) => b.t === "panel" && b.id === "meeting");
    expect(i).toBeGreaterThan(j);
  });

  it("山本社長の 見た目が ある", () => {
    expect(charactersJson.characters.some((c) => c.id === "yamamoto")).toBe(true);
  });
});

describe("会議室の 席", () => {
  it("リスニングの 話す 人を 席の 人に つなぐ", () => {
    expect(speakerSeat("hendy")).toBe(SEATS.hendy);
    expect(speakerSeat("yamamoto")).toBe(SEATS.yamamoto);
    expect(speakerSeat("nexmax")).toBeNull();
  });
  it("山本社長と ヘンディさんは 向かい合う", () => {
    expect(SEATS.yamamoto!.pos[2]).toBe(SEATS.hendy!.pos[2]);
    expect(Math.sign(SEATS.yamamoto!.yaw)).toBe(-Math.sign(SEATS.hendy!.yaw));
  });
});
