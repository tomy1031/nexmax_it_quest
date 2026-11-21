import { useLocation } from "wouter";
import { Certificate } from "@/ui/Certificate";

/** 修了証だけを見る画面（ステージ選択の「修了証を 見る」）。 */
export default function CertificatePage({ stageId }: { stageId: string }) {
  const [, navigate] = useLocation();
  return (
    <main className="grid h-full place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#2a7bff_0%,#071a46_60%)] p-4">
      <Certificate stageId={stageId} onClose={() => navigate("/stages")} />
    </main>
  );
}
