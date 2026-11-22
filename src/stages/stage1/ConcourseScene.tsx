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
import { LINE, STATION } from "@/factory/signs";
import { Many, Prop } from "@/factory/props";
import { Poster, PosterRow } from "@/factory/subway-parts";
import { TicketMachine } from "@/factory/TicketMachine";
import { Interactable } from "@/three/Interactable";
import { Crowd, Walkers } from "@/three/Crowd";
import { Lights, Ready, useSceneLayout, WalkSurface } from "@/three/helpers";
import { useLayout, type Rect } from "@/three/layout";
import { cameraAim, walkTo } from "@/three/player";

/**
 * 天王寺駅の地下（改札の外）。路線図・券売機（グレーはきっぷだけ、ピンクが定期券）・改札（御堂筋線と谷町線）・JR へののりかえ口。
 * 改札の看板は線のマーク（M・T）と線の名前。答えの改札に矢印は出さない（台本 arrow:false）。
 *
 * 座標: 北のかべ z=-8（路線図・券売機）。改札は z=1 の線（御堂筋線 x=-5、谷町線 x=6）。改札の中は z>1。
 */

const UNPAID: Rect = { minX: -13.5, maxX: 13.8, minZ: -7.0, maxZ: 0.3 };
/** 御堂筋線の改札の通り道（改札を通るときだけ歩ける）。 */
const GATE_LANE: Rect = { minX: -5.4, maxX: -3.8, minZ: -0.6, maxZ: 0.6 };
const PAID_M: Rect = { minX: -7.3, maxX: -2.7, minZ: 0.3, maxZ: 4.3 };
/** ホームへ下りる階段の穴（改札の中の南がわ）。 */
const STAIR_HOLE = { minX: -6.4, maxX: -3.6, minZ: 4.6, maxZ: 7.95 };

export function ConcourseScene() {
  useSceneLayout({
    anchors: {
      "stairs-bottom": { pos: [-12, 0, -5.5], yaw: Math.PI / 2 },
      "route-map": { pos: [-7, 0, -5.8], yaw: Math.PI },
      // 券売機の前（まちがえた電車のあとの「券売機の 前から やり直し」もここ）。
      // 西を向いて立つと、カメラから券売機（右）と改札（左）の両方が見える
      "pass-machine": { pos: [3.2, 0, -6.2], yaw: -Math.PI / 2 },
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
          // 改札を通るあいだだけ、改札の通り道も歩けるようにする。通りぬけたら、改札の中だけにする
          // （一度入ったら外へもどれない。tomy さん 2026-11-22）
          useLayout.setState({ walk: [GATE_LANE, PAID_M] });
          walkTo(-4.6, 2.6, () => useLayout.setState({ walk: [PAID_M] }));
          // 改札を通ったら、正面（南）のホームへの階段と案内板が見える向きにする
          cameraAim.yaw = 0;
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
        // ホームへ下りる階段（床の穴の中を、南へ下りていく。tomy さん 2026-11-22「階段が登りしかない」）
        ...Array.from({ length: 10 }, (_, i) =>
          block(2.8, 3.4 - 0.3 * (i + 1), 0.335, i % 2 ? "#c3c7cd" : "#cfd3d9", {
            pos: [-5, -3.4, STAIR_HOLE.minZ + 0.17 + i * 0.335],
          }),
        ),
        // 階段の両がわと奥のかべ（床より下）
        box(0.1, 3.4, 3.4, "#e6e8ea", { pos: [STAIR_HOLE.minX - 0.05, -1.7, 6.27] }),
        box(0.1, 3.4, 3.4, "#e6e8ea", { pos: [STAIR_HOLE.maxX + 0.05, -1.7, 6.27] }),
        box(2.9, 3.4, 0.1, "#e6e8ea", { pos: [-5, -1.7, STAIR_HOLE.maxZ] }),
        // 穴のまわりの低いかべ（横）と、下りる手すり
        block(0.14, 1.0, 3.4, "#d4d8de", { pos: [STAIR_HOLE.minX - 0.07, 0, 6.27] }),
        block(0.14, 1.0, 3.4, "#d4d8de", { pos: [STAIR_HOLE.maxX + 0.07, 0, 6.27] }),
        box(0.06, 0.06, 4.6, "#b9bec6", {
          pos: [-6.2, -0.75, 6.27],
          rot: [Math.atan2(3.0, 3.35), 0, 0],
        }),
        box(0.06, 0.06, 4.6, "#b9bec6", {
          pos: [-3.8, -0.75, 6.27],
          rot: [Math.atan2(3.0, 3.35), 0, 0],
        }),
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
        hole={STAIR_HOLE}
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

      {/* 「8番出口」のような白いタイルの通路の空気: 同じポスターのならび・出口の黄色い看板・ロッカー */}
      <PosterRow kinds={["nexmax", "manner"]} x={-14.97} zs={[2.4, 5.2]} rotationY={Math.PI / 2} />
      <PosterRow
        kinds={["cafe", "rush", "ginkgo", "manner"]}
        x={14.97}
        zs={[-0.8, 1.9, 4.6, 7.0]}
        rotationY={-Math.PI / 2}
      />
      {[-13, -10.5, 9.5, 12.5].map((x, i) => (
        <Poster
          key={x}
          kind={(["rush", "osaka", "cafe", "nexmax"] as const)[i]!}
          position={[x, 1.55, 7.97]}
          rotationY={Math.PI}
        />
      ))}
      <Many
        url="station/lockers"
        at={[0, 1, 2].map((i) => ({
          p: [-14.6, 0, -3.2 + i * 1.0] as [number, number, number],
          r: Math.PI / 2,
        }))}
      />
      <Many url="street/vending" at={[{ p: [8.7, 0, -7.55] }, { p: [9.85, 0, -7.55] }]} />
      <Prop url="street/bin" position={[10.9, 0, -7.6]} />
      <Prop url="station/extinguisher" position={[-9, 0, -1.6]} />
      <Prop url="station/extinguisher" position={[9, 0, 4.4]} />
      <Prop url="station/wall-clock" position={[0, 0.7, -2.62]} />
      <Prop url="station/exit-light" position={[-14.9, 0.4, -4.2]} rotationY={Math.PI / 2} />
      <HangingSign
        position={[-10.2, 2.85, -5.6]}
        rotationY={Math.PI / 2}
        width={2.4}
        height={0.42}
        spec={{
          lines: [],
          text: t("sign.exit"),
          en: "Exit",
          arrow: "up",
          tone: "yellow",
          number: 8,
        }}
        doubleSide={false}
      />
      <Walkers
        people={[
          { from: [-11, -3.4], to: [12.5, -3.4], speed: 1.1, at: 0.2 },
          { from: [12.8, -0.6], to: [-8, -0.6], speed: 1.25, at: 0.6, casual: true },
          { from: [-12.5, -4.8], to: [-12.5, 0], speed: 0.9, at: 0.5 },
        ]}
      />

      {/* ここが天王寺駅だと分かるように、路線図の上と階段の下に駅の名前 */}
      <HangingSign
        position={[-11.2, 2.9, -3.6]}
        rotationY={Math.PI / 2}
        width={2.6}
        height={0.46}
        spec={{
          lines: ["M", "T"],
          text: `${STATION.tennoji?.name ?? ""}${t("sign.station")}`,
          en: "Tennoji Station",
          tone: "navy",
        }}
      />
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

      {/* 案内の表示: 券売機の前（西を向いて立つ）から見える所に「御堂筋線 改札 ←」。表示を見て改札へ行けるように */}
      <HangingSign
        position={[-1.4, 2.95, -5.3]}
        rotationY={Math.PI / 2}
        width={2.8}
        height={0.46}
        doubleSide={false}
        spec={{
          lines: ["M"],
          text: `${LINE.M?.name ?? ""} ${t("sign.gate")}`,
          en: "Midosuji Line",
          arrow: "left",
          tone: "navy",
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
      {/* 階段の上の案内: 御堂筋線 ホーム ↓（改札を通ると正面に見える） */}
      <HangingSign
        position={[-5, 2.9, 4.5]}
        width={3.2}
        height={0.5}
        spec={{
          lines: ["M"],
          text: `${LINE.M?.name ?? ""} ${t("sign.platform")}`,
          en: "To platforms",
          arrow: "down",
          tone: "navy",
        }}
      />

      <Interactable id="platform-stairs" approach={[-5, 4.1]} marker={[-5, 0.9, 5.6]}>
        <mesh position={[-5, -0.6, 6.27]}>
          <boxGeometry args={[2.8, 1.6, 3.3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>

      <Crowd
        people={[
          { pos: [-2, 0, -2], yaw: 0.4 },
          { pos: [4, 0, -3.5], yaw: -2.6 },
          { pos: [8, 0, -1], yaw: 2.2 },
          { pos: [-10, 0, -1.5], yaw: 1.2, casual: true },
          { pos: [10.5, 0, -5], yaw: -1.4, casual: true },
          { pos: [-6.7, 0, 3.4], yaw: Math.PI / 2 },
        ]}
      />
      <Ready />
    </>
  );
}
