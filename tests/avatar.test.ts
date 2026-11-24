import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, type AvatarConfig, type HairStyle } from "../src/lib/store";
import { bagStyleOf, casualStyleOf, cheekOf, glassesStyleOf } from "../src/three/avatar-parts";
import { FREE_PRESETS, SUIT_PRESETS, buildRandomAvatar } from "../src/three/avatar-presets";

describe("アバター設定の 互換性と プリセット", () => {
  it("古い保存データ（glasses/bag/blush の boolean のみ）から 正しく形を 読み取る", () => {
    const legacyOn: AvatarConfig = {
      ...DEFAULT_AVATAR,
      glasses: true,
      glassesStyle: undefined,
      bag: true,
      bagStyle: undefined,
      blush: true,
      cheek: undefined,
      casualStyle: undefined,
    };
    expect(glassesStyleOf(legacyOn)).toBe("round");
    expect(bagStyleOf(legacyOn)).toBe("backpack");
    expect(cheekOf(legacyOn)).toBe("round");
    expect(casualStyleOf(legacyOn)).toBe("hoodie");

    const legacyOff: AvatarConfig = {
      ...DEFAULT_AVATAR,
      glasses: false,
      glassesStyle: undefined,
      bag: false,
      bagStyle: undefined,
      blush: false,
      cheek: undefined,
    };
    expect(glassesStyleOf(legacyOff)).toBe("none");
    expect(bagStyleOf(legacyOff)).toBe("none");
    expect(cheekOf(legacyOff)).toBe("none");
  });

  it("新しい詳細設定（glassesStyle/bagStyle/cheek）が 優先される", () => {
    const cfg: AvatarConfig = {
      ...DEFAULT_AVATAR,
      glasses: true,
      glassesStyle: "visor",
      bag: true,
      bagStyle: "wings",
      blush: true,
      cheek: "freckles",
      casualStyle: "cardigan",
    };
    expect(glassesStyleOf(cfg)).toBe("visor");
    expect(bagStyleOf(cfg)).toBe("wings");
    expect(cheekOf(cfg)).toBe("freckles");
    expect(casualStyleOf(cfg)).toBe("cardigan");
  });

  it("入社式モードの プリセットと おまかせは 必ずスーツ＋革ぐつになる", () => {
    for (const p of SUIT_PRESETS) {
      expect(p.patch.outfit).toBe("suit");
      expect(p.patch.shoeType).toBe("leather");
    }
    const styles: HairStyle[] = ["model", "bob", "twoblock", "longwave"];
    for (let i = 0; i < 10; i += 1) {
      const r = buildRandomAvatar("suit", styles);
      expect(r.outfit).toBe("suit");
      expect(r.shoeType).toBe("leather");
      expect(r.hat).toBe("none");
    }
    expect(FREE_PRESETS.length).toBeGreaterThanOrEqual(6);
  });
});
