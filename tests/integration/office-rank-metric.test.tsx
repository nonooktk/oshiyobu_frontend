// 事務所向け（/）の ① の右の市の一覧: 地図の指標に合わせて、行に出す数字を変える（N-2・N-3。Issue #48 の統括の了承 2026-11-19）。
// docs/office/要件.md の N23-1〜N23-3・V-30・V-31。
// - 人数: 登録の人数だけ（「登録 4,820人」）。見込みの人数と割合は出さない
// - 払える熱量: 見込みの人数（「311人」）と、割合のゲージ（目盛りは 0〜20%。20% を超える値は右の端で止める）。登録の人数と割合の文字は出さない
// - 並び順は、どちらも見込みの多い順（N23-2）。読み上げ（行の名前）には、見込み・登録・割合が、これまでどおり入る
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, CITIES, demandOf, metricValues } from '../../src/core';
import { App } from '../../src/office/App';
import { cityRankOf } from '../../src/office/components/CityRank';
import { GAUGE_MAX_SHARE, gaugeOfShare } from '../../src/office/share';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const people = (n: number) => `${n.toLocaleString('ja-JP')}人`;
const rows = () => within(screen.getByTestId('city-rank')).getAllByRole('button');
const rowOf = (city: string) => {
  const row = rows().find((button) => button.textContent?.includes(city));
  if (row === undefined) throw new Error(`一覧に${city}がありません`);
  return row;
};
const widthOf = (row: HTMLElement): number => {
  const bar = within(row).getByTestId('rank-gauge').querySelector('i');
  return Number.parseFloat(bar?.style.width ?? 'NaN');
};

describe('ゲージの長さ（gaugeOfShare）', () => {
  it('右の端は 20%。割合 ÷ 20 を、0〜100 の長さにする', () => {
    expect(GAUGE_MAX_SHARE).toBe(20);
    expect(gaugeOfShare(311, 4820)).toBeCloseTo((311 / 4820) * 500, 6); // 6.45% → 約 32%
    expect(gaugeOfShare(100, 1000)).toBe(50); // 10%
    expect(gaugeOfShare(0, 640)).toBe(0);
  });

  it('20% を超える割合は、右の端（100）で止める。登録が 0 以下なら null', () => {
    expect(gaugeOfShare(200, 1000)).toBe(100); // ちょうど 20%
    expect(gaugeOfShare(500, 1000)).toBe(100); // 50%
    expect(gaugeOfShare(10, 0)).toBeNull();
    expect(gaugeOfShare(10, -1)).toBeNull();
  });

  it('core の値（5 組 × 9 市）は、どれも 20% 以内（右の端で止まる市が無い）', () => {
    for (const a of ARTISTS) {
      const regs = metricValues(a.id, 'reg');
      CITIES.forEach((c, i) => {
        const share = (demandOf(a.id, c.name).expected * 100) / (regs[i] ?? 1);
        expect(share, `${a.id}・${c.name}`).toBeLessThanOrEqual(GAUGE_MAX_SHARE);
      });
    }
  });
});

describe('事務所向けの ① の一覧を、指標で出し分ける（N-2・N-3）', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    vi.stubGlobal('fetch', vi.fn());
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('V-30 Tech0・「人数」: 福岡市の行に「登録 4,820人」だけ。「311人」とゲージと割合は無い', () => {
    render(<App />);
    const row = rowOf('福岡市');
    expect(row.textContent).toContain('登録 4,820人');
    expect(row.textContent).not.toContain('311人');
    expect(row.textContent).not.toContain('%');
    expect(within(row).queryByTestId('rank-gauge')).toBeNull();
  });

  it('V-31 Tech0・「払える熱量」: 福岡市の行に「311人」とゲージ（目盛りの約 32%）。「登録 4,820人」と割合の文字は無い', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    const row = rowOf('福岡市');
    expect(row.textContent).toContain('311人');
    expect(row.textContent).not.toContain('登録');
    expect(row.textContent).not.toContain('4,820');
    expect(row.textContent).not.toContain('%');
    expect(widthOf(row)).toBeCloseTo(32.3, 1);
    expect(within(row).getByTestId('rank-gauge').getAttribute('aria-hidden')).toBe('true');
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s・「払える熱量」: 9 市の行が、順位・市の名前・見込みの人数だけの文字で、ゲージの長さは core の値から',
    (id) => {
      officeStore.setState({ artistId: id, metric: 'hot' });
      render(<App />);
      const regs = metricValues(id, 'reg');
      cityRankOf(id).forEach((r, n) => {
        const button = rows()[n];
        if (button === undefined) throw new Error('行が足りません');
        expect(button.textContent).toBe(`${n + 1}${r.name}${people(r.expected)}`);
        const reg = regs[CITIES.findIndex((c) => c.name === r.name)] ?? 0;
        // 長さは、小数 1 桁で style に書く（CityRank の toFixed(1)）
        expect(widthOf(button)).toBe(Number((gaugeOfShare(r.expected, reg) ?? -1).toFixed(1)));
      });
    },
  );

  it('指標を切り替えても、並び順と読み上げ（行の名前）は変わらない', () => {
    render(<App />);
    const names = () => rows().map((b) => b.getAttribute('aria-label'));
    const before = names();
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(names()).toEqual(before);
    expect(before[0]).toContain('登録の');
  });
});
