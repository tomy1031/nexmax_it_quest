/**
 * 3D の場面・画面の部品と、台本を進める仕組み（runner）をつなぐ合図。
 * 場面はクリックや到着を「click:<id>」「reach:<地点>」で知らせ、台本は待っている合図だけを受け取る。
 * 台本からの演出は「fx:<id>」で場面へ送る。
 */
type Listener = (name: string, payload?: unknown) => void;

const listeners = new Set<Listener>();

export const questEvents = {
  emit(name: string, payload?: unknown): void {
    for (const l of [...listeners]) l(name, payload);
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** 台本からの演出（fx）を受け取る。場面の部品が使う。 */
export function onFx(handler: (id: string) => void): () => void {
  return questEvents.on((name) => {
    if (name.startsWith("fx:")) handler(name.slice(3));
  });
}
