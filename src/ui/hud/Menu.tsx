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
import { MemoEditor } from "@/ui/hud/MemoPanel";
import { AvatarEditor } from "@/ui/hud/AvatarPanel";
import { TIPS, TipView } from "@/ui/hud/Hud";

type View = "list" | "nmchat" | "routemap" | "memo" | "items" | "tips" | "avatar";

/** いつでも開けるメニュー（企画メモ「メニューから NMChat・路線図をいつでも確認可能に」）。 */
export function Menu({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("list");
  const [, navigate] = useLocation();
  const inventory = useGame((s) => s.inventory);
  const balance = useGame((s) => s.icocaBalance);
  const tipsSeen = useGame((s) => s.tipsSeen);
  const [openTip, setOpenTip] = useState<string | null>(null);

  const back = () => (view === "list" ? onClose() : setView("list"));

  return (
    <div
      className="bg-deep/60 pointer-events-auto absolute inset-0 z-30 grid place-items-center p-3"
      data-testid="menu"
    >
      <div className="glass pop flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-3xl p-5">
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
                onClick={() => setView("nmchat")}
              />
              <Tile
                icon={<IconMap className="h-8 w-8" />}
                label={t("menu.routemap")}
                onClick={() => setView("routemap")}
              />
              <Tile
                icon={<IconMemo className="h-8 w-8" />}
                label={t("menu.memo")}
                onClick={() => setView("memo")}
              />
              <Tile
                icon={<IconBag className="h-8 w-8" />}
                label={t("menu.items")}
                onClick={() => setView("items")}
              />
              <Tile
                icon={<IconBulb className="h-8 w-8" />}
                label={t("menu.tips")}
                onClick={() => setView("tips")}
              />
              <Tile
                icon={<IconShirt className="h-8 w-8" />}
                label={t("menu.avatar")}
                onClick={() => setView("avatar")}
              />
              <Tile
                icon={<IconGear className="h-8 w-8" />}
                label={t("menu.settings")}
                onClick={() => navigate("/settings")}
              />
              <Tile
                icon={<IconExit className="h-8 w-8" />}
                label={t("menu.quit")}
                onClick={() => navigate("/stages")}
                note={t("menu.quitNote")}
              />
            </div>
          )}
          {view === "nmchat" && <NMChat mode="view" onDone={() => setView("list")} />}
          {view === "routemap" && (
            <div className="rounded-2xl bg-white p-2">
              <RouteMap />
            </div>
          )}
          {view === "memo" && <MemoEditor onSaved={() => setView("list")} />}
          {view === "items" && (
            <div className="flex flex-col gap-3">
              {inventory.length === 0 && (
                <p className="text-white/70">
                  <RubyText text={t("menu.empty")} />
                </p>
              )}
              {inventory.includes("icoca-pass") && (
                <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4">
                  <div className="grid h-16 w-24 place-items-center rounded-lg bg-[linear-gradient(135deg,#7ad7ff,#2a6cff)] text-sm font-black text-white shadow">
                    ICOCA
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-extrabold">
                      <RubyText text={t("item.icoca-pass")} />
                    </span>
                    <span className="text-white/80">
                      <RubyText text={t("item.icoca-pass.detail")} />
                    </span>
                    <span className="text-white/80">
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
                  <p className="text-white/70">
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
  onClick,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  note?: string;
}) {
  return (
    <button type="button" className="btn btn-ghost flex-col gap-2 py-5 text-lg" onClick={onClick}>
      {icon}
      <RubyText text={label} />
      {note && (
        <span className="text-xs font-bold text-white/60">
          <RubyText text={note} />
        </span>
      )}
    </button>
  );
}
