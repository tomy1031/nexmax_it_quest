/**
 * 顔写真の保存（IndexedDB）。localStorage は 5MB ほどで、写真を入れると他の保存がこわれるため。
 * 写真はこの端末の中だけに置き、サーバーにも Gemini にも送らない（docs/design/00_全体設計.md）。
 */

const DB = "nexmax-it-quest";
const STORE = "blobs";
const KEY = "face-photo";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(blob: Blob): Promise<void> {
  await tx("readwrite", (s) => s.put(blob, KEY));
}

export async function loadPhoto(): Promise<Blob | undefined> {
  try {
    return (await tx("readonly", (s) => s.get(KEY))) as Blob | undefined;
  } catch {
    return undefined;
  }
}

export async function deletePhoto(): Promise<void> {
  await tx("readwrite", (s) => s.delete(KEY));
}

/** 写真を正方形にして小さくする（512px・JPEG）。顔が真ん中に来るように中央で切る。 */
export async function shrinkToSquare(
  source: CanvasImageSource,
  w: number,
  h: number,
): Promise<Blob> {
  const size = 512;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85),
  );
}
