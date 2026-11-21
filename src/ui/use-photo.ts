import { useEffect, useState } from "react";
import { loadPhoto } from "@/lib/photo";
import { useGame } from "@/lib/store";

/** 顔写真の URL（無ければ null）。設定で変えたら "nexmax-photo" の合図で読み直す。 */
export function usePhotoUrl(): string | null {
  const hasPhoto = useGame((s) => s.profile.hasPhoto);
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("nexmax-photo", bump);
    return () => window.removeEventListener("nexmax-photo", bump);
  }, []);

  useEffect(() => {
    if (!hasPhoto) return;
    let alive = true;
    let made: string | null = null;
    void loadPhoto().then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [hasPhoto, version]);

  return hasPhoto ? url : null;
}
