import { COST } from '../data/costs';
import { COST_ITEM_IDS } from '../types';
import type { CostItemId, CostTier } from '../types';

/**
 * 費用 1 項目の上限（円）。仕様は「上限は置かない」（SP-71）が、5 項目の合計を安全な整数で正確に足せる大きさまでとする。
 * 約 1.8 千兆円で、実際の入力では当たらない。
 */
export const MAX_COST_YEN = Math.floor(Number.MAX_SAFE_INTEGER / COST_ITEM_IDS.length);

/** 費用 5 項目の金額（円）。「条件を調整」の入力値もこの形。 */
export type CostValues = Readonly<Record<CostItemId, number>>;

/** 到達ラインの内訳の 1 項目。ラベル（会場費など）は frontend の文言。 */
export interface CostItem {
  readonly id: CostItemId;
  readonly yen: number;
}

/** 費用の区分ごとの、5 項目の初めの値（価格は含まない）。 */
export function costsOfTier(tier: CostTier): CostValues {
  const row = COST[tier];
  return {
    venue: row.venue,
    prod: row.prod,
    fee: row.fee,
    travel: row.travel,
    profit: row.profit,
  };
}

/** 到達ラインの内訳 5 項目。COST_ITEM_IDS の順に並べる（決定 9）。 */
export function costItems(costs: CostValues): readonly CostItem[] {
  return COST_ITEM_IDS.map((id) => ({ id, yen: costs[id] }));
}

/**
 * 到達ライン ＝ 5 項目の合計（円）。
 * 各項目は 0 以上 MAX_COST_YEN 以下の整数だけ受ける（parseCost の結果を渡す）。それ以外は、数字のずれにせず、例外にする。
 */
export function lineOf(costs: CostValues): number {
  const items = costItems(costs);
  for (const item of items) {
    if (!Number.isInteger(item.yen) || item.yen < 0 || item.yen > MAX_COST_YEN) {
      throw new RangeError(
        `費用は 0 以上の整数（${MAX_COST_YEN} 以下）です（${item.id}: ${item.yen}）`,
      );
    }
  }
  return items.reduce((sum, item) => sum + item.yen, 0);
}

/**
 * 必要人数 ＝ ⌈到達ライン ÷ 通常の席の価格⌉（損益が合う人数。仕様 SP-12）。
 * 札を決めるのは、最低人数ではなく、この値（決定 12）。
 */
export function needOf(line: number, price: number): number {
  if (!(price > 0)) {
    throw new RangeError(`通常の席の価格は 1 円以上が必要です（受け取った値: ${price}）`);
  }
  return Math.ceil(line / price);
}

/**
 * 最低人数の初めの値 ＝ max(1, 必要人数)。
 * 全項目が 0 円（必要人数 0）のときは 1 から始める（達成率の割り算を 0 にしない。SP-16・SP-71）。
 */
export function defaultMinPeople(need: number): number {
  return Math.max(1, need);
}
