// 散布図の点（I-12。設計 D-06・SP-18）。固定の種の乱数で、毎回同じ並びになる
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS, CITY_NAMES, demandOf } from '../../src/core';
import { quadDots, rng } from '../../src/office/scatter';

describe('散布図の点', () => {
  it('2 回描いても、全点の座標が同じ（固定の種）', () => {
    expect(quadDots('tech0', '久留米市')).toEqual(quadDots('tech0', '久留米市'));
  });

  it('同じ種の乱数は同じ並び、違う種は違う並び', () => {
    const a = rng(20261123);
    const b = rng(20261123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it('tech0・久留米市: 見込み 187人（熱くて資金もある点は 62 点＝ 1 点 3 人）。全点が描く範囲の中', () => {
    const demand = demandOf('tech0', '久留米市');
    expect(demand.expected).toBe(187);
    const dots = quadDots('tech0', '久留米市');
    expect(dots.filter((dot) => dot.hot)).toHaveLength(Math.round(187 / demand.perDot));
    for (const dot of dots) {
      expect(dot.x).toBeGreaterThanOrEqual(46);
      expect(dot.x).toBeLessThanOrEqual(510);
      expect(dot.y).toBeGreaterThanOrEqual(12);
      expect(dot.y).toBeLessThanOrEqual(290);
    }
  });

  it('5 組 × 9 市のすべてで、点は 150 以内（1 つの象限に 1 点以上のとき、象限の数だけ足して）', () => {
    for (const artist of ARTIST_IDS) {
      for (const city of CITY_NAMES) {
        expect(quadDots(artist, city).length).toBeLessThanOrEqual(154);
      }
    }
  });
});
