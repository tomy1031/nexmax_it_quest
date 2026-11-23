import { describe, expect, it } from "vitest";
import { assignSeats, classmateLook } from "../src/lib/classmates";
import { splitName } from "../src/lib/profile-sync";

describe("名前を 苗字と 名前に 分ける（academy と 同じ。カンボジアは 苗字が 先）", () => {
  it("2つ以上の ことば", () => {
    expect(splitName("ソク ピセット")).toEqual({ family: "ソク", given: "ピセット" });
    expect(splitName("  チャン　ソ ピア ")).toEqual({ family: "チャン", given: "ソ ピア" });
  });
  it("1つだけの ときは 分けない（DB に 書かない）", () => {
    expect(splitName("ソピア")).toBeNull();
    expect(splitName("")).toBeNull();
  });
});

describe("会場の 席", () => {
  it("後ろの 席から 順に 座る。人が 多いときは 席の 数まで", () => {
    const seats = ["back1", "back2", "front1"];
    expect(assignSeats(seats, ["a"])).toEqual([{ seat: "back1", who: "a" }]);
    expect(assignSeats(seats, ["a", "b", "c", "d"]).map((x) => x.who)).toEqual(["a", "b", "c"]);
  });
  it("見た目: 保存した アバターは スーツにして 使う。無い 人は id で 決まる", () => {
    const saved = classmateLook({
      id: "x",
      name: "ソピア",
      gender: "female",
      avatar: { outfit: "kigurumi", hairStyle: "twin" },
    });
    expect(saved.outfit).toBe("suit");
    expect(saved.hairStyle).toBe("twin");
    const a = classmateLook({ id: "same", name: "ダラ", gender: "female", avatar: null });
    const b = classmateLook({ id: "same", name: "ダラ", gender: "female", avatar: null });
    expect(a).toEqual(b);
    expect(a.figure).toBe("f");
  });
});
