import { COURSES } from '../data/courses';
import type { CourseDef } from '../data/courses';
import { venueById, venuesOf } from '../data/venues';
import type { Venue } from '../data/venues';
import { COST } from '../data/costs';
import { HOME_CITY, HOME_VENUE_ID, MILESTONE } from '../data/constants';
import type { CityName, CourseId, VenueId } from '../types';
import { costsOfTier, defaultMinPeople, lineOf, needOf } from './cost';
import type { CostValues } from './cost';
import { demandOf } from './demand';

/** 会場ごとに金額・枠が決まった、応援コース 1 つ。 */
export interface CourseOffer {
  readonly id: CourseId;
  readonly name: string;
  /** 預金の条件（円以上）。 */
  readonly deposit: number;
  /** メイン口座にすることが条件か。 */
  readonly mainAccount: boolean;
  /** コースの金額（円）。 */
  readonly price: number;
  /** 枠。 */
  readonly slots: number;
  /** 枠の単位（席・名・枠）。 */
  readonly unit: string;
  /** 手に入るもの（全部）。 */
  readonly perks: readonly string[];
}

/** 会場から決まる条件。事務所向けの書き換え（費用・最低人数）を反映できる。 */
export interface Condition {
  readonly venueId: VenueId;
  readonly city: CityName;
  readonly venue: Venue;
  /** 通常の席の価格（円）。 */
  readonly price: number;
  /** 費用 5 項目（円）。 */
  readonly costs: CostValues;
  /** 到達ライン（円）＝ 5 項目の合計。 */
  readonly line: number;
  /** 必要人数 ＝ ⌈到達ライン ÷ 通常の席の価格⌉。札を決めるのは、この値（決定 12）。 */
  readonly need: number;
  /** 最低人数。手で決めていなければ max(1, 必要人数)。 */
  readonly min: number;
  /** 初めの支援者。会場の標準の費用から決め、費用を書き換えても変えない（設計 D-44）。 */
  readonly start: number;
  /** 応援コース 4 つ（金額・枠つき）。 */
  readonly courses: readonly CourseOffer[];
}

/** 条件の書き換え。何も渡さなければ、会場の標準の条件。 */
export interface ConditionInput {
  /** 費用 5 項目の入力値（0 以上の整数）。 */
  readonly costs?: CostValues;
  /** 手で決めた最低人数（1 以上の整数）。null か未指定なら、必要人数に追随する。 */
  readonly minPeople?: number | null;
}

/** 上位コースの上乗せの 1 行 ＝ (コースの金額 − 通常の席の価格) × 枠。 */
export interface UpliftRow {
  readonly courseId: CourseId;
  readonly price: number;
  readonly slots: number;
  readonly unit: string;
  readonly plus: number;
}

export interface Uplift {
  readonly rows: readonly UpliftRow[];
  readonly total: number;
}

function priceOfCourse(def: CourseDef, venuePrice: number): number {
  return def.price.kind === 'fixed' ? def.price.yen : venuePrice * def.price.multiple;
}

function slotsOfCourse(def: CourseDef, venue: Venue): number {
  switch (def.slots.kind) {
    case 'venue-capacity':
      return venue.cap;
    case 'venue-capacity-ratio':
      return Math.max(def.slots.min, Math.round(venue.cap * def.slots.ratio));
    case 'fixed':
      return def.slots.count;
  }
}

/** 会場の応援コース 4 つ（金額・枠つき）。 */
export function courseOffersOf(venueId: VenueId): readonly CourseOffer[] {
  const venue = venueById(venueId);
  const venuePrice = COST[venue.tier].price;
  return COURSES.map((def) => ({
    id: def.id,
    name: def.name,
    deposit: def.deposit,
    mainAccount: def.mainAccount,
    price: priceOfCourse(def, venuePrice),
    slots: slotsOfCourse(def, venue),
    unit: def.unit === 'venue' ? venue.unit : def.unit,
    perks: def.perks,
  }));
}

/**
 * 初めの支援者 ＝ ⌈必要人数 × 0.8⌉ − 1（申し込み 1 件でちょうど 80% に届く人数。全員が通常の席。仕様 SP-26）。
 * 浮動小数点の誤差で 1 ずれないよう、切り上げの前に 1e-9 を引く。必要人数 0 以下のときは 0。
 */
export function startSupporters(need: number): number {
  return Math.max(0, Math.ceil(need * MILESTONE - 1e-9) - 1);
}

/** 会場の条件。事務所向けの書き換え（費用・最低人数）を反映できる（仕様 SP-12・SP-05・SP-06）。 */
export function conditionOf(venueId: VenueId, input: ConditionInput = {}): Condition {
  const venue = venueById(venueId);
  const price = COST[venue.tier].price;
  const costs = input.costs ?? costsOfTier(venue.tier);
  const line = lineOf(costs);
  const need = needOf(line, price);
  // 初めの支援者は、会場の標準の費用から決める。費用を書き換えても変えない（設計 D-44）。
  const standardNeed = needOf(lineOf(costsOfTier(venue.tier)), price);
  const manualMin = input.minPeople ?? null;
  if (manualMin !== null && !(Number.isInteger(manualMin) && manualMin >= 1)) {
    throw new RangeError(`最低人数は 1 以上の整数です（受け取った値: ${manualMin}）`);
  }
  return {
    venueId,
    city: venue.city,
    venue,
    price,
    costs,
    line,
    need,
    min: manualMin ?? defaultMinPeople(need),
    start: startSupporters(standardNeed),
    courses: courseOffersOf(venueId),
  };
}

/** 必要人数が会場のキャパを超えるか（費用を上げたとき。警告を出す。提案の可否は札だけで決める。仕様 SP-72・A3）。 */
export function exceedsCapacity(condition: Pick<Condition, 'need' | 'venue'>): boolean {
  return condition.need > condition.venue.cap;
}

/** 上位コースの上乗せ。通常の席以外の各コースの (金額 − 通常の席の価格) × 枠 と、その合計（仕様 SP-14）。 */
export function upliftOf(condition: Pick<Condition, 'price' | 'courses'>): Uplift {
  const rows = condition.courses
    .filter((course) => course.id !== 'normal')
    .map((course) => ({
      courseId: course.id,
      price: course.price,
      slots: course.slots,
      unit: course.unit,
      plus: (course.price - condition.price) * course.slots,
    }));
  return { rows, total: rows.reduce((sum, row) => sum + row.plus, 0) };
}

/**
 * 市を変えたときの会場。久留米市は Cボックス、ほかは tech0 の見込みにキャパが最も近い 1 件（仕様 SP-49）。
 * 同じだけ近いときは、会場の並びで先の会場。
 */
export function defaultVenueIdOf(city: CityName): VenueId {
  if (city === HOME_CITY) {
    return HOME_VENUE_ID;
  }
  const expected = demandOf('tech0', city).expected;
  let best: Venue | undefined;
  for (const venue of venuesOf(city)) {
    if (best === undefined || Math.abs(venue.cap - expected) < Math.abs(best.cap - expected)) {
      best = venue;
    }
  }
  if (best === undefined) {
    throw new RangeError(`この市に会場がありません: ${city}`);
  }
  return best.id;
}
