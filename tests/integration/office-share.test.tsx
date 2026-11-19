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

  // 2026-11-19、Issue #48 の統括の了承で、① の一覧の割合の文字（「登録の 6.5%」）を外し、「払える熱量」のときだけ、
  // 割合をゲージで出すようにした（N-2・N-3。docs/office/要件.md の N23-1・N23-3）。この 2 件の、一覧の割合の期待値だけを書き換えた
  it('V-19（N-3 で改め）Tech0 の ① の一覧で、福岡市の行に割合の文字は出ない。「払える熱量」のときは 6.5% のゲージが出る', () => {
    render(<App />);
    expect(rowOf('福岡市').textContent).not.toContain('%');
    expect(within(rowOf('福岡市')).queryByTestId('rank-gauge')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(rowOf('福岡市').textContent).not.toContain('%');
    expect(within(rowOf('福岡市')).getByTestId('rank-gauge').getAttribute('data-share')).toBe(
      '6.5%',
    );
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s: 「払える熱量」のとき、9 市すべての行に、core の値から出した割合のゲージが出る（N-3）',
    (id) => {
      officeStore.setState({ artistId: id, metric: 'hot' });
      render(<App />);
      const regs = metricValues(id, 'reg');
      for (const { name } of CITIES) {
        const share = shareOfReg(demandOf(id, name).expected, regs[cityIndex(name)] ?? 0);
        expect(within(rowOf(name)).getByTestId('rank-gauge').getAttribute('data-share')).toBe(
          share,
        );
      }
    },
  );

  it('V-32（N-4。元は V-19）⑥ の需要の出どころの行の横に、割合は出ない（出どころの文そのものは変えない）', () => {
    render(<App />);
    choose('福岡市');
    pickFirstVenue('福岡市');
    // 2026-11-19、Issue #48 の統括の了承で、⑥ の割合を外した（N-4。元は '（登録の 6.5%）' が出る）
    expect(screen.queryByTestId('demand-share')).toBeNull();
    expect(screen.getByTestId('demand-source').textContent).not.toContain('%');
  });

  it('会場を選ぶ前は、⑥ の割合は出ない', () => {
    render(<App />);
    choose('福岡市');
    expect(screen.queryByTestId('demand-share')).toBeNull();
  });
});
