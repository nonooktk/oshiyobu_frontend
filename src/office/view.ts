import {
  conditionOf,
  demandOf,
  exceedsCapacity,
  levelOf,
  minPeopleGapYen,
  shortfallOf,
  upliftOf,
} from '../core';
import type { ArtistId, CityName, Condition, CostValues, Level, Uplift, VenueId } from '../core';

// 選んだ会場の判定（core の純関数だけで出す。画面の側で計算を書かない）
export interface OfficeView {
  readonly condition: Condition;
  /** 払える熱いファンの見込み */
  readonly expected: number;
  readonly level: Level;
  /** 札が「低」のときの不足（必要人数 − 見込み） */
  readonly shortfall: number;
  readonly uplift: Uplift;
  /** 最低人数が必要人数より少ないときの、通常の席だけでは足りない金額（円）。無ければ null */
  readonly gapYen: number | null;
  /** 必要人数が会場のキャパを超えるか */
  readonly overCapacity: boolean;
  /** 札が「低」か（提案を開けない） */
  readonly low: boolean;
}

interface Selection {
  readonly artistId: ArtistId;
  readonly city: CityName | null;
  readonly venueId: VenueId | null;
  readonly costs: CostValues;
  readonly minHand: number | null;
}

// ── 変わった数字を見つける（要件 R-14。仕様 2.2）──
// 比べるのは、画面に出ている ⑤ と ⑥ の数字だけ。新しい計算はしない（core の値と、4 象限の目安を並べて比べるだけ）

/** 強調の対象になる数字の名前 */
export const CHANGE_KEYS = [
  'expected',
  'level',
  'shortfall',
  'line',
  'need',
  'price',
  'upliftTotal',
  'quadHotRich',
  'quadHotPoor',
  'quadCoolRich',
  'quadCoolPoor',
] as const;
export type ChangeKey = (typeof CHANGE_KEYS)[number];

/** ある時点の、強調の対象の数字（判定が出ていないときは null） */
export type Snapshot = Readonly<Record<ChangeKey, number | string>>;

/** 4 象限の人数（初めの位置なら core の値、線を動かしたら目安。scatter.ts の quadPeopleAt の結果） */
interface QuadCounts {
  readonly hotRich: number;
  readonly hotPoor: number;
  readonly coolRich: number;
  readonly coolPoor: number;
}

export function snapshotOf(view: OfficeView | null, quad: QuadCounts | null): Snapshot | null {
  if (view === null || quad === null) return null;
  return {
    expected: view.expected,
    level: view.level,
    shortfall: view.shortfall,
    line: view.condition.line,
    need: view.condition.need,
    price: view.condition.price,
    upliftTotal: view.uplift.total,
    quadHotRich: quad.hotRich,
    quadHotPoor: quad.hotPoor,
    quadCoolRich: quad.coolRich,
    quadCoolPoor: quad.coolPoor,
  };
}

/**
 * 前と今で、値が変わった数字の名前。どちらかが null（初めて判定が出たとき・判定が消えたとき）は、何も変わっていない扱い
 * （初めの表示と「最初に戻す」のあとは強調しない。仕様 2.2）
 */
export function changedKeys(prev: Snapshot | null, next: Snapshot | null): readonly ChangeKey[] {
  if (prev === null || next === null) return [];
  return CHANGE_KEYS.filter((key) => prev[key] !== next[key]);
}

export function viewOf(selection: Selection): OfficeView | null {
  if (selection.city === null || selection.venueId === null) {
    return null;
  }
  const condition = conditionOf(selection.venueId, {
    costs: selection.costs,
    minPeople: selection.minHand,
  });
  const expected = demandOf(selection.artistId, selection.city).expected;
  const level = levelOf(expected, condition.need);
  return {
    condition,
    expected,
    level,
    shortfall: shortfallOf(expected, condition.need),
    uplift: upliftOf(condition),
    gapYen: minPeopleGapYen(condition),
    overCapacity: exceedsCapacity(condition),
    low: level === '低',
  };
}
