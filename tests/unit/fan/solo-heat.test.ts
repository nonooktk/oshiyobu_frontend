// ひとり体験の開催熱量: 行動のたびに、段階が 1 つずつ上がる（統括の決定 2026-11-14。QA H-08）。
// 上層（統括の表）: 開く＝点火 → 推し活定期をはじめる＝あたたまってきた → 預金を積み増して条件に届く＝ヒートアップ
//                  → 申し込む＝FEVER 目前 → 仲間を呼ぶ＝FEVER（開催決定）。
//   メイン口座・届かない額の積み増しは、段階は上げず、段階の中でゲージを少し伸ばす（どの行動でも、ゲージは伸びる）。
//   FEVER は、成立（人数と金額。core の判定）のときだけ。共有メーターあり（VITE_SHARED_METER=on）は、人数の割合から決める（従来どおり）。
// 期待値は、統括の表から導く（実装の出力を写さない）。内部の人数（74 → 75 → 93）は、画面に出ない状態で確かめる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, COURSES, conditionOf } from '../../../src/core';
import { soloHeatOf } from '../../../src/fan/domain/heat';
import type { SoloProgress } from '../../../src/fan/domain/heat';
import { harness, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Step = { step: string; stage: number; fill: number; established: boolean };

/** 開く → 定期 →（メイン口座）→ 届かない額 → 条件に届く額 → 申し込む → 仲間を呼ぶ、の各行動の直後の熱量。 */
function trace(oshi: string, seat: string, opts: { solo: boolean } = { solo: true }): Step[] {
  const h = harness(4, { solo: opts.solo });
  h.a.startPick('oshi', oshi);
  h.a.startPick('seat', seat);
  passStartOnly(h);
  const steps: Step[] = [];
  const snap = (step: string): void => {
    const v = h.view();
    steps.push({
      step,
      stage: v.heat.stage,
      fill: v.heat.fill,
      established: v.status.established,
    });
  };
  snap('開く');
  h.a.runAcct('teiki', 'home');
  snap('推し活定期');
  const t = h.view().target;
  if (!t) throw new Error('目指すコースがありません');
  if (t.mainAccount) {
    h.a.runAcct('main', 'home');
    snap('メイン口座');
  }
  const half = Math.floor(t.deposit / 2);
  h.a.runAcct('deposit', 'home', half);
  snap('預金（届かない額）');
  h.a.runAcct('deposit', 'home', t.deposit - half);
  snap('預金（条件に届く）');
  h.a.homePrimary(); // 申し込む
  snap('申し込む');
  vi.advanceTimersByTime(700 + 2510);
  h.a.closeGift();
  h.a.callFriends();
  vi.advanceTimersByTime(60_000);
  snap('仲間を呼ぶ');
  return steps;
}

describe('行動のたびに、段階が 1 つずつ上がる（推し 5 組 × コース 4 つの 20 通り）', () => {
  const cases = ARTISTS.flatMap((a) => COURSES.map((c) => [a.id, c.id] as const));

  it('組み合わせが 20 通りある（空振りの防止）', () => {
    expect(cases).toHaveLength(20);
  });

  it.each(cases)(
    '%s × %s: 点火 → あたたまってきた → ヒートアップ → FEVER 目前 → FEVER の順で、飛ばない・戻らない',
    (oshi, seat) => {
      const steps = trace(oshi, seat);
      // 通常の席の行動は 6 つ。メイン口座が条件のコースは、メイン口座が入って 7 つ
      expect(steps.map((s) => s.step)).toEqual([
        '開く',
        '推し活定期',
        ...(seat === 'normal' ? [] : ['メイン口座']),
        '預金（届かない額）',
        '預金（条件に届く）',
        '申し込む',
        '仲間を呼ぶ',
      ]);
      const stages = steps.map((s) => s.stage);
      // 段階は、1 → 2 → 3 → 4 → 5 の順に、1 つずつだけ上がる（同じ段階にとどまる行動はある。下がらず、飛ばない）
      for (let i = 1; i < stages.length; i += 1) {
        const gap = (stages[i] ?? 0) - (stages[i - 1] ?? 0);
        expect(gap === 0 || gap === 1, `${steps[i]?.step}: 段階が ${gap} 動いた`).toBe(true);
      }
      // 各行動の直後の段階
      const at = (name: string): number => steps.find((s) => s.step === name)?.stage ?? 0;
      expect(at('開く')).toBe(1); // 点火
      expect(at('推し活定期')).toBe(2); // あたたまってきた
      expect(at('預金（届かない額）')).toBe(2); // 届かない額では、段階は上げない
      expect(at('預金（条件に届く）')).toBe(3); // ヒートアップ
      expect(at('申し込む')).toBe(4); // FEVER 目前
      expect(at('仲間を呼ぶ')).toBe(5); // FEVER
      if (seat !== 'normal') expect(at('メイン口座')).toBe(2); // メイン口座は、段階を上げない
    },
  );

  it.each(cases)(
    '%s × %s: どの行動でも、ゲージは伸びる（短くならない・止まらない）',
    (oshi, seat) => {
      const fills = trace(oshi, seat).map((s) => s.fill);
      for (let i = 1; i < fills.length; i += 1) {
        expect(fills[i], `${i} 番目の行動のあと`).toBeGreaterThan(fills[i - 1] ?? 0);
      }
      expect(fills.at(-1)).toBe(1); // FEVER で満タン
    },
  );

  it.each(cases)('%s × %s: FEVER は、成立（人数と金額）のときだけ', (oshi, seat) => {
    for (const s of trace(oshi, seat)) {
      expect(s.stage === 5, s.step).toBe(s.established);
    }
  });
});

describe('共有メーターあり（VITE_SHARED_METER=on）は、従来どおり、人数の割合から決める', () => {
  it('開いた直後から ヒートアップ（人数 74 ÷ 93）。定期・預金では、段階は動かない', () => {
    const steps = trace('tech0', 'normal', { solo: false });
    const names = steps.map((s) => `${s.step}:${s.stage}`);
    expect(names.slice(0, 5)).toEqual([
      '開く:3',
      '推し活定期:3',
      '預金（届かない額）:3',
      '預金（条件に届く）:3',
      '申し込む:4',
    ]);
  });
});

describe('内部の人数は変わらない（74 → 75 → 成立の人数）。FEVER は成立のときだけ', () => {
  it('基準の公演で、開いたとき 74・申し込むと 75・仲間を呼ぶと 93（最低人数）で成立', () => {
    const cond = conditionOf('cbox');
    const h = harness(4, { solo: true });
    passStartOnly(h);
    expect(h.view().status.supporters).toBe(cond.start);
    expect(cond.start).toBe(74);
    h.a.runAcct('teiki', 'home');
    h.a.runAcct('deposit', 'home', 20_000);
    expect(h.view().status.supporters).toBe(74); // 段階が上がっても、人数は動かない
    h.a.homePrimary();
    expect(h.view().status.supporters).toBe(75);
    expect(h.view().heat.stage).toBe(4);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    h.a.callFriends();
    vi.advanceTimersByTime(60_000);
    expect(h.view().status.supporters).toBe(cond.min);
    expect(cond.min).toBe(93);
    expect(h.view().status.established).toBe(true);
    expect(h.view().heat.stage).toBe(5);
  });
});

describe('soloHeatOf（行動の進み → 熱量）', () => {
  const base: SoloProgress = {
    established: false,
    joined: false,
    called: false,
    started: true,
    ready: 0,
  };

  it('推し活定期をはじめる前は、条件の達成度にかかわらず 点火', () => {
    expect(soloHeatOf({ ...base, started: false, ready: 0 }).stage).toBe(1);
    expect(soloHeatOf({ ...base, started: false, ready: 1 }).stage).toBe(1);
  });

  it('条件の達成度が上がるほど、ゲージは伸びる。条件がそろうまでは あたたまってきた、そろうと ヒートアップ', () => {
    const readies = [0, 0.1, 0.25, 0.5, 0.75, 0.99];
    const heats = readies.map((ready) => soloHeatOf({ ...base, ready }));
    expect(heats.every((h) => h.stage === 2)).toBe(true);
    const fills = heats.map((h) => h.fill);
    expect([...fills].sort((a, b) => a - b)).toEqual(fills);
    expect(new Set(fills).size).toBe(fills.length); // どの達成度でも、少しずつ伸びる
    const ready = soloHeatOf({ ...base, ready: 1 });
    expect(ready.stage).toBe(3);
    expect(ready.fill).toBeGreaterThan(fills.at(-1) ?? 1);
  });

  it('範囲の外の達成度でも落ちない（0 未満は 0、1 超は 1 とみなす）', () => {
    expect(soloHeatOf({ ...base, ready: -3 })).toEqual(soloHeatOf({ ...base, ready: 0 }));
    expect(soloHeatOf({ ...base, ready: 7 })).toEqual(soloHeatOf({ ...base, ready: 1 }));
  });

  it('申し込むと FEVER 目前。成立に届かないまま仲間を呼んだときは、FEVER 目前のまま少し伸びる。FEVER にはならない', () => {
    const joined = soloHeatOf({ ...base, joined: true, ready: 1 });
    const called = soloHeatOf({ ...base, joined: true, called: true, ready: 1 });
    expect(joined.stage).toBe(4);
    expect(called.stage).toBe(4);
    expect(called.fill).toBeGreaterThan(joined.fill);
    expect(called.fill).toBeLessThan(1);
  });

  it('成立したときだけ FEVER。ゲージは満タンで、次の段階の星は無い', () => {
    const fever = soloHeatOf({ ...base, joined: true, called: true, ready: 1, established: true });
    expect(fever).toMatchObject({ stage: 5, name: 'FEVER', fill: 1, next: null });
  });

  it('名前にも、ことばにも、数字が入らない', () => {
    for (const p of [
      { ...base, started: false },
      { ...base, ready: 0.5 },
      { ...base, ready: 1 },
      { ...base, joined: true, ready: 1 },
      { ...base, joined: true, called: true, ready: 1, established: true },
    ]) {
      const heat = soloHeatOf(p);
      expect(`${heat.name}${heat.distance}`).not.toMatch(/\d|[０-９]/);
    }
  });
});
