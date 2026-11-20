import { artistById } from '../data/artists';
import type { QuadKey } from '../data/artists';
import { BASE_CITY } from '../data/constants';
import { cityIndex } from '../data/cities';
import type { ArtistId, CityName, Level } from '../types';

/** 散布図の 1 点あたりの人数の刻み（点が 150 以内になる最小の刻みを選ぶ）。 */
const DOT_STEPS = [1, 2, 3, 5, 6, 10, 15, 20, 30, 50, 100, 150, 200] as const;
const MAX_DOTS = 150;
/** 刻みの最大。どの刻みでも 150 点に収まらないほど人数が多いときに使う。 */
const LARGEST_DOT_STEP = 200;

export interface Demand {
  /** 4 象限の人数。合計は、その市の登録者数と同じ。 */
  readonly people: Readonly<Record<QuadKey, number>>;
  /** 払える熱いファンの見込み（hotRich）。 */
  readonly expected: number;
  /** 1 点あたりの人数（合計 ÷ 刻み が 150 以下になる最小の刻み。合計は登録者数）。 */
  readonly perDot: number;
  /** 点の位置を決める乱数の種。 */
  readonly seed: number;
}

/** hotRich を引いた残りを配る 3 つの象限（端数が同じときは、この順に 1 人ずつ足す）。 */
const REST_KEYS = ['hotPoor', 'coolRich', 'coolPoor'] as const;
type RestKey = (typeof REST_KEYS)[number];

/**
 * 需要（市 × 組）。4 つの合計は、その市の登録者数と同じ（仕様 SP-13・SP-18）。
 * hotRich ＝ 久留米市の hotRich ×（その市の登録者 × 熱量）÷（久留米市の登録者 × 熱量）を丸めたもの。
 * 久留米市は比が 1 なので、hotRich はデータの値のまま。
 * 残りの 3 つ ＝ 登録者数 − hotRich を、久留米市のデータの 3 つの値の比で配ったもの（最大剰余法）。
 */
export function demandOf(artistId: ArtistId, city: CityName): Demand {
  const artist = artistById(artistId);
  const i = cityIndex(city);
  const k = cityIndex(BASE_CITY);
  const reg = valueAt(artist.reg, i);
  const ratio = (reg * valueAt(artist.hot, i)) / (valueAt(artist.reg, k) * valueAt(artist.hot, k));
  const hotRich = Math.round(artist.quad.people.hotRich * ratio);
  const people = { hotRich, ...splitRest(reg - hotRich, artist.quad.people) };
  const perDot = DOT_STEPS.find((step) => reg / step <= MAX_DOTS) ?? LARGEST_DOT_STEP;
  return {
    people,
    expected: hotRich,
    perDot,
    seed: artist.quad.seed + (city === BASE_CITY ? 0 : (i + 1) * 7919),
  };
}

/**
 * 残りの人数を、基準の 3 つの値の比で配る（最大剰余法）。
 * まず切り捨て、足りない分を、切り捨てた端数の大きい順に 1 人ずつ足す。端数が同じなら REST_KEYS の順。
 * 残りが負なら例外。3 つの比の合計が 0 なら、残りをすべて coolPoor へ。
 */
function splitRest(rest: number, base: Readonly<Record<QuadKey, number>>): Record<RestKey, number> {
  if (rest < 0) {
    throw new RangeError(`残りの人数が負です: ${rest}`);
  }
  const weightSum = REST_KEYS.reduce((sum, key) => sum + base[key], 0);
  if (weightSum === 0) {
    return { hotPoor: 0, coolRich: 0, coolPoor: rest };
  }
  const parts = REST_KEYS.map((key) => {
    const scaled = rest * base[key];
    const fraction = scaled % weightSum;
    return { key, count: (scaled - fraction) / weightSum, fraction };
  });
  const people: Record<RestKey, number> = { hotPoor: 0, coolRich: 0, coolPoor: 0 };
  for (const { key, count } of parts) {
    people[key] = count;
  }
  const shortage = rest - parts.reduce((sum, part) => sum + part.count, 0);
  // sort は安定なので、端数が同じなら REST_KEYS の順のまま残る。
  const byFraction = [...parts].sort((a, b) => b.fraction - a.fraction);
  for (const { key } of byFraction.slice(0, shortage)) {
    people[key] += 1;
  }
  return people;
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
