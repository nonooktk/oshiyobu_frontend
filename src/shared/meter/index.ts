import type { PerformanceId } from '../../core';

// 共有メーター（設計 D-17・D-18・D-41）。ファン向けの画面が使う口。
// 今は、サーバーにつながらない形（初期値のまま動く）。API の接続先（VITE_API_BASE）を渡せるようになったら、
// 同じ型のまま、取得・申し込みの通信が動く。画面の部品から fetch を呼ばない。通信はこのフォルダの中だけ。

/** 接続の状態。ファン向けの画面には出さない（発表者用の画面で見る。D-18 の規則 3） */
export type MeterStatus = 'offline' | 'connecting' | 'ok' | 'failing';

/** 取得の契機（D-18 の規則 8）。これ以外のときに、画面から取得を頼まない */
export type MeterFetchReason = 'open' | 'course-select' | 'performance-changed';

export interface SharedMeter {
  /** サーバーの申し込みの件数（reset のあとの件数で、0 から。開始人数は含まない）。まだ取れていなければ 0 */
  readonly joined: number;
  readonly status: MeterStatus;
  /** 自分の申し込みが、サーバーに数えられた印（応答の counted）。reset を検知したら false に戻る */
  readonly mineCounted: boolean;
  /** reset を検知するたびに増える。画面は、変わったら「自分の加算・擬似の仲間の加算」を消す（D-18 の規則 10） */
  readonly resetEpoch: number;
}

const OFFLINE: SharedMeter = { joined: 0, status: 'offline', mineCounted: false, resetEpoch: 0 };

/** 公演のメーター。購読している間だけ、サーバーを見に行く。performanceId が null なら、何もしない */
export function useSharedMeter(performanceId: PerformanceId | null): SharedMeter {
  void performanceId;
  return OFFLINE;
}

/** 申し込みを送る。端末の番号で冪等。すぐ戻り、失敗しても例外を投げず、再送は内側で行う */
export function joinPerformance(performanceId: PerformanceId): void {
  void performanceId;
}

/** サーバーの人数を、1 回取りに行くよう頼む（前の取得から 1.8 秒たってから送る） */
export function requestMeterFetch(reason: MeterFetchReason): void {
  void reason;
}

/** reset を検知したときの動きを登録する。返す関数で解除する */
export function onMeterReset(handler: () => void): () => void {
  void handler;
  return () => {};
}

/** 通信が飛んでいる間は true（絵などの先読みは、この間は始めない。D-40） */
export function isMeterBusy(): boolean {
  return false;
}
