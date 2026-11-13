import type { CostItemId, CostTier } from '../types';

/** 費用の区分ごとの値。price は通常の席（チケット）の価格。 */
export type CostRow = Readonly<Record<CostItemId, number>> & { readonly price: number };

/**
 * 費用の区分（仮置き。会場の公開料金とは別）。収支シミュレーター（simulator.html）の COST と同じ値。
 * 出典: mock/index.html の `DEMO.COST`、仕様 SP-19「費用の区分」。区分 500・1000 は 12 件の会場では使わない。
 * 値を変えたら CORE_VERSION を上げる（simulator との一致は契約テストで確かめる。設計 D-21）。
 */
export const COST: Readonly<Record<CostTier, CostRow>> = {
  30: { venue: 30000, prod: 30000, fee: 100000, travel: 80000, profit: 40000, price: 7000 },
  100: { venue: 60000, prod: 100000, fee: 250000, travel: 120000, profit: 120000, price: 7000 },
  300: { venue: 200000, prod: 300000, fee: 500000, travel: 200000, profit: 300000, price: 6000 },
  500: { venue: 300000, prod: 600000, fee: 800000, travel: 250000, profit: 500000, price: 7000 },
  1000: {
    venue: 600000,
    prod: 1200000,
    fee: 1500000,
    travel: 350000,
    profit: 1000000,
    price: 7500,
  },
};
