import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { onFx } from "@/stages/events";
import { playActions, usePlay } from "@/stages/play-store";
import { NMChat } from "@/ui/hud/NMChat";
import { AvatarEditor } from "@/ui/hud/AvatarPanel";
import { RouteMapQuiz } from "@/ui/hud/RouteMapQuiz";
import { MemoList } from "@/ui/hud/MemoPanel";
import { RubyText } from "@/ui/RubyText";
import { t } from "@/lib/t";
import { ReportPanel } from "@/ui/hud/ReportPanel";
import { TalkPanel } from "@/ui/hud/TalkPanel";
import { TeamPanel } from "@/ui/hud/TeamPanel";
import { Certificate } from "@/ui/Certificate";
import { questEvents } from "@/stages/events";

/** 台本が開く画面（NMChat・着がえ・路線図・メモ・連絡・修了証）。閉じると台本が先へ進む。 */
export function Panels() {
  const panel = usePlay((s) => s.panel);
  const stageId = usePlay((s) => s.stageId);
  const [, navigate] = useLocation();
  if (!panel) return <PhoneOverlay />;
  const close = () => playActions.closePanel();
  // 声で 話す 練習は、3D の 相手が 見えるように 下に 出す（画面を 暗くしない）
  if (panel.id === "talk") return <TalkPanel talkId={panel.mode ?? ""} onDone={close} />;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-[#3b2c23]/40 p-3">
      {panel.id === "nmchat" && (
        <div className="w-full max-w-4xl">
          <NMChat mode="onboarding" onDone={close} />
        </div>
      )}
      {panel.id === "avatar" && (
        <AvatarEditor
          mode={panel.mode === "suit" ? "suit" : "free"}
          onDone={() => {
            questEvents.emit("avatar:done");
            close();
          }}
        />
      )}
      {panel.id === "routemap-quiz" && <RouteMapQuiz onDone={close} />}
      {panel.id === "memo" && (
        <div className="glass pop flex w-full max-w-xl flex-col gap-3 rounded-[28px] p-5">
          <MemoList />
          <button type="button" className="btn btn-primary self-end" onClick={close}>
            <RubyText text={t("hud.close")} />
          </button>
        </div>
      )}
      {panel.id === "report" && <ReportPanel onDone={close} />}
      {panel.id === "team" && <TeamPanel onDone={close} />}
      {panel.id === "certificate" && (
        <Certificate
          stageId={stageId}
          onClose={() => {
            close();
            navigate("/stages");
          }}
        />
      )}
    </div>
  );
}

/** 電車の中で電話がふるえる（台本の fx: phone-ring / phone-stop）。 */
function PhoneOverlay() {
  const [ringing, setRinging] = useState(false);
  useEffect(
    () =>
      onFx((id) => {
        if (id === "phone-ring") setRinging(true);
        if (id === "phone-stop" || id === "stare-end") setRinging(false);
      }),
    [],
  );
  if (!ringing) return null;
  return (
    <div className="absolute right-6 bottom-40 sm:right-12">
      <div className="shake grid h-40 w-24 place-items-center rounded-[1.4rem] border-4 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl">
        <span className="text-4xl">📳</span>
      </div>
    </div>
  );
}
