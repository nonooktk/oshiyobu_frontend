// 同じ端末の連動の受け口（設計 D-35 の `resetFan()`）。
// 事務所向けの「デモを最初に戻す」を受けた共有の部品が、ここの resetFan() を呼ぶ。ファン向けは、起動時に受け口を登録する。
// 【仮】共有の部品（`link`。F-0b）の本物の形が決まったら、登録のしかたを合わせる。
const handlers = new Set<() => void>();

/** ファン向けの受け口を登録する。外すときの関数を返す。 */
export function registerResetFan(handler: () => void): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** 人物の初期値に戻す（共有の部品が、連動のメッセージ `resetAll` を受けたときに呼ぶ）。 */
export function resetFan(): void {
  handlers.forEach((handler) => handler());
}
