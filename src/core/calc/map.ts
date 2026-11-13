import { ARTISTS, artistById } from '../data/artists';
import { MAP_RADIUS } from '../data/constants';
import type { ArtistId } from '../types';

/** 丸の大きさの基準になる登録者数 ＝ 5 組 × 9 市の最大（krs48 の福岡市）。 */
export const REG_MAX = Math.max(...ARTISTS.flatMap((artist) => artist.reg));

/**
 * 丸の半径 ＝ max(7, 44 × √(登録者数 ÷ 21,800))（仕様 SP-10）。面積が登録者数に比例する。
 * 小さい丸は、半径の下限でそろえる。
 */
export function radiusOf(reg: number): number {
  return Math.max(MAP_RADIUS.min, MAP_RADIUS.max * Math.sqrt(reg / REG_MAX));
}

/** 色の段（淡い 0 → 濃い 4）。 */
export type ColorStep = 0 | 1 | 2 | 3 | 4;

/**
 * 色の段 ＝ min(4, ⌊(値 − 最小) ÷ (最大 − 最小) × 5⌋)（仕様 SP-10）。最小・最大は、選んだ組の 9 市の値。
 * 最大 ＝ 最小のときは、分母を 1 にする。
 */
export function colorStep(values: readonly number[], value: number): ColorStep {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = Math.min(4, Math.floor(((value - lo) / (hi - lo || 1)) * 5));
  return step as ColorStep;
}

/** 組の 9 市（CITIES の並び）の、指標の値。reg ＝ 登録者数（人数）、hot ＝ 払える熱量。 */
export function metricValues(artistId: ArtistId, metric: 'reg' | 'hot'): readonly number[] {
  return artistById(artistId)[metric];
}
