// 事務所向けの ⑤「条件を調整」の利益（手数料 10% を引いたあと）と、core に渡す費用 5 項目の組み替え
// （2026-11-20。Issue #53 の統括の了承・案 X。docs/office/要件.md の 13 節。src/office/adjust.ts）。
// - 利益の初めの値は、区分ごとに、収支シミュレーター（public/simulator.html の COST の hope）と同じ値（区分 100 は 305,000円）
// - 初めの値の到達ラインは、core の区分の値の到達ラインと同じ（280,000円・650,000円・1,500,000円 …）
// - 直したあとの到達ラインは、シミュレーターの最低条件と同じ式（⌈（費用 3 つ ＋ 利益）× 100 ÷ 90⌉）。core には出演料 0 で渡す
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { costsOfTier, lineOf, MAX_COST_YEN } from '../../src/core';
import type { CostTier } from '../../src/core';
import { coreCostsOf, FEE_RATE, fitsCore, hopeOf, lineWithFee } from '../../src/office/adjust';

// シミュレーターの区分ごとの初めの値（script の COST）を、ファイルから直接読む（値を書き写さない）
const html = readFileSync('public/simulator.html', 'utf8');
const SIM_COST = new Function(
  `${/const COST = \{[\s\S]*?\}\};/.exec(html)?.[0] ?? 'const COST = {};'}\nreturn COST;`,
)() as Record<string, { venue: number; prod: number; travel: number; hope: number }>;
const SIM_FEE_RATE = Number(/const FEE_RATE = (\d+);/.exec(html)?.[1]);
const TIERS: readonly CostTier[] = [30, 100, 300, 500, 1000];

describe('利益の初めの値（hopeOf）', () => {
  it('シミュレーターの区分の表を読めている（空振りしていない）', () => {
    expect(Object.keys(SIM_COST).sort()).toEqual(['100', '1000', '30', '300', '500']);
    expect(SIM_FEE_RATE).toBe(FEE_RATE);
  });

  it('区分 100 の利益の初めの値は 305,000円（シミュレーターと同じ）', () => {
    expect(hopeOf(costsOfTier(100))).toBe(305000);
    expect(SIM_COST['100']?.hope).toBe(305000);
  });

  it.each(TIERS)(
    '区分 %s: 利益の初めの値と、費用 3 つは、シミュレーターの初めの値と同じ',
    (tier) => {
      const costs = costsOfTier(tier);
      const sim = SIM_COST[String(tier)];
      expect(sim).toBeDefined();
      expect(hopeOf(costs)).toBe(sim?.hope);
      expect([costs.venue, costs.prod, costs.travel]).toEqual([sim?.venue, sim?.prod, sim?.travel]);
    },
  );

  it.each(TIERS)(
    '区分 %s: 初めの値の到達ラインは、core の区分の値の到達ラインと同じ（変わらない）',
    (tier) => {
      const costs = costsOfTier(tier);
      const v = { venue: costs.venue, prod: costs.prod, travel: costs.travel, hope: hopeOf(costs) };
      expect(lineWithFee(v)).toBe(lineOf(costs));
      expect(lineOf(coreCostsOf(v))).toBe(lineOf(costs));
    },
  );
});

describe('core に渡す 5 項目（coreCostsOf）', () => {
  const samples = [
    { venue: 60000, prod: 100000, travel: 120000, hope: 305000 }, // 区分 100 の初めの値
    { venue: 100000, prod: 100000, travel: 120000, hope: 305000 }, // 会場費を 100,000円に
    { venue: 0, prod: 100000, travel: 120000, hope: 305000 },
    { venue: 120, prod: 100000, travel: 120000, hope: 305000 },
    { venue: 60000, prod: 100000, travel: 120000, hope: 0 },
    { venue: 0, prod: 0, travel: 0, hope: 0 },
    { venue: 12345, prod: 6789, travel: 1, hope: 99999 },
  ];

  it.each(samples)(
    '出演料は 0、アーティストの利益は 到達ライン − 費用 3 つ。core の到達ラインは、シミュレーターの最低条件と同じ式の値',
    (v) => {
      const costs = coreCostsOf(v);
      expect(costs.fee).toBe(0);
      expect([costs.venue, costs.prod, costs.travel]).toEqual([v.venue, v.prod, v.travel]);
      // シミュレーターの simCalc と同じ式: Math.ceil((費用 3 つ ＋ 利益) * 100 / (100 - 手数料率))
      const simLine = Math.ceil(
        ((v.venue + v.prod + v.travel + v.hope) * 100) / (100 - SIM_FEE_RATE),
      );
      expect(lineOf(costs)).toBe(simLine);
      expect(costs.profit).toBe(simLine - (v.venue + v.prod + v.travel));
    },
  );

  it('会場費を 100,000円にすると、到達ラインは 694,445円（手数料 10% を含む。元の 690,000円から動く）', () => {
    expect(lineWithFee({ venue: 100000, prod: 100000, travel: 120000, hope: 305000 })).toBe(694445);
  });

  it('core の 1 項目の上限を超える組は、受けない（fitsCore）', () => {
    expect(fitsCore({ venue: 60000, prod: 100000, travel: 120000, hope: 305000 })).toBe(true);
    expect(fitsCore({ venue: 0, prod: 0, travel: 0, hope: MAX_COST_YEN })).toBe(false);
  });
});
