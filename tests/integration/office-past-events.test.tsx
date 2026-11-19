// 事務所向け（/）の ④ これまでの公演（要件 R-07・R-16。受け入れ V-04。仕様 4.3〜4.5）。
// 2026-11-19、Issue #48 の統括の了承で、④ を画面から外した（docs/office/要件.md の N5-1。受け入れ V-28）。
// このファイルの、④ を表示する所の期待値だけを「④ が無い」に書き換えた（公演のデータの側の検査と、③ の会場の数の検査は、そのまま）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { PAST_EVENTS, VENUE_RECORDS } from '../../src/office/data';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
const side = (city: string) =>
  screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
/** ④ が画面に無い（見出し・公演の一覧・「会場を選ぶと出ます」などの文、のどれも無い）。N5-1 */
const expectNoPast = () => {
  expect(screen.queryByRole('region', { name: 'これまでの公演' })).toBeNull();
  expect(screen.queryByTestId('past-head')).toBeNull();
  expect(screen.queryByTestId('past-list')).toBeNull();
  expect(screen.queryByTestId('past-none')).toBeNull();
};
/** core の会場 ID に当たる、データの公演（日の新しいものから） */
const eventsOf = (coreId: string) => {
  const record = VENUE_RECORDS.find((r) => r.coreVenueId === coreId);
  return PAST_EVENTS.filter((e) => e.venueId === record?.id).sort(
    (a, b) => b.date.localeCompare(a.date) || a.artist.localeCompare(b.artist, 'ja'),
  );
};

describe('事務所向けの ④ これまでの公演', () => {
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

  it('N-5: 見出し「これまでの公演」は、初めから出ない。市を選んでも出ない', () => {
    render(<App />);
    expectNoPast();
    choose('福岡市');
    expectNoPast();
  });

  it('N-5: 公演のデータがある会場（DRUM SON）を選んでも、④ は出ない（データは残る）', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    const expected = eventsOf('FUK-016');
    expect(expected.length).toBeGreaterThan(0);
    expectNoPast();
  });

  it('N-5: 公演の記録が無い会場（RISE UP・メディキット県民文化センター）を選んでも、④ は出ない', () => {
    // RISE UP は会場のデータも無い。メディキットは会場のデータはあるが、公演が 0 件
    const cases = [
      { city: '久留米市', coreId: 'riseup', name: /RISE UP/ },
      { city: '宮崎市', coreId: 'MYZ-004', name: /メディキット県民文化センター/ },
    ];
    render(<App />);
    for (const { city, coreId, name } of cases) {
      expect(eventsOf(coreId)).toHaveLength(0);
      choose(city);
      fireEvent.click(screen.getByRole('button', { name }));
      expectNoPast();
    }
  });

  it('N-5: 会場を替えても、市を変えても、④ は出ない', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    fireEvent.click(screen.getByRole('button', { name: /DRUM Be-1/ }));
    expectNoPast();
    choose('北九州市');
    expectNoPast();
  });

  it('④ を外しても、③ の会場の数（li・ボタン）は変わらない', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    expectNoPast();
    expect(side('福岡市').querySelectorAll('li')).toHaveLength(3);
    expect(within(side('福岡市')).getAllByRole('button')).toHaveLength(3);
  });
});
