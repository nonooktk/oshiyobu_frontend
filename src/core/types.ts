// core 全体で使う、名前・ID の型。
// 値の並び（as const の配列）から型を作り、データの打ち間違いを型で止める。

/** アーティスト 5 組の ID（表示順）。名前・頭文字・絵は frontend が持つ（設計 D-06）。 */
export const ARTIST_IDS = ['tech0', 'krs48', 'riji', 'terao', 'heisei'] as const;
export type ArtistId = (typeof ARTIST_IDS)[number];

/** 地図の 9 市（地図の並び）。市の名前そのものを ID に使う（仕様 SP-19・SP-64）。 */
export const CITY_NAMES = [
  '福岡市',
  '北九州市',
  '久留米市',
  '佐賀市',
  '長崎市',
  '熊本市',
  '大分市',
  '宮崎市',
  '鹿児島市',
] as const;
export type CityName = (typeof CITY_NAMES)[number];

export const PREF_NAMES = [
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
] as const;
export type PrefName = (typeof PREF_NAMES)[number];

/** 会場 12 件の ID。久留米市の 2 件は cbox・riseup、ほかは会場データの ID（仕様 SP-19）。 */
export const VENUE_IDS = [
  'FUK-020',
  'FUK-016',
  'FUK-012',
  'FUK-018',
  'cbox',
  'riseup',
  'SAG-003',
  'NGS-001',
  'KMM-002',
  'OIT-004',
  'MYZ-004',
  'KGS-001',
] as const;
export type VenueId = (typeof VENUE_IDS)[number];

/** 費用の区分（会場のキャパの目安）。 */
export const COST_TIERS = [30, 100, 300, 500, 1000] as const;
export type CostTier = (typeof COST_TIERS)[number];

/** 到達ラインの内訳 5 項目（この順に並べる。ラベルは frontend の文言）。 */
export const COST_ITEM_IDS = ['venue', 'prod', 'fee', 'travel', 'profit'] as const;
export type CostItemId = (typeof COST_ITEM_IDS)[number];

/** 応援コース 4 つ（この順に並べる）。 */
export const COURSE_IDS = ['normal', 'front', 'special', 'top'] as const;
export type CourseId = (typeof COURSE_IDS)[number];

/** 成立の見込みの札。 */
export type Level = '高' | '中' | '低';

/** 公演 ID。推しと会場の組（`<推しの id>:<会場の id>`。5 × 12 = 60 件）。 */
export type PerformanceId = `${ArtistId}:${VenueId}`;
