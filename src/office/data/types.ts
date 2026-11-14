// 事務所向け専用のデータ置き場の型（表示用の、実在のデータ。決まりは docs/守ること.md の G-30）。
// 入れてよいのは、出典の URL と、確認した日がそろった、公開の事実だけ。
// 需要・預金・費用・損益の数字と、個人の情報は入れない。損益・判定・需要の計算には使わない（計算は core のまま）。
// core の会場 12 件以外には、判定（到達ライン・必要人数・札）を出せない。
import type { PrefName, VenueId } from '../../core';

/** 実在の会場。出典つきの公開の情報だけ。 */
export interface VenueRecord {
  /** 会場の ID。例: 'FUK-001'（public/simulator.html の venue_id と同じ形）。 */
  readonly id: string;
  readonly name: string;
  readonly pref: PrefName;
  /** 住所の市区（例: 福岡市中央区）。 */
  readonly city: string;
  /** 収容人数。 */
  readonly capacity: number;
  /** 収容人数が何の値か（公式の値・チケットサイトなどの二次情報）。 */
  readonly capacityBasis: string;
  /** 会場の種類（ライブハウス・ホールなど）。 */
  readonly type: string;
  /** 収容人数の出典。https:// で始まる、誰でも開ける公開のページ。必須。 */
  readonly sourceUrl: string;
  /** 自分が出典を開いて確かめた日（YYYY-MM-DD）。必須。ほかの人の日付を写さない。 */
  readonly checkedOn: string;
  /** core の会場 12 件のどれかに当たるとき、その ID。 */
  readonly coreVenueId?: VenueId;
}

/** 過去の公演（実在）。 */
export interface PastEvent {
  /** VenueRecord の id。 */
  readonly venueId: string;
  /** 芸名・団体名。公開の告知にある名前だけ。 */
  readonly artist: string;
  /** 公演の日（YYYY-MM-DD）。 */
  readonly date: string;
  /** 公演の出典。https:// で始まる、誰でも開ける公開のページ。必須。 */
  readonly sourceUrl: string;
  /** 自分が出典を開いて確かめた日（YYYY-MM-DD）。必須。 */
  readonly checkedOn: string;
  readonly title?: string;
  readonly genre?: string;
}
