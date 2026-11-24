import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import stage1Json from "@content/stages/stage1.json";
import stage2Json from "@content/stages/stage2.json";
import type { StageFile } from "@/content/schema";
import { isDevTools } from "@/lib/env";
import { t } from "@/lib/t";
import { questEvents } from "@/stages/events";
import { playActions, usePlay } from "@/stages/play-store";
import { StageRunner } from "@/stages/runner";
import * as THREE from "three";
import { player } from "@/three/player";
import { liveCamera } from "@/three/CameraRig";
import { useLayout } from "@/three/layout";
import { World } from "@/three/World";
import { Hud } from "@/ui/hud/Hud";
import { RubyText } from "@/ui/RubyText";
import { LoadingCover } from "@/ui/LoadingCover";

const STAGES: Record<string, StageFile> = {
  stage1: stage1Json as StageFile,
  stage2: stage2Json as StageFile,
};

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * ステージの画面。3D（World）と、その上に重ねる表示（Hud）。台本は StageRunner が進める。
 * ?from=<場面> でその場面から始める（つづきから・章から・テスト）。?fast=1 で待ち時間を縮める（テスト用）。
 */
export default function StageScreen({ stageId }: { stageId: string }) {
  const stage = STAGES[stageId];
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const from = params.get("from") ?? undefined;
  const fast = params.get("fast") === "1";
  const [gl] = useState(webglOk);

  useEffect(() => {
    if (!stage || !gl) return;
    const runner = new StageRunner({ stage, startSection: from, fast });
    void runner.run();
    return () => runner.stop();
  }, [stage, from, fast, gl]);

  // テストと開発のための道具（ブラウザの自動操作から、クリックの代わりに合図を送る）
  useEffect(() => {
    if (!isDevTools && !fast) return;
    const w = window as unknown as Record<string, unknown>;
    w.__quest = {
      emit: (name: string, payload?: unknown) => questEvents.emit(name, payload),
      play: () => usePlay.getState(),
      layout: () => useLayout.getState(),
      player,
      /** 3D の位置 → 画面の位置（px）。テストで目印をクリックするのに使う。 */
      project: (x: number, y: number, z: number) => {
        const cam = liveCamera.current;
        const el = document.querySelector("[data-testid=world] canvas");
        if (!cam || !el) return null;
        const v = new THREE.Vector3(x, y, z).project(cam);
        const r = el.getBoundingClientRect();
        return {
          x: r.left + ((v.x + 1) / 2) * r.width,
          y: r.top + ((1 - v.y) / 2) * r.height,
          z: v.z,
        };
      },
      ...playActions,
    };
    return () => {
      delete w.__quest;
    };
  }, [fast]);

  if (!stage) return null;
  if (!gl) {
    return (
      <main className="grid h-full place-items-center p-6 text-center text-xl font-bold">
        <RubyText text={t("webgl.error")} />
      </main>
    );
  }
  return (
    <main className="relative h-full w-full overflow-hidden bg-[#dff3fa]">
      <World />
      <Hud />
      <LoadingCover />
      <p className="pointer-events-none absolute bottom-1 left-2 z-0 rounded-full bg-[#3b2c23]/55 px-2 py-0.5 text-[10px] font-bold text-white">
        <RubyText text={t("hud.disclaimer")} />
      </p>
    </main>
  );
}
