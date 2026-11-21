import { lazy, Suspense, useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import { TitleScreen } from "@/app/TitleScreen";
import { SettingsScreen } from "@/app/SettingsScreen";
import { StoryScreen } from "@/app/StoryScreen";
import { StageSelect } from "@/app/StageSelect";
import { useSetupComplete } from "@/app/use-setup";
import { useSettings } from "@/lib/store";
import { t } from "@/lib/t";

const DiveScreen = lazy(() => import("@/app/DiveScreen"));
const StageScreen = lazy(() => import("@/app/StageScreen"));
const CertificatePage = lazy(() => import("@/app/CertificatePage"));
const FactoryScreen = lazy(() => import("@/app/FactoryScreen"));

function Loading() {
  return (
    <div className="grid h-full place-items-center text-cyan-200">
      <p className="animate-pulse text-lg font-bold">{t("loading")}</p>
    </div>
  );
}

/** 必須の設定がそろうまで、ステージの画面には入れない（企画メモ「最初は設定ボタンのみ押下可能」）。 */
function NeedSetup({ children }: { children: React.ReactNode }) {
  const ok = useSetupComplete();
  return ok ? <>{children}</> : <Redirect to="/" />;
}

export function App() {
  const textScale = useSettings((s) => s.textScale);
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`;
  }, [textScale]);

  return (
    <Suspense fallback={<Loading />}>
      <Switch>
        <Route path="/" component={TitleScreen} />
        <Route path="/settings" component={SettingsScreen} />
        <Route path="/story" component={StoryScreen} />
        <Route path="/dive">
          <NeedSetup>
            <DiveScreen />
          </NeedSetup>
        </Route>
        <Route path="/stages">
          <NeedSetup>
            <StageSelect />
          </NeedSetup>
        </Route>
        <Route path="/stage/:id">
          {(params) => (
            <NeedSetup>
              <StageScreen stageId={params.id} />
            </NeedSetup>
          )}
        </Route>
        <Route path="/certificate/:id">{(params) => <CertificatePage stageId={params.id} />}</Route>
        <Route path="/factory" component={FactoryScreen} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Suspense>
  );
}
