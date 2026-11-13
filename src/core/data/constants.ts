import type { CityName, VenueId } from '../types';

/** 事務所向けで何も選んでいないときの既定の市・会場（ファン向けに出す）。 */
export const HOME_CITY: CityName = '久留米市';
export const HOME_VENUE_ID: VenueId = 'cbox';

/** 見込みの基準の市。5 組の久留米市の値が基準で、ほかの市はこの値の比で出す。 */
export const BASE_CITY: CityName = '久留米市';

/** 募集期限（表示用の日付）。 */
export const RECRUITMENT_DEADLINE = '2026年12月20日';

/** 成立の節目（80%）。初めの支援者の決め方と、80% の演出に使う。 */
export const MILESTONE = 0.8;

/** 支援の状況の表の割合（仮のまま。決定 26）。出典: mock の `DEMO.fan`、仕様 SP-19・SP-32。 */
export const AREA_RATIOS = {
  /** 地元の市。 */
  local: 0.58,
  /** 地元の県。 */
  pref: 0.81,
  /** 隣の県（近い順に 1 つ目・2 つ目）。 */
  near1: 0.095,
  near2: 0.068,
} as const;

/** 地元の県のうち、地元の市のほかを、同じ県の地図の市に分ける割合（82 : 18）。 */
export const AREA_OTHER_CITY_SPLIT = 0.82;

/** 推し活定期（毎月の積立。預金を増やす行動で、コースの条件にはしない）。 */
export const TEIKI = { monthlyYen: 5000, months: 12 } as const;

/** 地図の丸の半径（px）の上限・下限。基準の登録者数に対する半径が上限。 */
export const MAP_RADIUS = { max: 44, min: 7 } as const;
