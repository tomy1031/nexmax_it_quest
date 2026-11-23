/**
 * 学校と 何期生（academy の src/lib/school.ts と 同じ 値。ユーザーの 表 profiles を 共有するため）。
 * tomy さん 2026-11-23「設定のところでauPP、CA DTの一期生から5期生まで選べるようにして」
 */
export const UNIVERSITIES = ["AUPP", "CADT"] as const;
export type University = (typeof UNIVERSITIES)[number];

/** 期生は 1〜5。0 は まだ えらんでいない。 */
export const COHORTS = [1, 2, 3, 4, 5] as const;

export function isUniversity(v: unknown): v is University {
  return UNIVERSITIES.includes(v as University);
}

export function isCohort(v: unknown): v is number {
  return typeof v === "number" && (COHORTS as readonly number[]).includes(v);
}
