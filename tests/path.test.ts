import { describe, expect, it } from "vitest";
import { findPath, insideWalk } from "@/three/layout";

const room = [{ minX: -3, maxX: 3, minZ: -3, maxZ: 3 }];
const bed = [{ minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 }];

describe("家具を よけて歩く", () => {
  it("家具の中（体の太さこみ）には入れない", () => {
    expect(insideWalk(0, 0, room, bed)).toBe(false);
    expect(insideWalk(0, 0.65, room, bed)).toBe(false);
    expect(insideWalk(0, 0.8, room, bed)).toBe(true);
  });
  it("まっすぐ行ける所は1歩で行く", () => {
    expect(findPath([-2, 2], [2, 2], room, bed)).toEqual([[2, 2]]);
  });
  it("あいだに家具があれば、よけて行く（道の どこも家具に入らない）", () => {
    const p = findPath([0, -2], [0, 2], room, bed)!;
    expect(p.length).toBeGreaterThan(1);
    expect(p[p.length - 1]).toEqual([0, 2]);
    let [ax, az] = [0, -2];
    for (const [bx, bz] of p) {
      for (let t = 0; t <= 1; t += 0.05)
        expect(insideWalk(ax + (bx - ax) * t, az + (bz - az) * t, room, bed)).toBe(true);
      [ax, az] = [bx, bz];
    }
  });
});
