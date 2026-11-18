// 事務所向け（/）の、見込みが登録の何 % か（docs/office/要件.md の M-01・V-19。仕様 9.2）。
// ① の市の一覧の各行と、⑥ の需要の出どころの行に出す。割合は core の 2 つの値を割るだけ（小数 1 桁で四捨五入、半角の %）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, CITIES, cityIndex, demandOf, metricValues } from '../../src/core';
import { App } from '../../src/office/App';
import { shareOfReg } from '../../src/office/share';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
const pickFirstVenue = (city: string) => {
  const side = screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
  const first = within(side).getAllByRole('button').at(0);
  if (first === undefined) throw new Error(`${city}に会場がありません`);
  fireEvent.click(first);
};
/** 一覧の、その市の行 */
const rowOf = (city: string) => {
  const row = within(screen.getByTestId('city-rank'))
    .getAllByRole('button')
    .find((button) => button.textContent?.includes(city));
  if (row === undefined) throw new Error(`一覧に${city}がありません`);
  return row;
};

describe('割合の関数（shareOfReg）', () => {
  it('小数 1 桁で四捨五入し、半角の % を付ける', () => {
    expect(shareOfReg(311, 4820)).toBe('6.5%'); // 6.452…
    expect(shareOfReg(273, 1500)).toBe('18.2%');
    expect(shareOfReg(187, 1380)).toBe('13.6%'); // 13.550…
    expect(shareOfReg(0, 640)).toBe('0.0%');
    expect(shareOfReg(50, 50)).toBe('100.0%');
  });

  it('登録が 0 以下のときは、割合を出さない（null）', () => {
    expect(shareOfReg(10, 0)).toBeNull();
    expect(shareOfReg(10, -1)).toBeNull();
  });
});

describe('事務所向けの割合の表示', () => {
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

  it('V-19 Tech0 の ① の一覧で、福岡市の行に「登録の 6.5%」が出る', () => {
    render(<App />);
    expect(within(rowOf('福岡市')).getByTestId('rank-share').textContent).toBe('登録の 6.5%');
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s: 9 市すべての行に、core の値から出した割合が出る',
    (id) => {
      officeStore.setState({ artistId: id });
      render(<App />);
      const regs = metricValues(id, 'reg');
      for (const { name } of CITIES) {
        const share = shareOfReg(demandOf(id, name).expected, regs[cityIndex(name)] ?? 0);
        expect(within(rowOf(name)).getByTestId('rank-share').textContent).toBe(`登録の ${share}`);
      }
    },
  );

  it('V-19 ⑥ の需要の出どころの行の横に、同じ割合が出る（出どころの文そのものは変えない）', () => {
    render(<App />);
    choose('福岡市');
    pickFirstVenue('福岡市');
    expect(screen.getByTestId('demand-share').textContent).toBe('（登録の 6.5%）');
    expect(screen.getByTestId('demand-source').textContent).not.toContain('%');
  });

  it('会場を選ぶ前は、⑥ の割合は出ない', () => {
    render(<App />);
    choose('福岡市');
    expect(screen.queryByTestId('demand-share')).toBeNull();
  });
});
