// 事務所向け（/）の ④ これまでの公演: 久留米シティプラザ Cボックス（FUK-019）の記録が出る（要件 R-07・R-16）。
// 2026-11-16 に足した 5 件（出典は久留米シティプラザの公式の PDF）が、「記録あり」で、日の新しいものから出ることを確かめる。
// データと比べるだけだと、データが違っていても通るため、件数・日の並び・音の森の日・確認日は、値を直に書いて確かめる。
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
const past = () => screen.getByRole('region', { name: 'これまでの公演' });
/** core の会場 ID に当たる、データの公演（日の新しいものから） */
const eventsOf = (coreId: string) => {
  const record = VENUE_RECORDS.find((r) => r.coreVenueId === coreId);
  return PAST_EVENTS.filter((e) => e.venueId === record?.id).sort(
    (a, b) => b.date.localeCompare(a.date) || a.artist.localeCompare(b.artist, 'ja'),
  );
};
/** 久留米市 → Cボックスを選ぶ */
const openCbox = () => {
  render(<App />);
  choose('久留米市');
  fireEvent.click(screen.getByRole('button', { name: /Cボックス/ }));
};

/** Cボックスの公演の日（日の新しいものから。直に書く） */
const CBOX_DATES = ['2025-08-22', '2025-08-12', '2024-11-30', '2024-07-27', '2023-09-02'];

describe('事務所向けの ④ これまでの公演（久留米シティプラザ Cボックス）', () => {
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

  it('会場のデータは FUK-019 に当たり、公演は 5 件で、日の新しいものから並ぶ（データの側）', () => {
    expect(VENUE_RECORDS.find((r) => r.coreVenueId === 'cbox')?.id).toBe('FUK-019');
    const expected = eventsOf('cbox');
    expect(expected).toHaveLength(5);
    expect(expected.map((e) => e.date)).toEqual(CBOX_DATES);
  });

  it('久留米市 → Cボックスを選ぶと、④ に公演が 5 件、日の新しいものから出る', () => {
    openCbox();
    const items = within(past()).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    items.forEach((item, i) => {
      expect(item.textContent).toContain(eventDate(CBOX_DATES[i]!));
    });
  });

  it('1 件ずつ、出演者・日・出典のリンクが、データの値と一致する', () => {
    openCbox();
    const expected = eventsOf('cbox');
    const items = within(past()).getAllByRole('listitem');
    expect(items).toHaveLength(expected.length);
    items.forEach((item, i) => {
      const event = expected[i]!;
      expect(item.textContent).toContain(event.artist);
      expect(item.textContent).toContain(eventDate(event.date));
      const link = within(item).getByRole('link', { name: /出典/ });
      expect(link.getAttribute('href')).toBe(event.sourceUrl);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  it('音の森ピアノコンサート（戒重守（office音の森））は 2025年8月12日', () => {
    openCbox();
    const items = within(past()).getAllByRole('listitem');
    const otonomori = items.filter((item) => item.textContent?.includes('戒重守（office音の森）'));
    expect(otonomori).toHaveLength(1);
    expect(otonomori[0]!.textContent).toContain('2025年8月12日');
    expect(items[1]).toBe(otonomori[0]);
  });

  it('実在の札に確認日 2026-11-16 が出て、「記録は、まだありません」は出ない', () => {
    openCbox();
    expect(within(past()).getByTestId('real-chip').textContent).toBe(
      '実在の公開情報（出典あり・確認日 2026-11-16）',
    );
    expect(within(past()).queryByTestId('past-none')).toBeNull();
    expect(within(past()).queryByText('記録は、まだありません')).toBeNull();
  });
});
