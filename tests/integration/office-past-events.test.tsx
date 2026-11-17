// 事務所向け（/）の ④ これまでの公演（要件 R-07・R-16。受け入れ V-04。仕様 4.3〜4.5）。
// 選んだ会場の公演を、日の新しいものから、アーティスト・日・出典つきで出す。データの無い会場は「記録は、まだありません」。
// ④ は ③ の見出しの親の外に置く（I-03・C-05 が、③ の見出しの親の中の会場を数えるため）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { PAST_EVENTS, VENUE_RECORDS } from '../../src/office/data';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { eventDate } from '../../src/office/text/labels';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
const side = (city: string) =>
  screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
const past = () => screen.getByRole('region', { name: 'これまでの公演' });
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

  it('見出し「これまでの公演」は、初めから出ている。会場を選ぶまでは「会場を選ぶと出ます」', () => {
    render(<App />);
    expect(screen.getByTestId('past-head').textContent).toBe('これまでの公演');
    expect(within(past()).getByTestId('past-none').textContent).toBe('会場を選ぶと出ます');
    choose('福岡市');
    expect(within(past()).getByTestId('past-none').textContent).toBe('会場を選ぶと出ます');
  });

  it('会場を選ぶと、その会場の公演が、日の新しいものから、アーティスト・日・出典つきで出る', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    const expected = eventsOf('FUK-016');
    expect(expected.length).toBeGreaterThan(0);
    const items = within(past()).getAllByRole('listitem');
    expect(items).toHaveLength(expected.length);
    items.forEach((item, i) => {
      const event = expected[i]!;
      expect(item.textContent).toContain(eventDate(event.date));
      expect(item.textContent).toContain(event.artist);
      const link = within(item).getByRole('link', { name: /出典/ });
      expect(link.getAttribute('href')).toBe(event.sourceUrl);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
    // ④ の札は、出している公演の確認日のいちばん新しい日
    const latest = expected
      .map((e) => e.checkedOn)
      .sort()
      .at(-1);
    expect(within(past()).getByTestId('real-chip').textContent).toBe(
      `実在の公開情報（出典あり・確認日 ${latest}）`,
    );
  });

  it('公演の記録が無い会場（RISE UP・メディキット県民文化センター）は「記録は、まだありません」で、④ の札は出さない', () => {
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
      expect(within(past()).getByTestId('past-none').textContent).toBe('記録は、まだありません');
      expect(within(past()).queryByTestId('real-chip')).toBeNull();
      expect(within(past()).queryByRole('listitem')).toBeNull();
    }
  });

  it('会場を替えると、④ もその会場の公演に替わる。市を変えると「会場を選ぶと出ます」に戻る', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    fireEvent.click(screen.getByRole('button', { name: /DRUM Be-1/ }));
    expect(within(past()).getAllByRole('listitem')).toHaveLength(eventsOf('FUK-012').length);
    choose('北九州市');
    expect(within(past()).getByTestId('past-none').textContent).toBe('会場を選ぶと出ます');
  });

  it('④ は ③ の見出しの親の外にあり、③ の会場の数（li・ボタン）を変えない', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    expect(side('福岡市').contains(past())).toBe(false);
    expect(side('福岡市').querySelectorAll('li')).toHaveLength(3);
    expect(within(side('福岡市')).getAllByRole('button')).toHaveLength(3);
  });
});
