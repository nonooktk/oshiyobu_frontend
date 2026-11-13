import type { CityName, CostTier, VenueId } from '../types';

export interface Venue {
  readonly id: VenueId;
  readonly city: CityName;
  readonly name: string;
  /** キャパ（席数・人数）。 */
  readonly cap: number;
  /** キャパの単位。 */
  readonly unit: '席' | '名';
  /** 種別（ライブハウス・ホールなど）。 */
  readonly type: string;
  /** 費用の区分。 */
  readonly tier: CostTier;
  /** 公開料金の目安（円）。会場カードに添えるだけで、到達ラインの計算には使わない。 */
  readonly publicFee?: number;
  /** 候補日（架空）。 */
  readonly day: string;
  /** 収支シミュレーター（simulator.html）の会場 ID。シミュレーターに無い会場は持たない（設計 D-21）。 */
  readonly simulatorVenueId?: string;
}

/**
 * 会場 12 件（市の並び順）。名前とキャパは公開情報。候補日は架空。
 * 出典: mock/index.html の `DEMO.venues`、仕様 SP-19「会場 12 件」。久留米市の公開料金は確認日 2026-11-12。
 * 候補の決まり（モック D-22・Q-22）: 久留米市以外は、tech0 の見込みが必要人数に届く会場だけ・同じ区分は 1 件・最大 3 件。
 * 1 件も届かない市（大分市・宮崎市）は、最も近い 1 件だけ。久留米市の 2 件は固定。
 */
export const VENUES: readonly Venue[] = [
  {
    id: 'FUK-020',
    city: '福岡市',
    name: 'music hall fragile',
    cap: 50,
    unit: '名',
    type: 'ライブハウス',
    tier: 30,
    day: '2027年2月6日（土）',
    simulatorVenueId: 'FUK-020',
  },
  {
    id: 'FUK-016',
    city: '福岡市',
    name: 'DRUM SON',
    cap: 180,
    unit: '名',
    type: 'ライブハウス',
    tier: 100,
    day: '2027年2月20日（土）',
    simulatorVenueId: 'FUK-016',
  },
  {
    id: 'FUK-012',
    city: '福岡市',
    name: 'DRUM Be-1',
    cap: 300,
    unit: '名',
    type: 'ライブハウス',
    tier: 300,
    day: '2027年2月27日（土）',
    simulatorVenueId: 'FUK-012',
  },
  {
    id: 'FUK-018',
    city: '北九州市',
    name: 'LIVE&BAR WHIPPING POST',
    cap: 120,
    unit: '名',
    type: 'ライブハウス',
    tier: 100,
    day: '2027年2月13日（土）',
    simulatorVenueId: 'FUK-018',
  },
  {
    id: 'cbox',
    city: '久留米市',
    name: '久留米シティプラザ Cボックス',
    cap: 144,
    unit: '席',
    type: '多目的',
    tier: 100,
    publicFee: 70860,
    day: '2027年2月13日（土）',
    simulatorVenueId: 'FUK-019',
  },
  {
    // 収支シミュレーターに無い会場（simulatorVenueId を持たない。設計 D-21）。
    id: 'riseup',
    city: '久留米市',
    name: 'RISE UP（久留米市日吉町）',
    cap: 150,
    unit: '名',
    type: 'ライブハウス',
    tier: 100,
    publicFee: 70000,
    day: '2027年2月6日（土）',
  },
  {
    id: 'SAG-003',
    city: '佐賀市',
    name: 'Event Space R BASE',
    cap: 60,
    unit: '席',
    type: 'その他',
    tier: 30,
    day: '2027年2月6日（土）',
    simulatorVenueId: 'SAG-003',
  },
  {
    id: 'NGS-001',
    city: '長崎市',
    name: 'Ohana Cafe',
    cap: 40,
    unit: '名',
    type: 'カフェ・バー',
    tier: 30,
    day: '2027年2月13日（土）',
    simulatorVenueId: 'NGS-001',
  },
  {
    id: 'KMM-002',
    city: '熊本市',
    name: 'Restaurant Bar CIB',
    cap: 100,
    unit: '名',
    type: 'カフェ・バー',
    tier: 100,
    day: '2027年2月6日（土）',
    simulatorVenueId: 'KMM-002',
  },
  {
    id: 'OIT-004',
    city: '大分市',
    name: 'BRICK BLOCK',
    cap: 100,
    unit: '名',
    type: 'ライブハウス',
    tier: 100,
    day: '2027年2月13日（土）',
    simulatorVenueId: 'OIT-004',
  },
  {
    id: 'MYZ-004',
    city: '宮崎市',
    name: 'メディキット県民文化センター イベントホール',
    cap: 300,
    unit: '席',
    type: 'ホール',
    tier: 300,
    day: '2027年2月20日（土）',
    simulatorVenueId: 'MYZ-004',
  },
  {
    id: 'KGS-001',
    city: '鹿児島市',
    name: 'Live HEAVEN',
    cap: 60,
    unit: '席',
    type: 'ライブハウス',
    tier: 30,
    day: '2027年2月6日（土）',
    simulatorVenueId: 'KGS-001',
  },
];

/** 会場の ID から会場を返す。知らない ID は例外。 */
export function venueById(id: VenueId): Venue {
  const venue = VENUES.find((item) => item.id === id);
  if (venue === undefined) {
    throw new RangeError(`知らない会場です: ${id}`);
  }
  return venue;
}

/** 市の会場候補（VENUES の並び順）。 */
export function venuesOf(city: CityName): readonly Venue[] {
  return VENUES.filter((venue) => venue.city === city);
}
