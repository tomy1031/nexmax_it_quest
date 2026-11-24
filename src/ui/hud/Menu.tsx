import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/store";
import { t } from "@/lib/t";
import { RubyText } from "@/ui/RubyText";
import {
  IconBag,
  IconBulb,
  IconChat,
  IconClose,
  IconExit,
  IconGear,
  IconMap,
  IconMemo,
  IconShirt,
} from "@/ui/icons";
import { NMChat } from "@/ui/hud/NMChat";
import { RouteMap } from "@/ui/hud/RouteMap";
import { MemoList } from "@/ui/hud/MemoPanel";
import { AvatarEditor } from "@/ui/hud/AvatarPanel";
import { TIPS, TipView } from "@/ui/hud/Hud";
import { SettingsScreen } from "@/app/SettingsScreen";
import { IcocaPassImage } from "@/ui/IcocaPassImage";

type View = "list" | "nmchat" | "routemap" | "memo" | "items" | "tips" | "avatar";

/** いつでも開けるメニュー（企画メモ「メニューから NMChat・路線図をいつでも確認可能に」）。 */
export function Menu({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("list");
  const [, navigate] = useLocation();
  const inventory = useGame((s) => s.inventory);
  const balance = useGame((s) => s.icocaBalance);
  const tipsSeen = useGame((s) => s.tipsSeen);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  const back = () => (view === "list" ? onClose() : setView("list"));

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-[#3b2c23]/45 p-3"
      data-testid="menu"
    >
      {/* 設定は、ページを移らず上に重ねて開く（閉じたら同じ場面にもどる） */}
      {settings && (
        <div className="absolute inset-0 z-40" data-testid="menu-settings">
          <SettingsScreen onClose={() => setSettings(false)} />
        </div>
      )}
      <div
        className={`glass pop text-ink flex max-h-full w-full flex-col gap-4 overflow-hidden rounded-[28px] p-5 ${view === "avatar" ? "max-w-6xl" : "max-w-4xl"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">
            <RubyText text={t("menu.title")} />
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-3"
            onClick={back}
            data-testid="menu-close"
          >
            <IconClose className="h-5 w-5" />
            <RubyText text={t("hud.close")} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "list" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile
                icon={<IconChat className="h-8 w-8" />}
                label={t("menu.nmchat")}
                tone="bg-[#236b7e] border-[#1a5261] shadow-[0_4px_0_#15434f]"
                onClick={() => setView("nmchat")}
              />
              <Tile
                icon={<IconMap className="h-8 w-8" />}
                label={t("menu.routemap")}
                tone="bg-[#2178b8] border-[#185d90] shadow-[0_4px_0_#124a73]"
                onClick={() => setView("routemap")}
              />
              <Tile
                icon={<IconMemo className="h-8 w-8" />}
                label={t("menu.memo")}
                tone="bg-[#b87320] border-[#915a16] shadow-[0_4px_0_#744710]"
                onClick={() => setView("memo")}
              />
              <Tile
                icon={<IconBag className="h-8 w-8" />}
                label={t("menu.items")}
                tone="bg-[#1f9262] border-[#17724c] shadow-[0_4px_0_#11583a]"
                onClick={() => setView("items")}
              />
              <Tile
                icon={<IconBulb className="h-8 w-8" />}
                label={t("menu.tips")}
                tone="bg-[#d45568] border-[#aa3f50] shadow-[0_4px_0_#88303e]"
                onClick={() => setView("tips")}
              />
              <Tile
                icon={<IconShirt className="h-8 w-8" />}
                label={t("menu.avatar")}
                tone="bg-[#b55285] border-[#8f3d67] shadow-[0_4px_0_#702d4f]"
                onClick={() => setView("avatar")}
              />
              <Tile
                icon={<IconGear className="h-8 w-8" />}
                label={t("menu.settings")}
                tone="bg-[#665043] border-[#4d3b31] shadow-[0_4px_0_#3b2d25]"
                onClick={() => setSettings(true)}
              />
              <Tile
                icon={<IconExit className="h-8 w-8" />}
                label={t("menu.quit")}
                tone="bg-[#4e5d6c] border-[#3b4754] shadow-[0_4px_0_#2d3640]"
                onClick={() => navigate("/stages")}
                note={t("menu.quitNote")}
              />
            </div>
          )}
          {view === "nmchat" && <NMChat mode="view" onDone={() => setView("list")} />}
          {view === "routemap" && (
            <div className="rounded-2xl border-2 border-[#e6d4b3] bg-white p-2">
              <RouteMap />
            </div>
          )}
          {view === "memo" && <MemoList />}
          {view === "items" && (
            <div className="flex flex-col gap-3">
              {inventory.length === 0 && (
                <p className="text-cocoa font-bold">
                  <RubyText text={t("menu.empty")} />
                </p>
              )}
              {inventory.includes("icoca-pass") && (
                <div className="cream-box flex items-center gap-4 rounded-2xl p-4">
                  <IcocaPassImage className="w-56 shrink-0 rounded-xl shadow-lg sm:w-72" />
                  <div className="flex flex-col">
                    <span className="text-lg font-extrabold">
                      <RubyText text={t("item.icoca-pass")} />
                    </span>
                    <span className="text-cocoa font-bold">
                      <RubyText text={t("item.icoca-pass.detail")} />
                    </span>
                    <span className="font-extrabold">
                      <RubyText text={t("item.balance")} />: {balance.toLocaleString()}
                      <RubyText text={t("tm.yen")} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          {view === "tips" &&
            (openTip && TIPS[openTip] ? (
              <div className="grid place-items-center">
                <TipView tip={TIPS[openTip]} onClose={() => setOpenTip(null)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tipsSeen.length === 0 && (
                  <p className="text-cocoa font-bold">
                    <RubyText text={t("menu.empty")} />
                  </p>
                )}
                {tipsSeen.map((id) =>
                  TIPS[id] ? (
                    <button
                      key={id}
                      type="button"
                      className="btn btn-ghost justify-start text-left"
                      onClick={() => setOpenTip(id)}
                    >
                      <IconBulb className="text-sun h-5 w-5 shrink-0" />
                      <RubyText text={TIPS[id].title} />
                    </button>
                  ) : null,
                )}
              </div>
            ))}
          {view === "avatar" && <AvatarEditor mode="free" onDone={() => setView("list")} />}
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  tone,
  onClick,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
  note?: string;
}) {
  return (
    <button
      type="button"
      className={`btn flex-col gap-2 rounded-[22px] border-2 py-5 text-lg text-white hover:brightness-105 ${tone}`}
      onClick={onClick}
    >
      {icon}
      <RubyText text={label} />
      {note && (
        <span className="text-xs font-bold text-white/95">
          <RubyText text={note} />
        </span>
      )}
    </button>
  );
}
