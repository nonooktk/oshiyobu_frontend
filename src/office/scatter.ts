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

// ── 4 象限の区切りを動かす（要件 R-12。仕様 3.4 の案 A。統括の決定: 確認 1）──
// core が持つのは象限ごとの人数だけで、人ごとの預金額・熱量は無い。区切りを動かしたときの人数は、
// 描いた点を線の位置で数え直した「目安（デモ）」。需要の数字を画面の側で作る、統括が認めた例外。
// 区切りが初めの位置のときは、core の人数をそのまま返す。quadDots の出力は変えない。

/** 区切りの値。預金額は万円、熱量は 1〜5 */
export interface QuadLine {
  readonly deposit: number;
  readonly heat: number;
}

/** 区切りの範囲と刻み・初めの位置（目盛りの 0・15 万円・60 万円〜／1・3・5 に合わせる） */
export const QUAD_LINE_RANGE = {
  deposit: { min: 0, max: 60, step: 5, initial: 15 },
  heat: { min: 1, max: 5, step: 0.5, initial: 3 },
} as const;

export const INITIAL_QUAD_LINE: QuadLine = {
  deposit: QUAD_LINE_RANGE.deposit.initial,
  heat: QUAD_LINE_RANGE.heat.initial,
};

export const isInitialLine = (line: QuadLine): boolean =>
  line.deposit === INITIAL_QUAD_LINE.deposit && line.heat === INITIAL_QUAD_LINE.heat;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 預金額（万円）→ 図の横の座標。0〜15 万円が左半分、15〜60 万円が右半分（目盛りのとおり） */
export function xOfDeposit(deposit: number): number {
  const d = clamp(deposit, QUAD_LINE_RANGE.deposit.min, QUAD_LINE_RANGE.deposit.max);
  const mid = QUAD_LINE_RANGE.deposit.initial;
  return d <= mid
    ? QUAD_BOX.x0 + (d / mid) * (XM - QUAD_BOX.x0)
    : XM + ((d - mid) / (QUAD_LINE_RANGE.deposit.max - mid)) * (QUAD_BOX.x1 - XM);
}

/** 熱量（1〜5）→ 図の縦の座標。上ほど熱量が高い */
export function yOfHeat(heat: number): number {
  const h = clamp(heat, QUAD_LINE_RANGE.heat.min, QUAD_LINE_RANGE.heat.max);
  const mid = QUAD_LINE_RANGE.heat.initial;
  return h <= mid
    ? QUAD_BOX.y1 -
        ((h - QUAD_LINE_RANGE.heat.min) / (mid - QUAD_LINE_RANGE.heat.min)) * (QUAD_BOX.y1 - YM)
    : YM - ((h - mid) / (QUAD_LINE_RANGE.heat.max - mid)) * (YM - QUAD_BOX.y0);
}

/** 点が、区切りの線から見て、どの象限にあるか（線の上は、熱量も預金額も「区切り以上」に数える） */
export function quadOfDot(dot: Dot, line: QuadLine): QuadKey {
  const hot = dot.y <= yOfHeat(line.heat);
  const rich = dot.x >= xOfDeposit(line.deposit);
  if (hot) return rich ? 'hotRich' : 'hotPoor';
  return rich ? 'coolRich' : 'coolPoor';
}

/** 区切りの線で、点を象限ごとに数え直す */
export function countByLine(dots: readonly Dot[], line: QuadLine): Record<QuadKey, number> {
  const counts: Record<QuadKey, number> = { hotRich: 0, hotPoor: 0, coolRich: 0, coolPoor: 0 };
  for (const dot of dots) counts[quadOfDot(dot, line)] += 1;
  return counts;
}

export interface QuadPeople {
  readonly people: Readonly<Record<QuadKey, number>>;
  /** true のとき、点を数え直した目安（デモ）。false のとき、core の人数そのもの */
  readonly estimate: boolean;
}

/** 区切りの位置での、象限ごとの人数。初めの位置なら core の値、動かしたら「点の数 × 1 点あたりの人数」 */
export function quadPeopleAt(artistId: ArtistId, city: CityName, line: QuadLine): QuadPeople {
  const demand = demandOf(artistId, city);
  if (isInitialLine(line)) return { people: demand.people, estimate: false };
  const counts = countByLine(quadDots(artistId, city), line);
  const people = {
    hotRich: counts.hotRich * demand.perDot,
    hotPoor: counts.hotPoor * demand.perDot,
    coolRich: counts.coolRich * demand.perDot,
    coolPoor: counts.coolPoor * demand.perDot,
  };
  return { people, estimate: true };
}
