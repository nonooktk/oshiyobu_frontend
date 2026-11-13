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
