import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/t";
import { playSfx } from "@/lib/audio";
import { onFx } from "@/stages/events";
import { usePlay } from "@/stages/play-store";
import { block, box, FLAT, merge, stairs } from "@/factory/kit";
import {
  GateRow,
  Hall,
  HangingSign,
  RouteMapBoard,
  TicketMachineGray,
} from "@/factory/station-parts";
import { LINE } from "@/factory/signs";
import { TicketMachine } from "@/factory/TicketMachine";
import { Interactable } from "@/three/Interactable";
import { Crowd } from "@/three/Crowd";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import { useLayout, type Rect } from "@/three/layout";
import { walkTo } from "@/three/player";

/**
 * 天王寺駅の地下（改札の外）。路線図・券売機（グレーはきっぷだけ、ピンクが定期券）・改札（御堂筋線と谷町線）・JR へののりかえ口。
 * 改札の看板は線のマーク（M・T）と線の名前。答えの改札に矢印は出さない（台本 arrow:false）。
 *
 * 座標: 北のかべ z=-8（路線図・券売機）。改札は z=1 の線（御堂筋線 x=-5、谷町線 x=6）。改札の中は z>1。
 */

const UNPAID: Rect = { minX: -13.5, maxX: 13.8, minZ: -7.0, maxZ: 0.3 };
const PAID_M: Rect = { minX: -7.3, maxX: -2.7, minZ: 0.3, maxZ: 6.4 };

export function ConcourseScene() {
  useSceneLayout({
    anchors: {
      "stairs-bottom": { pos: [-12, 0, -5.5], yaw: Math.PI / 2 },
      "route-map": { pos: [-7, 0, -5.8], yaw: Math.PI },
      "pass-machine": { pos: [3.2, 0, -6.2], yaw: 0 },
    },
    walk: [UNPAID],
    shots: {
      "route-map": { pos: [-7, 1.75, -4.4], look: [-7, 1.7, -7.9], fov: 52 },
      "pass-machine": { pos: [3.2, 1.5, -6.55], look: [3.2, 1.22, -7.3], fov: 44 },
    },
    triggers: [],
    camera: { mode: "follow", distance: 4.6, height: 2.6 },
    bounds: { minX: -14.6, maxX: 14.6, minZ: -7.6, maxZ: 7.6, maxY: 3.1 },
    showPlayer: true,
  });

  const focus = usePlay((s) => s.focus);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(
    () =>
      onFx((id) => {
        if (id === "gate-pass") {
          setGateOpen(true);
          playSfx("pi");
          useLayout.setState((s) => ({ walk: [...s.walk, PAID_M] }));
          walkTo(-4.6, 2.6);
        }
      }),
    [],
  );

  const extra = useMemo(
    () =>
      merge([
        // 地上からの階段（北西のすみ）
        stairs(10, 2.6, 0.2, 0.32, "#c9cdd3", { pos: [-12, 0, -6.8], rot: [0, Math.PI / 2, 0] }),
        // 改札の線のかべ（改札の外と中を分ける）
        block(5.5, 1.1, 0.25, "#c8ced6", { pos: [-10.25, 0, 1] }),
        block(5.6, 1.1, 0.25, "#c8ced6", { pos: [0.4, 0, 1] }),
        block(5.5, 1.1, 0.25, "#c8ced6", { pos: [11, 0, 1] }),
        // 御堂筋線と谷町線の改札の中を分けるかべ
        block(0.25, 3.4, 7, "#e3e6ea", { pos: [1, 0, 4.6] }),
        // ホームへの階段
        stairs(8, 3.0, -0.25, 0.4, "#c9cdd3", { pos: [-5, 0, 6.2], rot: [0, Math.PI, 0] }),
        // JR へののりかえ口（東のかべの通路）
        box(0.3, 2.6, 3, "#5a6170", { pos: [14.85, 1.3, -4] }),
      ]),
    [],
  );

  const passFocused = focus === "pass-machine";

  return (
    <>
      <Lights preset="underground" />
      <color attach="background" args={["#d7dde5"]} />
      <Hall
        width={30}
        depth={16}
        pillars={[
          [-9, -2],
          [0, -3],
          [9, -2],
          [-9, 4],
          [9, 4],
        ]}
      />
      <mesh geometry={extra} material={FLAT} />
      <WalkSurface size={[30, 16]} />

      <Interactable id="route-map" approach={[-7, -5.8]} marker={[-7, 3.0, -7.7]}>
        <RouteMapBoard position={[-7, 1.7, -7.85]} here="tennoji" />
      </Interactable>

      {[-2, -1, 0, 1, 2].map((x) => (
        <Interactable
          key={x}
          id="ticket-machine"
          approach={[x * 0.95 - 0.3, -6.2]}
          marker={[x * 0.95 - 0.3, 2.1, -7.6]}
        >
          <TicketMachineGray position={[x * 0.95 - 0.3, 0, -7.6]} />
        </Interactable>
      ))}
      <Interactable
        id="pass-machine"
        approach={[3.2, -6.2]}
        marker={[3.2, 2.15, -7.6]}
        disabled={passFocused}
      >
        <TicketMachine position={[3.2, 0, -7.6]} active={passFocused} />
      </Interactable>
      <HangingSign
        position={[0.5, 2.85, -6.6]}
        width={3.4}
        height={0.45}
        spec={{
          lines: ["M", "T"],
          text: t("sign.ticketMachine"),
          en: "Tickets / Commuter pass",
          tone: "white",
        }}
      />

      <Interactable id="gate-M" approach={[-4.6, 0.0]} marker={[-5, 1.6, 1]}>
        <GateRow position={[-5, 0, 1]} open={gateOpen} />
      </Interactable>
      <Interactable id="gate-T" approach={[6.4, 0.0]} marker={[6, 1.6, 1]}>
        <GateRow position={[6, 0, 1]} />
      </Interactable>
      <HangingSign
        position={[-5, 2.8, 0.6]}
        spec={{
          lines: ["M"],
          text: `${LINE.M?.name ?? ""} ${t("sign.gate")}`,
          en: "Midosuji Line",
          tone: "navy",
        }}
        width={3.6}
      />
      <HangingSign
        position={[6, 2.8, 0.6]}
        spec={{
          lines: ["T"],
          text: `${LINE.T?.name ?? ""} ${t("sign.gate")}`,
          en: "Tanimachi Line",
          tone: "navy",
        }}
        width={3.6}
      />

      <Interactable id="jr" approach={[13.4, -4]} marker={[14.5, 2.2, -4]}>
        <mesh position={[14.6, 1.3, -4]}>
          <boxGeometry args={[0.2, 2.6, 2.6]} />
          <meshStandardMaterial color="#3c4352" />
        </mesh>
      </Interactable>
      <HangingSign
        position={[12.6, 2.85, -4]}
        rotationY={-Math.PI / 2}
        width={3}
        spec={{ lines: [], text: t("sign.jr"), en: "JR Lines", arrow: "right", tone: "yellow" }}
      />
      <HangingSign
        position={[-5, 2.85, 5.2]}
        width={3}
        spec={{ lines: ["M"], text: t("sign.track"), en: "Platform", arrow: "down", tone: "navy" }}
      />

      <Interactable id="platform-stairs" approach={[-5, 5.4]} marker={[-5, 1.6, 6.6]}>
        <mesh position={[-5, 0.5, 6.9]}>
          <boxGeometry args={[3, 1, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      <Crowd
        people={[
          { pos: [-2, 0, -2], yaw: 0.4 },
          { pos: [4, 0, -3.5], yaw: -2.6 },
          { pos: [8, 0, -1], yaw: 2.2 },
          { pos: [-10, 0, -1.5], yaw: 1.2, model: "casual-m" },
          { pos: [10.5, 0, -5], yaw: -1.4, model: "hoodie" },
          { pos: [-3.2, 0, 4], yaw: Math.PI },
        ]}
      />
      <Ready />
    </>
  );
}
