import { artistById } from '../data/artists';
import type { QuadKey } from '../data/artists';
import { BASE_CITY } from '../data/constants';
import { cityIndex } from '../data/cities';
import type { ArtistId, CityName, Level } from '../types';

/** 散布図の 1 点あたりの人数の刻み（点が 150 以内になる最小の刻みを選ぶ）。 */
const DOT_STEPS = [1, 2, 3, 5, 6, 10, 15, 20, 30, 50] as const;
const MAX_DOTS = 150;
/** 刻みの最大。どの刻みでも 150 点に収まらないほど人数が多いときに使う。 */
const LARGEST_DOT_STEP = 50;

export interface Demand {
  /** 4 象限の人数。 */
  readonly people: Readonly<Record<QuadKey, number>>;
  /** 払える熱いファンの見込み（hotRich）。 */
  readonly expected: number;
  /** 1 点あたりの人数。 */
  readonly perDot: number;
  /** 点の位置を決める乱数の種。 */
  readonly seed: number;
}

const QUAD_KEYS: readonly QuadKey[] = ['hotRich', 'hotPoor', 'coolRich', 'coolPoor'];

/**
 * 需要（市 × 組）＝ 久留米市の値 ×（その市の登録者 × 熱量）÷（久留米市の登録者 × 熱量）を丸めたもの（仕様 SP-13・SP-18）。
 * 久留米市は比が 1 なので、データの値のまま。
 */
export function demandOf(artistId: ArtistId, city: CityName): Demand {
  const artist = artistById(artistId);
  const i = cityIndex(city);
  const k = cityIndex(BASE_CITY);
  const ratio =
    (valueAt(artist.reg, i) * valueAt(artist.hot, i)) /
    (valueAt(artist.reg, k) * valueAt(artist.hot, k));
  const people = {
    hotRich: Math.round(artist.quad.people.hotRich * ratio),
    hotPoor: Math.round(artist.quad.people.hotPoor * ratio),
    coolRich: Math.round(artist.quad.people.coolRich * ratio),
    coolPoor: Math.round(artist.quad.people.coolPoor * ratio),
  };
  const total = QUAD_KEYS.reduce((sum, key) => sum + people[key], 0);
  const isBase = city === BASE_CITY;
  const perDot = isBase
    ? artist.quad.perDot
    : (DOT_STEPS.find((step) => total / step <= MAX_DOTS) ?? LARGEST_DOT_STEP);
  return {
    people,
    expected: people.hotRich,
    perDot,
    seed: artist.quad.seed + (isBase ? 0 : (i + 1) * 7919),
  };
}

function valueAt(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`市の添字が範囲の外です: ${index}`);
  }
  return value;
}

/**
 * 成立の見込みの札 ＝ 見込み ÷ 必要人数。1.5 以上で「高」、1 以上 1.5 未満で「中」、1 未満で「低」（仕様 SP-13）。
 * 引数に最低人数を取らない（札は、最低人数を変えても変わらない。決定 12）。
 * 必要人数 0（全項目 0 円）のとき、見込みが 1 以上なら「高」（モックの計算のまま。SP-71）。
 */
export function levelOf(expected: number, need: number): Level {
  if (need <= 0) {
    return expected > 0 ? '高' : '低';
  }
  const ratio = expected / need;
  return ratio >= 1.5 ? '高' : ratio >= 1 ? '中' : '低';
}

/** 札が「低」のときの不足 ＝ 必要人数 − 見込み（0 未満にならない）。 */
export function shortfallOf(expected: number, need: number): number {
  return Math.max(0, need - expected);
}
