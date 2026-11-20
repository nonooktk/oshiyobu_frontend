import { lineOf, MAX_COST_YEN } from '../core';
import type { CostValues } from '../core';

// ⑤「条件を調整」の 4 つの入力（会場費・制作費・移動・宿泊・利益）と、core に渡す費用 5 項目の組み替え
// （2026-11-20。Issue #53 の統括の了承・案 X。docs/office/要件.md の 13 節）。
// - 「利益」は、収支シミュレーターと同じ意味: 到達ラインちょうど集まったとき、手数料 10% を引いたあとの全体利益
// - 到達ライン ＝ ⌈（会場費 ＋ 制作費 ＋ 移動・宿泊 ＋ 利益）× 100 ÷（100 − 10）⌉（シミュレーターの最低条件と同じ式）
// - core には、出演料 0・アーティストの利益 ＝ 到達ライン − 経費 3 項目 として渡す。core の計算（5 項目の合計）と区分の表は変えない（G-17）
// - 会場を選んだときは、core の区分の値のまま（出演料・アーティストの利益も、そのまま）。利益の初めの値は、その到達ラインから逆に出す
//   （区分 30・100・300 で 112,000円・305,000円・650,000円。シミュレーターの初めの値と同じ。到達ラインは 280,000円・650,000円・1,500,000円のまま）

/** 「条件を調整」に出す入力（並びのとおり） */
export const ADJUST_IDS = ['venue', 'prod', 'travel', 'hope'] as const;
export type AdjustId = (typeof ADJUST_IDS)[number];
export type AdjustValues = Readonly<Record<AdjustId, number>>;

/** OSHIYOBU の成立手数料（%）。収支シミュレーターの FEE_RATE と同じ値 */
export const FEE_RATE = 10;

/** 経費 3 項目（会場費・制作費・移動・宿泊）の合計 */
const expensesOf = (v: { venue: number; prod: number; travel: number }): number =>
  v.venue + v.prod + v.travel;

/** 到達ライン（手数料を含む）。シミュレーターの最低条件と同じ式・同じ切り上げ */
export function lineWithFee(v: AdjustValues): number {
  return Math.ceil(((expensesOf(v) + v.hope) * 100) / (100 - FEE_RATE));
}

/**
 * core の費用 5 項目から、利益（手数料を引いたあと）を出す。会場を選んだときの初めの値に使う。
 * 到達ライン × 90% − 経費 3 項目（0 円より下にはしない）
 */
export function hopeOf(costs: CostValues): number {
  return Math.max(0, Math.floor((lineOf(costs) * (100 - FEE_RATE)) / 100) - expensesOf(costs));
}

/** 4 つの入力から、core に渡す費用 5 項目を作る（出演料 0・アーティストの利益 ＝ 到達ライン − 経費 3 項目） */
export function coreCostsOf(v: AdjustValues): CostValues {
  return {
    venue: v.venue,
    prod: v.prod,
    fee: 0,
    travel: v.travel,
    profit: lineWithFee(v) - expensesOf(v),
  };
}

/** core に渡せる大きさか（アーティストの利益の 1 項目が、core の上限を超えない） */
export function fitsCore(v: AdjustValues): boolean {
  const costs = coreCostsOf(v);
  return costs.profit <= MAX_COST_YEN && Number.isSafeInteger(lineWithFee(v));
}

/** 収支シミュレーターが受け取る 1 項目の上限（円）。9 桁まで（public/simulator.html の costFromUrl と同じ） */
export const SIM_COST_MAX = 999_999_999;

/**
 * ⑤ の「収支シミュレーター」のリンク（2026-11-20。Issue #53・N-15）。会場の ID に、「条件を調整」の 4 つの値を付ける
 * （`/simulator.html?venue=FUK-019&cost=60000,100000,120000,305000`）。シミュレーターは、その会場の入力の初めの値にする。
 * どれかがシミュレーターの受け取る範囲（0〜999,999,999 円の整数）の外なら、cost は付けない（シミュレーターは区分の初めの値から始める）
 */
export function simulatorHref(simulatorVenueId: string, v: AdjustValues): string {
  const base = `/simulator.html?venue=${encodeURIComponent(simulatorVenueId)}`;
  const values = ADJUST_IDS.map((id) => v[id]);
  const fits = values.every((n) => Number.isInteger(n) && n >= 0 && n <= SIM_COST_MAX);
  return fits ? `${base}&cost=${values.join(',')}` : base;
}
