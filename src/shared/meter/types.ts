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
