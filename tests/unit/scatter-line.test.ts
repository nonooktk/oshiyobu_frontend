// 4 象限の区切りを動かしたときの数え直し（要件 R-12。仕様 3.4 の案 A）。quadDots の出力は変えない
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS, CITY_NAMES, demandOf } from '../../src/core';
import type { QuadKey } from '../../src/core';
import {
  countByLine,
  INITIAL_QUAD_LINE,
  isInitialLine,
  QUAD_BOX,
  QUAD_MID,
  quadDots,
  quadPeopleAt,
  xOfDeposit,
  yOfHeat,
} from '../../src/office/scatter';

const KEYS: readonly QuadKey[] = ['hotRich', 'hotPoor', 'coolRich', 'coolPoor'];
const sum = (r: Readonly<Record<QuadKey, number>>): number => KEYS.reduce((s, k) => s + r[k], 0);

describe('区切りの値と、図の座標', () => {
  it('預金額 0・15・60 万円は、左端・中央・右端', () => {
    expect(xOfDeposit(0)).toBe(QUAD_BOX.x0);
    expect(xOfDeposit(15)).toBe(QUAD_MID.x);
    expect(xOfDeposit(60)).toBe(QUAD_BOX.x1);
  });

  it('熱量 1・3・5 は、下端・中央・上端', () => {
    expect(yOfHeat(1)).toBe(QUAD_BOX.y1);
    expect(yOfHeat(3)).toBe(QUAD_MID.y);
    expect(yOfHeat(5)).toBe(QUAD_BOX.y0);
  });

  it('範囲の外は、端に収める', () => {
    expect(xOfDeposit(-5)).toBe(QUAD_BOX.x0);
    expect(xOfDeposit(99)).toBe(QUAD_BOX.x1);
    expect(yOfHeat(0)).toBe(QUAD_BOX.y1);
    expect(yOfHeat(9)).toBe(QUAD_BOX.y0);
  });
});

describe('区切りの線で数え直す', () => {
  it('初めの位置では、象限ごとの点の数が quadDots の置き方と一致する（5 組 × 9 市）', () => {
    for (const artist of ARTIST_IDS) {
      for (const city of CITY_NAMES) {
        const demand = demandOf(artist, city);
        const counts = countByLine(quadDots(artist, city), INITIAL_QUAD_LINE);
        for (const key of KEYS) {
          const people = demand.people[key];
          const want = people > 0 ? Math.max(1, Math.round(people / demand.perDot)) : 0;
          expect(counts[key], `${artist}・${city}・${key}`).toBe(want);
        }
      }
    }
  });

  it('初めの位置では、core の人数をそのまま返し、目安ではない', () => {
    const got = quadPeopleAt('tech0', '久留米市', INITIAL_QUAD_LINE);
    expect(got.estimate).toBe(false);
    expect(got.people).toEqual(demandOf('tech0', '久留米市').people);
    expect(isInitialLine(INITIAL_QUAD_LINE)).toBe(true);
  });

  it('どこに動かしても、4 つの合計は変わらない（点の数 × 1 点あたりの人数）', () => {
    const demand = demandOf('tech0', '久留米市');
    const total = quadDots('tech0', '久留米市').length * demand.perDot;
    for (const deposit of [0, 5, 20, 35, 60]) {
      for (const heat of [1, 2.5, 3.5, 5]) {
        const got = quadPeopleAt('tech0', '久留米市', { deposit, heat });
        expect(got.estimate).toBe(true);
        expect(sum(got.people)).toBe(total);
      }
    }
  });

  it('預金額の区切りを右へ動かすと、右上の人数は増えない。熱量の区切りを上げても増えない', () => {
    let prev = Infinity;
    for (const deposit of [20, 30, 40, 50, 60]) {
      const n = quadPeopleAt('tech0', '久留米市', { deposit, heat: 3 }).people.hotRich;
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
    prev = Infinity;
    for (const heat of [3.5, 4, 4.5, 5]) {
      const n = quadPeopleAt('tech0', '久留米市', { deposit: 15, heat }).people.hotRich;
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });

  it('quadDots の出力は、区切りを使っても変わらない', () => {
    const before = quadDots('tech0', '久留米市');
    quadPeopleAt('tech0', '久留米市', { deposit: 40, heat: 4 });
    expect(quadDots('tech0', '久留米市')).toEqual(before);
  });
});
