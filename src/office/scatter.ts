import { artistById, demandOf } from '../core';
import type { ArtistId, CityName, QuadKey } from '../core';

// 熱量 × 資金の散布図の点（設計 D-06・SP-18）。点の位置は、固定の種の乱数で決め、毎回同じ並びにする。
// 人数・刻み・種・偏りは core の値。点を置くだけが、画面の仕事

export interface Dot {
  readonly x: number;
  readonly y: number;
  readonly hot: boolean;
}

/** mulberry32（固定の種の乱数）。同じ種なら、同じ並びになる */
export function rng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 描く範囲。左右の真ん中が預金額の境界、上下の真ん中が熱量の境界 */
export const QUAD_BOX = { x0: 46, x1: 510, y0: 12, y1: 290, pad: 9 } as const;
const XM = (QUAD_BOX.x0 + QUAD_BOX.x1) / 2;
const YM = (QUAD_BOX.y0 + QUAD_BOX.y1) / 2;
const AREAS: Readonly<Record<QuadKey, readonly [number, number, number, number]>> = {
  hotRich: [XM, QUAD_BOX.x1, QUAD_BOX.y0, YM],
  hotPoor: [QUAD_BOX.x0, XM, QUAD_BOX.y0, YM],
  coolRich: [XM, QUAD_BOX.x1, YM, QUAD_BOX.y1],
  coolPoor: [QUAD_BOX.x0, XM, YM, QUAD_BOX.y1],
};
const KEYS: readonly QuadKey[] = ['hotRich', 'hotPoor', 'coolRich', 'coolPoor'];

export function quadDots(artistId: ArtistId, city: CityName): readonly Dot[] {
  const demand = demandOf(artistId, city);
  const spread = artistById(artistId).quad.spread;
  const rand = rng(demand.seed);
  const dots: Dot[] = [];
  for (const key of KEYS) {
    const people = demand.people[key];
    const [x0, x1, y0, y1] = AREAS[key];
    const count = people > 0 ? Math.max(1, Math.round(people / demand.perDot)) : 0;
    const [ex, ey] = spread[key] ?? [1, 1];
    const { pad } = QUAD_BOX;
    for (let i = 0; i < count; i += 1) {
      const x = x0 + pad + rand() ** ex * (x1 - x0 - pad * 2);
      const y = y0 + pad + rand() ** ey * (y1 - y0 - pad * 2);
      dots.push({ x, y, hot: key === 'hotRich' });
    }
  }
  return dots;
}

export const QUAD_MID = { x: XM, y: YM } as const;
