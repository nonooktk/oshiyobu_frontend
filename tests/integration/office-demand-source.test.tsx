// 事務所向け（/）の ⑥ の凡例の下の、需要の出どころ（要件 R-03。仕様 3.1）。
// 「{市}の登録 {登録}人 → 預金の支えがある熱いファン（見込み） {見込み}人」。
// 登録は core の metricValues(推し, 'reg')、見込みは core の demandOf(推し, 市).expected のまま。会場を選ぶと出る。強調はしない
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, CITIES, cityIndex, demandOf, metricValues } from '../../src/core';
import type { ArtistId, CityName } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { ARTIST_TEXT } from '../../src/office/text/artists';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
/** ③ の先頭の会場を選ぶ */
const pickFirstVenue = (city: string) => {
  const side = screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
  const first = within(side).getAllByRole('button').at(0);
  if (first === undefined) throw new Error(`${city}に会場がありません`);
  fireEvent.click(first);
};
const line = () => screen.getByTestId('demand-source');
const people = (n: number) => `${n.toLocaleString('ja-JP')}人`;
/** core の値だけで作る、期待する文 */
const expectedText = (artistId: ArtistId, city: CityName) =>
  `${city}の登録 ${people(metricValues(artistId, 'reg')[cityIndex(city)] ?? -1)} → ` +
  `預金の支えがある熱いファン（見込み） ${people(demandOf(artistId, city).expected)}`;

describe('事務所向けの ⑥ 需要の出どころ', () => {
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

  it('会場を選ぶ前は、出ない（市を選んだだけでも出ない）', () => {
    render(<App />);
    expect(screen.queryByTestId('demand-source')).toBeNull();
    choose('久留米市');
    expect(screen.queryByTestId('demand-source')).toBeNull();
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s: 9 市それぞれで、登録と見込みを core の値のまま出す（見込みは ⑥ の横棒と同じ）',
    (id) => {
      officeStore.setState({ artistId: id });
      render(<App />);
      for (const { name } of CITIES) {
        choose(name);
        pickFirstVenue(name);
        expect(line().textContent).toBe(expectedText(id, name));
        expect(screen.getByTestId('expected').textContent).toBe(`${demandOf(id, name).expected}人`);
      }
    },
  );

  it('会場を選んだまま推しを替えると、その推しの値に替わる', () => {
    render(<App />);
    choose('久留米市');
    pickFirstVenue('久留米市');
    expect(line().textContent).toBe(expectedText('tech0', '久留米市'));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ARTIST_TEXT.krs48.name) }));
    expect(line().textContent).toBe(expectedText('krs48', '久留米市'));
  });

  it('強調しない（行の中に、変わった印が無い）。架空の札の文を繰り返さない', () => {
    render(<App />);
    choose('久留米市');
    pickFirstVenue('久留米市');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ARTIST_TEXT.riji.name) }));
    expect(line().querySelector('[data-changed]')).toBeNull();
    expect(line().textContent).not.toContain('デモ用の架空データ');
    expect(line().textContent).not.toContain('架空（デモ用）');
  });
});
